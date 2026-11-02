// Setup de las pruebas de integración: se niega a correr si no están bajo el runner de QA o si la conexión apunta a producción.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertQaProcess, collectProdTargets, parseEnv, parsePostgresUrl } from "./guard.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const prodMaps = [".env", ".env.local", ".env.production", ".env.production.local"].flatMap((name) => {
  try {
    return [parseEnv(fs.readFileSync(path.join(root, name), "utf8"))];
  } catch {
    return [];
  }
});
const prod = collectProdTargets(prodMaps);
const target = assertQaProcess(process.env, prod); // lanza si no es QA o si apunta a producción

// QA_VIA_POOLER=1: las pruebas usan la conexión con pooler (el mismo camino que producción)
if (process.env.QA_VIA_POOLER === "1") {
  const pooled = parsePostgresUrl(process.env.QA_DATABASE_URL_POOLED ?? "");
  if (!pooled.pooled || pooled.endpoint !== target.endpoint || prod.endpoints.has(pooled.endpoint)) {
    throw new Error("La conexión con pooler no corresponde al endpoint de QA fijado.");
  }
  process.env.DATABASE_URL = process.env.QA_DATABASE_URL_POOLED;
}
console.log(`[QA] pruebas de integración contra endpoint=${target.endpoint} vía ${process.env.QA_VIA_POOLER === "1" ? "POOLER" : "conexión directa"}`);
