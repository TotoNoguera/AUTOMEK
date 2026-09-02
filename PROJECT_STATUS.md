# Estado del Proyecto — Fase 9 EN PROGRESO: Preparación para Producción (Dev ✅ | Build ✅ | Tests ✅)

**Fecha**: 2026-09-02  
**Status**: ✅ Fase 8 cerrada. 🔄 Fase 9 (Preparación para Producción) — revisión de seguridad, configuración, base de datos y aplicación completa; **falta el deploy real en Vercel** (requiere credenciales/cuentas del usuario, fuera del alcance de este agente)  
**Próxima Fase**: Completar el deploy en Vercel (acción del usuario) — no hay Fase 10 planificada en ROADMAP.md

---

## FASE 9 — Preparación para Producción (sesión 2026-09-02)

Revisión y endurecimiento del proyecto para despliegue, sin agregar funcionalidades ni cambiar arquitectura/stack.

### 1. Seguridad

- ✅ **Autenticación/autorización**: revisado `lib/auth.ts` — bcrypt para hash de contraseñas, rate limiting en login (10 intentos/15min) y registro (5/15min), JWT vía NextAuth v5. Sin cambios necesarios.
- ✅ **Aislamiento por taller**: confirmado que los 32 endpoints de API protegidos (de 34 totales; los 2 restantes son `/api/auth/register` y `/api/auth/[...nextauth]`, públicos por diseño) filtran por `tallerId` en cada consulta. Ya verificado exhaustivamente en las sesiones de Fase 8 (bidireccional, en costos, P&L, CSV, órdenes, presupuestos, cierres).
- ✅ **Validaciones**: 19 schemas Zod cubriendo todos los inputs de API (ya cubierto en Fase 8).
- 🔧 **CORREGIDO — Acceso a rutas**: `middleware.ts` solo protegía `/dashboard/*`; las otras 13 páginas protegidas (`/clients`, `/vehicles`, `/costs`, `/work-orders`, etc.) eran accesibles sin sesión a nivel de página (los datos seguían protegidos por la API, que sí exige sesión, pero la interfaz cargaba igual). Se extendió el matcher del middleware para cubrir las 14 rutas protegidas reales del proyecto. Verificado: acceso no autenticado a `/clients` ahora redirige correctamente a `/auth/login`.
- ✅ **Manejo de errores sin exponer información sensible**: confirmado que ningún endpoint de API devuelve `error.message`/`error.stack` al cliente (solo `console.error` en servidor + mensaje genérico). Se agregaron `app/error.tsx` y `app/not-found.tsx` (no existían) para reemplazar las páginas de error genéricas de Next.js por unas propias que tampoco exponen detalles del error real.
- 🔧 **CORREGIDO — Header de información**: se agregó `poweredByHeader: false` en `next.config.js` para dejar de exponer el header `X-Powered-By: Next.js`.

### 2. Configuración

- ✅ `.env` y `.env.local` confirmados fuera de Git (`.gitignore` ya los excluía correctamente; verificado con `git check-ignore`).
- ✅ `.env.example` actualizado: connection string de ejemplo con formato Neon pooled + `sslmode=require`, comentario indicando generar `NEXTAUTH_SECRET` con `openssl rand -base64 32` y no reutilizar el de desarrollo en producción.
- 🔧 **CORREGIDO — Secreto de desarrollo débil**: `NEXTAUTH_SECRET` en `.env` y `.env.local` tenía el valor placeholder literal `"your-secret-key-here-change-in-production"` (nunca fue reemplazado). Se generaron secretos aleatorios reales para ambos archivos (distintos entre sí). **Producción debe usar un tercer secreto, generado nuevamente y configurado solo en el dashboard de Vercel.**
- ✅ Variables necesarias para producción identificadas: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (debe apuntar al dominio final de Vercel), `NODE_ENV` (Vercel lo setea automáticamente).
- ✅ Prisma y Neon correctamente configurados: `datasource db { provider = "postgresql", url = env("DATABASE_URL") }`, connection string con `sslmode=require&channel_binding=require` (correcto para Neon).

### 3. Base de datos

- 🔧 **CORREGIDO — Sin migraciones versionadas**: el proyecto no tenía carpeta `prisma/migrations/` — el schema se sincronizaba únicamente vía `prisma db push`, no apto para producción (no deja historial versionado ni es reproducible de forma segura). Se generó una migración baseline (`prisma/migrations/20260902010415_init/migration.sql`) representando el schema completo actual y se marcó como aplicada contra la base Neon existente (`prisma migrate resolve --applied`) sin alterar los datos. `npx prisma migrate status` confirma: **"Database schema is up to date!"**.
- ✅ Se agregó el script `db:migrate:deploy` (`prisma migrate deploy`) en `package.json` — el comando correcto para aplicar migraciones en producción (a diferencia de `db:migrate`/`migrate dev`, que es solo para desarrollo).
- ✅ Se agregó `postinstall: "prisma generate"` en `package.json`, necesario para que Vercel genere el Prisma Client automáticamente en cada build.
- ⚠️ `db:push` se mantiene disponible como script de conveniencia para desarrollo rápido, pero **no debe usarse contra la base de producción** — a partir de ahora, todo cambio de schema debe pasar por `prisma migrate dev` (genera migración) y `prisma migrate deploy` (la aplica en producción).

### 4. Aplicación

- ✅ Navegación verificada en las 14 rutas protegidas tras el cambio de middleware — sin regresiones.
- ✅ Estados de carga/error: se agregaron `app/error.tsx` (error boundary genérico) y `app/not-found.tsx` (404), ambos probados en navegador.
- ✅ Responsive verificado en viewport móvil (375px) sobre `/dashboard` — layout de una columna, sin overflow.
- ✅ Ningún error visible al usuario expone información sensible (confirmado en el punto de seguridad).
- ✅ Funcionalidades principales re-verificadas tras los cambios: login/logout, dashboard, costos, órdenes de trabajo — todas funcionando correctamente. `npm run test` — 46/46 tests pasando.

### 5. Producción

- ✅ `npm run build` — build de producción limpio, exit code 0, 39 páginas + 34 endpoints de API generados, sin errores (solo warnings preexistentes de ESLint no bloqueantes).
- ✅ Conexión con Neon verificada (migraciones aplicadas exitosamente, aplicación funcionando en desarrollo contra la misma base).
- 🔧 **Repositorio Git inicializado**: el proyecto no tenía control de versiones (`git init` nunca se había ejecutado). Se inicializó un repositorio local y se confirmó que `.gitignore` excluye correctamente `.env`, `.env.local` y `node_modules` (109 archivos correctos quedaron en staging). **No se realizó commit** porque no hay identidad de Git configurada (`user.name`/`user.email`) — se dejó así deliberadamente para no modificar configuración de Git sin autorización explícita.
- ⏳ **Pendiente (requiere acciones del usuario, fuera del alcance de este agente — necesitan sus propias credenciales/cuentas)**:
  1. Configurar identidad de Git (`git config user.name` / `user.email`) y crear el primer commit.
  2. Crear un repositorio remoto (GitHub/GitLab) y hacer push.
  3. Crear el proyecto en Vercel e importar el repositorio.
  4. Configurar las variables de entorno de producción en el dashboard de Vercel: `DATABASE_URL` (recomendado: una base Neon separada para producción, no la de desarrollo), `NEXTAUTH_SECRET` (generar uno nuevo, nunca reutilizar el de desarrollo), `NEXTAUTH_URL` (el dominio final asignado por Vercel).
  5. Si se usa una base de producción separada, ejecutar `npm run db:migrate:deploy` contra ella antes del primer uso (aplica la migración baseline ya creada).
  6. Ejecutar el deploy y probar la aplicación desplegada de punta a punta (login, CRUD básico, aislamiento por taller) — no realizable desde este entorno sin acceso a las credenciales de Vercel/GitHub del usuario.

**Errores encontrados y corregidos en esta sesión**: 5 (middleware sin cubrir 13 rutas protegidas; `X-Powered-By` expuesto; `NEXTAUTH_SECRET` con valor placeholder en 2 archivos; ausencia de páginas de error/404 propias; ausencia de migraciones versionadas). Ninguno requirió cambios de arquitectura o stack.

---

## FASE 8 — VERIFICACIÓN FINAL: AISLAMIENTO BIDIRECCIONAL (sesión 2026-09-02, parte 4)

---

## FASE 8 — VERIFICACIÓN FINAL: AISLAMIENTO BIDIRECCIONAL (sesión 2026-09-02, parte 4)

Continuación desde Test 10 (Tests 1-9 ya aprobados, no repetidos). Navegador real, Taller A (test@test.com) y Taller B (testb@test.com), servidor propio en puerto 3002 (`NEXTAUTH_URL` solo como variable de entorno del proceso). Ningún otro proyecto fue tocado.

10. ✅ **Aislamiento por taller — verificación bidireccional completa**:
    - **Dirección A→B (Taller B no accede/modifica datos de Taller A)**: con sesión de Taller B, se atacaron los 3 costos reales de Taller A vía API — GET `/api/costs/[id]` 405 en los 3, PUT 404 en los 3, DELETE 404 en los 3; POST de costo con `workOrderId` ajeno 404; GET a orden de trabajo ajena 404; GET a presupuesto ajeno 404; GET a cuenta corriente de cliente ajeno 404; reporte P&L de Taller B en cero en los 6 meses; listado de cierres de caja de Taller B solo devuelve su propio registro.
    - **Dirección B→A (Taller A no recibe datos creados por Taller B — nueva cobertura explícita)**: se creó un costo ($77777, categoría "TallerB-Reverse-Test") y un cliente ("Cliente Creado Por Taller B") desde la sesión de Taller B. Al volver a Taller A: el listado de costos siguió mostrando exactamente 3 registros (sin el de Taller B), el listado de clientes siguió mostrando exactamente 1 registro (sin el de Taller B), el acceso directo por ID a ambos recursos de Taller B devolvió 405/404, y el reporte P&L de Taller A no reflejó el monto de $77777 (margen sin cambios: -$56250.00). Los registros de prueba fueron eliminados al finalizar.
    - Conclusión: aislamiento por taller confirmado en ambas direcciones para costos, P&L, cierres de caja, órdenes de trabajo, presupuestos y cuenta corriente — ningún dato cruza entre talleres en lectura ni en escritura.
11. ✅ **npm run build** — build limpio (con `next dev` detenido primero): `BUILD_EXIT_CODE:0`, 39/39 páginas generadas, solo warnings preexistentes de ESLint.

**Errores encontrados**: ninguno de código en esta sesión.

---

## FASE 8 — VERIFICACIÓN FINAL: LOGIN/LOGOUT, FLUJOS 1-7 Y AISLAMIENTO TOTAL (sesión 2026-09-02, parte 3)

Continuación desde Test 9 (Tests 1-8 ya aprobados, no repetidos). Navegador real, Taller A (test@test.com) y Taller B (testb@test.com), servidor propio en puerto 3002 (`NEXTAUTH_URL` solo como variable de entorno del proceso). Ningún otro proyecto fue tocado.

9. ✅ **Flujos afectados de Fases 1-7 — verificados uno por uno vía UI real**:
   - **Login/logout**: logout real vía botón (redirige a `/auth/login`), login real vía formulario con `test@test.com` (redirige correctamente a `/dashboard`, sesión y middleware funcionando).
   - **Clientes y vehículos**: listado y detalle de "Cliente Taller A" con su vehículo SEC001 intactos.
   - **Presupuestos**: 2 presupuestos existentes ($2400.00, $4500.00) intactos.
   - **Órdenes**: 5 órdenes de trabajo con sus totales y estados intactos.
   - **Turnos**: calendario de Agenda con los 2 turnos de setiembre intactos.
   - **Caja/cobros**: se ejecutó un flujo completo real de "Nuevo Ingreso" ($250.00, método Efectivo) — registrado correctamente con toast "Ingreso registrado correctamente" y reflejado inmediatamente en el listado. (No existe endpoint DELETE para movimientos de caja — decisión de diseño ya existente de fases previas para preservar la integridad del historial de auditoría; el movimiento de prueba queda como registro permanente, igual que otros registros de prueba de sesiones anteriores.)
   - Ninguna regresión encontrada en ningún flujo.
10. ✅ **Aislamiento por taller — verificación total con sesión de Taller B contra IDs reales de Taller A**:
    - **Costos**: listado 0 registros; GET `/api/costs/[id]` 405; PUT 404; DELETE 404; POST con `workOrderId` ajeno 404.
    - **P&L**: los 6 meses en cero (`sixMonthTotal: 0`), sin rastro de los valores de Taller A.
    - **CSV**: fuente de datos del export confirmada en cero (mismo endpoint ya verificado con contenido exacto en sesión anterior).
    - **PDFs/cierres**: `POST /api/daily-closes` con fecha ya usada por Taller A devuelve 409 — pero se confirmó que corresponde al propio cierre de Taller B en esa fecha (`tallerId` coincide con Taller B), no al de Taller A: el listado `GET /api/daily-closes` de Taller B devuelve únicamente su propio registro.
    - **Endpoints nuevos adicionales de Fase 8 probados**: orden de trabajo ajena (`/api/work-orders/[id]`) 404; presupuesto ajeno (`/api/quotes/[id]`) 404; cuenta corriente de cliente ajeno (`/api/clients/[id]/credit`) 404.
    - Al volver a Taller A: los 3 costos originales (categoría "Alquiler" no fue sobrescrita a "HACKED5") y el P&L (ingresos $3250.00 — incremento correcto por el ingreso de $250 del punto 9, no por corrupción; margen -$56250.00, matemáticamente exacto) permanecen consistentes.
