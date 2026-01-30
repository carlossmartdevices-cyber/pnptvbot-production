# Build stage - install all dependencies including dev dependencies
FROM node:18 AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Production stage - using full Node.js image (all build tools pre-installed)
FROM node:18 AS production

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code from builder
COPY --from=builder /app/src ./src

# Copy scripts directory for cron jobs
COPY --from=builder /app/scripts ./scripts

# Copy public directory for landing pages
COPY --from=builder /app/public ./public

# Copy .env.example for dotenv-safe validation
COPY --from=builder /app/.env.example ./.env.example

# Copy config directory
COPY --from=builder /app/config ./config

# Create logs and uploads directories
RUN mkdir -p logs uploads

# Expose port
EXPOSE 3000

# Health check with improved timeout and retries
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => {process.exit(1)})"

# Start the bot directly (no init process needed - Node.js handles signals)
CMD ["node", "src/bot/core/bot.js"]
