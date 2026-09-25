import { auth } from "@/lib/auth";
import { unauthorizedResponse, noTallerResponse, validationErrorResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { round2 } from "@/lib/money";
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
      return unauthorizedResponse();
    }

    const userTaller = await db.userTaller.findFirst({
      where: { userId: session.user.id },
    });
    if (!userTaller) {
      return noTallerResponse();
    }

    const workOrder = await db.workOrder.findUnique({
      where: { id },
      include: { client: true, vehicle: true, items: true, payments: { include: { method: true }, orderBy: { fecha: "asc" } } },
    });

    if (!workOrder || workOrder.tallerId !== userTaller.tallerId) {
      return NextResponse.json(
        { error: "Orden de trabajo no encontrada." },
        { status: 404 }
      );
    }

    // Costs no tiene relación Prisma formal con WorkOrder (campo plano), se consulta aparte
    const costs = await db.cost.findMany({ where: { workOrderId: id } });
    const totalCosts = costs.reduce((sum, c) => sum + c.monto, 0);
    const margen = round2(workOrder.total - totalCosts);

    return NextResponse.json({ ...workOrder, costs, margen }, { status: 200 });
  } catch (error) {
    console.error("WorkOrder GET error:", error);
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

    const existing = await db.workOrder.findUnique({ where: { id } });
    if (!existing || existing.tallerId !== userTaller.tallerId) {
      return NextResponse.json(
        { error: "Orden de trabajo no encontrada." },
        { status: 404 }
      );
    }
    if (existing.status === "ENTREGADA") {
      return NextResponse.json(
        { error: "La orden ya fue entregada y no se puede modificar." },
        { status: 409 }
      );
    }

    const body = await request.json();
    const validation = WorkOrderSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
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
      return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
    }

    const vehicle = await db.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle || vehicle.clientId !== clientId) {
      return NextResponse.json(
        { error: "El vehículo no existe o no pertenece a ese cliente." },
        { status: 404 }
      );
    }

    const itemsWithSubtotal = items.map((item) => ({
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
      subtotal: round2(item.cantidad * item.precioUnitario),
    }));
    const total = round2(itemsWithSubtotal.reduce((sum, item) => sum + item.subtotal, 0));

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
      { error: "No se pudieron guardar los cambios. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}
