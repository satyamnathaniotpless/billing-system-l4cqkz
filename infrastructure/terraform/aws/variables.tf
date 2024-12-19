# Core Terraform functionality for infrastructure provisioning
# terraform ~> 1.5

# Project Configuration
variable "project" {
  type        = string
  description = "Project name used for resource naming and tagging across all AWS resources"
  default     = "otpless-billing"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project)) && length(var.project) <= 32
    error_message = "Project name must contain only lowercase letters, numbers, hyphens and be <= 32 characters"
  }
}

# Environment Configuration
variable "environment" {
  type        = string
  description = "Deployment environment identifier for resource isolation and configuration"
  default     = "production"

  validation {
    condition     = contains(["production", "staging", "development"], var.environment)
    error_message = "Environment must be one of: production, staging, development"
  }
}

# Regional Configuration
variable "aws_region" {
  type        = string
  description = "Primary AWS region for infrastructure deployment with failover support"
  default     = "ap-south-1"

  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-\\d$", var.aws_region))
    error_message = "AWS region must be a valid region identifier"
  }
}

variable "dr_region" {
  type        = string
  description = "Secondary AWS region for disaster recovery with automated failover"
  default     = "ap-southeast-1"

  validation {
    condition     = var.dr_region != var.aws_region && can(regex("^[a-z]{2}-[a-z]+-\\d$", var.dr_region))
    error_message = "DR region must be different from primary region and be valid"
  }
}

# Network Configuration
variable "vpc_cidr" {
  type        = string
  description = "CIDR block for VPC with subnet allocation strategy"
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0)) && split("/", var.vpc_cidr)[1] <= 16
    error_message = "VPC CIDR must be a valid IPv4 CIDR block with mask <= 16"
  }
}

# Security Configuration
variable "enable_encryption" {
  type        = bool
  description = "Enable AWS KMS encryption for all supported resources including EBS, RDS, and S3"
  default     = true
}

variable "kms_deletion_window" {
  type        = number
  description = "KMS key deletion window in days"
  default     = 30

  validation {
    condition     = var.kms_deletion_window >= 7 && var.kms_deletion_window <= 30
    error_message = "KMS key deletion window must be between 7 and 30 days"
  }
}

# Monitoring Configuration
variable "enable_monitoring" {
  type        = bool
  description = "Enable enhanced CloudWatch monitoring for all supported resources"
  default     = true
}

# Backup Configuration
variable "backup_retention_days" {
  type        = number
  description = "Default backup retention period in days for compliance"
  default     = 30

  validation {
    condition     = var.backup_retention_days >= 30 && var.backup_retention_days <= 365
    error_message = "Backup retention must be between 30 and 365 days for compliance"
  }
}

# Resource Tagging
variable "default_tags" {
  type        = map(string)
  description = "Default tags applied to all resources for organization and cost tracking"
  default = {
    Project          = "OTPless-Billing"
    Environment      = "production"
    ManagedBy        = "Terraform"
    Owner            = "DevOps"
    SecurityLevel    = "High"
    ComplianceLevel  = "PCI-DSS"
  }
}

# Domain Configuration
variable "domain_name" {
  type        = string
  description = "Root domain name for the application with SSL/TLS configuration"
  default     = "billing.otpless.com"

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]*(\\.[a-z0-9][a-z0-9-]*)*$", var.domain_name))
    error_message = "Domain name must be a valid DNS name"
  }
}

# Disaster Recovery Configuration
variable "enable_dr" {
  type        = bool
  description = "Enable disaster recovery configuration with cross-region replication"
  default     = true
}

# WAF Configuration
variable "enable_waf" {
  type        = bool
  description = "Enable AWS WAF for web application protection with custom rule sets"
  default     = true
}

variable "waf_rule_priority" {
  type        = number
  description = "Priority for WAF rules"
  default     = 1

  validation {
    condition     = var.waf_rule_priority > 0 && var.waf_rule_priority <= 100
    error_message = "WAF rule priority must be between 1 and 100"
  }
}