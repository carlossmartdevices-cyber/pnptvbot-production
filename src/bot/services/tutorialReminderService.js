const { query } = require('../../config/postgres');
const { Markup } = require('telegraf');
const logger = require('../../utils/logger');
const config = require('../../config/config');

/**
 * Tutorial Reminder Service
 * Sends proactive tutorial messages to the group (not privately) based on user subscription status:
 * - FREE/Churned users: How to subscribe and become PRIME
 * - PRIME users: How to use Nearby, Hangouts, and Videorama
 */
class TutorialReminderService {
  static bot = null;
  static GROUP_ID = config.GROUP_ID;

  /**
   * Initialize the service with bot instance
   * @param {Telegraf} bot - Bot instance
   */
  static initialize(bot) {
    this.bot = bot;
    logger.info('Tutorial reminder service initialized');
    if (!this.GROUP_ID) {
      logger.warn('GROUP_ID not configured - tutorials will not be sent');
    }
  }

  /**
   * Start sending tutorial reminders every 3 hours
   * Sends 1 message at a time, rotating through different types
   */
  static startScheduling() {
    if (!this.bot) {
      logger.warn('Cannot start tutorial scheduling - bot not initialized');
      return;
    }
    if (!this.GROUP_ID) {
      logger.warn('Cannot start tutorial scheduling - GROUP_ID not configured');
      return;
    }

    // Track the last message type sent (0: health, 1: tutorial, 2: subscription)
    let lastMessageType = -1;

    // Send initial message immediately
    this.sendSingleScheduledTutorial(lastMessageType);

    // Schedule to run every 3 hours (3 * 60 * 60 * 1000 milliseconds)
    const intervalId = setInterval(async () => {
      try {
        lastMessageType = await this.sendSingleScheduledTutorial(lastMessageType);
      } catch (error) {
        logger.error('Error in tutorial reminder scheduler:', error);
      }
    }, 3 * 60 * 60 * 1000);

    logger.info('Tutorial reminder scheduler started - will send 1 message every 3 hours');
    return intervalId;
  }

  /**
   * Send a single scheduled tutorial message
   * Rotates through: health message, PRIME features tutorial, subscription info
   * @param {number} lastType - Last message type sent (0: health, 1: tutorial, 2: subscription)
   * @returns {number} The message type that was just sent
   */
  static async sendSingleScheduledTutorial(lastType) {
    if (!this.bot || !this.GROUP_ID) {
      logger.warn('Cannot send scheduled tutorial - service not properly initialized');
      return lastType;
    }

    try {
      logger.info('Sending scheduled tutorial reminder to group...');

      // Determine which message to send next (rotate through types)
      const nextType = (lastType + 1) % 3;

      switch (nextType) {
        case 0:
          await this.sendHealthMessage();
          logger.info('Health message sent to group');
          break;
        case 1:
          await this.sendPrimeFeaturesTutorial();
          logger.info('PRIME features tutorial sent to group');
          break;
        case 2:
          await this.sendSubscriptionInfo();
          logger.info('Subscription info sent to group');
          break;
      }

      logger.info('Single scheduled tutorial reminder completed');
      return nextType;
    } catch (error) {
      logger.error('Error sending scheduled tutorial:', error);
      return lastType;
    }
  }

  /**
   * Send health message to group
   */
  static async sendHealthMessage() {
    const message = '💪 *Stay Healthy, Stay Strong!* \n\n' +
      'Remember to take care of your physical and mental health. ' +
      'Stay hydrated, exercise regularly, and take breaks from screens. ' +
      'Your well-being is important to us! 💙';

    try {
      await this.bot.telegram.sendMessage(this.GROUP_ID, message, {
        parse_mode: 'Markdown'
      });
      logger.info('Health message sent to group');
    } catch (error) {
      logger.error('Error sending health message:', error.message);
      throw error;
    }
  }