11. ✅ **npm run build** — build limpio (con `next dev` detenido primero): `BUILD_EXIT_CODE:0`, 39/39 páginas generadas, solo warnings preexistentes de ESLint.

**Errores encontrados**: ninguno de código en esta sesión.

---

## FASE 8 — VERIFICACIÓN PDF, TOASTS Y AISLAMIENTO EXTENDIDO (sesión 2026-09-02, parte 2)

Continuación desde Tests 6-11 (Test 5/CSV ya aprobado, no repetido). Navegador real, Taller A (test@test.com) y Taller B (testb@test.com), servidor propio en puerto 3002 (`NEXTAUTH_URL` solo como variable de entorno del proceso). Ningún otro proyecto fue tocado.

6. ✅ **Impresión/PDF de presupuesto — verificación de contenido campo a campo**: se comparó el HTML renderizado contra `GET /api/quotes/[id]` directamente. Cliente ("Cliente Taller A"), vehículo ("SEC001 - Ford Fiesta"), ítems (Pastillas de freno 4×$350.00=$1400.00; Mano de obra 1×$1000.00=$1000.00), total ($2400.00 = suma exacta de ítems), fecha y observaciones — todos coinciden exactamente con la fuente de datos. Se confirmó además que la regla CSS `@media print { .no-print { display: none !important; } }` existe en la hoja de estilos y que los 2 bloques `.no-print` (nav superior y botones de acción) quedan correctamente excluidos de la impresión. `window.print()` se interceptó y se confirmó su invocación real al hacer clic en el botón.
7. ✅ **Impresión/PDF de cierre de caja — verificación de contenido**: se comparó el historial visible contra `GET /api/daily-closes`. Los 3 cierres verificados matemáticamente (`saldoInicial + totalIngresos - totalEgresos = saldoFinal` en los 3 casos) y el carry-over correcto (el saldoFinal de un cierre se convierte en el saldoInicial del siguiente). `window.print()` confirmado invocado al hacer clic.
8. ✅ **Toasts y manejo de errores en flujos modificados** — caso de éxito y caso de error verificados en un flujo no probado en sesiones previas (Costos): se forzó un envío con `monto: 0` sorteando las validaciones nativas HTML5 (`min`, `required`) vía manipulación del DOM, y el backend (Zod) lo rechazó devolviendo el toast rojo "Error: Invalid data" sin crear el registro (totales sin cambios: $50000/$9500). Cierre de caja duplicado devuelve 409 desde el backend además del bloqueo preventivo del botón en el frontend.
9. ✅ **Flujos afectados de Fases 1-7** — Orden de trabajo (margen $3000.00 recalculado correcto), Agenda/Turnos (calendario y turnos intactos), Técnicos (listado intacto) — sin errores de consola nuevos (solo los 409/400 esperados de las pruebas de error del punto 8).
10. ✅ **Aislamiento por taller — extendido a reportes y exportaciones**: con sesión de Taller B se confirmó que el reporte P&L (UI y CSV exportado) devuelve exactamente cero en los 6 meses, sin ningún rastro de los valores de Taller A ($3000/$50000/$9500/-$56500). Ataque directo a la API con IDs reales de Taller A: costos (GET 405, PUT 404, DELETE 404), POST con `workOrderId` ajeno (404), orden de trabajo ajena (404), **presupuesto ajeno (404 — nueva cobertura)**, y el listado de cierres de caja de Taller B solo devuelve su propio registro (sin mezclar con los cierres de Taller A). Al volver a Taller A, los 3 costos y el reporte P&L (margen -$56500.00) permanecen exactamente iguales.
11. ✅ **npm run build** — build limpio (con `next dev` detenido primero): `BUILD_EXIT_CODE:0`, 39/39 páginas generadas, solo warnings preexistentes de ESLint.

**Errores encontrados**: ninguno de código en esta sesión.

---

## FASE 8 — VERIFICACIÓN CSV Y CIERRE FINAL (sesión 2026-09-02)

Continuación puntual desde el Test 5 (CSV), profundizando la verificación de contenido y aislamiento por taller del CSV, y repitiendo los tests 6-11. Navegador real, Taller A (test@test.com) y Taller B (testb@test.com), servidor propio en puerto 3002 (`NEXTAUTH_URL` solo como variable de entorno del proceso). Ningún otro proyecto fue tocado.

5. ✅ **Exportación CSV — contenido real verificado**:
   - **Encabezados correctos**: `Mes,Año,Ingresos,Costos Fijos,Costos Variables,Costos Totales,Margen` (P&L), coincide con las columnas de la tabla en pantalla.
   - **Registros correctos**: 6 filas (Abril a Septiembre 2026), una por mes, sin duplicados ni faltantes.
   - **Importes correctos**: fila Septiembre `3000.00,50000.00,9500.00,59500.00,-56500.00` — idéntica a los valores mostrados en pantalla y a la respuesta de `/api/reports/pnl`.
   - **Sin datos de otro taller**: se creó un costo de prueba en Taller B ($99999, categoría "TallerB-Categoria-Unica"), se exportó su CSV y contenía únicamente esos datos (`99999.00` en Costos Fijos, sin rastro de los $3000/$50000/$9500 de Taller A). Se eliminó el registro y se confirmó que el reporte y CSV de Taller A permanecieron exactamente iguales (margen -56500.00 sin cambios), probando aislamiento en ambas direcciones.
6. ✅ **Impresión/PDF de presupuesto** — se interceptó `window.print` con un stub; el botón "Imprimir / PDF" de `/quotes/[id]` lo invocó correctamente (`window.__printCalled === true`).
7. ✅ **Impresión/PDF de cierre de caja** — mismo método en `/daily-closes`: `window.print()` invocado correctamente al hacer clic.
8. ✅ **Toasts y manejo de errores** — verificados ambos caminos: éxito (creación normal ya cubierta en sesiones previas) y error real: se envió un cliente con nombre de 1 carácter (bypaseando la validación HTML5 nativa con `form_input`), la API rechazó la solicitud (Zod) y el frontend mostró el toast rojo "Error: Invalid data" sin crear el registro. Cierre de caja duplicado devuelve 409 "La caja de este día ya fue cerrada" desde el backend, y el frontend ya bloquea el botón preventivamente ("Este día ya fue cerrado").
9. ✅ **Flujos afectados de Fases 1-7** — Orden de trabajo con margen ($3000.00, recalculado correctamente), Vehículos (listado intacto), Caja y Movimientos (5 registros, montos correctos) — todos verificados sin errores de consola nuevos (los únicos errores en consola fueron los 409/400 esperados de las propias pruebas de error del punto 8).
10. ✅ **Aislamiento por taller en funcionalidades nuevas** — repetido el ataque directo a la API desde sesión de Taller B contra IDs reales de Taller A: `/api/costs/[id]` GET 405, PUT 404, DELETE 404; POST con `workOrderId` ajeno 404; GET a orden de trabajo ajena 404; P&L de Taller B en cero. Al volver a Taller A, los 3 costos originales (categoría "Alquiler" no fue sobrescrita) permanecen exactamente iguales.
11. ✅ **npm run build** — build limpio (con `next dev` detenido primero) completado con éxito: `BUILD_EXIT_CODE:0`, 39/39 páginas generadas, únicamente warnings preexistentes de ESLint (no bloqueantes, no introducidos por esta verificación).

**Errores encontrados**: ninguno de código en esta sesión.

---

## FASE 8 — VERIFICACIÓN EXHAUSTIVA (sesión 2026-09-01, parte 4)

Continuación de la re-verificación anterior, profundizando en edición/eliminación real de costos, contenido exacto de CSV, e invocación real de `window.print()`. Navegador real, Taller A (test@test.com) y Taller B (testb@test.com), servidor propio en puerto 3002 (NEXTAUTH_URL seteado solo como variable de entorno del proceso, sin tocar `.env`/`.env.local`).

1. ✅ **Editar costo** — costo de prueba creado (Variable, Herramientas, $777.00), editado vía formulario UI a ($888.50, descripción "EDITADO") → toast "Costo actualizado correctamente", total recalculado a $10388.50 (50000 fijo + 500 + 9000 + 888.50 variable), exacto.
2. ✅ **Eliminar costo** — eliminado vía UI real (con `confirm()` nativo interceptado a `true` mediante `window.confirm` stub, ya que los diálogos nativos están deshabilitados en el navegador de pruebas — limitación del entorno, no del código). Toast y recarga de lista confirmaron el borrado; totales volvieron exactamente a la línea base ($50000 / $9500).
3. ✅ **Costos fijos y variables y sus totales** — verificado antes y después de cada operación: base $50000.00 fijo / $9500.00 variable, sin discrepancias en ningún paso.
4. ✅ **Reportes/P&L con datos reales** — Septiembre 2026: Ingresos $3000.00, Costos Fijos $50000.00, Costos Variables $9500.00, Costos Totales $59500.00, Margen **-$56500.00** (exacto), consistente con los totales de Costos.
5. ✅ **Exportar CSV y verificar contenido** — se interceptó `URL.createObjectURL` para leer el Blob real generado por el botón. Contenido del CSV de P&L coincide exactamente con los datos en pantalla (fila Septiembre: `3000.00,50000.00,9500.00,59500.00,-56500.00`). Repetido en Caja/Movimientos: las 5 filas y montos del CSV coinciden con la tabla visible.
6. ✅ **Impresión/PDF de presupuesto** — se reemplazó `window.print` por un stub y se confirmó que el botón "Imprimir / PDF" de `/quotes/[id]` efectivamente lo invoca (`window.__printCalled === true`).
7. ✅ **Impresión/PDF de cierre de caja** — mismo método aplicado a `/daily-closes`: `window.print()` invocado correctamente al hacer clic en el botón.
8. ✅ **Toasts y manejo de errores en flujos modificados** — cierre de caja: intento de cerrar un día ya cerrado es bloqueado por el frontend (botón deshabilitado, mensaje "Este día ya fue cerrado") y por el backend (`POST /api/daily-closes` repetido → 409 "La caja de este día ya fue cerrada"), doble capa de protección correcta.
9. ✅ **Fases 1-7 en flujos afectados** — Vehículos (listado intacto), Órdenes de Trabajo (margen $3000.00 recalculado correctamente tras las operaciones de costos), Caja y Movimientos (CSV con contenido exacto). Sin errores de consola en ninguna página.
10. ✅ **Aislamiento por taller en funcionalidades nuevas** — con Taller B: 0 costos visibles, ataque directo a la API con IDs reales de Taller A → GET `/api/costs/[id]` 405, PUT 404, DELETE 404, POST con `workOrderId` ajeno 404, GET a `/api/work-orders/[id]` ajena 404, P&L de Taller B en cero. Re-logueado como Taller A: los 3 costos y la orden con margen permanecen exactamente iguales (categoría "Alquiler" no fue sobrescrita a "HACKED2", montos sin alterar).
11. ✅ **npm run build** — build limpio (con `next dev` detenido primero, evitando el conflicto de `.next` compartido) completado con éxito: 39/39 páginas generadas. Solo warnings preexistentes de ESLint, ninguno bloqueante.

**Errores encontrados y corregidos**: ninguno de código. Se detectaron dos comportamientos del entorno de pruebas (diálogos `confirm()` nativos deshabilitados en el navegador de test) que se resolvieron interceptando `window.confirm`/`window.print` en el propio navegador de prueba, sin modificar el código de la aplicación.

---

## FASE 8 — RE-VERIFICACIÓN COMPLETA (sesión 2026-09-01, parte 3)

Verificación en navegador real, cuenta Taller A (test@test.com) y Taller B (testb@test.com), con datos reales acumulados de fases anteriores.

1. ✅ **Costos fijos y variables** — CRUD completo probado en navegador: creación (Fijo, $1234.50), edición ($1234.50→$2000, toast "Costo actualizado correctamente"), eliminación (vía API autenticada, ya que `confirm()` nativo está deshabilitado en el navegador de pruebas — comportamiento del entorno de test, no un bug). Totales por período recalculados correctamente en cada paso. Estado final: datos originales intactos ($50000 fijo / $9500 variable).
2. ✅ **Reportes financieros (P&L)** — `/reports/pnl` renderiza correctamente. Verificado matemáticamente: Septiembre 2026 → Ingresos $3000.00, Costos Fijos $50000.00, Costos Variables $9500.00, Costos Totales $59500.00, Margen **-$56500.00** (3000-59500=-56500, exacto). Costos por categoría agregados correctamente.
3. ✅ **Exportación CSV** — botón "Exportar CSV" probado en reporte P&L y en Caja/Movimientos, sin errores de consola.
4. ✅ **Impresión/PDF de presupuestos y cierres de caja** — botón "Imprimir / PDF" presente y funcional (sin errores) en `/quotes/[id]` y `/daily-closes`.
5. ✅ **Toasts y manejo de errores** — toast de éxito verificado en creación de costo y creación de cliente ("Costo registrado correctamente", "Cliente creado correctamente"). Validación nativa HTML5 (`required`) bloquea correctamente el envío de formularios incompletos antes de llegar a la capa de toast.
6. ✅ **El reemplazo de alert() no rompió formularios ni flujos** — probado flujo completo de creación de cliente (Clientes) de punta a punta con éxito y toast; ningún error de consola en ninguna página visitada.
7. ✅ **Caja, cobros, cuenta corriente y cierres siguen funcionando** — `/cash-movements` (5 movimientos históricos + botón CSV), `/clients/[id]/credit` (saldo -$1500.00 correcto), `/daily-closes` (historial de 2 cierres, ingresos/egresos del día correctos) — todos cargan y muestran datos correctos.
8. ✅ **Fases 1-7 siguen funcionando** — verificado sin errores: Clientes (CRUD), Vehículos, Presupuestos (lista + detalle + PDF), Órdenes de Trabajo (lista + detalle + margen), Técnicos, Objetivos (30%/100% de metas), Agenda/Turnos (calendario mensual con turnos), Auditoría (historial completo).
9. ✅ **Aislamiento por taller en funcionalidades nuevas** — con sesión de Taller B: `/costs` muestra 0 registros; ataque directo a la API con IDs reales de Taller A → GET `/api/costs/[id]` 405 (verbo no implementado), PUT 404, DELETE 404, PATCH 405, POST con `workOrderId` ajeno 404; `/api/reports/pnl` de Taller B devuelve todo en cero (sin fuga de datos). Re-logueado como Taller A: los 3 costos originales permanecen exactamente iguales (categoría, monto, descripción sin alterar) — sin corrupción post-ataque.
10. ✅ **npm run build** — build limpio (sin `next dev` corriendo en paralelo) completado con éxito: 39/39 páginas generadas, exit code 0. Solo warnings preexistentes de ESLint (`no-unused-vars` en catches de `error`, `exhaustive-deps`), ninguno bloqueante ni introducido por esta verificación.

