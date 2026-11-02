import { auth } from "@/lib/auth";
import { noTallerResponse, serviceErrorResponse, unauthorizedResponse, validationErrorResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { returnToStock } from "@/lib/stock";
import { StockReturnSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

/**
 * Devolución explícita al stock: unidades físicamente recuperadas de una orden de trabajo.
 * Solo admite hasta el excedente de la orden (lo descontado que los ítems ya no piden).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorizedResponse();
    const userTaller = await db.userTaller.findFirst({ where: { userId: session.user.id } });
    if (!userTaller) return noTallerResponse();

    const validation = StockReturnSchema.safeParse(await request.json());
    if (!validation.success) return validationErrorResponse(validation.error);

    const actor = { tallerId: userTaller.tallerId, userId: session.user.id };
    const movement = await db.$transaction((tx) => returnToStock(tx, actor, validation.data), { timeout: 30000, maxWait: 20000 });
    return NextResponse.json(movement, { status: 201 });
  } catch (error) {
    const handled = serviceErrorResponse(error);
    if (handled) return handled;
    console.error("Stock returns POST error:", error);
    return NextResponse.json({ error: "No se pudo registrar la devolución. Reintentá en unos segundos." }, { status: 500 });
  }
}
