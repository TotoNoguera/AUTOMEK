import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

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
    const tallerId = userTaller.tallerId;
    const now = new Date();

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
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const mes = d.getUTCMonth() + 1;
      const anio = d.getUTCFullYear();
      const mStart = new Date(Date.UTC(anio, mes - 1, 1));
      const mEnd = new Date(Date.UTC(anio, mes, 1));

      const [movements, costs] = await Promise.all([
        db.cashMovement.findMany({
          where: { tallerId, tipo: "INGRESO", fecha: { gte: mStart, lt: mEnd } },
        }),
        db.cost.findMany({
          where: { tallerId, mes, anio },
        }),
      ]);

      const ingresos = movements.reduce((s, m) => s + m.monto, 0);
      const costosFijos = costs.filter((c) => c.tipo === "FIJO").reduce((s, c) => s + c.monto, 0);
      const costosVariables = costs
        .filter((c) => c.tipo === "VARIABLE")
        .reduce((s, c) => s + c.monto, 0);
      const costosTotal = costosFijos + costosVariables;

      monthlyData.push({
        mes,
        anio,
        ingresos,
        costos: costosTotal,
        costosFijos,
        costosVariables,
        margen: ingresos - costosTotal,
      });
    }

    // Costos por categoría del mes actual
    const currentMes = now.getUTCMonth() + 1;
    const currentAnio = now.getUTCFullYear();
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
      { error: "Error fetching P&L report" },
      { status: 500 }
    );
  }
}
