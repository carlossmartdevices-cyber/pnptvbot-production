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
