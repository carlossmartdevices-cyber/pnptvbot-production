# Sistema de Soporte Técnico con Topics

## 🌟 Descripción General

El sistema de soporte técnico utiliza **Telegram Forum Topics** (Temas de Foro) para organizar las conversaciones de soporte. Cada usuario obtiene su propio topic dedicado en un grupo de soporte donde cualquier miembro del equipo puede responder.

### Características Principales

- ✅ **Topic único por usuario**: Cada usuario tiene un hilo de conversación dedicado
- ✅ **Respuesta desde el grupo**: Cualquier admin puede responder desde el topic
- ✅ **Historial completo**: Todo el historial de conversación en un solo lugar
- ✅ **Gestión de tickets**: Cerrar/reabrir tickets según sea necesario
- ✅ **Estadísticas**: Seguimiento de tickets, mensajes y rendimiento
- ✅ **Bilingüe**: Soporte en español e inglés

## 🛠️ Configuración Inicial

### Paso 1: Crear el Grupo de Soporte

1. **Crear un Supergroup en Telegram**:
   - Abre Telegram y crea un nuevo grupo
   - Nómbralo "Soporte al Cliente" (o el nombre que prefieras)
   - Convierte el grupo en Supergroup (Configuración → Tipo de Grupo → Público)

2. **Habilitar Topics (Temas)**:
   - Ve a Configuración del Grupo
   - Activa "Topics" (Temas)
   - Esto convertirá el grupo en un Forum

3. **Agregar el Bot como Administrador**:
   - Agrega tu bot al grupo
   - Hazlo administrador con los siguientes permisos:
     - ✅ Gestionar topics/temas
     - ✅ Enviar mensajes
     - ✅ Eliminar mensajes
     - ✅ Fijar mensajes (opcional)

4. **Obtener el ID del Grupo**:
   - Agrega el bot @userinfobot al grupo
   - Copia el ID del grupo (será negativo, ej: -1001234567890)
   - Elimina @userinfobot del grupo

### Paso 2: Configurar Variables de Entorno

Agrega estas variables a tu archivo `.env`:

```bash
# Support System - Customer Support Group with Topics
SUPPORT_GROUP_ID=-1001234567890
SUPPORT_GROUP_NAME=Soporte al Cliente

# Enhanced Support Features (Optional)
AUTO_ASSIGN_TICKETS=true
SEND_SATISFACTION_SURVEY=true
SLA_CHECK_INTERVAL=3600000
SLA_MONITOR_ENABLED=true
```

**Variables:**
- `SUPPORT_GROUP_ID`: ID del grupo de soporte (debe ser negativo)
- `SUPPORT_GROUP_NAME`: Nombre del grupo (informativo)
- `AUTO_ASSIGN_TICKETS`: Habilitar asignación automática de tickets (true/false)
- `SEND_SATISFACTION_SURVEY`: Enviar encuestas de satisfacción al cerrar tickets (true/false)
- `SLA_CHECK_INTERVAL`: Intervalo en milisegundos para verificar incumplimientos de SLA (default: 1 hora)
- `SLA_MONITOR_ENABLED`: Habilitar monitor de SLA (true/false, default: true)

### Paso 3: Inicializar la Base de Datos

La tabla `support_topics` se creará automáticamente, pero puedes inicializarla manualmente:

```javascript
const SupportTopicModel = require('./src/models/supportTopicModel');

// En tu script de inicialización o migración
await SupportTopicModel.initTable();
```

O ejecutar SQL directamente:

```sql
CREATE TABLE IF NOT EXISTS support_topics (
  user_id VARCHAR(255) PRIMARY KEY,
  thread_id INTEGER NOT NULL,
  thread_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  message_count INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'open',
  assigned_to VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_support_topics_thread_id ON support_topics(thread_id);
CREATE INDEX IF NOT EXISTS idx_support_topics_status ON support_topics(status);
```

### Paso 4: Reiniciar el Bot

Reinicia tu bot para que cargue la nueva configuración:

```bash
npm start
# o
pm2 restart pnptv-bot
```

## 📱 Flujo de Usuario

### 1. Usuario Contacta a Soporte

1. Usuario ejecuta `/support` o accede al menú de soporte
2. Hace clic en "👨‍💼 Contactar Admin"
3. Escribe su mensaje de soporte

### 2. Creación de Topic (Primera Vez)

Cuando un usuario contacta por primera vez:

```
🆕 Nuevo ticket de soporte

👤 Usuario: John Doe
📧 Username: @johndoe
🆔 Telegram ID: 123456789
🌍 Idioma: Español
⏰ Fecha: 19/01/2025, 14:30:25

━━━━━━━━━━━━━━━━━━━━

📝 Primer mensaje:
Hola, tengo un problema con mi suscripción

━━━━━━━━━━━━━━━━━━━━

💡 Responde en este topic para comunicarte con el usuario.
```

