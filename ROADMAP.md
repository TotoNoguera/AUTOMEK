# ROADMAP - Planificación del Proyecto

## Visión General

Sistema de gestión integral para talleres mecánicos. Herramienta para registrar clientes, vehículos, presupuestos, órdenes de trabajo, turnos y pagos.

**Arquitectura**: Preparada para múltiples usuarios por taller, pero Fases 1-7 operan con un usuario admin por taller.

**Inicio**: 2026-08-31  
**Versión objetivo**: 1.0  

---

## FASE 1 — Base y Acceso
**Duración estimada**: 2-3 días  
**Dependencias**: Ninguna

### Tareas:
- [x] Inicializar proyecto Next.js 15
- [x] Configurar Prisma + PostgreSQL
- [x] Configurar NextAuth v5
- [x] Crear tabla `User` (taller único)
- [ ] Crear tabla `TallerConfig` (datos generales del taller)
- [ ] Página de login
- [ ] Página de registro/configuración inicial
- [ ] Dashboard vacío (solo header + sidebar)
- [ ] Middleware de autenticación
- [ ] Seed inicial de base de datos

### Commits esperados:
1. `chore: init next.js project and dependencies`
2. `chore: configure prisma and database schema`
3. `feat: setup nextauth authentication`
4. `feat: add login and registration pages`
5. `feat: add dashboard layout and protected routes`

### Validación de Checkpoint 1:
- ✅ Puede iniciar sesión con credenciales
- ✅ Puede ver dashboard después de login
- ✅ Puede hacer logout
- ✅ Sin logout, no puede acceder a rutas protegidas
- ✅ Base de datos lista con tablas iniciales

**Fecha inicio**: 2026-08-31  
**Fecha fin (estimada)**: 2026-09-02  
**Status**: 🟠 En progreso

---

## FASE 2 — Clientes y Vehículos
**Duración estimada**: 3-4 días  
**Dependencias**: Fase 1 ✅

### Tareas:
- [ ] Crear modelo `Client` en Prisma
  - Campos: nombre, teléfono, email, dirección, fecha de creación
- [ ] Crear modelo `Vehicle` en Prisma
  - Campos: patente (único), marca, modelo, año, kilometraje, cliente_id
- [ ] API endpoints:
  - GET `/api/clients` (listar)
  - POST `/api/clients` (crear)
  - GET `/api/clients/[id]` (obtener)
  - PUT `/api/clients/[id]` (actualizar)
  - DELETE `/api/clients/[id]` (eliminar)
  - GET `/api/vehicles` (listar con filtro por cliente)
  - POST `/api/vehicles` (crear)
  - PUT `/api/vehicles/[id]` (actualizar)
  - DELETE `/api/vehicles/[id]` (eliminar)
- [ ] Página: Listado de clientes con tabla
- [ ] Página: Crear/editar cliente (formulario)
- [ ] Página: Detalle de cliente (con sus vehículos)
- [ ] Página: Listado de vehículos
- [ ] Página: Crear/editar vehículo (con cliente)
- [ ] Búsqueda por nombre (clientes) y patente (vehículos)
- [ ] Validación con Zod

### Commits esperados:
1. `feat: add client and vehicle models to prisma schema`
2. `feat: implement client CRUD api endpoints`
3. `feat: implement vehicle CRUD api endpoints`
4. `feat: add client management UI`
5. `feat: add vehicle management UI`
6. `feat: add search functionality for clients and vehicles`

### Validación de Checkpoint 2:
- ✅ Puede crear clientes con nombre, teléfono, email, dirección
- ✅ Puede listar clientes
- ✅ Puede editar cliente
- ✅ Puede eliminar cliente
- ✅ Puede crear vehículos asociados a cliente
- ✅ Puede ver vehículos de un cliente
- ✅ Puede buscar por nombre (cliente) y patente (vehículo)
- ✅ Validación de datos (email válido, teléfono, etc.)
- ✅ No puede crear vehículo con patente duplicada

**Fecha inicio**: 2026-09-02  
**Fecha fin (estimada)**: 2026-09-05  
**Status**: ⏳ Pendiente

---

## FASE 3 — Presupuestos
**Duración estimada**: 3-4 días  
**Dependencias**: Fase 2 ✅

### Tareas:
- [ ] Crear modelos en Prisma:
  - `Quote` (presupuesto)
  - `QuoteItem` (trabajos/servicios en presupuesto)
