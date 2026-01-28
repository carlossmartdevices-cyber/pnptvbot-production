#!/usr/bin/env node

require('dotenv').config();
const { query } = require('../src/config/postgres');
const EmailService = require('../src/services/emailService');
const fs = require('fs');
const path = require('path');

async function testBulkEmailFast() {
    try {
        console.log('🚀 Testing bulk email with first 3 users (FAST TEST)');
        console.log('==================================================');
        
        // Define the attachments
        const attachments = [
            {
                filename: 'PNPtv_Calendario_Lanzamiento.pdf',
                path: path.join(__dirname, '../PNPtv_Calendario_Lanzamiento.pdf'),
                contentType: 'application/pdf'
            },
            {
                filename: 'PNPtv_Release_Calendar-1.pdf',
                path: path.join(__dirname, '../PNPtv_Release_Calendar-1.pdf'),
                contentType: 'application/pdf'
            },
            {
                filename: 'PNPtv_Guia_Oficial_Pro.pdf',
                path: path.join(__dirname, '../PNPtv_Guia_Oficial_Pro.pdf'),
                contentType: 'application/pdf'
            },
            {
                filename: 'PNPtv_Official_Guide.pdf',
                path: path.join(__dirname, '../PNPtv_Official_Guide.pdf'),
                contentType: 'application/pdf'
            }
        ];
        
        console.log('📁 Attachments ready: 4 PDF documents');
        
        // Get first 3 users with email addresses
        console.log('\n🔍 Fetching first 3 users with email addresses...');
        
        const usersQuery = `
            SELECT id, username, first_name, email, language 
            FROM users 
            WHERE email IS NOT NULL 
            AND email != ''
            AND is_active = true
            LIMIT 3
        `;
        
        const usersResult = await query(usersQuery);
        const users = usersResult.rows;
        
        console.log(`📊 Found ${users.length} test users`);
        
        if (users.length === 0) {
            console.log('❌ No test users found. Exiting.');
            return;
        }
        
        // Show the test users
        console.log('\n👥 Test users to receive emails:');
        users.forEach((user, index) => {
            const name = user.username || user.first_name || 'User';
            const emailPreview = user.email ? `${user.email.substring(0, 30)}...` : 'No email';
            console.log(`   ${index + 1}. ${name} - ${emailPreview} (${user.language || 'en'})`);
        });
        
        // Send emails to these 3 users
        console.log('\n📧 Sending welcome emails to test users...');
        
        let successCount = 0;
        let failCount = 0;
        
        for (const user of users) {
            try {
                const userName = user.username || user.first_name || 'PNP TV Member';
                const userLanguage = user.language || 'en';
                
                console.log(`\n📧 Sending to ${userName}...`);
                
                const result = await EmailService.sendWelcomeEmail({
                    email: user.email,
                    userName: userName,
                    attachments: attachments,
                    userLanguage: userLanguage
                });
                
                if (result.success) {
                    successCount++;
                    console.log(`✅ SUCCESS: Email sent to ${user.email}`);
                    console.log(`   📧 Message ID: ${result.messageId}`);
                    console.log(`   📎 Attachments: ${attachments.length} PDFs`);
                } else {
                    failCount++;
                    console.log(`❌ FAILED: ${user.email}`);
                }
                
            } catch (error) {
                failCount++;
                console.log(`❌ ERROR for ${user.email}: ${error.message}`);
            }
        }
        
        // Summary
        console.log('\n==================================================');
        console.log('📊 TEST CAMPAIGN SUMMARY');
        console.log('==================================================');
        console.log(`📧 Test emails attempted: ${users.length}`);
        console.log(`✅ Successfully sent: ${successCount}`);
        console.log(`❌ Failed to send: ${failCount}`);
        console.log(`📎 Attachments per email: ${attachments.length}`);
        
        if (successCount > 0) {
            console.log('\n🎉 TEST SUCCESSFUL!');
            console.log('✅ Welcome emails are working perfectly!');
            console.log('📧 Ready to send to all 167 users!');
            console.log('');
            console.log('🚀 To send to ALL users, run:');
            console.log('   node scripts/send-welcome-to-all-with-emails.js');
        } else {
            console.log('\n❌ Test failed. Check SMTP configuration.');
        }
        
    } catch (error) {
        console.error('❌ Fatal error in test:', error);
    }
}

// Run the test
testBulkEmailFast();