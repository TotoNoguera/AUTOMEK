import { auth } from "@/lib/auth";
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userTaller = await db.userTaller.findFirst({
      where: { userId: session.user.id },
    });
    if (!userTaller) {
      return NextResponse.json(
        { error: "User not associated with a taller" },
        { status: 400 }
      );
    }

    const client = await db.client.findUnique({ where: { id } });
    if (!client || client.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
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
      { error: "Error fetching client credit" },
      { status: 500 }
    );
  }
}
