# Release del módulo de Stock — procedimiento y rollback

Estado: validado en QA (branch `run-stock-1`, PostgreSQL 18.6 igual que producción). Nada de esto se aplicó en producción.

## Regla de oro: primero la base, después el código

- **Código nuevo sobre esquema viejo = rutas de órdenes y presupuestos con error** (faltan `productId` y las columnas decimales).
- **Código viejo sobre esquema nuevo = funciona** (verificado: 47/47 en QA). Por eso la migración va SIEMPRE antes que el push.
- `git push` a `master` despliega a producción de inmediato: no pushear hasta que la migración esté aplicada y verificada.
- Vercel NO ejecuta migraciones. Si el proyecto de Vercel usa la base de producción también en *Preview*, no pushear la rama a ningún otro lado antes de migrar.

## Pasos

1. **Commit** (lo decide el equipo). El hotfix de cantidades enteras queda superado por este release: la regla nueva
   (hasta 3 decimales + columnas `DECIMAL(12,3)`) corrige el mismo problema de raíz. Solo si el release se demorara,
   el parche suelto está en `hotfix_cantidad_entera.patch` (carpeta temporal de la sesión de QA).
2. **Punto de restauración**: en la consola de Neon, crear una branch `pre-stock-release` desde `main` de producción
   (o confirmar el PITR vigente). Se borra cuando el release esté validado.
3. **Preflight de solo lectura** sobre producción: `npx prisma migrate status` debe decir 4 migraciones y "up to date";
   `SHOW server_version` debe ser 18.x.
4. **Aplicar la migración** (con autorización explícita, en horario de poco movimiento: toma ~1 s y bloquea lecturas de
   `quote_items`/`work_order_items` y escrituras de `work_orders`, `tallers` y `users` durante ese tiempo). Con la
   cadena DIRECTA de producción (sin `-pooler`), en PowerShell:
   `$env:DATABASE_URL = "<cadena directa de producción>"; npx prisma migrate deploy`
5. **Verificar la base**: `npx prisma migrate status` → 5 migraciones, "up to date". La migración es atómica: si falla,
   no queda nada a medias (probado); se recupera con `npx prisma migrate resolve --rolled-back 20261102150000_stock_productos_y_movimientos`
   y se reintenta.
6. **Desplegar el código**: `git push origin master`; esperar Vercel READY/PRODUCTION.
7. **Smoke en producción** (por el pooler, el camino real): login; `/dashboard` carga; `/products` carga vacío;
   crear un presupuesto y una orden SIN producto y pasarla de estado (flujo existente intacto); crear un producto con
   stock 0 en el taller de QA y verlo en el listado. No cargar compras ni descontar stock en producción: el libro es
   inmutable y esos datos no se pueden borrar. Si se creó un producto de prueba, eliminar esa única fila (sin movimientos) con autorización.
8. Borrar la branch `pre-stock-release` al cerrar.

## Rollback

| Situación | Acción |
|---|---|
| Falla el código después del deploy | Vercel → Deployments → "Instant Rollback" al deploy anterior. La base queda migrada: el código anterior funciona con ella. |
| Falla la migración | No hay que hacer nada en la base (atómica). `migrate resolve --rolled-back` y reintentar. |
| Hay que deshacer la migración | Solo si NO hay stock real ni cantidades fraccionarias: primero rollback de código, luego ejecutar `scripts/release/stock-rollback.sql` (probado: deja el esquema idéntico al de las 4 migraciones anteriores y conserva los datos). |
| Ya se usó el módulo (hay movimientos) | NO ejecutar el SQL: restaurar con Neon (branch `pre-stock-release` o PITR). |

## Riesgos conocidos

- Ventana entre el paso 4 y el 6: el código viejo trunca cantidades fraccionarias (1,5 → 1). Producción no tiene filas de negocio; el riesgo es nulo si no se cargan presupuestos en ese lapso.
- Serialización global de `Decimal` (`lib/decimal.ts`): cubierta por tests; devuelve texto si un valor superara 15 dígitos.
- Los valores nuevos de `AuditAction` no se pueden quitar de PostgreSQL (inofensivos).
- `package.json` suma `pg` como dependencia de desarrollo (solo para scripts de QA).
- No verificado: pantalla del modal de devolución y ediciones de ítems en agenda/presupuesto (sí cubiertas por E2E de API); las pruebas de integración de la última versión de devoluciones se corrieron por conexión directa.