- [ ] Estados de presupuesto: `PENDIENTE`, `APROBADO`, `RECHAZADO`
- [ ] API endpoints:
  - POST `/api/quotes` (crear)
  - GET `/api/quotes` (listar)
  - GET `/api/quotes/[id]` (obtener)
  - PUT `/api/quotes/[id]` (actualizar)
  - POST `/api/quotes/[id]/approve` (aprobar)
  - POST `/api/quotes/[id]/reject` (rechazar)
  - POST `/api/quotes/[id]/to-work-order` (convertir en orden)
  - DELETE `/api/quotes/[id]` (eliminar si está en PENDIENTE)
- [ ] Página: Crear presupuesto (elegir cliente, vehículo, agregar trabajos)
- [ ] Página: Listado de presupuestos (con estados)
- [ ] Página: Detalle de presupuesto (ver, editar, aprobar/rechazar)
- [ ] Cálculo automático de total
- [ ] Validación de campos
- [ ] Estados visuales (badge por estado)

### Commits esperados:
1. `feat: add quote models to prisma schema`
2. `feat: implement quote CRUD api endpoints`
3. `feat: add quote approval workflow`
4. `feat: add quote to work order conversion`
5. `feat: add quote management UI`

### Validación de Checkpoint 3:
- ✅ Puede crear presupuesto (cliente, vehículo, trabajos, precios)
- ✅ Cálculo de total automático
- ✅ Puede ver listado de presupuestos
- ✅ Puede aprobar/rechazar presupuesto
- ✅ Puede convertir presupuesto aprobado en orden de trabajo
- ✅ No puede rechazar presupuesto ya aprobado
- ✅ No puede eliminar presupuesto si no está en PENDIENTE

**Fecha inicio**: 2026-09-05  
**Fecha fin (estimada)**: 2026-09-08  
**Status**: ⏳ Pendiente

---

## FASE 4 — Órdenes de Trabajo
**Duración estimada**: 4-5 días  
**Dependencias**: Fase 3 ✅

### Tareas:
- [ ] Crear modelos en Prisma:
  - `WorkOrder` (orden de trabajo)
  - `WorkOrderItem` (trabajos/servicios realizados)
- [ ] Estados: `PRESUPUESTA`, `APROBADA`, `EN_PROCESO`, `TERMINADA`, `ENTREGADA`
- [ ] API endpoints:
  - POST `/api/work-orders` (crear)
  - GET `/api/work-orders` (listar)
  - GET `/api/work-orders/[id]` (obtener)
  - PUT `/api/work-orders/[id]` (actualizar)
  - PUT `/api/work-orders/[id]/status` (cambiar estado)
  - POST `/api/work-orders/[id]/add-item` (agregar trabajo)
  - DELETE `/api/work-orders/[id]/items/[itemId]` (quitar trabajo)
- [ ] Página: Crear orden de trabajo (manual o desde presupuesto)
- [ ] Página: Listado de órdenes (con filtro por estado)
- [ ] Página: Detalle de orden (editar, cambiar estado, agregar trabajos)
- [ ] Seguimiento de estado
- [ ] Observaciones y notas
- [ ] Kilometraje al ingreso y egreso
- [ ] Cálculo de total

### Commits esperados:
1. `feat: add work order models to prisma schema`
2. `feat: implement work order CRUD api endpoints`
3. `feat: add work order status workflow`
4. `feat: add work order management UI`
5. `feat: add work order tracking and follow-up`

### Validación de Checkpoint 4:
- ✅ Puede crear orden de trabajo (directa o desde presupuesto)
- ✅ Puede agregar/editar trabajos realizados
- ✅ Puede cambiar estado de orden
- ✅ Puede ver listado filtrado por estado
- ✅ Puede ver historial de cambios de estado
- ✅ Total se calcula correctamente
- ✅ Validación de transiciones de estado

**Fecha inicio**: 2026-09-08  
**Fecha fin (estimada)**: 2026-09-12  
**Status**: ⏳ Pendiente

---

## FASE 5 — Agenda / Turnos
**Duración estimada**: 3-4 días  
**Dependencias**: Fase 2 ✅, Fase 4 (parcial)

### Tareas:
- [ ] Crear modelo `Schedule` (turno)
- [ ] Campos: fecha, hora, cliente, vehículo, motivo, estado
- [ ] API endpoints:
  - POST `/api/schedules` (crear turno)
  - GET `/api/schedules` (listar/filtrar por fecha)
  - GET `/api/schedules/[id]` (obtener)
  - PUT `/api/schedules/[id]` (actualizar)
  - POST `/api/schedules/[id]/to-work-order` (convertir en orden)
  - DELETE `/api/schedules/[id]` (eliminar si no está asignado)
- [ ] Página: Calendario visual (mes/semana/día)
- [ ] Página: Crear/editar turno
- [ ] Página: Listado de turnos del día/semana
- [ ] Validación de conflictos de horario
- [ ] Estados de turno

