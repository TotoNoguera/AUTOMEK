import { auth } from "@/lib/auth";
import { unauthorizedResponse, noTallerResponse, validationErrorResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { CostSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const mes = searchParams.get("mes");
    const anio = searchParams.get("anio");
    const tipo = searchParams.get("tipo");

    const mesNum = mes ? Number(mes) : undefined;
    const anioNum = anio ? Number(anio) : undefined;
    if (
      (mesNum !== undefined && (!Number.isInteger(mesNum) || mesNum < 1 || mesNum > 12)) ||
      (anioNum !== undefined && (!Number.isInteger(anioNum) || anioNum < 2000 || anioNum > 2100)) ||
      (tipo && tipo !== "FIJO" && tipo !== "VARIABLE")
    ) {
      return NextResponse.json({ error: "Los filtros indicados no son válidos." }, { status: 400 });
    }

    const costs = await db.cost.findMany({
      where: {
        tallerId: userTaller.tallerId,
        ...(mesNum ? { mes: mesNum } : {}),
        ...(anioNum ? { anio: anioNum } : {}),
        ...(tipo ? { tipo: tipo as "FIJO" | "VARIABLE" } : {}),
      },
      orderBy: [{ anio: "desc" }, { mes: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(costs, { status: 200 });
  } catch (error) {
    console.error("Costs GET error:", error);
    return NextResponse.json(
      { error: "No se pudo cargar la información. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const validation = CostSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const { workOrderId } = validation.data;
    if (workOrderId) {
      const workOrder = await db.workOrder.findUnique({ where: { id: workOrderId } });
      if (!workOrder || workOrder.tallerId !== userTaller.tallerId) {
        return NextResponse.json(
          { error: "Orden de trabajo no encontrada." },
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
      { error: "No se pudo crear el registro. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}
