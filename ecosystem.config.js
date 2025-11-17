module.exports = {
  apps: [
    {
      name: 'pnptv-bot',
      script: './src/bot/core/bot.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      // Auto restart on crash
      max_memory_restart: '500M',

      // Restart configuration
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s',

      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 3000,

      // Logging
      output: './logs/out.log',
      error: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Watch & Restart on file changes (set to false in production)
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'uploads', '.git'],

      // Environment variables from .env file
      env_file: '.env'
    }
  ]
};
