import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { QuoteSchema } from "@/lib/validations";
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

    const quotes = await db.quote.findMany({
      where: {
        tallerId: userTaller.tallerId,
        ...(status ? { status: status as "PENDIENTE" | "APROBADO" | "RECHAZADO" } : {}),
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
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(quotes, { status: 200 });
  } catch (error) {
    console.error("Quotes GET error:", error);
    return NextResponse.json(
      { error: "Error fetching quotes" },
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
    const validation = QuoteSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { clientId, vehicleId, items, observaciones } = validation.data;

    // Verify client belongs to taller
    const client = await db.client.findUnique({ where: { id: clientId } });
    if (!client || client.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Verify vehicle belongs to client (and thus to taller)
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

    const quote = await db.quote.create({
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

    return NextResponse.json(quote, { status: 201 });
  } catch (error) {
    console.error("Quotes POST error:", error);
    return NextResponse.json(
      { error: "Error creating quote" },
      { status: 500 }
    );
  }
}