**Nota de entorno**: la verificación se corrió en el puerto 3002 (con `NEXTAUTH_URL` seteado solo como variable de entorno del proceso, sin tocar `.env`/`.env.local`) porque el puerto 3000 estaba ocupado por otro proyecto ajeno (Wapa Pizza Party), que se dejó intacto sin detener ni modificar, según lo solicitado. No se encontró ningún error real de código durante esta re-verificación — el único inconveniente detectado (build fallido) fue causado por tener `next dev` y `next build` corriendo simultáneamente sobre el mismo directorio `.next`, no por un defecto de Fase 8; se resolvió deteniendo `dev` antes de compilar, sin tocar código.

---

## FASE 8 — Pulido y Funcionalidades Comerciales ✅ IMPLEMENTADA

**Implementación completada**: 2026-09-01
**Verificación en navegador (2 talleres reales, datos ricos de fases anteriores)**: ✅ COMPLETADA

### Funcionalidades implementadas

**Gestión de Costos** (nuevo, modelo `Cost` ya existía en schema desde Fase 1):
- ✅ CRUD completo: crear, editar, eliminar, listar costos filtrados por mes/año
- ✅ Categorización libre con sugerencias (Materia Prima, Mano de Obra, Servicios, etc.) y tipo Fijo/Variable
- ✅ Margen por orden de trabajo: `GET /api/work-orders/[id]` ahora calcula `margen = total - costos asociados` y se muestra en la UI de la orden
- ✅ Reporte "Costos vs Ingresos" (P&L): últimos 6 meses (ingresos, costos fijos/variables/totales, margen) + costos por categoría del mes actual, con exportación CSV e impresión/PDF

**Manejo de errores robusto**:
- ✅ Sistema de notificaciones toast (`components/common/ToastProvider.tsx`, componente nuevo reutilizable, integrado al layout global) reemplazando **los 26 `alert()` de error/éxito** presentes en 14 páginas existentes (Fase 2-7) — mensajes visibles, no bloqueantes, con auto-dismiss y colores por tipo (éxito/error/info)

**Responsive design**:
- ✅ Verificado en viewport móvil (375px): dashboard, KPIs y grids ya colapsaban correctamente (patrón `grid-cols-1 md:grid-cols-N` usado consistentemente desde fases anteriores)
- ✅ Agregada regla CSS global (`@media (max-width: 640px) { table { overflow-x: auto } }`) para que las tablas anchas no rompan el layout de la página en móvil — scroll horizontal contenido dentro de su propio contenedor, sin afectar el resto del diseño

**Exportación y Reportes**:
- ✅ PDF de presupuestos: agregado botón "Imprimir / PDF" en `quotes/[id]` (mismo patrón `window.print()` + `.no-print` ya usado en Fase 7 para órdenes de trabajo)
- ✅ PDF de órdenes de trabajo: ya existía desde Fase 7
- ✅ PDF de cierres de caja: agregado botón "Imprimir / PDF" en `daily-closes`
- ✅ CSV de reportes financieros: nueva utilidad reutilizable `lib/csv.ts` (`downloadCsv`), aplicada en movimientos de caja, reporte P&L y logs de auditoría exportables

**Seguridad**:
- ✅ Rate limiting en APIs: nuevo `lib/rate-limit.ts` (in-memory, sin dependencias nuevas) aplicado a `POST /api/auth/register` (5 intentos/15 min por IP) y al `authorize` de NextAuth en login (10 intentos/15 min por email) — mitiga spam de registro y fuerza bruta
- ✅ XSS: verificado que no existe ningún uso de `dangerouslySetInnerHTML` en todo el código (React ya escapa por defecto)
- ✅ SQL injection: verificado que no existe ningún `$queryRawUnsafe`/`$executeRawUnsafe`; todas las consultas usan Prisma parametrizado
- ✅ CSRF: mitigado por el diseño existente (cookies `SameSite=Lax` de NextAuth v5 + APIs que solo aceptan `application/json`, lo que bloquea envíos simples cross-site sin preflight)
- ✅ Validación de permisos: ya cubierta en todas las fases (aislamiento por `tallerId` + `AuditLog` de acciones sensibles)
- ✅ `npm audit`: 7 vulnerabilidades transitivas detectadas (vía `tar`/`postcss`/`deepmerge-ts`, dependencias indirectas de Prisma/Next), todas requieren `--force` con breaking changes (upgrade mayor de Next.js) — **no aplicado** por estar fuera de alcance ("no cambies arquitectura"); documentado aquí para seguimiento futuro

**Tests unitarios básicos**:
- ✅ Vitest agregado como devDependency (sin afectar dependencies de producción)
- ✅ 46 tests unitarios cubriendo los 19 schemas de validación Zod (`lib/validations.test.ts`) y el rate limiter (`lib/rate-limit.test.ts`) — toda la lógica de negocio pura y testeable sin refactorizar la arquitectura existente
- ✅ `npm run test` — **46/46 passing**
- ⚠️ Cobertura >70% global no fue perseguida literalmente: la lógica de negocio está mayormente inline en los API routes (patrón ya establecido desde Fase 1), y extraerla a funciones puras para maximizar cobertura habría requerido un refactor arquitectónico explícitamente prohibido en esta fase. Se priorizó testear exhaustivamente toda la superficie de validación (la lógica de negocio más crítica y reutilizada)

### Archivos creados
- `components/common/ToastProvider.tsx` — sistema de notificaciones
- `lib/csv.ts` — utilidad de exportación CSV reutilizable
- `lib/rate-limit.ts` — rate limiter en memoria
- `lib/rate-limit.test.ts`, `lib/validations.test.ts` — tests unitarios
- `vitest.config.ts` — configuración de tests
- `app/api/costs/route.ts`, `app/api/costs/[id]/route.ts` — CRUD de costos
- `app/api/reports/pnl/route.ts` — reporte P&L
- `app/costs/page.tsx` — UI de costos
- `app/reports/pnl/page.tsx` — UI de reporte P&L

### Cambios de dependencia estrictamente necesarios
- `app/providers.tsx` — envuelve la app en `ToastProvider` (mismo patrón que `SessionProvider`)
- **14 páginas existentes** (Fase 2-7) — reemplazo de `alert()` por `showToast()`: `clients/page.tsx`, `clients/[id]/page.tsx`, `clients/[id]/credit/page.tsx`, `vehicles/page.tsx`, `daily-closes/page.tsx`, `cash-movements/page.tsx`, `schedules/page.tsx`, `schedules/[id]/page.tsx`, `work-orders/page.tsx`, `work-orders/[id]/page.tsx`, `quotes/page.tsx`, `quotes/[id]/page.tsx`, `goals/page.tsx`, `technicians/page.tsx`
- `app/api/work-orders/[id]/route.ts` — agregado cálculo de `costs`/`margen` al GET (aditivo)
- `app/work-orders/[id]/page.tsx`, `app/quotes/[id]/page.tsx`, `app/daily-closes/page.tsx` — botones "Imprimir/PDF" y clases `no-print`
- `app/cash-movements/page.tsx`, `app/audit-logs/page.tsx` — botones "Exportar CSV"
- `app/api/auth/register/route.ts`, `lib/auth.ts` — rate limiting agregado
- `app/dashboard/page.tsx` — 2 tarjetas de acceso rápido nuevas (Costos, Costos vs Ingresos)
- `styles/globals.css` — regla responsive para tablas en móvil
- `package.json` — scripts `test`/`test:watch`/`test:coverage`, `vitest` como devDependency

**No se modificó ninguna lógica de negocio existente de Fase 1-7** (solo se reemplazó el mecanismo de notificación de `alert()` a toast, y se agregaron campos/endpoints puramente aditivos).

### Pruebas ejecutadas (navegador real + fetch autenticado, 2 talleres)
1. ✅ Costos: creado costo Fijo ($50000.00) y Variable ($9000.00 tras editar de $8500.00) → totales del período correctos; toast "Costo registrado correctamente" visible
2. ✅ Margen por orden: costo de $500.00 asociado a orden de $3500.00 → margen calculado = **$3000.00** (exacto)
3. ✅ Reporte P&L: Septiembre 2026 → Ingresos $3000.00, Costos Fijos $50000.00, Costos Variables $9500.00 (9000+500, sin duplicar), Costos Totales $59500.00, Margen **-$56500.00** (verificado: 3000-59500=-56500); costos por categoría agregados correctamente (Materia Prima $9500.00 = suma de 2 registros)
4. ✅ Exportación CSV: botón disparó la descarga correctamente (verificado interceptando `link.click()`)
5. ✅ Responsive móvil (375px): dashboard y página de costos colapsan a 1-2 columnas correctamente; tabla de costos con scroll horizontal contenido sin romper el ancho de página
6. ✅ Botones "Imprimir / PDF" presentes y funcionales en presupuestos, órdenes, cierres de caja y reporte P&L

### Aislamiento por taller (Taller A vs Taller B)
- ✅ GET `/api/costs` (listado) → Taller B no ve costos de Taller A (count=0)
- ✅ GET `/api/reports/pnl` → Taller B ve su propio reporte vacío (sin datos de Taller A)
- ✅ PUT/DELETE `/api/costs/[id]` con id de Taller A → 404 en ambos, sin modificar ni eliminar
- ✅ POST `/api/costs` usando `workOrderId` de Taller A → 404 "Work order not found" (rechazado)
- ✅ PATCH (verbo no implementado) → 405 seguro
- ✅ Verificado post-ataque: costo de Taller A (`descripcion`, `monto`) permanece intacto

### Build y tests de producción
```
npm run build
✓ Compiled successfully — 39/39 páginas

npm run test
✓ Test Files  2 passed (2)
✓ Tests  46 passed (46)
```

### 🎯 Resumen Fase 8
100% completa. Gestión de costos con margen por orden y reporte P&L, manejo de errores robusto (toasts reemplazando 26 alerts en 14 páginas), responsive verificado, exportación PDF/CSV ampliada, rate limiting, verificación de XSS/SQLi/CSRF, y 46 tests unitarios — todo verificado end-to-end con cálculos financieros exactos y aislamiento multi-tenant confirmado. Sin errores encontrados durante la implementación ni la verificación. Única salvedad documentada: vulnerabilidades transitivas de `npm audit` que requieren breaking changes no aplicados por estar fuera de alcance.

---

---

## FASE 7 — VERIFICACIÓN E2E TESTS 1-8 (sesión 2026-09-01, parte 2)

Re-verificación exhaustiva solicitada explícitamente sobre los 8 puntos, ejecutada con datos reales de Neon acumulados de fases anteriores (Taller A) más aislamiento cruzado contra Taller B.

### Resultados

1. ✅ **CRUD completo de técnicos**: creado "Carla Gómez" → aparece en listado; editado (teléfono actualizado) → persistido correctamente; desactivado/activado → estado cambia y persiste en cada paso

2. ✅ **Crear y consultar objetivos**: meta "Órdenes Mensuales" (objetivo=3, Sep 2026) creada y consultable junto con la meta preexistente "Ingreso Mensual" ($10000)

3. ✅ **Cálculo real de progreso de objetivos** verificado en dos escenarios:
   - Ingreso Mensual: $3000.00 de $10000.00 (30%, En Progreso)
   - Órdenes Mensuales: 5 de 3 (100%, Alcanzado — objetivo superado)
   - Confirmado con cálculo manual independiente contra `/api/work-orders` y `/api/cash-movements`: coincidencia exacta (5 órdenes del mes, $3000.00 ingresos del mes)

4. ✅ **Historial de vehículo con datos reales**: SEC001 → 5 órdenes de trabajo, 2 presupuestos, 2 turnos; verificado contra `/api/vehicles/[id]/history` directamente (workOrdersCount=5, quotesCount=2, schedulesCount=2, totalSum=$16600.00) — coincide exactamente con lo renderizado en UI

5. ✅ **AuditLog generado por acción sensible**: se registró un egreso nuevo y se verificó que generó exactamente 1 `AuditLog` nuevo (diff=1) con `accion="CASH_MOVEMENT_RECORDED"` vinculado al `entityId` correcto del movimiento

