-- Módulo de stock: productos, libro de movimientos e integración opcional con ítems de presupuesto y orden.
--
-- Migración ADITIVA: no elimina ni modifica datos. Solo hay dos cambios sobre estructuras existentes:
--   * quote_items.cantidad y work_order_items.cantidad pasan de INTEGER a DECIMAL(12,3) (conversión sin pérdida de valores).
--   * quote_items / work_order_items reciben la columna opcional productId (NULL en todas las filas actuales).
-- Todo lo demás son tablas, tipos, columnas con default, índices, restricciones y triggers nuevos.
--
-- PARTE 1: SQL generado por Prisma a partir de schema.prisma (prisma migrate diff). No editar a mano.
-- PARTE 2: restricciones CHECK y triggers de integridad (no los expresa Prisma).

-- CreateEnum
CREATE TYPE "ProductUnit" AS ENUM ('UNIDAD', 'LITRO', 'KILO', 'METRO', 'JUEGO', 'PAR');
-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('ENTRADA_COMPRA', 'SALIDA_ORDEN', 'AJUSTE', 'DEVOLUCION', 'ANULACION');
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.
ALTER TYPE "AuditAction" ADD VALUE 'PRODUCT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'PRODUCT_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'STOCK_PURCHASED';
ALTER TYPE "AuditAction" ADD VALUE 'STOCK_ADJUSTED';
ALTER TYPE "AuditAction" ADD VALUE 'STOCK_CONSUMED';
ALTER TYPE "AuditAction" ADD VALUE 'STOCK_RETURNED';
ALTER TYPE "AuditAction" ADD VALUE 'STOCK_POLICY_CHANGED';
-- AlterTable
ALTER TABLE "tallers" ADD COLUMN     "permitirStockNegativo" BOOLEAN NOT NULL DEFAULT false;
-- AlterTable
ALTER TABLE "quote_items" ADD COLUMN     "productId" TEXT,
ALTER COLUMN "cantidad" SET DEFAULT 1,
ALTER COLUMN "cantidad" SET DATA TYPE DECIMAL(12,3);
-- AlterTable
ALTER TABLE "work_order_items" ADD COLUMN     "productId" TEXT,
ALTER COLUMN "cantidad" SET DEFAULT 1,
ALTER COLUMN "cantidad" SET DATA TYPE DECIMAL(12,3);
-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "tallerId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "sku" TEXT,
    "categoria" TEXT,
    "unidad" "ProductUnit" NOT NULL DEFAULT 'UNIDAD',
    "costo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "precioVenta" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stockActual" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "stockMinimo" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "tallerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "workOrderId" TEXT,
    "tipo" "StockMovementType" NOT NULL,
    "cantidad" DECIMAL(12,3) NOT NULL,
    "costoUnitario" DOUBLE PRECISION,
    "motivo" TEXT,
    "stockResultante" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "products_tallerId_activo_idx" ON "products"("tallerId", "activo");
-- CreateIndex
CREATE INDEX "products_tallerId_nombre_idx" ON "products"("tallerId", "nombre");
-- CreateIndex
CREATE UNIQUE INDEX "products_tallerId_sku_key" ON "products"("tallerId", "sku");
-- CreateIndex
CREATE UNIQUE INDEX "products_id_tallerId_key" ON "products"("id", "tallerId");
-- CreateIndex
CREATE INDEX "stock_movements_tallerId_productId_createdAt_idx" ON "stock_movements"("tallerId", "productId", "createdAt");
-- CreateIndex
CREATE INDEX "stock_movements_workOrderId_productId_idx" ON "stock_movements"("workOrderId", "productId");
-- CreateIndex
CREATE INDEX "stock_movements_userId_idx" ON "stock_movements"("userId");
-- CreateIndex
CREATE INDEX "quote_items_productId_idx" ON "quote_items"("productId");
-- CreateIndex
CREATE INDEX "work_order_items_productId_idx" ON "work_order_items"("productId");
-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "work_order_items" ADD CONSTRAINT "work_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_tallerId_fkey" FOREIGN KEY ("tallerId") REFERENCES "tallers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_tallerId_fkey" FOREIGN KEY ("tallerId") REFERENCES "tallers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_productId_tallerId_fkey" FOREIGN KEY ("productId", "tallerId") REFERENCES "products"("id", "tallerId") ON DELETE RESTRICT ON UPDATE RESTRICT;
-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ============================================================================
-- PARTE 2 — INTEGRIDAD (escrita a mano)
-- Las funciones usan nombres de tabla SIN calificar: se resuelven con el search_path de la conexión
-- (public en producción; el schema aislado en las pruebas), igual que las tablas creadas arriba.
-- ============================================================================

