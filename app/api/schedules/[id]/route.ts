import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
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

    const schedule = await db.schedule.findUnique({
      where: { id },
      include: { client: true, vehicle: true },
    });

    if (!schedule || schedule.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    return NextResponse.json(schedule, { status: 200 });
  } catch (error) {
    console.error("Schedule GET error:", error);
    return NextResponse.json(
      { error: "Error fetching schedule" },
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

    const existing = await db.schedule.findUnique({ where: { id } });
    if (!existing || existing.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    const body = await request.json();
    const validation = ScheduleUpdateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { clientId, vehicleId, fecha, hora, motivo, status } = validation.data;

    const client = await db.client.findUnique({ where: { id: clientId } });
    if (!client || client.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const vehicle = await db.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle || vehicle.clientId !== clientId) {
      return NextResponse.json(
        { error: "Vehicle not found or does not belong to client" },
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

    const schedule = await db.schedule.update({
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

    return NextResponse.json(schedule, { status: 200 });
  } catch (error) {
    console.error("Schedule PUT error:", error);
    return NextResponse.json(
      { error: "Error updating schedule" },
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

    const existing = await db.schedule.findUnique({ where: { id } });
    if (!existing || existing.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
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
      { error: "Error deleting schedule" },
      { status: 500 }
    );
  }
}
