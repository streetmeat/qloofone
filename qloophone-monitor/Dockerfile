FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files from the monitor directory
COPY qloophone-monitor/package*.json ./

# Install dependencies
RUN npm ci

# Copy application files from the monitor directory
COPY qloophone-monitor/ ./

# Build the Next.js application
RUN npm run build

# Production stage
FROM node:18-alpine AS runner

WORKDIR /app

# Copy package files from the monitor directory
COPY qloophone-monitor/package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built application from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./

# Expose port
EXPOSE 3001

# Start the application
CMD ["npm", "start"]