-- 2.1 Restricciones CHECK -------------------------------------------------------

ALTER TABLE "products" ADD CONSTRAINT "products_nombre_no_vacio" CHECK (btrim("nombre") <> '');
ALTER TABLE "products" ADD CONSTRAINT "products_sku_no_vacio" CHECK ("sku" IS NULL OR btrim("sku") <> '');
ALTER TABLE "products" ADD CONSTRAINT "products_costo_no_negativo" CHECK ("costo" >= 0);
ALTER TABLE "products" ADD CONSTRAINT "products_precio_no_negativo" CHECK ("precioVenta" >= 0);
ALTER TABLE "products" ADD CONSTRAINT "products_stock_minimo_no_negativo" CHECK ("stockMinimo" >= 0);

ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_cantidad_no_cero" CHECK ("cantidad" <> 0);
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_signo_por_tipo" CHECK (
  ("tipo" <> 'ENTRADA_COMPRA' OR "cantidad" > 0)
  AND ("tipo" <> 'SALIDA_ORDEN' OR "cantidad" < 0)
  AND ("tipo" <> 'DEVOLUCION' OR "cantidad" > 0)
);
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_orden_requerida" CHECK (
  "tipo" NOT IN ('SALIDA_ORDEN', 'DEVOLUCION') OR "workOrderId" IS NOT NULL
);
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_motivo_requerido" CHECK (
  "tipo" NOT IN ('AJUSTE', 'DEVOLUCION', 'ANULACION') OR ("motivo" IS NOT NULL AND btrim("motivo") <> '')
);
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_costo_no_negativo" CHECK ("costoUnitario" IS NULL OR "costoUnitario" >= 0);

-- 2.2 Productos: el stock inicial es siempre 0, el taller no cambia y stockActual solo lo mueve el libro ------

CREATE FUNCTION "products_guard_insert"() RETURNS trigger AS $$
BEGIN
  IF NEW."stockActual" <> 0 THEN
    RAISE EXCEPTION 'Un producto nuevo debe empezar con stock 0: el stock inicial se carga como movimiento de entrada.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "products_guard_insert_trg"
  BEFORE INSERT ON "products"
  FOR EACH ROW EXECUTE FUNCTION "products_guard_insert"();

CREATE FUNCTION "products_guard_update"() RETURNS trigger AS $$
BEGIN
  IF NEW."tallerId" <> OLD."tallerId" THEN
    RAISE EXCEPTION 'Un producto no puede cambiar de taller.' USING ERRCODE = '23514';
  END IF;
  IF NEW."stockActual" IS DISTINCT FROM OLD."stockActual"
     AND COALESCE(current_setting('automek.stock_writer', true), '') <> '1' THEN
    RAISE EXCEPTION 'El stock solo puede modificarse mediante movimientos de stock.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "products_guard_update_trg"
  BEFORE UPDATE ON "products"
  FOR EACH ROW EXECUTE FUNCTION "products_guard_update"();

-- 2.3 Libro de movimientos: orden del mismo taller, bloqueo del producto, política de stock negativo,
--     stockResultante y actualización atómica de products.stockActual dentro de la transacción del INSERT ------

CREATE FUNCTION "stock_movements_before_insert"() RETURNS trigger AS $$
DECLARE
  v_orden_taller TEXT;
  v_stock        NUMERIC(12,3);
  v_permitir     BOOLEAN;
