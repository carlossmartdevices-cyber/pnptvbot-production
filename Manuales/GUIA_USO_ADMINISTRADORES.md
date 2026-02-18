# 👑 GUÍA DE USO - PARA ADMINISTRADORES

**PNP TV Bot - Manual de Administración**
**Versión**: 1.0
**Fecha**: 2026-02-13

---

## 📑 TABLA DE CONTENIDOS

1. [Acceso al Panel Admin](#acceso-al-panel-admin)
2. [Gestión de Usuarios](#gestión-de-usuarios)
3. [Gestión de Roles](#gestión-de-roles)
4. [Difusiones y Comunicaciones](#difusiones-y-comunicaciones)
5. [Estadísticas y Reportes](#estadísticas-y-reportes)
6. [Moderación](#moderación)
7. [Gestión de Comunidad](#gestión-de-comunidad)
8. [Tareas Especializadas](#tareas-especializadas)
9. [Troubleshooting](#troubleshooting)

---

## ACCESO AL PANEL ADMIN

### 🔓 Iniciar Sesión como Admin

**Comando**: `/admin`

```
Este comando SOLO funciona si tu ID de Telegram está
en las variables de entorno (ADMIN_ID, ADMIN_USER_IDS)
```

### 📊 Pantalla Principal del Panel

Se muestra un menú con botones según tu rol:

```
┌─────────────────────────────────────┐
│     🎛️ PANEL DE ADMINISTRACIÓN      │
├─────────────────────────────────────┤
│ 👥 Usuarios                         │
│ 👑 Roles                            │
│ 📢 Difusión                         │
│ 📦 Cola de Difusión                 │
│ 📊 Estadísticas                     │
│ 💳 Webhooks de Pago                 │
│ 🔒 Reporte de Seguridad             │
│ 📍 Nearby Places                    │
│ 🧹 Limpiar Comunidad                │
│ 🧠 Cristina Asistente Admin         │
│ 👁️ Vista Previa                     │
│ 🐦 Publicar en X                    │
└─────────────────────────────────────┘
```

---

## GESTIÓN DE USUARIOS

### 🔍 Buscar un Usuario

**Paso 1**: Click en **"👥 Usuarios"**

**Paso 2**: Ingresa el criterio de búsqueda:
- 🆔 ID de Telegram
- 📛 Username
- 📧 Email

```
Ejemplo:
👥 Usuarios → [Búsqueda]
Ingresa: @juanperez
```

**Paso 3**: Se mostrarán los resultados

### 📋 Acciones sobre un Usuario

Una vez encontrado, se muestran opciones:

#### **📝 Editar Perfil**
```
Cambiar:
├─ Username
├─ Email
└─ Bio/Descripción
```

#### **💎 Gestionar Membresía**

**Cambiar Tier** (Free ↔ Prime):
```
Usuario actual: Free
├─ ✅ Promocionar a Prime
└─ (Si es Prime) → Degradar a Free
```

**Cambiar Estado de Suscripción**:
```
Estados posibles:
├─ active (Suscripción activa)
├─ free (Sin suscripción)
├─ churned (Cancelada)
└─ expired (Expirada)
```

**Extender Suscripción**:
```
¿Cuántos días agregar?
[30 ]

Resultado:
✅ Suscripción extendida 30 días
└─ Nueva fecha: [12/03/2026]
```

**Convertir a Lifetime**:
```
Hacer que la membresía nunca expire
├─ Método: Activación Manual
└─ ✅ Cambiar a Lifetime
   └─ plan_expiry: NULL
```

#### **🚫 Control de Acceso**

**Banear Usuario**:
```
Banear a: @usuario_id

Resultado:
❌ Usuario NO puede:
├─ Usar comandos
├─ Enviar mensajes
└─ Acceder a funciones

⚠️ Puede desbanear después
```

**Desbanear Usuario**:
```
Usuario actual: BANNED
├─ ✅ Desbanear
└─ Puede usar el bot nuevamente
```

**Forzar Verificación de Edad**:
```
Reset verificación de edad
→ Usuario debe reverificar
   para acceder a contenido restringido
```

#### **💬 Enviar Mensaje Directo**

```
1. Redacta el mensaje
   ↓
2. Se enruta a través de soporte
   ↓
3. Usuario lo recibe como:
   "💬 Admin (Soporte): [Mensaje]"
   ↓
4. Queda registro en su ticket de soporte
```

---

## GESTIÓN DE ROLES

### 👑 Panel de Roles

**Comando**: `/admin` → **"👑 Roles"**

(Solo visible para Super Admin y Admin)

### 👀 Ver Roles Actuales

Se muestra lista de:
- 🔴 Super Admins
- 🟡 Admins
- 🟢 Moderators

```
SUPER ADMINS (2)
├─ Lex (ID: 123456789)
└─ Santino (ID: 987654321)

ADMINS (3)
├─ Carlos (ID: 111111111)
├─ María (ID: 222222222)
└─ Pedro (ID: 333333333)

MODERATORS (5)
├─ Juan (ID: 444444444)
├─ Ana (ID: 555555555)
...
```

### ➕ Agregar Nuevo Rol

```
1. Click: "➕ Agregar Moderador/Admin"
   ↓
2. Ingresa ID de Telegram del usuario
   [987654321]
   ↓
3. Selecciona nuevo rol:
   ├─ 🟢 Moderator
   ├─ 🟡 Admin
   └─ 🔴 Super Admin (solo Super Admin puede)
   ↓
4. ✅ Confirmación
   └─ Rol asignado exitosamente
```

### 🔄 Cambiar Rol Existente

**Promover**:
```
Usuario: @carlos
Rol actual: Moderator
   ↓
📈 Promover a Admin
   ↓
✅ @carlos es ahora Admin
```

**Degradar**:
```
Usuario: @maria
Rol actual: Admin
   ↓
📉 Degradar a Moderator
   ↓
✅ @maria es ahora Moderator
```

**Remover**:
```
Usuario: @juan
Rol actual: Moderator
   ↓
❌ Remover rol
   ↓
✅ @juan ya no es Moderator
```

---

## DIFUSIONES Y COMUNICACIONES

### 📢 Crear una Difusión

**Acceso**: `/admin` → **"📢 Difusión"**

### 🎬 Paso 1: Seleccionar Tipo de Contenido

```
¿Qué tipo de contenido?
├─ 📝 Solo texto
├─ 📝 Texto + Imagen
├─ 🎥 Texto + Video
├─ 📄 Texto + Documento
└─ 🎵 Texto + Audio
```

### 📋 Paso 2: Proporcionar Contenido

**Si es texto + media**:
```
1. Escribe el mensaje
   [Hola, tenemos una oferta especial...]

2. Adjunta media
   (foto, video, documento, audio)
```

### 🧠 Paso 3: Generar Texto con IA (Opcional)

```
¿Generar con IA?
├─ ✅ Generar (Meth Daddy style)
│  └─ La IA redacta un mensaje atractivo
└─ ❌ Usar mi texto
```

**Resultado**: Texto profesional listo en es/en

### 🎨 Paso 4: Añadir Botones Interactivos

```
¿Agregar botones?
├─ Botón 1: Texto: "Comprar" | Link: https://pnptv.app
├─ Botón 2: Texto: "Más Info" | Link: https://pnptv.app/info
└─ (Máximo 3 botones)
```

### 👥 Paso 5: Seleccionar Audiencia

```
¿A quién enviar?
├─ 👥 Todos los usuarios
├─ 💎 Solo Premium
├─ 🆓 Solo Free
├─ 🔴 Usuarios Churned (cancelados)
└─ ⏳ Pagos incompletos
```

### ⏰ Paso 6: Cuándo Enviar

```
¿Cuándo enviar?
├─ ⚡ Ahora
│  └─ Se envía inmediatamente
│     └─ Reporte: [Enviados: 1,250 | Fallidos: 3]
│
└─ 📅 Programar
   ├─ Elige fecha: [12/03/2026]
   ├─ Elige hora: [14:30]
   └─ ✅ Confirmación
      └─ Se enviará en la fecha/hora especificada
```

### 📧 Paso 7: Envío por Email (Opcional)

```
¿Enviar también por email?
├─ ✅ Sí
│  ├─ Asunto: [Tu asunto aquí]
│  └─ Preheader: [Preview en inbox]
│
└─ ❌ No
```

### 📊 Resultado Final

```
✅ DIFUSIÓN ENVIADA

Resumen:
├─ Tipo: Todos los usuarios
├─ Enviados: 5,234
├─ Fallidos: 12
├─ Tasa éxito: 99.8%
├─ Duración: 2 min 34 seg
└─ Timestamp: 12/02/2026 - 14:32
```

### 📦 Gestionar Cola de Difusiones

**Acceso**: `/admin` → **"📦 Cola"**

```
Estado actual:
├─ En progreso: 1
├─ Pendientes: 3
├─ Completadas hoy: 8
└─ Fallidas: 0

Acciones:
├─ ⏸️ Pausar procesamiento
├─ ▶️ Reanudar
├─ 🔄 Reintentar fallidas (Solo Super Admin)
└─ 🗑️ Limpiar historial
```

---

## ESTADÍSTICAS Y REPORTES

### 📊 Quick Stats

**Comando**: `/stats`

Se muestra resumen en tiempo real:

```
📊 ESTADÍSTICAS RÁPIDAS
═══════════════════════════════════════

👥 USUARIOS
├─ Total: 5,234
├─ Premium: 823 (15.7%)
└─ Free: 4,411 (84.3%)

💰 INGRESOS
├─ Hoy: $2,340.50
├─ Este mes: $68,234.12
└─ Últimos 30 días: $72,890.45

📈 CONVERSIÓN
├─ Hoy: 2.3%
├─ Este mes: 1.8%
└─ Promedio: 1.5%

💳 PAGOS POR PROVEEDOR
├─ ePayco: $45,230
├─ Daimo Pay: $27,660
└─ Otros: $820
```

### 💳 Webhooks de Pago

**Acceso**: `/admin` → **"💳 Webhooks Pago"**

```
EVENTOS RECIENTES
═══════════════════════════════════════

✅ Pago exitoso (12/02/2026 - 14:23)
├─ Proveedor: ePayco
├─ Usuario: @juan
├─ Monto: $29.99
├─ Plan: 30-Day Pass
└─ Firma: ✓ Válida

⚠️ Pago fallido (12/02/2026 - 13:45)
├─ Proveedor: Daimo Pay
├─ Usuario: @maria
├─ Monto: $9.99
├─ Plan: 7-Day Pass
└─ Razón: Fondos insuficientes

❌ Webhook inválido (12/02/2026 - 12:30)
├─ Proveedor: ePayco
├─ Firma: ✗ Inválida (POSIBLE ATAQUE)
└─ Acción: Rechazado
```

### 🔒 Reporte de Seguridad

**Acceso**: `/admin` → **"🔒 Security Report"**

```
🔐 EVENTOS DE SEGURIDAD
═══════════════════════════════════════

⚠️ Intentos de reenvío (Webhook Replay)
├─ Detectados: 2
├─ Bloqueados: 2
└─ Intentos bloqueados: $89.98

🚨 Webhooks inválidos
├─ Recibidos: 5
├─ Bloqueados: 5
└─ Razón: Firma SHA256 inválida

📍 Patrones anómalos
├─ Múltiples pagos de mismo usuario
├─ Rápido (< 1 min entre pagos): 3
└─ Investigar: Posible prueba de cards
```

### 👁️ Vista Previa

**Acceso**: `/admin` → **"👁️ Vista Previa"**

Ver el bot como si fueras un usuario diferente:

```
¿Qué tipo de usuario eres?
├─ 🆓 FREE (Usuario sin pagar)
├─ 💎 PRIME (Usuario con suscripción)
└─ 🚫 BANNED (Usuario baneado)

Resultado:
├─ Ves los menús que vería ese usuario
├─ Pruebas sin afectar tu cuenta
└─ Útil para debugging/testing
```

---

## MODERACIÓN

### 🧹 Limpiar Comunidad

**Acceso**: `/admin` → **"🧹 Limpiar Comunidad"** o `/cleanupcommunity`

```
Elimina automáticamente de GROUP_ID:
├─ Mensajes en idiomas no permitidos
├─ Mensajes con exceso de URLs
├─ Comandos no autorizados
├─ Mensajes en MAYÚSCULAS puro
└─ Criterio: Edad > 12 horas
```

**Resultado**:
```
✅ Limpieza completada
├─ Mensajes eliminados: 12
├─ Usuarios alertados: 3
└─ Contenido Wall of Fame: Intacto
```

### 📍 Aprobar Nearby Places

**Acceso**: `/admin` → **"📍 Nearby Places"**

```
Sugerencias pendientes:
├─ 1. "Café Central" - Lat: 5.52, Long: -73.27
├─ 2. "Bar Neon" - Lat: 5.53, Long: -73.28
└─ 3. "Club Privado" - Lat: 5.54, Long: -73.26

Acciones:
├─ ✅ Aprobar
├─ ❌ Rechazar
└─ 🚫 Banear usuario (si abusa)
```

### 👥 Banear Usuario

**Opción 1**: Desde gestión de usuarios (ver arriba)

**Opción 2**: Comando directo
```
/ban @usuario_id [razón]
```

---

## GESTIÓN DE COMUNIDAD

### 🧠 Cristina Asistente Admin

**Acceso**: `/admin` → **"🧠 Cristina Asistente Admin"**

**Función**: Alimentar a Cristina (chatbot IA) con información actualizada

```
¿Qué quieres actualizar?
├─ 💰 Precios de planes
├─ 📊 Estado del bot
├─ 📝 Información general
└─ 🎯 Modo Lex (asesor personal)
```

**Ejemplo**:

```
Actualizar precio de 30-Day Pass:
Nuevo precio: $29.99 (era $24.99)
   ↓
Cristina ahora responderá correctamente cuando
alguien pregunte: "¿Cuánto cuesta el 30-Day Pass?"
   ↓
Respuesta: "El 30-Day Pass cuesta $29.99"
```

### 🐦 Publicar en X (Twitter)

**Acceso**: `/admin` → **"🐦 Publicar en X"**

```
1. Escribe tu tweet
2. Elige cuenta X (si tienes múltiples)
3. Generar con IA (opcional)
4. Vista previa
5. Programar o publicar ahora
```

**Gestionar Cuentas X**:

```
⚙️ X Cuentas → Configurar cuentas de Twitter
├─ Conectar nueva cuenta X
├─ Ver cuentas conectadas
├─ Desconectar cuenta
└─ Prueba de conexión
```

---

## TAREAS ESPECIALIZADAS

### 📧 Enviar Enlaces PRIME

**Comando**: `/send_prime_links [cantidad]`

```
Genera enlaces de invitación one-time
para el canal PRIME

Resultado:
✅ 10 enlaces generados
├─ Válidos por: 24 horas
├─ Un uso por enlace
└─ Expiran después
```

### 🎁 Activar Código Promocional

**Como Admin**:

```
/activate_code @usuario_id CODIGO123

Resultado:
✅ Código activado para @usuario_id
├─ Beneficio: 7 días gratis
├─ Suscripción actualizada
└─ Email de confirmación enviado
```

### 📊 Estadísticas de Usuario Específico

**Comando**: `/user_stats [user_id]`

```
Información detallada de un usuario:
├─ Nombre: Juan Pérez
├─ Email: juan@example.com
├─ Suscripción: Premium (Activa)
├─ Fecha de activación: 01/12/2025
├─ Fecha de expiración: 01/01/2026
├─ Pagos totales: $59.98
├─ Compras últimos 30 días: 2
└─ Última actividad: Hace 2 horas
```

### 🔐 Verificación de Edad Forzada

```
/forceverifyage [user_id]

El usuario debe reverificar su edad
antes de acceder a contenido restringido
```

---

## TROUBLESHOOTING

### ⚠️ Problema: No veo el panel admin

**Soluciones**:
1. Verifica que tu ID esté en `ADMIN_ID` o `ADMIN_USER_IDS`
2. Reinicia Telegram
3. Intenta de nuevo: `/admin`

---

### ⚠️ Problema: Las difusiones no se envían

**Verificar**:
```
1. ¿Está activo el bot?
   /health → Debe responder ✅

2. ¿Hay usuarios para enviar?
   /stats → Verificar cantidad

3. ¿El ratelimit de Telegram?
   Esperar y reintentar

4. Revisar logs:
   Ver archivo: /var/log/bot.log
```

---

### ⚠️ Problema: Webhooks de pago inválidos

**Verificar**:
```
1. ¿Firmas correctas en env?
   EPAYCO_PRIVATE_KEY=xxxxx
   DAIMO_SECRET=xxxxx

2. ¿URL de webhook configurada?
   En ePayco Dashboard:
   → Configuración → Webhooks
   → https://pnptv.app/api/webhooks/epayco

3. Ver reporte de seguridad:
   /admin → Security Report
```

---

### ⚠️ Problema: Usuario dice que no recibió email

**Verificar**:
1. ¿Email configurado?
   `SENDGRID_API_KEY` o `SMTP_*`

2. ¿Email válido?
   Revisar: /admin → Usuarios → [Buscar]

3. Enviar manualmente:
   Verificar tabla `emails_sent` en BD

---

### ⚠️ Problema: Botones de rol no aparecen

**Verificar**:
1. ¿Eres Super Admin o Admin?
2. Otros admins no pueden ver gestión de roles si eres Moderator
3. Intenta de nuevo después de reiniciar bot

---

## 📞 SOPORTE TÉCNICO

Si algo no funciona:

1. **Logs del Bot**:
   ```bash
   tail -f /app/logs/bot.log
   ```

2. **Verificar Servicios**:
   ```bash
   /health  # Estado del bot
   docker ps  # Contenedores activos
   ```

3. **Base de Datos**:
   ```sql
   SELECT * FROM users WHERE id = [user_id];
   SELECT * FROM broadcasts ORDER BY created_at DESC LIMIT 10;
   ```

4. **Contactar Dev**:
   - Incluir: error específico + timestamp + user_id
   - Adjuntar: logs relevantes

---

## ✅ CHECKLIST DIARIO DE ADMIN

```
[ ] Revisar /stats - Verificar métricas
[ ] Revisar webhooks de pago - ¿Transacciones OK?
[ ] Revisar seguridad - ¿Ataques?
[ ] Limpiar comunidad - /cleanupcommunity
[ ] Revisar soporte - ¿Tickets pendientes?
[ ] Enviar difusión si aplica - Comunicaciones
[ ] Verificar usuarios baneados - ¿Necesitan revisión?
```

---

**¿Dudas?** Revisa el [MANUAL_COMPLETO_PNPTV_BOT.md](/root/MANUAL_COMPLETO_PNPTV_BOT.md) para detalles técnicos.

**¡Gracias por administrar PNP TV! 👑**
