# Build stage
FROM golang:1.20-alpine AS builder

# Version: golang:1.20-alpine

# Install build dependencies
RUN apk add --no-cache \
    git \
    ca-certificates \
    tzdata \
    make \
    build-base

# Set working directory
WORKDIR /app

# Copy go mod files for dependency caching
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download && \
    go mod verify

# Copy source code
COPY . .

# Build-time variables
ARG VERSION=dev
ARG BUILD_DATE=unknown

# Set build flags for optimization and security
ENV CGO_ENABLED=0 \
    GOOS=linux \
    GOARCH=amd64 \
    GO111MODULE=on

# Build the binary with optimizations and security flags
RUN go build -ldflags="-s -w \
    -X main.version=${VERSION} \
    -X main.buildTime=${BUILD_DATE} \
    -extldflags '-static'" \
    -o /app/wallet-service ./cmd/server

# Final stage
FROM alpine:3.18

# Version: alpine:3.18

# Install runtime dependencies
RUN apk add --no-cache \
    ca-certificates \
    tzdata \
    && rm -rf /var/cache/apk/*

# Create non-root user and group
RUN addgroup -S wallet && \
    adduser -S -G wallet wallet

# Set working directory
WORKDIR /app

# Copy binary and required files from builder
COPY --from=builder /app/wallet-service .
COPY --from=builder /app/config ./config

# Set ownership and permissions
RUN chown -R wallet:wallet /app && \
    chmod 550 /app/wallet-service

# Switch to non-root user
USER wallet:wallet

# Configure environment variables
ENV PORT=8080 \
    METRICS_PORT=9090 \
    GIN_MODE=release

# Expose ports
EXPOSE ${PORT} ${METRICS_PORT}

# Health check configuration
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

# Container metadata and labels
LABEL org.opencontainers.image.source="https://github.com/otpless/billing" \
    org.opencontainers.image.version="${VERSION}" \
    org.opencontainers.image.created="${BUILD_DATE}" \
    com.otpless.service.name="wallet-service" \
    com.otpless.service.type="backend"

# Resource limits (aligned with Technical Specifications/8.3.1)
ENV GOMEMLIMIT=2147483648 # 2Gi memory limit
ENV GOMAXPROCS=1 # 1 CPU limit

# Security options
ENV GODEBUG=netdns=go # Use Go's built-in DNS resolver
ENV GOGC=80 # Conservative GC target

# Start the service
ENTRYPOINT ["/app/wallet-service"]