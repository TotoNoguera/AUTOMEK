import { auth } from "@/lib/auth";
import { noTallerResponse, serviceErrorResponse, unauthorizedResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { getOrderStockSummary } from "@/lib/stock";
import { NextRequest, NextResponse } from "next/server";

/** Resumen de stock de la orden: por producto, lo solicitado, lo descontado, lo devuelto y el excedente devolvible. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await auth();
    if (!session?.user) return unauthorizedResponse();
    const userTaller = await db.userTaller.findFirst({ where: { userId: session.user.id } });
    if (!userTaller) return noTallerResponse();

    const summary = await getOrderStockSummary(db, { tallerId: userTaller.tallerId, userId: session.user.id }, id);
    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    const handled = serviceErrorResponse(error);
    if (handled) return handled;
    console.error("WorkOrder stock GET error:", error);
    return NextResponse.json({ error: "No se pudo cargar la información. Reintentá en unos segundos." }, { status: 500 });
  }
}
