# Manual del Bot - Panel de Administración

Este documento describe el panel de administración del bot, una interfaz basada en Telegram que permite a los usuarios con roles administrativos gestionar diversas facetas del bot, la comunidad y los usuarios.

El panel está diseñado para ser accesible y funcional directamente dentro de Telegram, eliminando la necesidad de una interfaz web separada para la mayoría de las tareas administrativas.

## 1. Acceso al Panel de Administración

-   **Comando Principal**: El panel se inicia mediante el comando `/admin` en un chat privado con el bot.
-   **Acceso Basado en Roles**: La visibilidad de las opciones y la capacidad de ejecutar acciones dentro del panel dependen del rol del administrador (Super Admin, Admin).
-   **`showAdminPanel`**: Esta es la función central (`src/bot/handlers/admin/index.js`) que renderiza el menú principal del panel de administración, adaptando los botones según los permisos del usuario.

## 2. Estructura del Panel de Administración

El panel está organizado en varias secciones, accesible a través de botones en el menú principal.

### 2.1 Gestión de Usuarios

Esta sección permite a los administradores buscar, ver y modificar la información de los usuarios.

-   **Punto de Entrada**: Botón "👥 Usuarios" (`admin_users`).
-   **Búsqueda de Usuarios**: Los administradores pueden buscar usuarios por ID, username o email.
-   **Acciones Disponibles (por usuario)**:
    -   **Editar Perfil**: Cambiar username y email del usuario.
    -   **Gestión de Membresía**:
        -   **Cambiar Tier**: Modificar el nivel de membresía (ej: `Prime` a `Free`).
        -   **Cambiar Estado de Suscripción**: Modificar el estado de la suscripción (ej: `active`, `churned`, `expired`, `free`).
        -   **Extender Suscripción**: Añadir días adicionales a la membresía de un usuario o convertirla en `Lifetime`.
        -   **Activación Manual**: Activar manualmente un plan existente o un "pase de cortesía" de N días.
    -   **Control de Acceso**:
        -   **Banear/Desbanear Usuario**: Cambiar el estado del usuario a `banned` (prohibido el uso del bot) o `active`.
        -   **Forzar Verificación de Edad**: Resetear el estado de verificación de edad de un usuario, obligándolo a verificarla de nuevo para acceder a contenido restringido.
    -   **Comunicación**: Enviar un mensaje directo a un usuario. (Estos mensajes se enrutan a través del sistema de soporte para mantener un registro).

### 2.2 Gestión de Roles

Permite a los administradores gestionar los roles de otros usuarios, respetando la jerarquía de permisos.

-   **Punto de Entrada**: Botón "👑 Roles" (`admin_roles`) (visible solo para Super Admins y Admins).
-   **Visualización**: Muestra una lista de todos los `superadmins`, `admins` y `moderators` actuales.
-   **Acciones**: Permite promover o degradar usuarios entre los roles de `admin` y `moderator`, con controles de seguridad para evitar que un rol inferior gestione uno superior.

### 2.3 Contenido y Comunicación (Difusión)

Herramientas para la creación y gestión de contenido masivo.

-   **Punto de Entrada**: Botón "📢 Difusión" (`admin_broadcast`).
-   **Asistente de Difusión**: Un asistente conversacional de múltiples pasos para crear y programar mensajes de difusión. Permite:
    -   Seleccionar la audiencia (todos, premium, free, churned, pagos incompletos).
    -   Adjuntar media (fotos, videos, documentos, audio).
    -   Escribir el mensaje (en inglés y/o español).
    -   Añadir botones interactivos.
    -   **Generación de Texto con IA**: Utiliza el servicio `Grok` para generar borradores de texto automáticamente, con una "persona" definida (`Meth Daddy`).
    -   **Programación**: Enviar la difusión de inmediato o programarla para una fecha/hora específica, incluso con opciones de recurrencia.
    -   **Envío por Email**: Posibilidad de enviar la misma difusión también por correo electrónico, con asuntos y preheaders personalizables.
