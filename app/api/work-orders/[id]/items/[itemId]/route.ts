import { auth } from "@/lib/auth";
import { unauthorizedResponse, noTallerResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { round2 } from "@/lib/money";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await params;
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

    const workOrder = await db.workOrder.findUnique({ where: { id } });
    if (!workOrder || workOrder.tallerId !== userTaller.tallerId) {
      return NextResponse.json(
        { error: "Orden de trabajo no encontrada." },
        { status: 404 }
      );
    }
    if (workOrder.status === "ENTREGADA") {
      return NextResponse.json(
        { error: "La orden ya fue entregada y no se puede modificar." },
        { status: 409 }
      );
    }

    const item = await db.workOrderItem.findUnique({ where: { id: itemId } });
    if (!item || item.workOrderId !== id) {
      return NextResponse.json({ error: "Trabajo no encontrado." }, { status: 404 });
    }

    const itemCount = await db.workOrderItem.count({ where: { workOrderId: id } });
    if (itemCount <= 1) {
      return NextResponse.json(
        { error: "La orden debe tener al menos un trabajo." },
        { status: 409 }
      );
    }

    await db.workOrderItem.delete({ where: { id: itemId } });

    const remainingItems = await db.workOrderItem.findMany({
      where: { workOrderId: id },
    });
    const total = round2(remainingItems.reduce((sum, i) => sum + i.subtotal, 0));

    const updated = await db.workOrder.update({
      where: { id },
      data: { total },
      include: { client: true, vehicle: true, items: true },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("WorkOrder item DELETE error:", error);
    return NextResponse.json(
      { error: "No se pudo quitar el trabajo de la orden. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}
