# Backend configuration for OTPless Internal Billing System
# Terraform ~> 1.5.x
# Implements secure state management with encryption, versioning, and access controls

terraform {
  # S3 backend configuration with enhanced security controls
  backend "s3" {
    # State file storage configuration
    bucket = "otpless-billing-terraform-state"
    key    = "infrastructure/${var.environment}/${var.project}/terraform.tfstate"
    region = "ap-south-1"

    # Security and encryption configuration
    encrypt        = true
    kms_key_id    = "aws/s3"
    acl           = "private"
    sse_algorithm = "aws:kms"

    # State locking configuration using DynamoDB
    dynamodb_table = "otpless-billing-terraform-locks"

    # State file versioning and organization
    versioning            = true
    workspace_key_prefix  = "workspaces"

    # Additional security controls
    force_path_style               = false
    skip_credentials_validation    = false
    skip_region_validation        = false
    skip_metadata_api_check       = false
    skip_requesting_account_id    = false

    # Custom endpoint configuration (if needed)
    endpoint                      = null
    
    # Access logging configuration
    access_log {
      target_bucket = "otpless-billing-terraform-logs"
      target_prefix = "state-access-logs/"
    }
  }

  # Required providers configuration
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Terraform version constraint
  required_version = ">= 1.5.0"
}

# Local backend configuration validation
locals {
  backend_validation = {
    environment_valid = contains(["production", "staging", "development"], var.environment)
    project_valid     = can(regex("^[a-z0-9-]+$", var.project))
  }

  # Validate backend configuration
  validate_backend = {
    environment_check = regex("^(production|staging|development)$", var.environment)
    project_check    = regex("^[a-z0-9-]+$", var.project)
  }
}