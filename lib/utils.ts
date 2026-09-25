import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ars = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Importe en pesos con formato argentino: $ 1.234,50 (negativos: -$ 1.234,50). Nunca devuelve NaN. */
export function formatCurrency(value: number): string {
  return ars.format(Number.isFinite(value) ? value : 0);
}
