# GitHub MCP Server Dockerfile
# Multi-stage build for optimized production image

# Stage 1: Build stage
FROM node:24-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci --silent

# Copy source code
COPY . .

# Build TypeScript to JavaScript
RUN npm run build

# Stage 2: Production stage
FROM node:24-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcp -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production --silent && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/build ./build

# Copy any additional runtime files (if needed)
COPY --from=builder /app/README.md ./
COPY --from=builder /app/CLAUDE.md ./

# Change ownership to non-root user
RUN chown -R mcp:nodejs /app
USER mcp

# Expose port (adjust if your app uses a different port)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "process.exit(0)" || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["npm", "start"]