require('dotenv').config();
const EmailService = require('./src/services/emailService');
const fs = require('fs');
const path = require('path');

async function testWelcomeEmailWithAttachments() {
    try {
        console.log('📧 Testing welcome email with attachments...');
        
        // Define the attachments
        const attachments = [
            {
                filename: 'PNPtv_Calendario_Lanzamiento.pdf',
                path: path.join(__dirname, 'PNPtv_Calendario_Lanzamiento.pdf'),
                contentType: 'application/pdf'
            },
            {
                filename: 'PNPtv_Release_Calendar-1.pdf',
                path: path.join(__dirname, 'PNPtv_Release_Calendar-1.pdf'),
                contentType: 'application/pdf'
            },
            {
                filename: 'PNPtv_Guia_Oficial_Pro.pdf',
                path: path.join(__dirname, 'PNPtv_Guia_Oficial_Pro.pdf'),
                contentType: 'application/pdf'
            },
            {
                filename: 'PNPtv_Official_Guide.pdf',
                path: path.join(__dirname, 'PNPtv_Official_Guide.pdf'),
                contentType: 'application/pdf'
            }
        ];
        
        // Verify files exist
        console.log('📁 Verifying attachment files...');
        for (const attachment of attachments) {
            if (fs.existsSync(attachment.path)) {
                const stats = fs.statSync(attachment.path);
                console.log(`✅ ${attachment.filename} - ${(stats.size / 1024).toFixed(1)} KB`);
            } else {
                console.log(`❌ ${attachment.filename} - File not found`);
                return;
            }
        }
        
        console.log('\n🎉 Sending welcome email with attachments...');
        
        const result = await EmailService.sendWelcomeEmail({
            email: 'hello@easybots.store',
            userName: 'Test User',
            attachments: attachments,
            userLanguage: 'en'
        });
        
        console.log('\n📬 Email sent result:', result);
        
        if (result.success) {
            console.log('\n✅ Welcome email with attachments sent successfully!');
            console.log(`📎 Attachments included: ${attachments.length} PDF documents`);
            console.log(`📧 Message ID: ${result.messageId}`);
            console.log(`🌐 Mode: ${result.mode}`);
            
            if (result.mode === 'sent') {
                console.log('\n🎯 The email has been actually sent via SMTP!');
                console.log('📬 Check the recipient\'s inbox for the welcome email with attachments.');
            } else {
                console.log('\n📝 Email was logged (SMTP not configured)');
            }
        } else {
            console.log('\n❌ Failed to send welcome email with attachments');
        }
        
    } catch (error) {
        console.error('\n❌ Error sending welcome email with attachments:', error);
    }
}

// Run the test
testWelcomeEmailWithAttachments();