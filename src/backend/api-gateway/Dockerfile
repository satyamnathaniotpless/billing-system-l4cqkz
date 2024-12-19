# Stage 1: Build NGINX with required modules
FROM nginx:1.20-alpine AS nginx-builder

# Install build dependencies
RUN apk add --no-cache \
    gcc \
    libc-dev \
    make \
    openssl-dev \
    pcre-dev \
    zlib-dev \
    linux-headers \
    curl \
    gnupg \
    libxslt-dev \
    gd-dev \
    geoip-dev

# Install additional security modules
RUN curl -fSL https://github.com/SpiderLabs/ModSecurity/archive/v3.0.5.tar.gz | tar xz && \
    curl -fSL https://github.com/openresty/headers-more-nginx-module/archive/v0.34.tar.gz | tar xz

# Stage 2: Build Kong
FROM kong:3.0-alpine AS kong-builder

# Install Kong plugins
RUN luarocks install kong-plugin-jwt && \
    luarocks install kong-prometheus-plugin && \
    luarocks install kong-plugin-rate-limiting

# Stage 3: Final image
FROM nginx:1.20-alpine

# Set build arguments
ARG NGINX_VERSION=1.20-alpine
ARG KONG_VERSION=3.0-alpine

# Set environment variables
ENV NGINX_WORKER_PROCESSES=auto \
    NGINX_WORKER_CONNECTIONS=65535 \
    KONG_DATABASE=off \
    KONG_PROXY_ACCESS_LOG=/dev/stdout \
    KONG_ADMIN_ACCESS_LOG=/dev/stdout \
    KONG_PROXY_ERROR_LOG=/dev/stderr \
    KONG_ADMIN_ERROR_LOG=/dev/stderr

# Install runtime dependencies
RUN apk add --no-cache \
    curl \
    tzdata \
    pcre \
    lua5.1-dev \
    luarocks \
    openssl \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# Create nginx user/group with specific IDs
RUN addgroup -g 101 -S nginx && \
    adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx

# Create required directories with proper permissions
RUN mkdir -p /var/cache/nginx /var/log/nginx /etc/nginx/ssl /etc/nginx/conf.d && \
    chown -R nginx:nginx /var/cache/nginx /var/log/nginx /etc/nginx/ssl && \
    chmod 755 /var/cache/nginx /var/log/nginx /etc/nginx/ssl

# Copy configuration files
COPY --chown=nginx:nginx nginx.conf /etc/nginx/nginx.conf
COPY --chown=nginx:nginx security-headers.conf /etc/nginx/security-headers.conf
COPY --chown=nginx:nginx rate-limiting.conf /etc/nginx/rate-limiting.conf
COPY --chown=nginx:nginx kong.yml /usr/local/kong/kong.yml

# Copy Kong plugins and configurations from builder
COPY --from=kong-builder /usr/local/kong /usr/local/kong
COPY --from=kong-builder /usr/local/lib/lua /usr/local/lib/lua

# Set proper permissions for configuration files
RUN chmod 644 /etc/nginx/nginx.conf \
    /etc/nginx/security-headers.conf \
    /etc/nginx/rate-limiting.conf \
    /usr/local/kong/kong.yml

# Create health check script
RUN echo '#!/bin/sh' > /usr/local/bin/health-check.sh && \
    echo 'curl -sf http://localhost/health || exit 1' >> /usr/local/bin/health-check.sh && \
    chmod +x /usr/local/bin/health-check.sh

# Expose ports
EXPOSE 80 443 8001

# Set working directory
WORKDIR /etc/nginx

# Switch to non-root user
USER nginx

# Health check configuration
HEALTHCHECK --interval=5s --timeout=3s --start-period=5s --retries=3 \
    CMD ["sh", "/usr/local/bin/health-check.sh"]

# Start NGINX with Kong
CMD ["nginx", "-g", "daemon off;"]