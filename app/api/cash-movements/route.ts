import { auth } from "@/lib/auth";
import { unauthorizedResponse, noTallerResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { dayRangeAR, isValidDateString } from "@/lib/dates";
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
    const tipo = searchParams.get("tipo");
    const categoria = searchParams.get("categoria");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const tipos = ["INGRESO", "EGRESO"];
    const categorias = [
      "PAGO_ORDEN", "ANTICIPO", "COMPRA_REPUESTOS", "COMPRA_MATERIALES", "GASTO_SERVICIOS", "GASTO_MANTENIMIENTO",
      "GASTO_SUELDOS", "GASTO_ALQUILER", "GASTO_SERVICIOS_UTILES", "GASTO_IMPUESTOS", "GASTO_OTROS",
      "COSTO_FIJO_DIARIO", "COSTO_VARIABLE_DIARIO",
    ];
    if (
      (tipo && !tipos.includes(tipo)) ||
      (categoria && !categorias.includes(categoria)) ||
      (from && !isValidDateString(from)) ||
      (to && !isValidDateString(to))
    ) {
      return NextResponse.json({ error: "Los filtros indicados no son válidos." }, { status: 400 });
    }

    let fechaFilter: { gte?: Date; lt?: Date } | undefined;
    if (from && to) {
      fechaFilter = {
        gte: dayRangeAR(from).start,
        lt: dayRangeAR(to).end,
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
        reversedBy: { select: { id: true } },
      },
      orderBy: { fecha: "desc" },
    });

    return NextResponse.json(movements, { status: 200 });
  } catch (error) {
    console.error("CashMovements GET error:", error);
    return NextResponse.json(
      { error: "No se pudo cargar la información. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}
