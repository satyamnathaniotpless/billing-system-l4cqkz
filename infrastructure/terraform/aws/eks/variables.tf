# EKS Cluster Configuration Variables
variable "cluster_name" {
  type        = string
  description = "Name of the EKS cluster for OTPless Billing System"
  default     = "otpless-billing-eks"

  validation {
    condition     = length(var.cluster_name) <= 40 && can(regex("^[a-zA-Z][a-zA-Z0-9-]*$", var.cluster_name))
    error_message = "Cluster name must be 40 characters or less and start with a letter, containing only alphanumeric characters and hyphens"
  }
}

variable "cluster_version" {
  type        = string
  description = "Kubernetes version for the EKS cluster, must be 1.27 or higher"
  default     = "1.27"

  validation {
    condition     = can(regex("^1\\.2[7-9]$", var.cluster_version))
    error_message = "Cluster version must be 1.27 or higher for production requirements"
  }
}

# Node Group Configuration Variables
variable "node_group_instance_types" {
  type        = list(string)
  description = "List of EC2 instance types for EKS node group, optimized for production workloads"
  default     = ["t3.xlarge", "t3.2xlarge"]

  validation {
    condition     = length(var.node_group_instance_types) > 0 && alltrue([for t in var.node_group_instance_types : can(regex("^t3\\.|^m5\\.|^c5\\.", t))])
    error_message = "Instance types must be from t3, m5, or c5 families for production performance requirements"
  }
}

variable "node_group_desired_size" {
  type        = number
  description = "Desired number of worker nodes for high availability"
  default     = 3

  validation {
    condition     = var.node_group_desired_size >= 3
    error_message = "Desired size must be at least 3 for high availability requirements"
  }
}

variable "node_group_min_size" {
  type        = number
  description = "Minimum number of worker nodes for high availability"
  default     = 3

  validation {
    condition     = var.node_group_min_size >= 3
    error_message = "Minimum size must be at least 3 for high availability requirements"
  }
}

variable "node_group_max_size" {
  type        = number
  description = "Maximum number of worker nodes for auto-scaling"
  default     = 10

  validation {
    condition     = var.node_group_max_size >= var.node_group_min_size && var.node_group_max_size <= 20
    error_message = "Maximum size must be between minimum size and 20 nodes for controlled scaling"
  }
}

# Cluster Logging Configuration
variable "enabled_cluster_log_types" {
  type        = list(string)
  description = "List of EKS cluster log types to enable for comprehensive monitoring"
  default     = ["api", "audit", "authenticator", "controllerManager", "scheduler"]

  validation {
    condition     = length(var.enabled_cluster_log_types) > 0
    error_message = "At least one log type must be enabled for monitoring requirements"
  }
}

# Network Access Configuration
variable "endpoint_private_access" {
  type        = bool
  description = "Enable private API server endpoint access for secure internal communication"
  default     = true
}

variable "endpoint_public_access" {
  type        = bool
  description = "Enable public API server endpoint access with restricted CIDR ranges"
  default     = true
}

variable "endpoint_public_access_cidrs" {
  type        = list(string)
  description = "List of CIDR blocks that can access the public API server endpoint"
  default     = ["0.0.0.0/0"]

  validation {
    condition     = alltrue([for cidr in var.endpoint_public_access_cidrs : can(cidrhost(cidr, 0))])
    error_message = "All CIDR blocks must be valid IPv4 CIDR notation"
  }
}

# Resource Tagging
variable "tags" {
  type        = map(string)
  description = "Tags to apply to all EKS resources for resource management"
  default = {
    Environment    = "production"
    Project        = "otpless-billing"
    ManagedBy     = "terraform"
    CostCenter    = "billing-infrastructure"
    SecurityLevel = "high"
  }
}