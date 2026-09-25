// Todas las nociones de "hoy", "mes" y "día de caja" son del calendario argentino,
// sin importar la zona horaria del servidor (Vercel corre en UTC) ni la del navegador.
export const APP_TIMEZONE = "America/Argentina/Buenos_Aires";

const wallClockFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function wallClock(instant: Date): Record<string, string> {
  const parts: Record<string, string> = {};
  for (const p of wallClockFormat.formatToParts(instant)) parts[p.type] = p.value;
  return parts;
}

/** YYYY-MM-DD del calendario argentino para un instante dado. */
export function dateStringAR(instant: Date = new Date()): string {
  const p = wallClock(instant);
  return `${p.year}-${p.month}-${p.day}`;
}

export function todayAR(): string {
  return dateStringAR(new Date());
}

/** Diferencia (ms) entre la hora de pared argentina y UTC en un instante. */
function offsetMs(instant: Date): number {
  const p = wallClock(instant);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - (instant.getTime() - instant.getUTCMilliseconds());
}

export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Suma días a un YYYY-MM-DD (aritmética de calendario, sin zona horaria). */
export function addDays(value: string, days: number): string {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Instante UTC en que empieza el día argentino `value` (00:00 hora argentina). */
export function startOfDayAR(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d, 0, 0, 0);
  let instant = wall - offsetMs(new Date(wall));
  instant = wall - offsetMs(new Date(instant));
  return new Date(instant);
}

/** Rango [start, end) en UTC que cubre exactamente el día argentino `value`. */
export function dayRangeAR(value: string): { start: Date; end: Date } {
  return { start: startOfDayAR(value), end: startOfDayAR(addDays(value, 1)) };
}

/** Rango [start, end) en UTC que cubre el mes calendario argentino (month: 1-12). */
export function monthRangeAR(year: number, month: number): { start: Date; end: Date } {
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const next = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  return { start: startOfDayAR(first), end: startOfDayAR(next) };
}

/** Año y mes (1-12) del calendario argentino para un instante dado. */
export function yearMonthAR(instant: Date = new Date()): { year: number; month: number } {
  const [y, m] = dateStringAR(instant).split("-").map(Number);
  return { year: y, month: m };
}

/** Texto largo del día de hoy (ej. "viernes, 25 de septiembre") en hora argentina. */
export function formatTodayLongAR(): string {
  return new Date().toLocaleDateString("es-AR", {
    timeZone: APP_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Desplaza (año, mes 1-12) en `delta` meses; delta negativo va hacia atrás. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** Fecha (día/mes/año) de un instante, en hora argentina. */
export function formatDateAR(value: string | Date): string {
  return new Date(value).toLocaleDateString("es-AR", { timeZone: APP_TIMEZONE });
}

/** Fecha y hora de un instante, en hora argentina. */
export function formatDateTimeAR(value: string | Date): string {
  return new Date(value).toLocaleString("es-AR", { timeZone: APP_TIMEZONE });
}

/** Para campos "solo fecha" guardados a las 00:00 UTC (turnos, cierres): muestra ese día sin correrlo por zona horaria. */
export function formatDateOnly(value: string): string {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-AR", { timeZone: "UTC" });
}
