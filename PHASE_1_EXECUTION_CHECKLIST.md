# Checklist de Ejecución Fase 1

Este documento es tu guía paso a paso para ejecutar y verificar Fase 1.

**Última actualización**: 2026-08-31  
**Status**: Listo para ejecutar

---

## PARTE 1: CONFIGURACIÓN DE NEON

### ✅ Tareas Completadas por Claude

- [x] `.env.local` creado (plantilla)
- [x] Guía NEON_SETUP.md creada
- [x] Toda la lógica de Fase 1 implementada
- [x] Base de datos schema completo

### ⏳ Tareas que debes hacer TÚ

**En el navegador:**
1. [ ] Ir a https://console.neon.tech
2. [ ] Crear cuenta (email o GitHub)
3. [ ] Crear proyecto "taller-mecanico"
4. [ ] Copiar CONNECTION STRING (Pooled)

**En tu terminal:**
5. [ ] Abrir `.env.local` en editor
6. [ ] Reemplazar DATABASE_URL con la URL de Neon
7. [ ] Generar NEXTAUTH_SECRET con `openssl rand -base64 32`
8. [ ] Verificar que NEXTAUTH_URL = "http://localhost:3000"

---

## PARTE 2: INSTALAR Y MIGRAR

### Comando 1: Instalar Dependencias
```bash
cd C:\Users\tomin\OneDrive\Escritorio\Taller-gestion
npm install
```

**Que esperar:**
- Descarga e instala ~300+ paquetes
- Toma 2-5 minutos
- Crea carpeta `node_modules/`
- ✅ Sin errores al final

**Marcar cuando complete:**
- [ ] `npm install` sin errores

### Comando 2: Ejecutar Migraciones
```bash
npm run db:migrate
```

**Que esperar:**
- Crea todas las tablas en Neon
- Genera cliente Prisma
- Muestra confirmación de tablas creadas
- ✅ Sin errores

**Marcar cuando complete:**
- [ ] `npm run db:migrate` sin errores
- [ ] Todas las tablas creadas en Neon

### Verificar (Opcional pero recomendado):
```bash
npm run db:studio
```
- Abre http://localhost:5555 en navegador
- Verifica que existan tablas: users, tallers, user_tallers, etc.
- Cierra con Ctrl+C cuando termines

---

## PARTE 3: INICIAR SERVIDOR

### Comando: Iniciar Dev Server
```bash
npm run dev
```

**Que esperar:**
- Terminal muestra: "▲ Next.js" + puerto
- Debe iniciar en http://localhost:3000
- ✅ Sin errores

**Si hay errores:**
- Revisar .env.local (DATABASE_URL correcta)
- Revisar NEXTAUTH_SECRET (mínimo 32 caracteres)
- Verificar que Neon está accesible

**Marcar cuando complete:**
- [ ] `npm run dev` inicia sin errores
- [ ] Terminal muestra servidor en puerto 3000

---

## PARTE 4: PRUEBA DE FLUJO COMPLETO

**Dejar servidor corriendo en terminal. Abrir navegador en otra ventana.**

### Test 1: Redirect Sin Sesión ✅
```
Ir a: http://localhost:3000
Esperar: Redirect automático a http://localhost:3000/auth/login
Marcar: [ ]
```

### Test 2: Página de Login ✅
```
URL: http://localhost:3000/auth/login
Ver: Formulario de login (email, password)
Ver: Link "¿No tienes cuenta? Regístrate"
Marcar: [ ]
```

### Test 3: Ir a Registro ✅
```
Clic en: "¿No tienes cuenta? Regístrate"
Esperar: URL = http://localhost:3000/auth/register
Ver: Formulario con 4 campos (name, email, tallerName, password)
Marcar: [ ]
```

### Test 4: Registrar Usuario ✅
```
COMPLETA ESTE FORMULARIO:
  Nombre: Tu Nombre (ej: "Carlos González")
  Email: tu@test.com
  Nombre del Taller: Mi Taller Test
  Contraseña: password123

Clic: "Registrarse"
Esperar: Sin errores en console (F12 → Console)
Esperar: Redirect a /auth/login
Ver: Mensaje verde "Cuenta creada exitosamente"
Marcar: [ ]
```

