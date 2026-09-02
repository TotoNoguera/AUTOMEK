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
          pendiente: wo.total - pagado,
          client: wo.client,
          vehicle: wo.vehicle,
        };
      })
      .filter((wo) => wo.pendiente > 0.01);

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
      { error: "Error fetching debts" },
      { status: 500 }
    );
  }
}
