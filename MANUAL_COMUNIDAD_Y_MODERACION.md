# Manual del Bot - Sistema de Comunidad y Moderación

Este documento describe el ecosistema de la comunidad del bot, incluyendo cómo los usuarios comparten contenido, cómo se modera el grupo y cómo se incentiva la participación.

El sistema está diseñado para fomentar una comunidad activa y autogestionada, con herramientas tanto para los usuarios como para los administradores.

## 1. El Ecosistema de la Comunidad

El sistema gira en torno a un grupo principal de Telegram, cuyo ID se configura en la variable de entorno `GROUP_ID`. Dentro de este grupo, coexisten varios sistemas.

- **Componentes Clave**:
    - **Manejador "Wall of Fame"**: `src/bot/handlers/group/wallOfFame.js`
    - **Servicio de Limpieza**: `src/bot/services/groupCleanupService.js`
    - **Servicio de Popularidad**: `src/bot/services/mediaPopularityService.js`
    - **Planificador de Popularidad**: `src/bot/services/mediaPopularityScheduler.js`

## 2. Contenido Generado por el Usuario (UGC) - El "Wall of Fame"

A diferencia de otros sistemas, los usuarios no envían contenido al bot en privado. El flujo es público y se centra en la interacción dentro del grupo comunitario.

### Flujo de Publicación:

1.  **Publicación en el Grupo**: Un usuario comparte una foto o un video directamente en el chat del grupo principal.
2.  **Detección Automática**: El manejador `wallOfFame.js` está escuchando (`bot.on(['photo', 'video'])`) todos los mensajes multimedia en el grupo.
3.  **Curación y Re-publicación**:
    - El manejador intercepta el mensaje.
    - **Re-publica** una copia del mismo en un "tema" (topic) específico del grupo, designado como el "Wall of Fame" (Muro de la Fama). El ID de este tema se configura en la variable de entorno `WALL_OF_FAME_TOPIC_ID`.
    - Esta copia en el "Wall of Fame" es **permanente** y no será borrada por los sistemas de limpieza.
4.  **Añadir Interacción**: Al re-publicar el contenido en el "Wall of Fame", el bot automáticamente le añade:
    - Una leyenda que acredita al autor original.
    - **Botones de "👍 Me gusta" y "👎 No me gusta"**.

## 3. Sistema de Popularidad y Recompensas

El sistema incentiva la participación midiendo y recompensando el contenido popular.

1.  **Votación**: Otros miembros de la comunidad pueden hacer clic en los botones de "Me gusta" / "No me gusta" en las publicaciones del "Wall of Fame".
2.  **Registro de Votos**: El manejador `wallOfFame.js` captura estas acciones (`bot.action(/^(like|dislike):.../)`) y registra cada voto en una tabla de la base de datos, asociándolo a la publicación y al autor.
3.  **Anuncio de Ganadores**:
    - El `mediaPopularityScheduler.js` ejecuta trabajos programados (cron jobs) de forma periódica (diaria, semanal y mensual).
    - Estos trabajos llaman al `mediaPopularityService.js`.
    - El servicio analiza los datos de los votos para determinar qué publicaciones y usuarios han sido los más populares.
    - Finalmente, el bot **anuncia a los ganadores** (ej: "Top del Día", "Top del Mes") en el grupo, incentivando la competición y la participación. Los ganadores reciben premios, como acceso temporal a la membresía "Prime".

## 4. Sistema de Moderación

Para mantener el orden y la calidad en el grupo principal, se utilizan varias herramientas de moderación.

### 4.1 Moderación Automatizada (Limpieza de Spam)

- **Servicio**: `groupCleanupService.js`.
- **Funcionamiento**: Este servicio se ejecuta como un trabajo programado (cron) dos veces al día.
- **Detección**: Escanea los mensajes enviados en el grupo y los marca como "spam" si cumplen ciertas condiciones:
    - Comandos no autorizados.
    - Mensajes que no están en inglés o español.
    - Exceso de URLs o caracteres especiales.
    - Mensajes escritos completamente en mayúsculas.
- **Acción**: Los mensajes marcados como spam y que tengan más de 12 horas de antigüedad **son eliminados automáticamente** del grupo.

### 4.2 Moderación Manual (Comandos de Admin)

Los administradores tienen acceso a un conjunto de comandos para gestionar a los usuarios y el contenido, que incluyen (pero no se limitan a):
- Expulsar o banear usuarios.
- Eliminar manualmente mensajes inapropiados.
- Aprobar o rechazar contenido que pueda estar en una cola de moderación (como las sugerencias de lugares en el mapa de "Nearby").

### 4.3 Reglas de la Comunidad

- Un comando `/rules` (`moderationCommands.js`) está disponible para que cualquier usuario pueda ver las reglas de la comunidad en cualquier momento.

## 5. Publicaciones Oficiales (Admin)

De forma paralela al contenido de los usuarios, los administradores tienen una herramienta interna (`sharePostToCommunityGroup.js`) para crear, programar y publicar anuncios oficiales, eventos o contenido destacado en los mismos grupos comunitarios y en el canal Prime.
