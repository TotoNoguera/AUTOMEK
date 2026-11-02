import { auth } from "@/lib/auth";
import { noTallerResponse, serviceErrorResponse, unauthorizedResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { getProductOrThrow } from "@/lib/stock";
import { NextRequest, NextResponse } from "next/server";

const MAX_LIMIT = 200;

/** Historial de movimientos de un producto (del más reciente al más antiguo). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await auth();
    if (!session?.user) return unauthorizedResponse();
    const userTaller = await db.userTaller.findFirst({ where: { userId: session.user.id } });
    if (!userTaller) return noTallerResponse();

    const product = await getProductOrThrow(db, userTaller.tallerId, id);
    const page = Math.max(1, Math.trunc(Number(request.nextUrl.searchParams.get("page"))) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, Math.trunc(Number(request.nextUrl.searchParams.get("limit"))) || 50));
    const where = { productId: id, tallerId: userTaller.tallerId };

    const [movements, total] = await Promise.all([
      db.stockMovement.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { name: true, email: true } } },
      }),
      db.stockMovement.count({ where }),
    ]);
    return NextResponse.json(
      { product: { id: product.id, nombre: product.nombre, unidad: product.unidad, stockActual: product.stockActual }, movements, total, page, limit },
      { status: 200 }
    );
  } catch (error) {
    const handled = serviceErrorResponse(error);
    if (handled) return handled;
    console.error("Product movements GET error:", error);
    return NextResponse.json({ error: "No se pudo cargar la información. Reintentá en unos segundos." }, { status: 500 });
  }
}
