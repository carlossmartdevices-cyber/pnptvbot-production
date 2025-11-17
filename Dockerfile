# Build stage - install all dependencies including dev dependencies
FROM node:18-slim AS builder

# Set working directory
WORKDIR /app

# Install build dependencies for native modules with aggressive retry logic
RUN apt-get update && \
    (apt-get install -y --no-install-recommends python3 make g++ || \
     (sleep 5 && apt-get update && apt-get install -y --no-install-recommends python3 make g++) || \
     (sleep 10 && apt-get update && apt-get install -y --no-install-recommends python3 make g++) || \
     (sleep 15 && apt-get update && apt-get install -y --no-install-recommends python3 make g++)) && \
    rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Production stage - minimal runtime image
FROM node:18-slim AS production

# Set working directory
WORKDIR /app

# Install runtime dependencies for native modules with aggressive retry logic
RUN apt-get update && \
    (apt-get install -y --no-install-recommends tini || \
     (sleep 5 && apt-get update && apt-get install -y --no-install-recommends tini) || \
     (sleep 10 && apt-get update && apt-get install -y --no-install-recommends tini) || \
     (sleep 15 && apt-get update && apt-get install -y --no-install-recommends tini)) && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd -g 1001 -r nodejs && \
    useradd -r -g nodejs -u 1001 nodejs

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code from builder
COPY --from=builder --chown=nodejs:nodejs /app/src ./src

# Copy public directory for landing pages
COPY --from=builder /app/public ./public

# Copy .env.example for dotenv-safe validation
COPY --from=builder --chown=nodejs:nodejs /app/.env.example ./.env.example

# Create logs and uploads directories with proper permissions
# Fix ownership and permissions for all files
RUN mkdir -p logs uploads \
    && chown -R nodejs:nodejs /app \
    && chmod -R 755 /app/public \
    && find /app/public -type f -exec chmod 644 {} \; \
    && ls -la /app/public

# Switch to non-root user for security
USER nodejs

# Expose port
EXPOSE 3000

# Health check with improved timeout and retries
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => {process.exit(1)})"

# Use tini to handle signals properly
ENTRYPOINT ["/usr/bin/tini", "--"]

# Start the bot
CMD ["node", "src/bot/core/bot.js"]
