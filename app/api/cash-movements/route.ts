import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
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
    const tipo = searchParams.get("tipo");
    const categoria = searchParams.get("categoria");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    let fechaFilter: { gte?: Date; lte?: Date } | undefined;
    if (from && to) {
      fechaFilter = {
        gte: new Date(`${from}T00:00:00.000Z`),
        lte: new Date(`${to}T23:59:59.999Z`),
      };
    }

    const movements = await db.cashMovement.findMany({
      where: {
        tallerId: userTaller.tallerId,
        ...(tipo ? { tipo: tipo as "INGRESO" | "EGRESO" } : {}),
        ...(categoria
          ? {
              categoria: categoria as
                | "PAGO_ORDEN"
                | "ANTICIPO"
                | "COMPRA_REPUESTOS"
                | "COMPRA_MATERIALES"
                | "GASTO_SERVICIOS"
                | "GASTO_MANTENIMIENTO"
                | "GASTO_SUELDOS"
                | "GASTO_ALQUILER"
                | "GASTO_SERVICIOS_UTILES"
                | "GASTO_IMPUESTOS"
                | "GASTO_OTROS"
                | "COSTO_FIJO_DIARIO"
                | "COSTO_VARIABLE_DIARIO",
            }
          : {}),
        ...(fechaFilter ? { fecha: fechaFilter } : {}),
      },
      include: {
        workOrder: { include: { client: true, vehicle: true } },
      },
      orderBy: { fecha: "desc" },
    });

    return NextResponse.json(movements, { status: 200 });
  } catch (error) {
    console.error("CashMovements GET error:", error);
    return NextResponse.json(
      { error: "Error fetching cash movements" },
      { status: 500 }
    );
  }
}
