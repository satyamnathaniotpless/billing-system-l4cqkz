# Stage 1: Build TypeScript code
FROM node:18-alpine AS builder

# Add labels for maintainability
LABEL maintainer="OTPless Engineering <engineering@otpless.com>" \
      com.otpless.service="event-processor" \
      com.otpless.version="${BUILD_VERSION}" \
      org.opencontainers.image.source="https://github.com/otpless/billing-system" \
      org.opencontainers.image.description="Event Processor service for OTPless billing system"

# Create non-root user/group
RUN addgroup -S eventprocessor && \
    adduser -S -G eventprocessor eventprocessor

# Set working directory
WORKDIR /app

# Copy package files with correct ownership
COPY --chown=eventprocessor:eventprocessor package*.json ./

# Install dependencies including dev dependencies for build
RUN npm ci && \
    # Verify packages
    npm audit

# Copy source code and configs
COPY --chown=eventprocessor:eventprocessor tsconfig.json ./
COPY --chown=eventprocessor:eventprocessor src/ ./src/

# Set proper permissions
RUN chmod -R 644 /app && \
    find /app -type d -exec chmod 755 {} \;

# Build TypeScript code
RUN npm run build && \
    # Remove dev dependencies
    npm prune --production

# Stage 2: Production runtime
FROM node:18-alpine

# Add labels
LABEL maintainer="OTPless Engineering <engineering@otpless.com>" \
      com.otpless.service="event-processor" \
      com.otpless.version="${BUILD_VERSION}" \
      org.opencontainers.image.source="https://github.com/otpless/billing-system" \
      org.opencontainers.image.description="Event Processor service for OTPless billing system"

# Create non-root user/group
RUN addgroup -S eventprocessor && \
    adduser -S -G eventprocessor eventprocessor

# Set working directory
WORKDIR /app

# Copy package files
COPY --chown=eventprocessor:eventprocessor package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application from builder stage
COPY --chown=eventprocessor:eventprocessor --from=builder /app/dist ./dist

# Set production environment
ENV NODE_ENV=production \
    PORT=3000 \
    NODE_OPTIONS="--max-old-space-size=3072"

# Set proper permissions for production
RUN chmod -R 644 /app && \
    find /app -type d -exec chmod 755 {} \;

# Expose application port
EXPOSE 3000

# Switch to non-root user
USER eventprocessor

# Health check configuration
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the application with proper flags for production
CMD ["node", "--enable-source-maps", "--trace-warnings", "--unhandled-rejections=strict", "dist/app.js"]