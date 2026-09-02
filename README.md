# Taller Mecánico - Sistema de Gestión

Sistema integral de gestión para talleres mecánicos. Diseñado para administrar clientes, vehículos, presupuestos, órdenes de trabajo, turnos y pagos.

## 📋 Características

- ✅ Autenticación segura (una única cuenta por taller)
- ✅ Gestión de clientes y vehículos
- ✅ Presupuestos y órdenes de trabajo
- ✅ Calendario de turnos
- ✅ Registro de pagos y caja
- ✅ Historial y dashboard
- 📅 Integraciones futuras (WhatsApp, ARCA)

## 🏗️ Arquitectura

- **Frontend**: Next.js 15 (React 19)
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Auth**: NextAuth.js v5
- **UI**: Tailwind CSS + shadcn/ui
- **Tipado**: TypeScript

## 🚀 Inicio Rápido

### Requisitos
- Node.js 18+
- PostgreSQL instalado localmente o acceso a una instancia

### Instalación

```bash
# 1. Clonar o descargar el proyecto
cd taller-mecanico

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con los datos de PostgreSQL

# 4. Crear la base de datos (migrations)
npm run db:migrate

# 5. Iniciar servidor de desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

### Estructura de carpetas

```
├── app/                      # Next.js app router
│   ├── api/                 # API endpoints
│   ├── auth/                # Autenticación
│   ├── dashboard/           # Sistema principal
│   ├── layout.tsx
│   └── page.tsx
├── components/              # React components reutilizables
├── lib/                     # Utilidades y configuración
├── prisma/                  # Schema y migraciones
├── types/                   # TypeScript types
├── styles/                  # Estilos globales
├── public/                  # Assets estáticos
├── CLAUDE.md               # Reglas del proyecto
├── ROADMAP.md              # Planificación
└── package.json
```

## 📖 Documentación

- **[CLAUDE.md](./CLAUDE.md)** - Arquitectura, reglas y criterios de desarrollo
- **[ROADMAP.md](./ROADMAP.md)** - Fases del proyecto y checkpoints

## 🔄 Ciclo de Desarrollo

El proyecto se desarrolla en **8 fases**:

1. **Fase 1**: Base y acceso (autenticación)
2. **Fase 2**: Clientes y vehículos
3. **Fase 3**: Presupuestos
4. **Fase 4**: Órdenes de trabajo
5. **Fase 5**: Agenda / Turnos
6. **Fase 6**: Caja y cobros
7. **Fase 7**: Historial y Dashboard
8. **Fase 8**: Pulido y funcionalidades comerciales

Cada fase tiene **checkpoints** de aceptación. Ver [ROADMAP.md](./ROADMAP.md) para detalles.

## 💾 Base de Datos

Las migraciones se versionan con Prisma:

```bash
# Ver estado de migraciones
npm run db:push

# Crear nueva migration
npm run db:migrate

# Abrir Prisma Studio (interfaz visual)
npm run db:studio

# Generar cliente Prisma
npm run generate
```

## 🔐 Seguridad

- Autenticación con NextAuth.js
- Contraseñas hasheadas con bcrypt
- CSRF protection automático
- Validación de entrada con Zod
- SQL injection prevention (via Prisma ORM)

## 📝 Notas de Desarrollo

- Una única cuenta por taller (padre e hijo comparten credenciales)
- Sin sistema de roles complejos
- Stock/inventario excluido del scope inicial
- Commits descriptivos con cambios pequeños
- TypeScript strict mode obligatorio

## 🤝 Contribuciones

Este es un proyecto privado. Para cambios:
1. Consultar en CLAUDE.md las reglas
2. Crear branch descriptivo
3. Commit con mensaje claro
4. PR para revisión

## 📞 Soporte

Para dudas sobre arquitectura o desarrollo, revisar:
- CLAUDE.md (reglas y decisiones)
- ROADMAP.md (fases y checkpoints)
- Schema Prisma (modelos de datos)

---

**Última actualización**: 2026-08-31  
**Versión**: 0.1.0 (Fase 1 - En progreso)
