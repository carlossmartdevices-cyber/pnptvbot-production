# Manual del Bot - Sistema de Soporte al Cliente

Este documento describe el funcionamiento del sistema de soporte al cliente, que convierte un grupo de Telegram en un sistema de tickets (helpdesk) completamente funcional.

El sistema permite a los administradores y agentes de soporte gestionar todas las conversaciones con los usuarios desde un único grupo de Telegram, mientras que los usuarios interactúan de forma natural con el bot en un chat privado.

## 1. Componentes Clave

- **Servicio Principal**: `src/bot/services/supportRoutingService.js` es el cerebro que enruta los mensajes.
- **Modelo de Datos**: `src/models/supportTopicModel.js` gestiona la tabla `support_topics` en la base de datos, que rastrea cada conversación de soporte.
- **Grupo de Soporte**: Un grupo privado de Telegram con la función de "Temas" (Topics) activada. Su ID se configura en la variable de entorno `SUPPORT_GROUP_ID`.
- **Punto de Entrada del Usuario**: Los usuarios inician el contacto a través del comando `/support` o un botón de "Ayuda" en el menú del bot.

## 2. Flujo de una Conversación de Soporte

El sistema funciona como un puente de dos vías entre el chat privado del usuario y un tema (hilo) dedicado dentro del grupo de soporte.

### PASO 1️⃣: El Usuario Inicia el Contacto

1.  El usuario envía un mensaje al bot (por ejemplo, a través del comando `/support`).
2.  El bot identifica que es una solicitud de soporte.
3.  Se invoca la función `supportRoutingService.getOrCreateUserTopic()`.

### PASO 2️⃣: Creación del "Ticket" en el Grupo de Soporte

1.  El `supportRoutingService` comprueba si ya existe un tema en la base de datos (`support_topics`) para ese usuario.
2.  **Si no existe un tema**:
    - Se utiliza la API de Telegram para crear un **nuevo tema** en el grupo de soporte.
    - El tema se nombra con la información del usuario para una fácil identificación (ej: "📬 @nombredeusuario (12345678)").
    - Se guarda la relación `user_id` -> `thread_id` en la base de datos.
    - Se publica un **mensaje inicial** en el tema recién creado con un resumen del usuario, la prioridad y categoría del ticket (detectadas automáticamente por palabras clave en el mensaje), y **botones de acción rápida** para los agentes (ej: "Activar 30 días", "Marcar como resuelto").
3.  **Si ya existe un tema**:
    - Simplemente se reutiliza el `thread_id` existente. Si el tema estaba cerrado, se reabre automáticamente.

### PASO 3️⃣: Enrutamiento de Mensajes

1.  **Del Usuario al Grupo de Soporte**:
    - El `supportRoutingService.forwardUserMessage()` toma el mensaje del usuario (texto, imagen, documento, etc.).
    - Lo reenvía al tema correspondiente dentro del grupo de soporte, añadiendo un encabezado que identifica claramente al usuario.
2.  **Del Grupo de Soporte al Usuario**:
    - Un agente de soporte simplemente necesita **responder** a cualquier mensaje dentro del tema del usuario en el grupo de Telegram.
    - El bot detecta esta respuesta. Se activa la función `supportRoutingService.sendReplyToUser()`.
    - Esta función busca a qué `user_id` pertenece ese `thread_id`.
    - Envía el mensaje del agente como un mensaje directo al chat privado del usuario, añadiendo un prefijo para identificarlo como una respuesta del equipo de soporte (ej: "💬 *Admin (Soporte):*").
    - Para confirmar la entrega, el bot **añade una reacción** (ej: 👍) al mensaje del agente en el grupo, indicando visualmente que el mensaje ha sido enviado al usuario.

## 3. Gestión del Ciclo de Vida del Ticket

El sistema incorpora funcionalidades de un helpdesk tradicional:

- **Asignación de Tickets**: Los nuevos tickets pueden ser asignados automáticamente a un agente disponible (si está configurado).
- **Cierre de Tickets**: Los agentes pueden usar comandos o botones para marcar un ticket como "resuelto", lo que cierra el tema en el grupo y actualiza su estado en la base de datos.
- **Encuestas de Satisfacción**: Una vez que un ticket se cierra, el sistema puede enviar automáticamente una encuesta de satisfacción al usuario para que califique la atención recibida.
- **Monitorización de SLA (Service Level Agreement)**: El sistema puede monitorizar el tiempo de respuesta de los tickets y enviar alertas al grupo si un ticket no ha sido atendido en el tiempo estipulado según su prioridad.

En resumen, el `supportRoutingService` actúa como un intermediario inteligente que mantiene las conversaciones organizadas y eficientes, permitiendo una experiencia de soporte fluida tanto para los usuarios como para el equipo de administración.
