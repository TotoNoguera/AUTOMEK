import { auth } from "@/lib/auth";
import { noTallerResponse, prismaCode, unauthorizedResponse, validationErrorResponse } from "@/lib/api";
import { BusinessError } from "@/lib/cash";
import { db } from "@/lib/db";
import { annulCreditCharge, reverseCashMovement } from "@/lib/reversal";
import { ReversalSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await auth();
    if (!session?.user) return unauthorizedResponse();

    const userTaller = await db.userTaller.findFirst({ where: { userId: session.user.id } });
    if (!userTaller) return noTallerResponse();

    const validation = ReversalSchema.safeParse(await request.json());
    if (!validation.success) return validationErrorResponse(validation.error);

    const payment = await db.payment.findUnique({ where: { id }, include: { method: true } });
    if (!payment || payment.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Pago no encontrado." }, { status: 404 });
    }
    if (payment.status !== "PAGADO") {
      return NextResponse.json({ error: "Este pago ya fue anulado." }, { status: 409 });
    }

    const actor = { tallerId: userTaller.tallerId, userId: session.user.id, motivo: validation.data.motivo };
    try {
      const result = await db.$transaction(
        async (tx) => {
          if (payment.method.tipo === "CUENTA_CORRIENTE") {
            return annulCreditCharge(tx, id, actor);
          }
          // Cobro en caja: se anula mediante su movimiento (queda el contraasiento en Caja)
          const movement = await tx.cashMovement.findFirst({ where: { paymentId: id, tallerId: actor.tallerId } });
          if (!movement) throw new BusinessError("No se encontró el movimiento de caja de este pago.", 404);
          return reverseCashMovement(tx, movement.id, actor);
        },
        { timeout: 30000, maxWait: 20000 }
      );
      return NextResponse.json(result, { status: 201 });
    } catch (err) {
      if (err instanceof BusinessError) return NextResponse.json({ error: err.message }, { status: err.status });
      if (prismaCode(err) === "P2002") {
        return NextResponse.json({ error: "Este pago ya fue anulado." }, { status: 409 });
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
    console.error("Payment annul POST error:", error);
    return NextResponse.json({ error: "No se pudo anular el pago. Reintentá en unos segundos." }, { status: 500 });
  }
}
