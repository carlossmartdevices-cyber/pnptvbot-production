/**
 * PM2 Ecosystem Configuration for Multi-App Server
 * 
 * This configuration ensures proper isolation between applications
 * sharing Redis and PostgreSQL on the same server.
 */

module.exports = {
  apps: [
    {
      // PNPtv Telegram Bot
      name: 'pnptv-bot',
      script: './src/bot/core/bot.js',
      instances: 1,
      exec_mode: 'fork',
      
      // Auto-restart configuration
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      
      // Environment variables for pnptv-bot
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        
        // Redis configuration - Use DB 0 for pnptv-bot
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6380,
        REDIS_PASSWORD: '',
        REDIS_DB: 0,  // Database 0 for pnptv-bot
        REDIS_KEY_PREFIX: 'pnptv:',  // Prefix all keys with "pnptv:"
        
        // PostgreSQL configuration - Dedicated database
        POSTGRES_HOST: 'localhost',
        POSTGRES_PORT: 55432,
        POSTGRES_DATABASE: 'pnptvbot',
        POSTGRES_USER: 'pnptvbot',
        POSTGRES_PASSWORD: 'pnptvbot_secure_pass_2025',
        POSTGRES_SSL: 'false',
        POSTGRES_POOL_MIN: 2,
        POSTGRES_POOL_MAX: 20,
      },
      
      // Logging
      error_file: '/root/.pm2/logs/pnptv-bot-error.log',
      out_file: '/root/.pm2/logs/pnptv-bot-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      
      // Kill timeout
      kill_timeout: 5000,
    },
    
    {
      // Social Hub Application
      name: 'social-hub',
      script: './dist/index.js',
      cwd: '/root/hub_social_media_js',
      instances: 1,
      exec_mode: 'fork',
      
      // Auto-restart configuration
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      
      // Environment variables for social-hub
      env: {
        NODE_ENV: 'production',
        PORT: 3001,  // Puerto diferente
        
        // Redis configuration - Use DB 1 for social-hub
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        REDIS_PASSWORD: '',
        REDIS_DB: 1,  // Database 1 for social-hub (DIFERENTE)
        REDIS_KEY_PREFIX: 'social:',  // Prefix all keys with "social:"
        
        // PostgreSQL configuration - Dedicated database
        POSTGRES_HOST: 'localhost',
        POSTGRES_PORT: 55432,
        POSTGRES_DATABASE: 'socialhub',  // Base de datos diferente
        POSTGRES_USER: 'socialhub',
        POSTGRES_PASSWORD: 'socialhub_secure_pass_2025',
        POSTGRES_SSL: 'false',
        POSTGRES_POOL_MIN: 2,
        POSTGRES_POOL_MAX: 20,
      },
      
      // Logging
      error_file: '/root/.pm2/logs/social-hub-error.log',
      out_file: '/root/.pm2/logs/social-hub-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      
      // Kill timeout
      kill_timeout: 5000,
    },
  ],
};
