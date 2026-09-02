import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await params;
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

    const workOrder = await db.workOrder.findUnique({ where: { id } });
    if (!workOrder || workOrder.tallerId !== userTaller.tallerId) {
      return NextResponse.json(
        { error: "Work order not found" },
        { status: 404 }
      );
    }

    const item = await db.workOrderItem.findUnique({ where: { id: itemId } });
    if (!item || item.workOrderId !== id) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    await db.workOrderItem.delete({ where: { id: itemId } });

    const remainingItems = await db.workOrderItem.findMany({
      where: { workOrderId: id },
    });
    const total = remainingItems.reduce((sum, i) => sum + i.subtotal, 0);

    const updated = await db.workOrder.update({
      where: { id },
      data: { total },
      include: { client: true, vehicle: true, items: true },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("WorkOrder item DELETE error:", error);
    return NextResponse.json(
      { error: "Error removing item from work order" },
      { status: 500 }
    );
  }
}
