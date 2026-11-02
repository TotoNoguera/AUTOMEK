import { auth } from "@/lib/auth";
import { noTallerResponse, serviceErrorResponse, unauthorizedResponse, validationErrorResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { setNegativeStockPolicy } from "@/lib/stock";
import { StockSettingsSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return unauthorizedResponse();
    const userTaller = await db.userTaller.findFirst({ where: { userId: session.user.id } });
    if (!userTaller) return noTallerResponse();

    const taller = await db.taller.findUnique({ where: { id: userTaller.tallerId }, select: { permitirStockNegativo: true } });
    return NextResponse.json({ permitirStockNegativo: taller?.permitirStockNegativo ?? false }, { status: 200 });
  } catch (error) {
    console.error("Stock settings GET error:", error);
    return NextResponse.json({ error: "No se pudo cargar la información. Reintentá en unos segundos." }, { status: 500 });
  }
}

/** Política de stock negativo del taller (por defecto no se permite). */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorizedResponse();
    const userTaller = await db.userTaller.findFirst({ where: { userId: session.user.id } });
    if (!userTaller) return noTallerResponse();

    const validation = StockSettingsSchema.safeParse(await request.json());
    if (!validation.success) return validationErrorResponse(validation.error);

    const actor = { tallerId: userTaller.tallerId, userId: session.user.id };
    const result = await db.$transaction((tx) => setNegativeStockPolicy(tx, actor, validation.data.permitirStockNegativo), { timeout: 30000, maxWait: 20000 });
    return NextResponse.json({ permitirStockNegativo: result.permitirStockNegativo }, { status: 200 });
  } catch (error) {
    const handled = serviceErrorResponse(error);
    if (handled) return handled;
    console.error("Stock settings PUT error:", error);
    return NextResponse.json({ error: "No se pudieron guardar los cambios. Reintentá en unos segundos." }, { status: 500 });
  }
}
