/** Redondea a centavos para evitar residuos de coma flotante (9000.970000000001). */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Saldo pendiente de una orden a partir de su total y los pagos efectivamente cobrados. */
export function pendingAmount(total: number, payments: Array<{ monto: number; status: string }>): number {
  const paid = payments.filter((p) => p.status === "PAGADO").reduce((sum, p) => sum + p.monto, 0);
  return round2(total - paid);
}
