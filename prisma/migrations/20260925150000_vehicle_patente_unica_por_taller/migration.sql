-- La patente pasa de ser única globalmente a ser única por taller.
-- Migración NO destructiva: no elimina filas ni columnas con datos.

-- 1) Nueva columna tallerId en vehicles, completada desde el cliente dueño (todo vehículo tiene cliente por FK).
ALTER TABLE "vehicles" ADD COLUMN "tallerId" TEXT;
UPDATE "vehicles" v SET "tallerId" = c."tallerId" FROM "clients" c WHERE c."id" = v."clientId";
ALTER TABLE "vehicles" ALTER COLUMN "tallerId" SET NOT NULL;

-- 2) Quitar la unicidad global ANTES de normalizar: dos talleres pueden tener la misma patente.
DROP INDEX "vehicles_patente_key";

-- 3) Normalizar patentes existentes (mayúsculas, sin espacios ni guiones), igual que la aplicación.
UPDATE "vehicles" SET "patente" = UPPER(REGEXP_REPLACE("patente", '[[:space:]-]+', '', 'g'));

-- 4) Unicidad por taller. Si dentro de un mismo taller dos patentes quedaran iguales tras normalizar,
--    este índice falla y la migración se aborta sin modificar nada más (ver pre-chequeo de colisiones).
CREATE UNIQUE INDEX "vehicles_tallerId_patente_key" ON "vehicles"("tallerId", "patente");

-- 5) Integridad referencial hacia el taller.
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_tallerId_fkey" FOREIGN KEY ("tallerId") REFERENCES "tallers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
