import { auth } from "@/lib/auth";
import { unauthorizedResponse, noTallerResponse } from "@/lib/api";
import { db } from "@/lib/db";
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

    const workOrders = await db.workOrder.findMany({
      where: { tallerId: userTaller.tallerId },
      include: { client: true, vehicle: true, payments: true },
      orderBy: { fecha: "desc" },
    });

    const unpaidWorkOrders = workOrders
      .map((wo) => {
        const pagado = wo.payments
          .filter((p) => p.status === "PAGADO")
          .reduce((sum, p) => sum + p.monto, 0);
        return {
          id: wo.id,
          fecha: wo.fecha,
          status: wo.status,
          total: wo.total,
          pagado,
          pendiente: round2(wo.total - pagado),
          client: wo.client,
          vehicle: wo.vehicle,
        };
      })
      .filter((wo) => wo.pendiente > 0.004);

    const negativeCredits = await db.clientCredit.findMany({
      where: { tallerId: userTaller.tallerId, saldo: { lt: 0 } },
      include: { client: true },
      orderBy: { saldo: "asc" },
    });

    return NextResponse.json(
      { unpaidWorkOrders, negativeCredits },
      { status: 200 }
    );
  } catch (error) {
    console.error("Debts GET error:", error);
    return NextResponse.json(
      { error: "No se pudo cargar la información. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}
