import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ClientSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const tallerId = searchParams.get("tallerId");

    // Get user's taller if not specified
    let userTallerId = tallerId;
    if (!userTallerId) {
      const userTaller = await db.userTaller.findFirst({
        where: { userId: session.user.id },
      });
      if (!userTaller) {
        return NextResponse.json(
          { error: "User not associated with a taller" },
          { status: 400 }
        );
      }
      userTallerId = userTaller.tallerId;
    }

    const clients = await db.client.findMany({
      where: {
        tallerId: userTallerId,
        OR: [
          { nombre: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { telefono: { contains: search, mode: "insensitive" } },
        ],
      },
      include: {
        vehicles: true,
      },
      orderBy: { nombre: "asc" },
    });

    return NextResponse.json(clients, { status: 200 });
  } catch (error) {
    console.error("Clients GET error:", error);
    return NextResponse.json(
      { error: "Error fetching clients" },
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

    const body = await request.json();

    const validation = ClientSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 }
      );
    }

    // Get user's taller
    const userTaller = await db.userTaller.findFirst({
      where: { userId: session.user.id },
    });
    if (!userTaller) {
      return NextResponse.json(
        { error: "User not associated with a taller" },
        { status: 400 }
      );
    }

    // Check email uniqueness per taller
    if (validation.data.email) {
      const existing = await db.client.findUnique({
        where: {
          tallerId_email: {
            tallerId: userTaller.tallerId,
            email: validation.data.email,
          },
        },
      });
      if (existing) {
        return NextResponse.json(
          { error: "Email already registered for this taller" },
          { status: 409 }
        );
      }
    }

    const client = await db.client.create({
      data: {
        ...validation.data,
        tallerId: userTaller.tallerId,
      },
      include: { vehicles: true },
    });

    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    console.error("Clients POST error:", error);
    return NextResponse.json(
      { error: "Error creating client" },
      { status: 500 }
    );
  }
}
