import { auth } from "@/lib/auth";
import { noTallerResponse, prismaCode, unauthorizedResponse, validationErrorResponse } from "@/lib/api";
import { BusinessError } from "@/lib/cash";
import { db } from "@/lib/db";
import { reverseCashMovement } from "@/lib/reversal";
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

    try {
      const reversal = await db.$transaction(
        (tx) =>
          reverseCashMovement(tx, id, {
            tallerId: userTaller.tallerId,
            userId: session.user.id,
            motivo: validation.data.motivo,
          }),
        { timeout: 30000, maxWait: 20000 }
      );
      return NextResponse.json(reversal, { status: 201 });
    } catch (err) {
      if (err instanceof BusinessError) return NextResponse.json({ error: err.message }, { status: err.status });
      if (prismaCode(err) === "P2002") {
        return NextResponse.json({ error: "Este movimiento ya fue anulado." }, { status: 409 });
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
    console.error("CashMovement reverse POST error:", error);
    return NextResponse.json({ error: "No se pudo anular el movimiento. Reintentá en unos segundos." }, { status: 500 });
  }
}
