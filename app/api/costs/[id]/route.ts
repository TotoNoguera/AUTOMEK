import { auth } from "@/lib/auth";
import { unauthorizedResponse, noTallerResponse, validationErrorResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { CostSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

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

    const existing = await db.cost.findUnique({ where: { id } });
    if (!existing || existing.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Costo no encontrado." }, { status: 404 });
    }

    const body = await request.json();
    const validation = CostSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const { workOrderId } = validation.data;
    if (workOrderId) {
      const workOrder = await db.workOrder.findUnique({ where: { id: workOrderId } });
      if (!workOrder || workOrder.tallerId !== userTaller.tallerId) {
        return NextResponse.json(
          { error: "Orden de trabajo no encontrada." },
          { status: 404 }
        );
      }
    }

    const cost = await db.cost.update({
      where: { id },
      data: validation.data,
    });

    return NextResponse.json(cost, { status: 200 });
  } catch (error) {
    console.error("Cost PUT error:", error);
    return NextResponse.json(
      { error: "No se pudieron guardar los cambios. Reintentá en unos segundos." },
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
      return unauthorizedResponse();
    }

    const userTaller = await db.userTaller.findFirst({
      where: { userId: session.user.id },
    });
    if (!userTaller) {
      return noTallerResponse();
    }

    const existing = await db.cost.findUnique({ where: { id } });
    if (!existing || existing.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Costo no encontrado." }, { status: 404 });
    }

    await db.cost.delete({ where: { id } });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Cost DELETE error:", error);
    return NextResponse.json(
      { error: "No se pudo eliminar el registro. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}
