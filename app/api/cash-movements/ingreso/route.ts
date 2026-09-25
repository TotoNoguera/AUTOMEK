import { auth } from "@/lib/auth";
import { unauthorizedResponse, noTallerResponse, validationErrorResponse, prismaCode } from "@/lib/api";
import { BusinessError, CASH_CLOSED_MESSAGE, isTodayClosed, lockClient, lockWorkOrder } from "@/lib/cash";
import { db } from "@/lib/db";
import { pendingAmount, round2 } from "@/lib/money";
import { CashMovementIngresoSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

const fmt = (n: number) => n.toFixed(2);

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorizedResponse();
    }

    const userTaller = await db.userTaller.findFirst({
      where: { userId: session.user.id },
    });
    if (!userTaller) {
      return noTallerResponse();
    }
    const tallerId = userTaller.tallerId;

    const body = await request.json();
    const validation = CashMovementIngresoSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const { workOrderId, methodId, monto, descripcion } = validation.data;

    const method = await db.paymentMethod.findUnique({ where: { id: methodId } });
    if (!method || method.tallerId !== tallerId) {
      return NextResponse.json({ error: "Método de pago no encontrado." }, { status: 404 });
    }

    if (workOrderId) {
      const workOrder = await db.workOrder.findUnique({ where: { id: workOrderId } });
      if (!workOrder || workOrder.tallerId !== tallerId) {
        return NextResponse.json({ error: "Orden de trabajo no encontrada." }, { status: 404 });
      }
    }

    const isCuentaCorriente = method.tipo === "CUENTA_CORRIENTE";
    if (isCuentaCorriente && !workOrderId) {
      return NextResponse.json(
        { error: "La cuenta corriente requiere elegir una orden de trabajo." },
        { status: 400 }
      );
    }

    const categoria = workOrderId ? "PAGO_ORDEN" : "ANTICIPO";

    try {
      const result = await db.$transaction(async (tx) => {
        // Un cargo a cuenta corriente no mueve caja; cualquier otro ingreso sí y no puede ir a un día cerrado.
        if (!isCuentaCorriente && (await isTodayClosed(tx, tallerId))) {
          throw new BusinessError(CASH_CLOSED_MESSAGE, 409);
        }

        let workOrder = null;
        if (workOrderId) {
          // Bloquea la orden: pagos simultáneos se ejecutan de a uno y ven los pagos anteriores
          await lockWorkOrder(tx, workOrderId);
          workOrder = await tx.workOrder.findUniqueOrThrow({
            where: { id: workOrderId },
            include: { payments: true },
          });

          const pendiente = pendingAmount(workOrder.total, workOrder.payments);
          if (pendiente <= 0.004) {
            throw new BusinessError("Esta orden ya está totalmente pagada.", 400);
          }
          if (monto - pendiente > 0.004) {
            throw new BusinessError(
              `El monto ($${fmt(monto)}) supera el saldo pendiente de la orden ($${fmt(pendiente)}).`,
              400
            );
          }
        }

        const payment = workOrder
          ? await tx.payment.create({
              data: {
                tallerId,
                workOrderId: workOrder.id,
                methodId: method.id,
                monto,
                status: "PAGADO",
              },
            })
          : null;

        if (isCuentaCorriente && workOrder && payment) {
          await lockClient(tx, workOrder.clientId);
          let credit = await tx.clientCredit.findUnique({
            where: { tallerId_clientId: { tallerId, clientId: workOrder.clientId } },
          });
          if (!credit) {
            credit = await tx.clientCredit.create({
              data: { tallerId, clientId: workOrder.clientId, saldo: 0 },
            });
          }
          const saldoAnterior = credit.saldo;
          credit = await tx.clientCredit.update({
            where: { id: credit.id },
            data: { saldo: round2(credit.saldo - monto) },
          });

          await tx.auditLog.create({
            data: {
              userId: session.user.id,
tallerId,
              accion: "PAYMENT_RECORDED",
              entityType: "PAYMENT",
              entityId: payment.id,
              descripcion: `Pago de $${fmt(monto)} cargado a cuenta corriente para orden ${workOrder.id}`,
            },
          });
          await tx.auditLog.create({
            data: {
              userId: session.user.id,
tallerId,
              accion: "CLIENT_CREDIT_UPDATED",
              entityType: "CLIENT_CREDIT",
              entityId: credit.id,
              oldValue: JSON.stringify({ saldo: saldoAnterior }),
              newValue: JSON.stringify({ saldo: credit.saldo }),
            },
          });

          return { payment, clientCredit: credit };
        }

        const movement = await tx.cashMovement.create({
          data: {
            tallerId,
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
            userId: session.user.id,
tallerId,
            accion: "CASH_MOVEMENT_RECORDED",
            entityType: "CASH_MOVEMENT",
            entityId: movement.id,
            newValue: JSON.stringify({ tipo: "INGRESO", monto, categoria }),
          },
        });
        if (payment) {
          await tx.auditLog.create({
            data: {
              userId: session.user.id,
tallerId,
              accion: "PAYMENT_RECORDED",
              entityType: "PAYMENT",
              entityId: payment.id,
              descripcion: `Pago de $${fmt(monto)} registrado para orden ${workOrderId}`,
            },
          });
        }

        return movement;
      }, { timeout: 30000, maxWait: 20000 });

      return NextResponse.json(result, { status: 201 });
    } catch (err) {
      if (err instanceof BusinessError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      if (prismaCode(err) === "P2028" || prismaCode(err) === "P2034") {
        return NextResponse.json(
          { error: "Hay otra operación en curso sobre estos datos. Esperá unos segundos y reintentá." },
          { status: 409 }
        );
      }
      throw err;
    }
  } catch (error) {
    console.error("CashMovements ingreso POST error:", error);
    return NextResponse.json(
      { error: "No se pudo registrar el ingreso. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}
