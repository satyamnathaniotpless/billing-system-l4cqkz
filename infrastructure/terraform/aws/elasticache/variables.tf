# Terraform ~> 1.5
# Core variables for AWS ElastiCache Redis cluster configuration for OTPless Internal Billing System

variable "environment" {
  type        = string
  description = "Environment name for resource tagging and configuration"

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production"
  }
}

variable "redis_node_type" {
  type        = string
  description = "Instance type for Redis nodes. Minimum t4g.medium for production workloads"
  default     = "cache.t4g.medium"

  validation {
    condition     = can(regex("^cache\\.(t4g|r6g|m6g)\\.(medium|large|xlarge)$", var.redis_node_type))
    error_message = "Redis node type must be a valid ElastiCache instance type from t4g, r6g, or m6g families"
  }
}

variable "redis_num_cache_nodes" {
  type        = number
  description = "Number of cache nodes in the Redis cluster. Minimum 2 for high availability"
  default     = 2

  validation {
    condition     = var.redis_num_cache_nodes >= 2 && var.redis_num_cache_nodes <= 6
    error_message = "Number of cache nodes must be between 2 and 6 for optimal performance and cost balance"
  }
}

variable "redis_port" {
  type        = number
  description = "Port number for Redis cluster. Default is 6379"
  default     = 6379

  validation {
    condition     = var.redis_port > 1024 && var.redis_port < 65536
    error_message = "Redis port must be between 1024 and 65535 for security compliance"
  }
}

variable "maintenance_window" {
  type        = string
  description = "Weekly time range for maintenance operations. Schedule during low-traffic periods"
  default     = "sun:05:00-sun:06:00"

  validation {
    condition     = can(regex("^(mon|tue|wed|thu|fri|sat|sun):[0-2][0-9]:[0-5][0-9]-(mon|tue|wed|thu|fri|sat|sun):[0-2][0-9]:[0-5][0-9]$", var.maintenance_window))
    error_message = "Maintenance window must be in the format 'ddd:hh:mm-ddd:hh:mm' with valid days and times"
  }
}

variable "snapshot_window" {
  type        = string
  description = "Daily time range for automated snapshots. Must not overlap with maintenance window"
  default     = "03:00-04:00"

  validation {
    condition     = can(regex("^([0-1][0-9]|2[0-3]):[0-5][0-9]-([0-1][0-9]|2[0-3]):[0-5][0-9]$", var.snapshot_window))
    error_message = "Snapshot window must be in the format 'hh:mm-hh:mm' with valid 24-hour times"
  }
}

variable "snapshot_retention_limit" {
  type        = number
  description = "Number of days to retain automated snapshots. 0 disables automated backups"
  default     = 7

  validation {
    condition     = var.snapshot_retention_limit >= 0 && var.snapshot_retention_limit <= 35
    error_message = "Snapshot retention limit must be between 0 and 35 days as per AWS limits"
  }
}

variable "parameter_group_family" {
  type        = string
  description = "Redis parameter group family for version 7.0"
  default     = "redis7.0"

  validation {
    condition     = var.parameter_group_family == "redis7.0"
    error_message = "Only Redis 7.0 is supported for this implementation"
  }
}

variable "tags" {
  type        = map(string)
  description = "Common tags to be applied to all ElastiCache resources"
  default = {
    Project     = "OTPless Billing System"
    ManagedBy   = "Terraform"
    Service     = "Redis Cache"
    Environment = "${var.environment}"
    CostCenter  = "Infrastructure"
  }
}