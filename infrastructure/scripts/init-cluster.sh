#!/bin/bash

# OTPless Internal Billing System - Kubernetes Cluster Initialization Script
# Version: 1.0.0
# Kubernetes Version: 1.27.x
# Description: Production-grade cluster initialization with security controls and monitoring

set -euo pipefail
IFS=$'\n\t'

# Global Variables
readonly CLUSTER_NAME="otpless-billing-cluster"
readonly AWS_REGION="us-west-2"
readonly ENVIRONMENT="production"
readonly LOG_LEVEL="INFO"
readonly BACKUP_RETENTION_DAYS="30"
readonly MIN_NODE_COUNT="3"
readonly MAX_NODE_COUNT="10"
readonly SCRIPT_VERSION="1.0.0"

# Required tool versions
readonly REQUIRED_KUBECTL_VERSION="1.27"
readonly REQUIRED_HELM_VERSION="3"
readonly REQUIRED_AWS_CLI_VERSION="2"

# Logging configuration
readonly LOG_FILE="/var/log/otpless/cluster-init-$(date +%Y%m%d-%H%M%S).log"
readonly ERROR_LOG_FILE="/var/log/otpless/cluster-init-error-$(date +%Y%m%d-%H%M%S).log"

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

# Initialize logging
setup_logging() {
    mkdir -p "$(dirname "$LOG_FILE")" "$(dirname "$ERROR_LOG_FILE")"
    exec 1> >(tee -a "$LOG_FILE")
    exec 2> >(tee -a "$ERROR_LOG_FILE" >&2)
}

# Logging functions
log_info() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] ${GREEN}[INFO]${NC} $*"
}

log_warn() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] ${YELLOW}[WARN]${NC} $*" >&2
}

log_error() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] ${RED}[ERROR]${NC} $*" >&2
}

# Error handling
handle_error() {
    local exit_code=$?
    local line_number=$1
    log_error "Error occurred in script $0 at line $line_number, exit code $exit_code"
    cleanup
    exit 1
}

trap 'handle_error ${LINENO}' ERR

# Cleanup function
cleanup() {
    log_info "Performing cleanup..."
    # Remove temporary files
    rm -f /tmp/otpless-cluster-init-*
    # Reset AWS credentials if needed
    unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check kubectl version
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        return 1
    fi
    local kubectl_version
    kubectl_version=$(kubectl version --client -o json | jq -r '.clientVersion.gitVersion' | cut -d. -f1,2 | sed 's/v//')
    if [[ "$kubectl_version" != "$REQUIRED_KUBECTL_VERSION" ]]; then
        log_error "kubectl version mismatch. Required: $REQUIRED_KUBECTL_VERSION, Found: $kubectl_version"
        return 1
    fi

    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed"
        return 1
    }
    local aws_version
    aws_version=$(aws --version | cut -d/ -f2 | cut -d. -f1)
    if [[ "$aws_version" != "$REQUIRED_AWS_CLI_VERSION" ]]; then
        log_error "AWS CLI version mismatch. Required: $REQUIRED_AWS_CLI_VERSION, Found: $aws_version"
        return 1
    }

    # Check helm
    if ! command -v helm &> /dev/null; then
        log_error "helm is not installed"
        return 1
    }
    local helm_version
    helm_version=$(helm version --template '{{.Version}}' | cut -d. -f1 | sed 's/v//')
    if [[ "$helm_version" != "$REQUIRED_HELM_VERSION" ]]; then
        log_error "helm version mismatch. Required: $REQUIRED_HELM_VERSION, Found: $helm_version"
        return 1
    }

    # Check AWS credentials and permissions
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "Invalid or missing AWS credentials"
        return 1
    }

    # Verify cluster access
    if ! kubectl auth can-i create namespace --all-namespaces &> /dev/null; then
        log_error "Insufficient Kubernetes permissions"
        return 1
    }

    log_info "Prerequisites check passed"
    return 0
}

