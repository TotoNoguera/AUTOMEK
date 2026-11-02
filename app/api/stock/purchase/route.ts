import { auth } from "@/lib/auth";
import { noTallerResponse, serviceErrorResponse, unauthorizedResponse, validationErrorResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { registerPurchase } from "@/lib/stock";
import { PurchaseSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

/** Carga de compra (entrada de stock). */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorizedResponse();
    const userTaller = await db.userTaller.findFirst({ where: { userId: session.user.id } });
    if (!userTaller) return noTallerResponse();

    const validation = PurchaseSchema.safeParse(await request.json());
    if (!validation.success) return validationErrorResponse(validation.error);

    const actor = { tallerId: userTaller.tallerId, userId: session.user.id };
    const movement = await db.$transaction((tx) => registerPurchase(tx, actor, validation.data), { timeout: 30000, maxWait: 20000 });
    return NextResponse.json(movement, { status: 201 });
  } catch (error) {
    const handled = serviceErrorResponse(error);
    if (handled) return handled;
    console.error("Stock purchase POST error:", error);
    return NextResponse.json({ error: "No se pudo registrar la compra. Reintentá en unos segundos." }, { status: 500 });
  }
}
