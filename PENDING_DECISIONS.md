# Decisiones de Arquitectura - Congeladas ✅

Este documento lista los requisitos y decisiones arquitectónicas que FUERON CERRADAS en la revisión de arquitectura final.

**Última actualización**: 2026-08-31  
**Status**: ✅ CONGELADO - Todas las decisiones cerradas

---

## ✅ 1. GESTIÓN DE PERSONAL/TÉCNICOS — CERRADO

### Decisión: SÍ - INCLUIDO EN FASE 7

**Implementado**:
- ✅ Tabla `Technician` con campos: nombre, email, teléfono, especialidad, estado
- ✅ Relación: Taller (1) ← → (N) Technician
- ✅ Preparado para: asignación a órdenes en futuro (Fase 8+)

**Fase 7**:
- CRUD de técnicos (crear, editar, listar, activar/desactivar)
- Gestión de especialidades
- Dashboard de técnicos

**Fase 8+**:
- Posible asignación de técnico a orden de trabajo
- Seguimiento de productividad
- Horarios/disponibilidad

---

## ✅ 2. COSTOS FIJOS Y VARIABLES — CERRADO

### Decisión: SÍ - INCLUIDO EN FASE 8

**Implementado**:
- ✅ Tabla `Cost` con campos: tipo (FIJO|VARIABLE), categoría, descripción, monto, mes, año
- ✅ Categorización: materia prima, mano de obra, servicios, etc.
- ✅ Relación: Taller (1) ← → (N) Cost

**Fase 8**:
- CRUD de costos fijos y variables
- Cálculo de margen por orden (ingresos - costos)
- Reporte de P&L (ganancias y pérdidas)
- Dashboard financiero

**Datos registrados**:
- Costos mensuales por categoría
- Asociación opcional a orden específica
- Histórico de costos

---

## ✅ 3. OBJETIVOS/METAS — CERRADO

### Decisión: SÍ - INCLUIDO EN FASE 7

**Implementado**:
- ✅ Tabla `Goal` con campos: tipo (INGRESO_MENSUAL|ORDENES_MENSUALES), objetivo, alcanzado, mes, año, estado
- ✅ Estados: EN_PROGRESO, ALCANZADO, NO_ALCANZADO, CANCELADO
- ✅ Relación: Taller (1) ← → (N) Goal

**Fase 7**:
- Definir metas mensuales
- Visualización: progreso vs objetivo
- Dashboard: comparativa objetivo vs real
- Alertas si no se alcanza meta

**Seguimiento**:
- Histórico de cumplimiento
- Análisis de tendencias
- Reportes de desempeño

---

## ✅ 4. MOVIMIENTOS DE CAJA (EGRESOS E INGRESOS) — CERRADO

### Decisión: SÍ - INCLUIDO EN FASE 6

**Implementado**:
- ✅ Tabla `CashMovement` con campos: tipo (INGRESO|EGRESO), categoría, monto, descripción, fecha
- ✅ Tabla `DailyClose` para cierre diario de caja
- ✅ Relación: Taller (1) ← → (N) CashMovement

**Ingresos** (Fase 6):
- Cobros de órdenes (PAGO_ORDEN)
- Anticipos

**Egresos** (Fase 6):
- Compra de repuestos/materiales
- Gastos de servicios
- Mantenimiento
- Sueldos
- Alquiler
- Servicios/utilidades
- Impuestos
- Otros gastos operacionales

**Caja Diaria** (Fase 6):
- Cierre diario: saldo inicial + ingresos - egresos = saldo final
- Estados: ABIERTO, CERRADO, REABIERTO
- Validación de consistencia

**Categorización**:
- Costos fijos diarios (configurables)
- Costos variables diarios
- Gastos operacionales clasificados

---

## ✅ 5. CUENTA CORRIENTE CON CLIENTES — CERRADO

### Decisión: SÍ - INCLUIDO EN FASE 6

**Implementado**:
- ✅ Tabla `ClientCredit` con campos: saldo, creditLimit (opcional), lastUpdated
- ✅ Relación: Client (1) ← → (1) ClientCredit
- ✅ Integración con CashMovement

**Características**:
- Saldo en tiempo real por cliente
- Pagos parciales soportados
- Límite de crédito opcional configurable
- Deudas y créditos registrados

**Flujo Fase 6**:
1. Se registra orden de trabajo
2. Se crea CashMovement (INGRESO de orden)
3. Si paga en CUENTA_CORRIENTE:
   - Se actualiza ClientCredit.saldo (resta lo pagado)
4. Si paga menos del total:
   - ClientCredit.saldo queda negativo (cliente debe)
5. Dashboard muestra: deudas pendientes, saldos por cliente

**Validación**:
- No permite pagar más del total de la orden
- Límite de crédito respetado (si está definido)

---

## ✅ 6. PAGOS PARCIALES DE ÓRDENES — CERRADO

### Decisión: SÍ - SOPORTADOS EN FASE 6

