import { auth } from "@/lib/auth";
import { unauthorizedResponse, noTallerResponse, validationErrorResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { dayRangeAR, todayAR } from "@/lib/dates";
import { round2 } from "@/lib/money";
import { DailyCloseSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
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

    const closes = await db.dailyClose.findMany({
      where: { tallerId: userTaller.tallerId },
      orderBy: { fecha: "desc" },
    });

    return NextResponse.json(closes, { status: 200 });
  } catch (error) {
    console.error("DailyCloses GET error:", error);
    return NextResponse.json(
      { error: "No se pudo cargar la información. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}

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
    const validation = DailyCloseSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const { fecha, notas } = validation.data;
    // "fecha" es el día del calendario argentino; el rango de movimientos es ese día en hora argentina
    const fechaDate = new Date(`${fecha}T00:00:00.000Z`);

    if (fecha > todayAR()) {
      return NextResponse.json(
        { error: "No se puede cerrar una fecha futura." },
        { status: 400 }
      );
    }

    const existing = await db.dailyClose.findUnique({
      where: { tallerId_fecha: { tallerId: userTaller.tallerId, fecha: fechaDate } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "La caja de este día ya fue cerrada." },
        { status: 409 }
      );
    }

    const laterClose = await db.dailyClose.findFirst({
      where: { tallerId: userTaller.tallerId, fecha: { gt: fechaDate } },
      select: { id: true },
    });
    if (laterClose) {
      return NextResponse.json(
        { error: "Ya existe un cierre de un día posterior. Los cierres deben hacerse en orden cronológico." },
        { status: 409 }
      );
    }

    const previousClose = await db.dailyClose.findFirst({
      where: { tallerId: userTaller.tallerId, fecha: { lt: fechaDate } },
      orderBy: { fecha: "desc" },
    });
    const saldoInicial = previousClose?.saldoFinal ?? 0;

    const { start, end } = dayRangeAR(fecha);

    const movements = await db.cashMovement.findMany({
      where: { tallerId: userTaller.tallerId, fecha: { gte: start, lt: end } },
    });
    const totalIngresos = round2(
      movements.filter((m) => m.tipo === "INGRESO").reduce((sum, m) => sum + m.monto, 0)
    );
    const totalEgresos = round2(
      movements.filter((m) => m.tipo === "EGRESO").reduce((sum, m) => sum + m.monto, 0)
    );
    const saldoFinal = round2(saldoInicial + totalIngresos - totalEgresos);

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
      { error: "No se pudo cerrar la caja. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}
