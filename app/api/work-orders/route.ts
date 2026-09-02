import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { WorkOrderSchema } from "@/lib/validations";
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
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status");

    const workOrders = await db.workOrder.findMany({
      where: {
        tallerId: userTaller.tallerId,
        ...(status
          ? {
              status: status as
                | "PRESUPUESTA"
                | "APROBADA"
                | "EN_PROCESO"
                | "TERMINADA"
                | "ENTREGADA",
            }
          : {}),
        OR: search
          ? [
              { client: { nombre: { contains: search, mode: "insensitive" } } },
              { vehicle: { patente: { contains: search, mode: "insensitive" } } },
            ]
          : undefined,
      },
      include: {
        client: true,
        vehicle: true,
        items: true,
        payments: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(workOrders, { status: 200 });
  } catch (error) {
    console.error("WorkOrders GET error:", error);
    return NextResponse.json(
      { error: "Error fetching work orders" },
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
    const validation = WorkOrderSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 }
      );
    }

    const {
      clientId,
      vehicleId,
      quoteId,
      motivoIngreso,
      diagnostico,
      observaciones,
      kmIngreso,
      kmEgreso,
      items,
    } = validation.data;

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

    if (quoteId) {
      const quote = await db.quote.findUnique({
        where: { id: quoteId },
        include: { workOrder: true },
      });
      if (!quote || quote.tallerId !== userTaller.tallerId) {
        return NextResponse.json({ error: "Quote not found" }, { status: 404 });
      }
      if (quote.status !== "APROBADO") {
        return NextResponse.json(
          { error: "Quote must be approved to convert to a work order" },
          { status: 400 }
        );
      }
      if (quote.workOrder) {
        return NextResponse.json(
          { error: "Quote already converted to a work order" },
          { status: 409 }
        );
      }
    }

    const itemsWithSubtotal = items.map((item) => ({
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
      subtotal: item.cantidad * item.precioUnitario,
    }));
    const total = itemsWithSubtotal.reduce((sum, item) => sum + item.subtotal, 0);

    const workOrder = await db.workOrder.create({
      data: {
        tallerId: userTaller.tallerId,
        clientId,
        vehicleId,
        quoteId,
        motivoIngreso,
        diagnostico,
        observaciones,
        kmIngreso,
        kmEgreso,
        total,
        items: { create: itemsWithSubtotal },
      },
      include: { client: true, vehicle: true, items: true },
    });

    return NextResponse.json(workOrder, { status: 201 });
  } catch (error) {
    console.error("WorkOrders POST error:", error);
    return NextResponse.json(
      { error: "Error creating work order" },
      { status: 500 }
    );
  }
}
