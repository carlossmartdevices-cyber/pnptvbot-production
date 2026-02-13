# Manual del Bot - Generalidades

Este documento describe la arquitectura general, el stack tecnológico y otros detalles importantes del bot de PNPtv.

## 1. Stack Tecnológico

El sistema está construido sobre un stack moderno de JavaScript, contenerizado con Docker para asegurar consistencia entre los entornos de desarrollo y producción.

- **Lenguaje Principal**: **JavaScript (Node.js)**
  - Versión: `>=18.0.0`
  - Estilo de código: `eslint` con configuración `airbnb-base`.
  - Transpilador: `Babel` para compatibilidad con versiones de JavaScript.

- **Frameworks Core**:
  - **Bot de Telegram**: **Telegraf.js** (`telegraf`) para la interacción con la API de Telegram.
  - **API Backend**: **Express.js** (`express`) para crear los endpoints RESTful que dan servicio a las aplicaciones web y webhooks.

- **Base de Datos**:
  - **Motor**: **PostgreSQL** (versión 15).
  - **Cliente**: Librería `pg` de Node.js.
  - **Gestión de Esquema**: Migraciones (`migrations/`).

- **Caché y Mensajería**:
  - **Motor**: **Redis** (versión 7).
  - **Uso**: Almacenamiento en caché, gestión de sesiones de Express (`connect-redis`) y posiblemente colas de tareas.
  - **Cliente**: `ioredis`.

- **Servidor Web y Red**:
  - **Proxy Inverso**: **Nginx**, gestionando el tráfico entrante, terminación SSL y sirviendo contenido estático.
  - **Seguridad**: `helmet` para securizar los headers de Express.
  - **Rate Limiting**: `express-rate-limit` para prevenir abuso de la API.

- **Contenerización**:
  - **Orquestación**: **Docker Compose** (`docker-compose.yml`) para definir y ejecutar la pila de servicios.
  - **Imágenes**: `Dockerfile` para construir la imagen de la aplicación del bot.

- **Testing**:
  - **Framework**: **Jest**.
  - **Pruebas de API**: `supertest`.
  - **Aserciones**: `chai`.
  - **Mocks**: `axios-mock-adapter`, `sinon`.

- **Librerías Clave Adicionales**:
  - **Pagos**: `@daimo/pay`, `epayco-sdk-node`, `puppeteer` (para scraping de confirmaciones de pago).
  - **Autenticación**: `jsonwebtoken` (JWT).
  - **Comunicaciones**: `nodemailer` (email), `axios` (cliente HTTP).
  - **Streaming**: `agora-token` (integración con Agora para Radio/Hangouts).
  - **Inteligencia Artificial**: `openai`.
  - **Internacionalización (i18n)**: `i18next` para soportar múltiples idiomas.
  - **Logging**: `winston` y `morgan`.
  - **Documentación de API**: `swagger-ui-express` y `swagger-jsdoc`.

## 2. Arquitectura de la Aplicación

El proyecto sigue una arquitectura de **monolito modular** desplegado como un único servicio de Docker (`bot`). Aunque es un solo proceso, internamente está organizado en capas y módulos cohesivos para separar responsabilidades.

La comunicación con el exterior se realiza a través de dos puntos de entrada principales:
1.  **El Bot de Telegram**: Atiende a los usuarios de Telegram.
2.  **Una API REST**: Proporciona servicios al frontend web (`webapps/`) y a posibles sistemas externos.

### Estructura de Directorios (`src/`)

La organización del código fuente refleja esta separación de conceptos:

- **`src/bot`**: Contiene toda la lógica del bot de Telegram.
  - `core/bot.js`: Punto de entrada principal (`Telegraf`).
  - `handlers/`: Manejadores para comandos (`/start`), acciones (botones) y eventos.
  - `middleware/`: Middlewares específicos para el bot.

- **`src/api`**: Define la API RESTful con Express.js.
  - `routes/`: Archivos de rutas que mapean endpoints a controladores.
  - `controllers/`: Lógica que procesa la petición y genera una respuesta.
  - `middleware/`: Middlewares de Express (autenticación, validación, logging).

- **`src/services`**: Capa de lógica de negocio. Es el "cerebro" de la aplicación.
  - Contiene funciones que son llamadas tanto por los `handlers` del bot como por los `controllers` de la API (ej: `meruPaymentService.js`, `userActivationService.js`).
  - Orquesta las operaciones con la base de datos y otros servicios.

- **`src/models`**: Define los modelos de datos y la capa de acceso a la base de datos (PostgreSQL).

- **`src/workers`**: Tareas en segundo plano que se ejecutan de forma periódica (ej: `node-cron` para verificar suscripciones).

- **`src/config`**: Archivos de configuración y variables de entorno.

- **`src/utils`**: Funciones de utilidad reutilizables en todo el proyecto.

- **`src/validation`**: Esquemas de validación (probablemente `Joi`) para los datos de entrada.

- **`src/agent`**: Módulo relacionado con funcionalidades de IA (`openai`), posiblemente para soporte automatizado o procesamiento de lenguaje natural.

## 3. Servicios y Alojamiento

El sistema está diseñado para ser **auto-alojado (self-hosted)** en un servidor privado virtual (VPS) bajo un sistema operativo Linux (Debian/Ubuntu). Todos los servicios principales corren en la misma máquina.

### Componentes Principales

- **`bot`**: La aplicación principal de Node.js que incluye el bot de Telegram y la API de Express.
- **`postgres`**: La base de datos PostgreSQL.
- **`redis`**: El servidor Redis para caché y sesiones.
- **`nginx`**: Actúa como proxy inverso, dirigiendo el tráfico de los puertos 80/443 a la aplicación del bot. También maneja los certificados SSL.
- **`certbot`**: Servicio auxiliar que se ejecuta periódicamente para renovar los certificados SSL de Let's Encrypt.

