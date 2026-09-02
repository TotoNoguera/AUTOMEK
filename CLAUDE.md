# CLAUDE.md - Reglas del Proyecto

## Proyecto: Sistema de Gestión para Taller Mecánico

Este documento define la arquitectura, fases, reglas de trabajo y criterios para el desarrollo del sistema de gestión de talleres mecánicos.

---

## 1. ARQUITECTURA TECNOLÓGICA

### Stack elegido:
- **Frontend + Backend**: Next.js 15 (app router)
- **ORM**: Prisma (migraciones versionadas)
- **Base de datos**: PostgreSQL (consistencia de transacciones)
- **Autenticación**: NextAuth.js v5 (cuenta única por taller)
- **UI**: Tailwind CSS + shadcn/ui
- **Validación**: Zod (end-to-end)
- **Tipado**: TypeScript strict

### Decisiones arquitectónicas:
- **Monorepositorio**: frontend + backend en un único repo → más fácil de mantener
- **Multi-usuario preparado**: tablas User, Taller, UserTaller (N:N) → permite agregar usuarios en futuro
- **Fase 1-7 simplificado**: un usuario por taller (admin), flujo de autenticación simple
- **PostgreSQL**: transacciones ACID esenciales para caja/cobros
- **Prisma migrations**: versionadas en git, reproducibles en cualquier ambiente

---

## 2. ESTRUCTURA DEL PROYECTO

```
/taller-mecanico
├── app/                      # Next.js app router
│   ├── api/                 # API routes (Backend)
│   │   ├── auth/           # NextAuth endpoints
│   │   ├── clients/        # CRUD clientes
│   │   ├── vehicles/       # CRUD vehículos
│   │   ├── quotes/         # CRUD presupuestos
│   │   ├── work-orders/    # CRUD órdenes de trabajo
│   │   ├── schedules/      # CRUD turnos
│   │   └── payments/       # CRUD movimientos de caja
│   ├── auth/               # Páginas de autenticación
│   ├── dashboard/          # Rutas protegidas del sistema
│   │   ├── clients/
│   │   ├── vehicles/
│   │   ├── quotes/
│   │   ├── work-orders/
│   │   ├── schedules/
│   │   ├── payments/
│   │   └── history/
│   ├── layout.tsx          # Layout global
│   └── page.tsx            # Home (redirige a login o dashboard)
├── components/             # Componentes React reutilizables
│   ├── ui/                # shadcn/ui components
│   ├── forms/             # Formularios reutilizables
│   └── common/            # Componentes de uso general
├── lib/                    # Utilidades y helpers
│   ├── auth.ts            # Configuración de NextAuth
│   ├── db.ts              # Cliente Prisma singleton
│   ├── api-handler.ts     # Wrapper para API routes (manejo de errores)
│   └── validations.ts     # Esquemas Zod
├── types/                 # TypeScript types y interfaces
│   └── index.ts
├── styles/                # Estilos globales
│   └── globals.css
├── prisma/               # Prisma ORM
│   ├── schema.prisma     # Definición de modelos
│   └── migrations/       # Migraciones versionadas
├── public/               # Assets estáticos
├── .env.example          # Template de variables de entorno
├── .env.local            # Variables locales (git-ignored)
├── .gitignore
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── package.json
├── CLAUDE.md             # Este archivo
├── ROADMAP.md            # Planificación y checkpoints
└── README.md             # Documentación del proyecto
```

---

## 3. RESTRICCIONES Y REGLAS CRÍTICAS

### Autenticación y Acceso:
- ✅ Arquitectura preparada para múltiples usuarios por taller (Fases 1-7 usan 1 solo usuario/admin)
- ✅ Un usuario puede pertenecer a múltiples talleres (futura expansión)
- ✅ Sin sistema de roles complejos (rol base = "admin" en Fase 1)
- ✅ Session simple con NextAuth
- ❌ NO implementar permisos granulares en Fases 1-7

### Funcionalidades:
- ✅ Desarrollar en orden: Fase 1 → Fase 2 → ... → Fase 8
- ✅ Cada fase debe estar 100% funcional antes de pasar a la siguiente
- ❌ NO agregar funcionalidades de fases posteriores
- ❌ NO refactorizar código de fases anteriores sin razón justificada

