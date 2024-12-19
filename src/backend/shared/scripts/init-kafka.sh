#!/bin/bash

# Kafka Initialization Script for OTPless Internal Billing System
# Version: 1.0.0
# Purpose: Production setup of Kafka topics, security, and monitoring
# Dependencies: Kafka 3.5.x, OpenSSL, JMX Exporter

# Global configurations
KAFKA_BOOTSTRAP_SERVERS="localhost:9092,localhost:9093,localhost:9094"
REPLICATION_FACTOR=3
PARTITIONS=12
RETENTION_MS=604800000  # 7 days
MIN_INSYNC_REPLICAS=2
SSL_KEYSTORE_LOCATION="/etc/kafka/ssl/kafka.keystore.jks"
SSL_TRUSTSTORE_LOCATION="/etc/kafka/ssl/kafka.truststore.jks"
MAX_MESSAGE_BYTES=1048576  # 1MB
COMPRESSION_TYPE="lz4"
LOG_DIR="/var/log/kafka"

# Topic configurations
declare -A TOPICS=(
    ["usage-events"]="cleanup.policy=delete retention.ms=${RETENTION_MS}"
    ["billing-events"]="cleanup.policy=compact min.compaction.lag.ms=86400000"
    ["wallet-events"]="cleanup.policy=delete retention.ms=${RETENTION_MS}"
    ["invoice-events"]="cleanup.policy=compact min.compaction.lag.ms=86400000"
)

# Setup logging
setup_logging() {
    local log_level=$1
    mkdir -p "${LOG_DIR}"
    exec 1> >(tee -a "${LOG_DIR}/kafka-init.log")
    exec 2>&1
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting Kafka initialization script v${SCRIPT_VERSION}"
}

# Verify prerequisites
verify_prerequisites() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Verifying prerequisites..."
    
    # Check Kafka installation
    if ! command -v kafka-topics.sh &> /dev/null; then
        echo "ERROR: Kafka tools not found in PATH"
        return 1
    }

    # Verify broker connectivity
    if ! echo "ruok" | nc -w 2 localhost 9092 &> /dev/null; then
        echo "ERROR: Cannot connect to Kafka broker"
        return 1
    }

    # Validate SSL certificates
    if [ ! -f "${SSL_KEYSTORE_LOCATION}" ] || [ ! -f "${SSL_TRUSTSTORE_LOCATION}" ]; then
        echo "ERROR: SSL certificates not found"
        return 1
    }

    # Check disk space
    if [ "$(df -P "${LOG_DIR}" | awk 'NR==2 {print $5}' | sed 's/%//')" -gt 80 ]; then
        echo "WARNING: Disk space usage above 80%"
    }

    return 0
}

# Create Kafka topics
create_topics() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Creating Kafka topics..."
    
    for topic in "${!TOPICS[@]}"; do
        kafka-topics.sh --bootstrap-server "${KAFKA_BOOTSTRAP_SERVERS}" \
            --create \
            --if-not-exists \
            --topic "${topic}" \
            --partitions "${PARTITIONS}" \
            --replication-factor "${REPLICATION_FACTOR}" \
            --config min.insync.replicas="${MIN_INSYNC_REPLICAS}" \
            --config max.message.bytes="${MAX_MESSAGE_BYTES}" \
            --config compression.type="${COMPRESSION_TYPE}" \
            --config "${TOPICS[$topic]}"

        if [ $? -ne 0 ]; then
            echo "ERROR: Failed to create topic ${topic}"
            return 1
        fi
    done

    return 0
}

# Configure security
configure_security() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Configuring security settings..."

    # Configure SSL settings
    kafka-configs.sh --bootstrap-server "${KAFKA_BOOTSTRAP_SERVERS}" \
        --entity-type brokers \
        --entity-name 0 \
        --alter \
        --add-config "ssl.keystore.location=${SSL_KEYSTORE_LOCATION},ssl.truststore.location=${SSL_TRUSTSTORE_LOCATION}"

    # Setup ACLs for topics
    for topic in "${!TOPICS[@]}"; do
        kafka-acls.sh --bootstrap-server "${KAFKA_BOOTSTRAP_SERVERS}" \
            --add \
            --allow-principal User:event-processor \
            --operation Read,Write \
            --topic "${topic}"

        kafka-acls.sh --bootstrap-server "${KAFKA_BOOTSTRAP_SERVERS}" \
            --add \
            --allow-principal User:billing-service \
            --operation Read \
            --topic "${topic}"
    done

    return 0
}

# Setup monitoring
setup_monitoring() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Setting up monitoring..."

    # Configure JMX Exporter
    cp /opt/kafka/config/jmx_exporter.yml /etc/kafka/
    
    # Set JMX monitoring ports
    export JMX_PORT=9999
    export KAFKA_JMX_OPTS="-javaagent:/opt/jmx_exporter/jmx_prometheus_javaagent.jar=8080:/etc/kafka/jmx_exporter.yml"

    # Configure metric collection
    kafka-configs.sh --bootstrap-server "${KAFKA_BOOTSTRAP_SERVERS}" \
        --entity-type brokers \
        --entity-name 0 \
        --alter \
        --add-config "metric.reporters=org.apache.kafka.common.metrics.JmxReporter"

    return 0
}

# Verify setup
verify_setup() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Verifying setup..."

    # Verify topics
    for topic in "${!TOPICS[@]}"; do
        if ! kafka-topics.sh --bootstrap-server "${KAFKA_BOOTSTRAP_SERVERS}" \
            --describe \
            --topic "${topic}" &> /dev/null; then
            echo "ERROR: Topic ${topic} verification failed"
            return 1
        fi
    done

    # Verify consumer groups
    kafka-consumer-groups.sh --bootstrap-server "${KAFKA_BOOTSTRAP_SERVERS}" \
        --list | grep -q "billing-service-group"
    
    # Check replication status
    kafka-topics.sh --bootstrap-server "${KAFKA_BOOTSTRAP_SERVERS}" \
        --describe \
        --under-replicated-partitions

    return 0
}

# Main execution
main() {
    setup_logging "INFO"

    # Execute initialization steps
    verify_prerequisites || exit 1
    create_topics || exit 1
    configure_security || exit 1
    setup_monitoring || exit 1
    verify_setup || exit 1

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Kafka initialization completed successfully"
    return 0
}

# Execute main function
main "$@"