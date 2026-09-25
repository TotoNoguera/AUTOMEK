import { auth } from "@/lib/auth";
import { unauthorizedResponse, noTallerResponse, validationErrorResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { normalizeText } from "@/lib/text";
import { logAudit } from "@/lib/audit";
import { round2 } from "@/lib/money";
import { QuoteSchema } from "@/lib/validations";
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
    if (status && !["PENDIENTE", "APROBADO", "RECHAZADO"].includes(status)) {
      return NextResponse.json({ error: "Los filtros indicados no son válidos." }, { status: 400 });
    }

    const allQuotes = await db.quote.findMany({
      where: {
        tallerId: userTaller.tallerId,
        ...(status ? { status: status as "PENDIENTE" | "APROBADO" | "RECHAZADO" } : {}),
      },
      include: {
        client: true,
        vehicle: true,
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });
    const quotes = search
      ? allQuotes.filter(
          (q) =>
            normalizeText(q.client.nombre).includes(search) ||
            normalizeText(q.vehicle.patente).includes(search.replace(/[s-]+/g, ""))
        )
      : allQuotes;

    return NextResponse.json(quotes, { status: 200 });
  } catch (error) {
    console.error("Quotes GET error:", error);
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
    const validation = QuoteSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const { clientId, vehicleId, items, observaciones } = validation.data;

    // Verify client belongs to taller
    const client = await db.client.findUnique({ where: { id: clientId } });
    if (!client || client.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
    }

    // Verify vehicle belongs to client (and thus to taller)
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

    const quote = await db.$transaction(async (tx) => {
      const created = await tx.quote.create({
        data: {
          tallerId: userTaller.tallerId,
          clientId,
          vehicleId,
          observaciones,
          total,
          items: { create: itemsWithSubtotal },
        },
        include: { client: true, vehicle: true, items: true },
      });
      await logAudit(tx, {
        userId: session.user.id,
tallerId: userTaller.tallerId,
        accion: "QUOTE_CREATED",
        entityType: "QUOTE",
        entityId: created.id,
        newValue: { total, items: itemsWithSubtotal.length },
      });
      return created;
    });

    return NextResponse.json(quote, { status: 201 });
  } catch (error) {
    console.error("Quotes POST error:", error);
    return NextResponse.json(
      { error: "No se pudo crear el registro. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}
