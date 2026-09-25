import { auth } from "@/lib/auth";
import { unauthorizedResponse, noTallerResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { monthRangeAR, shiftMonth, yearMonthAR } from "@/lib/dates";
import { round2 } from "@/lib/money";
import { NextResponse } from "next/server";

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
    const tallerId = userTaller.tallerId;
    const now = yearMonthAR();

    const monthlyData: Array<{
      mes: number;
      anio: number;
      ingresos: number;
      costos: number;
      costosFijos: number;
      costosVariables: number;
      margen: number;
    }> = [];

    for (let i = 5; i >= 0; i--) {
      const { year: anio, month: mes } = shiftMonth(now.year, now.month, -i);
      const { start: mStart, end: mEnd } = monthRangeAR(anio, mes);

      const [movements, costs] = await Promise.all([
        db.cashMovement.findMany({
          where: { tallerId, tipo: "INGRESO", fecha: { gte: mStart, lt: mEnd } },
        }),
        db.cost.findMany({
          where: { tallerId, mes, anio },
        }),
      ]);

      const ingresos = round2(movements.reduce((s, m) => s + m.monto, 0));
      const costosFijos = round2(costs.filter((c) => c.tipo === "FIJO").reduce((s, c) => s + c.monto, 0));
      const costosVariables = round2(
        costs.filter((c) => c.tipo === "VARIABLE").reduce((s, c) => s + c.monto, 0)
      );
      const costosTotal = round2(costosFijos + costosVariables);

      monthlyData.push({
        mes,
        anio,
        ingresos,
        costos: costosTotal,
        costosFijos,
        costosVariables,
        margen: round2(ingresos - costosTotal),
      });
    }

    // Costos por categoría del mes actual
    const currentMes = now.month;
    const currentAnio = now.year;
    const currentCosts = await db.cost.findMany({
      where: { tallerId, mes: currentMes, anio: currentAnio },
    });
    const porCategoria = new Map<string, number>();
    for (const c of currentCosts) {
      porCategoria.set(c.categoria, (porCategoria.get(c.categoria) || 0) + c.monto);
    }

    return NextResponse.json(
      {
        monthlyData,
        costosPorCategoriaMesActual: Array.from(porCategoria.entries()).map(
          ([categoria, monto]) => ({ categoria, monto })
        ),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("PnL report GET error:", error);
    return NextResponse.json(
      { error: "No se pudo cargar la información. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}
