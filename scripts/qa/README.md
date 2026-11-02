# Entorno de QA de AUTOMEK

Proyecto Neon independiente **AUTOMEK-QA** (PostgreSQL 18, igual que producción). Todo lo de esta carpeta existe para que
las pruebas sean reproducibles y para que **ninguna pueda tocar producción**.

## Reglas

- La conexión de QA vive en archivos `.env.qa-*` (ignorados por git; solo `.env.qa-stock.example` se versiona).
- Todo se ejecuta a través del runner (`npm run qa:*`): quita del entorno cualquier variable que pueda apuntar a producción,
  define solo la conexión de QA y se niega a correr si el endpoint coincide con el de producción (`guard.mjs`).
- Todos los scripts importan `lib/common.mjs`, que vuelve a verificar el guardarraíl: lanzan un error si no corren bajo el runner.
- Los datos son ficticios. Las contraseñas de prueba se generan al azar en memoria en cada corrida y solo se guardan como hash en la base de QA.
- El libro `stock_movements` es inmutable: las pruebas de stock dejan datos. Usar siempre una **branch de QA descartable**.

## Configuración inicial

1. Crear el proyecto Neon de QA (misma región y versión mayor de PostgreSQL que producción).
2. Copiar `.env.qa-stock.example` a `.env.qa-stock` y completar `DATABASE_URL` (conexión **directa**, sin `-pooler`) y, opcionalmente,
   `DATABASE_URL_POOLED` (con pooler: para repetir las pruebas por el camino que usa producción).
3. `npm run qa:pin` (fija el endpoint de QA) y `npm run qa:check` (valida y prueba la conexión con una consulta de solo lectura).

Para usar otro archivo (por ejemplo la conexión de una branch de ronda): `AUTOMEK_QA_ENV_FILE=.env.qa-run1`
(PowerShell: `$env:AUTOMEK_QA_ENV_FILE = ".env.qa-run1"`). Con `QA_VIA_POOLER=1` la app y las pruebas usan la conexión con pooler.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run qa:pin` / `qa:check` | Fija el endpoint / valida las reglas y prueba la conexión (solo lectura). |
| `npm run qa:prisma -- <comando>` | Prisma contra QA (`migrate status`, `migrate deploy`…). |
| `npm run qa:dev` | La aplicación del árbol de trabajo contra QA, en http://localhost:3002. |
| `npm run qa:serve-head` | La aplicación de HEAD exportada (el código desplegado), sin cambios locales ni `.env`. |
| `npm run qa:seed` | Siembra datos ficticios **a través de la app** (requiere `qa:dev`). |
| `npm run qa:e2e:compat` | Regresión de punta a punta de los flujos existentes (requiere la app). |
| `npm run qa:e2e:stock` | E2E del módulo de stock: productos, compras, ajustes, descuento por orden, faltantes, devoluciones (requiere la app y `qa:seed`). |
| `npm run qa:test:integration` | Pruebas de integración del servicio de stock con Vitest contra la base de QA. |
| `npm run qa:db:checks` | Triggers, CHECK, claves compuestas, concurrencia con conexiones independientes, deadlocks y fuga de estado con pooler. |
| `npm run qa:verify:migrations [-- --until stock]` | Compara `_prisma_migrations` con los archivos: orden, estado y checksum. |
| `npm run qa:fingerprint -- <archivo>` / `-- --compare <archivo>` | Huella por tabla antes y después de una migración. |
| `npm run qa:lock-probe` | Bloqueos y tiempos de la migración de Stock en un schema descartable (ver más abajo). |
| `npm run qa:test` / `qa:exec -- <comando>` | Vitest o cualquier comando con el entorno de QA. |

## Ciclo de prueba de una migración (branches de Neon dentro de AUTOMEK-QA)

1. `main` de QA: migraciones hasta el estado de producción + `qa:seed`. De ahí se crea la branch `baseline-pre-<cambio>` (no se escribe nunca).
2. `run-<cambio>-N`: branch hija de la baseline para cada ronda, con su propio `.env.qa-runN` y su propio `qa:pin`.
3. En la branch de ronda:
   - `qa:verify:migrations -- --until stock` y `qa:fingerprint -- antes.json` (estado previo);
   - `qa:serve-head` + `qa:e2e:compat` (el código desplegado contra el schema previo y, tras migrar, contra el schema nuevo);
   - `qa:prisma -- migrate deploy`, `qa:verify:migrations`, `qa:fingerprint -- --compare antes.json`;
   - `qa:dev` + `qa:e2e:compat` + `qa:e2e:stock`, `qa:test:integration` y `qa:db:checks`, directos y con `QA_VIA_POOLER=1`.
4. Se descarta la branch de ronda.

### Sonda de bloqueos y fallo forzado (en un schema descartable)

- Sonda: un archivo de entorno con `DATABASE_URL=...&schema=lock_probe`; aplicar allí las migraciones anteriores con `migrate deploy`
  (con un `--schema` que apunte a una carpeta temporal que contenga solo esas migraciones) y correr `npm run qa:lock-probe`.
  Ejecuta la migración de Stock dentro de una transacción, mide, lista los bloqueos y hace `ROLLBACK`.
- Fallo forzado: copiar `prisma/` a una carpeta temporal, agregar `SELECT 1/0;` a mitad de la migración de Stock, correr `migrate deploy`
  sobre el schema descartable y comprobar que no queda ningún objeto y que `_prisma_migrations` registra el intento fallido;
  recuperar con `migrate resolve --rolled-back <migración>` y volver a aplicar la versión correcta.
- Al terminar: `DROP SCHEMA lock_probe CASCADE`.

## Archivos

- `guard.mjs` (+ `guard.test.mjs`): reglas y entorno limpio; `run-qa.mjs`: el runner; `ping.mjs`: verificación de solo lectura de la conexión.
- `lib/common.mjs`: guardarraíl, conexión (`pg` y Prisma), cliente HTTP con sesión y verificaciones con salida legible.
- `vitest-qa-setup.mjs`: guardarraíl de las pruebas de integración (`vitest.integration.config.ts`).