-   **Gestión de Cola de Difusión**:
    -   **Punto de Entrada**: Botón "📦 Cola" (`admin_queue_status`).
    -   **Funcionalidad**: Permite ver el estado actual de la cola de broadcasts, pausar/reanudar el procesamiento y reintentar envíos fallidos (solo Super Admins).

### 2.4 Administración de Contenido Comunitario

Herramientas para gestionar el contenido y la interacción en los grupos comunitarios.

-   **Punto de Entrada**: (Implícito a través de comandos o alertas, no siempre botones directos en el panel principal).
-   **Limpieza de la Comunidad**:
    -   **Comando**: `/cleanupcommunity`.
    -   **Función**: Elimina mensajes de spam o no deseados del grupo comunitario principal, respetando el contenido del "Wall of Fame".
-   **Gestión de Lugares "Nearby"**:
    -   **Punto de Entrada**: Botón "📍 Nearby Places" (`admin_nearby_places`).
    -   **Función**: Permite a los administradores revisar y aprobar/rechazar las sugerencias de lugares ("Places") enviadas por los usuarios.
-   **Publicaciones en X (Twitter)**:
    -   **Punto de Entrada**: Botón "🐦 Publicar en X" (`xpost_menu`).
    -   **Función**: Permite crear y programar publicaciones para Twitter (X) utilizando IA.
    -   **Cuentas X**: Botón "⚙️ X Cuentas" (`admin_x_accounts_configure_x`) para gestionar las cuentas de Twitter conectadas.

### 2.5 Herramientas de Inteligencia de Negocio y Sistema

Acceso a estadísticas, reportes y configuraciones avanzadas.

-   **Estadísticas Rápidas**:
    -   **Comando**: `/stats`.
    -   **Función**: Muestra un resumen en tiempo real de usuarios (total, premium, free), tasa de conversión e ingresos por día, mes y últimos 30 días, desglosado por plan y proveedor.
-   **Estadísticas de Usuario**: Botón "👥 Usuarios" (`admin_users`) -> "📊 Estadísticas" (implícito).
-   **Webhooks de Pago**:
    -   **Punto de Entrada**: Botón "💳 Webhooks Pago" (`admin_payment_webhooks`).
    -   **Función**: Muestra un resumen de los eventos de webhook de pago recientes, incluyendo proveedor, estado y si la firma fue válida.
-   **Reporte de Seguridad**:
    -   **Punto de Entrada**: Botón "🔒 Security Report" (`admin_security_report`).
    -   **Función**: Muestra un reporte de eventos de seguridad relacionados con pagos (ej: ataques de reenvío, bloqueos).
-   **Cristina AI Admin**:
    -   **Punto de Entrada**: Botón "🧠 Cristina Asistente Admin" (`cristina_admin_menu`).
    -   **Función**: Permite a los administradores "alimentar" a Cristina con información actualizada sobre planes, precios y el estado del bot. También incluye un "Modo Lex" donde Cristina actúa como asesora de administración para el propio Lex.
-   **Modo de Vista Previa**:
    -   **Punto de Entrada**: Botón "👁️ Vista Previa" (`admin_view_mode`) o comando `/viewas`.
    -   **Función**: Permite al administrador ver el bot como si fuera un usuario `FREE` o `PRIME`, para probar la experiencia desde diferentes perspectivas.
-   **Logs**: (Solo Super Admins) Acceso a los registros del bot para diagnóstico.
-   **Enlaces PRIME**: `/send_prime_links`.

## 3. Manejadores Importados

El `admin/index.js` registra un gran número de manejadores de otros archivos especializados, como:

-   `broadcastManagement.js`
-   `xAccountWizard.js`
-   `xPostWizard.js`
-   `userManagementHandler.js`
-   `promoAdmin.js`
-   `audioManagement.js`
-   `dateTimePickerHandlers.js`
-   `nearbyPlacesAdmin.js`
-   `enhancedBusinessAdmin.js`
-   `radioAdmin.js`
-   `playlistAdmin.js`

Estos manejadores extienden la funcionalidad del panel de administración principal, proporcionando herramientas especializadas para cada área.