### Commits esperados:
1. `feat: add schedule model to prisma schema`
2. `feat: implement schedule CRUD api endpoints`
3. `feat: add calendar UI component`
4. `feat: add schedule management and conversion to work order`

### Validación de Checkpoint 5:
- ✅ Puede crear turno (fecha, hora, cliente, vehículo, motivo)
- ✅ Puede ver calendario visual
- ✅ Puede editar turno
- ✅ Puede convertir turno en orden de trabajo
- ✅ No puede crear dos turnos a la misma hora
- ✅ Validación de datos

**Fecha inicio**: 2026-09-12  
**Fecha fin (estimada)**: 2026-09-15  
**Status**: ⏳ Pendiente

---

## FASE 6 — Caja, Cobros y Movimientos
**Duración estimada**: 5-7 días  
**Dependencias**: Fase 4 ✅

### Tareas:
- [ ] **Ingresos (Cobros)**:
  - POST `/api/cash-movements/ingreso` (registrar cobro/pago)
  - GET `/api/cash-movements?tipo=INGRESO` (listar ingresos)
  - Métodos: efectivo, transferencia, tarjeta, cuenta corriente

- [ ] **Egresos (Gastos operacionales)**:
  - POST `/api/cash-movements/egreso` (registrar gasto)
  - GET `/api/cash-movements?tipo=EGRESO` (listar egresos)
  - Categorías: repuestos, servicios, salarios, alquiler, impuestos, etc.

- [ ] **Caja Diaria**:
  - POST `/api/daily-closes` (cerrar caja)
  - GET `/api/daily-closes` (historial de cierres)
  - Cálculo automático: saldo inicial + ingresos - egresos = saldo final
  - Validación: no cerrar si hay inconsistencias

- [ ] **Cuenta Corriente por Cliente**:
  - GET `/api/clients/[id]/credit` (obtener saldo)
  - POST `/api/clients/[id]/credit/payment` (registrar pago)
  - Saldo en tiempo real
  - Pagos parciales soportados

- [ ] **Auditoría de Caja**:
  - AuditLog para: cada movimiento, cierre de caja, anulaciones
  - Trazabilidad completa de dinero

- [ ] **UI**:
  - Página: Registrar ingreso (cobro)
  - Página: Registrar egreso (gasto)
  - Página: Listado de movimientos (ingresos/egresos)
  - Página: Cierre de caja diaria
  - Página: Deudas (órdenes sin pagar, saldos negativos por cliente)
  - Página: Cuenta corriente por cliente

### Commits esperados:
1. `feat: add cash movement and daily close models`
2. `feat: implement cash movement CRUD endpoints`
3. `feat: add daily close workflow`
4. `feat: add client credit management`
5. `feat: add audit logging for cash operations`
6. `feat: add cash management UI`

### Validación de Checkpoint 6:
- ✅ Puede registrar ingreso (cobro de orden)
- ✅ Puede registrar egreso (gasto operacional, clasificado)
- ✅ Puede cerrar caja diaria
- ✅ Puede ver listado de ingresos y egresos
- ✅ Puede ver deudas pendientes y saldos de clientes
- ✅ Puede registrar pagos en cuenta corriente
- ✅ Saldo de cliente se actualiza automáticamente
- ✅ Validación: no puede pagar más del total de la orden
- ✅ Todos los movimientos auditados

**Fecha inicio**: 2026-09-15  
**Fecha fin (estimada)**: 2026-09-19  
**Status**: ⏳ Pendiente

---

## FASE 7 — Gestión de Técnicos, Objetivos, Historial y Dashboard
**Duración estimada**: 5-6 días  
**Dependencias**: Todas las fases anteriores ✅

### Tareas:

**Gestión de Técnicos**:
- [ ] CRUD de técnicos (crear, editar, listar, activar/desactivar)
- [ ] Campos: nombre, email, teléfono, especialidad

**Objetivos y Metas**:
- [ ] Definir metas mensuales (ingresos, órdenes)
- [ ] Página: Seguimiento de objetivos
- [ ] Dashboard: comparativa objetivo vs real

**Historial y Auditoría**:
- [ ] Página: Historial de vehículo (todas las órdenes, trabajos, fechas, km)
- [ ] Visualización: AuditLog de cambios sensibles (cambios de estado, pagos, anulaciones)
- [ ] Trazabilidad completa

**Dashboard General**:
- [ ] KPIs:
  - Órdenes activas
  - Cobros del día/mes
  - Egresos del día/mes
  - Deudas pendientes
  - Vehículos más frecuentes
  - Objetivos vs realizado
