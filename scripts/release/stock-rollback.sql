-- ROLLBACK de la migración 20261102150000_stock_productos_y_movimientos.
-- SOLO es válido mientras NO exista stock real cargado (se borran products y stock_movements) y no haya cantidades
-- fraccionarias en ítems (se redondean al entero). Si ya se usó el módulo, NO ejecutar: restaurar desde un punto en el
-- tiempo de Neon. Los valores nuevos del enum "AuditAction" no se pueden quitar en PostgreSQL (son inofensivos).
-- Ejecutar primero el código anterior en Vercel (rollback de deploy) y recién después este script, en una transacción.
BEGIN;

-- 1) Triggers y funciones que dependen de las tablas nuevas
DROP TRIGGER IF EXISTS "work_order_items_producto_mismo_taller_trg" ON "work_order_items";
DROP TRIGGER IF EXISTS "quote_items_producto_mismo_taller_trg" ON "quote_items";
DROP FUNCTION IF EXISTS "work_order_items_producto_mismo_taller"();
DROP FUNCTION IF EXISTS "quote_items_producto_mismo_taller"();

-- 2) Columnas nuevas de los ítems (quita también sus claves foráneas e índices) y vuelta de cantidad a entero
ALTER TABLE "work_order_items" DROP COLUMN "productId";
ALTER TABLE "quote_items" DROP COLUMN "productId";
ALTER TABLE "work_order_items" ALTER COLUMN "cantidad" DROP DEFAULT;
ALTER TABLE "work_order_items" ALTER COLUMN "cantidad" TYPE INTEGER USING round("cantidad")::integer;
ALTER TABLE "work_order_items" ALTER COLUMN "cantidad" SET DEFAULT 1;
ALTER TABLE "quote_items" ALTER COLUMN "cantidad" DROP DEFAULT;
ALTER TABLE "quote_items" ALTER COLUMN "cantidad" TYPE INTEGER USING round("cantidad")::integer;
ALTER TABLE "quote_items" ALTER COLUMN "cantidad" SET DEFAULT 1;

-- 3) Tablas de stock (los triggers de inmutabilidad se van con la tabla) y sus funciones
DROP TABLE "stock_movements";
DROP TABLE "products";
DROP FUNCTION IF EXISTS "stock_movements_before_insert"();
DROP FUNCTION IF EXISTS "stock_movements_inmutable"();
DROP FUNCTION IF EXISTS "products_guard_insert"();
DROP FUNCTION IF EXISTS "products_guard_update"();

-- 4) Política de stock negativo y tipos
ALTER TABLE "tallers" DROP COLUMN "permitirStockNegativo";
DROP TYPE "StockMovementType";
DROP TYPE "ProductUnit";

-- 5) Que Prisma vuelva a considerar pendiente la migración
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261102150000_stock_productos_y_movimientos';

COMMIT;
