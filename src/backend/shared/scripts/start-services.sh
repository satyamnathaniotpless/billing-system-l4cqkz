#!/usr/bin/env bash

# OTPless Internal Billing System - Service Orchestration Script
# Version: 1.0.0
# Description: Orchestrates startup of all required services with enhanced error recovery and monitoring

# Enable strict error handling
set -euo pipefail
IFS=$'\n\t'

# Import required scripts
SCRIPT_DIR=$(dirname "${BASH_SOURCE[0]}")
source "${SCRIPT_DIR}/setup-db.sh"
source "${SCRIPT_DIR}/init-kafka.sh"

# Global configurations
COMPOSE_FILE="${SCRIPT_DIR}/../../docker-compose.yml"
TIMEOUT=300
LOG_FILE="/var/log/otpless-billing/startup.log"
MAX_RETRIES=3
RETRY_DELAY=5
HEALTH_CHECK_INTERVAL=10

# Setup logging with timestamps and log rotation
setup_logging() {
    local log_dir=$(dirname "$LOG_FILE")
    mkdir -p "$log_dir"
    exec 1> >(tee -a "$LOG_FILE")
    exec 2> >(tee -a "$LOG_FILE" >&2)
    
    # Rotate logs if size exceeds 100MB
    if [[ -f "$LOG_FILE" && $(stat -f%z "$LOG_FILE") -gt 104857600 ]]; then
        mv "$LOG_FILE" "$LOG_FILE.$(date +%Y%m%d-%H%M%S)"
        gzip "$LOG_FILE".* &
    fi
}

# Enhanced logging function with severity levels
log() {
    local level=$1
    shift
    echo "[$(date +'%Y-%m-%d %H:%M:%S %Z')] [$level] $*"
}

# Check environment prerequisites
check_environment() {
    log "INFO" "Checking environment prerequisites..."

    # Verify Docker installation and version
    if ! command -v docker >/dev/null 2>&1; then
        log "ERROR" "Docker is not installed"
        return 1
    fi

    # Verify docker-compose installation
    if ! command -v docker-compose >/dev/null 2>&1; then
        log "ERROR" "docker-compose is not installed"
        return 1
    fi

    # Verify compose file exists
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        log "ERROR" "Docker compose file not found at $COMPOSE_FILE"
        return 1
    fi

    # Check required environment variables
    local required_vars=("DB_HOST" "DB_PORT" "DB_NAME" "DB_USER" "DB_PASSWORD" 
                        "KAFKA_BOOTSTRAP_SERVERS" "SSL_CERT_PATH")
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log "ERROR" "Required environment variable $var is not set"
            return 1
        fi
    done

    # Check available disk space
    local available_space=$(df -P / | awk 'NR==2 {print $4}')
    if [[ $available_space -lt 5242880 ]]; then  # 5GB in KB
        log "ERROR" "Insufficient disk space available"
        return 1
    }

    return 0
}

# Start core infrastructure services
start_infrastructure() {
    log "INFO" "Starting infrastructure services..."

    # Pull latest images
    docker-compose -f "$COMPOSE_FILE" pull || {
        log "ERROR" "Failed to pull Docker images"
        return 1
    }

    # Start infrastructure services
    docker-compose -f "$COMPOSE_FILE" up -d postgres redis kafka zookeeper || {
        log "ERROR" "Failed to start infrastructure services"
        return 1
    }

    # Wait for infrastructure services to be healthy
    local services=("postgres:5432" "redis:6379" "kafka:9092")
    for service in "${services[@]}"; do
        local host=${service%:*}
        local port=${service#*:}
        
        log "INFO" "Waiting for $host to be ready..."
        timeout "$TIMEOUT" bash -c "until nc -z $host $port; do sleep 1; done" || {
            log "ERROR" "Service $host failed to start within timeout"
            return 1
        }
    done

    return 0
}

# Initialize databases with retry logic
initialize_databases() {
    log "INFO" "Initializing databases..."
    
    local retry_count=0
    while [[ $retry_count -lt $MAX_RETRIES ]]; do
        if check_prerequisites && create_database; then
            log "INFO" "Database initialization successful"
            return 0
        fi
        
        ((retry_count++))
        log "WARN" "Database initialization failed, attempt $retry_count of $MAX_RETRIES"
        sleep "$RETRY_DELAY"
    done

    log "ERROR" "Failed to initialize databases after $MAX_RETRIES attempts"
    return 1
}

# Setup Kafka infrastructure
setup_kafka() {
    log "INFO" "Setting up Kafka infrastructure..."

    # Initialize Kafka with monitoring
    if ! verify_prerequisites; then
        log "ERROR" "Kafka prerequisites check failed"
        return 1
    fi

    # Create and configure topics
    if ! create_topics; then
        log "ERROR" "Failed to create Kafka topics"
        return 1
    }

    # Configure security and monitoring
    configure_security
    setup_monitoring

    # Verify Kafka setup
    if ! verify_setup; then
        log "ERROR" "Kafka setup verification failed"
        return 1
    }

    return 0
}

