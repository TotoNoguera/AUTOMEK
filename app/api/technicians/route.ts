import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { TechnicianSchema } from "@/lib/validations";
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
    const activo = searchParams.get("activo");

    const technicians = await db.technician.findMany({
      where: {
        tallerId: userTaller.tallerId,
        ...(activo !== null ? { activo: activo === "true" } : {}),
      },
      orderBy: { nombre: "asc" },
    });

    return NextResponse.json(technicians, { status: 200 });
  } catch (error) {
    console.error("Technicians GET error:", error);
    return NextResponse.json(
      { error: "Error fetching technicians" },
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
    const validation = TechnicianSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 }
      );
    }

    const technician = await db.technician.create({
      data: {
        tallerId: userTaller.tallerId,
        nombre: validation.data.nombre,
        email: validation.data.email || undefined,
        telefono: validation.data.telefono,
        especialidad: validation.data.especialidad,
      },
    });

    return NextResponse.json(technician, { status: 201 });
  } catch (error) {
    console.error("Technicians POST error:", error);
    return NextResponse.json(
      { error: "Error creating technician" },
      { status: 500 }
    );
  }
}
