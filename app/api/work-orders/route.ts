import { auth } from "@/lib/auth";
import { unauthorizedResponse, noTallerResponse, validationErrorResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { normalizeText } from "@/lib/text";
import { logAudit } from "@/lib/audit";
import { prismaCode } from "@/lib/api";
import { round2 } from "@/lib/money";
import { WorkOrderSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const search = normalizeText(searchParams.get("search"));
    const status = searchParams.get("status");
    if (status && !["PRESUPUESTA", "APROBADA", "EN_PROCESO", "TERMINADA", "ENTREGADA"].includes(status)) {
      return NextResponse.json({ error: "Los filtros indicados no son válidos." }, { status: 400 });
    }

    const allWorkOrders = await db.workOrder.findMany({
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
      },
      include: {
        client: true,
        vehicle: true,
        items: true,
        payments: true,
      },
      orderBy: { createdAt: "desc" },
    });
    const workOrders = search
      ? allWorkOrders.filter(
          (w) =>
            normalizeText(w.client.nombre).includes(search) ||
            normalizeText(w.vehicle.patente).includes(search.replace(/[s-]+/g, ""))
        )
      : allWorkOrders;

    return NextResponse.json(workOrders, { status: 200 });
  } catch (error) {
    console.error("WorkOrders GET error:", error);
    return NextResponse.json(
      { error: "No se pudo cargar la información. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const validation = WorkOrderSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
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
      items: requestedItems,
    } = validation.data;
    let items = requestedItems;

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

    if (quoteId) {
      const quote = await db.quote.findUnique({
        where: { id: quoteId },
        include: { workOrder: true, items: true },
      });
      if (!quote || quote.tallerId !== userTaller.tallerId) {
        return NextResponse.json({ error: "Presupuesto no encontrado." }, { status: 404 });
      }
      if (quote.status !== "APROBADO") {
        return NextResponse.json(
          { error: "El presupuesto debe estar aprobado para convertirlo en orden de trabajo." },
          { status: 400 }
        );
      }
      if (quote.workOrder) {
        return NextResponse.json(
          { error: "Este presupuesto ya fue convertido en orden de trabajo." },
          { status: 409 }
        );
      }
      if (quote.clientId !== clientId || quote.vehicleId !== vehicleId) {
        return NextResponse.json(
          { error: "El cliente o el vehículo no coinciden con los del presupuesto." },
          { status: 400 }
        );
      }
      // La orden hereda exactamente los ítems y el total del presupuesto aprobado
      items = quote.items.map((i) => ({
        descripcion: i.descripcion,
        cantidad: i.cantidad,
        precioUnitario: i.precioUnitario,
      }));
    }

    const itemsWithSubtotal = items.map((item) => ({
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
      subtotal: round2(item.cantidad * item.precioUnitario),
    }));
    const total = round2(itemsWithSubtotal.reduce((sum, item) => sum + item.subtotal, 0));

    let workOrder;
    try {
      workOrder = await db.$transaction(async (tx) => {
      const created = await tx.workOrder.create({
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
      await logAudit(tx, {
        tallerId: userTaller.tallerId,
        accion: "WORK_ORDER_CREATED",
        entityType: "WORK_ORDER",
        entityId: created.id,
        descripcion: quoteId ? "Orden creada desde presupuesto" : "Orden creada",
        newValue: { total, quoteId: quoteId ?? null },
      });
      if (quoteId) {
        await logAudit(tx, {
          tallerId: userTaller.tallerId,
          accion: "QUOTE_CONVERTED_TO_WORK_ORDER",
          entityType: "QUOTE",
          entityId: quoteId,
          newValue: { workOrderId: created.id, total },
        });
      }
      return created;
      });
    } catch (err) {
      if (prismaCode(err) === "P2002") {
        return NextResponse.json(
          { error: "Este presupuesto ya fue convertido en orden de trabajo." },
          { status: 409 }
        );
      }
      throw err;
    }

    return NextResponse.json(workOrder, { status: 201 });
  } catch (error) {
    console.error("WorkOrders POST error:", error);
    return NextResponse.json(
      { error: "No se pudo crear el registro. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}
