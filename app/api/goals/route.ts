import { auth } from "@/lib/auth";
import { unauthorizedResponse, noTallerResponse, validationErrorResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { monthRangeAR, yearMonthAR } from "@/lib/dates";
import { round2 } from "@/lib/money";
import { GoalSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

async function computeAlcanzado(
  tallerId: string,
  tipo: "INGRESO_MENSUAL" | "ORDENES_MENSUALES" | "CLIENTES_NUEVOS",
  mes: number,
  anio: number
) {
  const { start, end } = monthRangeAR(anio, mes);

  if (tipo === "INGRESO_MENSUAL") {
    const movements = await db.cashMovement.findMany({
      where: { tallerId, tipo: "INGRESO", fecha: { gte: start, lt: end } },
    });
    return round2(movements.reduce((sum, m) => sum + m.monto, 0));
  }

  if (tipo === "ORDENES_MENSUALES") {
    return db.workOrder.count({
      where: { tallerId, fecha: { gte: start, lt: end } },
    });
  }

  // CLIENTES_NUEVOS
  return db.client.count({
    where: { tallerId, createdAt: { gte: start, lt: end } },
  });
}

function computeEstado(
  alcanzado: number,
  objetivo: number,
  mes: number,
  anio: number
): "EN_PROGRESO" | "ALCANZADO" | "NO_ALCANZADO" {
  if (alcanzado >= objetivo) return "ALCANZADO";

  const now = yearMonthAR();
  const monthEnded = anio < now.year || (anio === now.year && mes < now.month);

  return monthEnded ? "NO_ALCANZADO" : "EN_PROGRESO";
}

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

    const mesNum = mes ? Number(mes) : undefined;
    const anioNum = anio ? Number(anio) : undefined;
    if (
      (mesNum !== undefined && (!Number.isInteger(mesNum) || mesNum < 1 || mesNum > 12)) ||
      (anioNum !== undefined && (!Number.isInteger(anioNum) || anioNum < 2000 || anioNum > 2100))
    ) {
      return NextResponse.json({ error: "Los filtros indicados no son válidos." }, { status: 400 });
    }

    const goals = await db.goal.findMany({
      where: {
        tallerId: userTaller.tallerId,
        ...(mesNum ? { mes: mesNum } : {}),
        ...(anioNum ? { anio: anioNum } : {}),
      },
      orderBy: [{ anio: "desc" }, { mes: "desc" }],
    });

    const updated = await Promise.all(
      goals.map(async (goal) => {
        if (goal.estado === "CANCELADO") return goal;
        const alcanzado = await computeAlcanzado(
          userTaller.tallerId,
          goal.tipo,
          goal.mes,
          goal.anio
        );
        const estado = computeEstado(alcanzado, goal.objetivo, goal.mes, goal.anio);
        if (alcanzado !== goal.alcanzado || estado !== goal.estado) {
          return db.goal.update({
            where: { id: goal.id },
            data: { alcanzado, estado },
          });
        }
        return goal;
      })
    );

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("Goals GET error:", error);
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
    const validation = GoalSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const { tipo, objetivo, mes, anio, notas } = validation.data;

    const existing = await db.goal.findUnique({
      where: { tallerId_tipo_mes_anio: { tallerId: userTaller.tallerId, tipo, mes, anio } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Ya existe una meta de este tipo para ese mes/año" },
        { status: 409 }
      );
    }

    const alcanzado = await computeAlcanzado(userTaller.tallerId, tipo, mes, anio);
    const estado = computeEstado(alcanzado, objetivo, mes, anio);

    const goal = await db.goal.create({
      data: {
        tallerId: userTaller.tallerId,
        tipo,
        objetivo,
        alcanzado,
        mes,
        anio,
        estado,
        notas,
      },
    });

    return NextResponse.json(goal, { status: 201 });
  } catch (error) {
    console.error("Goals POST error:", error);
    return NextResponse.json(
      { error: "No se pudo crear el registro. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}
