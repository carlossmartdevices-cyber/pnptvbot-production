const { Markup } = require('telegraf');
const ageVerificationService = require('../../../services/ageVerificationService');
const { t } = require('../../../utils/i18n');
const logger = require('../../../utils/logger');
const { getLanguage } = require('../../utils/helpers');

/**
 * Age Verification Handler
 * Handles camera-based age verification with AI
 */

/**
 * Register age verification handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerAgeVerificationHandlers = (bot) => {
  // Action to start photo verification
  bot.action('age_verify_photo', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await startPhotoVerification(ctx);
    } catch (error) {
      logger.error('Error starting photo verification:', error);
      const lang = getLanguage(ctx);
      await ctx.reply(t('error', lang));
    }
  });

  // Action to skip photo verification (fallback to manual confirmation)
  bot.action('age_verify_manual', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await showManualAgeConfirmation(ctx);
    } catch (error) {
      logger.error('Error in manual age verification:', error);
      const lang = getLanguage(ctx);
      await ctx.reply(t('error', lang));
    }
  });

  // Listen for photo submissions during age verification
  bot.on('photo', async (ctx, next) => {
    // Check if user is in photo verification mode
    if (ctx.session.temp?.waitingForAgePhoto) {
      await handleAgePhotoSubmission(ctx);
      return;
    }
    return next();
  });
};

/**
 * Show age verification options (photo or manual)
 * @param {Context} ctx - Telegraf context
 */
const showAgeVerificationOptions = async (ctx) => {
  const lang = getLanguage(ctx);

  const message = lang === 'es'
    ? `🔒 *Verificación de Edad*

Para cumplir con las regulaciones, necesitamos verificar que eres mayor de 18 años.

📸 *Opción 1: Verificación con Foto (Recomendado)*
Toma una selfie y nuestra IA verificará tu edad automáticamente.

✅ *Opción 2: Confirmación Manual*
Confirma manualmente que eres mayor de edad.

¿Cómo deseas verificar tu edad?`
    : `🔒 *Age Verification*

To comply with regulations, we need to verify that you are over 18 years old.

📸 *Option 1: Photo Verification (Recommended)*
Take a selfie and our AI will automatically verify your age.

✅ *Option 2: Manual Confirmation*
Manually confirm that you are of legal age.

How would you like to verify your age?`;

  await ctx.reply(
    message,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback(
          lang === 'es' ? '📸 Verificar con Foto' : '📸 Verify with Photo',
          'age_verify_photo'
        )],
        [Markup.button.callback(
          lang === 'es' ? '✅ Confirmación Manual' : '✅ Manual Confirmation',
          'age_verify_manual'
        )],
      ])
    }
  );
};

/**
 * Start photo verification process
 * @param {Context} ctx - Telegraf context
 */
const startPhotoVerification = async (ctx) => {
  const lang = getLanguage(ctx);

  const instructions = lang === 'es'
    ? `📸 *Instrucciones para la Foto*

Para una verificación exitosa, por favor:

✓ Toma una selfie clara de tu rostro
✓ Asegúrate de tener buena iluminación
✓ Mira directamente a la cámara
✓ No uses filtros o efectos
✓ Tu rostro debe estar completamente visible

📷 *Envía tu foto ahora*

La foto será analizada por IA para verificar tu edad. No almacenamos las fotos después de la verificación.`
    : `📸 *Photo Instructions*

For successful verification, please:

✓ Take a clear selfie of your face
✓ Ensure good lighting
✓ Look directly at the camera
✓ Don't use filters or effects
✓ Your face must be fully visible

📷 *Send your photo now*

The photo will be analyzed by AI to verify your age. We don't store photos after verification.`;

  ctx.session.temp = ctx.session.temp || {};
  ctx.session.temp.waitingForAgePhoto = true;
  await ctx.saveSession();

  await ctx.editMessageText(
    instructions,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback(
          lang === 'es' ? '❌ Cancelar' : '❌ Cancel',
          'age_verify_manual'
        )],
      ])
    }
  );
};

/**
 * Handle age photo submission
 * @param {Context} ctx - Telegraf context
 */
const handleAgePhotoSubmission = async (ctx) => {
  try {
    const lang = getLanguage(ctx);

    // Get the highest quality photo
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const photoFileId = photo.file_id;

    logger.info(`Received age verification photo from user ${ctx.from.id}`);

    // Show processing message
    const processingMsg = await ctx.reply(
      lang === 'es'
        ? '⏳ Analizando tu foto con IA, por favor espera...'
        : '⏳ Analyzing your photo with AI, please wait...'
    );

    // Verify age with AI
    const result = await ageVerificationService.verifyAgeFromPhoto(ctx, photoFileId);

    // Delete processing message
    try {
      await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
    } catch (err) {
      // Ignore if can't delete
    }

    // Clear waiting flag
    ctx.session.temp.waitingForAgePhoto = false;
    await ctx.saveSession();

    // Handle result
    if (!result.success) {
      await handleVerificationError(ctx, result);
      return;
    }

    if (result.verified) {
      await handleVerificationSuccess(ctx, result);
    } else {
      await handleVerificationFailure(ctx, result);
    }
  } catch (error) {
    logger.error('Error handling age photo submission:', error);
    const lang = getLanguage(ctx);
    await ctx.reply(
      lang === 'es'
        ? '❌ Error al procesar la foto. Por favor, intenta nuevamente.'
        : '❌ Error processing photo. Please try again.'
    );
  }
};