El topic se nombra automáticamente:
```
👤 John Doe (@johndoe) - ID: 123456789
```

### 3. Mensajes Subsiguientes

Los siguientes mensajes del usuario se envían al mismo topic:

```
👤 John Doe (@johndoe):

¿Cuándo se activará mi suscripción?
```

### 4. Usuario Recibe Confirmación

El usuario recibe:

```
✅ Tu mensaje ha sido enviado al equipo de soporte.
Te responderemos pronto por este chat.
```

## 👨‍💼 Flujo del Equipo de Soporte

### 1. Ver Tickets Nuevos

Los admins verán nuevos topics aparecer en el grupo de soporte:

```
📁 Soporte al Cliente
├── 👤 John Doe (@johndoe) - ID: 123456789 [NUEVO]
├── 👤 Jane Smith (@janesmith) - ID: 987654321
└── 👤 Bob Wilson (@bobwilson) - ID: 456789123
```

### 2. Responder al Usuario

Simplemente responde en el topic:

```
Hola John, veo que tu pago fue procesado correctamente.
Tu suscripción se activará en los próximos 5 minutos.
```

El usuario recibirá:

```
💬 Soporte Técnico (Carlos):

Hola John, veo que tu pago fue procesado correctamente.
Tu suscripción se activará en los próximos 5 minutos.
```

### 3. Cerrar Ticket

Cuando el problema esté resuelto, cierra el ticket:

```
/cerrar
```

El bot responde:

```
✅ Ticket cerrado.

Usuario: 👤 John Doe (@johndoe) - ID: 123456789
Total de mensajes: 5
```

El topic se cierra automáticamente y el usuario recibe:

```
✅ Tu ticket de soporte ha sido cerrado.
Si necesitas ayuda adicional, puedes contactar a soporte nuevamente.
```

### 4. Reabrir Ticket

Si necesitas reabrir un ticket:

```
/reabrir
```

El bot responde:

```
✅ Ticket reabierto.

Usuario: 👤 John Doe (@johndoe) - ID: 123456789
```

## 🔧 Comandos del Sistema

### Para Usuarios

| Comando | Descripción |
|---------|-------------|
| `/support` | Abrir menú de soporte |
| Cualquier mensaje cuando `contactingAdmin` está activo | Envía mensaje al topic |

### Para Admins (en el Grupo de Soporte)

| Comando | Descripción |
|---------|-------------|
| `/cerrar` | Cierra el ticket actual (debe usarse dentro de un topic) |
| `/reabrir` | Reabre un ticket cerrado (debe usarse dentro de un topic) |
| `/prioridad [alta|media|baja|crítica]` | Cambia la prioridad del ticket actual |
| `/categoria [facturación|técnico|suscripción|cuenta]` | Cambia la categoría del ticket actual |
| `/asignar AGENT_ID` | Asigna el ticket a un agente específico |
| `/escalar NIVEL` | Escalar ticket (1-3) |
| `/stats` | Muestra estadísticas detalladas de soporte |
| `/buscar TERMINO` | Busca tickets por usuario o término |
| `/sla` | Muestra tickets con incumplimiento de SLA |
| `/sinrespuesta` | Muestra tickets sin primera respuesta |
| Cualquier mensaje en un topic | Se envía automáticamente al usuario |

## 📊 Modelo de Base de Datos

### Tabla: `support_topics`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `user_id` | VARCHAR(255) | ID de Telegram del usuario (PK) |
| `thread_id` | INTEGER | ID del topic en el grupo |
| `thread_name` | VARCHAR(255) | Nombre del topic |
| `created_at` | TIMESTAMP | Fecha de creación |
| `last_message_at` | TIMESTAMP | Última actividad |
| `message_count` | INTEGER | Número total de mensajes |
| `status` | VARCHAR(50) | Estado: open, resolved, closed |
| `assigned_to` | VARCHAR(255) | ID del agente asignado (opcional) |
| `priority` | VARCHAR(20) | Prioridad: low, medium, high, critical |
| `category` | VARCHAR(50) | Categoría: billing, technical, subscription, etc. |
| `language` | VARCHAR(10) | Código de idioma (es, en, etc.) |
| `first_response_at` | TIMESTAMP | Fecha de primera respuesta |
| `resolution_time` | TIMESTAMP | Fecha de resolución |
| `sla_breached` | BOOLEAN | Indicador de incumplimiento de SLA |
| `escalation_level` | INTEGER | Nivel de escalación (0-3) |
| `last_agent_message_at` | TIMESTAMP | Último mensaje del agente |
| `user_satisfaction` | INTEGER | Calificación de satisfacción (1-5) |
| `feedback` | TEXT | Comentarios del usuario |
| `updated_at` | TIMESTAMP | Última actualización |

