import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { WorkOrderSchema } from "@/lib/validations";
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

    const workOrder = await db.workOrder.findUnique({
      where: { id },
      include: { client: true, vehicle: true, items: true, payments: true },
    });

    if (!workOrder || workOrder.tallerId !== userTaller.tallerId) {
      return NextResponse.json(
        { error: "Work order not found" },
        { status: 404 }
      );
    }

    // Costs no tiene relación Prisma formal con WorkOrder (campo plano), se consulta aparte
    const costs = await db.cost.findMany({ where: { workOrderId: id } });
    const totalCosts = costs.reduce((sum, c) => sum + c.monto, 0);
    const margen = workOrder.total - totalCosts;

    return NextResponse.json({ ...workOrder, costs, margen }, { status: 200 });
  } catch (error) {
    console.error("WorkOrder GET error:", error);
    return NextResponse.json(
      { error: "Error fetching work order" },
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

    const existing = await db.workOrder.findUnique({ where: { id } });
    if (!existing || existing.tallerId !== userTaller.tallerId) {
      return NextResponse.json(
        { error: "Work order not found" },
        { status: 404 }
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

    const itemsWithSubtotal = items.map((item) => ({
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
      subtotal: item.cantidad * item.precioUnitario,
    }));
    const total = itemsWithSubtotal.reduce((sum, item) => sum + item.subtotal, 0);

    const workOrder = await db.workOrder.update({
      where: { id },
      data: {
        clientId,
        vehicleId,
        motivoIngreso,
        diagnostico,
        observaciones,
        kmIngreso,
        kmEgreso,
        total,
        items: {
          deleteMany: {},
          create: itemsWithSubtotal,
        },
      },
      include: { client: true, vehicle: true, items: true },
    });

    return NextResponse.json(workOrder, { status: 200 });
  } catch (error) {
    console.error("WorkOrder PUT error:", error);
    return NextResponse.json(
      { error: "Error updating work order" },
      { status: 500 }
    );
  }
}