  /**
   * Send PRIME features tutorial to group
   */
  static async sendPrimeFeaturesTutorial() {
    const message = '💎 *PRIME Features Tutorial* \n\n' +
      'Did you know PRIME members get exclusive access to:\n\n' +
      '✅ **Hangouts** - Create private video rooms\n' +
      '✅ **Videorama** - Full video library access\n' +
      '✅ **Nearby** - Find papis near you\n' +
      '✅ **No Ads** - Clean, uninterrupted experience\n\n' +
      'Already PRIME? Tap the menu button to explore! 🎬';

    try {
      await this.bot.telegram.sendMessage(this.GROUP_ID, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '📱 Open Menu', callback_data: 'menu:main' }
          ]]
        }
      });
      logger.info('PRIME features tutorial sent to group');
    } catch (error) {
      logger.error('Error sending PRIME features tutorial:', error.message);
      throw error;
    }
  }

  /**
   * Send subscription info to group
   */
  static async sendSubscriptionInfo() {
    const message = '🎁 *Upgrade to PRIME Today!* \n\n' +
      'Unlock all features and support our community. ' +
      'PRIME membership gives you full access to everything PNPtv has to offer.\n\n' +
      '💎 *Tap below to see our plans and join the fun!*';

    try {
      await this.bot.telegram.sendMessage(this.GROUP_ID, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '💎 View PRIME Plans', callback_data: 'show_subscription_plans' }
          ]]
        }
      });
      logger.info('Subscription info sent to group');
    } catch (error) {
      logger.error('Error sending subscription info:', error.message);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FREE/CHURNED USER TUTORIALS - How to become PRIME
  // ═══════════════════════════════════════════════════════════════════════════

  static FREE_USER_TUTORIALS = {
    en: [
      {
        title: 'Unlock Full Videos',
        message: `🎬 *Unlock Full-Length Videos!*

Hey papi! Did you know PRIME members get access to *full-length exclusive videos*?

As a free member, you only see previews. Upgrade to PRIME and enjoy:

✅ Full videos from Santino, Lex & the crew
✅ New content added weekly
✅ No ads, no limits

💎 *Ready to unlock everything?*

Tap the button below to see our plans!`,
        button: { text: '💎 View PRIME Plans', callback: 'show_subscription_plans' }
      },
      {
        title: 'Unlimited Nearby',
        message: `📍 *Want Unlimited Nearby Access?*

Free members get only *3 Nearby views per day*. Missing out on connecting with cloudy papis near you?

PRIME members enjoy:

✅ *Unlimited* Nearby searches
✅ See who's online right now
✅ Connect with members in your area
✅ Real-time location sharing

💎 *Upgrade to PRIME* and never miss a connection!`,
        button: { text: '💎 Upgrade Now', callback: 'show_subscription_plans' }
      },
      {
        title: 'Live Hangouts Access',
        message: `🎥 *Join Live Video Hangouts!*

PRIME members can join our *live video rooms* and connect face-to-face with the community!

What you're missing:

✅ Weekly live hangouts with members
✅ Private video rooms
✅ Meet papis from around the world
✅ Exclusive live performances

💎 *Become PRIME* to join the party!`,
        button: { text: '💎 Get PRIME Access', callback: 'show_subscription_plans' }
      },
      {
        title: 'How to Subscribe',
        message: `💳 *How to Become PRIME - It's Easy!*

Ready to unlock all the cloudy fun? Here's how:

*Step 1:* Tap "View Plans" below
*Step 2:* Choose your plan (Monthly, 6-Month, or Lifetime)
*Step 3:* Pay securely via Meru or crypto
*Step 4:* Get instant PRIME access!

💰 *Plans start at just $14.99/month*

🔒 All payments are secure and private.`,
        button: { text: '💎 View Plans', callback: 'show_subscription_plans' }
      },
      {
        title: 'Lifetime Pass',
        message: `♾️ *Get Lifetime Access - Pay Once, Enjoy Forever!*

Our *Lifetime Pass* is the best value:

💎 *$100 one-time payment*
✅ PRIME access forever
✅ All current features
✅ All future features included
✅ Never pay again!

This is perfect for our most dedicated members.

🔥 *Limited availability!*`,
        button: { text: '💎 Get Lifetime Pass', callback: 'show_subscription_plans' }
      }
    ],
    es: [
      {
        title: 'Desbloquea Videos Completos',
        message: `🎬 *¡Desbloquea Videos Completos!*

¡Hola papi! ¿Sabías que los miembros PRIME tienen acceso a *videos exclusivos completos*?

Como miembro gratis, solo ves previews. Hazte PRIME y disfruta:

✅ Videos completos de Santino, Lex y el equipo
✅ Contenido nuevo cada semana
✅ Sin anuncios, sin límites

💎 *¿Listo para desbloquear todo?*

¡Toca el botón para ver nuestros planes!`,
        button: { text: '💎 Ver Planes PRIME', callback: 'show_subscription_plans' }
      },
      {
        title: 'Nearby Ilimitado',
        message: `📍 *¿Quieres Acceso Ilimitado a Nearby?*

Los miembros gratis solo tienen *3 vistas de Nearby por día*. ¿Te estás perdiendo de conectar con papis cerca de ti?

Los miembros PRIME disfrutan:

✅ Búsquedas de Nearby *ilimitadas*
✅ Ve quién está en línea ahora
✅ Conecta con miembros en tu área
✅ Ubicación en tiempo real

💎 *¡Hazte PRIME* y nunca pierdas una conexión!`,
        button: { text: '💎 Actualizar Ahora', callback: 'show_subscription_plans' }
      },
      {
        title: 'Acceso a Hangouts en Vivo',
        message: `🎥 *¡Únete a Hangouts de Video en Vivo!*

¡Los miembros PRIME pueden unirse a nuestras *salas de video en vivo* y conectar cara a cara con la comunidad!

Lo que te estás perdiendo:

✅ Hangouts semanales con miembros
✅ Salas de video privadas
✅ Conoce papis de todo el mundo
✅ Presentaciones en vivo exclusivas

💎 *¡Hazte PRIME* para unirte a la fiesta!`,
        button: { text: '💎 Obtener Acceso PRIME', callback: 'show_subscription_plans' }
      },
      {
        title: 'Cómo Suscribirse',
        message: `💳 *Cómo Hacerte PRIME - ¡Es Fácil!*

¿Listo para desbloquear toda la diversión? Así es como:

*Paso 1:* Toca "Ver Planes" abajo
*Paso 2:* Elige tu plan (Mensual, 6 Meses o Lifetime)
*Paso 3:* Paga de forma segura via Meru o cripto
*Paso 4:* ¡Obtén acceso PRIME instantáneo!

💰 *Los planes empiezan en solo $14.99/mes*

🔒 Todos los pagos son seguros y privados.`,
        button: { text: '💎 Ver Planes', callback: 'show_subscription_plans' }
      },
      {
        title: 'Pase de por Vida',
        message: `♾️ *Obtén Acceso de por Vida - ¡Paga Una Vez, Disfruta Siempre!*

Nuestro *Lifetime Pass* es el mejor valor:

💎 *$100 pago único*
✅ Acceso PRIME para siempre
✅ Todas las funciones actuales
✅ Todas las funciones futuras incluidas
✅ ¡Nunca pagues de nuevo!

Esto es perfecto para nuestros miembros más dedicados.

🔥 *¡Disponibilidad limitada!*`,
        button: { text: '💎 Obtener Lifetime Pass', callback: 'show_subscription_plans' }
      }
    ]
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIME USER TUTORIALS - How to use features
  // ═══════════════════════════════════════════════════════════════════════════

  static PRIME_USER_TUTORIALS = {
    en: [
      {
        title: 'How to Use Nearby',
        message: `📍 *Tutorial: How to Use "Who is Nearby?"*

Find cloudy papis near you in seconds!

*How it works:*

1️⃣ Tap the *"Who is Nearby?"* button in the menu
2️⃣ Share your location when prompted
3️⃣ See a map with nearby members
4️⃣ Tap on profiles to connect!

💡 *Tips:*
• Enable location sharing in your profile settings
• Your exact location is never shown - only approximate
• Refresh anytime to see who's online now

🔥 *Start exploring!*`,
        button: { text: '📍 Open Nearby', callback: 'menu_nearby' }
      },
      {
        title: 'How to Use Hangouts',
        message: `🎥 *Tutorial: How to Join Video Hangouts*

Connect face-to-face with the community!

*How to join a Hangout:*

1️⃣ Tap *"PNPtv Video Rooms"* in the menu
2️⃣ See available rooms and who's inside
3️⃣ Tap *"Join Room"* to enter
4️⃣ Allow camera/mic access when prompted

💡 *Tips:*
• You can join with camera off
• Be respectful - consent matters!
• Check the schedule for special events
• Create your own private room anytime

🎉 *Join the party!*`,
        button: { text: '🎥 Open Hangouts', callback: 'menu_hangouts' }
      },
      {
        title: 'How to Use Videorama',
        message: `🎵 *Tutorial: How to Use Videorama*

Your 24/7 cloudy music & video experience!

*What is Videorama?*
A continuous stream of curated music videos, performances, and community content.

*How to access:*

1️⃣ Tap *"Videorama"* in the menu
2️⃣ Open the Videorama web player
3️⃣ Sit back and enjoy the vibes!

💡 *Features:*
• 24/7 streaming - always something playing
• Curated playlists for the community
• Music, performances, and more
• Works on any device

🎶 *Tune in now!*`,
        button: { text: '🎵 Open Videorama', callback: 'menu_videorama' }
      },
      {
        title: 'Your PRIME Benefits',
        message: `💎 *Reminder: Your PRIME Benefits*

Thank you for being a PRIME member! Here's everything you have access to:

✅ *Full Videos* - Complete exclusive content
✅ *Unlimited Nearby* - Find papis anytime
✅ *Video Hangouts* - Live video rooms
✅ *Videorama* - 24/7 music stream
✅ *PRIME Channel* - Exclusive posts
✅ *Priority Support* - We're here for you!

📱 *Quick access:*
• /menu - Open main menu
• /profile - View your profile
• /support - Get help

💜 *Thanks for being part of the community!*`,
        button: { text: '📱 Open Menu', callback: 'back_to_main' }
      },
      {
        title: 'Exclusive Content',
        message: `🎬 *Don't Miss Our Exclusive Content!*

As a PRIME member, you have access to our *exclusive video library*!

*What's available:*

📹 Full-length videos from Santino, Lex & crew
🔥 Behind-the-scenes content
🎭 Special performances
📺 New content added weekly!

*How to access:*
Tap *"Exclusive Content"* in the menu to browse the full library.

🍿 *What are you watching today?*`,
        button: { text: '🎬 View Content', callback: 'menu_content' }
      }
    ],
    es: [
      {
        title: 'Cómo Usar Nearby',
        message: `📍 *Tutorial: Cómo Usar "¿Quién está Cerca?"*

¡Encuentra papis cerca de ti en segundos!

*Cómo funciona:*

1️⃣ Toca el botón *"¿Quién está Cerca?"* en el menú
2️⃣ Comparte tu ubicación cuando se te pida
3️⃣ Ve un mapa con miembros cercanos
4️⃣ ¡Toca los perfiles para conectar!

💡 *Consejos:*
• Activa compartir ubicación en tu perfil
• Tu ubicación exacta nunca se muestra - solo aproximada
• Actualiza en cualquier momento para ver quién está en línea

🔥 *¡Empieza a explorar!*`,
        button: { text: '📍 Abrir Nearby', callback: 'menu_nearby' }
      },
      {
        title: 'Cómo Usar Hangouts',
        message: `🎥 *Tutorial: Cómo Unirte a Video Hangouts*

¡Conecta cara a cara con la comunidad!

*Cómo unirte a un Hangout:*

1️⃣ Toca *"PNPtv Video Rooms"* en el menú
2️⃣ Ve las salas disponibles y quién está dentro
3️⃣ Toca *"Unirse a Sala"* para entrar
4️⃣ Permite acceso a cámara/micrófono

💡 *Consejos:*
• Puedes unirte con la cámara apagada
• Sé respetuoso - ¡el consentimiento importa!
• Revisa el calendario para eventos especiales
• Crea tu propia sala privada en cualquier momento

🎉 *¡Únete a la fiesta!*`,
        button: { text: '🎥 Abrir Hangouts', callback: 'menu_hangouts' }
      },
      {
        title: 'Cómo Usar Videorama',
        message: `🎵 *Tutorial: Cómo Usar Videorama*

¡Tu experiencia de música y video 24/7!

*¿Qué es Videorama?*
Un stream continuo de videos musicales curados, presentaciones y contenido de la comunidad.

*Cómo acceder:*

1️⃣ Toca *"Videorama"* en el menú
2️⃣ Abre el reproductor web de Videorama
3️⃣ ¡Relájate y disfruta las vibras!

💡 *Características:*
• Streaming 24/7 - siempre hay algo
• Playlists curadas para la comunidad
• Música, presentaciones y más
• Funciona en cualquier dispositivo

🎶 *¡Sintoniza ahora!*`,
        button: { text: '🎵 Abrir Videorama', callback: 'menu_videorama' }
      },
      {
        title: 'Tus Beneficios PRIME',
        message: `💎 *Recordatorio: Tus Beneficios PRIME*

¡Gracias por ser miembro PRIME! Aquí está todo lo que tienes acceso:

✅ *Videos Completos* - Contenido exclusivo completo
✅ *Nearby Ilimitado* - Encuentra papis cuando quieras
✅ *Video Hangouts* - Salas de video en vivo
✅ *Videorama* - Stream de música 24/7
✅ *Canal PRIME* - Posts exclusivos
✅ *Soporte Prioritario* - ¡Estamos aquí para ti!

📱 *Acceso rápido:*
• /menu - Abrir menú principal
• /profile - Ver tu perfil
• /support - Obtener ayuda

💜 *¡Gracias por ser parte de la comunidad!*`,
        button: { text: '📱 Abrir Menú', callback: 'back_to_main' }
      },
      {
        title: 'Contenido Exclusivo',
        message: `🎬 *¡No Te Pierdas Nuestro Contenido Exclusivo!*

Como miembro PRIME, ¡tienes acceso a nuestra *biblioteca de videos exclusivos*!

*¿Qué está disponible?*

📹 Videos completos de Santino, Lex y el equipo
🔥 Contenido detrás de cámaras
🎭 Presentaciones especiales
📺 ¡Contenido nuevo cada semana!

*Cómo acceder:*
Toca *"Contenido Exclusivo"* en el menú para explorar toda la biblioteca.

🍿 *¿Qué vas a ver hoy?*`,
        button: { text: '🎬 Ver Contenido', callback: 'menu_content' }
      }
    ]
  };

  /**
   * Get users by subscription status for tutorials
   * @param {string} statusType - 'free' or 'prime'
   * @returns {Promise<Array>} Array of users
   */
  static async getUsersByStatus(statusType) {
    try {
      let whereClause;
      if (statusType === 'free') {
        // Free and churned users
        whereClause = "subscription_status IN ('free', 'churned') OR subscription_status IS NULL";
      } else if (statusType === 'prime') {
        // Active prime users
        whereClause = "subscription_status = 'active'";
      } else {
        return [];
      }

      const result = await query(`
        SELECT id, username, language, subscription_status
        FROM users
        WHERE ${whereClause}
        AND onboarding_complete = true
        ORDER BY RANDOM()
        LIMIT 100
      `);

      return result.rows;
    } catch (error) {
      logger.error('Error getting users by status:', error);
      return [];
    }
  }

  /**
   * Send tutorial to the group (not privately to users)
   * @param {Object} tutorial - Tutorial object with title, message, button
   * @returns {Promise<boolean>} Success status
   */
  static async sendTutorialToGroup(tutorial) {
    try {
      if (!this.bot) {
        logger.error('Bot not initialized');
        return false;
      }

      if (!this.GROUP_ID) {
        logger.error('GROUP_ID not configured - cannot send tutorials');
        return false;
      }

      const keyboard = tutorial.button
        ? Markup.inlineKeyboard([
            [Markup.button.callback(tutorial.button.text, tutorial.button.callback)]
          ])
        : undefined;

      await this.bot.telegram.sendMessage(this.GROUP_ID, tutorial.message, {
        parse_mode: 'Markdown',
        ...(keyboard ? keyboard : {})
      });

      logger.info(`Tutorial sent to group ${this.GROUP_ID}: ${tutorial.title}`);
      return true;
    } catch (error) {
      if (error.response?.error_code === 403) {
        logger.error(`Cannot send tutorial to group ${this.GROUP_ID}: Bot blocked in group`);
      } else if (error.response?.error_code === 400) {
        logger.error(`Cannot send tutorial to group ${this.GROUP_ID}: Group not found`);
      } else {
        logger.error(`Error sending tutorial to group ${this.GROUP_ID}:`, error.message);
      }
      return false;
    }
  }

  /**
   * Send tutorials to the group about becoming PRIME (for FREE/Churned users)
   * @param {number} maxTutorials - Maximum tutorials to send (default 1)
   * @returns {Promise<Object>} Results { sent, failed }
   */
  static async sendFreeTutorials(maxTutorials = 1) {
    try {
      logger.info('Starting FREE user tutorials...');

      if (!this.GROUP_ID) {
        logger.error('GROUP_ID not configured - cannot send tutorials');
        return { sent: 0, failed: 1 };
      }

      let sent = 0;
      let failed = 0;

      // Send tutorials to the group instead of individual users
      for (let i = 0; i < maxTutorials; i++) {
        // Alternate between English and Spanish tutorials
        const lang = i % 2 === 0 ? 'en' : 'es';
        const tutorials = this.FREE_USER_TUTORIALS[lang];

        // Pick a random tutorial
        const tutorial = tutorials[Math.floor(Math.random() * tutorials.length)];

        const success = await this.sendTutorialToGroup(tutorial);
        if (success) {
          sent++;
        } else {
          failed++;
        }

        // Rate limit protection - 200ms for hourly scheduling
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      logger.info(`FREE tutorials completed: ${sent} sent to group, ${failed} failed`);
      return { sent, failed };
    } catch (error) {
      logger.error('Error in sendFreeTutorials:', error);
      return { sent: 0, failed: 0 };
    }
  }

  /**
   * Send tutorials to the group about using features (for PRIME users)
   * @param {number} maxTutorials - Maximum tutorials to send (default 1)
   * @returns {Promise<Object>} Results { sent, failed }
   */
  static async sendPrimeTutorials(maxTutorials = 1) {
    try {
      logger.info('Starting PRIME user tutorials...');

      if (!this.GROUP_ID) {
        logger.error('GROUP_ID not configured - cannot send tutorials');
        return { sent: 0, failed: 1 };
      }

      let sent = 0;
      let failed = 0;

      // Send tutorials to the group instead of individual users
      for (let i = 0; i < maxTutorials; i++) {
        // Alternate between English and Spanish tutorials
        const lang = i % 2 === 0 ? 'en' : 'es';
        const tutorials = this.PRIME_USER_TUTORIALS[lang];

        // Pick a random tutorial
        const tutorial = tutorials[Math.floor(Math.random() * tutorials.length)];

        const success = await this.sendTutorialToGroup(tutorial);
        if (success) {
          sent++;
        } else {
          failed++;
        }

        // Rate limit protection - 200ms for hourly scheduling
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      logger.info(`PRIME tutorials completed: ${sent} sent to group, ${failed} failed`);
      return { sent, failed };
    } catch (error) {
      logger.error('Error in sendPrimeTutorials:', error);
      return { sent: 0, failed: 0 };
    }
  }

  /**
   * Run all tutorial reminders
   * @returns {Promise<Object>} Combined results
   */
  static async runAllTutorials() {
    logger.info('Running all tutorial reminders...');

    const freeResults = await this.sendFreeTutorials();
    const primeResults = await this.sendPrimeTutorials();

    const results = {
      free: freeResults,
      prime: primeResults,
      total: {
        sent: freeResults.sent + primeResults.sent,
        failed: freeResults.failed + primeResults.failed
      }
    };

    logger.info('Tutorial reminders completed', results);
    return results;
  }
}

module.exports = TutorialReminderService;
