import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { CostSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const mes = searchParams.get("mes");
    const anio = searchParams.get("anio");
    const tipo = searchParams.get("tipo");

    const costs = await db.cost.findMany({
      where: {
        tallerId: userTaller.tallerId,
        ...(mes ? { mes: parseInt(mes) } : {}),
        ...(anio ? { anio: parseInt(anio) } : {}),
        ...(tipo ? { tipo: tipo as "FIJO" | "VARIABLE" } : {}),
      },
      orderBy: [{ anio: "desc" }, { mes: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(costs, { status: 200 });
  } catch (error) {
    console.error("Costs GET error:", error);
    return NextResponse.json(
      { error: "Error fetching costs" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const validation = CostSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { workOrderId } = validation.data;
    if (workOrderId) {
      const workOrder = await db.workOrder.findUnique({ where: { id: workOrderId } });
      if (!workOrder || workOrder.tallerId !== userTaller.tallerId) {
        return NextResponse.json(
          { error: "Work order not found" },
          { status: 404 }
        );
      }
    }

    const cost = await db.cost.create({
      data: {
        tallerId: userTaller.tallerId,
        ...validation.data,
      },
    });

    return NextResponse.json(cost, { status: 201 });
  } catch (error) {
    console.error("Costs POST error:", error);
    return NextResponse.json(
      { error: "Error creating cost" },
      { status: 500 }
    );
  }
}
