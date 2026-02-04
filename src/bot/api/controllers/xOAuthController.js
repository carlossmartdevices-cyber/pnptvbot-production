const XOAuthService = require('../../services/xOAuthService');
const logger = require('../../../utils/logger');

const sanitizeBotUsername = (value) => String(value || '').replace(/^@/, '').trim();

const buildRedirectPage = (title, message, botLink) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; text-align: center; padding: 40px; }
    .card { max-width: 520px; margin: 0 auto; border-radius: 12px; padding: 24px; background: #f6f8ff; }
    h1 { color: #0f172a; }
    p { color: #334155; }
    .button { display: inline-block; margin-top: 16px; padding: 12px 18px; background: #1d4ed8; color: #fff; text-decoration: none; border-radius: 8px; }
    .muted { color: #64748b; font-size: 12px; word-break: break-all; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    ${botLink ? `<a class="button" href="${botLink}">Abrir bot</a><p class="muted">${botLink}</p>` : ''}
  </div>
  ${botLink ? `
  <script>
    (function() {
      try {
        var tg = '${botLink}'.replace('https://t.me/', 'tg://resolve?domain=');
        setTimeout(function() { window.location.href = tg; }, 400);
      } catch (e) {}
    })();
  </script>` : ''}
</body>
</html>
`;

const startOAuth = async (req, res) => {
  try {
    const adminId = req.query.admin_id ? Number(req.query.admin_id) : null;
    const adminUsername = req.query.admin_username || null;
    const url = await XOAuthService.createAuthUrl({ adminId, adminUsername });
    res.json({ success: true, url });
  } catch (error) {
    logger.error('Error starting X OAuth via API:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const handleCallback = async (req, res) => {
  try {
    const { state, code, error, error_description: errorDescription } = req.query;
    const botUsername = sanitizeBotUsername(process.env.BOT_USERNAME);
    const botLink = botUsername ? `https://t.me/${botUsername}` : null;

    if (error) {
      return res.status(400).send(buildRedirectPage('Conexion rechazada', errorDescription || error, botLink));
    }

    const account = await XOAuthService.handleOAuthCallback({ code, state });
    return res.send(buildRedirectPage(
      'Cuenta conectada',
      `La cuenta @${account.handle} fue conectada correctamente. Puedes regresar al bot.`,
      botLink
    ));
  } catch (error) {
    logger.error('Error handling X OAuth callback:', error);
    return res.status(400).send(buildRedirectPage(
      'Error al conectar',
      error.message || 'No se pudo conectar la cuenta de X.',
      sanitizeBotUsername(process.env.BOT_USERNAME)
        ? `https://t.me/${sanitizeBotUsername(process.env.BOT_USERNAME)}`
        : null
    ));
  }
};

module.exports = {
  startOAuth,
  handleCallback,
};