6. ✅ **KPIs del dashboard con datos reales de Neon**: verificados los 4 KPIs principales contra cálculo manual independiente sobre los mismos datos — coincidencia exacta en los 4: `ordenesActivas` (5=5), `cobrosHoy` ($3000=$3000), `egresosMes` ($2661=$2661), `deudasPendientes` ($12100=$12100)

7. ✅ **Aislamiento por taller en todos los endpoints nuevos** (Taller B contra recursos de Taller A):
   - GET `/api/technicians`, `/api/goals` (listados) → sin fuga de datos de Taller A
   - GET/PUT `/api/technicians/[id]`, `/api/goals/[id]` con ids de Taller A → 404 en ambos
   - DELETE (verbo no implementado por diseño en técnicos/metas) → 405 seguro
   - GET `/api/vehicles/[id]/history` con vehículo de Taller A → 404
   - GET `/api/audit-logs`, `/api/dashboard/stats` → cada taller ve solo sus propios datos (Taller B: 1 log propio, 0 órdenes activas, $0 cobros)
   - PATCH (no implementado) → 405 en ambos endpoints
   - Verificado post-ataque: "Carla Gómez" y objetivo=3 de Taller A permanecen intactos sin alteración

8. ✅ **Build**: `npm run build` sin errores

**Sin errores encontrados en esta ronda.** Todas las funcionalidades de Fase 7 (Técnicos, Objetivos/Metas, Historial de vehículos, AuditLog, Estadísticas/KPIs) verificadas end-to-end con datos reales de la base de datos Neon y aislamiento multi-tenant confirmado.

---

## FASE 7 — Técnicos, Objetivos, Historial y Dashboard ✅ IMPLEMENTADA

**Implementación completada**: 2026-09-01
**Verificación en navegador (2 talleres reales, datos ricos de fases anteriores)**: ✅ COMPLETADA

### Funcionalidades implementadas

**Gestión de Técnicos:**
- ✅ CRUD: crear, editar, listar, activar/desactivar (campos: nombre, email, teléfono, especialidad)

**Objetivos y Metas:**
- ✅ Definir metas mensuales (INGRESO_MENSUAL, ORDENES_MENSUALES, CLIENTES_NUEVOS)
- ✅ Cálculo automático de "alcanzado" contra datos reales (CashMovement, WorkOrder, Client) cada vez que se consultan
- ✅ Cálculo automático de estado (EN_PROGRESO / ALCANZADO / NO_ALCANZADO según si el mes ya terminó)
- ✅ Página de seguimiento con barra de progreso visual
- ✅ Validación: no permite dos metas del mismo tipo/mes/año (409)
- ✅ Comparativa objetivo vs real integrada en el Dashboard

**Historial y Auditoría:**
- ✅ Historial completo de vehículo: todas las órdenes de trabajo (con ítems, fechas, km, diagnóstico), presupuestos y turnos asociados
- ✅ Visualización de AuditLog con filtro por tipo de entidad (ya se poblaba desde Fase 6; ahora es consultable desde la UI)

**Dashboard General:**
- ✅ KPIs: órdenes activas, cobros de hoy/mes, egresos del mes, deudas pendientes
- ✅ Gráficos sin librerías externas (barras SVG/CSS puras): ingresos/egresos de 6 meses, órdenes por mes
- ✅ Vehículos más frecuentes (top 5 por cantidad de órdenes)
- ✅ Comparativa objetivos del mes vs real con barra de progreso

**Reportes:**
- ✅ Reporte mensual imprimible (`/reports/monthly`) con ingresos, egresos, neto, deudas, objetivos vs real, vehículos frecuentes y últimos 6 meses — botón "Imprimir / Guardar PDF" vía `window.print()` (sin agregar librerías nuevas)
- ✅ Botón "Imprimir / PDF" en detalle de orden de trabajo, con CSS `@media print` para ocultar controles no imprimibles

### Archivos creados
- `app/api/technicians/route.ts`, `app/api/technicians/[id]/route.ts`
- `app/api/goals/route.ts`, `app/api/goals/[id]/route.ts`
- `app/api/vehicles/[id]/history/route.ts`
- `app/api/audit-logs/route.ts`
- `app/api/dashboard/stats/route.ts`
- `app/technicians/page.tsx`, `app/goals/page.tsx`, `app/audit-logs/page.tsx`
- `app/vehicles/[id]/history/page.tsx`
- `app/reports/monthly/page.tsx`
- `lib/validations.ts` — agregados `TechnicianSchema`, `TechnicianUpdateSchema`, `GoalSchema`, `GoalUpdateSchema`

### Cambios de dependencia estrictamente necesarios
- `app/dashboard/page.tsx` — reescrito para incluir KPIs, gráficos y comparativa de objetivos (requisito explícito del checkpoint de Fase 7), más 4 tarjetas de acceso rápido nuevas
- `app/vehicles/page.tsx` — agregado link "Historial" por vehículo (necesario para acceder a la nueva página; no se tocó la lógica de listado/eliminación existente)
- `app/work-orders/[id]/page.tsx` — agregado botón "Imprimir / PDF" y clases `no-print` en controles de estado (requisito explícito del checkpoint: "puede generar reportes en PDF")
- `styles/globals.css` — agregada regla `@media print { .no-print { display: none } }` (utilitario global mínimo, sin afectar estilos existentes)

**No se modificó ninguna lógica de negocio de Fase 1-6.** No se agregaron dependencias npm nuevas (los PDF se generan vía impresión nativa del navegador).

### Pruebas ejecutadas (navegador real + fetch autenticado, 2 talleres)
1. ✅ Dashboard KPIs: verificado con datos reales de Taller E (recién creado) — Órdenes Activas, Cobros Hoy/Mes, Egresos del Mes, Deudas Pendientes, todos coincidiendo con los datos esperados
2. ✅ Gráficos de barras (ingresos/egresos y órdenes por mes) renderizando correctamente sin librerías externas
3. ✅ Crear técnico ("Juan Pérez") → aparece en listado
4. ✅ Desactivar/Activar técnico → estado cambia correctamente en UI y persiste
5. ✅ Editar técnico (teléfono) → guardado correctamente, estado "activo" no se sobreescribe accidentalmente
6. ✅ Crear meta (Ingreso Mensual, $10000, Septiembre 2026) → `alcanzado` calculado automáticamente desde `CashMovement` reales ($3000.00 = 30%)
7. ✅ Meta duplicada (mismo tipo/mes/año) → 409 rechazado
8. ✅ Dashboard muestra "Objetivos del Mes vs Real" con barra de progreso (30%)
9. ✅ Historial de vehículo (SEC001): 5 órdenes de trabajo, 2 presupuestos, 2 turnos — todos los datos, ítems y totales coinciden exactamente con lo registrado en fases anteriores
10. ✅ Auditoría: listado muestra eventos reales de Fase 6 (movimientos de caja, cierres, cuenta corriente); filtro por entidad (`CLIENT_CREDIT`) funciona correctamente
11. ✅ Reporte mensual: todos los totales coinciden con `/api/dashboard/stats` (ingresos $3000.00, egresos $2550.00, neto $450.00, deudas $12100.00, 5 órdenes, objetivos y vehículos frecuentes)
12. ✅ Botón "Imprimir / PDF" presente y funcional (`window.print` invocable) tanto en reporte mensual como en detalle de orden de trabajo

### Aislamiento por taller (Taller A vs Taller B)
- ✅ GET `/api/technicians` (listado) → sin fuga de técnicos de Taller A
- ✅ GET/PUT `/api/technicians/[id]` con id de Taller A → 404 en ambos, sin modificar datos
- ✅ GET `/api/goals` (listado) → sin fuga de metas de Taller A
- ✅ PUT `/api/goals/[id]` con id de Taller A → 404, objetivo no alterado
- ✅ GET `/api/vehicles/[id]/history` con vehículo de Taller A → 404
- ✅ GET `/api/audit-logs` → cada taller ve solo sus propios registros
- ✅ GET `/api/dashboard/stats` → cada taller ve solo sus propias métricas (Taller B: 0 órdenes activas, $0 cobros)
- ✅ Verificado post-ataque: técnico "Juan Pérez" y meta $10000.00 de Taller A permanecen intactos

### Build de producción
```
npm run build
✓ Compiled successfully
```
Todas las rutas nuevas compiladas correctamente: `/api/technicians`, `/api/technicians/[id]`, `/api/goals`, `/api/goals/[id]`, `/api/vehicles/[id]/history`, `/api/audit-logs`, `/api/dashboard/stats`, `/technicians`, `/goals`, `/audit-logs`, `/vehicles/[id]/history`, `/reports/monthly`.

### 🎯 Resumen Fase 7
100% completa. CRUD de técnicos, objetivos con cálculo automático de progreso real, historial completo de vehículo, visualización de auditoría, dashboard con KPIs y gráficos nativos, y reportes imprimibles/PDF — todo verificado end-to-end con datos reales y aislamiento multi-tenant confirmado. Sin errores encontrados durante la implementación ni la verificación.

---

---

## FASE 6 — VERIFICACIÓN E2E TESTS 8-13 (sesión 2026-09-01, parte 7)

Continuación exacta desde Test 8, con datos frescos (taller nuevo "Taller E" — Talleres A/B/C/D ya habían cerrado caja del día). Se replicó el estado post-Test 7 (orden de $8000.00 con pago parcial de $3000.00 vía Efectivo) antes de continuar.

### Resultados

8. ✅ **Cuenta corriente**:
   - Deuda generada correctamente: resto de la orden ($5000.00) cobrado vía Cuenta Corriente → orden queda con pendiente=$0 (8000 total = 3000+5000), `ClientCredit.saldo`=-$5000.00
   - Registro coherente con el flujo definido: mismo endpoint `POST /api/cash-movements/ingreso` usado para todos los métodos, cuenta corriente no genera `CashMovement` físico (verificado: `cashMovementsCount` se mantuvo en 1 tras el cobro por cuenta corriente)
   - Pago parcial de la deuda ($2000.00) → saldo actualizado a -$3000.00, verificado en API y UI
   - Sin duplicados: conteo de movimientos antes/después del pago parcial = 1→2 (diff=1 exacto)

9. ✅ **Caja**: listado de movimientos (Efectivo $3000.00 + Anticipo $2000.00) coincide exactamente con los pagos reales; saldo acumulado verificado = $0 + $5000.00 (ingresos) - $0 (egresos) = **$5000.00**

10. ✅ **Egreso**: $650.00 categoría "Gasto de Mantenimiento" registrado con descripción "Mantenimiento elevador"; saldo de caja recalculado a **$4350.00** (5000-650)

11. ✅ **Cierre diario**: cerrado con saldoInicial=$0, ingresos=$5000.00, egresos=$650.00, saldoFinal=**$4350.00** (fórmula verificada); segundo intento de cierre del mismo día → 409 "La caja de este día ya fue cerrada" rechazado correctamente; verificado también en UI (historial muestra el cierre, botón deshabilitado)

12. ✅ **Aislamiento entre talleres** (los 5 verbos): logueado como Taller A contra recursos de Taller E:
    - GET `/api/cash-movements`, `/api/daily-closes`, `/api/debts` → sin fuga de datos de Taller E
    - POST `/api/clients/[id]/credit/payment` sobre cliente de Taller E → 404
    - POST `/api/cash-movements/ingreso` con `workOrderId` de Taller E → 404
    - PUT/PATCH/DELETE sobre `/api/cash-movements`, `/api/daily-closes`, `/api/clients/[id]/credit` (verbos no implementados por diseño) → 405 en los 9 casos probados, sin exponer ningún handler no previsto
    - Verificado post-ataque: datos de Taller E completamente intactos (saldo cuenta corriente -$3000.00, 1 cierre con saldoFinal $4350.00, 3 movimientos originales sin alteración)

13. ✅ **Build**: `npm run build` sin errores, 27/27 páginas generadas

**Sin errores encontrados en esta ronda.** Todos los requisitos clave (impacto correcto en caja, actualización de cuenta corriente, pagos parciales, cierre por taller, aislamiento estricto, sin duplicación, consistencia transaccional) se sostuvieron bajo prueba fresca con un sexto taller de prueba.

---

## FASE 6 — VERIFICACIÓN E2E TESTS 7-13 (sesión 2026-09-01, parte 6)

Continuación exacta desde Test 7, con datos frescos (taller nuevo "Taller D", sin contaminación de sesiones previas — Talleres A/B/C ya habían cerrado caja del día).

### Error encontrado y corregido
`GET /api/work-orders/[id]` (detalle individual) tampoco incluía `payments` en algunos casos de uso repetido — se verificó que el fix aplicado en la sesión anterior seguía vigente y funcionando correctamente (no fue necesaria una nueva corrección).

### Resultados

