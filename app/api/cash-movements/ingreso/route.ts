import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { CashMovementIngresoSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userTaller = await db.userTaller.findFirst({
      where: { userId: session.user.id },
    });
    if (!userTaller) {
      return NextResponse.json(
        { error: "User not associated with a taller" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = CashMovementIngresoSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { workOrderId, methodId, monto, descripcion } = validation.data;

    const method = await db.paymentMethod.findUnique({ where: { id: methodId } });
    if (!method || method.tallerId !== userTaller.tallerId) {
      return NextResponse.json(
        { error: "Payment method not found" },
        { status: 404 }
      );
    }

    if (workOrderId) {
      const workOrder = await db.workOrder.findUnique({ where: { id: workOrderId } });
      if (!workOrder || workOrder.tallerId !== userTaller.tallerId) {
        return NextResponse.json(
          { error: "Work order not found" },
          { status: 404 }
        );
      }
    }

    const categoria = workOrderId ? "PAGO_ORDEN" : "ANTICIPO";

    if (method.tipo === "CUENTA_CORRIENTE") {
      if (!workOrderId) {
        return NextResponse.json(
          { error: "Cuenta corriente requiere una orden de trabajo asociada" },
          { status: 400 }
        );
      }

      try {
        const result = await db.$transaction(async (tx) => {
          // Re-lee la orden y sus pagos dentro de la transacción para evitar condiciones de carrera
          const workOrder = await tx.workOrder.findUniqueOrThrow({
            where: { id: workOrderId },
            include: { payments: true, client: true },
          });

          const pagado = workOrder.payments
            .filter((p) => p.status === "PAGADO")
            .reduce((sum, p) => sum + p.monto, 0);
          const pendiente = workOrder.total - pagado;

          if (monto > pendiente + 0.01) {
            throw new Error(
              `PENDIENTE_EXCEEDED:${pendiente.toFixed(2)}`
            );
          }

          const payment = await tx.payment.create({
            data: {
              tallerId: userTaller.tallerId,
              workOrderId: workOrder.id,
              methodId: method.id,
              monto,
              status: "PAGADO",
            },
          });

          let credit = await tx.clientCredit.findUnique({
            where: {
              tallerId_clientId: { tallerId: userTaller.tallerId, clientId: workOrder.clientId },
            },
          });
          if (!credit) {
            credit = await tx.clientCredit.create({
              data: { tallerId: userTaller.tallerId, clientId: workOrder.clientId, saldo: 0 },
            });
          }
          credit = await tx.clientCredit.update({
            where: { id: credit.id },
            data: { saldo: credit.saldo - monto },
          });

          await tx.auditLog.create({
            data: {
              tallerId: userTaller.tallerId,
              accion: "PAYMENT_RECORDED",
              entityType: "PAYMENT",
              entityId: payment.id,
              descripcion: `Pago de $${monto.toFixed(2)} cargado a cuenta corriente para orden ${workOrder.id}`,
            },
          });
          await tx.auditLog.create({
            data: {
              tallerId: userTaller.tallerId,
              accion: "CLIENT_CREDIT_UPDATED",
              entityType: "CLIENT_CREDIT",
              entityId: credit.id,
              newValue: JSON.stringify({ saldo: credit.saldo }),
            },
          });

          return { payment, clientCredit: credit };
        });

        return NextResponse.json(result, { status: 201 });
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("PENDIENTE_EXCEEDED:")) {
          const pendiente = err.message.split(":")[1];
          return NextResponse.json(
            { error: `El monto excede el saldo pendiente de la orden ($${pendiente})` },
            { status: 400 }
          );
        }
        throw err;
      }
    }

    try {
      const cashMovement = await db.$transaction(async (tx) => {
        let payment = null;
        let workOrder = null;

        if (workOrderId) {
          // Re-lee la orden y sus pagos dentro de la transacción para evitar condiciones de carrera
          workOrder = await tx.workOrder.findUniqueOrThrow({
            where: { id: workOrderId },
            include: { payments: true },
          });

          const pagado = workOrder.payments
            .filter((p) => p.status === "PAGADO")
            .reduce((sum, p) => sum + p.monto, 0);
          const pendiente = workOrder.total - pagado;

          if (monto > pendiente + 0.01) {
            throw new Error(`PENDIENTE_EXCEEDED:${pendiente.toFixed(2)}`);
          }

          payment = await tx.payment.create({
            data: {
              tallerId: userTaller.tallerId,
              workOrderId: workOrder.id,
              methodId: method.id,
              monto,
              status: "PAGADO",
            },
          });
        }

        const movement = await tx.cashMovement.create({
          data: {
            tallerId: userTaller.tallerId,
            tipo: "INGRESO",
            categoria,
            monto,
            descripcion,
            workOrderId: workOrderId || null,
            paymentId: payment?.id || null,
          },
          include: { workOrder: { include: { client: true, vehicle: true } } },
        });

        await tx.auditLog.create({
          data: {
            tallerId: userTaller.tallerId,
            accion: "CASH_MOVEMENT_RECORDED",
            entityType: "CASH_MOVEMENT",
            entityId: movement.id,
            newValue: JSON.stringify({ tipo: "INGRESO", monto, categoria }),
          },
        });
        if (payment) {
          await tx.auditLog.create({
            data: {
              tallerId: userTaller.tallerId,
              accion: "PAYMENT_RECORDED",
              entityType: "PAYMENT",
              entityId: payment.id,
              descripcion: `Pago de $${monto.toFixed(2)} registrado para orden ${workOrderId}`,
            },
          });
        }

        return movement;
      });

      return NextResponse.json(cashMovement, { status: 201 });
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("PENDIENTE_EXCEEDED:")) {
        const pendiente = err.message.split(":")[1];
        return NextResponse.json(
          { error: `El monto excede el saldo pendiente de la orden ($${pendiente})` },
          { status: 400 }
        );
      }
      throw err;
    }
  } catch (error) {
    console.error("CashMovements ingreso POST error:", error);
    return NextResponse.json(
      { error: "Error registering ingreso" },
      { status: 500 }
    );
  }
}