**Implementado**:
- ✅ Una orden puede tener múltiples CashMovement (ingresos)
- ✅ Pagos en cuotas permitidos
- ✅ Saldo pendiente se calcula automáticamente

**Validación Fase 6**:
- No permite pagar más del total de la orden
- Suma de pagos ≤ total de orden
- Saldo pendiente visible en Dashboard

**Integración con Cuenta Corriente**:
- Cada pago actualiza ClientCredit.saldo
- Saldo negativo = cliente adeuda
- Saldo positivo = cliente tiene crédito

---

## ✅ 7. AUDITORÍA Y HISTORIAL DE CAMBIOS — CERRADO

### Decisión: SÍ - INCLUIDO EN FASE 7 (con preparación en Fase 6)

**Implementado**:
- ✅ Tabla `AuditLog` con campos: acción, entityType, entityId, oldValue, newValue, timestamp
- ✅ Enum `AuditAction` para acciones sensibles
- ✅ Relación: Taller (1) ← → (N) AuditLog

**Acciones Auditadas** (Fase 6+):
- QUOTE_CREATED, QUOTE_APPROVED, QUOTE_REJECTED, QUOTE_CONVERTED_TO_WORK_ORDER
- WORK_ORDER_CREATED, WORK_ORDER_STATUS_CHANGED, WORK_ORDER_COMPLETED, WORK_ORDER_DELIVERED
- PAYMENT_RECORDED, PAYMENT_ANNULLED, PAYMENT_UPDATED
- CASH_MOVEMENT_RECORDED, DAILY_CLOSE_CLOSED, DAILY_CLOSE_REOPENED
- CLIENT_CREDIT_UPDATED, SCHEDULE_STATUS_CHANGED

**Fase 7**:
- Visualización de AuditLog
- Historial de cambios de estado
- Trazabilidad completa

**Datos guardados**:
- Acción realizada
- Entidad afectada (Quote, WorkOrder, Payment, etc.)
- Valor anterior y nuevo (para cambios)
- Timestamp y usuario (para futuro multi-user)

---

## RESUMEN DE DECISIONES — TODAS CERRADAS ✅

| Decisión | Impacto | Fase | Status | Implementado |
|----------|---------|------|--------|--------------|
| **Técnicos** | Bajo | 7 | ✅ CERRADO | Technician table |
| **Costos Fijos/Var** | Medio | 8 | ✅ CERRADO | Cost table |
| **Objetivos/Metas** | Bajo | 7 | ✅ CERRADO | Goal table |
| **Egresos/Gastos** | 🔴 Alto | 6 | ✅ CERRADO | CashMovement table |
| **Caja Diaria** | Alto | 6 | ✅ CERRADO | DailyClose table |
| **Cuenta Corriente** | Medio | 6 | ✅ CERRADO | ClientCredit table |
| **Pagos Parciales** | Bajo | 6 | ✅ CERRADO | CashMovement table |
| **Audit Trail** | Medio | 7 | ✅ CERRADO | AuditLog table |
| **Turnos en Espera** | Bajo | 5 | ✅ CERRADO | ScheduleStatus.EN_ESPERA |

---

## DECISIONES CONGELADAS (SIN CAMBIOS)

✅ Stack: Next.js 15 + Prisma + PostgreSQL + NextAuth v5  
✅ 8 Fases como se definen (+ detalle de nuevas características)  
✅ Sin multi-tenant en Fases 1-7 (preparado para Fase 9+)  
✅ Sin inventario/stock  
✅ Un usuario admin por taller (Fases 1-7)  
✅ Arquitectura preparada para múltiples usuarios (futuro)  
✅ ACID compliance en transacciones financieras  

---

## ARQUITECTURA FINAL — CONGELADA

**Tablas nuevas agregadas** (Post-revisión):
- ✅ CashMovement (ingresos y egresos)
- ✅ DailyClose (cierre diario de caja)
- ✅ ClientCredit (saldos de cuenta corriente)
- ✅ Technician (técnicos del taller)
- ✅ Cost (costos fijos y variables)
- ✅ Goal (objetivos y metas)
- ✅ AuditLog (auditoría de acciones sensibles)

**Modelos mejorados**:
- ✅ ScheduleStatus: agregado EN_ESPERA
- ✅ WorkOrder: relación con CashMovement
- ✅ Client: relación con ClientCredit
- ✅ Taller: relaciones a todas las nuevas tablas

**Índices agregados** para performance:
- ✅ tallerId en todas las tablas de negocio
- ✅ status en Quote y WorkOrder
- ✅ fecha en Schedule, Payment, DailyClose
- ✅ tipo y categoría en CashMovement

---

## STATUS: ✅ ARQUITECTURA 100% CONGELADA

**Todas las decisiones están tomadas.**  
**Listo para comenzar Fase 1.**

Ver ROADMAP.md para cronograma de fases.  
Ver ARCHITECTURE_REVIEW_SUMMARY.md para resumen técnico.  
Ver CLAUDE.md para reglas del proyecto.
