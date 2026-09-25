import { auth } from "@/lib/auth";
import { unauthorizedResponse, noTallerResponse, validationErrorResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { BusinessError, CASH_CLOSED_MESSAGE, isTodayClosed } from "@/lib/cash";
import { CashMovementEgresoSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

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

    const body = await request.json();
    const validation = CashMovementEgresoSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const { categoria, monto, descripcion } = validation.data;

    let cashMovement;
    try {
      cashMovement = await db.$transaction(async (tx) => {
        if (await isTodayClosed(tx, userTaller.tallerId)) {
          throw new BusinessError(CASH_CLOSED_MESSAGE, 409);
        }
        const created = await tx.cashMovement.create({
          data: {
            tallerId: userTaller.tallerId,
            tipo: "EGRESO",
            categoria,
            monto,
            descripcion,
          },
        });
        await tx.auditLog.create({
          data: {
            tallerId: userTaller.tallerId,
            accion: "CASH_MOVEMENT_RECORDED",
            entityType: "CASH_MOVEMENT",
            entityId: created.id,
            newValue: JSON.stringify({ tipo: "EGRESO", monto, categoria }),
          },
        });
        return created;
      });
    } catch (err) {
      if (err instanceof BusinessError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }

    return NextResponse.json(cashMovement, { status: 201 });
  } catch (error) {
    console.error("CashMovements egreso POST error:", error);
    return NextResponse.json(
      { error: "No se pudo registrar el egreso. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}
