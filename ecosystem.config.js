module.exports = {
  apps: [{
    name: 'pnptv-bot',
    script: './src/bot/core/bot.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: '3005',
    },
    env_development: {
      NODE_ENV: 'development',
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
    kill_timeout: 5000,
    wait_ready: false,
    listen_timeout: 10000,
    ignore_watch: ['node_modules', 'logs'],
  }],
};
