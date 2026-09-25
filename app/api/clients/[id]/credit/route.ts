import { auth } from "@/lib/auth";
import { unauthorizedResponse, noTallerResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
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

    const client = await db.client.findUnique({ where: { id } });
    if (!client || client.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
    }

    let credit = await db.clientCredit.findUnique({
      where: { tallerId_clientId: { tallerId: userTaller.tallerId, clientId: id } },
    });
    if (!credit) {
      credit = await db.clientCredit.create({
        data: { tallerId: userTaller.tallerId, clientId: id, saldo: 0 },
      });
    }

    return NextResponse.json(credit, { status: 200 });
  } catch (error) {
    console.error("ClientCredit GET error:", error);
    return NextResponse.json(
      { error: "No se pudo cargar la información. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}
