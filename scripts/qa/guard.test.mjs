import { describe, expect, it } from "vitest";
import { assertQaProcess, buildChildEnv, collectProdTargets, parseEnv, parsePostgresUrl, validateQaEnv } from "./guard.mjs";

// Todos los valores son ficticios
const PROD_URL = "postgresql://u:p@ep-prod-aaa111-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require";
const prod = collectProdTargets([parseEnv(`DATABASE_URL="${PROD_URL}"\nNEXTAUTH_SECRET=secreto-prod`)]);

const qaOk = {
  AUTOMEK_ENV: "qa",
  DATABASE_URL: "postgresql://u:p@ep-qa-bbb222.us-east-2.aws.neon.tech/neondb?sslmode=require",
  DATABASE_URL_POOLED: "postgresql://u:p@ep-qa-bbb222-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require",
  AUTOMEK_QA_ENDPOINT: "ep-qa-bbb222",
  NEXTAUTH_SECRET: "secreto-qa",
  NEXTAUTH_URL: "http://localhost:3002",
};

describe("guardarraíles de QA", () => {
  it("lee archivos .env con comillas, comentarios y export", () => {
    expect(parseEnv('# c\nA=1\nexport B="dos"\nC=\'tres\' # nota\n\nD=4 # x')).toEqual({ A: "1", B: "dos", C: "tres", D: "4" });
  });

  it("el endpoint ignora el sufijo -pooler", () => {
    expect(parsePostgresUrl(PROD_URL)).toMatchObject({ endpoint: "ep-prod-aaa111", pooled: true, database: "neondb" });
    expect(() => parsePostgresUrl("mysql://x")).toThrow();
    expect(() => parsePostgresUrl("no es url")).toThrow();
  });

  it("detecta los endpoints y secretos de producción", () => {
    expect(prod.endpoints.has("ep-prod-aaa111")).toBe(true);
    expect(prod.secrets.has("secreto-prod")).toBe(true);
  });

  it("acepta una configuración de QA correcta", () => {
    const r = validateQaEnv(qaOk, prod);
    expect(r.errors).toEqual([]);
    expect(r.info).toEqual({ endpoint: "ep-qa-bbb222", database: "neondb", schema: "public" });
  });

  it("bloquea una URL de QA que apunta al endpoint de producción (directa o con pooler)", () => {
    const direct = { ...qaOk, DATABASE_URL: PROD_URL.replace("-pooler", ""), AUTOMEK_QA_ENDPOINT: "ep-prod-aaa111" };
    expect(validateQaEnv(direct, prod).errors.join(" ")).toMatch(/mismo endpoint que producción/);
    const pooled = { ...qaOk, DATABASE_URL_POOLED: PROD_URL };
    expect(validateQaEnv(pooled, prod).ok).toBe(false);
  });

  it("bloquea configuraciones incompletas o inseguras", () => {
    expect(validateQaEnv({ ...qaOk, DATABASE_URL: "" }, prod).ok).toBe(false);
    expect(validateQaEnv({ ...qaOk, AUTOMEK_ENV: "prod" }, prod).ok).toBe(false);
    expect(validateQaEnv({ ...qaOk, AUTOMEK_QA_ENDPOINT: "" }, prod).ok).toBe(false);
    expect(validateQaEnv({ ...qaOk, AUTOMEK_QA_ENDPOINT: "ep-otro-ccc333" }, prod).ok).toBe(false);
    expect(validateQaEnv({ ...qaOk, DATABASE_URL: qaOk.DATABASE_URL_POOLED }, prod).errors.join(" ")).toMatch(/conexión directa/);
    expect(validateQaEnv({ ...qaOk, NEXTAUTH_SECRET: "secreto-prod" }, prod).ok).toBe(false);
    expect(validateQaEnv({ ...qaOk, NEXTAUTH_URL: "https://automek-one.vercel.app" }, prod).ok).toBe(false);
    expect(validateQaEnv({ ...qaOk, DATABASE_URL: "postgresql://sin-credenciales@ep-qa-bbb222.neon.tech/db" }, prod).ok).toBe(false);
  });

  it("el entorno de los procesos hijos solo contiene la conexión de QA", () => {
    const env = buildChildEnv(
      { PATH: "/bin", DATABASE_URL: PROD_URL, DIRECT_URL: PROD_URL, NEXTAUTH_SECRET: "secreto-prod", VERCEL_TOKEN: "t", PGPASSWORD: "x", NEON_API_KEY: "k", AUTH_SECRET: "a" },
      qaOk
    );
    expect(env.PATH).toBe("/bin");
    expect(env.DATABASE_URL).toBe(qaOk.DATABASE_URL);
    expect(env.NEXTAUTH_SECRET).toBe("secreto-qa");
    for (const key of ["DIRECT_URL", "VERCEL_TOKEN", "PGPASSWORD", "NEON_API_KEY", "AUTH_SECRET"]) expect(env).not.toHaveProperty(key);
    expect(Object.values(env)).not.toContain(PROD_URL);
  });

  it("assertQaProcess exige el runner de QA y rechaza producción", () => {
    const env = buildChildEnv({}, qaOk);
    expect(assertQaProcess(env, prod).endpoint).toBe("ep-qa-bbb222");
    expect(() => assertQaProcess({ DATABASE_URL: qaOk.DATABASE_URL }, prod)).toThrow(/solo corre en QA/);
    expect(() => assertQaProcess({ ...env, DATABASE_URL: PROD_URL }, prod)).toThrow(/producción/);
    expect(() => assertQaProcess({ ...env, DATABASE_URL: "" }, prod)).toThrow();
  });
});
