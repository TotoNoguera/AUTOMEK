import { Prisma } from "@prisma/client";
import { todayAR } from "@/lib/dates";

type Tx = Prisma.TransactionClient;

/** Tabla calificada con el schema de la conexión (public en producción; otro en entornos de prueba aislados). */
function tableRef(table: string) {
  let schema: string | null = null;
  try {
    schema = new URL(process.env.DATABASE_URL ?? "").searchParams.get("schema");
  } catch {
    schema = null;
  }
  const name = schema ?? "public";
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error("Schema de base de datos inválido");
  return Prisma.raw(`"${name}"."${table}"`);
}

/** Bloquea la fila de la orden hasta el fin de la transacción: serializa pagos simultáneos sobre la misma orden. */
export async function lockWorkOrder(tx: Tx, id: string) {
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM ${tableRef("work_orders")} WHERE "id" = ${id} FOR UPDATE`);
}

/** Bloquea la fila del cliente: serializa cambios simultáneos de su cuenta corriente. */
export async function lockClient(tx: Tx, id: string) {
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM ${tableRef("clients")} WHERE "id" = ${id} FOR UPDATE`);
}

export const CASH_CLOSED_MESSAGE =
  "La caja de hoy ya fue cerrada. No se pueden registrar más movimientos en un día cerrado; registralo mañana.";

/** Devuelve true si el día argentino de hoy ya tiene cierre de caja. */
export async function isTodayClosed(tx: Tx, tallerId: string): Promise<boolean> {
  const closed = await tx.dailyClose.findUnique({
    where: { tallerId_fecha: { tallerId, fecha: new Date(`${todayAR()}T00:00:00.000Z`) } },
    select: { id: true },
  });
  return closed !== null;
}

export class BusinessError extends Error {
  constructor(message: string, public status: number = 400) {
    super(message);
  }
}
