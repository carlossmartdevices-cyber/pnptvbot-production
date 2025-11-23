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
            from = this.from
        } = options;

        try {
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
        // Use sanitize-html to remove all tags and attributes
        return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
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
