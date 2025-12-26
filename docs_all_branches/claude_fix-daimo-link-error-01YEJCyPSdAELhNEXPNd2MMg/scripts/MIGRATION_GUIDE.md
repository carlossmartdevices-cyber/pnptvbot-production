# Guía de Migración de Usuarios

Esta guía explica cómo verificar y actualizar los usuarios existentes con las nuevas funcionalidades del bot mientras se mantienen intactas sus suscripciones actuales.

## 📋 Nuevas Funcionalidades Agregadas

Los usuarios existentes necesitan ser actualizados con los siguientes campos nuevos:

1. **Privacy Settings** (`privacy` object):
   - `showLocation`: Mostrar ubicación
   - `showInterests`: Mostrar intereses
   - `showBio`: Mostrar biografía
   - `allowMessages`: Permitir mensajes
   - `showOnline`: Mostrar estado en línea

2. **Profile Features**:
   - `profileViews`: Contador de vistas al perfil
   - `favorites`: Array de usuarios favoritos
   - `blocked`: Array de usuarios bloqueados
   - `badges`: Array de insignias del usuario

## 🔍 Paso 1: Verificar Estado Actual

Antes de hacer cualquier cambio, verifica el estado actual de tus usuarios:

```bash
npm run check:subscriptions
```

Este comando mostrará:
- Total de usuarios
- Usuarios por estado de suscripción (free, active, expired, etc.)
- Usuarios por rol (user, admin, moderator, etc.)
- Usuarios que necesitan migración
- Lista de suscripciones activas con fechas de expiración
- Lista de suscripciones expiradas

**Ejemplo de salida:**
```
📊 USER SUBSCRIPTION REPORT

====================================================================

📈 TOTAL USERS: 150

💎 BY SUBSCRIPTION STATUS:
  free: 120 (80.0%)
  active: 25 (16.7%)
  expired: 5 (3.3%)

👥 BY ROLE:
  user: 145 (96.7%)
  admin: 3 (2.0%)
  moderator: 2 (1.3%)

⚠️  MISSING NEW FIELDS:
  Users without new fields: 145
  Missing field counts:
    - privacy: 145 users
    - profileViews: 145 users
    - favorites: 145 users
    - blocked: 145 users
    - badges: 145 users

✅ ACTIVE SUBSCRIPTIONS: 25
  Details:
    - Juan Pérez (123456789)
      Plan: premium | Expiry: 2025-12-31T23:59:59.000Z
    - María García (987654321)
      Plan: gold | Expiry: 2025-11-30T23:59:59.000Z

⚠️  EXPIRED SUBSCRIPTIONS: 5
  Details:
    - Carlos López (456789123)
      Plan: basic | Expired: 2025-10-15T23:59:59.000Z

====================================================================

💡 RECOMMENDATION:
   Run migration script to add new fields to existing users:
   npm run migrate:users
```

## 🚀 Paso 2: Ejecutar Migración

Una vez verificado el estado, ejecuta la migración:

```bash
npm run migrate:users
```

Este comando:
- ✅ Agrega los campos nuevos a usuarios existentes
- ✅ Mantiene intactas las suscripciones actuales
- ✅ Preserva roles de admin/moderator
- ✅ No modifica datos existentes
- ✅ Usa `merge: true` para seguridad

**Ejemplo de salida:**
```
Starting user migration...
Found 150 users to migrate

Migrated user 123456789 {
  subscriptionStatus: 'active',
  role: 'user',
  addedFields: [ 'privacy', 'profileViews', 'favorites', 'blocked', 'badges' ]
}

Migrated user 987654321 {
  subscriptionStatus: 'free',
  role: 'admin',
  addedFields: [ 'privacy', 'profileViews', 'favorites', 'blocked', 'badges' ]
}

Migration completed! {
  total: 150,
  migrated: 145,
  skipped: 5,
  errors: 0
}

Users by subscription status: {
  free: 120,
  active: 25,
  expired: 5
}

✅ Migration completed successfully!

Summary:
Total users: 150
Migrated: 145
Skipped (already migrated): 5
Errors: 0

Users by subscription status:
  free: 120
  active: 25
  expired: 5
```

## 🔒 Garantías de Seguridad

La migración está diseñada para ser **100% segura**:

1. **No modifica suscripciones**: Los campos `subscriptionStatus`, `planId`, `planExpiry` nunca se tocan
2. **No modifica roles**: El campo `role` se mantiene intacto
3. **Solo agrega campos nuevos**: No elimina ni modifica datos existentes
4. **Usa merge mode**: Firestore merge previene pérdida de datos
5. **Idempotente**: Se puede ejecutar múltiples veces sin problemas
6. **Skip automático**: Usuarios ya migrados se saltan automáticamente

## 📊 Paso 3: Verificar Migración

Después de la migración, verifica nuevamente:

```bash
npm run check:subscriptions
```

Deberías ver:
- ✅ Usuarios sin campos faltantes: 0
- ✅ Todas las suscripciones activas preservadas
- ✅ Todos los roles preservados

## 🆘 Solución de Problemas

### Si la migración falla:

1. **Verifica conexión a Firebase:**
   ```bash
   npm run validate:env
   ```

2. **Revisa los logs:**
   - Los errores se registran en los logs del sistema
   - Cada error muestra el userId afectado

3. **Re-intenta la migración:**
   - La migración es idempotente
   - Puedes ejecutarla de nuevo sin problemas

### Si encuentras suscripciones expiradas:

El reporte mostrará suscripciones expiradas que puedes renovar manualmente desde el admin panel:

```bash
/admin → User Management → Buscar usuario → Extend Subscription
```

## 📝 Campos Agregados por la Migración

```javascript
// Valores por defecto para usuarios existentes:
{
  privacy: {
    showLocation: true,      // Mostrar ubicación por defecto
    showInterests: true,     // Mostrar intereses por defecto
    showBio: true,           // Mostrar bio por defecto
    allowMessages: true,     // Permitir mensajes por defecto
    showOnline: true         // Mostrar online por defecto
  },
  profileViews: 0,           // Sin vistas inicialmente
  favorites: [],             // Sin favoritos inicialmente
  blocked: [],               // Sin bloqueados inicialmente
  badges: []                 // Sin badges inicialmente
}
```

## ✅ Checklist de Migración

- [ ] Hacer backup de la base de datos (recomendado)
- [ ] Ejecutar `npm run check:subscriptions` para verificar estado actual
- [ ] Revisar el reporte y confirmar suscripciones activas
- [ ] Ejecutar `npm run migrate:users` para migrar usuarios
- [ ] Revisar salida de la migración (errores = 0)
- [ ] Ejecutar `npm run check:subscriptions` nuevamente para verificar
- [ ] Confirmar que usuarios sin campos faltantes = 0
- [ ] Confirmar que suscripciones activas se mantuvieron

## 🎯 Resultado Esperado

Después de la migración completa:

✅ Todos los usuarios tendrán configuraciones de privacidad
✅ Todos los usuarios podrán usar favoritos y bloqueos
✅ Todos los usuarios tendrán contador de vistas
✅ Admins podrán asignar badges
✅ **Todas las suscripciones PRIME se mantienen intactas**
✅ **Todos los roles se mantienen intactos**

## 🔄 Migración Automática en Producción

Opcional: Puedes configurar la migración para que se ejecute automáticamente al iniciar:

```json
// package.json
{
  "scripts": {
    "prestart": "npm run validate:env && npm run migrate:users"
  }
}
```

⚠️ **Nota**: Solo recomendado si estás seguro de que la migración está probada.
