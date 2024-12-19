# Terraform AWS RDS Variables
# Version: ~> 1.5
# Purpose: Define variables for PostgreSQL RDS instance supporting OTPless Internal Billing System

variable "db_identifier" {
  type        = string
  description = "Unique identifier for the RDS instance within the AWS region"
  default     = "otpless-billing-db"

  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]$", var.db_identifier))
    error_message = "The db_identifier must be between 3 and 63 characters, start with a letter, and can only contain alphanumeric characters and hyphens."
  }
}

variable "db_engine_version" {
  type        = string
  description = "PostgreSQL engine version for ACID compliance and replication support"
  default     = "15.3"

  validation {
    condition     = can(regex("^15\\.[0-9]+$", var.db_engine_version))
    error_message = "The db_engine_version must be PostgreSQL 15.x."
  }
}

variable "db_instance_class" {
  type        = string
  description = "RDS instance type optimized for financial transaction workloads"
  default     = "db.r6g.xlarge"

  validation {
    condition     = can(regex("^db\\.(r6g|r6i|r5)\\.(xlarge|2xlarge|4xlarge|8xlarge|16xlarge)$", var.db_instance_class))
    error_message = "The db_instance_class must be a memory-optimized instance type (r6g, r6i, or r5 family)."
  }
}

variable "db_allocated_storage" {
  type        = number
  description = "Initial storage allocation in GB with room for growth"
  default     = 100

  validation {
    condition     = var.db_allocated_storage >= 100 && var.db_allocated_storage <= 65536
    error_message = "The db_allocated_storage must be between 100GB and 65536GB."
  }
}

variable "db_max_allocated_storage" {
  type        = number
  description = "Maximum storage allocation for autoscaling in GB"
  default     = 1000

  validation {
    condition     = var.db_max_allocated_storage >= 100 && var.db_max_allocated_storage <= 65536
    error_message = "The db_max_allocated_storage must be between 100GB and 65536GB."
  }
}

variable "db_name" {
  type        = string
  description = "Name of the default database for billing system"
  default     = "otpless_billing"

  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_]{0,62}$", var.db_name))
    error_message = "The db_name must be between 1 and 63 characters, start with a letter, and contain only alphanumeric characters and underscores."
  }
}

variable "db_username" {
  type        = string
  description = "Master username for database access with strict security requirements"
  sensitive   = true

  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_]{0,62}$", var.db_username))
    error_message = "The db_username must be between 1 and 63 characters, start with a letter, and contain only alphanumeric characters and underscores."
  }
}

variable "db_password" {
  type        = string
  description = "Master password with strong complexity requirements"
  sensitive   = true

  validation {
    condition     = can(regex("^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{16,}$", var.db_password))
    error_message = "The db_password must be at least 16 characters and include uppercase, lowercase, numbers, and special characters."
  }
}

variable "db_multi_az" {
  type        = bool
  description = "Enable Multi-AZ deployment for 99.9% uptime requirement"
  default     = true

  validation {
    condition     = var.db_multi_az == true
    error_message = "Multi-AZ deployment must be enabled for production environments to meet high availability requirements."
  }
}

variable "db_backup_retention_period" {
  type        = number
  description = "Backup retention period in days for disaster recovery"
  default     = 30

  validation {
    condition     = var.db_backup_retention_period >= 30 && var.db_backup_retention_period <= 35
    error_message = "The backup retention period must be between 30 and 35 days for production environments."
  }
}

variable "db_monitoring_interval" {
  type        = number
  description = "Enhanced monitoring interval in seconds for performance tracking"
  default     = 30

  validation {
    condition     = contains([0, 1, 5, 10, 15, 30, 60], var.db_monitoring_interval)
    error_message = "The monitoring interval must be one of: 0, 1, 5, 10, 15, 30, or 60 seconds."
  }
}

variable "db_performance_insights_enabled" {
  type        = bool
  description = "Enable Performance Insights for query analysis"
  default     = true

  validation {
    condition     = var.db_performance_insights_enabled == true
    error_message = "Performance Insights must be enabled for production environments."
  }
}

variable "db_subnet_ids" {
  type        = list(string)
  description = "List of private subnet IDs for secure RDS deployment"

  validation {
    condition     = length(var.db_subnet_ids) >= 2
    error_message = "At least 2 subnet IDs must be provided for Multi-AZ deployment."
  }
}

variable "tags" {
  type        = map(string)
  description = "Resource tags for management and cost allocation"
  default = {
    Project     = "OTPless-Billing"
    ManagedBy   = "Terraform"
    Environment = "Production"
  }

  validation {
    condition     = contains(keys(var.tags), "Environment") && contains(keys(var.tags), "Project") && contains(keys(var.tags), "ManagedBy")
    error_message = "Tags must include Environment, Project, and ManagedBy."
  }
}