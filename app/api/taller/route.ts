import { auth } from "@/lib/auth";
import { noTallerResponse, unauthorizedResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

/** Identidad del taller del usuario autenticado (nombre y logo). Cada taller solo ve la suya. */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return unauthorizedResponse();
    const userTaller = await db.userTaller.findFirst({ where: { userId: session.user.id } });
    if (!userTaller) return noTallerResponse();

    const taller = await db.taller.findUnique({ where: { id: userTaller.tallerId }, select: { id: true, nombre: true, logo: true } });
    return NextResponse.json(taller, { status: 200 });
  } catch (error) {
    console.error("Taller GET error:", error);
    return NextResponse.json({ error: "No se pudo cargar la información. Reintentá en unos segundos." }, { status: 500 });
  }
}
