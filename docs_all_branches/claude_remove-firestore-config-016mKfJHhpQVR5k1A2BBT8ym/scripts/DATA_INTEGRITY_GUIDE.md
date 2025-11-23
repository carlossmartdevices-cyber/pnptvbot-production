# Guía de Integridad de Datos - PNPTV Bot

## 📋 Resumen de Problemas Encontrados

Durante la migración de Firebase a PostgreSQL (Noviembre 2025), se identificaron los siguientes problemas:

### Problema 1: Usuarios Premium Degradados
- **Cantidad afectada:** 71 usuarios (70 Premium, 1 Basic)
- **Causa:** El script de migración usaba `data.subscriptionStatus || 'free'`, lo que causaba que usuarios Premium sin este campo explícito fueran degradados a free
- **Solución aplicada:** Script `restore-premium-users.js`

### Problema 2: Usuarios con Pagos Sin Acceso
- **Cantidad afectada:** 13 usuarios (7 PNP, 4 Diamond, 2 Crystal)
- **Causa:** Pagos completados pero `subscription_status` no actualizado
- **Solución aplicada:** Script `restore-paid-users.js`

### Problema 3: Inconsistencias de Capitalización
- **Cantidad afectada:** 320 usuarios
- **Causa:** Valores inconsistentes: "free" vs "Free"
- **Solución aplicada:** Script `fix-tier-capitalization.js`

---

## 🛡️ Medidas de Prevención Implementadas

### 1. Scripts Mejorados

#### `validate-user-data.js`
Script de validación que verifica:
- ✅ Capitalización correcta de tier
- ✅ Premium tiers tienen subscripción activa
- ✅ Usuarios con pagos completados tienen acceso activo
- ✅ Subscripciones activas tienen plan_id
- ✅ Valores válidos de subscription_status

**Uso:**
```bash
# Solo verificar
node scripts/validate-user-data.js

# Verificar y corregir automáticamente
node scripts/validate-user-data.js --fix
```

#### `migrate-firestore-to-postgres.js` (Mejorado)
Ahora incluye:
- ✅ Función `normalizeTier()` - Normaliza capitalización
- ✅ Función `determineSubscriptionStatus()` - Infiere status correcto basado en tier y expiración
- ✅ Función `determinePlanId()` - Asigna plan_id basado en tier
- ✅ Validación post-migración automática

---

## 📝 Mejores Prácticas

### Antes de una Migración

1. **Backup Completo**
   ```bash
   # PostgreSQL
   pg_dump -h localhost -p 55432 -U pnptvbot pnptvbot > backup_$(date +%Y%m%d_%H%M%S).sql

   # Firebase (exportar colecciones críticas)
   ```

2. **Ejecutar en Modo Dry-Run**
   ```bash
   node scripts/migrate-firestore-to-postgres.js --dry-run
   ```

3. **Revisar Logs**
   - Buscar advertencias sobre usuarios Premium sin subscriptionStatus
   - Verificar que los conteos coincidan

### Durante la Migración

1. **Monitorear el Progreso**
   - Revisar mensajes informativos (ℹ️) sobre inferencias automáticas
   - Confirmar que los defaults aplicados sean correctos

2. **No Interrumpir el Proceso**
   - Esperar a que termine completamente
   - Si hay error, revisar logs antes de reintentar

### Después de una Migración

1. **Ejecutar Validación Inmediatamente**
   ```bash
   node scripts/validate-user-data.js
   ```

2. **Revisar Estadísticas**
   ```sql
   -- Distribución de tiers
   SELECT tier, subscription_status, COUNT(*)
   FROM users
   GROUP BY tier, subscription_status
   ORDER BY tier, subscription_status;

   -- Usuarios premium sin acceso activo
   SELECT COUNT(*)
   FROM users
   WHERE tier IN ('Premium', 'Crystal', 'Diamond', 'PNP', 'Basic')
   AND subscription_status != 'active';

   -- Pagos completados sin acceso
   SELECT COUNT(DISTINCT u.id)
   FROM users u
   JOIN payments p ON u.id::text = p.user_id
   WHERE p.status = 'payment_completed'
   AND u.subscription_status != 'active';
   ```

3. **Corregir Problemas**
   ```bash
   # Si hay problemas, usar auto-fix
   node scripts/validate-user-data.js --fix
   ```

---

## 🔄 Mantenimiento Regular

### Validaciones Semanales

Agregar a cron:
```bash
# Todos los lunes a las 3 AM
0 3 * * 1 cd /root/pnptvbot-production && node scripts/validate-user-data.js >> /var/log/pnptv-validation.log 2>&1
```

### Auditoría Mensual

1. Revisar usuarios con subscripciones por expirar
2. Verificar consistencia entre payments y subscriptions
3. Comprobar que no haya tiers inválidos

---

## 🚨 Señales de Alerta

### Indicadores de Problemas

- ⚠️ Usuarios Premium reportando pérdida de acceso
- ⚠️ Descenso repentino en conteo de usuarios activos
- ⚠️ Pagos completados sin activación automática
- ⚠️ Valores de tier inconsistentes en logs

### Respuesta Rápida

1. **Detener nuevas migraciones/actualizaciones**
2. **Ejecutar validación:**
   ```bash
   node scripts/validate-user-data.js
   ```
3. **Si hay problemas, aplicar fix:**
   ```bash
   node scripts/validate-user-data.js --fix
   ```
4. **Verificar resultados:**
   ```bash
   node scripts/validate-user-data.js
   ```

---

## 📚 Scripts Disponibles

| Script | Propósito | Cuándo Usar |
|--------|-----------|-------------|
| `validate-user-data.js` | Verificar integridad de datos | Después de migraciones, semanalmente |
| `restore-premium-users.js` | Restaurar usuarios Premium degradados | Si se detecta el problema específico |
| `restore-paid-users.js` | Activar usuarios que pagaron | Si se detectan pagos sin activación |
| `fix-tier-capitalization.js` | Normalizar capitalización de tiers | Si hay inconsistencias de formato |
| `migrate-firestore-to-postgres.js` | Migración con safeguards | Migraciones nuevas |

---

## 🔐 Valores Válidos

### Tiers Permitidos
- `Free` (capitalización correcta)
- `Basic`
- `Premium`
- `Crystal`
- `Diamond`
- `PNP`

### Subscription Status Permitidos
- `free` (minúscula)
- `active`
- `inactive`
- `cancelled`

### Mapeo Tier → Plan ID
- `Premium` → `lifetime-pass`
- `Crystal` → `crystal-member`
- `Diamond` → `diamond-member`
- `PNP` → `pnp-member`
- `Basic` → `trial-week`

---

## 📞 Contacto y Soporte

Si encuentras problemas de integridad de datos:

1. Ejecuta el script de validación y guarda el output
2. Revisa los logs de migración
3. Ejecuta auto-fix si es seguro hacerlo
4. Documenta el problema para análisis posterior

---

**Última actualización:** 19 de Noviembre de 2025
**Versión:** 1.0
