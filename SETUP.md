# Setup Inicial - Guía de Configuración

Esta guía explica cómo preparar el entorno de desarrollo local para Fase 1.

## Requisitos Previos

- **Node.js**: 18+ (recomendado 20 LTS)
- **PostgreSQL**: 12+ instalado localmente O acceso a instancia en cloud
- **npm** o **pnpm**: gestor de paquetes
- **Git**: para versionado

## Paso 1: Instalar Dependencias

```bash
npm install
```

Esto instala:
- Next.js 15
- Prisma ORM
- NextAuth.js
- TypeScript
- Tailwind CSS
- Otras herramientas necesarias

## Paso 2: Configurar Base de Datos

### Opción A: PostgreSQL Local

1. **Crear base de datos**:
```bash
# Desde psql o cliente PostgreSQL
createdb taller_mecanico_db
```

2. **Configurar variables de entorno**:
```bash
cp .env.example .env.local
```

Editar `.env.local`:
```env
DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/taller_mecanico_db"
NEXTAUTH_SECRET="tu-clave-secreta-aqui"
NEXTAUTH_URL="http://localhost:3000"
NODE_ENV="development"
```

Reemplazar:
- `usuario`: tu usuario PostgreSQL
- `contraseña`: contraseña de ese usuario
- `tu-clave-secreta-aqui`: cualquier cadena aleatoria (será para desarrollo local)

### Opción B: PostgreSQL en Cloud (Vercel/Neon/etc)

1. Crear base de datos en el servicio elegido
2. Copiar URL de conexión
3. Editar `.env.local` con esa URL

## Paso 3: Ejecutar Migraciones

Crear tablas en la base de datos:

```bash
npm run db:migrate
```

Esto:
- Lee `prisma/schema.prisma`
- Crea tablas necesarias
- Genera cliente Prisma automáticamente

## Paso 4: Generar Cliente Prisma

```bash
npm run generate
```

Esto genera `node_modules/.prisma/client/` con tipos correctos.

## Paso 5: Iniciar Servidor de Desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

Verás redirect a login (Fase 1 no tiene usuarios aún).

## Verificación

### ✅ Checklist de setup correcto:

- [ ] `npm install` sin errores
- [ ] `.env.local` creado con DATABASE_URL válido
- [ ] `npm run db:migrate` sin errores
- [ ] `npm run dev` inicia en puerto 3000
- [ ] [http://localhost:3000](http://localhost:3000) abre sin errors en console

### ❌ Problemas comunes:

**Error: "database does not exist"**
```bash
# Crear BD en PostgreSQL
createdb taller_mecanico_db
```

**Error: "Connection refused"**
- Verificar PostgreSQL está corriendo
- Verificar DATABASE_URL en .env.local
- En Windows: `pg_ctl start -D "C:\Program Files\PostgreSQL\data"`

**Error: TypeScript "Cannot find module"**
```bash
# Regenerar tipos Prisma
npm run generate
```

**Error: "NEXTAUTH_SECRET not configured"**
- Verificar NEXTAUTH_SECRET en .env.local
- Generar secret: `openssl rand -base64 32`

## Herramientas Útiles

### Prisma Studio (interfaz visual)
```bash
npm run db:studio
```
Abre [http://localhost:5555](http://localhost:5555) para explorar datos.

### Ver logs de Prisma
En desarrollo, los logs de queries están activados. Ver console.

### Reset completo (⚠️ borra datos)
```bash
# Eliminar todas tablas y recrearlas
npm run db:push -- --force-reset
```

## Estructura Base Creada

```
✅ app/
   ├── api/              (vacío, se llena en Fase 2+)
   ├── auth/             (vacío, se llena en Fase 1)
   ├── dashboard/        (vacío, se llena en Fase 1)
   ├── layout.tsx        (layout global)
   └── page.tsx          (home → redirect)

✅ components/
   ├── ui/               (para shadcn/ui components)
   ├── forms/            (formularios reutilizables)
   └── common/           (componentes comunes)

✅ lib/
   ├── auth.ts           (NextAuth config)
   ├── db.ts             (Prisma singleton)
   ├── validations.ts    (Zod schemas)

✅ prisma/
   ├── schema.prisma     (modelos de datos - Fases 1-6)
   └── migrations/       (se crea al hacer migrate)

✅ types/
   └── index.ts          (TypeScript types)

✅ styles/
   └── globals.css       (Tailwind + estilos globales)

✅ Documentación:
   ├── CLAUDE.md         (reglas y arquitectura)
   ├── ROADMAP.md        (fases y checkpoints)
   ├── README.md         (overview)
   └── SETUP.md          (este archivo)
```

## Siguiente Paso (Fase 1)

Una vez completado el setup, comenzar con:

1. **Crear página de login** (`app/auth/login/page.tsx`)
2. **Crear API de autenticación** (`app/api/auth/[...nextauth]/route.ts`)
3. **Crear página de registro** (`app/auth/register/page.tsx`)
4. **Crear dashboard vacío** (`app/dashboard/page.tsx`)
5. **Agregar middleware** de protección de rutas

Ver **ROADMAP.md > Fase 1** para tareas detalladas.

---

**¿Preguntas?** Revisar:
- CLAUDE.md para reglas arquitectónicas
- ROADMAP.md para cronograma
- Prisma docs: https://www.prisma.io/docs/
- NextAuth docs: https://next-auth.js.org/

**Última actualización**: 2026-08-31
