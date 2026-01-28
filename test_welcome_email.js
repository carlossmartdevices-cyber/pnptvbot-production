const EmailService = require('./src/services/emailService');

async function testWelcomeEmail() {
    try {
        console.log('Testing welcome email...');
        
        const result = await EmailService.sendWelcomeEmail({
            email: 'hello@easybots.store',
            userName: 'Test User'
        });
        
        console.log('Email test result:', result);
        
        if (result.success) {
            console.log('✅ Welcome email sent successfully!');
            if (result.mode === 'logged') {
                console.log('📝 Email was logged (no SMTP configured)');
            } else {
                console.log('📧 Email was actually sent via SMTP');
            }
        } else {
            console.log('❌ Failed to send welcome email');
        }
        
    } catch (error) {
        console.error('Error testing welcome email:', error);
    }
}

// Run the test
testWelcomeEmail();