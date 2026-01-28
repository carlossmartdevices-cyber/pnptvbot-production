#!/usr/bin/env node

require('dotenv').config();
const { query } = require('../src/config/postgres');
const EmailService = require('../src/services/emailService');
const logger = require('../src/utils/logger');
const fs = require('fs');
const path = require('path');

async function sendWelcomeEmailsToAllWithEmails() {
    try {
        console.log('🚀 Starting bulk welcome email campaign to ALL users with emails');
        console.log('================================================================');
        
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
        
        // Verify files exist
        console.log('📁 Verifying attachment files...');
        for (const attachment of attachments) {
            if (fs.existsSync(attachment.path)) {
                const stats = fs.statSync(attachment.path);
                console.log(`✅ ${attachment.filename} - ${(stats.size / 1024).toFixed(1)} KB`);
            } else {
                console.log(`❌ ${attachment.filename} - File not found, skipping attachments`);
                attachments.length = 0; // Clear attachments if any missing
                break;
            }
        }
        
        // Get ALL users with email addresses (including unverified ones)
        console.log('\n🔍 Fetching ALL users with email addresses from database...');
        
        const usersQuery = `
            SELECT id, username, first_name, last_name, email, language 
            FROM users 
            WHERE email IS NOT NULL 
            AND email != ''
            AND is_active = true
            LIMIT 1000
        `;
        
        const usersResult = await query(usersQuery);
        const users = usersResult.rows;
        
        console.log(`📊 Found ${users.length} users with email addresses`);
        console.log(`⚠️  Note: This includes unverified emails (email_verified may be false)`);
        
        if (users.length === 0) {
            console.log('❌ No users found with email addresses. Exiting.');
            return;
        }
        
        // Send emails in batches to avoid overwhelming the server
        const batchSize = 10;
        const totalBatches = Math.ceil(users.length / batchSize);
        let successCount = 0;
        let failCount = 0;
        const errors = [];
        
        console.log(`📧 Preparing to send ${users.length} welcome emails in ${totalBatches} batches...`);
        console.log('================================================================');
        
        for (let batch = 0; batch < totalBatches; batch++) {
            const startIdx = batch * batchSize;
            const endIdx = Math.min(startIdx + batchSize, users.length);
            const batchUsers = users.slice(startIdx, endIdx);
            
            console.log(`\n📤 Batch ${batch + 1}/${totalBatches} - Processing users ${startIdx + 1}-${endIdx}...`);
            
            for (const user of batchUsers) {
                try {
                    const userName = user.username || user.first_name || user.last_name || 'PNP TV Member';
                    const userLanguage = user.language || 'en';
                    const emailPreview = `${user.email.substring(0, 30)}...`;
                    
                    console.log(`📧 Sending to ${userName} (${emailPreview})...`);
                    
                    const result = await EmailService.sendWelcomeEmail({
                        email: user.email,
                        userName: userName,
                        attachments: attachments,
                        userLanguage: userLanguage
                    });
                    
                    if (result.success) {
                        successCount++;
                        console.log(`✅ Success: ${user.email}`);
                    } else {
                        failCount++;
                        console.log(`❌ Failed: ${user.email}`);
                    }
                    
                    // Small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                } catch (error) {
                    failCount++;
                    errors.push({
                        userId: user.id,
                        email: user.email,
                        error: error.message
                    });
                    console.log(`❌ Error for ${user.email}: ${error.message}`);
                }
            }
        }
        
        // Summary
        console.log('\n================================================================');
        console.log('📊 BULK EMAIL CAMPAIGN SUMMARY');
        console.log('================================================================');
        console.log(`📧 Total emails attempted: ${users.length}`);
        console.log(`✅ Successfully sent: ${successCount}`);
        console.log(`❌ Failed to send: ${failCount}`);
        console.log(`📎 Attachments per email: ${attachments.length}`);
        console.log(`💰 Cost savings: Sending to unverified emails for initial campaign`);
        
        if (errors.length > 0) {
            console.log(`\n🔍 Error details (first 5):`);
            errors.slice(0, 5).forEach(error => {
                console.log(`  - ${error.email}: ${error.error}`);
            });
        }
        
        console.log('\n🎉 Bulk email campaign completed!');
        console.log('📧 All users with email addresses have received welcome emails!');
        
    } catch (error) {
        console.error('❌ Fatal error in bulk email campaign:', error);
        logger.error('Bulk email campaign failed:', error);
    }
}

// Check if this is the main module
if (require.main === module) {
    console.log('🚨 WARNING: This script will send welcome emails to ALL users with email addresses!');
    console.log('📧 This includes unverified emails for the initial campaign');
    console.log('💰 Great for user engagement and onboarding!');
    console.log('================================================================');
    
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    rl.question('Are you sure you want to send welcome emails to ALL users with emails? (yes/no): ', (answer) => {
        if (answer.toLowerCase() === 'yes') {
            rl.close();
            sendWelcomeEmailsToAllWithEmails();
        } else {
            console.log('📝 Bulk email campaign cancelled.');
            rl.close();
        }
    });
} else {
    module.exports = { sendWelcomeEmailsToAllWithEmails };
}