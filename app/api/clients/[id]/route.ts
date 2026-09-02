import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ClientSchema } from "@/lib/validations";
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

    const client = await db.client.findUnique({
      where: { id },
      include: { vehicles: true },
    });

    if (!client || client.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    return NextResponse.json(client, { status: 200 });
  } catch (error) {
    console.error("Client GET error:", error);
    return NextResponse.json(
      { error: "Error fetching client" },
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

    // Check ownership
    const existing = await db.client.findUnique({
      where: { id: id },
    });
    if (!existing || existing.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const body = await request.json();
    const validation = ClientSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 }
      );
    }

    // Check email uniqueness (excluding self)
    if (validation.data.email && validation.data.email !== existing.email) {
      const duplicate = await db.client.findUnique({
        where: {
          tallerId_email: {
            tallerId: userTaller.tallerId,
            email: validation.data.email,
          },
        },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "Email already registered" },
          { status: 409 }
        );
      }
    }

    const client = await db.client.update({
      where: { id: id },
      data: validation.data,
      include: { vehicles: true },
    });

    return NextResponse.json(client, { status: 200 });
  } catch (error) {
    console.error("Client PUT error:", error);
    return NextResponse.json(
      { error: "Error updating client" },
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

    const existing = await db.client.findUnique({
      where: { id: id },
    });
    if (!existing || existing.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    await db.client.delete({
      where: { id: id },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Client DELETE error:", error);
    return NextResponse.json(
      { error: "Error deleting client" },
      { status: 500 }
    );
  }
}
