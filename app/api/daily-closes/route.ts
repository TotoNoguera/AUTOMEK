import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DailyCloseSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
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

    const closes = await db.dailyClose.findMany({
      where: { tallerId: userTaller.tallerId },
      orderBy: { fecha: "desc" },
    });

    return NextResponse.json(closes, { status: 200 });
  } catch (error) {
    console.error("DailyCloses GET error:", error);
    return NextResponse.json(
      { error: "Error fetching daily closes" },
      { status: 500 }
    );
  }
}

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
    const validation = DailyCloseSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { fecha, notas } = validation.data;
    const fechaDate = new Date(`${fecha}T00:00:00.000Z`);

    const today = new Date();
    today.setUTCHours(23, 59, 59, 999);
    if (fechaDate > today) {
      return NextResponse.json(
        { error: "No se puede cerrar una fecha futura" },
        { status: 400 }
      );
    }

    const existing = await db.dailyClose.findUnique({
      where: { tallerId_fecha: { tallerId: userTaller.tallerId, fecha: fechaDate } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "La caja de este día ya fue cerrada" },
        { status: 409 }
      );
    }

    const previousClose = await db.dailyClose.findFirst({
      where: { tallerId: userTaller.tallerId, fecha: { lt: fechaDate } },
      orderBy: { fecha: "desc" },
    });
    const saldoInicial = previousClose?.saldoFinal ?? 0;

    const start = new Date(`${fecha}T00:00:00.000Z`);
    const end = new Date(`${fecha}T23:59:59.999Z`);

    const movements = await db.cashMovement.findMany({
      where: { tallerId: userTaller.tallerId, fecha: { gte: start, lte: end } },
    });
    const totalIngresos = movements
      .filter((m) => m.tipo === "INGRESO")
      .reduce((sum, m) => sum + m.monto, 0);
    const totalEgresos = movements
      .filter((m) => m.tipo === "EGRESO")
      .reduce((sum, m) => sum + m.monto, 0);
    const saldoFinal = saldoInicial + totalIngresos - totalEgresos;

    try {
      const dailyClose = await db.$transaction(async (tx) => {
        const created = await tx.dailyClose.create({
          data: {
            tallerId: userTaller.tallerId,
            fecha: fechaDate,
            estado: "CERRADO",
            saldoInicial,
            totalIngresos,
            totalEgresos,
            saldoFinal,
            notas,
            closedAt: new Date(),
          },
        });

        await tx.auditLog.create({
          data: {
            tallerId: userTaller.tallerId,
            accion: "DAILY_CLOSE_CLOSED",
            entityType: "DAILY_CLOSE",
            entityId: created.id,
            newValue: JSON.stringify({ saldoInicial, totalIngresos, totalEgresos, saldoFinal }),
          },
        });

        return created;
      });

      return NextResponse.json(dailyClose, { status: 201 });
    } catch (err) {
      // Backstop ante condición de carrera: el constraint único (tallerId, fecha) rechaza duplicados concurrentes
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        return NextResponse.json(
          { error: "La caja de este día ya fue cerrada" },
          { status: 409 }
        );
      }
      throw err;
    }
  } catch (error) {
    console.error("DailyCloses POST error:", error);
    return NextResponse.json(
      { error: "Error closing daily cash" },
      { status: 500 }
    );
  }
}