### Métodos del Modelo

```javascript
// Obtener topic por user ID
const topic = await SupportTopicModel.getByUserId('123456789');

// Obtener topic por thread ID
const topic = await SupportTopicModel.getByThreadId(12345);

// Crear nuevo topic
const topic = await SupportTopicModel.create({
  userId: '123456789',
  threadId: 12345,
  threadName: '👤 John Doe (@johndoe) - ID: 123456789'
});

// Actualizar último mensaje
await SupportTopicModel.updateLastMessage('123456789');

// Cambiar estado
await SupportTopicModel.updateStatus('123456789', 'closed');

// Asignar a agente
await SupportTopicModel.assignTo('123456789', 'agent_001');

// Obtener tickets abiertos
const openTopics = await SupportTopicModel.getOpenTopics();

// Obtener estadísticas
const stats = await SupportTopicModel.getStatistics();
```

## 📈 Estadísticas y Métricas

### Obtener Estadísticas

```javascript
const stats = await SupportTopicModel.getStatistics();

console.log(stats);
// {
//   total_topics: 156,
//   open_topics: 12,
//   resolved_topics: 98,
//   closed_topics: 46,
//   total_messages: 1247,
//   avg_messages_per_topic: 7.99
// }
```

### Tickets Asignados

```javascript
const assignedTopics = await SupportTopicModel.getAssignedTopics('agent_001');
// Retorna array de tickets asignados a este agente
```

## 🎨 Personalización

### Cambiar Formato de Mensaje

En `src/bot/handlers/media/support.js`, busca:

```javascript
const formattedMessage = `💬 **Soporte Técnico** (${supporterName}):\n\n${messageText}`;
```

Personaliza el formato como desees:

```javascript
const formattedMessage = `🔔 **${supporterName}** del equipo de soporte:\n\n${messageText}`;
```

### Cambiar Nombre del Topic

Busca esta línea:

```javascript
const topicName = `👤 ${firstName} (@${username}) - ID: ${userId}`;
```

Personaliza el formato:

