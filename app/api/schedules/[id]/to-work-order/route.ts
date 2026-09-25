import { auth } from "@/lib/auth";
import { unauthorizedResponse, noTallerResponse, validationErrorResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { round2 } from "@/lib/money";
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
      return unauthorizedResponse();
    }

    const userTaller = await db.userTaller.findFirst({
      where: { userId: session.user.id },
    });
    if (!userTaller) {
      return noTallerResponse();
    }

    const schedule = await db.schedule.findUnique({ where: { id } });
    if (!schedule || schedule.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Turno no encontrado." }, { status: 404 });
    }

    if (schedule.workOrderId) {
      return NextResponse.json(
        { error: "Este turno ya fue convertido en orden de trabajo." },
        { status: 409 }
      );
    }

    if (schedule.status === "CANCELADO") {
      return NextResponse.json(
        { error: "No se puede convertir un turno cancelado en orden de trabajo." },
        { status: 409 }
      );
    }

    const body = await request.json();
    const validation = ScheduleToWorkOrderSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const { motivoIngreso, diagnostico, observaciones, kmIngreso, items } =
      validation.data;

    const itemsWithSubtotal = items.map((item) => ({
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
      subtotal: round2(item.cantidad * item.precioUnitario),
    }));
    const total = round2(itemsWithSubtotal.reduce((sum, item) => sum + item.subtotal, 0));

    const workOrder = await db.$transaction(async (tx) => {
      // Reserva atómica del turno: si otra solicitud ya lo convirtió, count = 0
      const claimed = await tx.schedule.updateMany({
        where: { id, workOrderId: null, status: { not: "CANCELADO" } },
        data: { status: "COMPLETADO" },
      });
      if (claimed.count === 0) return null;

      const created = await tx.workOrder.create({
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
      await tx.schedule.update({
        where: { id },
        data: { workOrderId: created.id },
      });
      await logAudit(tx, {
        tallerId: userTaller.tallerId,
        accion: "WORK_ORDER_CREATED",
        entityType: "WORK_ORDER",
        entityId: created.id,
        descripcion: "Orden creada desde turno",
        newValue: { total, scheduleId: id },
      });
      await logAudit(tx, {
        tallerId: userTaller.tallerId,
        accion: "SCHEDULE_STATUS_CHANGED",
        entityType: "SCHEDULE",
        entityId: id,
        oldValue: { status: schedule.status },
        newValue: { status: "COMPLETADO", workOrderId: created.id },
      });
      return created;
    });

    if (!workOrder) {
      return NextResponse.json(
        { error: "Este turno ya fue convertido en orden de trabajo." },
        { status: 409 }
      );
    }

    return NextResponse.json(workOrder, { status: 201 });
  } catch (error) {
    console.error("Schedule to-work-order error:", error);
    return NextResponse.json(
      { error: "No se pudo convertir el turno en orden de trabajo. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}
