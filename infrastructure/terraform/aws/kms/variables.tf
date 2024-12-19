# Terraform AWS KMS Variables
# Version: ~> 1.5
# Purpose: Defines variables for AWS KMS configuration used in the OTPless Internal Billing System

variable "environment" {
  type        = string
  description = "Environment name for resource tagging and key isolation (e.g., dev, staging, prod). Used to ensure proper separation of encryption keys across environments."

  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be one of: dev, staging, prod. This ensures consistent environment naming and key isolation."
  }
}

variable "project" {
  type        = string
  description = "Project name for resource tagging and key alias prefixing. Used to organize and identify KMS keys belonging to the OTPless billing system."
  default     = "otpless-billing"
}

variable "deletion_window_days" {
  type        = number
  description = "Duration in days before KMS key is deleted after being scheduled for deletion. Must comply with security policies and provide adequate time for key recovery if needed."
  default     = 30

  validation {
    condition     = var.deletion_window_days >= 7 && var.deletion_window_days <= 30
    error_message = "Deletion window must be between 7 and 30 days to ensure compliance with security requirements and provide adequate recovery time."
  }
}

variable "key_rotation_enabled" {
  type        = bool
  description = "Enable automatic key rotation for KMS keys. Recommended to be enabled for enhanced security and compliance with key management best practices."
  default     = true
}

variable "key_spec" {
  type        = string
  description = "Specifies whether the key contains a symmetric key or an asymmetric key pair. Supports FIPS 140-2 compliant encryption algorithms for different security requirements."
  default     = "SYMMETRIC_DEFAULT"

  validation {
    condition = can(regex("^(SYMMETRIC_DEFAULT|RSA_2048|RSA_3072|RSA_4096|ECC_NIST_P256|ECC_NIST_P384|ECC_NIST_P521|ECC_SECG_P256K1)$", var.key_spec))
    error_message = "Key spec must be one of: SYMMETRIC_DEFAULT, RSA_2048, RSA_3072, RSA_4096, ECC_NIST_P256, ECC_NIST_P384, ECC_NIST_P521, ECC_SECG_P256K1. These specifications ensure FIPS 140-2 compliance."
  }
}