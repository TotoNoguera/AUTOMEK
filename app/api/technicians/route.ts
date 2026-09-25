import { auth } from "@/lib/auth";
import { unauthorizedResponse, noTallerResponse, validationErrorResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { TechnicianSchema } from "@/lib/validations";
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
    const validation = TechnicianSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
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
      { error: "No se pudo crear el registro. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}
