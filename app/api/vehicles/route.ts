import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { VehicleSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const clientId = searchParams.get("clientId");

    const userTaller = await db.userTaller.findFirst({
      where: { userId: session.user.id },
    });
    if (!userTaller) {
      return NextResponse.json(
        { error: "User not associated with a taller" },
        { status: 400 }
      );
    }

    const vehicles = await db.vehicle.findMany({
      where: {
        client: {
          tallerId: userTaller.tallerId,
        },
        ...(clientId && { clientId }),
        OR: [
          { patente: { contains: search, mode: "insensitive" } },
          { marca: { contains: search, mode: "insensitive" } },
          { modelo: { contains: search, mode: "insensitive" } },
        ],
      },
      include: {
        client: true,
      },
      orderBy: { patente: "asc" },
    });

    return NextResponse.json(vehicles, { status: 200 });
  } catch (error) {
    console.error("Vehicles GET error:", error);
    return NextResponse.json(
      { error: "Error fetching vehicles" },
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
    const validation = VehicleSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 }
      );
    }

    // Verify client ownership
    const client = await db.client.findUnique({
      where: { id: validation.data.clientId },
    });
    if (!client || client.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Check patente uniqueness
    const existing = await db.vehicle.findUnique({
      where: { patente: validation.data.patente },
    });
    if (existing) {
      return NextResponse.json(
        { error: "License plate already registered" },
        { status: 409 }
      );
    }

    const vehicle = await db.vehicle.create({
      data: validation.data,
      include: { client: true },
    });

    return NextResponse.json(vehicle, { status: 201 });
  } catch (error) {
    console.error("Vehicles POST error:", error);
    return NextResponse.json(
      { error: "Error creating vehicle" },
      { status: 500 }
    );
  }
}
