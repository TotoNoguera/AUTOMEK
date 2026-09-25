import { auth } from "@/lib/auth";
import { unauthorizedResponse, noTallerResponse } from "@/lib/api";
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
      return unauthorizedResponse();
    }

    const userTaller = await db.userTaller.findFirst({
      where: { userId: session.user.id },
    });
    if (!userTaller) {
      return noTallerResponse();
    }

    const vehicle = await db.vehicle.findUnique({
      where: { id },
      include: { client: true },
    });
    if (!vehicle || vehicle.client.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Vehículo no encontrado." }, { status: 404 });
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
      { error: "No se pudo cargar la información. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}
