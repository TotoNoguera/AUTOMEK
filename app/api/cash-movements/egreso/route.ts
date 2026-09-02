import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { CashMovementEgresoSchema } from "@/lib/validations";
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
    const validation = CashMovementEgresoSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { categoria, monto, descripcion } = validation.data;

    const cashMovement = await db.cashMovement.create({
      data: {
        tallerId: userTaller.tallerId,
        tipo: "EGRESO",
        categoria,
        monto,
        descripcion,
      },
    });

    await db.auditLog.create({
      data: {
        tallerId: userTaller.tallerId,
        accion: "CASH_MOVEMENT_RECORDED",
        entityType: "CASH_MOVEMENT",
        entityId: cashMovement.id,
        newValue: JSON.stringify({ tipo: "EGRESO", monto, categoria }),
      },
    });

    return NextResponse.json(cashMovement, { status: 201 });
  } catch (error) {
    console.error("CashMovements egreso POST error:", error);
    return NextResponse.json(
      { error: "Error registering egreso" },
      { status: 500 }
    );
  }
}
