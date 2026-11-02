// Sonda de bloqueos y tiempos de la migración de Stock en un SCHEMA DESCARTABLE de QA con las migraciones anteriores ya
// aplicadas. Ejecuta el SQL real dentro de una transacción, mide cada sentencia, lista los bloqueos que quedan tomados,
// prueba qué puede hacer otra conexión mientras tanto y termina con ROLLBACK (no deja nada).
//
// Preparación (ver scripts/qa/README.md): un archivo de entorno de QA cuya DATABASE_URL termine en `&schema=lock_probe`, y las
// migraciones anteriores aplicadas en ese schema con `migrate deploy`. Uso:
//   AUTOMEK_QA_ENV_FILE=.env.qa-probe npm run qa:lock-probe
import fs from "node:fs";
import path from "node:path";
import { connectPg, root, splitSql, target } from "./lib/common.mjs";

const schema = target.schema;
if (schema === "public") throw new Error("La sonda solo corre en un schema descartable (DATABASE_URL con schema=lock_probe), nunca en public.");
const dir = path.join(root, "prisma", "migrations");
const stockDir = fs.readdirSync(dir).find((d) => d.includes("stock_productos"));
if (!stockDir) throw new Error("No se encontró la migración de Stock en prisma/migrations.");
const statements = splitSql(fs.readFileSync(path.join(dir, stockDir, "migration.sql"), "utf8"));
console.log(`[QA] lock-probe: endpoint=${target.endpoint} schema=${schema} | sentencias: ${statements.length}`);

const migrator = await connectPg({ schema, appName: "qa-migracion" });
const observer = await connectPg({ schema, appName: "qa-observador" });
const probe = async (label, query) => {
  const t0 = Date.now();
  try {
    await observer.query("BEGIN");
    await observer.query("SET LOCAL lock_timeout = '700ms'");
    await observer.query(query);
    await observer.query("ROLLBACK");
    return { label, resultado: "pasa", ms: Date.now() - t0 };
  } catch (e) {
    await observer.query("ROLLBACK").catch(() => {});
    return { label, resultado: /lock timeout/i.test(e.message) ? "BLOQUEADA" : `error: ${e.message.slice(0, 60)}`, ms: Date.now() - t0 };
  }
};

const timings = [];
const probes = [];
const started = Date.now();
await migrator.query("BEGIN");
for (const sql of statements) {
  const t0 = process.hrtime.bigint();
  await migrator.query(sql);
  timings.push({ ms: Number(process.hrtime.bigint() - t0) / 1e6, sql: sql.replace(/\s+/g, " ").slice(0, 78) });
  if (/ALTER TABLE "work_order_items" ADD COLUMN/.test(sql)) {
    probes.push(await probe("leer quote_items", "SELECT count(*) FROM quote_items"));
    probes.push(await probe("escribir quote_items", "UPDATE quote_items SET cantidad = cantidad WHERE false"));
    probes.push(await probe("leer clients", "SELECT count(*) FROM clients"));
    probes.push(await probe("escribir clients", "UPDATE clients SET nombre = nombre WHERE false"));
  }
}
const total = Date.now() - started;
const locks = (await migrator.query(
  `SELECT c.relname, l.mode FROM pg_locks l JOIN pg_class c ON c.oid = l.relation JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE l.pid = pg_backend_pid() AND n.nspname = $1 AND c.relkind = 'r' AND l.granted ORDER BY c.relname, l.mode`, [schema])).rows;
probes.push(await probe("leer work_orders", "SELECT count(*) FROM work_orders"));
probes.push(await probe("escribir work_orders", "UPDATE work_orders SET total = total WHERE false"));
probes.push(await probe("escribir tallers", "UPDATE tallers SET nombre = nombre WHERE false"));
probes.push(await probe("escribir users", "UPDATE users SET name = name WHERE false"));
await migrator.query("ROLLBACK");

timings.sort((a, b) => b.ms - a.ms);
console.log(`\nDuración total de las ${statements.length} sentencias en una transacción: ${total} ms (incluye la latencia de red por sentencia)`);
console.log("Sentencias más lentas:");
for (const t of timings.slice(0, 5)) console.log(`  ${t.ms.toFixed(0).padStart(5)} ms  ${t.sql}`);
const strong = locks.filter((l) => !/^(AccessShareLock|RowExclusiveLock)$/.test(l.mode));
const byMode = {};
for (const l of strong) (byMode[l.mode] ??= []).push(l.relname);
console.log("\nBloqueos fuertes tomados (se mantienen hasta el COMMIT):");
for (const [mode, rels] of Object.entries(byMode)) console.log(`  ${mode}: ${rels.join(", ")}`);
console.log("\nQué puede hacer otra conexión mientras la migración está abierta (lock_timeout 700 ms):");
for (const p of probes) console.log(`  ${p.resultado.padEnd(10)} ${p.label}  (${p.ms} ms)`);
const left = (await observer.query(`SELECT count(*)::int n FROM information_schema.tables WHERE table_schema=$1 AND table_name IN ('products','stock_movements')`, [schema])).rows[0].n;
console.log(`\nTras el ROLLBACK, tablas de Stock en ${schema}: ${left} (debe ser 0)`);
process.exitCode = left === 0 ? 0 : 1;
await migrator.end();
await observer.end();
