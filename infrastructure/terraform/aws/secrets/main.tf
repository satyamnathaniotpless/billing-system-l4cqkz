# AWS Secrets Manager Configuration for OTPless Internal Billing System
# Version: ~> 5.0
# Purpose: Manages secure storage and rotation of critical credentials with PCI DSS and ISO 27001 compliance

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Data source for current AWS account ID
data "aws_caller_identity" "current" {}

# Reference to KMS encryption key from kms module
data "aws_kms_key" "billing_encryption_key" {
  key_id = "alias/${var.project}-${var.environment}-billing"
}

# Database credentials secret
resource "aws_secretsmanager_secret" "database_credentials" {
  name        = "${var.project}-${var.environment}-db-credentials"
  description = "PCI DSS compliant database credentials with automated rotation"
  kms_key_id  = data.aws_kms_key.billing_encryption_key.arn

  # Compliance requirement: minimum recovery window
  recovery_window_in_days = 30

  # Cross-region replication for disaster recovery
  replica {
    region = "us-west-2"
  }

  tags = {
    Name                = "database-credentials"
    Environment         = var.environment
    Project            = var.project
    SecurityCompliance = "PCI-DSS,ISO-27001"
    DataClassification = "Critical"
    ManagedBy         = "Terraform"
    RotationEnabled   = "true"
  }
}

# API keys secret
resource "aws_secretsmanager_secret" "api_keys" {
  name        = "${var.project}-${var.environment}-api-keys"
  description = "PCI DSS compliant API key storage with automated rotation"
  kms_key_id  = data.aws_kms_key.billing_encryption_key.arn

  # Compliance requirement: minimum recovery window
  recovery_window_in_days = 30

  # Cross-region replication for disaster recovery
  replica {
    region = "us-west-2"
  }

  tags = {
    Name                = "api-keys"
    Environment         = var.environment
    Project            = var.project
    SecurityCompliance = "PCI-DSS,ISO-27001"
    DataClassification = "Critical"
    ManagedBy         = "Terraform"
    RotationEnabled   = "true"
  }
}

# Database credentials rotation configuration
resource "aws_secretsmanager_secret_rotation" "database_credentials_rotation" {
  secret_id           = aws_secretsmanager_secret.database_credentials.id
  rotation_lambda_arn = aws_lambda_function.secret_rotation_lambda.arn

  rotation_rules {
    automatically_after_days = 90 # PCI DSS compliance requirement
  }
}

# API keys rotation configuration
resource "aws_secretsmanager_secret_rotation" "api_keys_rotation" {
  secret_id           = aws_secretsmanager_secret.api_keys.id
  rotation_lambda_arn = aws_lambda_function.secret_rotation_lambda.arn

  rotation_rules {
    automatically_after_days = 90 # PCI DSS compliance requirement
  }
}

# Secret access policy with strict IAM controls
resource "aws_secretsmanager_secret_policy" "secret_access_policy" {
  secret_arn = aws_secretsmanager_secret.database_credentials.arn
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EnableIAMUserPermissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
          "secretsmanager:ListSecretVersionIds"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:PrincipalTag/Environment" = var.environment
          }
        }
      },
      {
        Sid    = "DenyDeleteSecret"
        Effect = "Deny"
        Principal = {
          AWS = "*"
        }
        Action = [
          "secretsmanager:DeleteSecret"
        ]
        Resource = "*"
        Condition = {
          StringNotEquals = {
            "aws:PrincipalTag/Role" = "SecurityAdmin"
          }
        }
      }
    ]
  })
}

# Outputs for secret ARNs and IDs
output "database_credentials_arn" {
  description = "ARN of the database credentials secret"
  value       = aws_secretsmanager_secret.database_credentials.arn
}

output "database_credentials_id" {
  description = "ID of the database credentials secret"
  value       = aws_secretsmanager_secret.database_credentials.id
}

output "api_keys_arn" {
  description = "ARN of the API keys secret"
  value       = aws_secretsmanager_secret.api_keys.arn
}

output "api_keys_id" {
  description = "ID of the API keys secret"
  value       = aws_secretsmanager_secret.api_keys.id
}