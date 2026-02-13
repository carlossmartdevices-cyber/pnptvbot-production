# Manual del Bot - Sistema de Difusión (Broadcasts)

Este documento explica cómo funciona el sistema de difusión de mensajes, que permite a los administradores enviar comunicaciones masivas a los usuarios del bot.

El sistema es robusto, soportando envíos inmediatos y programados, y utilizando múltiples canales de comunicación.

## 1. Componentes Clave

- **Asistente de Creación**: `src/bot/handlers/admin/broadcast.js` maneja la interfaz de creación de difusiones para los administradores.
- **Servicio de Envío Inmediato**: `src/bot/services/adminService.js` contiene la lógica para enviar una difusión al instante.
- **Servicio de Programación**: `src/services/broadcastScheduler.js` gestiona la ejecución de las difusiones programadas.
- **Servicio de Envío por Email**: `src/services/emailService.js` se encarga de las difusiones por correo electrónico.
- **Base de Datos**: Se utiliza una tabla `broadcasts` en PostgreSQL para registrar todas las difusiones, ya sean enviadas o programadas.

## 2. Creación de una Difusión

El proceso es iniciado por un administrador a través de un comando (probablemente `/broadcast`) que activa un asistente conversacional.

1.  **Inicio**: El administrador accede al menú de difusión.
2.  **Selección de Tipo**: Se presenta un menú para elegir el tipo de contenido (ej: solo texto, texto con imagen, etc.).
3.  **Entrega del Contenido**: El bot solicita al administrador que envíe el mensaje, la imagen o el video que desea difundir.
4.  **Vista Previa y Confirmación**: El bot muestra una vista previa de cómo se verá el mensaje final y presenta tres opciones:
    - **Enviar Ahora**: Para una difusión inmediata.
    - **Programar**: Para elegir una fecha y hora futuras.
    - **Cancelar**: Para abortar el proceso.

## 3. Flujo 1: Difusión Inmediata

Si el administrador elige "Enviar Ahora":

1.  **Llamada al Servicio**: Se invoca la función `adminService.sendBroadcast()`.
2.  **Registro en BD**: La función primero crea un nuevo registro en la tabla `broadcasts` para llevar un control del evento, marcándolo con el estado `'sending'`.
3.  **Obtención de Usuarios**: Se obtiene la lista completa de usuarios del `userService`. Se aplican filtros para excluir a otros bots.
4.  **Bucle de Envío**: El servicio itera sobre la lista de usuarios y envía el mensaje a cada uno de forma individual a través de un **Mensaje Directo (DM) de Telegram**.
5.  **Control de Rate-Limit**: Para evitar ser bloqueado por Telegram por enviar demasiados mensajes a la vez, se introduce una pequeña pausa (ej: 50 milisegundos) entre cada envío.
6.  **Actualización Final**: Una vez que el bucle termina, el registro de la difusión en la base de datos se actualiza a `'completed'` o `'completed_with_errors'`, junto con estadísticas de cuántos mensajes se enviaron con éxito y cuántos fallaron.

## 4. Flujo 2: Difusión Programada

Si el administrador elige "Programar":

1.  **Selección de Fecha y Hora**: Se presenta una interfaz para que el administrador elija la fecha y hora exactas para el envío.
2.  **Guardado en BD**: La difusión no se envía de inmediato. En su lugar, se guarda en la tabla `broadcasts` con un estado `'pending'` y se rellena el campo `scheduled_at` con la fecha y hora seleccionadas.
3.  **Ejecución por Cron Job**:
    - El `broadcastScheduler.js` tiene un trabajo programado (cron job) que se ejecuta cada minuto.
    - En cada ejecución, consulta la tabla `broadcasts` buscando difusiones pendientes (`status = 'pending'`) cuya `scheduled_at` sea en el pasado.
    - **Bloqueo con Redis**: Para evitar que la misma difusión sea enviada múltiples veces (en caso de que haya varias instancias del bot corriendo), el scheduler utiliza un bloqueo de Redis (`cache.acquireLock`). Solo la instancia que adquiera el bloqueo podrá procesar la difusión.
    - **Envío**: La instancia que tiene el bloqueo procede a enviar la difusión, siguiendo un bucle de envío similar al de las difusiones inmediatas.
    - **Actualización de Estado**: Al finalizar, actualiza el estado de la difusión en la base de datos a `'completed'`.

## 5. Difusión por Email

El asistente de creación de difusiones probablemente ofrece la opción de elegir el canal de entrega. Si se elige "Email":

- El proceso llama a la función `emailService.sendBroadcastEmails()`.
- Esta función recibe una lista de usuarios y el contenido del mensaje.
- Itera sobre los usuarios y envía un email personalizado a cada uno, utilizando las plantillas HTML definidas en el servicio.
