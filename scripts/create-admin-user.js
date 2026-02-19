#!/usr/bin/env node

const crypto = require('crypto');
const { query } = require('../src/config/postgres');

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await new Promise((resolve, reject) =>
    crypto.scrypt(password, salt, 64, (err, key) => (err ? reject(err) : resolve(key.toString('hex'))))
  );
  return `${salt}:${hash}`;
}

async function createAdminUser() {
  try {
    const email = 'admin@pnptv.app';
    const password = 'Admin123!@#';
    const username = 'admin';
    const firstName = 'Admin';
    const lastName = 'User';

    // Check if user already exists
    const existing = await query('SELECT id FROM users WHERE email = $1 OR username = $2', [email, username]);
    if (existing.rows.length > 0) {
      console.log('❌ Admin user already exists');
      return;
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create admin user
    const result = await query(
      `INSERT INTO users
       (id, pnptv_id, first_name, last_name, username, email, password_hash,
        role, subscription_status, tier, status, accepted_terms, is_active, created_at, updated_at)
       VALUES
       (gen_random_uuid(), gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, true, true, NOW(), NOW())
       RETURNING id, username, email, role`,
      [firstName, lastName, username, email, passwordHash, 'admin', 'active', 'prime', 'active']
    );

    const user = result.rows[0];
    console.log('✅ Admin user created successfully!');
    console.log('');
    console.log('Login Credentials:');
    console.log(`  Email: ${email}`);
    console.log(`  Password: ${password}`);
    console.log(`  Username: ${username}`);
    console.log('');
    console.log(`User ID: ${user.id}`);
    console.log(`Role: ${user.role}`);
    console.log('');
    console.log('To log in:');
    console.log(`  1. Visit pnptv.app/prime-hub/`);
    console.log(`  2. Click "Sign in with email"`);
    console.log(`  3. Enter: ${email}`);
    console.log(`  4. Enter password: ${password}`);
    console.log(`  5. Admin panel will be visible at /prime-hub/admin`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    process.exit(1);
  }
}

createAdminUser();
