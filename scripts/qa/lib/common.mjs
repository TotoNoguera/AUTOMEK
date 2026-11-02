// Utilidades compartidas por los scripts de QA. Importarlo ejecuta el guardarraíl: si el proceso no fue lanzado por el
// runner de QA (npm run qa:*) o la conexión apunta a producción, lanza un error antes de hacer nada.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { assertQaProcess, collectProdTargets, parseEnv, parsePostgresUrl } from "../guard.mjs";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const requireFromRoot = createRequire(path.join(root, "package.json"));

const prodMaps = [".env", ".env.local", ".env.production", ".env.production.local"].flatMap((name) => {
  try {
    return [parseEnv(fs.readFileSync(path.join(root, name), "utf8"))];
  } catch {
    return [];
  }
});
export const target = assertQaProcess(process.env, collectProdTargets(prodMaps));

/** QA_VIA_POOLER=1: las conexiones van por el pooler (el mismo camino que usa producción). */
export const viaPooler = process.env.QA_VIA_POOLER === "1";
export const connectionString = (() => {
  const url = viaPooler ? process.env.QA_DATABASE_URL_POOLED : process.env.DATABASE_URL;
  if (!url) throw new Error("Falta la conexión de QA (DATABASE_URL_POOLED si usás QA_VIA_POOLER=1).");
  const parsed = parsePostgresUrl(url);
  if (parsed.endpoint !== target.endpoint || (viaPooler && !parsed.pooled)) {
    throw new Error("La conexión no corresponde al endpoint de QA fijado.");
  }
  return url;
})();

export const BASE_URL = process.env.QA_APP_URL ?? "http://localhost:3002";
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const randomHex = (bytes = 3) => crypto.randomBytes(bytes).toString("hex");
export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export const todayAR = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());

// ---------------------------------------------------------------------------------------------------------------
// Base de datos
// ---------------------------------------------------------------------------------------------------------------

/** Cliente Prisma contra la base de QA. */
export function createPrisma() {
  const { PrismaClient } = requireFromRoot("@prisma/client");
  return new PrismaClient({ datasourceUrl: connectionString, log: ["error"] });
}

/** Conexión `pg` nueva e independiente (para pruebas de concurrencia y de triggers). `schema` fija el search_path. */
export async function connectPg({ schema, appName = "automek-qa" } = {}) {
  const { Client } = requireFromRoot("pg");
  // Mismo comportamiento que sslmode=require en pg actual (verificación completa), declarado de forma explícita
  const client = new Client({ connectionString: connectionString.replace("sslmode=require", "sslmode=verify-full"), application_name: appName });
  client.on("error", () => {});
  await client.connect();
  if (schema) await client.query(`SET search_path TO "${schema}"`);
  return client;
}

/** Divide un script SQL en sentencias respetando los cuerpos $$ ... $$ y descartando comentarios de línea. */
export function splitSql(sql) {
  const text = sql.split(/\r?\n/).filter((l) => !l.trim().startsWith("--")).join("\n");
  const out = [];
  let cur = "";
  let inDollar = false;
  for (let i = 0; i < text.length; i++) {
    if (text.startsWith("$$", i)) { inDollar = !inDollar; cur += "$$"; i++; continue; }
    if (text[i] === ";" && !inDollar) { if (cur.trim()) out.push(cur.trim()); cur = ""; continue; }
    cur += text[i];
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Cliente HTTP con sesión (NextAuth credentials) contra la aplicación que escucha en BASE_URL
// ---------------------------------------------------------------------------------------------------------------

/**
 * Inicia sesión con una cuenta de QA. La contraseña se genera al azar EN MEMORIA y se guarda solo como hash en la base de
 * QA: nunca se imprime ni se escribe en archivos.
 */
export async function loginAs(prisma, email) {
  const bcrypt = requireFromRoot("bcrypt");
  const password = crypto.randomBytes(18).toString("base64url");
  await prisma.user.update({ where: { email }, data: { password: await bcrypt.hash(password, 10) } });
  const jar = new Map();
  const store = (res) => {
    for (const c of res.headers.getSetCookie()) {
      const kv = c.split(";")[0];
      const i = kv.indexOf("=");
      jar.set(kv.slice(0, i), kv.slice(i + 1));
    }
  };
  const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  let res = await fetch(BASE_URL + "/api/auth/csrf");
  store(res);
  const { csrfToken } = await res.json();
  res = await fetch(BASE_URL + "/api/auth/callback/credentials", {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookie() },
    body: new URLSearchParams({ csrfToken, email, password }),
  });
  store(res);
  const session = await fetch(BASE_URL + "/api/auth/session", { headers: { cookie: cookie() } }).then((r) => r.json());
  if (session?.user?.email !== email) throw new Error(`No se pudo iniciar sesión como ${email}: ¿está la aplicación de QA corriendo en ${BASE_URL}? (npm run qa:dev)`);

  const statuses = {};
  const api = async (method, urlPath, body) => {
    const r = await fetch(BASE_URL + urlPath, {
      method,
      headers: { "content-type": "application/json", cookie: cookie() },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    statuses[r.status] = (statuses[r.status] ?? 0) + 1;
    let d = null;
    try { d = await r.json(); } catch { /* sin cuerpo */ }
    return { s: r.status, d };
  };
  api.userId = session.user.id;
  api.statuses = statuses;
  return api;
}

// ---------------------------------------------------------------------------------------------------------------
// Verificaciones con salida legible
// ---------------------------------------------------------------------------------------------------------------

export function createChecker() {
  let pass = 0;
  let fail = 0;
  const failures = [];
  return {
    check(cond, name, extra = "") {
      if (cond) pass++;
      else { fail++; failures.push(`${name}${extra ? ` [${String(extra).slice(0, 160)}]` : ""}`); }
      console.log(`  ${cond ? "OK   " : "FALLA"} ${name}${!cond && extra ? `  [${String(extra).slice(0, 160)}]` : ""}`);
      return cond;
    },
    info: (text) => console.log(`  INFO  ${text}`),
    section: (title) => console.log(`\n== ${title}`),
    /** Imprime el resumen y fija el código de salida del proceso. */
    finish() {
      console.log(`\nPRUEBAS: ${pass} OK, ${fail} FALLAS`);
      if (failures.length) console.log("FALLAS:\n - " + failures.join("\n - "));
      process.exitCode = fail ? 1 : 0;
      return { pass, fail };
    },
  };
}

/** Lanza `n` tareas con conexiones independientes que arrancan a la vez (barrera común). */
export async function race(n, makeConnection, task) {
  const conns = await Promise.all(Array.from({ length: n }, (_, i) => makeConnection(i)));
  let go;
  const gate = new Promise((resolve) => (go = resolve));
  const runs = conns.map((c, i) => gate.then(() => task(c, i)).then((value) => ({ ok: true, value }), (error) => ({ ok: false, error })));
  await sleep(150);
  const t0 = Date.now();
  go();
  const results = await Promise.all(runs);
  const ms = Date.now() - t0;
  await Promise.all(conns.map((c) => c.end?.() ?? c.$disconnect?.()));
  return { results, ms };
}
