import { auth } from "@/lib/auth";
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

    const vehicle = await db.vehicle.findUnique({
      where: { id: id },
      include: { client: true },
    });

    if (!vehicle || vehicle.client.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }

    return NextResponse.json(vehicle, { status: 200 });
  } catch (error) {
    console.error("Vehicle GET error:", error);
    return NextResponse.json(
      { error: "Error fetching vehicle" },
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

    const existing = await db.vehicle.findUnique({
      where: { id: id },
      include: { client: true },
    });
    if (!existing || existing.client.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }

    const body = await request.json();
    const validation = VehicleSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 }
      );
    }

    // Verify client ownership (in case clientId changed)
    const client = await db.client.findUnique({
      where: { id: validation.data.clientId },
    });
    if (!client || client.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Check patente uniqueness (excluding self)
    if (validation.data.patente !== existing.patente) {
      const duplicate = await db.vehicle.findUnique({
        where: { patente: validation.data.patente },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "License plate already registered" },
          { status: 409 }
        );
      }
    }

    const vehicle = await db.vehicle.update({
      where: { id: id },
      data: validation.data,
      include: { client: true },
    });

    return NextResponse.json(vehicle, { status: 200 });
  } catch (error) {
    console.error("Vehicle PUT error:", error);
    return NextResponse.json(
      { error: "Error updating vehicle" },
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

    const existing = await db.vehicle.findUnique({
      where: { id: id },
      include: { client: true },
    });
    if (!existing || existing.client.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }

    await db.vehicle.delete({
      where: { id: id },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Vehicle DELETE error:", error);
    return NextResponse.json(
      { error: "Error deleting vehicle" },
      { status: 500 }
    );
  }
}
