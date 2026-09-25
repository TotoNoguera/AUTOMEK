import { auth } from "@/lib/auth";
import { unauthorizedResponse, noTallerResponse, validationErrorResponse, prismaCode } from "@/lib/api";
import { db } from "@/lib/db";
import { VehicleSchema } from "@/lib/validations";
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

    const vehicle = await db.vehicle.findUnique({
      where: { id: id },
      include: { client: true },
    });

    if (!vehicle || vehicle.client.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Vehículo no encontrado." }, { status: 404 });
    }

    return NextResponse.json(vehicle, { status: 200 });
  } catch (error) {
    console.error("Vehicle GET error:", error);
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

    const existing = await db.vehicle.findUnique({
      where: { id: id },
      include: { client: true },
    });
    if (!existing || existing.client.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Vehículo no encontrado." }, { status: 404 });
    }

    const body = await request.json();
    const validation = VehicleSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    // Verify client ownership (in case clientId changed)
    const client = await db.client.findUnique({
      where: { id: validation.data.clientId },
    });
    if (!client || client.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
    }

    // Check patente uniqueness (excluding self)
    if (validation.data.patente !== existing.patente) {
      const duplicate = await db.vehicle.findUnique({
        where: {
          tallerId_patente: { tallerId: userTaller.tallerId, patente: validation.data.patente },
        },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "Ya existe un vehículo con esa patente en tu taller." },
          { status: 409 }
        );
      }
    }

    try {
      const vehicle = await db.vehicle.update({
        where: { id: id },
        data: validation.data,
        include: { client: true },
      });
      return NextResponse.json(vehicle, { status: 200 });
    } catch (err) {
      if (prismaCode(err) === "P2002") {
        return NextResponse.json(
          { error: "Ya existe un vehículo con esa patente en tu taller." },
          { status: 409 }
        );
      }
      throw err;
    }
  } catch (error) {
    console.error("Vehicle PUT error:", error);
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

    const existing = await db.vehicle.findUnique({
      where: { id: id },
      include: { client: true },
    });
    if (!existing || existing.client.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Vehículo no encontrado." }, { status: 404 });
    }

    const [quotes, workOrders, schedules] = await Promise.all([
      db.quote.count({ where: { vehicleId: id } }),
      db.workOrder.count({ where: { vehicleId: id } }),
      db.schedule.count({ where: { vehicleId: id } }),
    ]);
    if (quotes + workOrders + schedules > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar el vehículo porque tiene historial (${quotes} presupuesto(s), ${workOrders} orden(es), ${schedules} turno(s)). Se conserva para no perder el registro de trabajos.`,
        },
        { status: 409 }
      );
    }

    try {
      await db.vehicle.delete({
        where: { id: id },
      });
    } catch (err) {
      if (prismaCode(err) === "P2003" || prismaCode(err) === "P2014") {
        return NextResponse.json(
          { error: "No se puede eliminar el vehículo porque tiene historial asociado." },
          { status: 409 }
        );
      }
      throw err;
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Vehicle DELETE error:", error);
    return NextResponse.json(
      { error: "No se pudo eliminar el registro. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}
