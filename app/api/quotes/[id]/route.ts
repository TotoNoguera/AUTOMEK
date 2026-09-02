import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
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

    const quote = await db.quote.findUnique({
      where: { id },
      include: { client: true, vehicle: true, items: true },
    });

    if (!quote || quote.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    return NextResponse.json(quote, { status: 200 });
  } catch (error) {
    console.error("Quote GET error:", error);
    return NextResponse.json(
      { error: "Error fetching quote" },
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

    const existing = await db.quote.findUnique({ where: { id } });
    if (!existing || existing.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    const body = await request.json();
    const validation = QuoteSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { clientId, vehicleId, items, observaciones } = validation.data;

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
      { error: "Error updating quote" },
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

    const existing = await db.quote.findUnique({ where: { id } });
    if (!existing || existing.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    const body = await request.json();
    const validation = QuoteStatusSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 }
      );
    }

    const quote = await db.quote.update({
      where: { id },
      data: { status: validation.data.status },
      include: { client: true, vehicle: true, items: true },
    });

    return NextResponse.json(quote, { status: 200 });
  } catch (error) {
    console.error("Quote PATCH error:", error);
    return NextResponse.json(
      { error: "Error updating quote status" },
      { status: 500 }
    );
  }
}
