const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const sanitizeHtml = require('sanitize-html');

/**
 * Email Service
 * Handles all email operations including magic link authentication
 */
class EmailService {
    constructor() {
        this.transporter = null;
        this.initialized = false;
    }

    /**
     * Get the from address (lazy loaded to ensure env is ready)
     */
    get from() {
        return process.env.EMAIL_FROM || 'noreply@pnptv.app';
    }

    /**
     * Ensure transporter is initialized (lazy initialization)
     */
    ensureInitialized() {
        if (this.initialized) return;
        this.initialized = true;
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
     * Validate email address to prevent nodemailer parsing vulnerabilities
     * Rejects quoted local-parts that could cause misrouting (CVE-style attack)
     * @param {string} email - Email address to validate
     * @returns {boolean} True if safe, false if potentially malicious
     */
    isEmailSafe(email) {
        if (!email || typeof email !== 'string') {
            return false;
        }

        // Reject emails with quoted local-parts containing @ (parsing vulnerability)
        // Pattern: "anything@something"@domain
        if (/^"[^"]*@[^"]*"@/.test(email)) {
            return false;
        }

        // Basic email format validation
        const basicEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return basicEmailRegex.test(email);
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
            from = this.from,
            attachments = []
        } = options;

        try {
            // Ensure transporter is initialized (lazy init for env loading)
            this.ensureInitialized();

            // Validate email address to prevent misrouting attacks
            if (!this.isEmailSafe(to)) {
                logger.error('Invalid or potentially malicious email address rejected:', { to });
                throw new Error('Invalid email address format');
            }
            // If no transporter, log email instead
            if (!this.transporter) {
                logger.info('Email would be sent (no transporter configured):', {
                    to,
                    subject,
                    from,
                    attachments: attachments.length
                });
                return { success: true, messageId: 'logged', mode: 'logging' };
            }

            const mailOptions = {
                from,
                to,
                subject,
                html,
                text: text || this.stripHtml(html),
                attachments: attachments
            };

            const info = await this.transporter.sendMail(mailOptions);
            logger.info('Email sent successfully:', {
                to,
                subject,
                messageId: info.messageId,
                attachments: attachments.length
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

        const magicLinkUrl = `https://pnptv.app/zoom/auth/${token}`;

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

        const joinUrl = `https://pnptv.app/zoom/join/${roomCode}`;

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
     * Send welcome email to new user
     * @param {Object} data - Welcome email data
     * @returns {Promise<Object>} Send result
     */
    async sendWelcomeEmail(data) {
        const {
            email,
            userName = 'New User',
            attachments = [],
            userLanguage = 'en'
        } = data;

        const html = this.getWelcomeEmailTemplate({
            userName,
            language: userLanguage
        });

        return await this.send({
            to: email,
            subject: userLanguage === 'es' ? '🎉 ¡Bienvenido a PNP TV Bot!' : '🎉 Welcome to PNP TV Bot!',
            html,
            attachments: attachments
        });
    }

    /**
     * Send broadcast email to user
     * @param {Object} data - Broadcast data
     * @returns {Promise<Object>} Send result
     */
    async sendBroadcastEmail(data) {
        const {
            email,
            userName = 'PNP Latino Member',
            messageEn,
            messageEs,
            userLanguage = 'en',
            mediaUrl = null,
            buttons = []
        } = data;

        const message = userLanguage === 'es' ? messageEs : messageEn;
        const html = this.getBroadcastEmailTemplate({
            userName,
            message,
            mediaUrl,
            buttons,
            language: userLanguage
        });

        return await this.send({
            to: email,
            subject: 'PNP Latino Update! Noticias de PNP Latino',
            html
        });
    }

    /**
     * Send broadcast emails to multiple users
     * @param {Array} users - Array of user objects with email
     * @param {Object} broadcastData - Broadcast content
     * @returns {Promise<Object>} Results summary
     */
    async sendBroadcastEmails(users, broadcastData) {
        const { messageEn, messageEs, mediaUrl, buttons } = broadcastData;

        let sent = 0;
        let failed = 0;
        const errors = [];

        for (const user of users) {
            if (!user.email || !this.isEmailSafe(user.email)) {
                continue; // Skip users without valid email
            }

            try {
                await this.sendBroadcastEmail({
                    email: user.email,
                    userName: user.first_name || user.username || 'PNP Latino Member',
                    messageEn,
                    messageEs,
                    userLanguage: user.language || 'en',
                    mediaUrl,
                    buttons
                });
                sent++;

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                failed++;
                errors.push({ email: user.email, error: error.message });
            }
        }

        return { sent, failed, errors };
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
            <code>https://pnptv.app/zoom/join/${roomCode}</code><br>
            <small>Guests can join without any authentication!</small>
        </div>

        <div class="footer">
            <p><strong>PNP.tv</strong> - Premium Zoom Meetings</p>
            <p>This link expires in 24 hours for security.</p>
            <p>Need help? Contact support at <a href="mailto:support@pnptv.app">support@pnptv.app</a></p>
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
     * Get broadcast email template
     * @param {Object} data - Template data
     * @returns {string} HTML template
     */
    getBroadcastEmailTemplate(data) {
        const { userName, message, mediaUrl, buttons, language } = data;

        const isSpanish = language === 'es';
        const greeting = isSpanish ? `¡Hola ${userName}!` : `Hey ${userName}!`;
        const footerText = isSpanish
            ? 'Recibiste este correo porque eres miembro de PNP Latino TV.'
            : 'You received this email because you are a member of PNP Latino TV.';
        const unsubText = isSpanish
            ? 'Para dejar de recibir estos correos, actualiza tus preferencias en el bot.'
            : 'To stop receiving these emails, update your preferences in the bot.';

        // Build button HTML
        let buttonsHtml = '';
        if (buttons && buttons.length > 0) {
            const buttonItems = buttons.map(btn => {
                const buttonObj = typeof btn === 'string' ? JSON.parse(btn) : btn;
                if (buttonObj.type === 'url' && buttonObj.target) {
                    return `<a href="${buttonObj.target}" class="button">${buttonObj.text}</a>`;
                }
                return '';
            }).filter(b => b).join('\n');

            if (buttonItems) {
                buttonsHtml = `<div style="text-align: center; margin: 25px 0;">${buttonItems}</div>`;
            }
        }

        // Media HTML
        const mediaHtml = mediaUrl
            ? `<div style="text-align: center; margin: 20px 0;"><img src="${mediaUrl}" alt="PNP Latino" style="max-width: 100%; border-radius: 10px;"></div>`
            : '';

        // Convert message line breaks to HTML
        const formattedMessage = message
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');

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
            background-color: #1a1a2e;
        }
        .container {
            background: linear-gradient(135deg, #16213e 0%, #1a1a2e 100%);
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            color: #ffffff;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .logo {
            font-size: 28px;
            font-weight: bold;
            background: linear-gradient(90deg, #e94560, #ff6b6b);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .greeting {
            font-size: 22px;
            margin-bottom: 20px;
            color: #ff6b6b;
        }
        .content {
            font-size: 16px;
            line-height: 1.8;
            color: #e0e0e0;
        }
        .button {
            display: inline-block;
            background: linear-gradient(90deg, #e94560, #ff6b6b);
            color: white !important;
            padding: 14px 35px;
            text-decoration: none;
            border-radius: 50px;
            font-weight: bold;
            margin: 10px 5px;
            transition: transform 0.3s, box-shadow 0.3s;
        }
        .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(233, 69, 96, 0.4);
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid rgba(255,255,255,0.1);
            color: #888;
            font-size: 12px;
        }
        .social-links {
            margin: 15px 0;
        }
        .social-links a {
            color: #e94560;
            text-decoration: none;
            margin: 0 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🔥 PNP Latino TV</div>
        </div>

        <h1 class="greeting">${greeting}</h1>

        ${mediaHtml}

        <div class="content">
            ${formattedMessage}
        </div>

        ${buttonsHtml}

        <div style="text-align: center; margin-top: 30px;">
            <a href="https://t.me/pnplatinotv_bot" class="button">💬 Open Bot</a>
        </div>

        <div class="footer">
            <div class="social-links">
                <a href="https://t.me/pnplatinotv_bot">Telegram</a>
            </div>
            <p>${footerText}</p>
            <p>${unsubText}</p>
            <p>© ${new Date().getFullYear()} PNP Latino TV. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
        `;
    }

    /**
     * Get welcome email template
     * @param {Object} data - Template data
     * @returns {string} HTML template
     */
    getWelcomeEmailTemplate(data) {
        const { userName, language = 'en' } = data;
        const isSpanish = language === 'es';

        const welcomeTitle = isSpanish ? '¡Bienvenido a PNP TV Bot!' : 'Welcome to PNP TV Bot!';
        const greeting = isSpanish ? `Estimado ${userName},` : `Dear ${userName},`;
        const welcomeMessage = isSpanish 
            ? '¡Estamos encantados de darle la bienvenida a la comunidad de PNP TV! Nuestro bot y canal de Telegram están diseñados para brindarle una experiencia emocionante y atractiva.'
            : 'We\'re thrilled to welcome you to the PNP TV community! Our Telegram bot and channel are designed to provide you with an exciting and engaging experience.';
        
        const whatIsPNP = isSpanish ? '¿Qué es PNP TV?' : 'What is PNP TV?';
        const communityDesc = isSpanish 
            ? 'PNP TV es una comunidad vibrante donde puedes:'
            : 'PNP TV is a vibrant community where you can:';
        
        const communityBenefits = isSpanish ? [
            'Conectar con personas afines',
            'Disfrutar de contenido exclusivo y transmisiones en vivo',
            'Participar en eventos interactivos',
            'Acceder a funciones premium a través de nuestro bot'
        ] : [
            'Connect with like-minded individuals',
            'Enjoy exclusive content and live streams',
            'Participate in interactive events',
            'Access premium features through our bot'
        ];
        
        const botFeaturesDesc = isSpanish 
            ? 'Nuestro bot mejora tu experiencia proporcionando:'
            : 'Our bot enhances your experience by providing:';
        
        const botFeatures = isSpanish ? [
            'Notificaciones personalizadas',
            'Acceso fácil a contenido exclusivo',
            'Características y juegos interactivos',
            'Comunicación segura y privada'
        ] : [
            'Personalized notifications',
            'Easy access to exclusive content',
            'Interactive features and games',
            'Secure and private communication'
        ];
        
        const getStarted = isSpanish 
            ? 'Para comenzar y obtener más información sobre lo que ofrecemos, visite nuestra página de inicio:'
            : 'To get started and learn more about what we offer, visit our landing page:';
        
        const buttonText = isSpanish ? 'Visitar Página de Inicio de PNP TV' : 'Visit PNP TV Landing Page';
        
        const excitedMessage = isSpanish 
            ? '¡Estamos emocionados de que te unas a nuestra comunidad y esperamos brindarte una experiencia increíble!'
            : 'We\'re excited to have you join our community and look forward to providing you with an amazing experience!';
        
        const regards = isSpanish ? 'Atentamente,' : 'Best regards,';
        const teamName = isSpanish ? 'El Equipo de PNP TV' : 'The PNP TV Team';
        
        const footerText = isSpanish 
            ? 'Si tiene alguna pregunta, no dude en ponerse en contacto con nuestro equipo de soporte.'
            : 'If you have any questions, please don\'t hesitate to contact our support team.';

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${welcomeTitle}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background-color: #4a148c;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px 5px 0 0;
        }
        .content {
            padding: 20px;
            background-color: #f9f9f9;
            border-radius: 0 0 5px 5px;
        }
        .button {
            display: inline-block;
            background-color: #4a148c;
            color: white;
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
        }
        .attachment-note {
            background-color: #e8f5e9;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            text-align: center;
            font-style: italic;
        }
        .hot-content-banner {
            background: linear-gradient(45deg, #ff1744, #f50057);
            color: white;
            padding: 15px;
            border-radius: 8px;
            margin: 15px 0;
            text-align: center;
            font-weight: bold;
            font-size: 18px;
            box-shadow: 0 4px 8px rgba(244, 67, 54, 0.3);
            border: 2px solid #ffebee;
        }
        .hot-content-text {
            color: #ffeb3b;
            font-style: italic;
            margin-top: 8px;
        }
        .footer {
            margin-top: 20px;
            font-size: 12px;
            color: #777;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${welcomeTitle}</h1>
    </div>
    <div class="content">
        <p>${greeting}</p>
        <p>${welcomeMessage}</p>
        
        <div class="hot-content-banner">
            🔥 HOT PNP ADULT CONTENT 🔥
            <div class="hot-content-text">
                ${isSpanish 
                    ? '¡El corazón de nuestra comunidad es el contenido adulto PNP caliente creado por Santino y Lex!' 
                    : 'The core of our community is the HOT PNP adult content created by Santino and Lex!'}
            </div>
            <div style="margin-top: 8px; font-size: 14px;">
                🎬 Clouds & Slamming - 100% REAL 🎬
            </div>
        </div>
        
        <h2>${whatIsPNP}</h2>
        <p>${communityDesc}</p>
        <ul>
            ${communityBenefits.map(benefit => `<li>${benefit}</li>`).join('')}
        </ul>
        
        <p>${botFeaturesDesc}</p>
        <ul>
            ${botFeatures.map(feature => `<li>${feature}</li>`).join('')}
        </ul>
        
        <div class="attachment-note">
            ${isSpanish 
                ? '📎 ¡Hemos incluido algunos documentos útiles como archivos adjuntos para ayudarle a comenzar!' 
                : '📎 We\'ve included some helpful documents as attachments to get you started!'}
        </div>
        
        <p>${getStarted}</p>
        
        <div style="text-align: center;">
            <a href="https://pnptv.app/landing.html" class="button">${buttonText}</a>
        </div>
        
        <p>${excitedMessage}</p>
        
        <p>${regards}<br>
        ${teamName}</p>
    </div>
    <div class="footer">
        <p>© ${new Date().getFullYear()} PNP TV. All rights reserved.</p>
        <p>${footerText}</p>
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
        // Use sanitize-html to remove all tags and attributes
        return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
    }

    /**
     * Verify email transporter connection
     * @returns {Promise<boolean>} Connection status
     */
    async verifyConnection() {
        this.ensureInitialized();
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
