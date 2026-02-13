# Manual del Bot - Sistema "PNP Live"

Este documento describe el funcionamiento del sistema PNP Live, una funcionalidad integrada que permite a los usuarios reservar y pagar por shows de webcam privados con los performers (referidos como "modelos").

Es un sistema complejo y autocontenido con su propia lógica de negocio, gestión de disponibilidad, notificaciones y un trabajador en segundo plano.

## 1. Arquitectura y Componentes Clave

PNP Live se compone de múltiples servicios especializados que trabajan en conjunto:

- **Servicio Principal (`pnpLiveService.js`)**: El orquestador central. Gestiona los perfiles de los modelos, el cálculo de precios y, lo más importante, la creación y gestión de las reservas (`bookings`).
- **Servicio de Disponibilidad (`pnpLiveAvailabilityService.js`)**: Maneja el inventario de tiempo. Es responsable de "retener" un horario para un usuario mientras este paga y de liberar dichos horarios si el pago no se completa. También gestiona el estado online/offline de los modelos.
- **Servicio de Horarios (`pnpLiveTimeSlotService.js`)**: Define la lógica de los horarios de trabajo de los modelos, asegurando que solo se puedan reservar en los momentos en que están disponibles.
- **Servicio de Notificaciones (`pnpLiveNotificationService.js`)**: Envía todas las comunicaciones relacionadas con una reserva (confirmaciones, recordatorios 5 minutos antes del show, notificaciones de finalización, solicitudes de feedback, etc.).
- **Servicio de Videochat (`jaasService.js`)**: Se integra con **Jitsi-As-A-Service** para generar dinámicamente las salas de videochat y los tokens de acceso únicos tanto para el usuario como para el modelo.
- **Trabajador en Segundo Plano (`pnpLiveWorker.js`)**: Un proceso cron que realiza tareas de mantenimiento periódicas, como marcar shows como completados, liberar reservas expiradas y poner offline a modelos inactivos.
- **Manejador del Flujo (`pnpLiveHandler.js`)**: Contiene toda la lógica del asistente conversacional que guía al usuario a través del proceso de reserva.

## 2. Flujo de Reserva de un Show

El proceso de reserva es un asistente de varios pasos que se gestiona a través de la sesión del usuario (`ctx.session.pnpLive`).

### PASO 1️⃣: Descubrimiento y Selección

1.  **Inicio**: Un usuario inicia el flujo, normalmente a través de un botón en el menú principal o un enlace directo (`/start pnp_live`).
2.  **Ver Modelos**: El bot muestra una lista de los modelos disponibles, probablemente con sus fotos y valoraciones.
3.  **Seleccionar Modelo y Duración**: El usuario elige el modelo con el que desea tener el show y la duración del mismo (ej: 15, 30, 60 minutos).

### PASO 2️⃣: Elección de Horario

1.  **Seleccionar Día**: El bot presenta los días en que el modelo tiene disponibilidad.
2.  **Seleccionar Hora**: Una vez elegido el día, el bot muestra los huecos (slots) de tiempo específicos que están libres para reservar.

### PASO 3️⃣: Reserva y Pago

1.  **Retención del Horario (Hold)**: En el momento en que el usuario selecciona una hora, el `pnpLiveAvailabilityService` pone una **retención** sobre ese slot. Este horario queda bloqueado para otros usuarios durante un corto periodo de tiempo (ej: 10 minutos) para darle al usuario actual la oportunidad de pagar sin que nadie más le quite el sitio.
2.  **Confirmación Final**: El bot muestra un resumen completo de la reserva (modelo, duración, fecha, hora y precio) y pide una confirmación final.
3.  **Creación de la Reserva**: Al confirmar, el `pnpLiveService` crea un registro de `booking` en la base de datos con un estado inicial de `pending_payment`.
4.  **Inicio del Pago**: Inmediatamente después, el sistema genera un enlace de pago (ej: con ePayco) y se lo envía al usuario.

### PASO 4️⃣: Confirmación y Realización del Show

1.  **Confirmación de Pago**: El usuario realiza el pago. El sistema recibe la confirmación a través de un webhook (ver `paymentService.processPNPLiveEpaycoWebhook`). El estado de la reserva se actualiza a `confirmed`.
2.  **Generación de la Sala**: El `jaasService` genera una sala de Jitsi única para la sesión. Se crean tokens de acceso separados para el usuario y el modelo.
3.  **Notificaciones Previas**: El `pnpLiveNotificationService` envía recordatorios al usuario y al modelo poco antes de que comience el show, probablemente incluyendo los enlaces de acceso a la sala de Jitsi.
4.  **Realización del Show**: El usuario y el modelo se unen a la sala de Jitsi y realizan el show privado.

### PASO 5️⃣: Post-Show

1.  **Finalización**: El `pnpLiveWorker` detecta que la hora del show ha pasado y actualiza el estado de la reserva a `completed`.
2.  **Feedback**: El servicio de notificaciones puede enviar un mensaje al usuario pidiéndole que valore su experiencia con el modelo.