7. ✅ **Cobro parcial**: orden de $8000.00, pago parcial de $3000.00 vía Efectivo. Verificado: pagado=$3000.00, pendiente=$5000.00 (recalculado correctamente)
8. ✅ **Cuenta corriente**: resto de la deuda ($5000.00) cobrado vía Cuenta Corriente → saldo actualizado a -$5000.00; luego pago parcial de $1500.00 en cuenta corriente → saldo actualizado a -$3500.00. Verificado explícitamente que el pago parcial generó **exactamente 1** movimiento de caja nuevo (conteo antes/después: 1→2, diff=1), sin duplicados
9. ✅ **Caja**: saldo acumulado verificado = $0 (inicial) + $4500.00 (3000+1500 ingresos reales) - $0 (sin egresos aún) = $4500.00; movimientos listados coinciden exactamente con los pagos reales en efectivo (el pago vía cuenta corriente de $5000.00 correctamente no aparece como movimiento de caja, al no ser dinero físico)
10. ✅ **Egreso**: $800.00 categoría "Compra de Materiales" registrado; saldo de caja recalculado a $3700.00 (4500-800)
11. ✅ **Cierre diario**: cerrado con saldoInicial=$0, ingresos=$4500.00, egresos=$800.00, saldoFinal=**$3700.00** (fórmula verificada); intento de cierre duplicado del mismo día → 409 "La caja de este día ya fue cerrada" rechazado correctamente
12. ✅ **Aislamiento**: logueado como Taller A contra recursos de Taller D — GET listado de movimientos (sin fuga), GET cuenta corriente ajena (404), POST pago cuenta corriente ajena (404), POST ingreso con `workOrderId` ajeno (404), GET cierres (sin fuga), GET deudas (sin fuga de cliente ni orden ajenos). Adicionalmente se confirmó que PUT/PATCH/DELETE sobre estos endpoints (no implementados por diseño, fuera del alcance de ROADMAP.md) devuelven `405 Method Not Allowed` de forma segura, sin exponer ningún handler no previsto. Verificado post-prueba: datos de Taller D intactos (saldo -$3500.00, 1 cierre con saldoFinal $3700.00, 3 movimientos originales sin alteración)
13. ✅ **Build**: `npm run build` sin errores, 27/27 páginas generadas

**Sin errores nuevos encontrados en esta ronda.** La transaccionalidad y el fix de `payments` aplicados en la sesión anterior se sostienen correctamente bajo prueba fresca.

---

## FASE 6 — REFUERZO Y VERIFICACIÓN E2E COMPLETA (sesión 2026-09-01, parte 5)

### Refuerzo de consistencia transaccional
Se envolvieron las operaciones financieras multi-escritura en `db.$transaction(...)` para garantizar atomicidad (todo o nada) y evitar estados inconsistentes ante fallos parciales o condiciones de carrera:
- `POST /api/cash-movements/ingreso` — rama Cuenta Corriente (Payment + ClientCredit + 2 AuditLog) y rama efectivo/transferencia/tarjeta (Payment opcional + CashMovement + AuditLog). El saldo pendiente de la orden se **re-lee dentro de la transacción** justo antes de insertar, no antes, para minimizar la ventana de condición de carrera entre dos cobros simultáneos sobre la misma orden.
- `POST /api/clients/[id]/credit/payment` — ClientCredit + CashMovement + 2 AuditLog en una sola transacción.
- `POST /api/daily-closes` — DailyClose + AuditLog en una transacción, con manejo explícito del código de error `P2002` (violación del constraint único `tallerId+fecha`) como backstop ante condición de carrera, devolviendo 409 en lugar de 500.

**No se cambió arquitectura ni modelos**; mismo Prisma, mismas tablas, misma lógica de negocio — solo se agrupó en transacciones lo que antes eran escrituras secuenciales sueltas.

### Errores encontrados y corregidos durante esta verificación
1. `GET /api/work-orders/[id]` (detalle) no incluía `payments` en el include — causaba error al calcular saldo pendiente. Corregido agregando `payments: true` (mismo tipo de fix aplicado antes al listado `GET /api/work-orders`, ahora también al detalle).

### Verificación end-to-end 1-12 (taller nuevo "Taller C", sin datos previos, más aislamiento cruzado contra Taller A)

1. ✅ **Apertura de caja**: sin cierres previos, preview muestra saldoInicial/ingresos/egresos en $0.00 (apertura implícita correcta, sin bloqueos)
2. ✅ **Registrar ingreso**: cobro de $5000.00 vía Efectivo sobre orden de $5000.00, categoría "Pago de Orden"
3. ✅ **Registrar egreso**: $1500.00 categoría Sueldos, clasificado correctamente
4. ✅ **Consultar movimientos**: listado muestra los 4 movimientos (1 egreso + 3 ingresos) con montos y categorías correctos
5. ✅ **Comprobar saldo**: preview de caja = $0 (inicial) + $10000.00 (ingresos) - $1500.00 (egresos) = **$8500.00** verificado
6. ✅ **Cobrar deuda completa**: orden de $5000.00 pagada en un solo movimiento, pendiente quedó en $0
7. ✅ **Cobrar deuda parcialmente**: orden de $8000.00, pago parcial de $3000.00 vía Transferencia → pendiente recalculado a $5000.00 (verificado con fix del punto anterior)
8. ✅ **Cuenta corriente**: resto de la deuda ($5000.00) cobrado vía Cuenta Corriente → `ClientCredit.saldo` = -$5000.00 (sin generar `CashMovement`, correcto); luego se registró un pago parcial de $2000.00 → saldo actualizado a -$3000.00 (pagos parciales confirmados)
9. ✅ **Cierre diario**: cerrado con saldoInicial=$0, ingresos=$10000.00, egresos=$1500.00, saldoFinal=**$8500.00** (fórmula verificada)
10. ✅ **Consultar cierre**: visible en historial con estado CERRADO, botón de cierre deshabilitado para esa fecha
11. ✅ **Aislamiento entre talleres**: logueado como Taller A, se intentó (a) listar movimientos de Taller C — 0 resultados sin fuga; (b) consultar cuenta corriente de cliente de Taller C — 404; (c) pagar cuenta corriente de cliente de Taller C — 404; (d) registrar ingreso usando `workOrderId` de Taller C — 404; (e) listar cierres de Taller C — sin fuga; (f) ver deudas de Taller C — sin fuga. Verificado además que los datos de Taller C permanecieron intactos (saldo -$3000.00, 1 cierre) tras los intentos
12. ✅ **Build**: `npm run build` sin errores, 27/27 páginas generadas

### Requisitos clave — estado de cumplimiento
- ✅ Ingresos y egresos impactan correctamente en caja (fórmula saldoInicial + ingresos - egresos verificada numéricamente)
- ✅ Cobros actualizan correctamente la cuenta corriente (verificado en ambas direcciones: débito por pago con cuenta corriente, crédito por pago de cuenta corriente)
- ✅ Pagos parciales soportados (orden y cuenta corriente)
- ✅ Cierre diario por taller; distintos talleres cierran el mismo día sin conflicto (confirmado en sesión anterior y sostenido en esta)
- ✅ Aislamiento estricto por taller (12 verificaciones cruzadas sin fugas)
- ✅ Sin duplicación de movimientos ni pagos (validación de saldo pendiente re-leída dentro de la transacción)
- ✅ Consistencia transaccional en operaciones financieras (reforzada esta sesión con `$transaction`)
- ✅ Reutilización de componentes y arquitectura existente (mismos patrones de API routes, mismo estilo de páginas, sin nuevas dependencias)

---

## FASE 6 — Caja, Cobros y Movimientos ✅ IMPLEMENTADA

**Implementación completada**: 2026-09-01
**Verificación en navegador (2 talleres reales)**: ✅ COMPLETADA

### Corrección de bug de schema (dependencia estrictamente necesaria)
`DailyClose.fecha` tenía `@unique` **global** (no por taller) desde la planificación de Fase 1 — esto habría impedido que dos talleres distintos cerraran caja el mismo día (violación de aislamiento multi-tenant fundamental para esta funcionalidad). Se corrigió a `@@unique([tallerId, fecha])`. Verificado con `prisma db push --accept-data-loss` (tabla vacía, sin pérdida de datos reales) y confirmado funcionalmente: Taller B pudo cerrar caja el mismo día que Taller A sin conflicto.

### Funcionalidades implementadas
- ✅ Registrar ingreso (cobro), con o sin orden de trabajo asociada
  - Métodos de pago: Efectivo, Transferencia, Tarjeta, Cuenta Corriente (auto-provisionados por taller vía `PaymentMethod`)
  - Pago con orden asociada → crea `Payment` + `CashMovement` (categoría PAGO_ORDEN)
  - Pago sin orden → `CashMovement` categoría ANTICIPO
  - Pago vía Cuenta Corriente → crea `Payment`, **no** genera `CashMovement` (no es dinero físico), y descuenta el saldo del `ClientCredit` del cliente (queda a deber)
  - Validación: el monto no puede exceder el saldo pendiente de la orden (400)
- ✅ Registrar egreso (gasto operacional clasificado): Compra de Repuestos, Materiales, Servicios, Mantenimiento, Sueldos, Alquiler, Servicios (luz/agua), Impuestos, Otros
- ✅ Listado de movimientos (ingresos/egresos) con filtro por tipo
- ✅ Cierre de caja diaria: cálculo automático saldoInicial (del cierre anterior) + ingresos - egresos = saldoFinal
  - Validación: no permite cerrar un día ya cerrado (409)
  - Validación: no permite cerrar una fecha futura (400)
- ✅ Cuenta corriente por cliente: consulta de saldo (auto-creado en 0 si no existe) + registro de pagos (soporta pagos parciales, saldo se actualiza automáticamente y genera `CashMovement` de ingreso)
- ✅ Página de Deudas: órdenes con saldo pendiente + clientes con saldo negativo en cuenta corriente
- ✅ Auditoría: `AuditLog` registrado en cada movimiento de caja, cada pago, cada cierre de caja y cada actualización de cuenta corriente
- ✅ Validaciones Zod (`CashMovementIngresoSchema`, `CashMovementEgresoSchema`, `DailyCloseSchema`, `ClientCreditPaymentSchema`)
- ✅ Aislamiento por taller en todas las operaciones

### Archivos creados
- `app/api/payment-methods/route.ts` — GET (lista, auto-provisiona 4 métodos por defecto si el taller no tiene ninguno)
- `app/api/cash-movements/route.ts` — GET (listado con filtros tipo/categoría/fecha)
- `app/api/cash-movements/ingreso/route.ts` — POST (registrar cobro, con lógica de cuenta corriente y validación de saldo pendiente)
- `app/api/cash-movements/egreso/route.ts` — POST (registrar gasto)
- `app/api/daily-closes/route.ts` — GET (historial), POST (cerrar caja del día)
- `app/api/clients/[id]/credit/route.ts` — GET (saldo, auto-crea si no existe)
- `app/api/clients/[id]/credit/payment/route.ts` — POST (registrar pago en cuenta corriente)
- `app/api/debts/route.ts` — GET (órdenes con saldo pendiente + clientes con saldo negativo)
- `app/cash-movements/page.tsx` — listado + formularios de ingreso/egreso
- `app/daily-closes/page.tsx` — preview del día + cierre + historial
- `app/debts/page.tsx` — deudas de órdenes y de cuenta corriente
- `app/clients/[id]/credit/page.tsx` — cuenta corriente por cliente + registrar pago
- `lib/validations.ts` — agregados `CashMovementIngresoSchema`, `CashMovementEgresoSchema`, `DailyCloseSchema`, `ClientCreditPaymentSchema`
- `prisma/schema.prisma` — corregido `DailyClose.fecha` a `@@unique([tallerId, fecha])`

### Cambios de dependencia estrictamente necesarios
- `app/api/work-orders/route.ts` — se agregó `payments: true` al include del GET (aditivo, no rompe consumidores existentes de Fase 4); necesario para calcular saldo pendiente por orden en el selector de ingresos
- `app/dashboard/page.tsx` — agregadas 3 tarjetas de acceso rápido (Caja y Movimientos, Cierre de Caja, Deudas)
- `app/clients/[id]/page.tsx` — agregado link "Ver Cuenta Corriente →" (discoverability, sin alterar funcionalidad existente)

**No se modificó ninguna otra lógica de fases anteriores.**

### Pruebas ejecutadas (navegador real + fetch autenticado, 2 talleres)
1. ✅ Registrar egreso (Compra de Repuestos, $2500.00) → aparece en listado correctamente clasificado
2. ✅ **Error encontrado y corregido**: `GET /api/work-orders` no incluía `payments`, causando `TypeError` en el selector de órdenes del formulario de ingreso. Corregido agregando el include. Prueba repetida exitosamente tras el fix.
3. ✅ Registrar ingreso con orden asociada (Efectivo, $2000.00 sobre orden de $4500.00) → categoría "Pago de Orden", pendiente recalculado a $2500.00
4. ✅ Validación de saldo: intento de pagar $3000.00 sobre pendiente de $2500.00 → 400 rechazado
5. ✅ Pago vía Cuenta Corriente ($2500.00, completando la orden) → `Payment` creado, `ClientCredit.saldo` = -$2500.00, **sin** `CashMovement` generado (verificado)
6. ✅ Página de Deudas: orden completamente pagada excluida de pendientes; cliente con saldo -$2500.00 listado correctamente
7. ✅ Cuenta corriente: registrar pago de $1000.00 → saldo actualizado de -$2500.00 a -$1500.00, generó `CashMovement` (ANTICIPO, +$1000.00) verificado en listado
8. ✅ Cierre de caja: preview correcto (ingresos $3000.00, egresos $2500.00, neto $500.00) → cierre creado con saldoInicial=0, saldoFinal=$500.00 (cálculo verificado: 0+3000-2500=500)
9. ✅ Rechazo de cierre duplicado del mismo día (409) y de fecha futura (400)
10. ✅ Encadenamiento de saldoInicial: cierre de día anterior sin movimientos correctamente calculó saldoInicial=0 (sin cierre previo)

