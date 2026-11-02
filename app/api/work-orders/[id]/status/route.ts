import { auth } from "@/lib/auth";
import { unauthorizedResponse, noTallerResponse, validationErrorResponse, serviceErrorResponse } from "@/lib/api";
import { BusinessError, lockWorkOrder } from "@/lib/cash";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { consumesStock, reconcileOrderStock } from "@/lib/stock";
import { WorkOrderStatusSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

const STATUS_ORDER = [
  "PRESUPUESTA",
  "APROBADA",
  "EN_PROCESO",
  "TERMINADA",
  "ENTREGADA",
] as const;

const STATUS_LABEL = {
  PRESUPUESTA: "Presupuestada",
  APROBADA: "Aprobada",
  EN_PROCESO: "En proceso",
  TERMINADA: "Terminada",
  ENTREGADA: "Entregada",
} as const;

export async function PUT(
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
    const validation = WorkOrderStatusSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const newStatus = validation.data.status;
    const actor = { tallerId: userTaller.tallerId, userId: session.user.id };
    const workOrder = await db.$transaction(
      async (tx) => {
        // Se bloquea la orden y se relee su estado: dos pedidos simultáneos no pueden avanzar ni descontar stock dos veces
        await lockWorkOrder(tx, id);
        const current = await tx.workOrder.findFirst({ where: { id, tallerId: actor.tallerId } });
        if (!current) throw new BusinessError("Orden de trabajo no encontrada.", 404);

        const currentIndex = STATUS_ORDER.indexOf(current.status as (typeof STATUS_ORDER)[number]);
        const nextIndex = STATUS_ORDER.indexOf(newStatus);
        if (nextIndex <= currentIndex) {
          throw new BusinessError(
            `No se puede volver de "${STATUS_LABEL[current.status as keyof typeof STATUS_LABEL] ?? current.status}" a "${STATUS_LABEL[newStatus]}". El estado de una orden solo avanza: ${STATUS_ORDER.map((s) => STATUS_LABEL[s]).join(" → ")}.`,
            400
          );
        }

        const updated = await tx.workOrder.update({
          where: { id },
          data: { status: newStatus },
          include: { client: true, vehicle: true, items: true },
        });
        await logAudit(tx, {
          userId: actor.userId,
          tallerId: actor.tallerId,
          accion:
            newStatus === "ENTREGADA"
              ? "WORK_ORDER_DELIVERED"
              : newStatus === "TERMINADA"
                ? "WORK_ORDER_COMPLETED"
                : "WORK_ORDER_STATUS_CHANGED",
          entityType: "WORK_ORDER",
          entityId: id,
          oldValue: { status: current.status },
          newValue: { status: newStatus, total: updated.total },
        });
        // Al llegar a EN_PROCESO (o a un estado posterior) se descuenta el stock de los ítems con producto.
        // Es idempotente. Si falta stock, se revierte todo el cambio de estado (409).
        if (consumesStock(newStatus)) await reconcileOrderStock(tx, actor, id);
        return updated;
      },
      { timeout: 30000, maxWait: 20000 }
    );

    return NextResponse.json(workOrder, { status: 200 });
  } catch (error) {
    const handled = serviceErrorResponse(error);
    if (handled) return handled;
    console.error("WorkOrder status PUT error:", error);
    return NextResponse.json(
      { error: "No se pudieron guardar los cambios. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}
