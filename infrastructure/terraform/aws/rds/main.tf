# AWS Provider configuration for RDS deployment
# Version: ~> 5.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Parameter group for PostgreSQL optimization
resource "aws_db_parameter_group" "parameter_group" {
  family = "postgres15"
  name   = "otpless-billing-pg15"

  parameter {
    name  = "max_connections"
    value = "1000"
  }

  parameter {
    name  = "shared_buffers"
    value = "{DBInstanceClassMemory/32768}MB"
  }

  parameter {
    name  = "work_mem"
    value = "64MB"
  }

  parameter {
    name  = "maintenance_work_mem"
    value = "256MB"
  }

  parameter {
    name  = "effective_cache_size"
    value = "{DBInstanceClassMemory/16384}MB"
  }

  parameter {
    name  = "ssl"
    value = "1"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  tags = {
    Name        = "otpless-billing-pg15"
    Environment = "production"
    ManagedBy   = "terraform"
  }
}

# Subnet group for multi-AZ deployment
resource "aws_db_subnet_group" "subnet_group" {
  name       = "otpless-billing-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name        = "otpless-billing-subnet-group"
    Environment = "production"
    ManagedBy   = "terraform"
  }
}

# Primary RDS instance with high availability
resource "aws_db_instance" "rds_instance" {
  identifier     = var.db_identifier
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = var.db_instance_class

  # Storage configuration
  allocated_storage     = 100
  max_allocated_storage = 1000
  storage_type         = "gp3"
  storage_encrypted    = true
  kms_key_id          = var.kms_key_arn

  # Database configuration
  db_name  = "otpless_billing"
  username = var.db_username
  password = var.db_password

  # Network configuration
  db_subnet_group_name   = aws_db_subnet_group.subnet_group.name
  vpc_security_group_ids = var.db_security_group_ids
  multi_az              = true
  publicly_accessible   = false

  # Backup configuration
  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"
  copy_tags_to_snapshot  = true
  skip_final_snapshot    = false
  final_snapshot_identifier = "${var.db_identifier}-final"

  # Parameter and option groups
  parameter_group_name = aws_db_parameter_group.parameter_group.name

  # Monitoring configuration
  monitoring_interval = 30
  monitoring_role_arn = var.monitoring_role_arn
  performance_insights_enabled = true
  performance_insights_retention_period = 7
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  # Security configuration
  deletion_protection = true
  auto_minor_version_upgrade = true

  tags = {
    Name           = "otpless-billing-rds"
    Environment    = "production"
    ManagedBy      = "terraform"
    Backup         = "required"
    SecurityLevel  = "high"
    Project        = "OTPless-Billing"
    CostCenter     = "billing-infrastructure"
  }

  lifecycle {
    prevent_destroy = true
    ignore_changes = [
      password
    ]
  }
}

# Outputs for reference in other resources
output "rds_endpoint" {
  description = "RDS instance endpoint for application connection"
  value       = aws_db_instance.rds_instance.endpoint
  sensitive   = true
}

output "rds_arn" {
  description = "ARN of the RDS instance for IAM and monitoring integration"
  value       = aws_db_instance.rds_instance.arn
}

output "rds_id" {
  description = "Identifier of the RDS instance for reference in other resources"
  value       = aws_db_instance.rds_instance.id
}

output "rds_resource_id" {
  description = "Resource ID for enhanced monitoring and performance insights"
  value       = aws_db_instance.rds_instance.resource_id
}