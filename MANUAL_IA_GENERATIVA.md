# Manual del Bot - Sistema de IA Generativa

Este documento describe las diferentes formas en que el bot utiliza la Inteligencia Artificial generativa para la creación de contenido, la moderación y el soporte al cliente.

El sistema utiliza principalmente el modelo de lenguaje **Grok** (de xAI), al que accede a través de una API configurada en el `grokService.js`.

## 1. Generación de Contenido para Administradores

Esta funcionalidad sirve como un asistente de redacción para los administradores, asegurando que todo el contenido publicado sea coherente con la marca y el tono del bot.

- **Servicio Principal**: `src/bot/services/grokService.js`.
- **Activación**: Se utiliza dentro de asistentes de administración, como el de "Compartir Publicación" (`sharePostToCommunityGroup.js`).
- **Funcionamiento**:
    1.  Un administrador proporciona una idea o un borrador simple (ej: "anunciar el nuevo video de Lex").
    2.  El sistema invoca al `grokService` con un "modo" específico (ej: `broadcast`, `salesPost`).
    3.  El servicio construye un **prompt de sistema** extremadamente detallado que define una persona específica: **"Meth Daddy / Santino"**. Este prompt incluye reglas estrictas sobre el tono (dominante, oscuro), el lenguaje a utilizar (jerga colombiana, temática PnP), el formato del mensaje, los emojis y hashtags permitidos, etc.
    4.  Se envía la petición a la API de Grok.
    5.  La IA devuelve un texto completamente redactado y formateado, listo para ser publicado, que suena como si lo hubiera escrito el personaje "Meth Daddy". El sistema es capaz de generar versiones en inglés y español simultáneamente.

## 2. Asistente de Soporte "Cristina"

Para ofrecer soporte automatizado 24/7 a los usuarios, el bot implementa un chatbot de IA con su propia personalidad.

- **Manejador Principal**: `src/bot/handlers/support/cristinaAI.js`.
- **Servicio Subyacente**: `src/bot/services/cristinaAIService.js` (que a su vez utiliza `grokService`).
- **Activación**: Los usuarios interactúan con la asistente a través del comando `/cristina`.
- **Funcionamiento**:
    1.  **Personalidad "Cristina"**: Al igual que para la generación de contenido, se utiliza un prompt de sistema muy detallado para definir la personalidad de "Cristina": una asistente de soporte profesional, empática y conocedora, con una identidad de mujer trans afrolatina y lesbiana. El prompt le instruye sobre el tono a utilizar, la información que puede dar y sus limitaciones (ej: no dar consejos médicos).
    2.  **Base de Conocimiento Dinámica**: El prompt de Cristina se actualiza dinámicamente con información reciente proporcionada por los administradores (`CristinaAdminInfoService`), asegurando que sus respuestas sobre precios, planes o estado del bot sean actuales.
    3.  **Lógica de Respuesta**:
        - **Intento 1 (Respuesta con IA)**: Cuando un usuario hace una pregunta (`/cristina ¿cómo pago?`), el sistema primero intenta obtener una respuesta del modelo Grok, enviando la pregunta del usuario, la personalidad de Cristina y un historial breve de la conversación para mantener el contexto.
        - **Intento 2 (Respuesta por Palabras Clave)**: Si la API de Grok falla o no está disponible, el sistema tiene un **mecanismo de fallback** que busca palabras clave en la pregunta del usuario (ej: "pago", "suscripción", "reglas") y devuelve una respuesta predefinida y útil.

## 3. Moderación de Contenido con IA (Simulado)

El sistema está preparado para utilizar IA en la moderación de contenido, aunque la implementación actual es un "mock" (una simulación).

- **Servicio Principal**: `src/services/aiModerationService.js`.
- **Propósito**: Analizar texto en tiempo real (ej: mensajes en un chat de streaming en vivo) para detectar violaciones de las normas de la comunidad.
- **Funcionamiento (Actual)**:
    - El servicio **simula** un análisis de IA mediante la búsqueda de palabras clave en listas predefinidas (ej: `badWords`, `sexualWords`).
    - Asigna una "puntuación" de toxicidad, amenaza, etc., basada en las coincidencias.
- **Funcionamiento (En Producción)**:
    - La intención es que el mock sea reemplazado por una llamada real a una API de moderación de contenido (como Perspective API de Google o el endpoint de moderación de OpenAI).
    - El sistema está diseñado para tomar acciones basadas en la puntuación de la IA y el historial de violaciones del usuario, permitiendo un sistema de castigos escalonado (Advertencia -> Silencio temporal -> Baneo).
