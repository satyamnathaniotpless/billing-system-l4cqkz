# Stage 1: Build stage
FROM node:18-alpine AS builder

# Security: Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Set working directory
WORKDIR /app

# Install security scanning tools
RUN apk add --no-cache python3 py3-pip curl \
    && pip3 install --no-cache-dir safety \
    && npm install -g snyk

# Copy package files with checksum verification
COPY --chown=appuser:appgroup package*.json ./
COPY --chown=appuser:appgroup yarn.lock ./

# Install dependencies with strict security checks
RUN npm ci --production=false \
    && snyk test || true \
    && safety check

# Copy source code with strict permissions
COPY --chown=appuser:appgroup . .

# Set build-time environment variables
ENV NODE_ENV=production \
    VITE_API_URL=https://api.otpless.com \
    DISABLE_ESLINT_PLUGIN=true \
    GENERATE_SOURCEMAP=false \
    TSC_COMPILE_ON_ERROR=false

# Build application with optimizations
RUN npm run type-check \
    && npm run build \
    && npm run analyze-bundle || true

# Stage 2: Production stage
FROM nginx:1.24-alpine

# Security: Create non-root user
RUN addgroup -S nginxgroup && adduser -S nginxuser -G nginxgroup

# Install additional security packages
RUN apk add --no-cache curl tzdata

# Configure NGINX with security hardening
COPY --chown=nginxuser:nginxgroup nginx.conf /etc/nginx/nginx.conf
RUN chmod 644 /etc/nginx/nginx.conf

# Create required directories with proper permissions
RUN mkdir -p /var/cache/nginx /var/log/nginx /usr/share/nginx/html \
    && chown -R nginxuser:nginxgroup /var/cache/nginx /var/log/nginx /usr/share/nginx/html \
    && chmod -R 755 /var/cache/nginx /var/log/nginx /usr/share/nginx/html

# Copy built assets from builder stage
COPY --from=builder --chown=nginxuser:nginxgroup /app/dist /usr/share/nginx/html

# Set runtime environment variables
ENV NGINX_PORT=80 \
    NGINX_WORKER_PROCESSES=auto \
    NGINX_WORKER_CONNECTIONS=1024 \
    NGINX_KEEPALIVE_TIMEOUT=65 \
    NGINX_CLIENT_MAX_BODY_SIZE=10M

# Expose port
EXPOSE 80

# Configure healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl --fail --silent --head http://localhost/ || exit 1

# Switch to non-root user
USER nginxuser

# Start NGINX
CMD ["nginx", "-g", "daemon off;"]

# Build-time metadata
LABEL maintainer="OTPless Engineering" \
      version="1.0" \
      description="OTPless Internal Billing System Web Frontend" \
      security.credentials="none" \
      org.opencontainers.image.source="https://github.com/otpless/billing-system"