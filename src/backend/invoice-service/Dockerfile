# Build stage
FROM python:3.11-slim AS builder

# Set build arguments and environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create and set working directory
WORKDIR /build

# Copy requirements file
COPY requirements.txt .

# Create virtual environment and install dependencies
RUN python -m venv /opt/venv && \
    /opt/venv/bin/pip install --no-cache-dir -U pip setuptools wheel && \
    /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

# Final stage
FROM python:3.11-slim

# Set labels
LABEL org.opencontainers.image.source="https://github.com/otpless/billing" \
      org.opencontainers.image.description="OTPless Invoice Service" \
      org.opencontainers.image.licenses="Proprietary" \
      com.otpless.image.version="1.0.0" \
      com.otpless.image.maintainer="DevOps Team" \
      com.otpless.image.cpu.limit="1" \
      com.otpless.image.memory.limit="2Gi"

# Set environment variables
ENV PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    WORKERS=4 \
    PATH="/opt/venv/bin:$PATH"

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/* && \
    groupadd -r appgroup && \
    useradd -r -g appgroup -s /sbin/nologin -d /app appuser

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv

# Set up application directory
WORKDIR /app

# Copy application code
COPY --chown=appuser:appgroup ./src /app/src

# Set permissions
RUN chown -R appuser:appgroup /app && \
    chmod -R 755 /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl --fail http://localhost:8000/health || exit 1

# Resource limits
RUN echo "ulimit -n 65535" >> ~/.bashrc && \
    echo "ulimit -u 2048" >> ~/.bashrc

# Start command
CMD ["gunicorn", \
     "--config", "src/gunicorn_conf.py", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "4", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "src.main:app"]