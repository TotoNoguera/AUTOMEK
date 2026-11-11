// Alta idempotente de un taller independiente con su usuario administrador.
//
//   ACCOUNT_EMAIL=... ACCOUNT_PASSWORD=... TALLER_NOMBRE="..." [ACCOUNT_NAME="..."] \
//   DATABASE_URL=... ACCOUNTS_EXPECT_ENDPOINT=ep-... node scripts/accounts/provision.mjs [--apply]
//
// Sin --apply solo muestra qué haría (no escribe). Reglas:
//  - Si el email ya existe NO se crea nada nuevo ni se cambia su contraseña (salvo --reset-password).
//  - Un usuario queda vinculado a UN solo taller (la app resuelve el taller con el primer vínculo del usuario).
//  - ACCOUNT_NAME es el nombre de la PERSONA (se usa en el saludo y en la barra); es obligatorio al crear y nunca se toma del nombre del taller.
//  - --update-name cambia el nombre de la persona de un usuario existente (ACCOUNT_NAME).
//  - --update-taller actualiza nombre / logo / contacto del taller de ese usuario (TALLER_NOMBRE, TALLER_LOGO...).
//  - Nunca toca talleres protegidos (MT Mecánica) ni usuarios sin exactamente un taller.
//  - La contraseña llega por variable de entorno, se guarda solo como hash bcrypt y no se imprime ni se registra.
import { connect, hashPassword, isEmail, isProtectedTaller, normalizeEmail } from "./lib.mjs";

const apply = process.argv.includes("--apply");
const updateTaller = process.argv.includes("--update-taller");
const resetPassword = process.argv.includes("--reset-password");
const updateName = process.argv.includes("--update-name");
const email = normalizeEmail(process.env.ACCOUNT_EMAIL);
const password = process.env.ACCOUNT_PASSWORD;
const tallerNombre = process.env.TALLER_NOMBRE?.trim();
const userName = process.env.ACCOUNT_NAME?.trim();

if (!isEmail(email)) throw new Error("ACCOUNT_EMAIL ausente o inválido.");
// El logo es una ruta propia (/logos/archivo.ext) o una URL https. En Git Bash para Windows, anteponé MSYS_NO_PATHCONV=1:
// de lo contrario "/logos/x.png" se convierte en una ruta de disco y se rechaza acá.
if (process.env.TALLER_LOGO && !/^(\/logos\/[\w.-]+|https:\/\/\S+)$/.test(process.env.TALLER_LOGO)) throw new Error(`TALLER_LOGO inválido: "${process.env.TALLER_LOGO}". Usá /logos/archivo.png o una URL https.`);
const { db, endpoint, database, pooled } = connect();
console.log(`[accounts] destino: endpoint=${endpoint} base=${database} conexión=${pooled ? "pooler" : "directa"} | modo=${apply ? "APLICAR" : "simulación"}`);

try {
  const existing = await db.user.findUnique({ where: { email }, include: { userTallers: { include: { taller: true } } } });

  if (existing) {
    console.log(`[accounts] el usuario ${email} YA EXISTE (id ${existing.id}); no se crea otro.`);
    if (existing.userTallers.length !== 1) throw new Error(`El usuario tiene ${existing.userTallers.length} talleres vinculados; se esperaba exactamente 1. Detenido.`);
    const taller = existing.userTallers[0].taller;
    console.log(`[accounts] taller vinculado: "${taller.nombre}" (id ${taller.id})`);
    if (isProtectedTaller(taller.nombre) && (updateTaller || resetPassword || updateName)) throw new Error("Taller protegido: este script no lo modifica.");

    if (updateTaller) {
      const data = {};
      if (tallerNombre) data.nombre = tallerNombre;
      if (process.env.TALLER_LOGO !== undefined) data.logo = process.env.TALLER_LOGO || null;
      if (process.env.TALLER_TELEFONO !== undefined) data.telefono = process.env.TALLER_TELEFONO || null;
      if (process.env.TALLER_DIRECCION !== undefined) data.direccion = process.env.TALLER_DIRECCION || null;
      console.log(`[accounts] actualización de taller: ${Object.keys(data).join(", ") || "(sin cambios)"}`);
      if (apply && Object.keys(data).length) {
        await db.taller.update({ where: { id: taller.id }, data });
        console.log("[accounts] taller actualizado.");
      }
    }
    if (updateName) {
      if (!userName) throw new Error("--update-name requiere ACCOUNT_NAME.");
      console.log(`[accounts] nombre de la persona: "${existing.name}" -> "${userName}"`);
      if (apply && existing.name !== userName) {
        await db.user.update({ where: { id: existing.id }, data: { name: userName } });
        console.log("[accounts] nombre actualizado.");
      }
    }
    if (resetPassword) {
      if (!password) throw new Error("--reset-password requiere ACCOUNT_PASSWORD.");
      console.log("[accounts] se reemplazará la contraseña (solo el hash).");
      if (apply) {
        await db.user.update({ where: { id: existing.id }, data: { password: await hashPassword(db, password) } });
        console.log("[accounts] contraseña reemplazada.");
      }
    }
  } else {
    if (!password || password.length < 8) throw new Error("ACCOUNT_PASSWORD ausente o demasiado corta (mínimo 8 caracteres).");
    if (!tallerNombre) throw new Error("TALLER_NOMBRE es requerido para crear un taller nuevo.");
    if (!userName) throw new Error("ACCOUNT_NAME (nombre de la persona, p. ej. María) es requerido para crear un usuario nuevo.");
    if (isProtectedTaller(tallerNombre)) throw new Error("Ese nombre de taller está reservado.");
    const sameName = await db.taller.count({ where: { nombre: tallerNombre } });
    if (sameName > 0) throw new Error(`Ya existe un taller llamado "${tallerNombre}": se detiene para no duplicar. Usá otro nombre o creá el usuario sobre ese taller manualmente.`);
    console.log(`[accounts] se creará: taller "${tallerNombre}" + usuario ${email} (admin) vinculado solo a ese taller.`);
    if (apply) {
      const hash = await hashPassword(db, password);
      const created = await db.$transaction(async (tx) => {
        const taller = await tx.taller.create({ data: { nombre: tallerNombre, logo: process.env.TALLER_LOGO || null, telefono: process.env.TALLER_TELEFONO || null, direccion: process.env.TALLER_DIRECCION || null } });
        const user = await tx.user.create({ data: { email, name: userName, password: hash } });
        await tx.userTaller.create({ data: { userId: user.id, tallerId: taller.id, role: "admin" } });
        return { taller, user };
      });
      console.log(`[accounts] creado: taller ${created.taller.id}, usuario ${created.user.id}.`);
    }
  }
  if (!apply) console.log("[accounts] simulación: no se escribió nada. Agregá --apply para ejecutar.");
} finally {
  await db.$disconnect();
}
