import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    const vehicle = await db.vehicle.findUnique({
      where: { id },
      include: { client: true },
    });
    if (!vehicle || vehicle.client.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }

    const [workOrders, quotes, schedules] = await Promise.all([
      db.workOrder.findMany({
        where: { vehicleId: id },
        include: { items: true },
        orderBy: { fecha: "desc" },
      }),
      db.quote.findMany({
        where: { vehicleId: id },
        include: { items: true },
        orderBy: { fecha: "desc" },
      }),
      db.schedule.findMany({
        where: { vehicleId: id },
        orderBy: { fecha: "desc" },
      }),
    ]);

    return NextResponse.json(
      { vehicle, workOrders, quotes, schedules },
      { status: 200 }
    );
  } catch (error) {
    console.error("Vehicle history GET error:", error);
    return NextResponse.json(
      { error: "Error fetching vehicle history" },
      { status: 500 }
    );
  }
}
