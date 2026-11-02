// Verifica la conexión de QA con consultas de SOLO LECTURA (transacción READ ONLY). No imprime credenciales.
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { assertQaProcess, collectProdTargets, parseEnv } from "./guard.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(path.join(root, "package.json"));
const { PrismaClient } = require("@prisma/client");

const prodSources = [".env", ".env.local", ".env.production", ".env.production.local"].flatMap((name) => {
  try {
    return [parseEnv(fs.readFileSync(path.join(root, name), "utf8"))];
  } catch {
    return [];
  }
});
assertQaProcess(process.env, collectProdTargets(prodSources));

const db = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL, log: ["error"] });
const started = Date.now();
try {
  const info = await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    const [row] = await tx.$queryRawUnsafe(`
      SELECT current_setting('server_version') AS version,
             current_setting('server_version_num')::int AS version_num,
             current_database() AS database,
             current_schema() AS schema,
             current_setting('server_encoding') AS encoding,
             (SELECT datcollate FROM pg_database WHERE datname = current_database()) AS collate,
             current_setting('TimeZone') AS timezone,
             current_setting('max_connections')::int AS max_connections,
             current_setting('transaction_read_only') AS read_only
    `);
    const extensions = await tx.$queryRawUnsafe("SELECT extname FROM pg_extension ORDER BY 1");
    const [tables] = await tx.$queryRawUnsafe(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'"
    );
    const [history] = await tx.$queryRawUnsafe("SELECT to_regclass('_prisma_migrations') IS NOT NULL AS exists");
    return { ...row, extensions: extensions.map((e) => e.extname), tables: tables.n, hasMigrationsTable: history.exists };
  });

  const major = Math.floor(info.version_num / 10000);
  console.log(`[QA] Conexión OK en ${Date.now() - started} ms (transacción de solo lectura: ${info.read_only}).`);
  console.log(`[QA] PostgreSQL ${info.version} (mayor ${major}) | base=${info.database} schema=${info.schema}`);
  console.log(`[QA] encoding=${info.encoding} collate=${info.collate} timezone=${info.timezone} max_connections=${info.max_connections}`);
  console.log(`[QA] extensiones: ${info.extensions.join(", ")}`);
  console.log(`[QA] tablas en el schema: ${info.tables} | _prisma_migrations: ${info.hasMigrationsTable ? "existe" : "no existe"}`);

  const expected = process.env.AUTOMEK_QA_PG_MAJOR;
  if (expected && Number(expected) !== major) {
    console.error(`[QA] La versión mayor de PostgreSQL (${major}) NO coincide con la de producción (${expected}).`);
    process.exitCode = 1;
  } else if (expected) {
    console.log(`[QA] La versión mayor coincide con producción (${expected}).`);
  }
} catch (error) {
  console.error(`[QA] No se pudo conectar: ${String(error.message).split("\n").pop()}`);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
