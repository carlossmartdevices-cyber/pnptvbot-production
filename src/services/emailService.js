const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

/**
 * Email Service
 * Handles all email operations including magic link authentication
 */
class EmailService {
    constructor() {
        this.transporter = null;
        this.from = process.env.EMAIL_FROM || 'noreply@easybots.store';
        this.initializeTransporter();
    }

    /**
     * Initialize email transporter based on environment config
     */
    initializeTransporter() {
        // Check if email is configured
        if (!process.env.SMTP_HOST && !process.env.SENDGRID_API_KEY) {
            logger.warn('Email service not configured. Emails will be logged instead of sent.');
            return;
        }

        try {
            if (process.env.SENDGRID_API_KEY) {
                // SendGrid configuration
                this.transporter = nodemailer.createTransport({
                    host: 'smtp.sendgrid.net',
                    port: 587,
                    secure: false,
                    auth: {
                        user: 'apikey',
                        pass: process.env.SENDGRID_API_KEY
                    }
                });
                logger.info('Email service initialized with SendGrid');
            } else if (process.env.SMTP_HOST) {
                // Generic SMTP configuration
                this.transporter = nodemailer.createTransport({
                    host: process.env.SMTP_HOST,
                    port: parseInt(process.env.SMTP_PORT, 10) || 587,
                    secure: process.env.SMTP_SECURE === 'true',
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASSWORD
                    }
                });
                logger.info('Email service initialized with SMTP');
            }
        } catch (error) {
            logger.error('Error initializing email transporter:', error);
        }
    }

    /**
     * Send an email
     * @param {Object} options - Email options
     * @returns {Promise<Object>} Send result
     */
    async send(options) {
        const {
            to,
            subject,
            html,
            text,
            from = this.from
        } = options;

        try {
            // If no transporter, log email instead
            if (!this.transporter) {
                logger.info('Email would be sent (no transporter configured):', {
                    to,
                    subject,
                    from
                });
                return { success: true, messageId: 'logged', mode: 'logging' };
            }

            const mailOptions = {
                from,
                to,
                subject,
                html,
                text: text || this.stripHtml(html)
            };

            const info = await this.transporter.sendMail(mailOptions);
            logger.info('Email sent successfully:', {
                to,
                subject,
                messageId: info.messageId
            });

            return {
                success: true,
                messageId: info.messageId,
                mode: 'sent'
            };
        } catch (error) {
            logger.error('Error sending email:', {
                to,
                subject,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Send magic link for host authentication
     * @param {Object} data - Host authentication data
     * @returns {Promise<Object>} Send result
     */
    async sendHostMagicLink(data) {
        const {
            email,
            roomCode,
            roomTitle,
            token,
            hostName = 'Host'
        } = data;

        const magicLinkUrl = `https://easybots.store/zoom/auth/${token}`;

        const html = this.getHostMagicLinkTemplate({
            hostName,
            roomCode,
            roomTitle,
            magicLinkUrl
        });

        return await this.send({
            to: email,
            subject: `🎥 Your Zoom Host Access Link - ${roomCode}`,
            html
        });
    }

    /**
     * Send room invitation
     * @param {Object} data - Invitation data
     * @returns {Promise<Object>} Send result
     */
    async sendRoomInvitation(data) {
        const {
            email,
            roomCode,
            roomTitle,
            hostName,
            scheduledTime = null,
            message = ''
        } = data;

        const joinUrl = `https://easybots.store/zoom/join/${roomCode}`;

        const html = this.getRoomInvitationTemplate({
            roomCode,
            roomTitle,
            hostName,
            joinUrl,
            scheduledTime,
            message
        });

        return await this.send({
            to: email,
            subject: `📅 Invitation: ${roomTitle} - ${roomCode}`,
            html
        });
    }

    /**
     * Send recording ready notification
     * @param {Object} data - Recording data
     * @returns {Promise<Object>} Send result
     */
    async sendRecordingReady(data) {
        const {
            email,
            roomTitle,
            recordingUrl,
            downloadUrl,
            duration,
            fileSize
        } = data;

        const html = this.getRecordingReadyTemplate({
            roomTitle,
            recordingUrl,
            downloadUrl,
            duration,
            fileSize
        });

        return await this.send({
            to: email,
            subject: `📹 Your Recording is Ready - ${roomTitle}`,
            html
        });
    }

    /**
     * Get host magic link email template
     * @param {Object} data - Template data
     * @returns {string} HTML template
     */
    getHostMagicLinkTemplate(data) {
        const { hostName, roomCode, roomTitle, magicLinkUrl } = data;

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo {
            font-size: 32px;
            font-weight: bold;
            color: #2D8CFF;
        }
        .title {
            color: #2D8CFF;
            font-size: 24px;
            margin-bottom: 10px;
        }
        .room-code {
            background: #f0f8ff;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            font-size: 28px;
            font-weight: bold;
            color: #2D8CFF;
            letter-spacing: 2px;
            margin: 20px 0;
        }
        .button {
            display: inline-block;
            background: #2D8CFF;
            color: white !important;
            padding: 15px 40px;
            text-decoration: none;
            border-radius: 50px;
            font-weight: bold;
            margin: 20px 0;
            transition: background 0.3s;
        }
        .button:hover {
            background: #1a6fd6;
        }
        .info-box {
            background: #f9f9f9;
            padding: 15px;
            border-left: 4px solid #2D8CFF;
            margin: 20px 0;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #666;
            font-size: 12px;
        }
        .features {
            margin: 20px 0;
        }
        .feature {
            padding: 10px 0;
        }
        .feature-icon {
            display: inline-block;
            width: 30px;
            color: #2D8CFF;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🎥 PNP.tv Zoom</div>
        </div>

        <h1 class="title">Welcome, ${hostName}!</h1>

        <p>You've created a Zoom meeting room. As the host, you have full control over your meeting.</p>

        <div class="room-code">${roomCode}</div>

        <p style="text-align: center;">
            <strong>Room:</strong> ${roomTitle}
        </p>

        <div style="text-align: center;">
            <a href="${magicLinkUrl}" class="button">🎛️ Join as Host</a>
        </div>

        <div class="info-box">
            <strong>🔑 Magic Link:</strong><br>
            <code style="word-break: break-all;">${magicLinkUrl}</code><br>
            <small>This link is unique to you and grants full host controls. Keep it private.</small>
        </div>

        <div class="features">
            <h3>🎛️ Your Host Controls:</h3>
            <div class="feature">
                <span class="feature-icon">✅</span> Mute/unmute participants
            </div>
            <div class="feature">
                <span class="feature-icon">📹</span> Turn cameras on/off
            </div>
            <div class="feature">
                <span class="feature-icon">🚪</span> Remove participants
            </div>
            <div class="feature">
                <span class="feature-icon">🎭</span> Change layouts and spotlight
            </div>
            <div class="feature">
                <span class="feature-icon">🎥</span> Start/stop recording
            </div>
            <div class="feature">
                <span class="feature-icon">📊</span> Launch polls and Q&A
            </div>
            <div class="feature">
                <span class="feature-icon">🔊</span> Share audio from device
            </div>
        </div>

        <div class="info-box">
            <strong>📤 Invite Guests:</strong><br>
            Share this link with participants:<br>
            <code>https://easybots.store/zoom/join/${roomCode}</code><br>
            <small>Guests can join without any authentication!</small>
        </div>

        <div class="footer">
            <p><strong>PNP.tv</strong> - Premium Zoom Meetings</p>
            <p>This link expires in 24 hours for security.</p>
            <p>Need help? Contact support at <a href="mailto:support@easybots.store">support@easybots.store</a></p>
        </div>
    </div>
</body>
</html>
        `;
    }

    /**
     * Get room invitation template
     * @param {Object} data - Template data
     * @returns {string} HTML template
     */
    getRoomInvitationTemplate(data) {
        const { roomCode, roomTitle, hostName, joinUrl, scheduledTime, message } = data;

        const scheduledText = scheduledTime
            ? `<p><strong>🕐 Scheduled for:</strong> ${new Date(scheduledTime).toLocaleString()}</p>`
            : '';

        const customMessage = message
            ? `<div class="info-box"><strong>📝 Message from ${hostName}:</strong><br>${message}</div>`
            : '';

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo {
            font-size: 32px;
            font-weight: bold;
            color: #2D8CFF;
        }
        .room-code {
            background: #f0f8ff;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            font-size: 24px;
            font-weight: bold;
            color: #2D8CFF;
            margin: 20px 0;
        }
        .button {
            display: inline-block;
            background: #2D8CFF;
            color: white !important;
            padding: 15px 40px;
            text-decoration: none;
            border-radius: 50px;
            font-weight: bold;
            margin: 20px 0;
        }
        .info-box {
            background: #f9f9f9;
            padding: 15px;
            border-left: 4px solid #2D8CFF;
            margin: 20px 0;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #666;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🎥 PNP.tv Zoom</div>
        </div>

        <h1 style="color: #2D8CFF;">You're Invited!</h1>

        <p><strong>${hostName}</strong> has invited you to a Zoom meeting.</p>

        <div class="room-code">${roomCode}</div>

        <p style="text-align: center;">
            <strong>📝 ${roomTitle}</strong>
        </p>

        ${scheduledText}

        ${customMessage}

        <div style="text-align: center;">
            <a href="${joinUrl}" class="button">🎥 Join Meeting</a>
        </div>

        <div class="info-box">
            <strong>Join Link:</strong><br>
            <code>${joinUrl}</code><br>
            <small>No authentication required - just click and join!</small>
        </div>

        <div class="footer">
            <p><strong>PNP.tv</strong> - Premium Zoom Meetings</p>
            <p>Having trouble? Copy and paste the join link into your browser.</p>
        </div>
    </div>
</body>
</html>
        `;
    }

    /**
     * Get recording ready template
     * @param {Object} data - Template data
     * @returns {string} HTML template
     */
    getRecordingReadyTemplate(data) {
        const { roomTitle, recordingUrl, downloadUrl, duration, fileSize } = data;

        const fileSizeMB = fileSize ? (fileSize / 1024 / 1024).toFixed(2) : 'N/A';
        const durationMin = duration ? Math.floor(duration / 60) : 'N/A';

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .button {
            display: inline-block;
            background: #2D8CFF;
            color: white !important;
            padding: 15px 40px;
            text-decoration: none;
            border-radius: 50px;
            font-weight: bold;
            margin: 10px 5px;
        }
        .info-box {
            background: #f9f9f9;
            padding: 15px;
            border-left: 4px solid #2D8CFF;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1 style="color: #2D8CFF;">📹 Your Recording is Ready!</h1>

        <p>The recording for <strong>${roomTitle}</strong> has been processed and is ready to view.</p>

        <div class="info-box">
            <p><strong>Duration:</strong> ${durationMin} minutes</p>
            <p><strong>File Size:</strong> ${fileSizeMB} MB</p>
        </div>

        <div style="text-align: center;">
            <a href="${recordingUrl}" class="button">▶️ Watch</a>
            ${downloadUrl ? `<a href="${downloadUrl}" class="button">⬇️ Download</a>` : ''}
        </div>

        <p style="text-align: center; margin-top: 30px; color: #666; font-size: 12px;">
            <strong>PNP.tv</strong> - Premium Zoom Meetings
        </p>
    </div>
</body>
</html>
        `;
    }

    /**
     * Strip HTML tags from string
     * @param {string} html - HTML string
     * @returns {string} Plain text
     */
    stripHtml(html) {
        return html.replace(/<[^>]*>/g, '');
    }

    /**
     * Send payment confirmation email
     * @param {Object} data - Payment confirmation data
     * @returns {Promise<Object>} Send result
     */
    async sendPaymentConfirmation(data) {
        const {
            email,
            name = 'Usuario',
            planName,
            amount,
            currency,
            nextPaymentDate,
            inviteLinks = []
        } = data;

        const html = this.getPaymentConfirmationTemplate({
            name,
            planName,
            amount,
            currency,
            nextPaymentDate,
            inviteLinks
        });

        return await this.send({
            to: email,
            subject: `🎉 ¡Bienvenido a PNPtv PRIME! - Confirmación de Pago`,
            html
        });
    }

    /**
     * Send subscription reminder email
     * @param {Object} data - Reminder data
     * @returns {Promise<Object>} Send result
     */
    async sendSubscriptionReminder(data) {
        const {
            email,
            name = 'Usuario',
            planName,
            expiryDate,
            daysRemaining,
            renewUrl = 'https://easybots.store'
        } = data;

        const html = this.getSubscriptionReminderTemplate({
            name,
            planName,
            expiryDate,
            daysRemaining,
            renewUrl
        });

        const subject = daysRemaining === 3
            ? `⏰ Tu suscripción PRIME expira en 3 días`
            : `🚨 ¡Último recordatorio! Tu suscripción expira mañana`;

        return await this.send({
            to: email,
            subject,
            html
        });
    }

    /**
     * Send subscription expired email
     * @param {Object} data - Expiration data
     * @returns {Promise<Object>} Send result
     */
    async sendSubscriptionExpired(data) {
        const {
            email,
            name = 'Usuario',
            planName,
            renewUrl = 'https://easybots.store'
        } = data;

        const html = this.getSubscriptionExpiredTemplate({
            name,
            planName,
            renewUrl
        });

        return await this.send({
            to: email,
            subject: `💔 Te vamos a extrañar - Tu suscripción PRIME ha expirado`,
            html
        });
    }

    /**
     * Send purchase invoice email (from easybots.store)
     * @param {Object} data - Invoice data
     * @returns {Promise<Object>} Send result
     */
    async sendPurchaseInvoice(data) {
        const {
            email,
            name = 'Usuario',
            invoiceBuffer,
            invoiceFileName,
            amount,
            currency = 'USD'
        } = data;

        const html = this.getPurchaseInvoiceTemplate({
            name,
            amount,
            currency
        });

        // Convert buffer to base64 for attachment
        const attachments = [{
            filename: invoiceFileName,
            content: invoiceBuffer,
            contentType: 'application/pdf'
        }];

        try {
            // If no transporter, log email instead
            if (!this.transporter) {
                logger.info('Purchase invoice email would be sent (no transporter configured):', {
                    to: email,
                    subject: 'Gracias por tu compra - Factura adjunta',
                    attachments: [invoiceFileName]
                });
                return { success: true, messageId: 'logged', mode: 'logging' };
            }

            const mailOptions = {
                from: this.from,
                to: email,
                subject: 'Gracias por tu compra - Factura adjunta',
                html,
                text: this.stripHtml(html),
                attachments
            };

            const info = await this.transporter.sendMail(mailOptions);
            logger.info('Purchase invoice email sent successfully:', {
                to: email,
                messageId: info.messageId,
                invoiceFileName
            });

            return {
                success: true,
                messageId: info.messageId,
                mode: 'sent'
            };
        } catch (error) {
            logger.error('Error sending purchase invoice email:', {
                to: email,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Get purchase invoice email template (simple thank you with PDF attached)
     * @param {Object} data - Template data
     * @returns {string} HTML template
     */
    getPurchaseInvoiceTemplate(data) {
        const { name, amount, currency } = data;

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo {
            font-size: 32px;
            font-weight: bold;
            color: #2D8CFF;
        }
        .success-icon {
            text-align: center;
            font-size: 64px;
            margin: 20px 0;
        }
        .info-box {
            background: #f0f8ff;
            padding: 20px;
            border-left: 4px solid #2D8CFF;
            margin: 20px 0;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #666;
            font-size: 12px;
        }
        .attachment-notice {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🛒 Easy Bots Store</div>
        </div>

        <div class="success-icon">✅</div>

        <h1 style="color: #2D8CFF; text-align: center;">¡Gracias por tu compra, ${name}!</h1>

        <p style="text-align: center; font-size: 16px;">
            Tu pago de <strong>${amount} ${currency}</strong> ha sido procesado exitosamente.
        </p>

        <div class="attachment-notice">
            <p style="margin: 0;">
                📄 <strong>Factura adjunta</strong><br>
                Tu factura de compra está adjunta a este correo electrónico en formato PDF.
            </p>
        </div>

        <div class="info-box">
            <h3 style="margin-top: 0;">🤖 Servicios de Inteligencia Artificial</h3>
            <p>
                Has adquirido servicios profesionales de desarrollo y mantenimiento de bots automatizados
                y herramientas de IA para gestión empresarial.
            </p>
        </div>

        <p style="text-align: center; margin-top: 30px;">
            Gracias por confiar en <strong>Easy Bots Store</strong>
        </p>

        <div class="footer">
            <p><strong>Easy Bots Store</strong></p>
            <p>KR33 86-76 Bucaramanga, Colombia</p>
            <p>Email: <a href="mailto:no-reply@easybots.store">no-reply@easybots.store</a> | Tel: +57 302 857 3797</p>
            <p style="margin-top: 15px; font-size: 10px;">
                Carlos Humberto Jimenez Manrique - NIT 1098643746-2
            </p>
            <p style="margin-top: 10px; font-size: 11px;">
                © ${new Date().getFullYear()} Easy Bots Store. Todos los derechos reservados.
            </p>
        </div>
    </div>
</body>
</html>
        `;
    }

    /**
     * Get payment confirmation email template
     * @param {Object} data - Template data
     * @returns {string} HTML template
     */
    getPaymentConfirmationTemplate(data) {
        const { name, planName, amount, currency, nextPaymentDate, inviteLinks } = data;

        const inviteLinksHtml = inviteLinks.length > 0
            ? inviteLinks.map((link, idx) => `
                <div style="text-align: center; margin: 10px 0;">
                    <a href="${link}" class="button">🔐 Acceder a PRIME Canal ${inviteLinks.length > 1 ? idx + 1 : ''}</a>
                </div>
            `).join('')
            : '<p><strong>Link de acceso:</strong> <a href="https://t.me/PNPTV_PRIME">https://t.me/PNPTV_PRIME</a></p>';

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo {
            font-size: 32px;
            font-weight: bold;
            color: #2D8CFF;
        }
        .title {
            color: #2D8CFF;
            font-size: 24px;
            margin-bottom: 10px;
        }
        .button {
            display: inline-block;
            background: #2D8CFF;
            color: white !important;
            padding: 15px 40px;
            text-decoration: none;
            border-radius: 50px;
            font-weight: bold;
            margin: 10px 0;
            transition: background 0.3s;
        }
        .button:hover {
            background: #1a6fd6;
        }
        .info-box {
            background: #f0f8ff;
            padding: 15px;
            border-left: 4px solid #2D8CFF;
            margin: 20px 0;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #666;
            font-size: 12px;
        }
        .success-icon {
            text-align: center;
            font-size: 64px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🎬 PNPtv</div>
        </div>

        <div class="success-icon">✅</div>

        <h1 class="title">¡Bienvenido a PRIME, ${name}!</h1>

        <p>Tu pago ha sido procesado exitosamente. Ahora eres parte de nuestra comunidad exclusiva PRIME.</p>

        <div class="info-box">
            <h3>📋 Detalles de tu Suscripción</h3>
            <p><strong>Plan:</strong> ${planName}</p>
            <p><strong>Monto pagado:</strong> ${amount} ${currency}</p>
            <p><strong>Fecha de inicio:</strong> ${new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p><strong>Próximo pago:</strong> ${nextPaymentDate}</p>
        </div>

        <h3>🔐 Acceso al Canal Exclusivo</h3>
        <p>Usa los siguientes enlaces de un solo uso para acceder a los canales PRIME:</p>

        ${inviteLinksHtml}

        <p style="color: #e74c3c; font-size: 14px;">
            ⚠️ <strong>Importante:</strong> Estos enlaces son de un solo uso y expiran en 7 días. Guárdalos en un lugar seguro.
        </p>

        <div class="info-box">
            <h3>📅 Recordatorios Automáticos</h3>
            <p>Te enviaremos recordatorios:</p>
            <ul>
                <li>3 días antes de tu próximo pago</li>
                <li>1 día antes de tu próximo pago</li>
            </ul>
        </div>

        <h3>🎁 Beneficios de PRIME</h3>
        <ul>
            <li>Acceso a canales exclusivos</li>
            <li>Contenido premium sin publicidad</li>
            <li>Salas Zoom ilimitadas</li>
            <li>Transmisiones en vivo exclusivas</li>
            <li>Soporte prioritario</li>
        </ul>

        <div class="footer">
            <p><strong>PNPtv</strong> - Tu Comunidad Premium</p>
            <p>¿Necesitas ayuda? Contáctanos en <a href="mailto:support@easybots.store">support@easybots.store</a></p>
            <p>© ${new Date().getFullYear()} EasyBots. Todos los derechos reservados.</p>
        </div>
    </div>
</body>
</html>
        `;
    }

    /**
     * Get subscription reminder email template
     * @param {Object} data - Template data
     * @returns {string} HTML template
     */
    getSubscriptionReminderTemplate(data) {
        const { name, planName, expiryDate, daysRemaining, renewUrl } = data;

        const urgencyColor = daysRemaining === 1 ? '#e74c3c' : '#f39c12';
        const urgencyIcon = daysRemaining === 1 ? '🚨' : '⏰';

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo {
            font-size: 32px;
            font-weight: bold;
            color: #2D8CFF;
        }
        .alert-box {
            background: ${urgencyColor};
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            margin: 20px 0;
            font-size: 20px;
            font-weight: bold;
        }
        .button {
            display: inline-block;
            background: #27ae60;
            color: white !important;
            padding: 15px 40px;
            text-decoration: none;
            border-radius: 50px;
            font-weight: bold;
            margin: 20px 0;
            transition: background 0.3s;
        }
        .button:hover {
            background: #229954;
        }
        .info-box {
            background: #f0f8ff;
            padding: 15px;
            border-left: 4px solid #2D8CFF;
            margin: 20px 0;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #666;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🎬 PNPtv</div>
        </div>

        <h1 style="color: ${urgencyColor};">${urgencyIcon} Recordatorio de Suscripción</h1>

        <p>Hola ${name},</p>

        <div class="alert-box">
            Tu suscripción ${planName} expira en ${daysRemaining} ${daysRemaining === 1 ? 'día' : 'días'}
        </div>

        <p>No queremos que pierdas el acceso a todos los beneficios exclusivos de PRIME.</p>

        <div class="info-box">
            <h3>📋 Detalles de tu Suscripción</h3>
            <p><strong>Plan:</strong> ${planName}</p>
            <p><strong>Fecha de expiración:</strong> ${expiryDate}</p>
        </div>

        <div style="text-align: center;">
            <a href="${renewUrl}" class="button">🔄 Renovar Suscripción</a>
        </div>

        <h3>💎 Beneficios que conservarás al renovar:</h3>
        <ul>
            <li>✅ Acceso a canales exclusivos PRIME</li>
            <li>✅ Contenido premium sin publicidad</li>
            <li>✅ Salas Zoom ilimitadas</li>
            <li>✅ Transmisiones en vivo exclusivas</li>
            <li>✅ Soporte prioritario</li>
        </ul>

        <p>Si tu suscripción expira, perderás el acceso a estos beneficios y serás removido de los canales PRIME.</p>

        <div class="footer">
            <p><strong>PNPtv</strong> - Tu Comunidad Premium</p>
            <p>¿Necesitas ayuda? Contáctanos en <a href="mailto:support@easybots.store">support@easybots.store</a></p>
            <p>© ${new Date().getFullYear()} EasyBots. Todos los derechos reservados.</p>
        </div>
    </div>
</body>
</html>
        `;
    }

    /**
     * Get subscription expired email template
     * @param {Object} data - Template data
     * @returns {string} HTML template
     */
    getSubscriptionExpiredTemplate(data) {
        const { name, planName, renewUrl } = data;

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo {
            font-size: 32px;
            font-weight: bold;
            color: #2D8CFF;
        }
        .sad-icon {
            text-align: center;
            font-size: 64px;
            margin: 20px 0;
        }
        .button {
            display: inline-block;
            background: #27ae60;
            color: white !important;
            padding: 15px 40px;
            text-decoration: none;
            border-radius: 50px;
            font-weight: bold;
            margin: 20px 0;
            transition: background 0.3s;
            font-size: 18px;
        }
        .button:hover {
            background: #229954;
        }
        .info-box {
            background: #fff3cd;
            padding: 15px;
            border-left: 4px solid #ffc107;
            margin: 20px 0;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #666;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🎬 PNPtv</div>
        </div>

        <div class="sad-icon">💔</div>

        <h1 style="color: #e74c3c; text-align: center;">Te vamos a extrañar, ${name}</h1>

        <p>Tu suscripción <strong>${planName}</strong> ha expirado y has sido removido de los canales PRIME.</p>

        <p>Extrañamos tenerte en nuestra comunidad premium. Has perdido el acceso a:</p>

        <ul>
            <li>❌ Canales exclusivos PRIME</li>
            <li>❌ Contenido premium sin publicidad</li>
            <li>❌ Salas Zoom ilimitadas</li>
            <li>❌ Transmisiones en vivo exclusivas</li>
            <li>❌ Soporte prioritario</li>
        </ul>

        <div class="info-box">
            <h3>🎁 ¡Vuelve a PRIME!</h3>
            <p>Renueva hoy y recupera todos tus beneficios inmediatamente. Te estamos esperando.</p>
        </div>

        <div style="text-align: center;">
            <a href="${renewUrl}" class="button">💎 Volver a PRIME</a>
        </div>

        <p style="text-align: center; margin-top: 30px;">
            Siempre serás bienvenido de vuelta. La familia PNPtv te extraña.
        </p>

        <div class="footer">
            <p><strong>PNPtv</strong> - Tu Comunidad Premium</p>
            <p>¿Tienes preguntas? Contáctanos en <a href="mailto:support@easybots.store">support@easybots.store</a></p>
            <p>© ${new Date().getFullYear()} EasyBots. Todos los derechos reservados.</p>
        </div>
    </div>
</body>
</html>
        `;
    }

    /**
     * Verify email transporter connection
     * @returns {Promise<boolean>} Connection status
     */
    async verifyConnection() {
        if (!this.transporter) {
            return false;
        }

        try {
            await this.transporter.verify();
            logger.info('Email transporter verified successfully');
            return true;
        } catch (error) {
            logger.error('Email transporter verification failed:', error);
            return false;
        }
    }
}

module.exports = new EmailService();
