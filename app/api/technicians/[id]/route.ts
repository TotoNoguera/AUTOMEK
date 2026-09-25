import { auth } from "@/lib/auth";
import { unauthorizedResponse, noTallerResponse, validationErrorResponse } from "@/lib/api";
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
      return unauthorizedResponse();
    }

    const userTaller = await db.userTaller.findFirst({
      where: { userId: session.user.id },
    });
    if (!userTaller) {
      return noTallerResponse();
    }

    const technician = await db.technician.findUnique({ where: { id } });
    if (!technician || technician.tallerId !== userTaller.tallerId) {
      return NextResponse.json(
        { error: "Técnico no encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json(technician, { status: 200 });
  } catch (error) {
    console.error("Technician GET error:", error);
    return NextResponse.json(
      { error: "No se pudo cargar la información. Reintentá en unos segundos." },
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
      return unauthorizedResponse();
    }

    const userTaller = await db.userTaller.findFirst({
      where: { userId: session.user.id },
    });
    if (!userTaller) {
      return noTallerResponse();
    }

    const existing = await db.technician.findUnique({ where: { id } });
    if (!existing || existing.tallerId !== userTaller.tallerId) {
      return NextResponse.json(
        { error: "Técnico no encontrado." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = TechnicianUpdateSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
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
      { error: "No se pudieron guardar los cambios. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}
