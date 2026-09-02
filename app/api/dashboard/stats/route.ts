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
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    const [ordenesActivas, movimientosHoy, movimientosMes, workOrders, goalsMes] =
      await Promise.all([
        db.workOrder.count({
          where: { tallerId, status: { not: "ENTREGADA" } },
        }),
        db.cashMovement.findMany({
          where: { tallerId, fecha: { gte: todayStart, lte: todayEnd } },
        }),
        db.cashMovement.findMany({
          where: { tallerId, fecha: { gte: monthStart, lt: monthEnd } },
        }),
        db.workOrder.findMany({
          where: { tallerId },
          include: { payments: true, vehicle: true },
        }),
        db.goal.findMany({
          where: { tallerId, mes: now.getUTCMonth() + 1, anio: now.getUTCFullYear() },
        }),
      ]);

    const cobrosHoy = movimientosHoy
      .filter((m) => m.tipo === "INGRESO")
      .reduce((s, m) => s + m.monto, 0);
    const egresosHoy = movimientosHoy
      .filter((m) => m.tipo === "EGRESO")
      .reduce((s, m) => s + m.monto, 0);
    const cobrosMes = movimientosMes
      .filter((m) => m.tipo === "INGRESO")
      .reduce((s, m) => s + m.monto, 0);
    const egresosMes = movimientosMes
      .filter((m) => m.tipo === "EGRESO")
      .reduce((s, m) => s + m.monto, 0);

    const deudasPendientes = workOrders.reduce((sum, wo) => {
      const pagado = wo.payments
        .filter((p) => p.status === "PAGADO")
        .reduce((s, p) => s + p.monto, 0);
      const pendiente = wo.total - pagado;
      return sum + (pendiente > 0.01 ? pendiente : 0);
    }, 0);

    const vehicleCounts = new Map<
      string,
      { patente: string; marca: string; modelo: string; count: number }
    >();
    for (const wo of workOrders) {
      const key = wo.vehicleId;
      const existing = vehicleCounts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        vehicleCounts.set(key, {
          patente: wo.vehicle.patente,
          marca: wo.vehicle.marca,
          modelo: wo.vehicle.modelo,
          count: 1,
        });
      }
    }
    const vehiculosFrecuentes = Array.from(vehicleCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Últimos 6 meses de ingresos/egresos y órdenes
    const monthlyData: Array<{
      mes: number;
      anio: number;
      ingresos: number;
      egresos: number;
      ordenes: number;
    }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const mStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
      const mEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));

      const [movs, ordenesCount] = await Promise.all([
        db.cashMovement.findMany({
          where: { tallerId, fecha: { gte: mStart, lt: mEnd } },
        }),
        db.workOrder.count({
          where: { tallerId, fecha: { gte: mStart, lt: mEnd } },
        }),
      ]);

      monthlyData.push({
        mes: d.getUTCMonth() + 1,
        anio: d.getUTCFullYear(),
        ingresos: movs.filter((m) => m.tipo === "INGRESO").reduce((s, m) => s + m.monto, 0),
        egresos: movs.filter((m) => m.tipo === "EGRESO").reduce((s, m) => s + m.monto, 0),
        ordenes: ordenesCount,
      });
    }

    return NextResponse.json(
      {
        ordenesActivas,
        cobrosHoy,
        cobrosMes,
        egresosHoy,
        egresosMes,
        deudasPendientes,
        vehiculosFrecuentes,
        objetivosMes: goalsMes,
        monthlyData,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Dashboard stats GET error:", error);
    return NextResponse.json(
      { error: "Error fetching dashboard stats" },
      { status: 500 }
    );
  }
}