# Start application services
start_services() {
    log "INFO" "Starting application services..."

    # Start services in dependency order
    local services=(
        "event-processor"
        "billing-service"
        "invoice-service"
        "wallet-service"
        "api-gateway"
    )

    for service in "${services[@]}"; do
        log "INFO" "Starting $service..."
        
        docker-compose -f "$COMPOSE_FILE" up -d "$service" || {
            log "ERROR" "Failed to start $service"
            return 1
        }

        # Wait for service health check
        local retry_count=0
        while [[ $retry_count -lt $MAX_RETRIES ]]; do
            if docker-compose -f "$COMPOSE_FILE" exec "$service" wget --spider http://localhost:8080/health; then
                log "INFO" "$service is healthy"
                break
            fi
            
            ((retry_count++))
            log "WARN" "$service health check failed, attempt $retry_count of $MAX_RETRIES"
            sleep "$HEALTH_CHECK_INTERVAL"
        done

        if [[ $retry_count -eq $MAX_RETRIES ]]; then
            log "ERROR" "$service failed health check after $MAX_RETRIES attempts"
            return 1
        fi
    done

    return 0
}

# Verify system health
verify_system() {
    log "INFO" "Verifying system health..."

    # Check service health endpoints
    local endpoints=(
        "http://localhost:8080/health"  # API Gateway
        "http://localhost:8081/health"  # Event Processor
        "http://localhost:8082/health"  # Billing Service
        "http://localhost:8083/health"  # Invoice Service
        "http://localhost:8084/health"  # Wallet Service
    )

    for endpoint in "${endpoints[@]}"; do
        if ! curl -sf "$endpoint" >/dev/null 2>&1; then
            log "ERROR" "Health check failed for $endpoint"
            return 1
        fi
    done

    # Verify Kafka topics
    if ! kafka-topics.sh --bootstrap-server "$KAFKA_BOOTSTRAP_SERVERS" --list >/dev/null 2>&1; then
        log "ERROR" "Kafka topics verification failed"
        return 1
    }

    # Check database connectivity
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" >/dev/null 2>&1; then
        log "ERROR" "Database connectivity check failed"
        return 1
    }

    log "INFO" "System health verification completed successfully"
    return 0
}

# Cleanup function for graceful shutdown
cleanup() {
    log "INFO" "Performing cleanup..."
    docker-compose -f "$COMPOSE_FILE" down --remove-orphans
}

# Main execution
main() {
    # Setup error handling and cleanup
    trap cleanup EXIT
    trap 'log "ERROR" "Script interrupted"; exit 1' INT TERM

    setup_logging

    log "INFO" "Starting OTPless Internal Billing System..."

    # Execute startup sequence
    check_environment || exit 1
    start_infrastructure || exit 1
    initialize_databases || exit 1
    setup_kafka || exit 1
    start_services || exit 1
    verify_system || exit 1

    log "INFO" "OTPless Internal Billing System started successfully"
    return 0
}

# Execute main function
main "$@"