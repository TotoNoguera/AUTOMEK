import { auth } from "@/lib/auth";
import { unauthorizedResponse, noTallerResponse, validationErrorResponse, prismaCode } from "@/lib/api";
import { db } from "@/lib/db";
import { BusinessError, CASH_CLOSED_MESSAGE, isTodayClosed, lockClient } from "@/lib/cash";
import { round2 } from "@/lib/money";
import { ClientCreditPaymentSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    const client = await db.client.findUnique({ where: { id } });
    if (!client || client.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
    }

    const body = await request.json();
    const validation = ClientCreditPaymentSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const { monto, observaciones } = validation.data;

    let updated;
    try {
    updated = await db.$transaction(async (tx) => {
      if (await isTodayClosed(tx, userTaller.tallerId)) {
        throw new BusinessError(CASH_CLOSED_MESSAGE, 409);
      }
      // Bloquea al cliente: pagos simultáneos de cuenta corriente se aplican de a uno sin perder saldo
      await lockClient(tx, id);
      let credit = await tx.clientCredit.findUnique({
        where: { tallerId_clientId: { tallerId: userTaller.tallerId, clientId: id } },
      });
      if (!credit) {
        credit = await tx.clientCredit.create({
          data: { tallerId: userTaller.tallerId, clientId: id, saldo: 0 },
        });
      }

      const saldoAnterior = credit.saldo;

      const updatedCredit = await tx.clientCredit.update({
        where: { id: credit.id },
        data: { saldo: round2(credit.saldo + monto) },
      });

      const cashMovement = await tx.cashMovement.create({
        data: {
          tallerId: userTaller.tallerId,
          tipo: "INGRESO",
          categoria: "ANTICIPO",
          monto,
          clientId: id,
          descripcion: observaciones || `Pago cuenta corriente - ${client.nombre}`,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
tallerId: userTaller.tallerId,
          accion: "CLIENT_CREDIT_UPDATED",
          entityType: "CLIENT_CREDIT",
          entityId: updatedCredit.id,
          oldValue: JSON.stringify({ saldo: saldoAnterior }),
          newValue: JSON.stringify({ saldo: updatedCredit.saldo }),
          descripcion: `Pago de ${monto.toFixed(2)} registrado en cuenta corriente`,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
tallerId: userTaller.tallerId,
          accion: "CASH_MOVEMENT_RECORDED",
          entityType: "CASH_MOVEMENT",
          entityId: cashMovement.id,
          newValue: JSON.stringify({ tipo: "INGRESO", monto, categoria: "ANTICIPO" }),
        },
      });

      return updatedCredit;
    }, { timeout: 30000, maxWait: 20000 });
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

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("ClientCredit payment POST error:", error);
    return NextResponse.json(
      { error: "No se pudo registrar el pago. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}
