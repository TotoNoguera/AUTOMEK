import { auth } from "@/lib/auth";
import { noTallerResponse, serviceErrorResponse, unauthorizedResponse, validationErrorResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { createProduct, withDerived } from "@/lib/stock";
import { ProductSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

const MAX_LIMIT = 200;

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorizedResponse();
    const userTaller = await db.userTaller.findFirst({ where: { userId: session.user.id } });
    if (!userTaller) return noTallerResponse();

    const params = request.nextUrl.searchParams;
    const q = params.get("q")?.trim();
    const estado = params.get("estado") ?? "activos"; // activos | inactivos | todos
    const bajoStock = ["1", "true"].includes(params.get("bajoStock") ?? "");
    const page = Math.max(1, Math.trunc(Number(params.get("page"))) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, Math.trunc(Number(params.get("limit"))) || 50));

    const where = {
      tallerId: userTaller.tallerId,
      ...(estado === "activos" ? { activo: true } : estado === "inactivos" ? { activo: false } : {}),
      ...(q
        ? {
            OR: [
              { nombre: { contains: q, mode: "insensitive" as const } },
              { sku: { contains: q, mode: "insensitive" as const } },
              { categoria: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    // stockActual <= stockMinimo compara dos columnas: se resuelve en memoria (un taller maneja cientos de productos)
    let rows;
    let total;
    if (bajoStock) {
      const all = (await db.product.findMany({ where, orderBy: { nombre: "asc" } })).filter((p) => p.stockActual.lte(p.stockMinimo));
      total = all.length;
      rows = all.slice((page - 1) * limit, page * limit);
    } else {
      [rows, total] = await Promise.all([
        db.product.findMany({ where, orderBy: { nombre: "asc" }, skip: (page - 1) * limit, take: limit }),
        db.product.count({ where }),
      ]);
    }
    const activos = await db.product.findMany({ where: { tallerId: userTaller.tallerId, activo: true }, select: { stockActual: true, stockMinimo: true } });
    const stockBajoCount = activos.filter((p) => p.stockActual.lte(p.stockMinimo)).length;

    return NextResponse.json({ products: rows.map(withDerived), total, page, limit, stockBajoCount }, { status: 200 });
  } catch (error) {
    console.error("Products GET error:", error);
    return NextResponse.json({ error: "No se pudo cargar la información. Reintentá en unos segundos." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorizedResponse();
    const userTaller = await db.userTaller.findFirst({ where: { userId: session.user.id } });
    if (!userTaller) return noTallerResponse();

    const validation = ProductSchema.safeParse(await request.json());
    if (!validation.success) return validationErrorResponse(validation.error);

    const actor = { tallerId: userTaller.tallerId, userId: session.user.id };
    const product = await db.$transaction((tx) => createProduct(tx, actor, validation.data), { timeout: 30000, maxWait: 20000 });
    return NextResponse.json(withDerived(product), { status: 201 });
  } catch (error) {
    const handled = serviceErrorResponse(error);
    if (handled) return handled;
    console.error("Products POST error:", error);
    return NextResponse.json({ error: "No se pudo crear el producto. Reintentá en unos segundos." }, { status: 500 });
  }
}
