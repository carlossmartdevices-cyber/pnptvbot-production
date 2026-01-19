// path: backend/src/modules/auth/telegramVerify.ts
import crypto from 'crypto';

/**
 * Verifies Telegram authentication data
 * Based on: https://core.telegram.org/widgets/login#checking-authorization
 */
export function verifyTelegramAuth(authData: {
  id: string;
  username?: string;
  first_name?: string;
  photo_url?: string;
  auth_date: string;
  hash: string;
}): boolean {
  const { id, username, first_name, photo_url, auth_date, hash } = authData;
  
  // Get bot token from environment
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set');
  }
  
  // Create data check string
  const dataCheckString = Object.keys(authData)
    .filter(key => key !== 'hash')
    .sort()
    .map(key => {
      const value = authData[key as keyof typeof authData];
      return `${key}=${value}`;
    })
    .join('\n');
  
  // Create secret key
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();
  
  // Calculate hash
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');
  
  // Compare hashes
  return calculatedHash === hash;
}

/**
 * Validates that auth_date is not too old (max 5 minutes)
 */
export function isAuthDateValid(authDate: string): boolean {
  const authTimestamp = Number(authDate) * 1000; // Convert to milliseconds
  const now = Date.now();
  const fiveMinutesInMs = 5 * 60 * 1000;
  
  return now - authTimestamp <= fiveMinutesInMs;
}