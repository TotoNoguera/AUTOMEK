import { auth } from "@/lib/auth";
import { noTallerResponse, serviceErrorResponse, unauthorizedResponse, validationErrorResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { adjustStock } from "@/lib/stock";
import { StockAdjustSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

/** Ajuste manual de stock con motivo obligatorio (cantidad con signo). */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorizedResponse();
    const userTaller = await db.userTaller.findFirst({ where: { userId: session.user.id } });
    if (!userTaller) return noTallerResponse();

    const validation = StockAdjustSchema.safeParse(await request.json());
    if (!validation.success) return validationErrorResponse(validation.error);

    const actor = { tallerId: userTaller.tallerId, userId: session.user.id };
    const movement = await db.$transaction((tx) => adjustStock(tx, actor, validation.data), { timeout: 30000, maxWait: 20000 });
    return NextResponse.json(movement, { status: 201 });
  } catch (error) {
    const handled = serviceErrorResponse(error);
    if (handled) return handled;
    console.error("Stock adjust POST error:", error);
    return NextResponse.json({ error: "No se pudo registrar el ajuste. Reintentá en unos segundos." }, { status: 500 });
  }
}
