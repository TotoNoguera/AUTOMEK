-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('PRESUPUESTA', 'APROBADA', 'EN_PROCESO', 'TERMINADA', 'ENTREGADA');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('PENDIENTE', 'CONFIRMADO', 'EN_ESPERA', 'CANCELADO', 'COMPLETADO');

-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'CUENTA_CORRIENTE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PAGADO', 'PENDIENTE', 'ANULADO');

-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('INGRESO', 'EGRESO');

-- CreateEnum
CREATE TYPE "CashMovementCategory" AS ENUM ('PAGO_ORDEN', 'ANTICIPO', 'COMPRA_REPUESTOS', 'COMPRA_MATERIALES', 'GASTO_SERVICIOS', 'GASTO_MANTENIMIENTO', 'GASTO_SUELDOS', 'GASTO_ALQUILER', 'GASTO_SERVICIOS_UTILES', 'GASTO_IMPUESTOS', 'GASTO_OTROS', 'COSTO_FIJO_DIARIO', 'COSTO_VARIABLE_DIARIO');

-- CreateEnum
CREATE TYPE "DailyCloseStatus" AS ENUM ('ABIERTO', 'CERRADO', 'REABIERTO');

-- CreateEnum
CREATE TYPE "CostTypeEnum" AS ENUM ('FIJO', 'VARIABLE');

