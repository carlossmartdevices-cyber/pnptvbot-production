# Build stage - install all dependencies including dev dependencies
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Production stage - minimal runtime image
FROM node:18-alpine AS production

# Set working directory
WORKDIR /app

# Install runtime dependencies for native modules
RUN apk add --no-cache \
    tini \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code from builder
COPY --from=builder --chown=nodejs:nodejs /app/src ./src
COPY --from=builder --chown=nodejs:nodejs /app/config ./config
COPY --from=builder --chown=nodejs:nodejs /app/public ./public
COPY --from=builder --chown=nodejs:nodejs /app/views ./views

# Create logs and uploads directories with proper permissions
RUN mkdir -p logs uploads \
    && chown -R nodejs:nodejs /app

# Switch to non-root user for security
USER nodejs

# Expose port
EXPOSE 3000

# Health check with improved timeout and retries
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => {process.exit(1)})"

# Use tini to handle signals properly
ENTRYPOINT ["/sbin/tini", "--"]

# Start the bot
CMD ["node", "src/bot/core/bot.js"]
