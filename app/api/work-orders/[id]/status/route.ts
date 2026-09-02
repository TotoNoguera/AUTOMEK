import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { WorkOrderStatusSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

const STATUS_ORDER = [
  "PRESUPUESTA",
  "APROBADA",
  "EN_PROCESO",
  "TERMINADA",
  "ENTREGADA",
] as const;

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

    const existing = await db.workOrder.findUnique({ where: { id } });
    if (!existing || existing.tallerId !== userTaller.tallerId) {
      return NextResponse.json(
        { error: "Work order not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = WorkOrderStatusSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 }
      );
    }

    const currentIndex = STATUS_ORDER.indexOf(
      existing.status as (typeof STATUS_ORDER)[number]
    );
    const nextIndex = STATUS_ORDER.indexOf(validation.data.status);

    if (nextIndex <= currentIndex) {
      return NextResponse.json(
        {
          error: `No se puede cambiar el estado de ${existing.status} a ${validation.data.status}. Solo se permite avanzar en el flujo: ${STATUS_ORDER.join(" → ")}`,
        },
        { status: 400 }
      );
    }

    const workOrder = await db.workOrder.update({
      where: { id },
      data: { status: validation.data.status },
      include: { client: true, vehicle: true, items: true },
    });

    return NextResponse.json(workOrder, { status: 200 });
  } catch (error) {
    console.error("WorkOrder status PUT error:", error);
    return NextResponse.json(
      { error: "Error updating work order status" },
      { status: 500 }
    );
  }
}
