#!/usr/bin/env node

require('dotenv').config();
const { query } = require('../src/config/postgres');
const EmailService = require('../src/services/emailService');
const fs = require('fs');
const path = require('path');

async function sendWelcomeToActiveSubscribers() {
    try {
        console.log('🚀 Starting welcome email campaign to ACTIVE subscribers');
        console.log('==========================================================');

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
        let hasAllAttachments = true;
        for (const attachment of attachments) {
            if (fs.existsSync(attachment.path)) {
                const stats = fs.statSync(attachment.path);
                console.log(`✅ ${attachment.filename} - ${(stats.size / 1024).toFixed(1)} KB`);
            } else {
                console.log(`❌ ${attachment.filename} - File not found`);
                hasAllAttachments = false;
            }
        }

        const finalAttachments = hasAllAttachments ? attachments : [];
        if (!hasAllAttachments) {
            console.log('⚠️  Some attachments missing - sending emails without attachments');
        }

        // Get ACTIVE subscribers with email addresses
        console.log('\n🔍 Fetching active subscribers with email addresses...');

        const usersQuery = `
            SELECT id, username, first_name, last_name, email, language, plan_id
            FROM users
            WHERE email IS NOT NULL
            AND email != ''
            AND is_active = true
            AND subscription_status = 'active'
            ORDER BY created_at DESC
        `;

        const usersResult = await query(usersQuery);
        const users = usersResult.rows;

        console.log(`📊 Found ${users.length} active subscribers with email addresses`);

        if (users.length === 0) {
            console.log('❌ No active subscribers found with email addresses. Exiting.');
            return;
        }

        // Show preview
        console.log('\n📋 Preview of recipients:');
        users.slice(0, 10).forEach((user, i) => {
            console.log(`   ${i + 1}. ${user.email} (${user.first_name || 'N/A'}) - ${user.plan_id || 'N/A'}`);
        });
        if (users.length > 10) {
            console.log(`   ... and ${users.length - 10} more`);
        }

        // Send emails in batches
        const batchSize = 5;
        const delayBetweenEmails = 2000; // 2 seconds
        const delayBetweenBatches = 10000; // 10 seconds

        let successCount = 0;
        let failCount = 0;
        const errors = [];

        console.log(`\n📧 Sending emails (batch size: ${batchSize}, delay: ${delayBetweenEmails}ms)...`);
        console.log('');

        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            const isSpanish = user.language === 'es';

            try {
                const result = await EmailService.sendWelcomeEmail({
                    email: user.email,
                    userName: user.first_name || 'Member',
                    userLanguage: isSpanish ? 'es' : 'en',
                    attachments: finalAttachments.length > 0 ? finalAttachments : []
                });

                if (result.success) {
                    successCount++;
                    console.log(`✅ [${i + 1}/${users.length}] ${user.email}`);
                } else {
                    failCount++;
                    errors.push({ email: user.email, error: result.error });
                    console.log(`❌ [${i + 1}/${users.length}] ${user.email} - ${result.error}`);
                }
            } catch (error) {
                failCount++;
                errors.push({ email: user.email, error: error.message });
                console.log(`❌ [${i + 1}/${users.length}] ${user.email} - ${error.message}`);
            }

            // Delay between emails
            if (i < users.length - 1) {
                await new Promise(resolve => setTimeout(resolve, delayBetweenEmails));
            }

            // Longer delay between batches
            if ((i + 1) % batchSize === 0 && i < users.length - 1) {
                console.log(`\n⏳ Batch complete. Waiting ${delayBetweenBatches / 1000}s before next batch...\n`);
                await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
            }
        }

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 CAMPAIGN SUMMARY');
        console.log('='.repeat(60));
        console.log(`✅ Successful: ${successCount}`);
        console.log(`❌ Failed: ${failCount}`);
        console.log(`📧 Total: ${users.length}`);
        console.log(`📎 Attachments: ${finalAttachments.length > 0 ? 'Yes' : 'No'}`);

        if (errors.length > 0) {
            console.log('\n❌ Errors:');
            errors.forEach(e => console.log(`   - ${e.email}: ${e.error}`));
        }

        console.log('\n✅ Campaign completed!');

    } catch (error) {
        console.error('❌ Campaign failed:', error.message);
        process.exit(1);
    }
}

// Run the campaign
sendWelcomeToActiveSubscribers()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
