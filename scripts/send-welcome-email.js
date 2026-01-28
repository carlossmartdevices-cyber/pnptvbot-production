#!/usr/bin/env node

const EmailService = require('../src/services/emailService');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function sendWelcomeEmail() {
    try {
        rl.question('Enter recipient email address: ', async (email) => {
            rl.question('Enter recipient name (optional, press enter for default): ', async (userName) => {
                
                if (!email) {
                    console.log('❌ Email address is required');
                    rl.close();
                    return;
                }
                
                // Validate email format
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    console.log('❌ Invalid email format');
                    rl.close();
                    return;
                }
                
                console.log(`📧 Sending welcome email to: ${email}`);
                
                const result = await EmailService.sendWelcomeEmail({
                    email: email,
                    userName: userName || 'New User'
                });
                
                if (result.success) {
                    console.log('✅ Welcome email sent successfully!');
                    if (result.mode === 'logged') {
                        console.log('📝 Email was logged (no SMTP configured)');
                        console.log('📧 To actually send emails, configure SMTP in your environment');
                    } else {
                        console.log('📧 Email was actually sent via SMTP');
                    }
                } else {
                    console.log('❌ Failed to send welcome email');
                }
                
                rl.close();
            });
        });
        
    } catch (error) {
        console.error('Error sending welcome email:', error);
        rl.close();
    }
}

console.log('🎉 PNP TV Welcome Email Sender');
console.log('--------------------------------');
console.log('This script sends a welcome email to new users');
console.log('');

sendWelcomeEmail();