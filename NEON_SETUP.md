# Configuración de Neon para Fase 1

Esta guía te ayuda a configurar una base de datos PostgreSQL gratuita en Neon y conectarla a Fase 1.

## Paso 1: Crear Cuenta en Neon

1. Ve a [https://console.neon.tech](https://console.neon.tech)
2. Registrate con email o GitHub
3. Completa la verificación de email

## Paso 2: Crear Proyecto

1. Después de registrarte, haz clic en "Create Project"
2. **Project name**: "taller-mecanico"
3. **Region**: Elige la más cercana a ti
4. **Database name**: "taller_mecanico_db"
5. Haz clic en "Create Project"

## Paso 3: Obtener Connection String

1. Cuando el proyecto esté listo, irás a "Dashboard"
2. Verás una sección **"Connection String"**
3. **IMPORTANTE**: Copia la URL que dice **"Pooled"** (no "Unpooled")
   - Ejemplo: `postgresql://user:password@ep-xxx.region.neon.tech/taller_mecanico_db?sslmode=require`
4. Guárdala en un lugar seguro

## Paso 4: Actualizar .env.local

Reemplaza la sección DATABASE_URL en `.env.local`:

```env
# Database (Neon)
DATABASE_URL="postgresql://neon_user:neon_password@ep-xxx.region.neon.tech/taller_mecanico_db?sslmode=require"

# NextAuth (importante: cambiar en producción)
NEXTAUTH_SECRET="cambiar-esto-en-produccion-32-caracteres-minimo"
NEXTAUTH_URL="http://localhost:3000"

# Environment
NODE_ENV="development"
```

### Generar NEXTAUTH_SECRET seguro

```bash
# En bash/terminal
openssl rand -base64 32

# Copia la salida y pega en NEXTAUTH_SECRET
```

## Paso 5: Verificar Conexión

```bash
# Instalar dependencias (si no lo hiciste)
npm install

# Probar conexión a base de datos
npm run db:push

# Esto debería crear las tablas sin errores
```

## Paso 6: Iniciar Servidor

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## Paso 7: Flujo de Prueba Completo

### A. Sin sesión → Login (automático)
- Accede a http://localhost:3000
- ✅ Redirect automático a /auth/login
- ✅ Página de login visible

### B. Ir a Registro
- Clic en "¿No tienes cuenta? Regístrate"
- ✅ URL: http://localhost:3000/auth/register
- ✅ Formulario de registro visible

### C. Crear Cuenta
```
Nombre: Tu Nombre
Email: tu@ejemplo.com
Nombre del Taller: Mi Taller Mecánico
Contraseña: password123
```
- ✅ Clic en "Registrarse"
- ✅ Sin errores en console
- ✅ Redirect a login con mensaje verde

### D. Verificar Base de Datos
```bash
npm run db:studio
```
- ✅ Abre http://localhost:5555
- ✅ Busca tabla "users" → ver el usuario creado
- ✅ Busca tabla "tallers" → ver el taller creado
- ✅ Busca tabla "user_tallers" → ver la relación

### E. Iniciar Sesión
```
Email: tu@ejemplo.com
Contraseña: password123
```
- ✅ Clic en "Iniciar Sesión"
- ✅ Sin errores
- ✅ Redirect a /dashboard

### F. Dashboard
- ✅ URL: http://localhost:3000/dashboard
- ✅ Bienvenida personalizada
- ✅ Botón "Logout" visible
- ✅ Nombre del taller mostrado

### G. Logout
- ✅ Clic en "Logout"
- ✅ Redirect a /auth/login
- ✅ Sin errores

### H. Acceso Protegido
- ✅ Intenta acceder a http://localhost:3000/dashboard
- ✅ Redirect automático a /auth/login (sin sesión)

## Solución de Problemas

### Error: "Connection refused"
- Verificar DATABASE_URL en .env.local
- Verificar que Neon esté activo
- Reiniciar servidor: `npm run dev`

### Error: "Password authentication failed"
- Verificar credenciales en DATABASE_URL
- Copiar URL "Pooled" nuevamente
- Asegurarse que no haya espacios

### Error: "SSL connection error"
- Verificar que la URL tenga `?sslmode=require` al final
- Neon requiere SSL obligatoriamente

### El servidor no inicia
```bash
# Limpiar cache
rm -rf .next
rm node_modules/.prisma

# Reinstalar y migrar
npm install
npm run db:push
npm run dev
```

### Base de datos vacía después de migración
- Ejecutar de nuevo: `npm run db:migrate`
- Verificar no hay errores
- Checar en Prisma Studio si las tablas existen

## Comandos Útiles

```bash
# Ver estado de migraciones
npm run db:push

# Interfaz visual de BD
npm run db:studio

# Generar tipos Prisma
npm run generate

# Limpiar todo
npm run db:push -- --force-reset  # ⚠️ Elimina datos
```

## Notas de Seguridad

- ✅ NEXTAUTH_SECRET debe ser diferente en producción
- ✅ Nunca commitear .env.local a git
- ✅ Mantener DATABASE_URL privada
- ✅ En Neon: cambiar password si es necesario

## Próximos Pasos

Una vez completado Fase 1:
1. Validar que todo funcione
2. Updatear PROJECT_STATUS.md
3. Pasar a Fase 2 — Clientes y Vehículos

---

**Nota**: Si necesitas soporte de Neon: https://neon.tech/docs/get-started-with-neon/signing-up
