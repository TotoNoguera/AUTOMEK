// Utilidades de los scripts de alta de talleres y cuentas. Nunca imprimen contraseñas ni hashes.
//
// El destino se declara de forma EXPLÍCITA por variables de entorno (no se leen los .env del proyecto):
//   DATABASE_URL              cadena de conexión (para producción: la DIRECTA, sin -pooler)
//   ACCOUNTS_EXPECT_ENDPOINT  endpoint de Neon esperado; si no coincide con la URL, el script se detiene
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const requireFromRoot = createRequire(path.join(root, "package.json"));
const { PrismaClient } = requireFromRoot("@prisma/client");
const bcrypt = requireFromRoot("bcrypt");

export function connect() {
  const url = process.env.DATABASE_URL;
  const expected = process.env.ACCOUNTS_EXPECT_ENDPOINT;
  if (!url) throw new Error("Falta DATABASE_URL.");
  if (!expected) throw new Error("Falta ACCOUNTS_EXPECT_ENDPOINT (endpoint de Neon esperado, ej. ep-xxxx-xxxx-xxxxxxxx).");
  const parsed = new URL(url);
  const endpoint = parsed.hostname.split(".")[0].replace(/-pooler$/, "");
  if (endpoint !== expected) throw new Error(`El endpoint de DATABASE_URL (${endpoint}) no coincide con ACCOUNTS_EXPECT_ENDPOINT (${expected}). Detenido.`);
  const db = new PrismaClient({ datasourceUrl: url, log: ["error"] });
  return { db, endpoint, database: parsed.pathname.slice(1), pooled: /-pooler/.test(parsed.hostname) };
}

/** Hash con bcrypt, el mismo que usa el login (lib/auth.ts). Se reutiliza el costo de las cuentas existentes. */
export async function hashPassword(db, plain) {
  const sample = await db.user.findFirst({ select: { password: true }, orderBy: { createdAt: "asc" } });
  let rounds = 10;
  try {
    if (sample) rounds = bcrypt.getRounds(sample.password);
  } catch {
    /* hash con formato desconocido: costo por defecto */
  }
  return bcrypt.hash(plain, rounds);
}

export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

/** Id con formato cuid (los endpoints validan ids con z.string().cuid()). */
export const cid = () => "c" + crypto.randomBytes(12).toString("hex");

export const normalizeEmail = (value) => String(value ?? "").trim().toLowerCase();
export const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/** Taller de un cliente real que estos scripts nunca deben modificar. */
export const isProtectedTaller = (nombre) => /mt\s*mec/i.test(nombre ?? "");

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Fechas en hora argentina (sin horario de verano: UTC-3)
export const todayAR = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
export function addDays(ymd, n) {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const dayOfWeek = (ymd) => new Date(`${ymd}T12:00:00Z`).getUTCDay(); // 0 = domingo
export const at = (ymd, h, m = 0) => new Date(`${ymd}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00-03:00`);
export const closeDate = (ymd) => new Date(`${ymd}T00:00:00.000Z`);
