const { bot, REFUND_ADDRESS, TREASURY_ADDRESS, SUPPORTED_PAYMENT_APPS, optimismUSDC } = require('./config');
const { DaimoPayButton } = require('@daimo/pay');
const { getAddress } = require('viem');

// Generar un enlace de pago para el usuario
async function generatePaymentLink(chatId, amount, userId) {
  const paymentIntent = {
    toAddress: TREASURY_ADDRESS,
    toChain: optimismUSDC.chainId,
    toToken: getAddress(optimismUSDC.token),
    toUnits: amount.toString(), // Ejemplo: "10.00" para 10 USDC
    intent: 'Pay Subscription',
    refundAddress: REFUND_ADDRESS,
    metadata: { userId, chatId, plan: 'premium' },
    paymentOptions: SUPPORTED_PAYMENT_APPS, // Prioriza las apps seleccionadas
  };

  // En un entorno real, aquí usarías el SDK para generar el enlace o botón
  // Para Telegram, enviamos un mensaje con el enlace o botón inline
  const paymentLink = `https://pay.daimo.com/pay?intent=${encodeURIComponent(JSON.stringify(paymentIntent))}`;

  await bot.telegram.sendMessage(
    chatId,
    `🔗 *Paga tu suscripción con tu app preferida*:\n\n` +
    `Puedes usar: ${SUPPORTED_PAYMENT_APPS.join(', ')}\n` +
    `Monto: ${amount} USDC\n` +
    `👉 [Pagar ahora](${paymentLink})`,
    { parse_mode: 'Markdown' }
  );
}

// Manejador del comando /subscribe
bot.command('subscribe', async (ctx) => {
  const amount = 10; // Ejemplo: 10 USDC
  await generatePaymentLink(ctx.chat.id, amount, ctx.from.id);
  ctx.reply('📩 Te he enviado un enlace para completar el pago.');
});

// Manejador de webhook para actualizaciones de pago (simplificado)
bot.on('text', async (ctx) => {
  if (ctx.message.text.includes('payment_completed')) {
    ctx.reply('✅ ¡Pago recibido! Tu suscripción ha sido activada.');
  }
});

module.exports = { bot };