- [ ] Gráficos:
  - Ingresos/egresos mensual
  - Órdenes por mes
  - Cumplimiento de objetivos
  - Progreso financiero
- [ ] Reportes (PDF de órdenes, resumen mensual)

### Commits esperados:
1. `feat: add technician management`
2. `feat: add goals and objectives tracking`
3. `feat: add audit log visualization`
4. `feat: add vehicle history view`
5. `feat: add comprehensive dashboard with KPIs`
6. `feat: add reporting functionality`

### Validación de Checkpoint 7:
- ✅ Puede crear y gestionar técnicos
- ✅ Puede definir metas mensuales
- ✅ Dashboard muestra comparativa objetivo vs real
- ✅ Puede ver historial completo de vehículos
- ✅ Puede auditar cambios sensibles
- ✅ Gráficos se generan correctamente
- ✅ Puede generar reportes en PDF
- ✅ Información financiera completa (ingresos + egresos)

**Fecha inicio**: 2026-09-19  
**Fecha fin (estimada)**: 2026-09-22  
**Status**: ⏳ Pendiente

---

## FASE 8 — Pulido y Funcionalidades Comerciales
**Duración estimada**: 5-7 días  
**Dependencias**: Todas ✅

### Tareas:

**Gestión de Costos**:
- [ ] CRUD de costos fijos y variables
- [ ] Categorización (materia prima, mano de obra, servicios, etc.)
- [ ] Cálculo de margen por orden (ingresos - costos)
- [ ] Reporte de costos vs ingresos (P&L)

**UI y UX**:
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Validaciones exhaustivas (frontend + backend)
- [ ] Manejo de errores robusto (toast notifications)

**Seguridad**:
- [ ] CSRF protection
- [ ] XSS prevention
- [ ] SQL injection protection (via Prisma)
- [ ] Rate limiting en APIs
- [ ] Validación de permisos (auditoría de acceso)

**Exportación y Reportes**:
- [ ] Impresión/exportación:
  - PDF de presupuestos
  - PDF de órdenes de trabajo
  - PDF de cierres de caja
  - CSV de reportes financieros

**Mejoras**:
- [ ] Dark mode (opcional pero recomendado)
- [ ] Preparación para integraciones:
  - Documentación de APIs REST
  - Estructura para webhooks
  - Logs de auditoría exportables
- [ ] Tests unitarios básicos
- [ ] Optimización de performance (índices, caching)

### Commits esperados:
1. `feat: add responsive design`
2. `feat: add error handling and validation`
3. `feat: add security measures`
4. `feat: add print and export functionality`
5. `feat: add testing suite`
6. `chore: optimize performance`

### Validación de Checkpoint 8:
- ✅ Aplicación responsive en móvil, tablet y desktop
- ✅ Validaciones en todos los formularios
- ✅ Manejo de errores visible al usuario
- ✅ Puede imprimir/exportar presupuestos y órdenes
- ✅ Tests pasan (cobertura > 70%)
- ✅ Sin warnings de seguridad

**Fecha inicio**: 2026-09-22  
**Fecha fin (estimada)**: 2026-09-28  
**Status**: ⏳ Pendiente

---

## FUTURO (Fuera del scope actual)

### Fase 9 — Stock/Inventario (Futura)
- Modelos: `InventoryItem`, `Stock`
- CRUD de repuestos/materiales
- Movimientos de stock

### Fase 10 — Integraciones (Futura)
- WhatsApp Business API
- ARCA (inspecciones técnicas)
- Contabilidad integrada

### Fase 11 — Apps Móviles (Futura)
- React Native o Flutter
- Sincronización en tiempo real

---

## REGISTRO DE PROGRESO

| Fecha | Fase | Evento | Notas |
|-------|------|--------|-------|
| 2026-08-31 | Fase 1 | Inicio proyecto | Estructura y CLAUDE.md creados |
| - | - | - | - |

---

## NOTAS DE DESARROLLO

### Decisiones técnicas documentadas:
- PostgreSQL: Elegido por ACID compliance (transacciones de caja)
- Prisma: Migraciones versionadas y type-safe ORM
- NextAuth: Autenticación simple sin complejidad multi-tenant
- Tailwind + shadcn/ui: Componentes profesionales sin boilerplate

### Posibles desafíos:
- Performance en dashboard con muchos registros → indexar en DB
- Sincronización de estado entre clientes → usar mutations con revalidate
- Validaciones complejas → usar Zod schemas

### Decisiones de UX:
- Una única cuenta → no mostrar selector de usuario
- Flujo lineal: Presupuesto → Aprobación → Orden → Pago
- Estados visuales claros con colores (badge)

---

**Última actualización**: 2026-08-31  
**Versión**: 1.0
