# Project and Environment Configuration
variable "project_name" {
  type        = string
  description = "Name of the project for resource naming and tagging"
  default     = "otpless-billing"
}

variable "environment" {
  type        = string
  description = "Deployment environment name (dev/staging/prod) for environment-specific configurations"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

# CloudFront Distribution Configuration
variable "price_class" {
  type        = string
  description = "CloudFront distribution price class for cost optimization based on geographic coverage"
  default     = "PriceClass_All"
  validation {
    condition     = contains(["PriceClass_100", "PriceClass_200", "PriceClass_All"], var.price_class)
    error_message = "Price class must be one of: PriceClass_100, PriceClass_200, PriceClass_All"
  }
}

variable "enable_waf" {
  type        = bool
  description = "Enable AWS WAF protection for CloudFront distribution with default security rules"
  default     = true
}

# Cache Configuration
variable "default_ttl" {
  type        = number
  description = "Default Time-To-Live for cached objects in seconds, optimized for API performance"
  default     = 3600 # 1 hour
  validation {
    condition     = var.default_ttl >= 0 && var.default_ttl <= 86400
    error_message = "Default TTL must be between 0 and 86400 seconds"
  }
}

variable "min_ttl" {
  type        = number
  description = "Minimum Time-To-Live for cached objects in seconds"
  default     = 0
  validation {
    condition     = var.min_ttl >= 0
    error_message = "Minimum TTL cannot be negative"
  }
}

variable "max_ttl" {
  type        = number
  description = "Maximum Time-To-Live for cached objects in seconds"
  default     = 86400 # 24 hours
  validation {
    condition     = var.max_ttl >= var.default_ttl
    error_message = "Maximum TTL must be greater than or equal to default TTL"
  }
}

# Domain and SSL Configuration
variable "domain_name" {
  type        = string
  description = "Primary domain name for CloudFront distribution"
  default     = "otpless.com"
}

variable "ssl_support_method" {
  type        = string
  description = "SSL/TLS support method for custom domain"
  default     = "sni-only"
  validation {
    condition     = contains(["sni-only", "vip"], var.ssl_support_method)
    error_message = "SSL support method must be either sni-only or vip"
  }
}

variable "minimum_protocol_version" {
  type        = string
  description = "Minimum TLS protocol version for viewer connections"
  default     = "TLSv1.2_2021"
  validation {
    condition     = contains(["TLSv1", "TLSv1.1", "TLSv1.2_2018", "TLSv1.2_2019", "TLSv1.2_2021"], var.minimum_protocol_version)
    error_message = "Invalid TLS protocol version specified"
  }
}

# Logging Configuration
variable "enable_logging" {
  type        = bool
  description = "Enable CloudFront access logging to S3"
  default     = true
}

# Resource Tagging
variable "tags" {
  type        = map(string)
  description = "Additional tags for CloudFront distribution and related resources"
  default     = {}
}