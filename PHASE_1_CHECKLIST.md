# Fase 1 - Checklist de Inicio

Este checklist define qué falta para completar **Fase 1 — Base y Acceso**.

## Pre-requisitos Completados ✅

- [x] Inicializar proyecto Next.js
- [x] Configurar Prisma + PostgreSQL schema
- [x] Configurar TypeScript y Tailwind
- [x] Crear estructura de carpetas
- [x] Preparar NextAuth configuración base
- [x] Crear tipos y validaciones Zod
- [x] Crear documentación (CLAUDE.md, ROADMAP.md)

## Tareas Fase 1

### A. Base de datos
- [ ] `npm install` — instalar todas las dependencias
- [ ] `.env.local` — crear con variables PostgreSQL
- [ ] `npm run db:migrate` — crear tablas en DB
- [ ] Verificar tablas creadas: `users`, `tallers`, `user_tallers`, `payment_methods`

### B. Autenticación (NextAuth + API)
- [ ] `app/api/auth/[...nextauth]/route.ts` — conectar NextAuth
- [ ] `app/api/auth/register/route.ts` — endpoint de registro
- [ ] `app/api/auth/login/route.ts` — endpoint de login (si es necesario)
- [ ] Middleware de autenticación (proteger rutas `/dashboard`)

### C. Páginas de UI
- [ ] `app/auth/login/page.tsx` — formulario de login
- [ ] `app/auth/register/page.tsx` — formulario de registro (con setup de taller)
- [ ] `app/dashboard/layout.tsx` — layout con sidebar
- [ ] `app/dashboard/page.tsx` — dashboard vacío (home)

### D. Componentes base
- [ ] Header con logout
- [ ] Sidebar con navegación (menús vacíos de Fases 2+)
- [ ] Formulario de login reutilizable
- [ ] Formulario de registro reutilizable

### E. Validación y Seguridad
- [ ] Hashing de contraseñas con bcrypt en registro
- [ ] Validación de campos en login/register (Zod)
- [ ] Error messages claros para usuario
- [ ] CSRF protection (NextAuth lo hace automático)

### F. Testing (Fase 1)
- [ ] Puede registrarse con email/password/nombre/nombre-taller
- [ ] Puede iniciar sesión
- [ ] Puede ver dashboard después de login
- [ ] Puede hacer logout
- [ ] Sin logout, no puede acceder a `/dashboard`
- [ ] Validación rechaza datos inválidos (email duplicado, campos vacíos)

## Checkpoint 1 — Criterios de Aceptación

✅ Proyecto compila sin errores (`npm run build`)  
✅ Puede registrarse → crea usuario en DB  
✅ Puede iniciar sesión con credenciales creadas  
✅ Dashboard accesible solo si está autenticado  
✅ Logout redirige a login  
✅ Recargar página mantiene sesión (en desarrollo)  

## Estimación de Tiempo
2-3 días de desarrollo

## Notas

- **No agregar**: clientes, vehículos, presupuestos, órdenes, turnos, pagos
- **No desviarse**: cada tarea es suficiente, sin refactoring prematuro
- **Commits pequeños**: 1 tarea = 1 commit (máximo 2-3 cosas juntas)
- **TypeScript strict**: sin `any` excepto cuando sea absoluto necesario

## Siguiente Checkpoint (Fase 2)
Una vez CP1 completado → CRUD de clientes y vehículos

---

**Estado**: Listo para comenzar  
**Último update**: 2026-08-31
