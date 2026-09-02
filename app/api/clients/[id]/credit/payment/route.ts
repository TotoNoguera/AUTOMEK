import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
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

    const client = await db.client.findUnique({ where: { id } });
    if (!client || client.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const body = await request.json();
    const validation = ClientCreditPaymentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { monto, observaciones } = validation.data;

    const updated = await db.$transaction(async (tx) => {
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
        data: { saldo: credit.saldo + monto },
      });

      const cashMovement = await tx.cashMovement.create({
        data: {
          tallerId: userTaller.tallerId,
          tipo: "INGRESO",
          categoria: "ANTICIPO",
          monto,
          descripcion: observaciones || `Pago cuenta corriente - ${client.nombre}`,
        },
      });

      await tx.auditLog.create({
        data: {
          tallerId: userTaller.tallerId,
          accion: "CLIENT_CREDIT_UPDATED",
          entityType: "CLIENT_CREDIT",
          entityId: updatedCredit.id,
          oldValue: JSON.stringify({ saldo: saldoAnterior }),
          newValue: JSON.stringify({ saldo: updatedCredit.saldo }),
          descripcion: `Pago de $${monto.toFixed(2)} registrado en cuenta corriente`,
        },
      });
      await tx.auditLog.create({
        data: {
          tallerId: userTaller.tallerId,
          accion: "CASH_MOVEMENT_RECORDED",
          entityType: "CASH_MOVEMENT",
          entityId: cashMovement.id,
          newValue: JSON.stringify({ tipo: "INGRESO", monto, categoria: "ANTICIPO" }),
        },
      });

      return updatedCredit;
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("ClientCredit payment POST error:", error);
    return NextResponse.json(
      { error: "Error registering credit payment" },
      { status: 500 }
    );
  }
}
