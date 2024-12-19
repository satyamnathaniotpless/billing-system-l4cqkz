# AWS Provider configuration
# Version: ~> 5.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for common configurations
locals {
  common_tags = merge(
    var.tags,
    {
      Environment = var.environment
      ManagedBy   = "terraform"
      Service     = "storage"
    }
  )
  
  bucket_prefix = "${var.project_name}-${var.environment}"
}

# Invoice Storage Bucket
resource "aws_s3_bucket" "invoice_bucket" {
  bucket        = "${local.bucket_prefix}-invoices"
  force_destroy = var.force_destroy

  tags = merge(
    local.common_tags,
    {
      Name = "${local.bucket_prefix}-invoices"
      Type = "invoice-storage"
    }
  )
}

# Invoice Bucket Versioning
resource "aws_s3_bucket_versioning" "invoice_versioning" {
  bucket = aws_s3_bucket.invoice_bucket.id
  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Disabled"
  }
}

# Invoice Bucket Encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "invoice_encryption" {
  bucket = aws_s3_bucket.invoice_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = data.aws_kms_key.kms_key.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

# Invoice Bucket Lifecycle Rules
resource "aws_s3_bucket_lifecycle_configuration" "invoice_lifecycle" {
  bucket = aws_s3_bucket.invoice_bucket.id

  rule {
    id     = "invoice-lifecycle"
    status = "Enabled"

    transition {
      days          = var.invoice_retention_days
      storage_class = "INTELLIGENT_TIERING"
    }

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }
  }
}

# Backup Storage Bucket
resource "aws_s3_bucket" "backup_bucket" {
  bucket        = "${local.bucket_prefix}-backups"
  force_destroy = var.force_destroy

  tags = merge(
    local.common_tags,
    {
      Name = "${local.bucket_prefix}-backups"
      Type = "backup-storage"
    }
  )
}

# Backup Bucket Versioning
resource "aws_s3_bucket_versioning" "backup_versioning" {
  bucket = aws_s3_bucket.backup_bucket.id
  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Disabled"
  }
}

# Backup Bucket Encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "backup_encryption" {
  bucket = aws_s3_bucket.backup_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = data.aws_kms_key.kms_key.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

# Backup Bucket Lifecycle Rules
resource "aws_s3_bucket_lifecycle_configuration" "backup_lifecycle" {
  bucket = aws_s3_bucket.backup_bucket.id

  rule {
    id     = "backup-lifecycle"
    status = "Enabled"

    transition {
      days          = var.backup_retention_days
      storage_class = "GLACIER"
    }

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "GLACIER"
    }

    expiration {
      days = 365
    }
  }
}

# Public Access Block for all buckets
resource "aws_s3_bucket_public_access_block" "invoice_public_access_block" {
  bucket = aws_s3_bucket.invoice_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "backup_public_access_block" {
  bucket = aws_s3_bucket.backup_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Cross-Region Replication Role
resource "aws_iam_role" "replication" {
  name = "${local.bucket_prefix}-s3-replication"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

# Replication configuration for invoice bucket
resource "aws_s3_bucket_replication_configuration" "invoice_replication" {
  depends_on = [aws_s3_bucket_versioning.invoice_versioning]

  role   = aws_iam_role.replication.arn
  bucket = aws_s3_bucket.invoice_bucket.id

  rule {
    id     = "invoice-replication"
    status = "Enabled"

    destination {
      bucket        = "arn:aws:s3:::${local.bucket_prefix}-invoices-replica"
      storage_class = "STANDARD_IA"

      encryption_configuration {
        replica_kms_key_id = data.aws_kms_key.replica_kms_key.arn
      }
    }

    source_selection_criteria {
      sse_kms_encrypted_objects {
        status = "Enabled"
      }
    }
  }
}

# Outputs
output "invoice_bucket_id" {
  description = "ID of the invoice storage bucket"
  value       = aws_s3_bucket.invoice_bucket.id
}

output "invoice_bucket_arn" {
  description = "ARN of the invoice storage bucket"
  value       = aws_s3_bucket.invoice_bucket.arn
}

output "backup_bucket_id" {
  description = "ID of the backup storage bucket"
  value       = aws_s3_bucket.backup_bucket.id
}

output "backup_bucket_arn" {
  description = "ARN of the backup storage bucket"
  value       = aws_s3_bucket.backup_bucket.arn
}