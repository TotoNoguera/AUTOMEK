// Unidades de medida y formato de cantidades. Sin dependencias: se usa tanto en el servidor como en el navegador.

export const PRODUCT_UNIT_OPTIONS = [
  { value: "UNIDAD", label: "Unidad", short: "u." },
  { value: "LITRO", label: "Litro", short: "L" },
  { value: "KILO", label: "Kilo", short: "kg" },
  { value: "METRO", label: "Metro", short: "m" },
  { value: "JUEGO", label: "Juego", short: "juego(s)" },
  { value: "PAR", label: "Par", short: "par(es)" },
] as const;

const SHORT: Record<string, string> = Object.fromEntries(PRODUCT_UNIT_OPTIONS.map((u) => [u.value, u.short]));

export const unitShort = (unidad?: string | null) => (unidad ? (SHORT[unidad] ?? "") : "");

/** Cantidad con formato argentino y hasta 3 decimales (2,5 · 1.250,125), opcionalmente con la unidad: "3,5 L". */
export function formatQuantity(value: number | string | { toString(): string }, unidad?: string | null): string {
  const n = Number(value);
  const text = (Number.isFinite(n) ? n : 0).toLocaleString("es-AR", { maximumFractionDigits: 3 });
  const unit = unitShort(unidad);
  return unit ? `${text} ${unit}` : text;
}
