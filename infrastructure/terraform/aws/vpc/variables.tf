# Core Terraform functionality for variable definitions and validation blocks
# Version: ~> 1.5

variable "vpc_cidr" {
  description = "CIDR block for the VPC, must be a valid private network range"
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition = can(regex("^([0-9]{1,3}\\.){3}[0-9]{1,3}/[0-9]{1,2}$", var.vpc_cidr)) && 
                can(cidrhost(var.vpc_cidr, 0)) && 
                !contains(["172.16.0.0/12", "192.168.0.0/16"], var.vpc_cidr)
    error_message = "VPC CIDR block must be a valid IPv4 CIDR notation in private address space, excluding common ranges"
  }
}

variable "environment" {
  description = "Environment name for resource tagging and isolation"
  type        = string
  default     = "production"

  validation {
    condition     = contains(["development", "staging", "production"], lower(var.environment))
    error_message = "Environment must be one of: development, staging, production (case-insensitive)"
  }
}

variable "availability_zones" {
  description = "List of availability zones for multi-AZ high availability deployment"
  type        = list(string)

  validation {
    condition     = length(var.availability_zones) >= 2 && alltrue([for az in var.availability_zones : can(regex("^[a-z]{2}-[a-z]+-\\d[a-z]$", az))])
    error_message = "At least two valid AWS availability zones must be specified in the format: region-az (e.g., us-east-1a)"
  }
}

variable "enable_dns_hostnames" {
  description = "Enable DNS hostnames in the VPC for service discovery"
  type        = bool
  default     = true

  validation {
    condition     = var.enable_dns_hostnames == true
    error_message = "DNS hostnames must be enabled for proper service discovery and compliance requirements"
  }
}

variable "enable_dns_support" {
  description = "Enable DNS support in the VPC for name resolution"
  type        = bool
  default     = true

  validation {
    condition     = var.enable_dns_support == true
    error_message = "DNS support must be enabled for proper network functionality"
  }
}

variable "enable_nat_gateway" {
  description = "Enable NAT Gateway for private subnet internet access"
  type        = bool
  default     = true

  validation {
    condition     = var.environment == "development" ? true : var.enable_nat_gateway == true
    error_message = "NAT Gateway must be enabled in non-development environments for security compliance"
  }
}

variable "tags" {
  description = "Common tags to be applied to all resources for compliance and tracking"
  type        = map(string)
  default = {
    Project             = "OTPless Billing System"
    ManagedBy          = "Terraform"
    Environment        = "production"
    SecurityCompliance = "high"
    DataClassification = "sensitive"
    CostCenter         = "billing-infrastructure"
    BackupPolicy       = "required"
    MaintenanceWindow  = "sunday-01:00-UTC"
  }
}