# Setup namespaces with security policies
setup_namespaces() {
    log_info "Setting up namespaces and security policies..."

    # Apply namespace configurations
    kubectl apply -f infrastructure/kubernetes/base/namespaces.yaml
    
    # Verify namespace creation
    for ns in otpless-system otpless-billing otpless-monitoring; do
        if ! kubectl get namespace "$ns" &> /dev/null; then
            log_error "Failed to create namespace: $ns"
            return 1
        fi
        log_info "Namespace $ns created successfully"
    done

    # Apply additional security policies
    kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: otpless-system
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
EOF

    log_info "Namespaces and security policies configured successfully"
    return 0
}

# Configure storage classes
configure_storage() {
    log_info "Configuring storage classes..."

    # Install EBS CSI Driver
    helm repo add aws-ebs-csi-driver https://kubernetes-sigs.github.io/aws-ebs-csi-driver
    helm repo update
    
    helm upgrade --install aws-ebs-csi-driver aws-ebs-csi-driver/aws-ebs-csi-driver \
        --namespace otpless-system \
        --set enableVolumeScheduling=true \
        --set enableVolumeResizing=true \
        --set enableVolumeSnapshot=true \
        --set serviceAccount.controller.create=true \
        --set serviceAccount.snapshot.create=true

    # Apply storage class configurations
    kubectl apply -f infrastructure/kubernetes/base/storage-class.yaml

    # Verify storage class creation
    if ! kubectl get storageclass ebs-sc &> /dev/null; then
        log_error "Failed to create storage class: ebs-sc"
        return 1
    }

    log_info "Storage classes configured successfully"
    return 0
}

# Setup certificate management
setup_cert_manager() {
    log_info "Setting up cert-manager..."

    # Add cert-manager helm repository
    helm repo add jetstack https://charts.jetstack.io
    helm repo update

    # Install cert-manager with CRDs
    helm upgrade --install cert-manager jetstack/cert-manager \
        --namespace otpless-system \
        --set installCRDs=true \
        --set global.leaderElection.namespace=otpless-system \
        --set prometheus.enabled=true \
        --set webhook.timeoutSeconds=30

    # Wait for cert-manager to be ready
    kubectl wait --for=condition=available deployment/cert-manager -n otpless-system --timeout=300s

    # Apply cert-manager configurations
    kubectl apply -f infrastructure/kubernetes/base/cert-manager.yaml

    log_info "cert-manager setup completed successfully"
    return 0
}

# Setup monitoring stack
setup_monitoring() {
    log_info "Setting up monitoring stack..."

    # Add prometheus-community helm repository
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update

    # Install prometheus operator
    helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
        --namespace otpless-monitoring \
        --set grafana.enabled=true \
        --set alertmanager.enabled=true \
        --set prometheus.prometheusSpec.retention=15d \
        --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.storageClassName=ebs-sc

    # Apply custom monitoring configurations
    kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: cluster-monitoring
  namespace: otpless-monitoring
spec:
  selector:
    matchLabels:
      app.kubernetes.io/part-of: otpless
  endpoints:
  - port: metrics
    interval: 30s
EOF

    log_info "Monitoring stack setup completed successfully"
    return 0
}

# Main function
main() {
    log_info "Starting cluster initialization for $CLUSTER_NAME in $AWS_REGION"
    
    # Setup logging
    setup_logging
    
    # Execute initialization steps
    check_prerequisites || exit 1
    setup_namespaces || exit 1
    configure_storage || exit 1
    setup_cert_manager || exit 1
    setup_monitoring || exit 1

    # Verify cluster health
    if ! kubectl get nodes &> /dev/null; then
        log_error "Cluster health check failed"
        exit 1
    }

    # Generate initialization report
    cat > "/tmp/cluster-init-report-$(date +%Y%m%d).txt" <<EOF
Cluster Initialization Report
============================
Cluster Name: $CLUSTER_NAME
Region: $AWS_REGION
Environment: $ENVIRONMENT
Initialization Date: $(date)
Script Version: $SCRIPT_VERSION

Components Installed:
- Namespaces and Security Policies
- EBS Storage Classes
- Cert Manager
- Monitoring Stack

For detailed logs, see:
- Main log: $LOG_FILE
- Error log: $ERROR_LOG_FILE
EOF

    log_info "Cluster initialization completed successfully"
    return 0
}

# Execute main function
main "$@"