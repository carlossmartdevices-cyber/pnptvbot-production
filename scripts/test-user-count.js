#!/usr/bin/env node

require('dotenv').config();
const { query } = require('../src/config/postgres');

async function testUserCount() {
    try {
        console.log('🔍 Testing user database for email campaign...');
        console.log('----------------------------------------');
        
        // Count total users
        const totalUsersQuery = 'SELECT COUNT(*) as total FROM users';
        const totalResult = await query(totalUsersQuery);
        const totalUsers = parseInt(totalResult.rows[0].total);
        
        console.log(`📊 Total users in database: ${totalUsers}`);
        
        // Count users with email addresses
        const emailUsersQuery = `
            SELECT COUNT(*) as email_count 
            FROM users 
            WHERE email IS NOT NULL 
            AND email != ''
        `;
        const emailResult = await query(emailUsersQuery);
        const emailUsers = parseInt(emailResult.rows[0].email_count);
        
        console.log(`📧 Users with email addresses: ${emailUsers}`);
        
        // Count users with verified emails
        const verifiedUsersQuery = `
            SELECT COUNT(*) as verified_count 
            FROM users 
            WHERE email IS NOT NULL 
            AND email != ''
            AND email_verified = true
            AND is_active = true
        `;
        const verifiedResult = await query(verifiedUsersQuery);
        const verifiedUsers = parseInt(verifiedResult.rows[0].verified_count);
        
        console.log(`✅ Users with verified emails (would receive welcome email): ${verifiedUsers}`);
        
        // Show sample users (limit 5)
        const sampleQuery = `
            SELECT id, username, first_name, email, language 
            FROM users 
            WHERE email IS NOT NULL 
            AND email != ''
            AND email_verified = true
            AND is_active = true
            LIMIT 5
        `;
        const sampleResult = await query(sampleQuery);
        
        if (sampleResult.rows.length > 0) {
            console.log(`\n👥 Sample users who would receive emails:`);
            sampleResult.rows.forEach(user => {
                const name = user.username || user.first_name || 'User';
                console.log(`  - ${name}: ${user.email} (${user.language || 'en'})`);
            });
        }
        
        console.log('\n----------------------------------------');
        console.log('📊 SUMMARY:');
        console.log(`  • Total users: ${totalUsers}`);
        console.log(`  • With email addresses: ${emailUsers}`);
        console.log(`  • With verified emails: ${verifiedUsers}`);
        console.log(`  • Would receive welcome email: ${verifiedUsers}`);
        
        if (verifiedUsers > 50) {
            console.log(`\n⚠️  WARNING: This would send ${verifiedUsers} emails!`);
            console.log('📧 Consider testing with a smaller batch first.');
        }
        
    } catch (error) {
        console.error('❌ Error testing user count:', error);
    }
}

// Run the test
testUserCount();