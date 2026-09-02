# Fase 1 — Setup e Implementación

Este archivo documenta los pasos ejecutados en Fase 1 y cómo correr el proyecto.

## Archivos Creados

### API Routes
- ✅ `app/api/auth/[...nextauth]/route.ts` — Maneja NextAuth
- ✅ `app/api/auth/register/route.ts` — Endpoint de registro

### Páginas
- ✅ `app/auth/login/page.tsx` — Página de login
- ✅ `app/auth/register/page.tsx` — Página de registro
- ✅ `app/dashboard/page.tsx` — Dashboard inicial (protegido)

### Middleware
- ✅ `middleware.ts` — Protege rutas /dashboard, redirige auth

### Configuración
- ✅ `.env.local` — Variables de entorno

## Próximos Pasos (Hacer una sola vez)

### 1. Configurar Base de Datos

**Opción A: PostgreSQL Local**
```bash
# Crear base de datos (en psql o cliente PostgreSQL)
createdb taller_mecanico_db

# Editar .env.local
DATABASE_URL="postgresql://tu_usuario:tu_password@localhost:5432/taller_mecanico_db"
```

**Opción B: Neon (Cloud)**
```bash
# 1. Crear proyecto en https://console.neon.tech
# 2. Copiar connection string
# 3. Editar .env.local
DATABASE_URL="postgresql://user:password@ep-xxx.region.neon.tech/dbname?sslmode=require"
```

### 2. Instalar Dependencias

```bash
npm install
```

Esto instala todas las dependencias incluyendo:
- next-auth v5
- prisma
- bcrypt
- react-hook-form
- zod

### 3. Ejecutar Migraciones

```bash
npm run db:migrate
```

Esto:
- Crea todas las tablas en la base de datos
- Genera cliente Prisma actualizado
- Prepara la BD para Fase 1

### 4. Iniciar Servidor de Desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

## Flujo de Prueba Fase 1

1. **Redirect a login** (automático, no autenticado)
   - URL: [http://localhost:3000](http://localhost:3000) → `/auth/login`

2. **Ir a registro**
   - Clic en "¿No tienes cuenta? Regístrate"
   - URL: [http://localhost:3000/auth/register](http://localhost:3000/auth/register)

3. **Crear cuenta**
   - Nombre: "Tu Nombre"
   - Email: "tu@email.com"
   - Nombre del Taller: "Mi Taller Mecánico"
   - Contraseña: "password123"
   - Clic en "Registrarse"

4. **Redirect a login**
   - Mensaje de confirmación
   - Redirect automático a login

5. **Iniciar sesión**
   - Email: "tu@email.com"
   - Contraseña: "password123"
   - Clic en "Iniciar Sesión"

6. **Dashboard**
   - URL: [http://localhost:3000/dashboard](http://localhost:3000/dashboard)
   - Nombre del taller visible
   - Bienvenida personalizada
   - Botón de logout

7. **Logout**
   - Clic en "Logout"
   - Redirect a login

8. **Acceso protegido**
   - Intentar acceder a `/dashboard` sin autenticación
   - Redirect automático a `/auth/login`

## Validación de Checkpoint 1

Marcar cuando se verifique cada punto:

- [ ] Base de datos migrada (tablas creadas)
- [ ] npm install sin errores
- [ ] npm run dev inicia en puerto 3000
- [ ] Puede registrarse nuevo usuario
- [ ] Usuario + Taller creados correctamente en BD
- [ ] Puede iniciar sesión con credenciales
- [ ] Dashboard accesible
- [ ] Logout funciona
- [ ] /dashboard redirige a login sin sesión
- [ ] No hay errores en console del navegador

## Arquitectura Implementada

```
User (1) ←→ (1) Taller (vía UserTaller)
```

- User: email único, contraseña hasheada
- Taller: datos del taller creado en registro
- UserTaller: relación con role = "admin"

## Próxima Fase

Fase 2 — Clientes y Vehículos:
- CRUD de clientes
- CRUD de vehículos
- Búsqueda

---

**Ultima actualización**: 2026-08-31  
**Status**: Listo para probar
