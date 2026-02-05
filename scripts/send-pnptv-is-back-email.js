#!/usr/bin/env node

require('dotenv').config();
const EmailService = require('../src/services/emailService');
const logger = require('../src/utils/logger');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

async function sendPnpTvIsBackEmails() {
    try {
        console.log(`🚀 Starting "PNP Latino TV Is Back" email campaign to legacy clients from CSV`);
        console.log(`================================================================================`);

        const csvFilePath = path.join(__dirname, '../Customes_legacy_pending.csv');
        console.log(`🔍 Reading legacy client data from: ${csvFilePath}`);

        if (!fs.existsSync(csvFilePath)) {
            console.error(`❌ Error: CSV file not found at ${csvFilePath}. Exiting.`);
            return;
        }

        const fileContent = fs.readFileSync(csvFilePath, 'utf8');
        const lines = fileContent.split('\n').filter(line => line.trim() !== ''); // Filter out empty lines

        if (lines.length <= 1) { // Only header or empty file
            console.log(`📊 No legacy clients found in CSV. Exiting.`);
            return;
        }

        const users = [];
        const header = lines[0].split(','); // Assuming comma-separated values

        // Find index of 'Email' and 'Name' columns
        const emailIndex = header.indexOf('Email');
        const nameIndex = header.indexOf('Name');

        if (emailIndex === -1 || nameIndex === -1) {
            console.error(`❌ Error: CSV header must contain 'Email' and 'Name' columns. Found: ${header.join(', ')}. Exiting.`);
            return;
        }

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            if (values.length > emailIndex && values.length > nameIndex) {
                const email = values[emailIndex].trim();
                const name = values[nameIndex].trim();
                if (email) {
                    users.push({ email, name });
                }
            }
        }

        console.log(`📊 Found ${users.length} legacy clients with email addresses in CSV.`);

        if (users.length === 0) {
            console.log(`❌ No users with valid email addresses found in CSV. Exiting.`);
            return;
        }

        // Send emails in batches to avoid overwhelming the server
        const batchSize = 10;
        const totalBatches = Math.ceil(users.length / batchSize);
        let successCount = 0;
        let failCount = 0;
        const errors = [];

        console.log(`📧 Preparing to send ${users.length} "PNP Latino TV Is Back" emails in ${totalBatches} batches...`);
        console.log(`================================================================================`);

        for (let batch = 0; batch < totalBatches; batch++) {
            const startIdx = batch * batchSize;
            const endIdx = Math.min(startIdx + batchSize, users.length);
            const batchUsers = users.slice(startIdx, endIdx);

            console.log(`
📤 Batch ${batch + 1}/${totalBatches} - Processing users ${startIdx + 1}-${endIdx}...`);

            for (const user of batchUsers) {
                try {
                    const userName = user.name || 'PNP TV Member';
                    const userLanguage = 'es'; // Assuming legacy clients are primarily Spanish-speaking or default to Spanish for PNP Latino
                    const emailPreview = `${user.email.substring(0, 30)}...`;

                    console.log(`📧 Sending to ${userName} (${emailPreview})...`);

                    const result = await EmailService.sendReactivationEmail({
                        email: user.email,
                        userName: userName,
                        userLanguage: userLanguage,
                        // lifetimeDealLink and telegramLink can be customized here if needed,
                        // otherwise, the template will use its defaults.
                    });

                    if (result.success) {
                        successCount++;
                        console.log(`✅ Success: ${user.email}`);
                    } else {
                        failCount++;
                        console.log(`❌ Failed: ${user.email} (No success flag)`);
                    }

                    // Small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 500));

                } catch (error) {
                    failCount++;
                    errors.push({
                        email: user.email,
                        error: error.message
                    });
                    console.log(`❌ Error for ${user.email}: ${error.message}`);
                }
            }
        }

        // Summary
        console.log(`
================================================================`);
        console.log(`📊 "PNP Latino TV Is Back" EMAIL CAMPAIGN SUMMARY`);
        console.log(`================================================================`);
        console.log(`📧 Total emails attempted: ${users.length}`);
        console.log(`✅ Successfully sent: ${successCount}`);
        console.log(`❌ Failed to send: ${failCount}`);

        if (errors.length > 0) {
            console.log(`
🔍 Error details (first 5):`);
            errors.slice(0, 5).forEach(error => {
                console.log(`  - ${error.email}: ${error.error}`);
            });
        }

        console.log(`
🎉 "PNP Latino TV Is Back" email campaign completed!`);

    } catch (error) {
        console.error(`❌ Fatal error in "PNP Latino TV Is Back" email campaign: ${error.message}`);
        logger.error(`"PNP Latino TV Is Back" email campaign failed: ${error.message}`);
    }
}

// Main execution block with confirmation prompt
if (require.main === module) {
    console.log(`🚨 WARNING: This script will send "PNP Latino TV Is Back" emails to legacy clients from Customes_legacy.csv!`);
    console.log(`================================================================================`);
    
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    rl.question('Are you sure you want to send "PNP Latino TV Is Back" emails to legacy clients from Customes_legacy.csv? (yes/no): ', (answer) => {
        if (answer.toLowerCase() === 'yes') {
            rl.close();
            sendPnpTvIsBackEmails();
        } else {
            console.log('📝 "PNP Latino TV Is Back" email campaign cancelled.');
            rl.close();
        }
    });
} else {
    module.exports = { sendPnpTvIsBackEmails };
}
