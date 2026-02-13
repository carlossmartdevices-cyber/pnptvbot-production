# Manual del Bot - Gestión de Grupos y Canales

Este documento describe cómo el sistema gestiona sus entidades principales en Telegram: el Grupo Comunitario, el Canal PRIME y el Grupo de Soporte.

Cada entidad tiene un propósito específico y es gestionada mediante una combinación de procesos automatizados y herramientas administrativas.

## 1. El Grupo Comunitario (Público)

Este es el principal punto de encuentro para todos los usuarios del bot, tanto gratuitos como premium.

- **ID de Entorno**: `GROUP_ID`
- **Gestión de Contenido**:
    - **Contenido de Usuario**: Los usuarios publican su propio contenido (fotos, videos) directamente en el grupo. No hay un proceso de aprobación previo, pero el contenido es moderado.
    - **Contenido de Admin**: Los administradores utilizan un asistente (`/broadcast` o similar) para crear y programar publicaciones oficiales y anuncios en el grupo.
- **Moderación Automatizada**:
    - **Servicio**: `groupCleanupService.js`.
    - **Función**: Un trabajo programado (cron) se ejecuta dos veces al día para limpiar el chat.
    - **Acción**: Elimina automáticamente los mensajes que son marcados como spam (mensajes en idiomas no permitidos, exceso de URLs, comandos no autorizados, etc.) y que tienen más de 12 horas de antigüedad.
- **Moderación Manual**:
    - Los administradores disponen de comandos para banear usuarios a nivel de aplicación (restringiendo su uso del bot), aunque la expulsión directa del grupo parece ser una acción manual realizada en Telegram.

## 2. El Canal PRIME (Exclusivo para Miembros)

Este es un canal privado que contiene contenido exclusivo accesible únicamente para miembros con una suscripción activa ("Prime").

- **ID de Entorno**: `PRIME_CHANNEL_ID`
- **Gestión de Acceso (Entrada)**:
    - **Mecanismo**: Enlaces de invitación seguros.
    - **Flujo**: Cuando un usuario activa una membresía (ya sea por pago o activación de código), el `activation.js` o `paymentService.js` llama a la función `createChatInviteLink` de la API de Telegram.
    - **Seguridad**: Se genera un **enlace de invitación de un solo uso** que expira después de un corto periodo de tiempo. Este enlace se envía al usuario por mensaje directo. Esto previene que los enlaces sean compartidos.
- **Gestión de Acceso (Salida)**:
    - **Mecanismo**: Expulsión automática por expiración de membresía.
    - **Servicio**: `membershipCleanupService.js`.
    - **Flujo**:
        1. Un trabajo programado (cron) se ejecuta diariamente.
        2. El servicio busca en la base de datos a todos los usuarios cuya suscripción ha expirado.
        3. Para cada usuario expirado, el bot ejecuta dos acciones en el Canal PRIME:
           a. `banChatMember(channelId, userId)`: Esta acción **expulsa** al usuario del canal.
           b. `unbanChatMember(channelId, userId)`: Inmediatamente después, esta acción le **quita el baneo**. El usuario no vuelve a ser añadido al canal, pero si en el futuro vuelve a suscribirse, podrá unirse con un nuevo enlace de invitación sin problemas.
        4. Finalmente, se envía un mensaje directo al usuario notificándole que su acceso ha sido revocado.

## 3. El Grupo de Soporte (Interno para Admins)

Este es un grupo privado, con la función de "Temas" habilitada, que funciona como un sistema de helpdesk para el equipo de administración.

- **ID de Entorno**: `SUPPORT_GROUP_ID`
- **Gestión**:
    - **Creación de Tickets**: La gestión de este grupo es casi completamente automática. Cuando un usuario necesita ayuda, el `supportRoutingService.js` crea un nuevo tema (ticket) para ese usuario.
    - **Acceso de Agentes**: El acceso a este grupo no es automatizado. Los administradores y moderadores deben ser añadidos manualmente al grupo de Telegram para poder ver y responder a los tickets.
    - **Cierre de Tickets**: Los temas se cierran (y archivan) automáticamente cuando un agente marca el ticket como resuelto.
