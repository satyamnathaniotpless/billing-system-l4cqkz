# Import global variables from parent module
variable "environment" {
  type        = string
  description = "Environment name for deployment (dev, staging, prod) with strict validation"
  
  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be one of: dev, staging, prod for security compliance"
  }
}

variable "project" {
  type        = string
  description = "Project name for consistent resource naming across infrastructure"
  default     = "otpless-billing"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project)) && length(var.project) <= 32
    error_message = "Project name must contain only lowercase letters, numbers, hyphens and be <= 32 characters"
  }
}

# Secret Recovery Configuration
variable "recovery_window" {
  type        = number
  description = "Number of days to wait before permanent secret deletion (PCI DSS compliance requirement)"
  default     = 7

  validation {
    condition     = var.recovery_window >= 7 && var.recovery_window <= 30
    error_message = "Recovery window must be between 7 and 30 days for compliance with security standards"
  }
}

# Secret Rotation Configuration
variable "rotation_days" {
  type        = number
  description = "Number of days between automatic secret rotations (ISO 27001 and PCI DSS requirement)"
  default     = 30

  validation {
    condition     = var.rotation_days >= 30 && var.rotation_days <= 90
    error_message = "Rotation period must be between 30 and 90 days for security compliance"
  }
}

# Security Classification Tags
variable "secret_tags" {
  type        = map(string)
  description = "Additional tags for secrets including security classification and compliance tracking"
  default = {
    SecurityClassification = "Critical"
    ComplianceScope      = "PCI-DSS"
    DataProtectionLevel  = "High"
    ManagedBy           = "Terraform"
    SecurityFramework   = "ISO-27001"
  }

  validation {
    condition     = contains(keys(var.secret_tags), "SecurityClassification") && contains(keys(var.secret_tags), "ComplianceScope")
    error_message = "secret_tags must include SecurityClassification and ComplianceScope for compliance tracking"
  }
}

# Encryption Configuration
variable "kms_key_id" {
  type        = string
  description = "KMS key ID for secret encryption (FIPS 140-2 compliance)"
  default     = null

  validation {
    condition     = var.kms_key_id == null || can(regex("^arn:aws:kms:[a-z0-9-]+:[0-9]+:key/[a-f0-9-]+$", var.kms_key_id))
    error_message = "KMS key ID must be a valid AWS KMS key ARN or null"
  }
}

# Disaster Recovery Configuration
variable "enable_replication" {
  type        = bool
  description = "Enable cross-region secret replication for disaster recovery"
  default     = false
}

# Notification Configuration
variable "notification_config" {
  type = object({
    enabled       = bool
    sns_topic_arn = string
    events = list(string)
  })
  description = "Configuration for secret rotation and expiry notifications"
  default = {
    enabled       = true
    sns_topic_arn = ""
    events        = ["rotation", "expiration"]
  }

  validation {
    condition     = var.notification_config.enabled == false || can(regex("^arn:aws:sns:", var.notification_config.sns_topic_arn))
    error_message = "SNS topic ARN must be valid when notifications are enabled"
  }
}

# Secret Access Policy Configuration
variable "secret_policy" {
  type = object({
    enable_iam_policy = bool
    allowed_roles     = list(string)
    allowed_services  = list(string)
  })
  description = "IAM policy configuration for secret access control"
  default = {
    enable_iam_policy = true
    allowed_roles     = ["billing-service", "wallet-service"]
    allowed_services  = ["ecs.amazonaws.com", "lambda.amazonaws.com"]
  }

  validation {
    condition     = length(var.secret_policy.allowed_roles) > 0
    error_message = "At least one IAM role must be specified for secret access"
  }
}

# Backup Configuration
variable "backup_config" {
  type = object({
    enable_backup = bool
    retention_days = number
  })
  description = "Configuration for secret backup and retention"
  default = {
    enable_backup   = true
    retention_days  = 90
  }

  validation {
    condition     = !var.backup_config.enable_backup || var.backup_config.retention_days >= 90
    error_message = "Backup retention must be at least 90 days when enabled for compliance"
  }
}