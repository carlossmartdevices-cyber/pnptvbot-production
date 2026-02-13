# Manual del Bot - Sistema de Notificaciones

Este documento describe los diferentes tipos de notificaciones que el bot envía, los canales que utiliza y los eventos que las desencadenan.

El sistema de notificaciones es modular, con diferentes servicios especializados para cada tipo de comunicación.

## 1. Canales de Comunicación

El bot utiliza tres canales principales para enviar notificaciones:

1.  **Mensaje Directo (DM) de Telegram**: Es el canal principal para la comunicación contextual y directa con el usuario. Se utiliza para responder a comandos, enviar recordatorios o confirmar acciones. La mayoría de los servicios de notificación utilizan `bot.telegram.sendMessage(userId, ...)` para este fin.

2.  **Email**: Se utiliza para comunicaciones más formales, transaccionales o masivas (marketing). El `src/services/emailService.js` gestiona todos los envíos, utilizando **Nodemailer** con una configuración para SMTP genérico o SendGrid (según las variables de entorno).

3.  **Canal Interno de Telegram**: Un canal privado (`process.env.NOTIFICATION_CHANNEL_ID`) al que solo los administradores tienen acceso. Se usa para enviar alertas en tiempo real sobre eventos de negocio importantes.

## 2. Tipos de Notificaciones

Las notificaciones se pueden clasificar según su propósito y el evento que las origina.

### 2.1 Notificaciones Transaccionales (Dirigidas al Usuario)

Son una respuesta directa a una acción realizada por el usuario.

- **Propósito**: Confirmar una acción, dar la bienvenida, entregar un producto digital.
- **Desencadenante**: El usuario completa una acción específica.
- **Ejemplos**:
    - **Bienvenida al finalizar el onboarding**: Se envía un DM de Telegram y un email de bienvenida (`emailService.sendWelcomeEmail`).
    - **Confirmación de Pago**: Se notifica al usuario que su pago fue exitoso y su membresía está activa.
    - **Entrega de Grabación**: Cuando una grabación de PNP Live está lista, se envía un email al usuario (`emailService.sendRecordingReady`).
    - **Facturas por Email**: Se pueden enviar facturas detalladas a través de `emailService.sendInvoiceEmail`.

### 2.2 Notificaciones de Ciclo de Vida (Dirigidas al Usuario)

Son notificaciones automáticas basadas en el estado de la membresía del usuario, generalmente gestionadas por trabajos programados (cron jobs).

- **Propósito**: Retener al usuario, informarle sobre el estado de su cuenta y motivar la renovación.
- **Desencadenante**: Un trabajo programado (`cron.js`) que se ejecuta diariamente.
- **Servicio Principal**: `src/bot/services/subscriptionReminderService.js`.
- **Ejemplos**:
    - **Recordatorio de Expiración (3 días)**: Un DM de Telegram se envía a los usuarios cuya membresía expira en 3 días.
    - **Recordatorio de Expiración (1 día)**: Un DM más urgente se envía el día antes de la expiración.
    - **Notificación de Expiración**: Cuando la membresía finalmente expira, el usuario recibe un DM informándole que ha sido degradado al plan gratuito y se le invita a renovar.

### 2.3 Notificaciones Administrativas (Internas)

Son alertas automáticas enviadas al canal privado de Telegram para mantener informado al equipo de administración sobre la salud y actividad del negocio.

- **Propósito**: Monitorizar eventos clave en tiempo real.
- **Desencadenante**: Ocurre un evento de negocio importante.
- **Servicio Principal**: `src/bot/services/businessNotificationService.js`.
- **Ejemplos**:
    - **Nuevo Usuario**: Se envía una alerta cada vez que un nuevo usuario se registra en el bot.
    - **Pago Recibido**: Una notificación con los detalles del pago (monto, plan, proveedor) se envía por cada transacción exitosa.
    - **Código de Activación Usado**: Alerta cuando un pase vitalicio es activado manualmente con un código.
    - **Resumen de Limpieza Diaria**: Un reporte diario que resume cuántas membresías expiraron y fueron degradadas por el cron job de limpieza.

### 2.4 Notificaciones de Broadcast y Marketing

Son mensajes enviados a un gran número de usuarios a la vez, iniciados por un administrador.

- **Propósito**: Anunciar nuevas funciones, compartir noticias, promocionar ofertas o reactivar usuarios inactivos.
- **Desencadenante**: Un administrador utiliza los comandos de "broadcast" del bot.
- **Servicios Principales**: `src/services/emailService.js` y `src/services/broadcastScheduler.js`.
- **Ejemplos**:
    - **Newsletter por Email**: El `emailService.sendBroadcastEmails` puede enviar un email HTML con noticias y actualizaciones a una lista de usuarios.
    - **Anuncios por Telegram**: El `broadcastScheduler.js` permite a los administradores programar mensajes para que se envíen a todos los usuarios (o a un segmento de ellos) a través de DMs de Telegram.
    - **Campañas de Reactivación**: Se puede enviar un email específico (`emailService.sendReactivationEmail`) a usuarios cuya membresía ha expirado para incentivar su regreso.
