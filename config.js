require('dotenv').config();
const { DaimoPayButton, getDefaultConfig } = require('@daimo/pay');
const { optimismUSDC } = require('@daimo/pay-common');
const { createConfig } = require('wagmi');
const { QueryClient } = require('@tanstack/react-query');
const { Telegraf } = require('telegraf');

// Configuración de Daimo Pay
const daimoConfig = getDefaultConfig({
  appName: 'PNPtv Bot',
  appIcon: 'https://tu-dominio.com/logo.png',
  appDescription: 'Suscripciones premium y pagos para PNPtv',
});

// Configuración de Wagmi (para interacción con blockchain)
const wagmi = createConfig(daimoConfig);
const queryClient = new QueryClient();

// Inicializar bot de Telegram
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Direcciones y parámetros fijos
const REFUND_ADDRESS = '0xTuDireccionDeRefund'; // Debe ser válida en todas las redes soportadas
const TREASURY_ADDRESS = '0xTuDireccionDeTesoro'; // Donde se depositarán los USDC
const SUPPORTED_PAYMENT_APPS = ['Venmo', 'CashApp', 'Zelle', 'Revolut', 'Wise'];

module.exports = {
  bot,
  wagmi,
  queryClient,
  REFUND_ADDRESS,
  TREASURY_ADDRESS,
  SUPPORTED_PAYMENT_APPS,
  optimismUSDC,
};