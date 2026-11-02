import { auth } from "@/lib/auth";
import { unauthorizedResponse, noTallerResponse, validationErrorResponse, serviceErrorResponse } from "@/lib/api";
import { BusinessError, lockWorkOrder } from "@/lib/cash";
import { db } from "@/lib/db";
import { round2 } from "@/lib/money";
import { assertProductsUsable, consumesStock, reconcileOrderStock } from "@/lib/stock";
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
      return unauthorizedResponse();
    }

    const userTaller = await db.userTaller.findFirst({
      where: { userId: session.user.id },
    });
    if (!userTaller) {
      return noTallerResponse();
    }

    const existing = await db.workOrder.findUnique({ where: { id } });
    if (!existing || existing.tallerId !== userTaller.tallerId) {
      return NextResponse.json(
        { error: "Orden de trabajo no encontrada." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = WorkOrderItemSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const subtotal = round2(validation.data.cantidad * validation.data.precioUnitario);
    const actor = { tallerId: userTaller.tallerId, userId: session.user.id };

    const workOrder = await db.$transaction(
      async (tx) => {
        await lockWorkOrder(tx, id);
        const current = await tx.workOrder.findFirst({ where: { id, tallerId: actor.tallerId } });
        if (!current) throw new BusinessError("Orden de trabajo no encontrada.", 404);
        if (current.status === "ENTREGADA") {
          throw new BusinessError("La orden ya fue entregada y no se puede modificar.", 409);
        }
        await assertProductsUsable(tx, actor.tallerId, [validation.data.productId]);

        await tx.workOrderItem.create({
          data: {
            workOrderId: id,
            productId: validation.data.productId,
            descripcion: validation.data.descripcion,
            cantidad: validation.data.cantidad,
            precioUnitario: validation.data.precioUnitario,
            subtotal,
          },
        });

        const remainingItems = await tx.workOrderItem.findMany({
          where: { workOrderId: id },
        });
        const total = round2(remainingItems.reduce((sum, item) => sum + item.subtotal, 0));

        const updated = await tx.workOrder.update({
          where: { id },
          data: { total },
          include: { client: true, vehicle: true, items: true },
        });
        // Si la orden ya está en proceso, el ítem nuevo descuenta stock en esta misma transacción
        if (consumesStock(current.status)) await reconcileOrderStock(tx, actor, id);
        return updated;
      },
      { timeout: 30000, maxWait: 20000 }
    );

    return NextResponse.json(workOrder, { status: 201 });
  } catch (error) {
    const handled = serviceErrorResponse(error);
    if (handled) return handled;
    console.error("WorkOrder add-item error:", error);
    return NextResponse.json(
      { error: "No se pudo agregar el trabajo a la orden. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}
