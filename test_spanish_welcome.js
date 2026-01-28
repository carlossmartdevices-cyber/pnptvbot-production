require('dotenv').config();
const EmailService = require('./src/services/emailService');
const fs = require('fs');
const path = require('path');

async function testSpanishWelcomeEmail() {
    try {
        console.log('📧 Testing Spanish welcome email with attachments...');
        
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
            }
        ];
        
        console.log('\n🎉 Sending Spanish welcome email...');
        
        const result = await EmailService.sendWelcomeEmail({
            email: 'hello@easybots.store',
            userName: 'Usuario de Prueba',
            attachments: attachments,
            userLanguage: 'es'
        });
        
        console.log('\n📬 Email sent result:', result);
        
        if (result.success) {
            console.log('\n✅ Spanish welcome email sent successfully!');
            console.log(`📎 Attachments included: ${attachments.length} PDF documents`);
            console.log(`📧 Message ID: ${result.messageId}`);
            console.log(`🌐 Mode: ${result.mode}`);
            console.log(`🇪🇸 Language: Spanish`);
            
            if (result.mode === 'sent') {
                console.log('\n🎯 ¡El correo ha sido enviado correctamente!');
                console.log('📬 Revisa la bandeja de entrada del destinatario.');
            }
        } else {
            console.log('\n❌ Failed to send Spanish welcome email');
        }
        
    } catch (error) {
        console.error('\n❌ Error sending Spanish welcome email:', error);
    }
}

// Run the test
testSpanishWelcomeEmail();