// Verifica (solo lectura) que las migraciones de la base de QA coincidan con los archivos de prisma/migrations:
// nombres, orden, estado (terminadas, sin rollback ni errores) y checksum. También informa el estado del schema.
//
//   npm run qa:verify:migrations                      todas las migraciones de la carpeta
//   npm run qa:verify:migrations -- --until stock     solo las anteriores a la migración de Stock (base "pre-stock")
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { connectPg, createChecker, root, target } from "./lib/common.mjs";

const { check, section, finish } = createChecker();
const dir = path.join(root, "prisma", "migrations");
const untilIdx = process.argv.indexOf("--until");
const until = untilIdx === -1 ? null : process.argv[untilIdx + 1];
let expected = fs.readdirSync(dir).filter((d) => /^\d{14}_/.test(d) && fs.statSync(path.join(dir, d)).isDirectory()).sort();
if (until) expected = expected.slice(0, Math.max(0, expected.findIndex((d) => d.includes(until))));

const db = await connectPg({ appName: "qa-verify-migrations" });
await db.query("BEGIN READ ONLY");
console.log(`[QA] verify-migrations: endpoint=${target.endpoint} | esperadas: ${expected.length}${until ? ` (anteriores a "${until}")` : ""}`);

section("_prisma_migrations");
const rows = (await db.query(`SELECT migration_name, checksum, started_at, finished_at, rolled_back_at, applied_steps_count, logs FROM _prisma_migrations ORDER BY started_at, migration_name`)).rows;
const live = rows.filter((r) => !r.rolled_back_at);
const rolledBack = rows.filter((r) => r.rolled_back_at);
for (const r of live) {
  const ms = r.finished_at ? new Date(r.finished_at) - new Date(r.started_at) : null;
  console.log(`  ${r.migration_name}  pasos=${r.applied_steps_count}  duración=${ms}ms`);
}
check(live.length === expected.length, `${live.length} migraciones registradas (esperadas ${expected.length})`);
check(live.map((r) => r.migration_name).join() === expected.join(), "nombres y orden coinciden con los archivos");
check(live.every((r) => r.finished_at && r.logs === null && r.applied_steps_count === 1), "todas terminadas, sin errores y con 1 paso cada una");
for (const r of live) {
  const file = path.join(dir, r.migration_name, "migration.sql");
  const sha = fs.existsSync(file) ? crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") : null;
  check(sha === r.checksum, `checksum de ${r.migration_name} coincide con el archivo`);
}
if (rolledBack.length) console.log(`  (hay ${rolledBack.length} intento(s) fallido(s) ya marcado(s) como revertido(s): ${rolledBack.map((r) => r.migration_name).join(", ")})`);

section("Estado del schema");
const tables = (await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_type='BASE TABLE' ORDER BY 1`)).rows.map((t) => t.table_name);
const hasStock = tables.includes("products") && tables.includes("stock_movements");
if (until) check(!hasStock, "no existen tablas de Stock (migración de Stock NO aplicada)");
else check(hasStock, "existen las tablas de Stock");
const cantidad = (await db.query(`SELECT data_type FROM information_schema.columns WHERE table_schema = current_schema() AND table_name='quote_items' AND column_name='cantidad'`)).rows[0];
check(cantidad?.data_type === (until ? "integer" : "numeric"), `quote_items.cantidad es ${cantidad?.data_type}`);
const triggers = (await db.query(`SELECT count(*)::int n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace = current_schema()::regnamespace AND NOT t.tgisinternal`)).rows[0].n;
check(hasStock ? triggers === 7 : triggers === 0, `${triggers} triggers de integridad`);
const version = (await db.query(`SELECT current_setting('server_version') v`)).rows[0].v;
console.log(`  PostgreSQL ${version}; tablas: ${tables.length}`);

await db.query("ROLLBACK");
await db.end();
finish();
