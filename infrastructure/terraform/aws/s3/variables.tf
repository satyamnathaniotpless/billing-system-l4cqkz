# Environment variable for resource naming and configuration
variable "environment" {
  type        = string
  description = "Environment name for resource naming and configuration (dev, staging, prod)"
  
  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

# Project name variable for resource naming and tagging
variable "project_name" {
  type        = string
  description = "Project name for resource naming and tagging"
  default     = "otpless-billing"
  
  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "Project name must contain only lowercase letters, numbers, and hyphens"
  }
}

# Invoice document retention period configuration
variable "invoice_retention_days" {
  type        = number
  description = "Number of days to retain invoice documents in standard storage before transitioning to IA storage"
  default     = 30
  
  validation {
    condition     = var.invoice_retention_days >= 30
    error_message = "Invoice retention days must be at least 30 days for compliance"
  }
}

# Backup data retention period configuration
variable "backup_retention_days" {
  type        = number
  description = "Number of days to retain backups in standard storage before transitioning to Glacier storage"
  default     = 90
  
  validation {
    condition     = var.backup_retention_days >= 90
    error_message = "Backup retention days must be at least 90 days for compliance"
  }
}

# Force destroy configuration with production safeguard
variable "force_destroy" {
  type        = bool
  description = "Boolean flag to allow bucket destruction with contents. Should be false in production"
  default     = false
  
  validation {
    condition     = !var.force_destroy || var.environment != "prod"
    error_message = "Force destroy cannot be enabled in production environment"
  }
}

# Versioning configuration with production requirement
variable "enable_versioning" {
  type        = bool
  description = "Boolean flag to enable bucket versioning for data protection"
  default     = true
  
  validation {
    condition     = var.enable_versioning == true || var.environment != "prod"
    error_message = "Versioning must be enabled in production environment"
  }
}