/**
 * Handle verification error
 * @param {Context} ctx - Telegraf context
 * @param {Object} result - Verification result
 */
const handleVerificationError = async (ctx, result) => {
  const lang = getLanguage(ctx);

  let errorMessage;
  if (result.error === 'NO_FACE_DETECTED') {
    errorMessage = lang === 'es'
      ? `❌ *No se detectó un rostro*

No pudimos detectar un rostro claro en tu foto.

Por favor, intenta nuevamente con:
• Mejor iluminación
• Foto más cercana de tu rostro
• Sin gafas de sol u obstrucciones

¿Deseas intentar de nuevo?`
      : `❌ *No Face Detected*

We couldn't detect a clear face in your photo.

Please try again with:
• Better lighting
• Closer photo of your face
• No sunglasses or obstructions

Would you like to try again?`;
  } else {
    errorMessage = lang === 'es'
      ? `❌ *Error de Verificación*

Hubo un problema al verificar tu edad: ${result.message || result.error}

¿Deseas intentar de nuevo?`
      : `❌ *Verification Error*

There was a problem verifying your age: ${result.message || result.error}

Would you like to try again?`;
  }

  await ctx.reply(
    errorMessage,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback(
          lang === 'es' ? '🔄 Intentar de Nuevo' : '🔄 Try Again',
          'age_verify_photo'
        )],
        [Markup.button.callback(
          lang === 'es' ? '✅ Verificación Manual' : '✅ Manual Verification',
          'age_verify_manual'
        )],
      ])
    }
  );
};

/**
 * Handle verification success
 * @param {Context} ctx - Telegraf context
 * @param {Object} result - Verification result
 */
const handleVerificationSuccess = async (ctx, result) => {
  const lang = getLanguage(ctx);

  const successMessage = lang === 'es'
    ? `✅ *Verificación Exitosa*

Tu edad ha sido verificada correctamente.

📊 Edad estimada: ${result.age} años
🔒 Estado: Verificado

¡Gracias por completar la verificación!`
    : `✅ *Verification Successful*

Your age has been verified successfully.

📊 Estimated age: ${result.age} years
🔒 Status: Verified

Thank you for completing the verification!`;

  await ctx.reply(successMessage, { parse_mode: 'Markdown' });

  // Update session
  ctx.session.temp.ageConfirmed = true;
  await ctx.saveSession();

  // Continue with onboarding
  const { showTermsAndPrivacy } = require('./onboarding');
  await showTermsAndPrivacy(ctx);
};

/**
 * Handle verification failure (underage)
 * @param {Context} ctx - Telegraf context
 * @param {Object} result - Verification result
 */
const handleVerificationFailure = async (ctx, result) => {
  const lang = getLanguage(ctx);

  const failureMessage = lang === 'es'
    ? `❌ *Verificación No Exitosa*

Según nuestro análisis, no cumples con el requisito de edad mínima (${result.minAge} años).

📊 Edad estimada: ${result.age} años

Si crees que esto es un error, puedes:
• Intentar con otra foto más clara
• Contactar a soporte

Lo sentimos, pero no podemos proceder con tu registro.`
    : `❌ *Verification Failed*

According to our analysis, you don't meet the minimum age requirement (${result.minAge} years).

📊 Estimated age: ${result.age} years

If you believe this is an error, you can:
• Try with a clearer photo
• Contact support

We're sorry, but we cannot proceed with your registration.`;

  await ctx.reply(
    failureMessage,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback(
          lang === 'es' ? '🔄 Intentar con Otra Foto' : '🔄 Try with Another Photo',
          'age_verify_photo'
        )],
        [Markup.button.callback(
          lang === 'es' ? '📞 Contactar Soporte' : '📞 Contact Support',
          'show_support'
        )],
      ])
    }
  );
};

/**
 * Show manual age confirmation (fallback)
 * @param {Context} ctx - Telegraf context
 */
const showManualAgeConfirmation = async (ctx) => {
  const lang = getLanguage(ctx);

  const message = lang === 'es'
    ? `⚠️ *Confirmación Manual de Edad*

Por favor, confirma que tienes al menos 18 años de edad.

Al hacer clic en "Confirmar", declaras bajo tu responsabilidad que eres mayor de edad.`
    : `⚠️ *Manual Age Confirmation*

Please confirm that you are at least 18 years old.

By clicking "Confirm", you declare under your responsibility that you are of legal age.`;

  await ctx.editMessageText(
    message,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback(
          lang === 'es' ? '✅ Confirmar (Soy mayor de 18)' : '✅ Confirm (I am 18+)',
          'age_confirm_yes'
        )],
        [Markup.button.callback(
          lang === 'es' ? '❌ No soy mayor de edad' : '❌ I am not of legal age',
          'age_confirm_no'
        )],
      ])
    }
  );
};

module.exports = {
  registerAgeVerificationHandlers,
  showAgeVerificationOptions,
  startPhotoVerification,
  handleAgePhotoSubmission,
};