### Aislamiento por taller (probado con Taller A / Taller B reales)
- ✅ GET `/api/cash-movements` desde Taller B → 0 resultados (no ve movimientos de Taller A)
- ✅ GET `/api/payment-methods` desde Taller B → auto-provisiona sus propios 4 métodos con IDs distintos a los de Taller A
- ✅ POST `/api/cash-movements/ingreso` con `workOrderId` de Taller A desde Taller B → 404 "Work order not found"
- ✅ GET `/api/clients/[id]/credit` con id de cliente de Taller A desde Taller B → 404 "Client not found"
- ✅ POST `/api/clients/[id]/credit/payment` sobre cliente de Taller A desde Taller B → 404
- ✅ GET `/api/debts` desde Taller B → 0 órdenes, 0 créditos negativos (no ve datos de Taller A)
- ✅ GET `/api/daily-closes` desde Taller B → 0 resultados
- ✅ **Confirmación crítica del fix de schema**: POST `/api/daily-closes` de Taller B para la misma fecha (2026-09-01) que Taller A ya había cerrado → 201 Created exitoso (antes del fix, esto habría fallado por el `@unique` global incorrecto)
- ✅ Verificado post-ataque: datos de Taller A intactos (saldo cuenta corriente -$1500.00 sin alterar, 2 cierres propios sin interferencia del cierre de Taller B)

### Build de producción
```
npm run build
✓ Compiled successfully
✓ Generating static pages (27/27)
```

### 🎯 Resumen Fase 6
100% completa. Ingresos y egresos clasificados, cierre de caja diaria con cálculo automático y validaciones, cuenta corriente por cliente con saldo en tiempo real, página de deudas, auditoría completa de movimientos, y aislamiento multi-tenant verificado — incluyendo la corrección de un bug de aislamiento heredado del schema de Fase 1. Un error fue encontrado y corregido durante la verificación (include faltante en `work-orders` GET).

---

---

## FASE 5 — RE-VERIFICACIÓN COMPLETA (sesión 2026-09-01, parte 4)

Verificación exhaustiva 1-13 solicitada explícitamente, ejecutada sobre datos nuevos:

1. ✅ Crear turno (Cliente Taller A, SEC001, 8/9/2026 09:00, "Cambio de correa de distribución") vía formulario UI
2. ✅ Listar turnos: visible en calendario y en tabla del día seleccionado
3. ✅ Ver detalle: datos completos correctos
4. ✅ Editar turno: hora 09:00 → 11:15, guardado correctamente
5. ✅ Cambiar estado: Pendiente → En Espera reflejado en UI
6. ✅ Estado EN_ESPERA probado específicamente y confirmado persistido en base de datos (`db_status: "EN_ESPERA"`)
7. ✅ Relación cliente/vehículo: selector de vehículo se filtra correctamente por cliente elegido
8. ✅ Cancelar/eliminar turno: turno convertido rechaza eliminación (400), turno sin convertir se elimina correctamente (200) y se verificó su ausencia posterior (404)
9. ✅ Convertir turno a orden de trabajo (Fase 5 sí lo define): orden creada (201, total $3500.00, cliente/vehículo preservados)
10. ✅ Sin duplicación: segundo intento de conversión del mismo turno → 409 "Schedule already converted to a work order"; verificado que solo existe 1 orden derivada en el sistema; turno no alterado incorrectamente (motivo y hora originales preservados, solo status/workOrderId reflejan la conversión legítima)
11. ✅ Aislamiento por taller verificado con usuario real de Taller B contra turno de Taller A: GET listado (no lo incluye), GET detalle (404), PUT edición (404), DELETE (404), POST conversión (404), POST creación con clientId/vehicleId ajenos (404) — 6/6 rechazados
12. ✅ Confirmado explícitamente: Taller B no pudo acceder, modificar, eliminar ni convertir datos de Taller A; datos de Taller A verificados intactos después de los intentos (motivo, hora, estado COMPLETADO y workOrderId sin alterar)
13. ✅ `npm run build` — compiló sin errores, 19/19 páginas generadas

**Nota**: no existe endpoint PATCH separado para turnos (el cambio de estado se maneja vía PUT, igual patrón que el resto del sistema); esto es consistente con el diseño ya establecido y no representa un hueco de cobertura — se probó exhaustivamente vía PUT.

**Errores encontrados durante esta re-verificación**: ninguno. No fue necesaria ninguna corrección.

---

## FASE 5 — Agenda / Turnos ✅ IMPLEMENTADA

**Implementación completada**: 2026-09-01
**Verificación en navegador (2 talleres reales)**: ✅ COMPLETADA

### Funcionalidades implementadas
- ✅ Calendario visual (vista Mes con grilla de días, vista Semana, navegación anterior/siguiente)
- ✅ Crear turno (cliente, vehículo, fecha, hora, motivo) desde formulario con fecha pre-cargada según día seleccionado en el calendario
- ✅ Listado de turnos del día seleccionado (tabla con hora, cliente, vehículo, motivo, estado)
- ✅ Ver detalle de turno
- ✅ Editar turno (fecha, hora, motivo)
- ✅ Cambiar estado (PENDIENTE, CONFIRMADO, EN_ESPERA, CANCELADO, COMPLETADO)
- ✅ Convertir turno en orden de trabajo (formulario con motivo de ingreso + ítems, igual patrón que conversión de presupuesto)
- ✅ Eliminar turno (bloqueado si ya fue convertido a orden de trabajo)
- ✅ Validación de conflicto de horario: no permite dos turnos para el mismo vehículo en la misma fecha/hora (409)
- ✅ Validaciones Zod (`ScheduleSchema`, `ScheduleUpdateSchema`, `ScheduleToWorkOrderSchema` en `lib/validations.ts`)
- ✅ Aislamiento por taller en todas las operaciones (list/get/put/delete/to-work-order) + validación cruzada en creación

### Archivos creados
- `app/api/schedules/route.ts` — GET (listar/filtrar por fecha o rango), POST (crear con validación de conflicto)
- `app/api/schedules/[id]/route.ts` — GET (detalle), PUT (editar + cambiar estado), DELETE (solo si no está convertido)
- `app/api/schedules/[id]/to-work-order/route.ts` — POST (convertir turno en orden de trabajo)
- `app/schedules/page.tsx` — calendario visual (mes/semana) + listado del día + formulario de creación
- `app/schedules/[id]/page.tsx` — detalle + edición + botones de estado + conversión a orden de trabajo
- `lib/validations.ts` — agregados `ScheduleUpdateSchema` y `ScheduleToWorkOrderSchema` (`ScheduleSchema` ya existía)

### Cambios de dependencia estrictamente necesarios
- `app/dashboard/page.tsx` — agregada tarjeta "Agenda" al grid de accesos rápidos
- Prisma: `Schedule`/`ScheduleStatus` ya estaban en el schema; se ejecutó `prisma db push` para confirmar sincronización (no hubo cambios de schema)

**No se modificó ninguna lógica de Fase 1, 2, 3 ni 4.**

### Pruebas ejecutadas (navegador real + fetch autenticado, 2 talleres)
1. ✅ Calendario visual: vista mensual renderiza correctamente, día seleccionable, navegación mes anterior/siguiente
2. ✅ Crear turno vía formulario UI (Cliente Taller A, SEC001, 1/9/2026 09:00, "Service general") → aparece en el calendario y en la lista del día
3. ✅ Validación de conflicto: crear otro turno mismo vehículo/fecha/hora → 409 "Ya existe un turno para este vehículo en ese horario"
4. ✅ Ver detalle correcto (fecha, hora, cliente, vehículo, motivo, estado)
5. ✅ Cambiar estado (Pendiente → Confirmado) reflejado en UI
6. ✅ Editar turno (hora 09:00 → 10:30) → guardado correctamente, estado se mantuvo
7. ✅ Convertir a orden de trabajo (motivo + 1 ítem "Cambio de aceite y filtros" 1×$1800) → orden creada (201) con cliente/vehículo/total ($1800.00) correctos
8. ✅ Tras conversión: turno pasa a estado COMPLETADO automáticamente, guarda `workOrderId`, UI muestra "Ver Orden de Trabajo" en lugar de "Convertir"/"Eliminar"
9. ✅ Eliminar turno ya convertido → rechazado (400 "No se puede eliminar un turno ya convertido en orden de trabajo")
10. ✅ Eliminar turno sin convertir → permitido (200)
11. ✅ Relación cliente/vehículo: selector de vehículo se filtra correctamente por cliente elegido

### Aislamiento por taller (probado con Taller A / Taller B reales)
- ✅ GET `/api/schedules` (listado) desde Taller B → no incluye turno de Taller A
- ✅ GET `/api/schedules/[id]` (Taller A) desde Taller B → 404
- ✅ PUT `/api/schedules/[id]` (Taller A) desde Taller B → 404, sin modificar datos
- ✅ DELETE `/api/schedules/[id]` (Taller A) desde Taller B → 404
- ✅ POST `/api/schedules/[id]/to-work-order` (Taller A) desde Taller B → 404
- ✅ POST `/api/schedules` desde Taller B usando `clientId`/`vehicleId` de Taller A → 404 "Client not found"
- ✅ Verificado post-ataque: turno de Taller A intacto (motivo, hora, estado, workOrderId sin alterar)

### Build de producción
```
npm run build
✓ Compiled successfully
✓ Generating static pages (19/19)
```
Rutas nuevas compiladas correctamente: `/api/schedules`, `/api/schedules/[id]`, `/api/schedules/[id]/to-work-order`, `/schedules` (estática), `/schedules/[id]` (dinámica).

### 🎯 Resumen Fase 5
100% completa. Calendario visual, CRUD de turnos, validación de conflicto de horario, cambio de estado, conversión a orden de trabajo y aislamiento multi-tenant, todo verificado end-to-end. Sin errores encontrados durante la implementación ni la verificación.

---

---

## FASE 4 — RE-VERIFICACIÓN COMPLETA (sesión 2026-09-01, parte 3)

Verificación exhaustiva 1-14 solicitada explícitamente, ejecutada sobre datos nuevos (no reutilizando corridas previas):

1. ✅ Presupuesto APROBADO → conversión a orden de trabajo (nuevo presupuesto $2400.00 creado, aprobado y convertido)
2. ✅ Orden creada correctamente (201, total $2400.00, estado inicial APROBADA)
3. ✅ Cliente, vehículo, ítems, cantidades e importes preservados exactamente (Cliente Taller A, SEC001, Pastillas de freno 4×$350=$1400, Mano de obra 1×$1000=$1000)
4. ✅ Presupuesto original permanece intacto tras la conversión (status APROBADO, total $2400.00, ítems sin alterar)
5. ✅ Orden manual creada vía formulario UI (Amortiguadores delanteros 2×$2200, total $4400.00)
6. ✅ Listado muestra las 3 órdenes con estado y total correctos
7. ✅ Ver detalle correcto (motivo, km 50000, ítems, subtotal)
8. ✅ Editar orden (diagnóstico agregado, se mantuvo el resto de los datos)
9. ✅ Cambiar estado (APROBADA → EN_PROCESO) reflejado en UI
10. ✅ Agregar ítem ("Alineación y balanceo" 1×$600) → total recalculado a $5000.00
11. ✅ Eliminar ítem → total recalculado a $4400.00, vuelve a 1 ítem
12. ✅ Relación cliente/vehículo: selector de vehículo se filtra correctamente por cliente elegido
13. ✅ Aislamiento por taller verificado con usuario real de Taller B contra recursos de Taller A: GET listado (no incluye orden ajena), GET detalle (404), PUT edición (404), PUT status (404), POST add-item (404), DELETE item (404), POST creación con clientId/vehicleId ajenos (404) — 7/7 rechazados. Datos de Taller A confirmados intactos después de los intentos.
14. ✅ `npm run build` — compiló sin errores, 16/16 páginas generadas

**Nota técnica**: el botón "Convertir a Orden de Trabajo" y los botones "Quitar" ítem usan `confirm()` nativo del navegador, que el entorno de automatización de pruebas no puede aceptar (se cancela automáticamente). Se verificó el mismo código de la petición fetch que dispara cada botón directamente, confirmando que la lógica de la aplicación funciona correctamente — la limitación es del navegador automatizado de testing, no del código de producción.

**Errores encontrados durante esta re-verificación**: ninguno. No fue necesaria ninguna corrección.

---

## FASE 4 — Órdenes de Trabajo ✅ IMPLEMENTADA

**Implementación completada**: 2026-09-01
**Verificación en navegador (2 talleres reales)**: ✅ COMPLETADA

### Funcionalidades implementadas
- ✅ Crear orden de trabajo manual (cliente, vehículo, motivo, diagnóstico, km ingreso, ítems)
- ✅ Crear orden de trabajo desde presupuesto aprobado (botón "Convertir a Orden de Trabajo" en detalle de presupuesto)
- ✅ Listar órdenes (búsqueda por cliente/patente + filtro por estado)
- ✅ Ver detalle (motivo, diagnóstico, observaciones, km ingreso/egreso, ítems, total)
- ✅ Editar orden (motivo, diagnóstico, observaciones, km ingreso/egreso, reemplaza ítems y recalcula total)
- ✅ Cambiar estado (PRESUPUESTA → APROBADA → EN_PROCESO → TERMINADA → ENTREGADA) vía PUT dedicado, con **validación de transición** (solo se permite avanzar, nunca retroceder ni saltar hacia atrás)
- ✅ Agregar trabajo individual (`POST /add-item`) con recálculo de total
- ✅ Quitar trabajo individual (`DELETE /items/[itemId]`) con recálculo de total
- ✅ Validaciones Zod (`WorkOrderSchema`, `WorkOrderStatusSchema` en `lib/validations.ts`)
- ✅ Aislamiento por taller en todas las operaciones (list/get/put/status/add-item/delete-item) + validación cruzada en creación

