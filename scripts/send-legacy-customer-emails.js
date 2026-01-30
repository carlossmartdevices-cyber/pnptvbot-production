#!/usr/bin/env node

require('dotenv').config();
const EmailService = require('../src/services/emailService');
const logger = require('../src/utils/logger');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');

async function sendLegacyCustomerEmails() {
    try {
        console.log('🚀 Starting legacy customer email campaign');
        console.log('================================================================');

        const csvFilePath = path.join(__dirname, '../Customes_legacy_pending.csv');
        
        // Verify CSV file exists
        if (!fs.existsSync(csvFilePath)) {
            console.error(`❌ CSV file not found: ${csvFilePath}. Exiting.`);
            return;
        }
        console.log(`✅ Found CSV file: ${csvFilePath}`);

        const customers = [];
        const parser = fs
            .createReadStream(csvFilePath)
            .pipe(parse({
                columns: true, // Treat the first row as column names
                skip_empty_lines: true
            }));

        for await (const record of parser) {
            customers.push(record);
        }
        
        // Send to ALL customers
        const testCustomers = customers;

        console.log(`📊 Found ${customers.length} legacy customers in the CSV.`);
        console.log(`📧 Preparing to send emails to ALL customers...`);
        
                if (testCustomers.length === 0) {
                    console.log('❌ No customers found in the CSV. Exiting.');
                    return;
                }
        
                let successCount = 0;
                let failCount = 0;
                const errors = [];
        
                // Define batching parameters
                const batchSize = 10; // Process in batches of 10
                const totalBatches = Math.ceil(testCustomers.length / batchSize);
                const delayMs = 8000; // 8 segundos entre emails para evitar rate limit de Hostinger
        
                console.log(`📧 Preparing to send ${testCustomers.length} emails in ${totalBatches} batches with ${delayMs}ms delay...`);
                console.log('================================================================');
        
                for (let batch = 0; batch < totalBatches; batch++) {
                    const startIdx = batch * batchSize;
                    const endIdx = Math.min(startIdx + batchSize, testCustomers.length);
                    const batchCustomers = testCustomers.slice(startIdx, endIdx);
        
                    console.log(`\n📤 Batch ${batch + 1}/${totalBatches} - Processing customers ${startIdx + 1}-${endIdx}...`);
        
                    for (const customer of batchCustomers) {
                        const email = customer.Email;
                        const name = customer.Name || 'Legacy Customer'; // Use 'Name' column or default
                        const language = customer.language || 'es'; // Get language from CSV, default to 'es'
        
                        if (!email || !EmailService.isEmailSafe(email)) {
                            failCount++;
                            errors.push({ customer: name, email: email, error: 'Invalid or unsafe email address' });
                            console.log(`❌ Skipped invalid/unsafe email: ${email}`);
                            continue;
                        }
        
                        try {
                            const emailPreview = `${email.substring(0, 30)}...`;
                            console.log(`📧 Sending to ${name} (${emailPreview})...`);
                            
                            const result = await EmailService.sendReactivationEmail({
                                email: email,
                                userName: name,
                                lifetimeDealLink: "https://pnptv.app/lifetime100",
                                telegramLink: "https://t.me/pnplatinotv_bot",
                                userLanguage: language // Pass the determined language
                            });
                    if (result.success) {
                        successCount++;
                        console.log(`✅ Success: ${email}`);
                    } else {
                        failCount++;
                        errors.push({ customer: name, email: email, error: result.message || 'Unknown error' });
                        console.log(`❌ Failed: ${email}`);
                    }

                    await new Promise(resolve => setTimeout(resolve, delayMs));

                } catch (error) {
                    failCount++;
                    errors.push({
                        customer: name,
                        email: email,
                        error: error.message
                    });
                    console.log(`❌ Error for ${email}: ${error.message}`);
                }
            }
        }

        console.log('\n================================================================');
        console.log('📊 LEGACY CUSTOMER EMAIL CAMPAIGN SUMMARY');
        console.log('================================================================');
        console.log(`📧 Total customers in CSV: ${customers.length}`);
        console.log(`✅ Successfully sent: ${successCount}`);
        console.log(`❌ Failed/Skipped: ${failCount}`);
        
        if (errors.length > 0) {
            console.log(`\n🔍 Error details (first 10):`);
            errors.slice(0, 10).forEach(error => {
                console.log(`  - ${error.email} (${error.customer}): ${error.error}`);
            });
        }
        
        console.log('\n🎉 Legacy customer email campaign completed!');

    } catch (error) {
        console.error('❌ Fatal error in legacy customer email campaign:', error);
        logger.error('Legacy customer email campaign failed:', error);
    }
}

// Confirmation prompt
if (require.main === module) {
    console.log('🚨 WARNING: This script will send a reactivation email to ALL customers listed in Customes_legacy.csv!');
    console.log('================================================================');
    
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    rl.question('Are you sure you want to send reactivation emails to legacy customers? (yes/no): ', (answer) => {
        if (answer.toLowerCase() === 'yes') {
            rl.close();
            sendLegacyCustomerEmails();
        } else {
            console.log('📝 Legacy customer email campaign cancelled.');
            rl.close();
        }
    });
} else {
    module.exports = { sendLegacyCustomerEmails };
}