BEGIN
  IF NEW."workOrderId" IS NOT NULL THEN
    SELECT "tallerId" INTO v_orden_taller FROM "work_orders" WHERE "id" = NEW."workOrderId";
    IF v_orden_taller IS DISTINCT FROM NEW."tallerId" THEN
      RAISE EXCEPTION 'La orden de trabajo no pertenece al taller del movimiento de stock.' USING ERRCODE = '23514';
    END IF;
  END IF;

  -- Serializa los movimientos concurrentes del mismo producto
  SELECT "stockActual" INTO v_stock
    FROM "products"
   WHERE "id" = NEW."productId" AND "tallerId" = NEW."tallerId"
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El producto no existe en este taller.' USING ERRCODE = '23503';
  END IF;

  v_stock := v_stock + NEW."cantidad";

  IF v_stock < 0 THEN
    SELECT "permitirStockNegativo" INTO v_permitir FROM "tallers" WHERE "id" = NEW."tallerId";
    IF NOT COALESCE(v_permitir, false) THEN
      RAISE EXCEPTION 'Stock insuficiente: el movimiento dejaría el stock en %.', v_stock USING ERRCODE = '23514';
    END IF;
  END IF;

  NEW."stockResultante" := v_stock;

  PERFORM set_config('automek.stock_writer', '1', true);
  UPDATE "products" SET "stockActual" = v_stock, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = NEW."productId";
  PERFORM set_config('automek.stock_writer', '', true);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "stock_movements_before_insert_trg"
  BEFORE INSERT ON "stock_movements"
  FOR EACH ROW EXECUTE FUNCTION "stock_movements_before_insert"();

-- 2.4 Inmutabilidad del libro ---------------------------------------------------------

CREATE FUNCTION "stock_movements_inmutable"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Los movimientos de stock son inmutables: registrá un movimiento nuevo para corregir.' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "stock_movements_inmutable_row_trg"
  BEFORE UPDATE OR DELETE ON "stock_movements"
  FOR EACH ROW EXECUTE FUNCTION "stock_movements_inmutable"();

CREATE TRIGGER "stock_movements_inmutable_truncate_trg"
  BEFORE TRUNCATE ON "stock_movements"
  FOR EACH STATEMENT EXECUTE FUNCTION "stock_movements_inmutable"();

-- 2.5 Ítems de presupuesto y de orden: el producto debe ser del mismo taller que el documento ------------

CREATE FUNCTION "quote_items_producto_mismo_taller"() RETURNS trigger AS $$
DECLARE
  v_producto_taller  TEXT;
  v_documento_taller TEXT;
BEGIN
  IF NEW."productId" IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT "tallerId" INTO v_producto_taller FROM "products" WHERE "id" = NEW."productId";
  SELECT "tallerId" INTO v_documento_taller FROM "quotes" WHERE "id" = NEW."quoteId";
  IF v_producto_taller IS DISTINCT FROM v_documento_taller THEN
    RAISE EXCEPTION 'El producto no pertenece al taller del presupuesto.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "quote_items_producto_mismo_taller_trg"
  BEFORE INSERT OR UPDATE OF "productId", "quoteId" ON "quote_items"
  FOR EACH ROW EXECUTE FUNCTION "quote_items_producto_mismo_taller"();

CREATE FUNCTION "work_order_items_producto_mismo_taller"() RETURNS trigger AS $$
DECLARE
  v_producto_taller  TEXT;
  v_documento_taller TEXT;
BEGIN
  IF NEW."productId" IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT "tallerId" INTO v_producto_taller FROM "products" WHERE "id" = NEW."productId";
  SELECT "tallerId" INTO v_documento_taller FROM "work_orders" WHERE "id" = NEW."workOrderId";
  IF v_producto_taller IS DISTINCT FROM v_documento_taller THEN
    RAISE EXCEPTION 'El producto no pertenece al taller de la orden de trabajo.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "work_order_items_producto_mismo_taller_trg"
  BEFORE INSERT OR UPDATE OF "productId", "workOrderId" ON "work_order_items"
  FOR EACH ROW EXECUTE FUNCTION "work_order_items_producto_mismo_taller"();