```javascript
const topicName = `🎫 Ticket #${userId} - ${firstName}`;
```

### Agregar Emoji Personalizado al Topic

En `createForumTopic`, cambia el emoji:

```javascript
const forumTopic = await ctx.telegram.createForumTopic(
  supportGroupId,
  topicName,
  {
    icon_custom_emoji_id: '5312536423851630001', // Cambia este ID
  },
);
```

**IDs de emojis comunes:**
- 💬 (chat): `5312536423851630001`
- 🎫 (ticket): `5314250708659464286`
- 🆘 (SOS): `5312383847878774753`
- ⚠️ (warning): `5314306673124603432`

## 🐛 Troubleshooting

### El bot no crea topics

**Problema**: Error al crear forum topic

**Solución**:
1. Verifica que el grupo tiene topics habilitados
2. Confirma que el bot es admin con permisos de "Manage Topics"
3. Revisa los logs para ver el error específico

```bash
# Ver logs
pm2 logs pnptv-bot --lines 100
```

### Los mensajes no se reenvían

**Problema**: Mensajes del grupo no llegan al usuario

**Solución**:
1. Verifica que `SUPPORT_GROUP_ID` es correcto (debe ser negativo)
2. Confirma que el mensaje está en un topic (no en General)
3. Verifica que el topic existe en la base de datos

```sql
-- Ver todos los topics
SELECT * FROM support_topics;
```

### El usuario no puede enviar mensajes

**Problema**: Usuario intenta contactar soporte pero no funciona

**Solución**:
1. Verifica que `contactingAdmin` está en true en la sesión
2. Confirma que el bot puede enviar mensajes al grupo
3. Revisa que el grupo ID es correcto

### Topics duplicados

**Problema**: Se crean múltiples topics para el mismo usuario

**Solución**:
La base de datos usa `user_id` como PRIMARY KEY, previniendo duplicados. Si ocurre:

```sql
-- Limpiar topics duplicados (mantiene el más reciente)
DELETE FROM support_topics
WHERE user_id IN (
  SELECT user_id FROM (
    SELECT user_id, MAX(created_at) as max_date
    FROM support_topics
    GROUP BY user_id
    HAVING COUNT(*) > 1
  ) AS duplicates
)
AND created_at NOT IN (
  SELECT MAX(created_at)
  FROM support_topics
  GROUP BY user_id
);
```

## 🔐 Seguridad

### Permisos del Bot

El bot **DEBE** tener estos permisos en el grupo:
- ✅ Manage topics
- ✅ Send messages
- ✅ Delete messages (opcional)

El bot **NO NECESITA**:
- ❌ Add members
- ❌ Pin messages (opcional)
- ❌ Change group info

### Privacidad del Usuario

- Los IDs de Telegram son visibles para el equipo de soporte
- Los usernames son visibles en los topics
- Los mensajes se almacenan en la conversación del topic

**Recomendación**: Informa a los usuarios en tus términos de servicio que las conversaciones de soporte pueden ser vistas por múltiples miembros del equipo.

## 📝 Mejores Prácticas

### Para el Equipo de Soporte

1. **Responde rápido**: Los usuarios ven mensajes en tiempo real
2. **Sé profesional**: Tu nombre aparece en cada mensaje
3. **Cierra tickets**: Mantén el grupo organizado cerrando tickets resueltos
4. **Usa el historial**: Lee todo el topic antes de responder
5. **Documenta resoluciones**: Agrega notas en el topic para referencia futura

### Para Administradores

1. **Monitorea estadísticas**: Usa `getStatistics()` regularmente
2. **Capacita al equipo**: Explica cómo usar comandos `/cerrar` y `/reabrir`
3. **Revisa tickets viejos**: Cierra tickets inactivos periódicamente
4. **Backup de datos**: Incluye `support_topics` en tus backups

### Organización del Grupo

1. **Pin importante**: Fija un mensaje con instrucciones en General
2. **Nombra el grupo claramente**: "Soporte al Cliente - PNPtv"
3. **Usa descripción**: Explica el propósito del grupo
4. **Reglas del equipo**: Establece SLAs (tiempo de respuesta esperado)

## ✨ Nuevas Funcionalidades

### 🎯 Priorización Automática

El sistema ahora detecta automáticamente la prioridad de los tickets basándose en palabras clave:

- **Crítica**: Mensajes con "urgente", "emergencia", "inmediato"
- **Alta**: Mensajes con "importante", "prioridad", "problema grave"
- **Media**: Prioridad por defecto
- **Baja**: Preguntas generales o solicitudes de información

### 🏷️ Categorización Automática

Los tickets se clasifican automáticamente en categorías:

- **Facturación**: Pagos, tarjetas, facturas
- **Suscripción**: Membresías, renovaciones, cancelaciones
- **Técnico**: Errores, bugs, problemas técnicos
- **Cuenta**: Login, contraseñas, información de usuario
- **General**: Otras consultas

### ⏱️ Seguimiento de SLA

El sistema monitorea los tiempos de respuesta según la prioridad:

- **Crítica**: 1 hora para primera respuesta
- **Alta**: 4 horas para primera respuesta
- **Media**: 8 horas para primera respuesta
- **Baja**: 24 horas para primera respuesta

Cuando se incumple un SLA, se envía una alerta automática al grupo de soporte.

### 🤖 Asignación Automática

Con `AUTO_ASSIGN_TICKETS=true`, los tickets se asignan automáticamente a los agentes disponibles usando un sistema de round-robin.

### 🌟 Encuestas de Satisfacción

Al cerrar un ticket, se envía automáticamente una encuesta de satisfacción al usuario para recopilar feedback y mejorar el servicio.

### 📊 Estadísticas Mejoradas

Las estadísticas ahora incluyen:

- Tickets por prioridad
- Tickets por categoría
- Incumplimientos de SLA
- Tiempos promedio de respuesta y resolución
- Satisfacción del cliente

## 🚀 Funciones Futuras

Posibles mejoras adicionales:

1. **Plantillas de Respuesta**: Respuestas rápidas para problemas comunes
2. **Integración con CRM**: Sincronizar con sistemas externos
3. **Analytics Dashboard**: Panel web con métricas en tiempo real
4. **Chatbot AI**: Respuestas automáticas para preguntas frecuentes
5. **Escalación Multinivel**: Flujo de trabajo de escalación más complejo
6. **Notificaciones Push**: Alertas para agentes móviles
7. **Integración con Helpdesk**: Conexión con Zendesk, Freshdesk, etc.
8. **Análisis de Sentimiento**: Detección automática de clientes insatisfechos

## 📞 Soporte

Si encuentras problemas con el sistema de soporte:

1. Revisa los logs del bot
2. Verifica la configuración en `.env`
3. Consulta esta documentación
4. Contacta al equipo de desarrollo

---

**Última actualización**: 19 de enero de 2025
**Versión**: 1.0.0
**Estado**: ✅ Producción
