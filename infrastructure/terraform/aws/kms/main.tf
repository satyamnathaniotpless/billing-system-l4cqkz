# AWS KMS Configuration for OTPless Internal Billing System
# Version: ~> 5.0
# Purpose: Manages KMS keys for secure data encryption with FIPS 140-2 compliance

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# KMS key for billing and invoice data encryption
resource "aws_kms_key" "billing_encryption_key" {
  description              = "KMS key for billing data encryption"
  deletion_window_in_days  = var.deletion_window_days
  key_usage               = "ENCRYPT_DECRYPT"
  customer_master_key_spec = var.key_spec
  enable_key_rotation     = var.key_rotation_enabled
  
  # Multi-region is disabled as per specification
  multi_region = false

  # Policy document for key access control
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "*"
        }
        Action = [
          "kms:*"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:PrincipalOrgID": data.aws_organizations_organization.current.id
          }
        }
      }
    ]
  })

  tags = {
    Name                = "billing-encryption-key"
    Environment         = var.environment
    Project            = var.project
    SecurityLevel      = "Critical"
    ComplianceStandard = "FIPS140-2"
    ManagedBy          = "Terraform"
    Purpose            = "BillingDataEncryption"
  }
}

# KMS key for wallet and transaction data encryption
resource "aws_kms_key" "wallet_encryption_key" {
  description              = "KMS key for wallet data encryption"
  deletion_window_in_days  = var.deletion_window_days
  key_usage               = "ENCRYPT_DECRYPT"
  customer_master_key_spec = var.key_spec
  enable_key_rotation     = var.key_rotation_enabled
  
  # Multi-region is disabled as per specification
  multi_region = false

  # Policy document for key access control
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "*"
        }
        Action = [
          "kms:*"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:PrincipalOrgID": data.aws_organizations_organization.current.id
          }
        }
      }
    ]
  })

  tags = {
    Name                = "wallet-encryption-key"
    Environment         = var.environment
    Project            = var.project
    SecurityLevel      = "Critical"
    ComplianceStandard = "FIPS140-2"
    ManagedBy          = "Terraform"
    Purpose            = "WalletDataEncryption"
  }
}

# Alias for billing encryption key
resource "aws_kms_alias" "billing_key_alias" {
  name          = "alias/${var.project}-${var.environment}-billing"
  target_key_id = aws_kms_key.billing_encryption_key.key_id
}

# Alias for wallet encryption key
resource "aws_kms_alias" "wallet_key_alias" {
  name          = "alias/${var.project}-${var.environment}-wallet"
  target_key_id = aws_kms_key.wallet_encryption_key.key_id
}

# Data source for AWS Organizations
data "aws_organizations_organization" "current" {}

# Outputs for key IDs and ARNs
output "billing_encryption_key_id" {
  description = "ID of the KMS key used for billing data encryption"
  value       = aws_kms_key.billing_encryption_key.id
}

output "billing_encryption_key_arn" {
  description = "ARN of the KMS key used for billing data encryption"
  value       = aws_kms_key.billing_encryption_key.arn
}

output "wallet_encryption_key_id" {
  description = "ID of the KMS key used for wallet data encryption"
  value       = aws_kms_key.wallet_encryption_key.id
}

output "wallet_encryption_key_arn" {
  description = "ARN of the KMS key used for wallet data encryption"
  value       = aws_kms_key.wallet_encryption_key.arn
}