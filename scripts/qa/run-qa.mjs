// Runner del entorno de QA. Uso (vía npm):
//   npm run qa:check                       valida el archivo y prueba la conexión (solo lectura)
//   npm run qa:pin                         fija el endpoint de QA en .env.qa-stock (una sola vez)
//   npm run qa:prisma -- migrate status    Prisma contra QA
//   npm run qa:dev | qa:test | qa:exec -- <comando>
// Todo proceso hijo recibe SOLO la conexión de QA; nunca se leen ni se usan las URLs de producción para conectarse.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { buildChildEnv, collectProdTargets, parseEnv, parsePostgresUrl, validateQaEnv } from "./guard.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(path.join(root, "package.json"));
const qaFile = process.env.AUTOMEK_QA_ENV_FILE ? path.resolve(process.env.AUTOMEK_QA_ENV_FILE) : path.join(root, ".env.qa-stock");

function readEnvFile(file) {
  try {
    return parseEnv(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function fail(lines) {
  console.error("\n[QA] Ejecución bloqueada:");
  for (const line of lines) console.error("  - " + line);
  process.exit(1);
}

const args = process.argv.slice(2);
const sep = args.indexOf("--");
const flags = sep === -1 ? args : args.slice(0, sep);
const command = sep === -1 ? [] : args.slice(sep + 1);

const qa = readEnvFile(qaFile);
if (!qa) fail([`No se encontró ${path.basename(qaFile)}. Copiá .env.qa-stock.example y completá la conexión de AUTOMEK-QA.`]);

// Solo para comparar: a qué apunta producción según los .env del proyecto
const prodSources = [".env", ".env.local", ".env.production", ".env.production.local"]
  .map((name) => readEnvFile(path.join(root, name)))
  .filter(Boolean);
const prod = collectProdTargets(prodSources);

// --pin: fija el endpoint de QA, pero solo si todo lo demás es válido
if (flags.includes("--pin")) {
  let target;
  try {
    target = parsePostgresUrl(qa.DATABASE_URL ?? "");
  } catch (error) {
    fail([`DATABASE_URL ${error.message}.`]);
  }
  const probe = validateQaEnv({ ...qa, AUTOMEK_QA_ENDPOINT: target.endpoint }, prod);
  if (!probe.ok) fail(probe.errors);
  let text = fs.readFileSync(qaFile, "utf8");
  if (/^AUTOMEK_QA_ENDPOINT=.*$/m.test(text)) text = text.replace(/^AUTOMEK_QA_ENDPOINT=.*$/m, `AUTOMEK_QA_ENDPOINT=${target.endpoint}`);
  else text += `\nAUTOMEK_QA_ENDPOINT=${target.endpoint}\n`;
  fs.writeFileSync(qaFile, text);
  console.log(`[QA] Endpoint de QA fijado: ${target.endpoint} (base ${target.database}).`);
  process.exit(0);
}

const result = validateQaEnv(qa, prod);
if (!result.ok) fail(result.errors);

const childEnv = buildChildEnv(process.env, qa);
// QA_VIA_POOLER=1: la aplicación y las pruebas usan la conexión con pooler (el mismo camino que producción).
// validateQaEnv ya verificó que sea del mismo endpoint de QA y distinta de producción.
const viaPooler = process.env.QA_VIA_POOLER === "1";
if (viaPooler) {
  if (!qa.DATABASE_URL_POOLED) fail(["QA_VIA_POOLER=1 requiere DATABASE_URL_POOLED en el archivo de QA."]);
  childEnv.DATABASE_URL = qa.DATABASE_URL_POOLED;
}
console.log(
  `[QA] Destino: endpoint=${result.info.endpoint} base=${result.info.database} schema=${result.info.schema} | ` +
    `producción excluida (${prod.endpoints.size} endpoint/s detectados)${viaPooler ? " | VÍA POOLER" : ""}`
);

function run(file, fileArgs, { shell = false } = {}) {
  const child = spawn(file, fileArgs, { cwd: root, env: childEnv, stdio: "inherit", shell });
  child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
  child.on("error", (error) => fail([`No se pudo ejecutar el comando: ${error.message}`]));
}

if (flags.includes("--check")) {
  run(process.execPath, [path.join(root, "scripts", "qa", "ping.mjs")]);
} else if (command.length > 0) {
  const [bin, ...rest] = command;
  // Los binarios del proyecto se ejecutan con node para evitar shells y .cmd
  const known = {
    prisma: "prisma/build/index.js",
    next: "next/dist/bin/next",
    vitest: "vitest/vitest.mjs",
  };
  // Se resuelve por ruta de archivo: algunos paquetes (vitest) no exponen sus binarios en "exports"
  if (known[bin]) run(process.execPath, [path.join(root, "node_modules", known[bin]), ...rest]);
  else if (bin === "node") run(process.execPath, rest);
  else run(bin, rest, { shell: process.platform === "win32" });
} else {
  fail(["Indicá --check, --pin o un comando después de '--'."]);
}
