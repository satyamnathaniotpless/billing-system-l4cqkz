# Primary domain name variable with validation for DNS format
variable "domain_name" {
  type        = string
  description = "Primary domain name for the OTPless Internal Billing System"

  validation {
    condition     = can(regex("^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}$", var.domain_name))
    error_message = "Domain name must be a valid DNS name supporting international domains"
  }
}

# DNSSEC configuration variable
variable "enable_dnssec" {
  type        = bool
  description = "Enable DNSSEC signing for the hosted zone with automatic key management"
  default     = true
}

# Health check enablement variable
variable "health_check_enabled" {
  type        = bool
  description = "Enable Route53 health checks for DNS failover between regions"
  default     = true
}

# Health check interval variable with validation
variable "health_check_interval" {
  type        = number
  description = "Interval in seconds between health checks (10 or 30 seconds as per Route53 requirements)"
  default     = 30

  validation {
    condition     = contains([10, 30], var.health_check_interval)
    error_message = "Health check interval must be either 10 or 30 seconds as per Route53 specifications"
  }
}

# Health check type variable with validation
variable "health_check_type" {
  type        = string
  description = "Type of health check to perform (HTTP, HTTPS, or TCP)"
  default     = "HTTPS"

  validation {
    condition     = contains(["HTTP", "HTTPS", "TCP"], var.health_check_type)
    error_message = "Health check type must be one of HTTP, HTTPS, or TCP"
  }
}

# API Gateway endpoint variable
variable "api_endpoint" {
  type        = string
  description = "API Gateway endpoint for the billing system health checks"
}

# API Gateway zone ID variable
variable "api_zone_id" {
  type        = string
  description = "Zone ID of the API Gateway endpoint for alias records"
}

# Failover routing configuration variable
variable "failover_enabled" {
  type        = bool
  description = "Enable DNS failover routing between primary and DR regions"
  default     = true
}

# Resource tagging variable with default values
variable "tags" {
  type        = map(string)
  description = "Tags to apply to Route53 resources"
  default = {
    Service     = "DNS"
    Component   = "Route53"
    Environment = "Production"
    ManagedBy   = "Terraform"
    Project     = "OTPless-Billing"
  }
}