### Stock/Inventario:
- ❌ **EXCLUIDO** del desarrollo inicial
- ❌ No agregar campos ni tablas de inventario en Fase 1
- ✅ Contemplar para ampliación futura (Fase 9+)

### Código y Mantenibilidad:
- ✅ TypeScript strict mode siempre
- ✅ Validación con Zod en controllers (API routes)
- ✅ Nombre descriptivos: `createClient()`, `updateVehicle()`, etc.
- ✅ Funciones pequeñas y enfocadas
- ❌ NO agregar abstracción prematura (YAGNI)
- ❌ NO comentarios innecesarios (código auto-documentado)

### Base de datos:
- ✅ Migraciones versionadas con Prisma
- ✅ Nunca `db.sync()` — siempre usar `migrate dev` o `db push`
- ✅ Transacciones en operaciones críticas (caja/cobros)
- ❌ NO modificar schema.prisma directamente sin migration

### API:
- ✅ REST simple: GET, POST, PUT, DELETE
- ✅ Respuestas JSON consistentes: `{ data, error, status }`
- ✅ Códigos HTTP correctos: 200, 201, 400, 401, 404, 500
- ✅ Validar entrada con Zod
- ❌ NO GraphQL en Fase 1

### UI/UX:
- ✅ Tailwind CSS + componentes custom o shadcn/ui
- ✅ Responsivo desde desktop (mobile en Fase 8)
- ✅ Accesibilidad básica (labels, aria-labels)
- ❌ NO frameworks CSS complejos (Material UI, Chakra, etc.)

---

## 4. CARACTERÍSTICAS CONGELADAS POR FASE

### Características agregadas en revisión arquitectónica:

**Fase 6 - Caja y Cobros**: 
- ✅ Ingresos Y egresos (CashMovement)
- ✅ Caja diaria con cierre (DailyClose)
- ✅ Movimientos categorizados (repuestos, servicios, etc.)

**Fase 6 - Cuenta Corriente**:
- ✅ Saldo por cliente (ClientCredit)
- ✅ Pagos parciales soportados
- ✅ Integración con caja

**Fase 7 - Técnicos**:
- ✅ Tabla Technician preparada
- ✅ Especialidad y estado

**Fase 8 - Costos**:
- ✅ Costos fijos y variables
- ✅ Categorización

**Fase 7 - Objetivos**:
- ✅ Metas de ingresos/órdenes
- ✅ Tracking de cumplimiento

**Auditoría**:
- ✅ AuditLog para acciones sensibles
- ✅ Cambios de estado, pagos, anulaciones

---

## 5. FASES DEL PROYECTO

### FASE 1 — Base y acceso
- ✅ Estructura del proyecto
- ✅ Base de datos inicial
- ✅ Autenticación con NextAuth
- ✅ Cuenta única del taller
- ✅ Configuración inicial

**Checkpoint 1**: Puede iniciar sesión, ver dashboard vacío, y hacer logout.

### FASE 2 — Clientes y vehículos
- ✅ CRUD clientes (nombre, teléfono, email, dirección)
- ✅ CRUD vehículos (patente, marca, modelo, año, kilometraje)
- ✅ Relación cliente ↔ vehículos (1:N)
- ✅ Búsqueda básica (por nombre, patente)

**Checkpoint 2**: Puede crear, editar, listar y buscar clientes y vehículos.

### FASE 3 — Presupuestos
- ✅ Crear presupuesto (cliente, vehículo, fecha)
- ✅ Agregar trabajos/servicios (descripción, cantidad, precio unitario)
- ✅ Cálculo automático de total
- ✅ Estados: `PENDIENTE`, `APROBADO`, `RECHAZADO`
- ✅ Aprobación/rechazo de presupuestos
- ✅ Convertir presupuesto aprobado en orden de trabajo

**Checkpoint 3**: Puede crear presupuestos, aprobarlos/rechazarlos, y convertir en orden de trabajo.

### FASE 4 — Órdenes de trabajo
- ✅ CRUD órdenes de trabajo
- ✅ Campos: cliente, vehículo, motivo de ingreso, diagnóstico, trabajos realizados
- ✅ Estados: `PRESUPUESTA`, `APROBADA`, `EN_PROCESO`, `TERMINADA`, `ENTREGADA`
- ✅ Observaciones y kilometraje
- ✅ Total y seguimiento
- ✅ Convertir desde presupuesto o crear directa