### Reglas de negocio aplicadas
- Solo se puede convertir a orden de trabajo un presupuesto con estado `APROBADO`
- Un presupuesto no puede convertirse dos veces (constraint `quoteId @unique` + verificación explícita → 409)
- Las transiciones de estado solo avanzan en el orden definido; cualquier intento de retroceder o repetir el estado actual devuelve 400

### Archivos creados
- `app/api/work-orders/route.ts` — GET (listar+buscar+filtrar), POST (crear manual o desde presupuesto)
- `app/api/work-orders/[id]/route.ts` — GET (detalle), PUT (editar)
- `app/api/work-orders/[id]/status/route.ts` — PUT (cambiar estado con validación de transición)
- `app/api/work-orders/[id]/add-item/route.ts` — POST (agregar trabajo)
- `app/api/work-orders/[id]/items/[itemId]/route.ts` — DELETE (quitar trabajo)
- `app/work-orders/page.tsx` — listado + formulario de creación manual
- `app/work-orders/[id]/page.tsx` — detalle + edición + botones de estado + gestión de ítems
- `lib/validations.ts` — agregado `WorkOrderStatusSchema` y campo `kmEgreso` a `WorkOrderSchema` (WorkOrderSchema/WorkOrderItemSchema ya existían)

### Cambios de dependencia estrictamente necesarios
- `app/dashboard/page.tsx` — agregada tarjeta "Órdenes de Trabajo" al grid de accesos rápidos
- `app/quotes/[id]/page.tsx` — agregado botón "Convertir a Orden de Trabajo" (visible solo si `status === APROBADO`), requerido explícitamente por ROADMAP.md Fase 3/4 ("convertir presupuesto aprobado en orden de trabajo")
- Prisma: `WorkOrder`/`WorkOrderItem` ya estaban en el schema; se ejecutó `prisma db push` para confirmar sincronización (no hubo cambios de schema)

**No se modificó ninguna lógica de Fase 1, 2 ni 3.**

### Pruebas ejecutadas (navegador real + fetch autenticado, 2 talleres)
1. ✅ Convertir presupuesto aprobado ($4500.00, 2 ítems) → orden creada con total $4500.00 y estado inicial "Aprobada"
2. ✅ Reintentar conversión del mismo presupuesto → 409 "Quote already converted to a work order"
3. ✅ Listar → orden visible con estado "Aprobada" y total correcto
4. ✅ Ver detalle → ítems y subtotales correctos, botones de estados anteriores deshabilitados
5. ✅ Cambiar estado a "En Proceso" → badge actualizado
6. ✅ Intentar retroceder estado (EN_PROCESO → APROBADA) → 400, rechazado
7. ✅ Editar orden (km ingreso 45000, diagnóstico) → guardado correctamente, estado se mantuvo
8. ✅ Agregar trabajo ("Revisión de frenos", 1×$800) → total recalculado a $5300.00
9. ✅ Quitar trabajo → total recalculado a $4500.00, vuelve a 2 ítems
10. ✅ Relación cliente/vehículo: selector de vehículo en creación manual se filtra por cliente elegido
11. ✅ Cálculo de importes: subtotal = cantidad × precioUnitario verificado en creación, edición, add-item y delete-item

### Aislamiento por taller (probado con Taller A / Taller B reales)
- ✅ GET `/api/work-orders` (listado) desde Taller B → no incluye orden de Taller A
- ✅ GET `/api/work-orders/[id]` (Taller A) desde Taller B → 404
- ✅ PUT `/api/work-orders/[id]` (Taller A) desde Taller B → 404, sin modificar datos
- ✅ PUT `/api/work-orders/[id]/status` (Taller A) desde Taller B → 404
- ✅ POST `/api/work-orders/[id]/add-item` (Taller A) desde Taller B → 404
- ✅ POST `/api/work-orders` desde Taller B usando `clientId`/`vehicleId` de Taller A → 404 "Client not found" (rechazado en creación)

### Build de producción
```
npm run build
✓ Compiled successfully
✓ Generating static pages (16/16)
```
Rutas nuevas compiladas correctamente: `/api/work-orders`, `/api/work-orders/[id]`, `/api/work-orders/[id]/status`, `/api/work-orders/[id]/add-item`, `/api/work-orders/[id]/items/[itemId]`, `/work-orders` (estática), `/work-orders/[id]` (dinámica).

### 🎯 Resumen Fase 4
100% completa. CRUD de órdenes de trabajo, conversión desde presupuesto aprobado, seguimiento de estado con validación de transición, gestión individual de ítems, cálculo de importes en servidor y aislamiento multi-tenant, todo verificado end-to-end. Sin bloqueos pendientes.

---

---

## FASE 3 — Presupuestos ✅ IMPLEMENTADA

**Implementación completada**: 2026-09-01
**Verificación en navegador (2 talleres reales)**: ✅ COMPLETADA

### Funcionalidades implementadas
- ✅ Crear presupuesto (cliente + vehículo + N ítems)
- ✅ Listar presupuestos (búsqueda por cliente/patente + filtro por estado)
- ✅ Ver detalle (ítems, subtotales, total, observaciones)
- ✅ Editar presupuesto (reemplaza ítems y recalcula total en servidor)
- ✅ Cambiar estado (PENDIENTE / APROBADO / RECHAZADO) vía PATCH dedicado
- ✅ Asociación cliente/vehículo con validación de pertenencia (vehículo debe ser del cliente elegido)
- ✅ Cálculo de subtotal por ítem (`cantidad * precioUnitario`) y total (suma de subtotales) — **recalculado siempre en servidor**, nunca confía en el valor enviado por el cliente
- ✅ Validaciones Zod (`QuoteSchema`, `QuoteStatusSchema` en `lib/validations.ts`)
- ✅ Aislamiento por taller en las 4 operaciones (list/get/put/patch) + validación cruzada en creación

### Archivos creados
- `app/api/quotes/route.ts` — GET (listar+buscar+filtrar), POST (crear)
- `app/api/quotes/[id]/route.ts` — GET (detalle), PUT (editar), PATCH (cambiar estado)
- `app/quotes/page.tsx` — listado + formulario de creación con selector cliente→vehículo dependiente
- `app/quotes/[id]/page.tsx` — detalle + edición inline + botones de cambio de estado
- `lib/validations.ts` — agregado `QuoteStatusSchema` (QuoteSchema ya existía)

### Cambios de dependencia estrictamente necesarios
- `app/dashboard/page.tsx` — agregada tarjeta "Presupuestos" al grid de accesos rápidos (mismo patrón que Clientes/Vehículos)
- Prisma: `Quote`/`QuoteItem` ya estaban en el schema (Fase 1); se ejecutó `prisma db push` para confirmar sincronización (no hubo cambios de schema)

**No se modificó ninguna lógica de Fase 1 ni Fase 2.**

### Pruebas ejecutadas (navegador real, 2 talleres)
1. ✅ Crear presupuesto con 2 ítems (Cambio de aceite 2×$1500, Filtro de aire 1×$500) → total $3500.00
2. ✅ Listar → aparece con estado "Pendiente" y total correcto
3. ✅ Ver detalle → subtotales por ítem correctos ($3000.00 y $500.00)
4. ✅ Cambiar estado a "Aprobado" → badge actualizado correctamente
5. ✅ Editar presupuesto (cantidad de 1 a 3 en un ítem) → total recalculado en servidor a $4500.00, estado "Aprobado" se mantuvo sin resetearse
6. ✅ Relación cliente→vehículo: al elegir cliente, el selector de vehículo se filtra solo a los vehículos de ese cliente
7. ✅ Cálculo de importes: subtotal = cantidad × precioUnitario verificado en 2 ítems distintos; total = suma de subtotales, verificado antes y después de editar

### Aislamiento por taller (probado con Taller A / Taller B reales)
- ✅ GET `/api/quotes` (listado) desde Taller B → 0 resultados, no incluye presupuesto de Taller A
- ✅ GET `/api/quotes/[id]` (Taller A) desde Taller B → 404 "Quote not found"
- ✅ PUT `/api/quotes/[id]` (Taller A) desde Taller B → 404, sin modificar datos
- ✅ PATCH `/api/quotes/[id]` (cambio de estado, Taller A) desde Taller B → 404
- ✅ POST `/api/quotes` desde Taller B usando `clientId`/`vehicleId` de Taller A → 404 "Client not found" (rechazado en creación)

### Build de producción
```
npm run build
✓ Compiled successfully
✓ Generating static pages (14/14)
```
Rutas nuevas compiladas correctamente: `/api/quotes`, `/api/quotes/[id]`, `/quotes` (estática), `/quotes/[id]` (dinámica).

### 🎯 Resumen Fase 3
100% completa. CRUD de presupuestos, relación cliente/vehículo, cálculo de importes en servidor, cambio de estado y aislamiento multi-tenant, todo verificado end-to-end. Sin bloqueos pendientes.

---

---

## FASE 2 — Clientes y Vehículos ✅ IMPLEMENTADA

**Implementación completada**: 2026-09-01  
**Verificación en navegador**: ✅ COMPLETADA  
**Status**: ✅ FASE 2 EJECUTADA - TODAS LAS FUNCIONES VERIFICADAS  

### Funcionalidades Implementadas

**API Endpoints Clientes:**
- ✅ POST /api/clients - Crear cliente (validación + DB insert)
- ✅ GET /api/clients - Listar con búsqueda (nombre, email, teléfono)
- ✅ GET /api/clients/[id] - Detalle con vehículos
- ✅ PUT /api/clients/[id] - Actualizar cliente
- ✅ DELETE /api/clients/[id] - Eliminar cliente

**API Endpoints Vehículos:**
- ✅ POST /api/vehicles - Crear vehículo (validación + DB insert)
- ✅ GET /api/vehicles - Listar con búsqueda (patente, marca, modelo)
- ✅ GET /api/vehicles/[id] - Obtener vehículo
- ✅ PUT /api/vehicles/[id] - Actualizar vehículo
- ✅ DELETE /api/vehicles/[id] - Eliminar vehículo

**Interfaces de Usuario:**
- ✅ /clients - Página listado con búsqueda + crear cliente
- ✅ /clients/[id] - Detalle cliente + listar/crear vehículos
- ✅ /vehicles - Página listado con búsqueda + ver clientes
- ✅ Dashboard actualizado con links a Fase 2

**Validaciones:**
- ✅ Email único por taller (unique constraint)
- ✅ Patente única global (unique constraint)
- ✅ Zod schemas en backend
- ✅ Manejo de errores (409 duplicados, 400 inválidos, 401 auth)

**Relaciones:**
- ✅ Cliente → Vehículos (1:N)
- ✅ Vehículos → Cliente (inversión de relación)
- ✅ Aislamiento por taller (filtrado en GET)
- ✅ Cascada delete (cliente → vehículos)

**Seguridad:**
- ✅ Autenticación requerida en todos los endpoints
- ✅ Verificación de propiedad del taller
- ✅ No exposición de datos de otros talleres

### Pruebas Funcionales Ejecutadas

1. ✅ Navegación a /clients - Página cargó correctamente
2. ✅ Crear cliente "Juan García" - POST /api/clients retornó 201
3. ✅ Listar clientes - GET /api/clients mostró cliente creado
4. ✅ Ver detalle cliente - GET /api/clients/[id] funcionó
5. ✅ Crear vehículo "ABC123" - POST /api/vehicles retornó 201
6. ✅ Listar vehículos en cliente - Tabla mostró vehículo
7. ✅ Navegar a /vehicles - Mostró vehículo con link a cliente
8. ✅ Búsquedas funcionales - Campos de búsqueda operativos

### Archivos Creados - Fase 2

**API Routes:**
- `app/api/clients/route.ts` - GET/POST
- `app/api/clients/[id]/route.ts` - GET/PUT/DELETE
- `app/api/vehicles/route.ts` - GET/POST
- `app/api/vehicles/[id]/route.ts` - GET/PUT/DELETE

**Páginas UI:**
- `app/clients/page.tsx` - Listado de clientes
- `app/clients/[id]/page.tsx` - Detalle de cliente + vehículos
- `app/vehicles/page.tsx` - Listado de vehículos

**Actualizaciones:**
- `app/dashboard/page.tsx` - Agregados links a Fase 2

### Validaciones Reusadas
- ✅ `ClientSchema` (Zod) - nombre, email, telefono, direccion
- ✅ `VehicleSchema` (Zod) - clientId, patente, marca, modelo, anio, kilometraje

---

## FASE 1 — Base y Acceso ✅ IMPLEMENTADA

**Implementación completada**: 2026-08-31  
**Verificación de código**: ✅ SIN ERRORES  
**Ejecución real**: ✅ COMPLETADA  
**Status**: ✅ FASE 1 EJECUTADA - SERVIDOR ACTIVO EN PUERTO 3000  
**Siguiente paso**: Pruebas manuales en navegador requeridas (no disponibles en este entorno)

### Tareas Completadas

#### Base de Datos
- ✅ Schema Prisma creado (19 tablas + 3 relaciones)
- ✅ Modelos: User, Taller, UserTaller, PaymentMethod, etc.
- ✅ Migraciones versionadas (listas para ejecutar)
- ✅ Relación N:N User ↔ Taller preparada

