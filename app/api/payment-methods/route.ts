import { auth } from "@/lib/auth";
import { unauthorizedResponse, noTallerResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

const DEFAULT_METHODS: Array<{ tipo: "EFECTIVO" | "TRANSFERENCIA" | "TARJETA" | "CUENTA_CORRIENTE"; nombre: string }> = [
  { tipo: "EFECTIVO", nombre: "Efectivo" },
  { tipo: "TRANSFERENCIA", nombre: "Transferencia" },
  { tipo: "TARJETA", nombre: "Tarjeta" },
  { tipo: "CUENTA_CORRIENTE", nombre: "Cuenta Corriente" },
];

export async function GET() {
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

    let methods = await db.paymentMethod.findMany({
      where: { tallerId: userTaller.tallerId },
    });

    if (methods.length === 0) {
      await db.paymentMethod.createMany({
        data: DEFAULT_METHODS.map((m) => ({ ...m, tallerId: userTaller.tallerId })),
      });
      methods = await db.paymentMethod.findMany({
        where: { tallerId: userTaller.tallerId },
      });
    }

    return NextResponse.json(methods, { status: 200 });
  } catch (error) {
    console.error("PaymentMethods GET error:", error);
    return NextResponse.json(
      { error: "No se pudo cargar la información. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}
