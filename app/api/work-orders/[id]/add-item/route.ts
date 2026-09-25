import { auth } from "@/lib/auth";
import { unauthorizedResponse, noTallerResponse, validationErrorResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { round2 } from "@/lib/money";
import { WorkOrderItemSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
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

    const existing = await db.workOrder.findUnique({ where: { id } });
    if (!existing || existing.tallerId !== userTaller.tallerId) {
      return NextResponse.json(
        { error: "Orden de trabajo no encontrada." },
        { status: 404 }
      );
    }
    if (existing.status === "ENTREGADA") {
      return NextResponse.json(
        { error: "La orden ya fue entregada y no se puede modificar." },
        { status: 409 }
      );
    }

    const body = await request.json();
    const validation = WorkOrderItemSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const subtotal = round2(validation.data.cantidad * validation.data.precioUnitario);

    await db.workOrderItem.create({
      data: {
        workOrderId: id,
        descripcion: validation.data.descripcion,
        cantidad: validation.data.cantidad,
        precioUnitario: validation.data.precioUnitario,
        subtotal,
      },
    });

    const remainingItems = await db.workOrderItem.findMany({
      where: { workOrderId: id },
    });
    const total = round2(remainingItems.reduce((sum, item) => sum + item.subtotal, 0));

    const workOrder = await db.workOrder.update({
      where: { id },
      data: { total },
      include: { client: true, vehicle: true, items: true },
    });

    return NextResponse.json(workOrder, { status: 201 });
  } catch (error) {
    console.error("WorkOrder add-item error:", error);
    return NextResponse.json(
      { error: "No se pudo agregar el trabajo a la orden. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}