### Métodos de Despliegue

Existen dos métodos de despliegue en el repositorio:

1.  **Despliegue con Docker (Recomendado)**:
    - **Archivos**: `docker-compose.yml`, `docker-compose.prod.yml`, `Dockerfile`.
    - **Proceso**: `docker-compose up` levanta todos los servicios en contenedores aislados. Es el método preferido para producción por su reproducibilidad y aislamiento. `nginx` se ejecuta en su propio contenedor y enruta el tráfico al contenedor del `bot`.

2.  **Despliegue "Bare-Metal" (Legacy/Alternativo)**:
    - **Archivo**: `deploy-server.sh`.
    - **Proceso**: Este script instala todas las dependencias (Node.js, PostgreSQL, Redis) directamente en el sistema operativo del servidor.
    - **Gestor de Procesos**: Utiliza **PM2** para mantener la aplicación del bot corriendo de forma persistente.
    - **Nota**: Este método no usa Docker y parece ser una alternativa más antigua o para escenarios específicos.

## 4. Gestión de Textos y Traducciones (i18n)

El bot está preparado para ser multi-idioma (español e inglés) y utiliza la librería `i18next` para la internacionalización (i18n).

### Sistema Formal de Traducciones

- **Ubicación**: Las traducciones se encuentran en el directorio `locales/`.
- **Estructura**: `locales/{idioma}/messages.json`. (Ej: `locales/es/messages.json`).
- **Funcionamiento**: El código debería usar una función de traducción (ej: `t('my_key')`) para obtener el texto correspondiente al idioma del usuario.

### Textos Hardcodeados (Deuda Técnica)

A pesar de la existencia del sistema de i18n, existe una cantidad muy significativa de textos (mensajes al usuario, etiquetas de botones, etc.) que están "hardcodeados" directamente en el código fuente.

Esto se considera una deuda técnica, ya que dificulta la gestión y modificación de los textos.

- **Síntomas**:
  - Uso de operadores ternarios para cambiar el idioma: `lang === 'es' ? 'Hola' : 'Hello'`.
  - Cadenas de texto literales en las respuestas del bot (`ctx.reply('Mi mensaje...')`) o de la API (`res.send('Error')`).
  - Mensajes completos construidos con template literals en el código.

- **Puntos Críticos (Hotspots)**:
  La mayoría de estos textos se encuentran en la capa de **servicios**, especialmente en archivos encargados de enviar notificaciones o emails. Algunos de los archivos más relevantes son:
  - `src/services/emailService.js`
  - `src/services/subscriptionReminderEmailService.js`
  - `src/bot/services/messageTemplates.js`
  - `src/bot/services/tutorialReminderService.js`
  - `src/bot/services/pnpLiveNotificationService.js`
  - `src/bot/services/mediaPopularityService.js`
  - `src/config/menuConfig.js`

## 5. Flujo de Onboarding de Nuevos Usuarios

El proceso de onboarding es el primer contacto que un usuario tiene con el bot. Se inicia principalmente a través del comando `/start`. El manejador principal de este flujo se encuentra en `src/bot/handlers/user/onboarding.js`.

### Lógica del Comando `/start`

1.  **Creación de Usuario**: Al recibir `/start`, el sistema busca al usuario en la base de datos por su ID de Telegram. Si no existe, crea un nuevo registro.
2.  **Verificación de Onboarding**: Comprueba el flag `onboardingComplete` del perfil del usuario.
    - **Si es `true`**: El usuario ya completó el registro. Se le muestra directamente el menú principal del bot (`showMainMenu`).
    - **Si es `false`**: Se inicia el flujo de onboarding secuencial (ver abajo).
3.  **Manejo de Deep Links**: El comando `/start` puede contener un parámetro para dirigir al usuario a una sección específica (ej: `/start activate_lifetime`). Algunos payloads soportados son:
    - `activate_lifetime`: Inicia la activación de un pase vitalicio (flujo de Meru).
    - `promo_CODE`: Aplica un código promocional.
    - `plans`: Muestra los planes de suscripción.
    - `nearby`: Lleva a la función de "Gente Cercana".
    - `edit_profile`: Permite al usuario editar su perfil.
    - `pnp_live`: Accede al menú de shows privados.
    - `viewprofile_USERID`: Muestra el perfil de otro usuario.

### Secuencia de Pasos del Onboarding

Si un usuario es nuevo o no ha completado el proceso, se le guía a través de los siguientes pasos de forma secuencial, principalmente mediante botones inline:

1.  **Selección de Idioma**: Se presentan botones para "🇺🇸 English" y "🇪🇸 Español". La elección se guarda en la sesión del usuario.
2.  **Confirmación de Edad**: El usuario debe confirmar que es mayor de edad. Este paso puede involucrar un sistema de verificación más complejo (`ageVerificationHandler.js`).
3.  **Aceptación de Términos**: Se muestran los enlaces a los Términos de Servicio y la Política de Privacidad, y el usuario debe aceptarlos.
4.  **Solicitud de Email**: Se le pide al usuario que proporcione una dirección de correo electrónico. El sistema valida el formato y comprueba que no esté en uso por otra cuenta.
5.  **Compartir Ubicación (Opcional)**: Se le pregunta al usuario si desea compartir su ubicación aproximada para la función "Gente Cercana".
6.  **Finalización**:
    - Se marca el perfil del usuario con `onboardingComplete = true`.
    - Se envía un mensaje de bienvenida.
    - Se genera un **enlace de invitación de un solo uso** para que el usuario se una al grupo principal de Telegram.
    - Finalmente, se muestra el menú principal del bot, completando el ciclo.
