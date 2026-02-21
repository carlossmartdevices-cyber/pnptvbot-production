# Build stage - install all dependencies including dev dependencies
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm install

# Copy source code
COPY . .

# Production stage - using lean Alpine image for security & size
FROM node:22-alpine AS production

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm install --only=production && npm cache clean --force

# Copy apps directory (monorepo structure with backend, webapps, etc)
COPY --from=builder --chown=node:node /app/apps ./apps

# Copy packages directory (ui-kit, shared modules, etc)
COPY --from=builder --chown=node:node /app/packages ./packages

# Copy scripts directory (cron jobs and utilities)
COPY --from=builder --chown=node:node /app/scripts ./scripts

# Copy config directory (payment config, JaaS keys, etc)
COPY --from=builder --chown=node:node /app/config ./config

# Copy public directory for landing pages
COPY --from=builder --chown=node:node /app/public ./public

# Copy .env.example for dotenv-safe validation
COPY --from=builder --chown=node:node /app/.env.example ./.env.example

# Create logs and uploads directories with proper permissions
RUN mkdir -p logs uploads \
    && chown -R node:node /app \
    && chmod -R 755 /app/public \
    && chmod -R 755 logs uploads \
    && find /app/public -type f -exec chmod 644 {} \;

# Switch to non-root user for security
USER node

# Expose port (must match PORT env var, default 3001)
EXPOSE 3001

# Health check with improved timeout and retries
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "const p=process.env.PORT||3001;require('http').get('http://localhost:'+p+'/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => {process.exit(1)})"

# Start the bot directly (no init process needed - Node.js handles signals)
CMD ["node", "apps/backend/bot/core/bot.js"]
