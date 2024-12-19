# Provider configuration for OTPless Internal Billing System
# Terraform >= 1.5.0
# AWS Provider ~> 5.0

terraform {
  # Terraform version constraint for infrastructure stability
  required_version = ">= 1.5.0"

  # Required provider configuration with security constraints
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend configuration should be provided separately for security
  backend "s3" {}
}

# Primary region provider configuration with enhanced security features
provider "aws" {
  region = var.aws_region

  # Default tags for resource tracking and compliance
  default_tags {
    Environment         = var.environment
    Project            = var.project
    ManagedBy          = "Terraform"
    SecurityLevel      = "High"
    DataClassification = "Sensitive"
    BackupRequired     = "True"
    ComplianceLevel    = "PCI-DSS"
    LastUpdated        = timestamp()
  }

  # Enhanced retry configuration for improved reliability
  retry_mode  = "adaptive"
  max_retries = 5

  # Security and compliance settings
  assume_role {
    role_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/TerraformExecutionRole"
    session_name = "TerraformProvisioningSession"
  }
}

# Disaster Recovery (DR) region provider configuration
provider "aws" {
  alias  = "dr"
  region = var.dr_region
  count  = var.enable_dr ? 1 : 0

  # Default tags specific to DR region
  default_tags {
    Environment         = var.environment
    Project            = var.project
    ManagedBy          = "Terraform"
    SecurityLevel      = "High"
    DataClassification = "Sensitive"
    BackupRequired     = "True"
    FailoverRegion     = "True"
    ComplianceLevel    = "PCI-DSS"
    LastUpdated        = timestamp()
  }

  # Enhanced retry configuration for DR region
  retry_mode  = "adaptive"
  max_retries = 5

  # Security and compliance settings for DR region
  assume_role {
    role_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/TerraformExecutionRole-DR"
    session_name = "TerraformProvisioningSession-DR"
  }
}

# Data source for current AWS account information
data "aws_caller_identity" "current" {}

# Data source for current AWS region information
data "aws_region" "current" {}

# Provider feature flags for enhanced security
provider "aws" {
  alias = "security_features"

  # Enable security features
  default_tags {
    SecurityFeatures = "Enhanced"
  }

  # Security-related settings
  ignore_tags {
    key_prefixes = ["aws:"]
  }
}