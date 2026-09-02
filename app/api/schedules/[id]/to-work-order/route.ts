import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ScheduleToWorkOrderSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
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

    const schedule = await db.schedule.findUnique({ where: { id } });
    if (!schedule || schedule.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    if (schedule.workOrderId) {
      return NextResponse.json(
        { error: "Schedule already converted to a work order" },
        { status: 409 }
      );
    }

    const body = await request.json();
    const validation = ScheduleToWorkOrderSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { motivoIngreso, diagnostico, observaciones, kmIngreso, items } =
      validation.data;

    const itemsWithSubtotal = items.map((item) => ({
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
      subtotal: item.cantidad * item.precioUnitario,
    }));
    const total = itemsWithSubtotal.reduce((sum, item) => sum + item.subtotal, 0);

    const workOrder = await db.workOrder.create({
      data: {
        tallerId: userTaller.tallerId,
        clientId: schedule.clientId,
        vehicleId: schedule.vehicleId,
        motivoIngreso,
        diagnostico,
        observaciones,
        kmIngreso,
        total,
        items: { create: itemsWithSubtotal },
      },
      include: { client: true, vehicle: true, items: true },
    });

    await db.schedule.update({
      where: { id },
      data: { workOrderId: workOrder.id, status: "COMPLETADO" },
    });

    return NextResponse.json(workOrder, { status: 201 });
  } catch (error) {
    console.error("Schedule to-work-order error:", error);
    return NextResponse.json(
      { error: "Error converting schedule to work order" },
      { status: 500 }
    );
  }
}
