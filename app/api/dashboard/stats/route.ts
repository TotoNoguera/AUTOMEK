import { auth } from "@/lib/auth";
import { unauthorizedResponse, noTallerResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { dayRangeAR, monthRangeAR, shiftMonth, todayAR, yearMonthAR } from "@/lib/dates";
import { pendingAmount, round2 } from "@/lib/money";
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

    // Todo el dashboard usa el calendario argentino (hoy y mes), no el del servidor (UTC)
    const now = yearMonthAR();
    const { start: todayStart, end: todayEnd } = dayRangeAR(todayAR());
    const { start: monthStart, end: monthEnd } = monthRangeAR(now.year, now.month);

    const [ordenesActivas, movimientosHoy, movimientosMes, workOrders, goalsMes, negativeCredits] =
      await Promise.all([
        db.workOrder.count({
          where: { tallerId, status: { not: "ENTREGADA" } },
        }),
        db.cashMovement.findMany({
          where: { tallerId, fecha: { gte: todayStart, lt: todayEnd } },
        }),
        db.cashMovement.findMany({
          where: { tallerId, fecha: { gte: monthStart, lt: monthEnd } },
        }),
        db.workOrder.findMany({
          where: { tallerId },
          include: { payments: true, vehicle: true },
        }),
        db.goal.findMany({
          where: { tallerId, mes: now.month, anio: now.year },
        }),
        db.clientCredit.findMany({
          where: { tallerId, saldo: { lt: 0 } },
          select: { saldo: true },
        }),
      ]);

    const sumBy = (movs: typeof movimientosHoy, tipo: "INGRESO" | "EGRESO") =>
      round2(movs.filter((m) => m.tipo === tipo).reduce((s, m) => s + m.monto, 0));
    const cobrosHoy = sumBy(movimientosHoy, "INGRESO");
    const egresosHoy = sumBy(movimientosHoy, "EGRESO");
    const cobrosMes = sumBy(movimientosMes, "INGRESO");
    const egresosMes = sumBy(movimientosMes, "EGRESO");

    // Deuda total = saldo pendiente de órdenes + cuentas corrientes en rojo (igual que la pantalla Deudas)
    const deudaOrdenes = workOrders.reduce((sum, wo) => {
      const pendiente = pendingAmount(wo.total, wo.payments);
      return sum + (pendiente > 0.004 ? pendiente : 0);
    }, 0);
    const deudaCuentaCorriente = negativeCredits.reduce((sum, c) => sum + -c.saldo, 0);
    const deudasPendientes = round2(deudaOrdenes + deudaCuentaCorriente);

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
      const d = shiftMonth(now.year, now.month, -i);
      const { start: mStart, end: mEnd } = monthRangeAR(d.year, d.month);

      const [movs, ordenesCount] = await Promise.all([
        db.cashMovement.findMany({
          where: { tallerId, fecha: { gte: mStart, lt: mEnd } },
        }),
        db.workOrder.count({
          where: { tallerId, fecha: { gte: mStart, lt: mEnd } },
        }),
      ]);

      monthlyData.push({
        mes: d.month,
        anio: d.year,
        ingresos: sumBy(movs, "INGRESO"),
        egresos: sumBy(movs, "EGRESO"),
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
      { error: "No se pudo cargar la información. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}
