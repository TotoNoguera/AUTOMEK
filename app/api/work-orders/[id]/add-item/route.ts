import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { WorkOrderItemSchema } from "@/lib/validations";
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

    const existing = await db.workOrder.findUnique({ where: { id } });
    if (!existing || existing.tallerId !== userTaller.tallerId) {
      return NextResponse.json(
        { error: "Work order not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = WorkOrderItemSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 }
      );
    }

    const subtotal = validation.data.cantidad * validation.data.precioUnitario;

    await db.workOrderItem.create({
      data: {
        workOrderId: id,
        descripcion: validation.data.descripcion,
        cantidad: validation.data.cantidad,
        precioUnitario: validation.data.precioUnitario,
        subtotal,
      },
    });

    const remainingItems = await db.workOrderItem.findMany({
      where: { workOrderId: id },
    });
    const total = remainingItems.reduce((sum, item) => sum + item.subtotal, 0);

    const workOrder = await db.workOrder.update({
      where: { id },
      data: { total },
      include: { client: true, vehicle: true, items: true },
    });

    return NextResponse.json(workOrder, { status: 201 });
  } catch (error) {
    console.error("WorkOrder add-item error:", error);
    return NextResponse.json(
      { error: "Error adding item to work order" },
      { status: 500 }
    );
  }
}