-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('INGRESO_MENSUAL', 'ORDENES_MENSUALES', 'CLIENTES_NUEVOS');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('EN_PROGRESO', 'ALCANZADO', 'NO_ALCANZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('QUOTE_CREATED', 'QUOTE_APPROVED', 'QUOTE_REJECTED', 'QUOTE_CONVERTED_TO_WORK_ORDER', 'WORK_ORDER_CREATED', 'WORK_ORDER_STATUS_CHANGED', 'WORK_ORDER_COMPLETED', 'WORK_ORDER_DELIVERED', 'PAYMENT_RECORDED', 'PAYMENT_ANNULLED', 'PAYMENT_UPDATED', 'CASH_MOVEMENT_RECORDED', 'DAILY_CLOSE_CLOSED', 'DAILY_CLOSE_REOPENED', 'CLIENT_CREDIT_UPDATED', 'SCHEDULE_STATUS_CHANGED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tallers" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "email" TEXT,
    "direccion" TEXT,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tallers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_tallers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tallerId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_tallers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "tallerId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "email" TEXT,
    "direccion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "patente" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "kilometraje" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "tallerId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'PENDIENTE',
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_items" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "precioUnitario" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" TEXT NOT NULL,
    "tallerId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "quoteId" TEXT,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'APROBADA',
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "motivoIngreso" TEXT NOT NULL,
    "diagnostico" TEXT,
    "observaciones" TEXT,
    "kmIngreso" INTEGER,
    "kmEgreso" INTEGER,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_items" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "precioUnitario" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL,
    "tallerId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "hora" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'PENDIENTE',
    "workOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" TEXT NOT NULL,
    "tallerId" TEXT NOT NULL,
    "tipo" "PaymentMethodType" NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "tallerId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "methodId" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PAGADO',
    "numeroComprobante" TEXT,
    "observaciones" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_movements" (
    "id" TEXT NOT NULL,
    "tallerId" TEXT NOT NULL,
    "tipo" "CashMovementType" NOT NULL,
    "categoria" "CashMovementCategory" NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "descripcion" TEXT,
    "workOrderId" TEXT,
    "paymentId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_closes" (
    "id" TEXT NOT NULL,
    "tallerId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "estado" "DailyCloseStatus" NOT NULL DEFAULT 'ABIERTO',
    "saldoInicial" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalIngresos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalEgresos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "saldoFinal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notas" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_closes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_credits" (
    "id" TEXT NOT NULL,
    "tallerId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "saldo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "creditLimit" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technicians" (
    "id" TEXT NOT NULL,
    "tallerId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT,
    "telefono" TEXT,
    "especialidad" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technicians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "costs" (
    "id" TEXT NOT NULL,
    "tallerId" TEXT NOT NULL,
    "tipo" "CostTypeEnum" NOT NULL,
    "categoria" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "workOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "tallerId" TEXT NOT NULL,
    "tipo" "GoalType" NOT NULL,
    "objetivo" DOUBLE PRECISION NOT NULL,
    "alcanzado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "estado" "GoalStatus" NOT NULL DEFAULT 'EN_PROGRESO',
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tallerId" TEXT NOT NULL,
    "accion" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "descripcion" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_tallers_userId_tallerId_key" ON "user_tallers"("userId", "tallerId");

-- CreateIndex
CREATE INDEX "clients_tallerId_idx" ON "clients"("tallerId");

-- CreateIndex
CREATE UNIQUE INDEX "clients_tallerId_email_key" ON "clients"("tallerId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_patente_key" ON "vehicles"("patente");

-- CreateIndex
CREATE INDEX "vehicles_clientId_idx" ON "vehicles"("clientId");

-- CreateIndex
CREATE INDEX "quotes_tallerId_idx" ON "quotes"("tallerId");

-- CreateIndex
CREATE INDEX "quotes_status_idx" ON "quotes"("status");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_quoteId_key" ON "work_orders"("quoteId");

-- CreateIndex
CREATE INDEX "work_orders_tallerId_idx" ON "work_orders"("tallerId");

-- CreateIndex
CREATE INDEX "work_orders_status_idx" ON "work_orders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "schedules_workOrderId_key" ON "schedules"("workOrderId");

-- CreateIndex
CREATE INDEX "schedules_tallerId_idx" ON "schedules"("tallerId");

-- CreateIndex
CREATE INDEX "schedules_fecha_idx" ON "schedules"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "schedules_vehicleId_fecha_hora_key" ON "schedules"("vehicleId", "fecha", "hora");

-- CreateIndex
CREATE INDEX "payment_methods_tallerId_idx" ON "payment_methods"("tallerId");

-- CreateIndex
CREATE INDEX "payments_tallerId_idx" ON "payments"("tallerId");

-- CreateIndex
CREATE INDEX "payments_fecha_idx" ON "payments"("fecha");

-- CreateIndex
CREATE INDEX "cash_movements_tallerId_idx" ON "cash_movements"("tallerId");

-- CreateIndex
CREATE INDEX "cash_movements_tipo_idx" ON "cash_movements"("tipo");

-- CreateIndex
CREATE INDEX "cash_movements_categoria_idx" ON "cash_movements"("categoria");

-- CreateIndex
CREATE INDEX "cash_movements_fecha_idx" ON "cash_movements"("fecha");

-- CreateIndex
CREATE INDEX "daily_closes_tallerId_idx" ON "daily_closes"("tallerId");

-- CreateIndex
CREATE UNIQUE INDEX "daily_closes_tallerId_fecha_key" ON "daily_closes"("tallerId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "client_credits_clientId_key" ON "client_credits"("clientId");

-- CreateIndex
CREATE INDEX "client_credits_tallerId_idx" ON "client_credits"("tallerId");

-- CreateIndex
CREATE UNIQUE INDEX "client_credits_tallerId_clientId_key" ON "client_credits"("tallerId", "clientId");

-- CreateIndex
CREATE INDEX "technicians_tallerId_idx" ON "technicians"("tallerId");

-- CreateIndex
CREATE INDEX "costs_tallerId_idx" ON "costs"("tallerId");

-- CreateIndex
CREATE INDEX "costs_tipo_idx" ON "costs"("tipo");

-- CreateIndex
CREATE INDEX "goals_tallerId_idx" ON "goals"("tallerId");

-- CreateIndex
CREATE UNIQUE INDEX "goals_tallerId_tipo_mes_anio_key" ON "goals"("tallerId", "tipo", "mes", "anio");

-- CreateIndex
CREATE INDEX "audit_logs_tallerId_idx" ON "audit_logs"("tallerId");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_idx" ON "audit_logs"("entityType");

-- AddForeignKey
ALTER TABLE "user_tallers" ADD CONSTRAINT "user_tallers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tallers" ADD CONSTRAINT "user_tallers_tallerId_fkey" FOREIGN KEY ("tallerId") REFERENCES "tallers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_tallerId_fkey" FOREIGN KEY ("tallerId") REFERENCES "tallers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_tallerId_fkey" FOREIGN KEY ("tallerId") REFERENCES "tallers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_tallerId_fkey" FOREIGN KEY ("tallerId") REFERENCES "tallers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_items" ADD CONSTRAINT "work_order_items_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_tallerId_fkey" FOREIGN KEY ("tallerId") REFERENCES "tallers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_tallerId_fkey" FOREIGN KEY ("tallerId") REFERENCES "tallers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tallerId_fkey" FOREIGN KEY ("tallerId") REFERENCES "tallers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_tallerId_fkey" FOREIGN KEY ("tallerId") REFERENCES "tallers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_closes" ADD CONSTRAINT "daily_closes_tallerId_fkey" FOREIGN KEY ("tallerId") REFERENCES "tallers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_credits" ADD CONSTRAINT "client_credits_tallerId_fkey" FOREIGN KEY ("tallerId") REFERENCES "tallers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_credits" ADD CONSTRAINT "client_credits_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technicians" ADD CONSTRAINT "technicians_tallerId_fkey" FOREIGN KEY ("tallerId") REFERENCES "tallers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "costs" ADD CONSTRAINT "costs_tallerId_fkey" FOREIGN KEY ("tallerId") REFERENCES "tallers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_tallerId_fkey" FOREIGN KEY ("tallerId") REFERENCES "tallers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tallerId_fkey" FOREIGN KEY ("tallerId") REFERENCES "tallers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

