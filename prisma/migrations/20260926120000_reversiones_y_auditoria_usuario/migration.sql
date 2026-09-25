-- Reversiones contables de pagos/movimientos + usuario en auditoría.
-- Migración NO destructiva: solo agrega un valor de enum, columnas NULL, índices y claves foráneas. No modifica ni elimina filas.

-- AlterEnum
ALTER TYPE "CashMovementCategory" ADD VALUE 'REVERSION';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "anuladoAt" TIMESTAMP(3),
ADD COLUMN     "anuladoMotivo" TEXT;

-- AlterTable
ALTER TABLE "cash_movements" ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "motivo" TEXT,
ADD COLUMN     "reversalOfId" TEXT;

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "cash_movements_reversalOfId_key" ON "cash_movements"("reversalOfId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "cash_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