### Test 5: Verificar BD (Opcional)
```bash
# En otra terminal (sin cerrar npm run dev)
npm run db:studio
```
- Abre http://localhost:5555
- Busca "users" → encuentra tu usuario
- Busca "tallers" → encuentra tu taller
- Busca "user_tallers" → encuentra la relación (role = "admin")
- Cierra con Ctrl+C
- Marcar: [ ]

### Test 6: Iniciar Sesión ✅
```
URL: http://localhost:3000/auth/login
Email: tu@test.com
Contraseña: password123

Clic: "Iniciar Sesión"
Esperar: Sin errores en console
Esperar: Redirect a /dashboard
Marcar: [ ]
```

### Test 7: Dashboard Accesible ✅
```
URL actual: http://localhost:3000/dashboard
Ver: Bienvenida personalizada ("Bienvenido, Tu Nombre")
Ver: Nombre del taller ("Tu Taller Test")
Ver: Botón "Logout"
Ver: Mensaje de confirmación Fase 1
Marcar: [ ]
```

### Test 8: Logout ✅
```
Clic: Botón "Logout"
Esperar: Redirect a /auth/login
Ver: Sesión limpiada
Marcar: [ ]
```

### Test 9: Acceso Protegido ✅
```
URL: http://localhost:3000/dashboard
Esperar: Redirect automático a /auth/login
Razón: No hay sesión activa
Marcar: [ ]
```

### Test 10: Sin Errores en Console ✅
```
F12 → Console Tab
Ver: Sin errores rojos
Ver: Sin warnings críticos
Marcar: [ ]
```

---

## PARTE 5: RESULTADOS

Cuando completes TODOS los tests, marca aquí:

### ✅ PRUEBAS PASADAS

- [ ] Redirect sin sesión → login
- [ ] Página login accesible
- [ ] Página registro accesible
- [ ] Registro crea usuario + taller en BD
- [ ] BD tiene estructura correcta (user_tallers creada)
- [ ] Login autentica correctamente
- [ ] Dashboard accesible solo autenticado
- [ ] Logout limpia sesión
- [ ] /dashboard protegido (redirige a login sin sesión)
- [ ] Sin errores en console

### ❌ ERRORES ENCONTRADOS

Si encuentra errores, documentarlos aquí:

```
Error 1: [descripción]
  Línea/Ubicación: [donde ocurre]
  Solución intentada: [qué intentaste]
  Resultado: [sigue presente / se arregló]

Error 2: ...
```

---

## PARTE 6: FINALIZAR

### Cuando TODO pase:

1. [ ] Cierra servidor (Ctrl+C en terminal)
2. [ ] Actualiza PROJECT_STATUS.md
3. [ ] Documenta cualquier ajuste hecho
4. [ ] Parado para pasar a Fase 2

### Comando para Detener:
```bash
# En la terminal donde corre npm run dev
Ctrl + C
```

---

## ARCHIVOS CLAVE

```
.env.local                    ← Tu configuración (NO commitear)
app/api/auth/[...nextauth]    ← Maneja autenticación
app/auth/login                ← Formulario login
app/auth/register             ← Formulario registro
app/dashboard                 ← Dashboard protegido
middleware.ts                 ← Protege /dashboard
prisma/schema.prisma          ← Estructura de tablas
```

---

## PROXIMOS PASOS DESPUÉS DE FASE 1

1. ✅ Fase 1 completada y verificada
2. ⏳ Fase 2 — Clientes y Vehículos
   - Crear formularios CRUD para clientes
   - Crear formularios CRUD para vehículos
   - Agregar búsqueda

**Estimado Fase 2**: 3-4 días

---

## SOPORTE

Si algo falla:

1. **Revisar console del navegador** (F12)
2. **Revisar logs en terminal**
3. **Verificar .env.local** (DATABASE_URL y NEXTAUTH_SECRET)
4. **Reiniciar servidor**: Ctrl+C, luego `npm run dev`
5. **Ver NEON_SETUP.md** para troubleshooting

---

**Checklist creado**: 2026-08-31  
**Fase 1 Status**: Implementada, lista para ejecución  
**Próximo paso**: Sigue los comandos en orden
