import { auth } from "@/lib/auth";
import { unauthorizedResponse, noTallerResponse, serviceErrorResponse } from "@/lib/api";
import { BusinessError, lockWorkOrder } from "@/lib/cash";
import { db } from "@/lib/db";
import { round2 } from "@/lib/money";
import { consumesStock, reconcileOrderStock } from "@/lib/stock";
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

    const actor = { tallerId: userTaller.tallerId, userId: session.user.id };
    const updated = await db.$transaction(
      async (tx) => {
        await lockWorkOrder(tx, id);
        const current = await tx.workOrder.findFirst({ where: { id, tallerId: actor.tallerId } });
        if (!current) throw new BusinessError("Orden de trabajo no encontrada.", 404);
        if (current.status === "ENTREGADA") {
          throw new BusinessError("La orden ya fue entregada y no se puede modificar.", 409);
        }

        const item = await tx.workOrderItem.findUnique({ where: { id: itemId } });
        if (!item || item.workOrderId !== id) {
          throw new BusinessError("Trabajo no encontrado.", 404);
        }

        const itemCount = await tx.workOrderItem.count({ where: { workOrderId: id } });
        if (itemCount <= 1) {
          throw new BusinessError("La orden debe tener al menos un trabajo.", 409);
        }

        await tx.workOrderItem.delete({ where: { id: itemId } });

        const remainingItems = await tx.workOrderItem.findMany({
          where: { workOrderId: id },
        });
        const total = round2(remainingItems.reduce((sum, i) => sum + i.subtotal, 0));

        const result = await tx.workOrder.update({
          where: { id },
          data: { total },
          include: { client: true, vehicle: true, items: true },
        });
        // El stock ya descontado NO se repone solo (el repuesto pudo usarse): queda como excedente devolvible y
        // se repone con una devolución explícita (POST /api/stock/returns). Si la orden ya está en proceso solo se descuenta lo que falte.
        if (consumesStock(current.status)) await reconcileOrderStock(tx, actor, id);
        return result;
      },
      { timeout: 30000, maxWait: 20000 }
    );

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    const handled = serviceErrorResponse(error);
    if (handled) return handled;
    console.error("WorkOrder item DELETE error:", error);
    return NextResponse.json(
      { error: "No se pudo quitar el trabajo de la orden. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}
