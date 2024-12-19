#!/usr/bin/env bash

# OTPless Internal Billing System - Monitoring Stack Deployment Script
# Version: 1.0.0
# Description: Deploys and configures production-grade monitoring stack with Prometheus, 
# Grafana, Loki, and Jaeger for comprehensive observability

set -euo pipefail

# Global variables
readonly MONITORING_NAMESPACE="monitoring"
readonly LOG_FILE="/var/log/monitoring-deploy.log"
readonly BACKUP_DIR="/var/backup/monitoring"
readonly HELM_TIMEOUT="600s"
readonly RETRY_ATTEMPTS=3
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly VALUES_DIR="${SCRIPT_DIR}/../kubernetes/monitoring"

# Required environment variables check
required_env_vars=(
    "GRAFANA_ADMIN_PASSWORD"
    "ELASTICSEARCH_USER"
    "ELASTICSEARCH_PASSWORD"
)

# Logging function
log() {
    local level="$1"
    shift
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [$level] $*" | tee -a "$LOG_FILE"
}

# Error handling function
handle_error() {
    local exit_code=$?
    log "ERROR" "An error occurred on line $1"
    cleanup
    exit $exit_code
}

trap 'handle_error $LINENO' ERR

# Cleanup function
cleanup() {
    log "INFO" "Performing cleanup..."
    # Remove temporary files
    rm -f /tmp/monitoring-*.yaml
}

# Check prerequisites
check_prerequisites() {
    log "INFO" "Checking prerequisites..."

    # Check required environment variables
    for var in "${required_env_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log "ERROR" "Required environment variable $var is not set"
            return 1
        fi
    done

    # Check required tools
    local required_tools=("kubectl" "helm" "yq")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log "ERROR" "Required tool $tool is not installed"
            return 1
        fi
    done

    # Check kubectl version
    local kubectl_version
    kubectl_version=$(kubectl version --client -o json | jq -r '.clientVersion.gitVersion')
    if [[ ! "$kubectl_version" =~ v1\.2[7-9]\. ]]; then
        log "ERROR" "kubectl version must be ≥ 1.27.x, found: $kubectl_version"
        return 1
    fi

    # Check cluster connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log "ERROR" "Cannot connect to Kubernetes cluster"
        return 1
    }

    # Verify cluster resources
    local node_count
    node_count=$(kubectl get nodes -o json | jq '.items | length')
    if [[ "$node_count" -lt 2 ]]; then
        log "ERROR" "Cluster must have at least 2 nodes for HA deployment"
        return 1
    }

    return 0
}

# Create and configure monitoring namespace
create_monitoring_namespace() {
    log "INFO" "Creating monitoring namespace..."

    # Create namespace if it doesn't exist
    if ! kubectl get namespace "$MONITORING_NAMESPACE" &> /dev/null; then
        kubectl create namespace "$MONITORING_NAMESPACE"
    fi

    # Label namespace for network policies
    kubectl label namespace "$MONITORING_NAMESPACE" \
        name=monitoring \
        environment=production \
        team=otpless-devops \
        --overwrite

    # Apply resource quotas
    kubectl apply -f "${VALUES_DIR}/../base/namespaces.yaml" -n "$MONITORING_NAMESPACE"

    # Apply network policies
    kubectl apply -f "${VALUES_DIR}/network-policies.yaml" -n "$MONITORING_NAMESPACE"

    log "INFO" "Monitoring namespace configured successfully"
    return 0
}

# Deploy Prometheus
deploy_prometheus() {
    log "INFO" "Deploying Prometheus..."

    # Add Prometheus helm repo
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update

    # Validate values file
    if ! yq eval "${VALUES_DIR}/prometheus/values.yaml" &> /dev/null; then
        log "ERROR" "Invalid Prometheus values file"
        return 1
    }

    # Deploy Prometheus
    helm upgrade --install prometheus prometheus-community/prometheus \
        --namespace "$MONITORING_NAMESPACE" \
        --values "${VALUES_DIR}/prometheus/values.yaml" \
        --timeout "$HELM_TIMEOUT" \
        --wait \
        --atomic

    # Verify deployment
    if ! kubectl rollout status deployment/prometheus-server -n "$MONITORING_NAMESPACE" --timeout=300s; then
        log "ERROR" "Prometheus deployment failed"
        return 1
    }

    log "INFO" "Prometheus deployed successfully"
    return 0
}

# Deploy Grafana
deploy_grafana() {
    log "INFO" "Deploying Grafana..."

    # Add Grafana helm repo
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo update

    # Create Grafana admin secret
    kubectl create secret generic grafana-admin-credentials \
        --from-literal=admin-password="$GRAFANA_ADMIN_PASSWORD" \
        --namespace "$MONITORING_NAMESPACE" \
        --dry-run=client -o yaml | kubectl apply -f -

    # Deploy Grafana
    helm upgrade --install grafana grafana/grafana \
        --namespace "$MONITORING_NAMESPACE" \
        --values "${VALUES_DIR}/grafana/values.yaml" \
        --timeout "$HELM_TIMEOUT" \
        --wait \
        --atomic

    # Verify deployment
    if ! kubectl rollout status deployment/grafana -n "$MONITORING_NAMESPACE" --timeout=300s; then
        log "ERROR" "Grafana deployment failed"
        return 1
    }

    log "INFO" "Grafana deployed successfully"
    return 0
}

