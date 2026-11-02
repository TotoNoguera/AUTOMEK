// Guardarraíles del entorno de QA. Sin dependencias: se usa desde los scripts de QA y desde las pruebas.
// Nunca devuelve ni imprime contraseñas: solo endpoint, base y schema.

const URL_RE = /postgres(?:ql)?:\/\/[^\s"']+/g;

/** Lee el contenido de un archivo .env (KEY=valor, comentarios #, comillas opcionales). */
export function parseEnv(text) {
  const out = {};
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    const quoted = value.match(/^(["'])(.*?)\1(?:\s+#.*)?$/);
    if (quoted) {
      value = quoted[2];
    } else {
      value = value.replace(/\s+#.*$/, "");
    }
    out[m[1]] = value;
  }
  return out;
}

/** Descompone una URL de Postgres. El endpoint de Neon es la primera parte del host, sin "-pooler". */
export function parsePostgresUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("no es una URL válida");
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") throw new Error("el protocolo debe ser postgresql://");
  if (!url.hostname) throw new Error("falta el host");
  const label = url.hostname.split(".")[0].toLowerCase();
  return {
    host: url.hostname.toLowerCase(),
    endpoint: label.replace(/-pooler$/, ""),
    pooled: /-pooler$/.test(label),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    schema: url.searchParams.get("schema") ?? "public",
    hasCredentials: Boolean(url.username && url.password),
  };
}

/**
 * Identifica a qué apunta producción a partir de los archivos .env del proyecto (mapas ya parseados):
 * endpoints y hosts de cualquier URL de Postgres, y los secretos (para que QA no comparta ninguno).
 */
export function collectProdTargets(envMaps) {
  const endpoints = new Set();
  const hosts = new Set();
  const secrets = new Set();
  for (const env of envMaps) {
    for (const [key, value] of Object.entries(env)) {
      if (typeof value !== "string" || !value) continue;
      for (const found of value.match(URL_RE) ?? []) {
        try {
          const parsed = parsePostgresUrl(found);
          endpoints.add(parsed.endpoint);
          hosts.add(parsed.host);
        } catch {
          // URL rara: se ignora
        }
      }
      if (/SECRET$/.test(key)) secrets.add(value);
    }
  }
  return { endpoints, hosts, secrets };
}

/** Valida el archivo de QA contra lo que usa producción. `errors` vacío = se puede ejecutar. */
export function validateQaEnv(qa, prod) {
  const errors = [];
  let direct = null;

  if (qa.AUTOMEK_ENV !== "qa") errors.push("AUTOMEK_ENV debe ser 'qa'.");

  if (!qa.DATABASE_URL) {
    errors.push("DATABASE_URL está vacío: falta la cadena de conexión directa de AUTOMEK-QA.");
  } else {
    try {
      direct = parsePostgresUrl(qa.DATABASE_URL);
    } catch (error) {
      errors.push(`DATABASE_URL ${error.message}.`);
    }
  }

  if (direct) {
    if (!direct.hasCredentials) errors.push("DATABASE_URL no incluye usuario y contraseña.");
    if (direct.pooled) errors.push("DATABASE_URL debe ser la conexión directa (host sin '-pooler'): Prisma Migrate y las pruebas de bloqueos la requieren.");
    if (prod.endpoints.has(direct.endpoint) || prod.hosts.has(direct.host)) {
      errors.push("DATABASE_URL apunta al mismo endpoint que producción. Ejecución bloqueada.");
    }
    if (!qa.AUTOMEK_QA_ENDPOINT) {
      errors.push("Falta AUTOMEK_QA_ENDPOINT (fija el endpoint de QA). Ejecutá 'npm run qa:pin' una vez.");
    } else if (qa.AUTOMEK_QA_ENDPOINT.toLowerCase() !== direct.endpoint) {
      errors.push("DATABASE_URL no coincide con el endpoint fijado en AUTOMEK_QA_ENDPOINT: la conexión de QA cambió.");
    }
  }

  if (qa.DATABASE_URL_POOLED) {
    try {
      const pooled = parsePostgresUrl(qa.DATABASE_URL_POOLED);
      if (!pooled.pooled) errors.push("DATABASE_URL_POOLED debe ser la conexión con pooler (host con '-pooler').");
      if (prod.endpoints.has(pooled.endpoint) || prod.hosts.has(pooled.host)) {
        errors.push("DATABASE_URL_POOLED apunta al mismo endpoint que producción. Ejecución bloqueada.");
      }
      if (direct && pooled.endpoint !== direct.endpoint) {
        errors.push("DATABASE_URL_POOLED y DATABASE_URL deben ser del mismo endpoint.");
      }
    } catch (error) {
      errors.push(`DATABASE_URL_POOLED ${error.message}.`);
    }
  }

  if (!qa.NEXTAUTH_SECRET) errors.push("NEXTAUTH_SECRET de QA está vacío.");
  else if (prod.secrets.has(qa.NEXTAUTH_SECRET)) errors.push("NEXTAUTH_SECRET de QA es igual a uno de producción: debe ser propio.");

  if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(qa.NEXTAUTH_URL ?? "")) {
    errors.push("NEXTAUTH_URL de QA debe ser http://localhost:<puerto>.");
  }

  return {
    ok: errors.length === 0,
    errors,
    info: direct ? { endpoint: direct.endpoint, database: direct.database, schema: direct.schema } : null,
  };
}

const STRIPPED_KEYS = /^(DATABASE_URL|DIRECT_URL|SHADOW_DATABASE_URL|POSTGRES_.*|PG[A-Z]+|NEON_.*|VERCEL.*|NEXTAUTH_.*|AUTH_.*)$/;

/**
 * Entorno de los procesos hijos: se quita todo lo que pueda apuntar a producción
 * (el shell o los .env) y se define solo lo de QA. Prisma y Next no pisan variables ya definidas.
 */
export function buildChildEnv(baseEnv, qa) {
  const env = {};
  for (const [key, value] of Object.entries(baseEnv)) {
    if (!STRIPPED_KEYS.test(key)) env[key] = value;
  }
  env.DATABASE_URL = qa.DATABASE_URL;
  if (qa.DATABASE_URL_POOLED) env.QA_DATABASE_URL_POOLED = qa.DATABASE_URL_POOLED;
  env.NEXTAUTH_SECRET = qa.NEXTAUTH_SECRET;
  env.NEXTAUTH_URL = qa.NEXTAUTH_URL;
  env.AUTOMEK_ENV = "qa";
  env.AUTOMEK_QA_ENDPOINT = qa.AUTOMEK_QA_ENDPOINT ?? "";
  if (qa.AUTOMEK_QA_PG_MAJOR) env.AUTOMEK_QA_PG_MAJOR = qa.AUTOMEK_QA_PG_MAJOR;
  return env;
}

/**
 * Para scripts y pruebas de integración futuras: llamarla al inicio. Lanza un error si el proceso
 * no fue lanzado por el runner de QA o si DATABASE_URL apunta a producción.
 */
export function assertQaProcess(env, prod) {
  if (env.AUTOMEK_ENV !== "qa") {
    throw new Error("Este script solo corre en QA: usá 'npm run qa:exec -- <comando>'.");
  }
  let target;
  try {
    target = parsePostgresUrl(env.DATABASE_URL ?? "");
  } catch {
    throw new Error("DATABASE_URL de QA ausente o inválida.");
  }
  if (prod.endpoints.has(target.endpoint) || prod.hosts.has(target.host)) {
    throw new Error("DATABASE_URL apunta a producción. Ejecución bloqueada.");
  }
  if (!env.AUTOMEK_QA_ENDPOINT || env.AUTOMEK_QA_ENDPOINT !== target.endpoint) {
    throw new Error("DATABASE_URL no coincide con el endpoint de QA fijado.");
  }
  return target;
}
