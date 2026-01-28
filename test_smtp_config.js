require('dotenv').config();
const EmailService = require('./src/services/emailService');

console.log('Environment variables:');
console.log('SMTP_HOST:', process.env.SMTP_HOST);
console.log('SMTP_USER:', process.env.SMTP_USER);
console.log('SMTP_PASSWORD:', process.env.SMTP_PASSWORD ? '*****' : 'empty');
console.log('SMTP_PORT:', process.env.SMTP_PORT);
console.log('SMTP_SECURE:', process.env.SMTP_SECURE);

console.log('\nTesting SMTP configuration...');

EmailService.verifyConnection().then(verified => {
    console.log('SMTP verified:', verified);
    if (verified) {
        console.log('✅ SMTP connection successful!');
        
        console.log('\nSending welcome email...');
        return EmailService.sendWelcomeEmail({
            email: 'hello@easybots.store',
            userName: 'Test User'
        });
    } else {
        console.log('❌ SMTP verification failed');
        console.log('This could be due to:');
        console.log('- Incorrect SMTP credentials');
        console.log('- Network connectivity issues');
        console.log('- SMTP server not available');
    }
}).then(result => {
    if (result) {
        console.log('✅ Email sent successfully:', result);
    }
}).catch(err => {
    console.error('❌ Error:', err);
});