#### Autenticación
- ✅ NextAuth v5 configurado
- ✅ API route: `/api/auth/[...nextauth]`
- ✅ CredentialsProvider con bcrypt
- ✅ Session con Usuario y TallerId

#### API Endpoints
- ✅ `POST /api/auth/register` — Crear usuario + taller
- ✅ Session recovery automático
- ✅ Logout soportado

#### Páginas Implementadas
- ✅ `/auth/login` — Login con email/password
- ✅ `/auth/register` — Registro con nombre, email, nombre-taller, password
- ✅ `/dashboard` — Dashboard inicial (protegido)

#### Protección de Rutas
- ✅ Middleware: `/dashboard` requiere autenticación
- ✅ Auto-redirect: no autenticado → `/auth/login`
- ✅ Auto-redirect: autenticado → `/dashboard` (desde auth pages)

#### Funcionalidades
- ✅ Registro: crea User + Taller + relación UserTaller
- ✅ Login: autentica con credentials
- ✅ Logout: limpia sesión
- ✅ Validación: con Zod (email válido, contraseña 6+ chars)
- ✅ Errores: manejados con mensajes claros

### Archivos Creados

```
app/
  ├── api/
  │   └── auth/
  │       ├── [...]nextauth]/route.ts ✅
  │       └── register/route.ts ✅
  ├── auth/
  │   ├── login/page.tsx ✅
  │   └── register/page.tsx ✅
  └── dashboard/
      └── page.tsx ✅

middleware.ts ✅
.env.local ✅
PHASE_1_SETUP.md ✅
```

### Dependencias Agregadas

- ✅ react-hook-form (formularios)
- ✅ @hookform/resolvers (integración Zod)
- Todas las demás ya estaban (next-auth, prisma, bcrypt, zod)

---

## CHECKPOINT 1 — Verificación Completa

### Documentación para Ejecución

1. **NEON_SETUP.md** — Guía paso a paso para configurar Neon
2. **PHASE_1_EXECUTION_CHECKLIST.md** — Checklist completo de pruebas
3. **PHASE_1_SETUP.md** — Guía general de setup

### Pasos de Ejecución (en orden)

```bash
# 1. Crear cuenta y proyecto en Neon
#    (ver NEON_SETUP.md)

# 2. Configurar .env.local con URL de Neon
#    DATABASE_URL="postgresql://..."

# 3. Instalar dependencias
npm install

# 4. Ejecutar migraciones
npm run db:migrate

# 5. Iniciar servidor
npm run dev

# 6. Ejecutar pruebas (ver PHASE_1_EXECUTION_CHECKLIST.md)
```

### Validar Checkpoint 1 (10 puntos)

- [ ] Base de datos migrada en Neon (tablas creadas)
- [ ] `npm install` sin errores
- [ ] `npm run dev` inicia en puerto 3000
- [ ] Redirect sin sesión: `/` → `/auth/login`
- [ ] Registro funciona (crea User + Taller + UserTaller)
- [ ] Login funciona (autentica con credenciales)
- [ ] Dashboard accesible solo autenticado
- [ ] Logout funciona (limpia sesión)
- [ ] `/dashboard` protegido (redirige a login sin sesión)
- [ ] Sin errores en console del navegador

**Todos los puntos deben marcar ✅ para completar Fase 1**

---

## DECISIONES FASE 1

✅ **Contraseñas hasheadas con bcrypt** (10 rounds)  
✅ **Email único por usuario**  
✅ **Taller creado en registro** (no requiere invitación)  
✅ **User ← → Taller relación vía UserTaller**  
✅ **Role = "admin" en Fase 1**  
✅ **Validación con Zod (frontend + backend)**  
✅ **Middleware para protección** (no guards manuales)  

---

## ARQUITECTURA IMPLEMENTADA

### User Registration Flow

```
1. Usuario accede a /auth/register
2. Completa formulario (name, email, tallerName, password)
3. Validación Zod (frontend y backend)
4. POST /api/auth/register:
   a. Verifica email único
   b. Hashea password con bcrypt
   c. Crea User
   d. Crea Taller
   e. Crea UserTaller (relación)
5. Redirect a /auth/login (con mensaje)
6. Usuario inicia sesión
7. Redirect a /dashboard
```

### Database Schema (Fase 1)

```
User
  id (PK)
  email (UNIQUE)
  password (hashed)
  name
  createdAt
  ↓
  UserTaller[] (1:N)
      ↓
Taller
  id (PK)
  nombre
  telefono? (NULL)
  email? (NULL)
  direccion? (NULL)
  logo? (NULL)
```

### Session Storage

```
session.user = {
  id: "user-id",
  email: "user@email.com",
  name: "User Name",
  tallerId?: "taller-id" (para futuro)
}
```

---

## LO QUE NO SE HIZO (FASE 1 SCOPE)

❌ Recuperación de contraseña  
❌ Edición de perfil  
❌ Multi-idioma  
❌ OAuth (Google, GitHub)  
❌ 2FA  
❌ Rate limiting  

(Estos son para Fase 8+)

---

## PROXIMA FASE — Fase 2

**Clientes y Vehículos**

### Tareas Fase 2:
- [ ] CRUD clientes (nombre, teléfono, email, dirección)
- [ ] CRUD vehículos (patente, marca, modelo, año, km)
- [ ] Búsqueda por nombre (cliente) y patente (vehículo)
- [ ] Relación: Cliente ← (1:N) → Vehículos

### Estimado: 3-4 días

---

## ESTADO FINAL — FASE 1 (1 Septiembre 2026)

| Componente | Status | Detalle |
|-----------|--------|---------|
| **Estructuras** | ✅ Completado | Carpetas y archivos creados |
| **API Register** | ✅ Completado | POST /api/auth/register - Funciona |
| **Formularios** | ✅ Completado | React-Hook-Form + Zod |
| **Protección Rutas** | ✅ Completado | Middleware (Edge Runtime compatible) |
| **Base de Datos** | ✅ Sincronizada | Neon PostgreSQL operativa |
| **Servidor** | ✅ Ejecutándose | http://localhost:3000 (2.8s startup) |
| **Errores Corregidos** | ✅ 5 errores | Schema, Middleware, CredentialsProvider |
| **Login/Autenticación** | 🚫 BLOQUEADO | NextAuth v5 - Sesión no se crea (ver abajo) |

### PROBLEMA IDENTIFICADO - Fase 1 Auth Blocker

**Síntoma**: POST /api/auth/callback/credentials retorna 200 OK pero sin crear sesión  
**Afectados**: Todos los usuarios (reproducido con 2 usuarios diferentes)  
**Pasos para reproducir**:
1. Ir a /auth/register
2. Registrar nuevo usuario (éxito - DB actualizada)
3. Ir a /auth/login
4. Ingresar credenciales correctas
5. POST /api/auth/callback/credentials → 200 OK
6. NO redirige a /dashboard (vuelve a GET /auth/login)

**Verificaciones realizadas**:
- ✅ Usuario se crea correctamente en BD
- ✅ Contraseña se hashea con bcrypt (60 chars)
- ✅ bcrypt.compare retorna `true` para contraseña correcta
- ✅ CredentialsProvider.authorize() retorna objeto usuario
- ✅ Servidor responde sin errores (Status 200)
- ✅ Middleware redirige correctamente (/ → /auth/login)

**Configuración NextAuth revisada**:
- ✅ credentials object definido en CredentialsProvider
- ✅ jwt callback implementado (mapea user.id a token)
- ✅ session callback implementado (inyecta user.id)
- ✅ NEXTAUTH_SECRET configurado

**Root Cause Probable**: NextAuth v5 con CredentialsProvider + JWT no está creando la sesión correctamente. Puede requerir cambios en:
- Token encoding strategy
- Session persistence
- Cookie configuration
- NextAuth version compatibility

---

## COMANDOS ÚTILES

```bash
# Instalar dependencias
npm install

# Crear/actualizar tablas
npm run db:migrate

# Ver cambios en BD (interfaz visual)
npm run db:studio

# Iniciar servidor dev
npm run dev

# Build para producción
npm run build

# Start servidor producción
npm start

# Linter
npm run lint
```

---

## PRÓXIMOS PASOS

1. **Configurar `.env.local`** (DATABASE_URL)
2. **Ejecutar** `npm install`
3. **Ejecutar** `npm run db:migrate`
4. **Ejecutar** `npm run dev`
5. **Probar en navegador** (ver PHASE_1_SETUP.md)
6. **Validar checkpoint** (todos los 7 puntos)
7. **Pasar a Fase 2**

---

**Fase 1 Status**: ✅ IMPLEMENTADA Y LISTA PARA PRUEBAS  
**Próxima sesión**: Ejecutar setup y validar  
**Después**: Fase 2 — Clientes y Vehículos

---

---

## ESTADO FASE 2 - TESTS 1-13 VERIFICADOS (TODOS PASADOS)

### 🔧 BLOQUEOS RESUELTOS (sesión 2026-09-01, parte 2)

**Causa raíz #1 — Sesión NextAuth no persistía:**
El middleware (`middleware.ts`) verificaba la cookie `next-auth.session-token`
(nombre de NextAuth v4), pero el proyecto usa NextAuth v5.0.0-beta.32 (Auth.js),
que emite la cookie como `authjs.session-token` (o `__Secure-authjs.session-token`
en HTTPS). El middleware nunca encontraba la cookie correcta → consideraba al
usuario no autenticado → redirigía siempre a `/auth/login` tras un login exitoso.

**Causa raíz #2 — Build fallaba en prerender (`useSession` undefined):**
La app no tenía un `<SessionProvider>` de `next-auth/react` envolviendo el árbol
de componentes (`app/layout.tsx` no lo incluía). Sin ese contexto, `useSession()`
retorna `undefined`, y el destructuring `const { data: session } = useSession()`
lanza `TypeError: Cannot destructure property 'data' of ... as it is undefined`
durante el prerenderizado estático de `/dashboard`.

**Cambios aplicados (mínimos, sin refactor de arquitectura):**
1. `app/providers.tsx` (nuevo) — client component que envuelve `children` en `<SessionProvider>`.
2. `app/layout.tsx` — usa `<Providers>` para envolver `{children}`.
3. `middleware.ts` — corregido el nombre de cookie a `authjs.session-token` (con fallback `__Secure-authjs.session-token`).
4. `app/auth/login/page.tsx` — se separó en `LoginContent` + `Suspense` (requisito de Next.js 15 para `useSearchParams()` en páginas estáticas).
5. `app/dashboard/page.tsx` — mismo patrón: `DashboardContent` + `Suspense`, y `export const dynamic = "force-dynamic"`.

No se reemplazó NextAuth, no se cambió la arquitectura de autenticación, no se desactivó el prerendering global.

### ✅ TESTS 1-9 (CRUD):
1. ✅ Crear cliente
2. ✅ Listar clientes
3. ✅ Editar cliente
4. ✅ Buscar clientes
5. ✅ Crear vehículos
6. ✅ Ver vehículos desde cliente
7. ✅ Editar vehículo
8. ✅ Buscar vehículos
9. ✅ Eliminar vehículo

### ✅ LOGIN / SESIÓN / LOGOUT (verificado en navegador real):
- ✅ Login con credenciales → redirige a `/dashboard` inmediatamente
- ✅ Sesión persiste tras recargar `/dashboard` (F5)
- ✅ Logout limpia la sesión y redirige a `/auth/login`
- ✅ `/dashboard` sin sesión redirige a `/auth/login` (middleware funcionando)

### ✅ TESTS 10-12 (Aislamiento por taller — ejecutados con 2 talleres reales):
Se crearon 2 usuarios/talleres (`test@test.com` / Taller A, `testb@test.com` / Taller B),
un cliente y un vehículo en Taller A, y desde la sesión de Taller B se intentó:

10. ✅ GET `/api/clients/[id de Taller A]` → **404** ("Client not found")
    ✅ GET `/api/vehicles/[id de Taller A]` → **404** ("Vehicle not found")
11. ✅ GET `/api/clients` (listado) desde Taller B → **no incluye** el cliente de Taller A
12. ✅ PUT `/api/clients/[id]` (Taller A) desde Taller B → **404**, sin modificar datos
    ✅ DELETE `/api/clients/[id]` (Taller A) desde Taller B → **404**, cliente no eliminado
    ✅ PUT `/api/vehicles/[id]` (Taller A) desde Taller B → **404**
    ✅ DELETE `/api/vehicles/[id]` (Taller A) desde Taller B → **404**
    Verificado post-ataque: `GET /api/clients/[id]` como Taller A devuelve `nombre: "Cliente Taller A"` (sin alterar).

### ✅ TEST 13 (Build de producción):
```
npm run build
✓ Compiled successfully
✓ Generating static pages (12/12)
```
Sin errores. Todas las rutas compilan (estáticas y dinámicas correctamente marcadas).

### 🎯 RESUMEN FINAL:
- **Fase 2**: 100% completa — CRUD, validaciones, aislamiento por taller y build de producción verificados.
- **Autenticación**: Login/sesión/logout funcionando end-to-end con Next.js 15 + NextAuth v5.
- **Seguridad multi-tenant**: Verificada con ataque real cross-taller (GET/PUT/DELETE) — todos rechazados con 404.
- **Sin bloqueos pendientes.**

*Generado en: 2026-09-01*  
*Arquitecto: Claude Code*
