#!/usr/bin/env bash

# OTPless Internal Billing System - Database Setup Script
# Version: 1.0
# PostgreSQL Version: 15
# Description: Initializes and configures the PostgreSQL database with proper security and monitoring

set -euo pipefail
IFS=$'\n\t'

# Environment variables with defaults
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-otpless_billing}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD}"
SSL_CERT_PATH="${SSL_CERT_PATH:-/etc/ssl/certs/postgres.crt}"
LOG_PATH="${LOG_PATH:-/var/log/otpless/db-setup.log}"

# Constants
RETRY_ATTEMPTS=3
RETRY_DELAY=5
REQUIRED_PSQL_VERSION="15.0"

# Setup logging
setup_logging() {
    local log_dir=$(dirname "$LOG_PATH")
    mkdir -p "$log_dir"
    exec 1> >(tee -a "$LOG_PATH")
    exec 2> >(tee -a "$LOG_PATH" >&2)
    chmod 640 "$LOG_PATH"
}

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S %Z')] $*"
}

error() {
    log "ERROR: $*" >&2
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."

    # Check PostgreSQL client version
    if ! command -v psql >/dev/null; then
        error "PostgreSQL client not found"
        return 1
    }

    local psql_version=$(psql --version | awk '{print $3}')
    if [[ "$(printf '%s\n' "$REQUIRED_PSQL_VERSION" "$psql_version" | sort -V | head -n1)" != "$REQUIRED_PSQL_VERSION" ]]; then
        error "PostgreSQL client version $REQUIRED_PSQL_VERSION or higher required"
        return 1
    }

    # Check required environment variables
    if [[ -z "${DB_PASSWORD}" ]]; then
        error "DB_PASSWORD environment variable must be set"
        return 1
    }

    # Verify SSL certificate
    if [[ ! -f "$SSL_CERT_PATH" ]]; then
        error "SSL certificate not found at $SSL_CERT_PATH"
        return 1
    }

    # Test database connectivity
    if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" >/dev/null 2>&1; then
        error "Unable to connect to database server"
        return 1
    }

    return 0
}

# Create database with proper settings
create_database() {
    log "Creating database if not exists..."

    local psql_opts="--host=$DB_HOST --port=$DB_PORT --username=$DB_USER"
    local psql_conn_opts="$psql_opts sslmode=verify-full sslcert=$SSL_CERT_PATH"

    # Create database if not exists
    if ! psql $psql_conn_opts -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
        psql $psql_conn_opts -v ON_ERROR_STOP=1 <<EOF
CREATE DATABASE $DB_NAME
    WITH 
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.UTF-8'
    LC_CTYPE = 'en_US.UTF-8'
    TEMPLATE = template0;

-- Configure database settings
ALTER DATABASE $DB_NAME SET timezone TO 'UTC';
ALTER DATABASE $DB_NAME SET statement_timeout TO '30s';
ALTER DATABASE $DB_NAME SET idle_in_transaction_session_timeout TO '60s';
ALTER DATABASE $DB_NAME SET log_statement TO 'mod';
ALTER DATABASE $DB_NAME SET log_min_duration_statement TO 1000;
EOF
    fi

    return 0
}

# Setup required extensions
setup_extensions() {
    log "Setting up required extensions..."

    local psql_opts="--host=$DB_HOST --port=$DB_PORT --username=$DB_USER --dbname=$DB_NAME"
    local psql_conn_opts="$psql_opts sslmode=verify-full sslcert=$SSL_CERT_PATH"

    psql $psql_conn_opts -v ON_ERROR_STOP=1 <<EOF
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "timescaledb";

-- Verify extensions
DO \$\$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname IN ('uuid-ossp', 'pgcrypto', 'timescaledb')
    ) THEN
        RAISE EXCEPTION 'Required extensions not installed properly';
    END IF;
END
\$\$;
EOF

    return 0
}

# Apply database migrations
apply_migrations() {
    log "Applying database migrations..."

    local psql_opts="--host=$DB_HOST --port=$DB_PORT --username=$DB_USER --dbname=$DB_NAME"
    local psql_conn_opts="$psql_opts sslmode=verify-full sslcert=$SSL_CERT_PATH"

    # Create migrations tracking table
    psql $psql_conn_opts -v ON_ERROR_STOP=1 <<EOF
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
EOF

    # Apply migrations in transaction
    psql $psql_conn_opts -v ON_ERROR_STOP=1 <<EOF
BEGIN;

-- Track migration
INSERT INTO schema_migrations (version) VALUES ('000001_init_schema')
ON CONFLICT DO NOTHING;

-- Apply initial schema
\i '../migrations/000001_init_schema.up.sql'

-- Track migration
INSERT INTO schema_migrations (version) VALUES ('000002_add_wallet_tables')
ON CONFLICT DO NOTHING;

-- Apply wallet tables
\i '../migrations/000002_add_wallet_tables.up.sql'

-- Verify critical tables exist
DO \$\$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name IN ('customers', 'accounts', 'wallets', 'wallet_transactions')
    ) THEN
        RAISE EXCEPTION 'Critical tables not created properly';
    END IF;
END
\$\$;

COMMIT;
EOF

    return 0
}

# Main execution
main() {
    local exit_code=0

    setup_logging
    log "Starting database setup for OTPless Internal Billing System..."

    # Execute setup steps with error handling
    if ! check_prerequisites; then
        error "Prerequisites check failed"
        exit_code=1
    elif ! create_database; then
        error "Database creation failed"
        exit_code=1
    elif ! setup_extensions; then
        error "Extension setup failed"
        exit_code=1
    elif ! apply_migrations; then
        error "Migration application failed"
        exit_code=1
    else
        log "Database setup completed successfully"
    fi

    # Final status check
    if [[ $exit_code -eq 0 ]]; then
        log "Database is ready for use"
    else
        error "Database setup failed with errors"
    fi

    return $exit_code
}

# Execute main function
main "$@"