# Deploy Loki
deploy_loki() {
    log "INFO" "Deploying Loki..."

    # Add Loki helm repo
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo update

    # Deploy Loki
    helm upgrade --install loki grafana/loki-stack \
        --namespace "$MONITORING_NAMESPACE" \
        --values "${VALUES_DIR}/loki/values.yaml" \
        --timeout "$HELM_TIMEOUT" \
        --wait \
        --atomic

    # Verify deployment
    if ! kubectl rollout status statefulset/loki -n "$MONITORING_NAMESPACE" --timeout=300s; then
        log "ERROR" "Loki deployment failed"
        return 1
    }

    log "INFO" "Loki deployed successfully"
    return 0
}

# Deploy Jaeger
deploy_jaeger() {
    log "INFO" "Deploying Jaeger..."

    # Add Jaeger helm repo
    helm repo add jaegertracing https://jaegertracing.github.io/helm-charts
    helm repo update

    # Create Elasticsearch credentials secret
    kubectl create secret generic jaeger-es-credentials \
        --from-literal=ES_USERNAME="$ELASTICSEARCH_USER" \
        --from-literal=ES_PASSWORD="$ELASTICSEARCH_PASSWORD" \
        --namespace "$MONITORING_NAMESPACE" \
        --dry-run=client -o yaml | kubectl apply -f -

    # Deploy Jaeger
    helm upgrade --install jaeger jaegertracing/jaeger \
        --namespace "$MONITORING_NAMESPACE" \
        --values "${VALUES_DIR}/jaeger/values.yaml" \
        --timeout "$HELM_TIMEOUT" \
        --wait \
        --atomic

    # Verify deployment
    if ! kubectl rollout status deployment/jaeger-collector -n "$MONITORING_NAMESPACE" --timeout=300s; then
        log "ERROR" "Jaeger deployment failed"
        return 1
    }

    log "INFO" "Jaeger deployed successfully"
    return 0
}

# Verify monitoring stack
verify_deployments() {
    log "INFO" "Verifying monitoring stack deployment..."

    local components=("prometheus" "grafana" "loki" "jaeger")
    for component in "${components[@]}"; do
        # Check pod status
        if ! kubectl get pods -l app="$component" -n "$MONITORING_NAMESPACE" | grep -q "Running"; then
            log "ERROR" "$component pods are not running"
            return 1
        fi

        # Check service endpoints
        if ! kubectl get endpoints "$component" -n "$MONITORING_NAMESPACE" | grep -q ":"; then
            log "ERROR" "$component service endpoints not ready"
            return 1
        }
    done

    # Verify Prometheus targets
    local prometheus_pod
    prometheus_pod=$(kubectl get pods -l app=prometheus -n "$MONITORING_NAMESPACE" -o jsonpath='{.items[0].metadata.name}')
    if ! kubectl exec "$prometheus_pod" -n "$MONITORING_NAMESPACE" -- wget -qO- http://localhost:9090/-/ready | grep -q "Prometheus"; then
        log "ERROR" "Prometheus targets verification failed"
        return 1
    }

    log "INFO" "Monitoring stack verification completed successfully"
    return 0
}

# Main function
main() {
    log "INFO" "Starting monitoring stack deployment..."

    # Create backup directory
    mkdir -p "$BACKUP_DIR"

    # Initialize log file
    touch "$LOG_FILE"
    chmod 640 "$LOG_FILE"

    # Check prerequisites
    if ! check_prerequisites; then
        log "ERROR" "Prerequisites check failed"
        exit 1
    fi

    # Create and configure namespace
    if ! create_monitoring_namespace; then
        log "ERROR" "Namespace creation failed"
        exit 1
    fi

    # Deploy components
    local components=(
        "deploy_prometheus"
        "deploy_grafana"
        "deploy_loki"
        "deploy_jaeger"
    )

    for component in "${components[@]}"; do
        for ((i=1; i<=RETRY_ATTEMPTS; i++)); do
            if $component; then
                break
            fi
            if [[ $i -eq RETRY_ATTEMPTS ]]; then
                log "ERROR" "Failed to deploy component after $RETRY_ATTEMPTS attempts: $component"
                exit 1
            fi
            log "WARN" "Retrying deployment: $component (attempt $i of $RETRY_ATTEMPTS)"
            sleep 10
        done
    done

    # Verify deployments
    if ! verify_deployments; then
        log "ERROR" "Deployment verification failed"
        exit 1
    fi

    log "INFO" "Monitoring stack deployment completed successfully"
    cleanup
}

# Execute main function
main "$@"