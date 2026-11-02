// Levanta en el puerto 3002 la aplicación EXPORTADA de un commit (por defecto HEAD: el código ya desplegado), sin los cambios
// locales y sin ningún archivo .env, contra la base de QA. Sirve para probar que el código en producción sigue funcionando
// con un schema migrado (compatibilidad hacia atrás) con `npm run qa:e2e:compat`.
//
//   npm run qa:serve-head                       exporta HEAD
//   npm run qa:serve-head -- --ref <commit>     exporta otro commit
//
// IMPORTANTE: la exportación comparte node_modules con el proyecto, es decir, usa el cliente Prisma ya generado. Para probar
// el código viejo, el cliente generado debe ser el del código viejo (antes de `prisma generate` con el schema nuevo).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { root, target } from "./lib/common.mjs";

const refIdx = process.argv.indexOf("--ref");
const ref = refIdx === -1 ? "HEAD" : process.argv[refIdx + 1];
const out = path.join(os.tmpdir(), "automek-qa-export");
if (fs.existsSync(path.join(out, "node_modules"))) fs.rmSync(path.join(out, "node_modules")); // solo el enlace, nunca el contenido
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const archive = path.join(out, "export.tar");
execFileSync("git", ["archive", "--format=tar", `--output=${archive}`, ref], { cwd: root });
execFileSync("tar", ["-xf", archive, "-C", out]);
fs.rmSync(archive);
fs.symlinkSync(path.join(root, "node_modules"), path.join(out, "node_modules"), "junction");
const envFiles = fs.readdirSync(out).filter((f) => /^\.env(\.|$)/.test(f) && f !== ".env.example");
if (envFiles.length) throw new Error(`La exportación no debe contener archivos .env (${envFiles.join(", ")}).`);

console.log(`[QA] serve-head: ${ref} exportado en ${out} | endpoint=${target.endpoint} | app en http://localhost:3002`);
const child = spawn(process.execPath, [path.join(root, "node_modules", "next", "dist", "bin", "next"), "dev", "-p", "3002"], { cwd: out, env: process.env, stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
