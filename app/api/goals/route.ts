import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { GoalSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

async function computeAlcanzado(
  tallerId: string,
  tipo: "INGRESO_MENSUAL" | "ORDENES_MENSUALES" | "CLIENTES_NUEVOS",
  mes: number,
  anio: number
) {
  const start = new Date(Date.UTC(anio, mes - 1, 1));
  const end = new Date(Date.UTC(anio, mes, 1));

  if (tipo === "INGRESO_MENSUAL") {
    const movements = await db.cashMovement.findMany({
      where: { tallerId, tipo: "INGRESO", fecha: { gte: start, lt: end } },
    });
    return movements.reduce((sum, m) => sum + m.monto, 0);
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

  const now = new Date();
  const monthEnded =
    anio < now.getUTCFullYear() ||
    (anio === now.getUTCFullYear() && mes < now.getUTCMonth() + 1);

  return monthEnded ? "NO_ALCANZADO" : "EN_PROGRESO";
}

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

    const goals = await db.goal.findMany({
      where: {
        tallerId: userTaller.tallerId,
        ...(mes ? { mes: parseInt(mes) } : {}),
        ...(anio ? { anio: parseInt(anio) } : {}),
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
      { error: "Error fetching goals" },
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
    const validation = GoalSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 }
      );
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
      { error: "Error creating goal" },
      { status: 500 }
    );
  }
}
