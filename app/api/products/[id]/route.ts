import { auth } from "@/lib/auth";
import { noTallerResponse, serviceErrorResponse, unauthorizedResponse, validationErrorResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { getProductOrThrow, updateProduct, withDerived } from "@/lib/stock";
import { ProductUpdateSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await auth();
    if (!session?.user) return unauthorizedResponse();
    const userTaller = await db.userTaller.findFirst({ where: { userId: session.user.id } });
    if (!userTaller) return noTallerResponse();

    const product = await getProductOrThrow(db, userTaller.tallerId, id);
    return NextResponse.json(withDerived(product), { status: 200 });
  } catch (error) {
    const handled = serviceErrorResponse(error);
    if (handled) return handled;
    console.error("Product GET error:", error);
    return NextResponse.json({ error: "No se pudo cargar la información. Reintentá en unos segundos." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await auth();
    if (!session?.user) return unauthorizedResponse();
    const userTaller = await db.userTaller.findFirst({ where: { userId: session.user.id } });
    if (!userTaller) return noTallerResponse();

    const validation = ProductUpdateSchema.safeParse(await request.json());
    if (!validation.success) return validationErrorResponse(validation.error);

    const actor = { tallerId: userTaller.tallerId, userId: session.user.id };
    const product = await db.$transaction((tx) => updateProduct(tx, actor, id, validation.data), { timeout: 30000, maxWait: 20000 });
    return NextResponse.json(withDerived(product), { status: 200 });
  } catch (error) {
    const handled = serviceErrorResponse(error);
    if (handled) return handled;
    console.error("Product PUT error:", error);
    return NextResponse.json({ error: "No se pudieron guardar los cambios. Reintentá en unos segundos." }, { status: 500 });
  }
}
