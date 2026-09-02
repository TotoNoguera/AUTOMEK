import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ScheduleSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const status = searchParams.get("status");

    let fechaFilter: { gte?: Date; lte?: Date } | undefined;
    if (date) {
      const start = new Date(`${date}T00:00:00.000Z`);
      const end = new Date(`${date}T23:59:59.999Z`);
      fechaFilter = { gte: start, lte: end };
    } else if (from && to) {
      fechaFilter = {
        gte: new Date(`${from}T00:00:00.000Z`),
        lte: new Date(`${to}T23:59:59.999Z`),
      };
    }

    const schedules = await db.schedule.findMany({
      where: {
        tallerId: userTaller.tallerId,
        ...(fechaFilter ? { fecha: fechaFilter } : {}),
        ...(status
          ? {
              status: status as
                | "PENDIENTE"
                | "CONFIRMADO"
                | "EN_ESPERA"
                | "CANCELADO"
                | "COMPLETADO",
            }
          : {}),
      },
      include: { client: true, vehicle: true },
      orderBy: [{ fecha: "asc" }, { hora: "asc" }],
    });

    return NextResponse.json(schedules, { status: 200 });
  } catch (error) {
    console.error("Schedules GET error:", error);
    return NextResponse.json(
      { error: "Error fetching schedules" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const validation = ScheduleSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { clientId, vehicleId, fecha, hora, motivo } = validation.data;

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
      where: { vehicleId, fecha: fechaDate, hora },
    });
    if (conflict) {
      return NextResponse.json(
        { error: "Ya existe un turno para este vehículo en ese horario" },
        { status: 409 }
      );
    }

    const schedule = await db.schedule.create({
      data: {
        tallerId: userTaller.tallerId,
        clientId,
        vehicleId,
        fecha: fechaDate,
        hora,
        motivo,
      },
      include: { client: true, vehicle: true },
    });

    return NextResponse.json(schedule, { status: 201 });
  } catch (error) {
    console.error("Schedules POST error:", error);
    return NextResponse.json(
      { error: "Error creating schedule" },
      { status: 500 }
    );
  }
}
