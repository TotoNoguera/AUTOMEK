import { auth } from "@/lib/auth";
import { unauthorizedResponse, noTallerResponse, validationErrorResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { round2 } from "@/lib/money";
import { QuoteSchema, QuoteStatusSchema } from "@/lib/validations";
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

    const quote = await db.quote.findUnique({
      where: { id },
      include: { client: true, vehicle: true, items: true, workOrder: { select: { id: true } } },
    });

    if (!quote || quote.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Presupuesto no encontrado." }, { status: 404 });
    }

    return NextResponse.json(quote, { status: 200 });
  } catch (error) {
    console.error("Quote GET error:", error);
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

    const existing = await db.quote.findUnique({ where: { id }, include: { workOrder: { select: { id: true } } } });
    if (!existing || existing.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Presupuesto no encontrado." }, { status: 404 });
    }
    if (existing.workOrder) {
      return NextResponse.json(
        { error: "Este presupuesto ya fue convertido en orden de trabajo y no se puede modificar. Editá la orden." },
        { status: 409 }
      );
    }

    const body = await request.json();
    const validation = QuoteSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const { clientId, vehicleId, items, observaciones } = validation.data;

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

    const quote = await db.quote.update({
      where: { id },
      data: {
        clientId,
        vehicleId,
        observaciones,
        total,
        items: {
          deleteMany: {},
          create: itemsWithSubtotal,
        },
      },
      include: { client: true, vehicle: true, items: true },
    });

    return NextResponse.json(quote, { status: 200 });
  } catch (error) {
    console.error("Quote PUT error:", error);
    return NextResponse.json(
      { error: "No se pudieron guardar los cambios. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

    const existing = await db.quote.findUnique({ where: { id }, include: { workOrder: { select: { id: true } } } });
    if (!existing || existing.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Presupuesto no encontrado." }, { status: 404 });
    }
    if (existing.workOrder) {
      return NextResponse.json(
        { error: "Este presupuesto ya fue convertido en orden de trabajo y no se puede cambiar su estado." },
        { status: 409 }
      );
    }

    const body = await request.json();
    const validation = QuoteStatusSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const quote = await db.$transaction(async (tx) => {
      const updated = await tx.quote.update({
        where: { id },
        data: { status: validation.data.status },
        include: { client: true, vehicle: true, items: true },
      });
      if (existing.status !== validation.data.status && validation.data.status !== "PENDIENTE") {
        await logAudit(tx, {
          tallerId: userTaller.tallerId,
          accion: validation.data.status === "APROBADO" ? "QUOTE_APPROVED" : "QUOTE_REJECTED",
          entityType: "QUOTE",
          entityId: id,
          oldValue: { status: existing.status },
          newValue: { status: validation.data.status, total: updated.total },
        });
      }
      return updated;
    });

    return NextResponse.json(quote, { status: 200 });
  } catch (error) {
    console.error("Quote PATCH error:", error);
    return NextResponse.json(
      { error: "No se pudieron guardar los cambios. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}
