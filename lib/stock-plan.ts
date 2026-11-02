// Lógica pura del stock (sin base de datos): planificación de movimientos y utilidades de formato.
import { Prisma } from "@prisma/client";
import "./decimal";
import { formatQuantity } from "./units";

const D = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);

export type PlannedMovement = {
  productId: string;
  tipo: "SALIDA_ORDEN";
  /** Negativa: sale del stock. */
  cantidad: Prisma.Decimal;
};

/** Suma las cantidades de los ítems vinculados a un producto. Los ítems sin producto se ignoran. */
export function sumByProduct(items: Array<{ productId: string | null; cantidad: Prisma.Decimal.Value }>): Map<string, Prisma.Decimal> {
  const totals = new Map<string, Prisma.Decimal>();
  for (const item of items) {
    if (!item.productId) continue;
    totals.set(item.productId, (totals.get(item.productId) ?? D(0)).plus(item.cantidad));
  }
  return totals;
}

/**
 * Descuento que falta registrar: lo que piden los ítems actuales (`desired`) menos lo que el libro ya descontó
 * para la orden (`consumed`, neto de devoluciones). Solo genera SALIDAS: si los ítems bajan o se quitan, el stock NO
 * se repone solo (el repuesto pudo haberse usado); lo que ya salió queda como excedente devolvible y se repone
 * únicamente con una devolución explícita (cantidad física recuperada, motivo y auditoría).
 * Considera la unión de los productos actuales y los de movimientos históricos de la orden.
 * Devuelve los movimientos ordenados por id de producto (orden de bloqueo uniforme: evita deadlocks).
 */
export function planOrderStockMovements(
  desired: Map<string, Prisma.Decimal>,
  consumed: Map<string, Prisma.Decimal>
): PlannedMovement[] {
  const ids = [...new Set([...desired.keys(), ...consumed.keys()])].sort();
  const plan: PlannedMovement[] = [];
  for (const productId of ids) {
    const faltante = (desired.get(productId) ?? D(0)).minus(consumed.get(productId) ?? D(0));
    if (faltante.isPositive() && !faltante.isZero()) plan.push({ productId, tipo: "SALIDA_ORDEN", cantidad: faltante.negated() });
  }
  return plan;
}

export interface OrderStockLine {
  productId: string;
  /** Lo que piden los ítems actuales de la orden. */
  solicitado: Prisma.Decimal;
  /** Lo descontado por la orden, neto de devoluciones. */
  consumido: Prisma.Decimal;
  /** Unidades ya descontadas que los ítems actuales no piden: es lo máximo que se puede devolver. */
  excedente: Prisma.Decimal;
}

/** Balance por producto de una orden (productos actuales + los de movimientos históricos). */
export function orderStockBalance(desired: Map<string, Prisma.Decimal>, consumed: Map<string, Prisma.Decimal>): OrderStockLine[] {
  const ids = [...new Set([...desired.keys(), ...consumed.keys()])].sort();
  return ids.map((productId) => {
    const solicitado = desired.get(productId) ?? D(0);
    const consumido = consumed.get(productId) ?? D(0);
    const sobra = consumido.minus(solicitado);
    return { productId, solicitado, consumido, excedente: sobra.isPositive() ? sobra : D(0) };
  });
}

/** SKU: sin espacios en los extremos y en mayúsculas. */
export function normalizeSku(value: string): string {
  return value.trim().toUpperCase();
}

export interface Shortage {
  nombre: string;
  unidad: string;
  disponible: Prisma.Decimal.Value;
  necesario: Prisma.Decimal.Value;
}

export function shortageMessage(shortages: Shortage[]): string {
  const detail = shortages
    .map((s) => `${s.nombre} (disponible ${formatQuantity(s.disponible, s.unidad)}, necesario ${formatQuantity(s.necesario, s.unidad)})`)
    .join("; ");
  return `Stock insuficiente: ${detail}. Cargá la compra o ajustá el stock e intentá de nuevo.`;
}

/** ¿El error es el rechazo del trigger de la base por stock insuficiente (SQLSTATE 23514)? */
export function isStockShortageError(error: unknown): boolean {
  const e = error as { message?: string; meta?: unknown } | null;
  if (!e) return false;
  return /Stock insuficiente/.test(`${e.message ?? ""} ${JSON.stringify(e.meta ?? {})}`);
}

export const MARGEN = (precioVenta: number, costo: number) => Math.round((precioVenta - costo + Number.EPSILON) * 100) / 100;
