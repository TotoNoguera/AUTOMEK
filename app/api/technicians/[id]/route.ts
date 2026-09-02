import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { TechnicianUpdateSchema } from "@/lib/validations";
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

    const technician = await db.technician.findUnique({ where: { id } });
    if (!technician || technician.tallerId !== userTaller.tallerId) {
      return NextResponse.json(
        { error: "Technician not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(technician, { status: 200 });
  } catch (error) {
    console.error("Technician GET error:", error);
    return NextResponse.json(
      { error: "Error fetching technician" },
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

    const existing = await db.technician.findUnique({ where: { id } });
    if (!existing || existing.tallerId !== userTaller.tallerId) {
      return NextResponse.json(
        { error: "Technician not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = TechnicianUpdateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { nombre, email, telefono, especialidad, activo } = validation.data;

    const technician = await db.technician.update({
      where: { id },
      data: {
        nombre,
        email: email || undefined,
        telefono,
        especialidad,
        ...(activo !== undefined ? { activo } : {}),
      },
    });

    return NextResponse.json(technician, { status: 200 });
  } catch (error) {
    console.error("Technician PUT error:", error);
    return NextResponse.json(
      { error: "Error updating technician" },
      { status: 500 }
    );
  }
}
