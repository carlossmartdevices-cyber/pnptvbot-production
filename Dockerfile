# Build stage - install all dependencies including dev dependencies
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Production stage - using lean Alpine image for security & size
FROM node:22-alpine AS production

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code from builder
COPY --from=builder --chown=node:node /app/src ./src

# Copy scripts directory for cron jobs
COPY --from=builder --chown=node:node /app/scripts ./scripts

# Copy public directory for landing pages
COPY --from=builder /app/public ./public

# Copy config directory (payment, etc.)
COPY --from=builder --chown=node:node /app/config ./config

# Copy locales (i18n translations)
COPY --from=builder --chown=node:node /app/locales ./locales

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

# Expose port
EXPOSE 3000

# Health check with improved timeout and retries
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => {process.exit(1)})"

# Start the bot directly (no init process needed - Node.js handles signals)
CMD ["node", "src/bot/core/bot.js"]
