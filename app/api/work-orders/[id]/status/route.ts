import { auth } from "@/lib/auth";
import { unauthorizedResponse, noTallerResponse, validationErrorResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
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

    const currentIndex = STATUS_ORDER.indexOf(
      existing.status as (typeof STATUS_ORDER)[number]
    );
    const nextIndex = STATUS_ORDER.indexOf(validation.data.status);

    if (nextIndex <= currentIndex) {
      return NextResponse.json(
        {
          error: `No se puede volver de "${STATUS_LABEL[existing.status as keyof typeof STATUS_LABEL] ?? existing.status}" a "${STATUS_LABEL[validation.data.status]}". El estado de una orden solo avanza: ${STATUS_ORDER.map((s) => STATUS_LABEL[s]).join(" → ")}.`,
        },
        { status: 400 }
      );
    }

    const newStatus = validation.data.status;
    const workOrder = await db.$transaction(async (tx) => {
      const updated = await tx.workOrder.update({
        where: { id },
        data: { status: newStatus },
        include: { client: true, vehicle: true, items: true },
      });
      await logAudit(tx, {
        tallerId: userTaller.tallerId,
        accion:
          newStatus === "ENTREGADA"
            ? "WORK_ORDER_DELIVERED"
            : newStatus === "TERMINADA"
              ? "WORK_ORDER_COMPLETED"
              : "WORK_ORDER_STATUS_CHANGED",
        entityType: "WORK_ORDER",
        entityId: id,
        oldValue: { status: existing.status },
        newValue: { status: newStatus, total: updated.total },
      });
      return updated;
    });

    return NextResponse.json(workOrder, { status: 200 });
  } catch (error) {
    console.error("WorkOrder status PUT error:", error);
    return NextResponse.json(
      { error: "No se pudieron guardar los cambios. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}
