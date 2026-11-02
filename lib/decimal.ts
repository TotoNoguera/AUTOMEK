import { Prisma } from "@prisma/client";

// Las cantidades y el stock son DECIMAL(12,3): Prisma las devuelve como Decimal (en vez de number). Para que las
// respuestas JSON de la API sigan entregando números, Decimal se serializa con toJSON.
//
// Alcance y garantías (verificados en lib/decimal.test.ts):
//  - Solo existen columnas Decimal en quote_items.cantidad, work_order_items.cantidad, products.stockActual/stockMinimo y
//    stock_movements.cantidad/stockResultante. Ningún otro módulo (dinero, caja, pagos) usa Decimal: el dinero sigue
//    siendo Float con round2. Un test falla si alguien agrega otra columna Decimal sin revisar este serializador.
//  - Sin pérdida de precisión: un double representa exactamente cualquier decimal de hasta 15 dígitos significativos
//    (DECIMAL(12,3) tiene como máximo 12). Si un valor superara ese límite, se serializa como TEXTO en vez de redondearlo.
export const MAX_SAFE_DIGITS = 15;

const PATCHED = Symbol.for("automek.decimal.toJSON");
const proto = Prisma.Decimal.prototype as unknown as { toJSON: (this: Prisma.Decimal) => number | string; [PATCHED]?: boolean };

if (!proto[PATCHED]) {
  proto.toJSON = function toJSON(this: Prisma.Decimal) {
    return this.sd(true) <= MAX_SAFE_DIGITS ? this.toNumber() : this.toString();
  };
  proto[PATCHED] = true;
}

export const D = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