**Checkpoint 4**: Sistema de órdenes de trabajo funcional con estados y seguimiento.

### FASE 5 — Agenda / Turnos
- ✅ Calendario con turnos (fecha, hora, cliente, vehículo, motivo)
- ✅ Estados de turno
- ✅ Convertir turno a orden de trabajo
- ✅ Visualización semanal/diaria

**Checkpoint 5**: Agenda funcional, puede ver y crear turnos.

### FASE 6 — Caja y cobros
- ✅ Registrar cobros (efectivo, transferencia, tarjeta, cuenta corriente)
- ✅ Deudas y movimientos de caja
- ✅ Totales y balances
- ✅ Auditoría de transacciones

**Checkpoint 6**: Caja operativa, puede registrar ingresos y ver balances.

### FASE 7 — Historial y Dashboard
- ✅ Historial completo de cada vehículo
- ✅ Órdenes realizadas, trabajos, fechas, kilómetros, observaciones
- ✅ Dashboard general del taller (KPIs, resumen diario/mensual)

**Checkpoint 7**: Dashboard informativo con históricos.

### FASE 8 — Pulido y funcionalidades comerciales
- ✅ Diseño final responsive
- ✅ Validaciones exhaustivas
- ✅ Manejo de errores robusto
- ✅ Seguridad (CSRF, XSS, SQL injection)
- ✅ Impresión/exportación (PDF presupuestos, órdenes)
- ✅ Preparación para integraciones (WhatsApp, ARCA)

**Checkpoint 8**: Sistema pulido, seguro, listo para producción.

---

## 5. CRITERIOS DE ACEPTACIÓN POR FASE

Cada fase debe cumplir:
1. ✅ Código compila sin errores
2. ✅ TypeScript sin `any` excepto cuando sea realmente necesario
3. ✅ Validación de entrada en todas las APIs
4. ✅ Tests unitarios básicos (Fase 8 en adelante con cobertura)
5. ✅ Funcionalidad demostrable en el navegador
6. ✅ Documentación actualizada en ROADMAP.md
7. ✅ Commits descriptivos en git

---

## 6. CONVENCIONES DE CÓDIGO

### Nombres:
- `createClient()`, `updateClient()`, `deleteClient()` (verbos explícitos)
- `clients`, `vehicles`, `workOrders`, `paymentMethods` (plurales, camelCase)
- `ClientSchema`, `VehicleSchema`, `QuoteSchema` (PascalCase para tipos)

### Estructura de archivos:
- Componentes en `components/` con su propio `.tsx`
- Helpers en `lib/`
- Tipos en `types/`
- Schemas Zod en `lib/validations.ts`

### Formato:
- Prettier (automático con Next.js)
- ESLint strict
- 2 espacios (indent)

---

## 7. PUNTOS DE CONTROL (CHECKPOINTS)

| Checkpoint | Fase | Criterio | Fecha |
|-----------|------|----------|-------|
| CP1 | Fase 1 | Login/logout funcional | TBD |
| CP2 | Fase 2 | CRUD clientes y vehículos | TBD |
| CP3 | Fase 3 | Presupuestos operativos | TBD |
| CP4 | Fase 4 | Órdenes de trabajo completas | TBD |
| CP5 | Fase 5 | Agenda/turnos funcional | TBD |
| CP6 | Fase 6 | Caja y cobros | TBD |
| CP7 | Fase 7 | Dashboard e históricos | TBD |
| CP8 | Fase 8 | Sistema listo para producción | TBD |

---

## 8. NOTAS FINALES

- **No es un proyecto de aprendizaje**: debe ser profesional desde el inicio.
- **Simplicidad primero**: cada feature cumple su propósito, nada más.
- **Refactoring solo en Fase 8**: no reorganizar código sin necesidad.
- **Backups en git**: commits frecuentes con mensajes descriptivos.
- **Comunicación clara**: ante dudas de arquitectura, se consulta antes de programar.

---

**Última actualización**: 2026-08-31  
**Versión de documento**: 1.0
