# AWS ElastiCache Redis Cluster Configuration
# Version: ~> 5.0
# Purpose: Provisions a production-grade Redis cluster for OTPless Internal Billing System

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Redis Subnet Group for multi-AZ deployment
resource "aws_elasticache_subnet_group" "redis_subnet_group" {
  name        = "otpless-redis-${var.environment}"
  description = "Redis subnet group for OTPless Billing System"
  subnet_ids  = data.terraform_remote_state.vpc.outputs.private_subnet_ids

  tags = {
    Name        = "otpless-redis-subnet-group"
    Environment = var.environment
    Project     = "OTPless Billing System"
    ManagedBy   = "Terraform"
  }
}

# Redis Parameter Group with optimized settings
resource "aws_elasticache_parameter_group" "redis_parameter_group" {
  family      = "redis7.0"
  name        = "otpless-redis-params-${var.environment}"
  description = "Redis parameter group for OTPless Billing System with optimized settings"

  # Memory management
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  # Event notification settings
  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"
  }

  # Connection settings
  parameter {
    name  = "timeout"
    value = "300"
  }

  parameter {
    name  = "tcp-keepalive"
    value = "300"
  }

  tags = {
    Name        = "otpless-redis-params"
    Environment = var.environment
    Project     = "OTPless Billing System"
    ManagedBy   = "Terraform"
  }
}

# Security Group for Redis cluster
resource "aws_security_group" "redis_security_group" {
  name        = "otpless-redis-sg-${var.environment}"
  description = "Security group for Redis cluster"
  vpc_id      = data.terraform_remote_state.vpc.outputs.vpc_id

  ingress {
    description = "Redis access from internal VPC"
    from_port   = var.redis_port
    to_port     = var.redis_port
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "otpless-redis-sg"
    Environment = var.environment
    Project     = "OTPless Billing System"
    ManagedBy   = "Terraform"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Redis Cluster
resource "aws_elasticache_cluster" "redis_cluster" {
  cluster_id           = "otpless-redis-${var.environment}"
  engine              = "redis"
  engine_version      = "7.0"
  node_type           = var.redis_node_type
  num_cache_nodes     = var.redis_num_cache_nodes
  parameter_group_name = aws_elasticache_parameter_group.redis_parameter_group.name
  subnet_group_name    = aws_elasticache_subnet_group.redis_subnet_group.name
  security_group_ids   = [aws_security_group.redis_security_group.id]
  port                = var.redis_port

  # Maintenance and backup settings
  maintenance_window    = var.maintenance_window
  snapshot_window      = var.snapshot_window
  snapshot_retention_limit = var.snapshot_retention_limit

  # High availability settings
  automatic_failover_enabled = true
  multi_az_enabled         = true

  # Security settings
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  # Update settings
  apply_immediately          = false
  auto_minor_version_upgrade = true

  tags = {
    Name             = "otpless-redis"
    Environment      = var.environment
    Project          = "OTPless Billing System"
    ManagedBy        = "Terraform"
    CostCenter       = "Billing"
    BackupRetention  = var.snapshot_retention_limit
  }

  lifecycle {
    prevent_destroy = true
    ignore_changes = [
      engine_version
    ]
  }
}

# Outputs for application configuration
output "redis_endpoint" {
  description = "Redis cluster endpoint address for application configuration"
  value       = aws_elasticache_cluster.redis_cluster.cache_nodes[0].address
  sensitive   = true
}

output "redis_port" {
  description = "Redis cluster port number for application configuration"
  value       = aws_elasticache_cluster.redis_cluster.port
}

output "redis_security_group_id" {
  description = "Security group ID for Redis cluster access control"
  value       = aws_security_group.redis_security_group.id
}