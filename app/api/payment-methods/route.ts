import { auth } from "@/lib/auth";
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
      { error: "Error fetching payment methods" },
      { status: 500 }
    );
  }
}
