import { auth } from "@/lib/auth";
import { unauthorizedResponse, noTallerResponse, validationErrorResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { ScheduleUpdateSchema } from "@/lib/validations";
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

    const schedule = await db.schedule.findUnique({
      where: { id },
      include: { client: true, vehicle: true },
    });

    if (!schedule || schedule.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Turno no encontrado." }, { status: 404 });
    }

    return NextResponse.json(schedule, { status: 200 });
  } catch (error) {
    console.error("Schedule GET error:", error);
    return NextResponse.json(
      { error: "No se pudo cargar la información. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}

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

    const existing = await db.schedule.findUnique({ where: { id } });
    if (!existing || existing.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Turno no encontrado." }, { status: 404 });
    }

    const body = await request.json();
    const validation = ScheduleUpdateSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const { clientId, vehicleId, fecha, hora, motivo, status } = validation.data;

    if (existing.workOrderId && status && status !== "COMPLETADO") {
      return NextResponse.json(
        { error: "Este turno ya tiene una orden de trabajo asociada, por eso su estado debe seguir en Completado." },
        { status: 409 }
      );
    }

    const client = await db.client.findUnique({ where: { id: clientId } });
    if (!client || client.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
    }

    const vehicle = await db.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle || vehicle.clientId !== clientId) {
      return NextResponse.json(
        { error: "El vehículo no existe o no pertenece a ese cliente." },
        { status: 404 }
      );
    }

    const fechaDate = new Date(`${fecha}T00:00:00.000Z`);

    const conflict = await db.schedule.findFirst({
      where: {
        vehicleId,
        fecha: fechaDate,
        hora,
        NOT: { id },
      },
    });
    if (conflict) {
      return NextResponse.json(
        { error: "Ya existe un turno para este vehículo en ese horario" },
        { status: 409 }
      );
    }

    const schedule = await db.$transaction(async (tx) => {
      const updated = await tx.schedule.update({
        where: { id },
        data: {
          clientId,
          vehicleId,
          fecha: fechaDate,
          hora,
          motivo,
          ...(status ? { status } : {}),
        },
        include: { client: true, vehicle: true },
      });
      if (status && status !== existing.status) {
        await logAudit(tx, {
          tallerId: userTaller.tallerId,
          accion: "SCHEDULE_STATUS_CHANGED",
          entityType: "SCHEDULE",
          entityId: id,
          oldValue: { status: existing.status },
          newValue: { status },
        });
      }
      return updated;
    });

    return NextResponse.json(schedule, { status: 200 });
  } catch (error) {
    console.error("Schedule PUT error:", error);
    return NextResponse.json(
      { error: "No se pudieron guardar los cambios. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const existing = await db.schedule.findUnique({ where: { id } });
    if (!existing || existing.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Turno no encontrado." }, { status: 404 });
    }

    if (existing.workOrderId) {
      return NextResponse.json(
        { error: "No se puede eliminar un turno ya convertido en orden de trabajo" },
        { status: 400 }
      );
    }

    await db.schedule.delete({ where: { id } });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Schedule DELETE error:", error);
    return NextResponse.json(
      { error: "No se pudo eliminar el registro. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}
