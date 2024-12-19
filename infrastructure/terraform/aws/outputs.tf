# OTPless Internal Billing System Infrastructure Outputs
# Version: 1.5.x
# Purpose: Expose critical infrastructure values for both primary and DR regions

# VPC Outputs
output "vpc_id" {
  description = "ID of the VPC hosting the OTPless Billing System infrastructure"
  value       = module.vpc.vpc_id
  sensitive   = false
}

output "private_subnet_ids" {
  description = "List of private subnet IDs where application components are deployed"
  value       = module.vpc.private_subnet_ids
  sensitive   = false
}

output "public_subnet_ids" {
  description = "List of public subnet IDs for load balancers and public-facing components"
  value       = module.vpc.public_subnet_ids
  sensitive   = false
}

# EKS Cluster Outputs
output "eks_cluster_endpoint" {
  description = "Endpoint URL for the EKS cluster API server"
  value       = module.eks.cluster_endpoint
  sensitive   = false
}

output "eks_cluster_certificate" {
  description = "Base64 encoded certificate authority data for the EKS cluster"
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}

output "eks_security_group_id" {
  description = "Security group ID associated with the EKS cluster"
  value       = module.eks.cluster_security_group_id
  sensitive   = false
}

# Primary Region RDS Outputs
output "primary_rds_endpoint" {
  description = "Connection endpoint for the primary RDS instance"
  value       = module.rds.rds_endpoint
  sensitive   = false
}

output "primary_rds_arn" {
  description = "ARN of the primary RDS instance for IAM and monitoring"
  value       = module.rds.rds_arn
  sensitive   = false
}

output "primary_rds_security_group_id" {
  description = "Security group ID associated with the primary RDS instance"
  value       = module.rds.rds_security_group_id
  sensitive   = false
}

# DR Region RDS Outputs (Conditional)
output "dr_rds_endpoint" {
  description = "Connection endpoint for the DR region RDS instance"
  value       = var.enable_dr ? module.dr_rds[0].rds_endpoint : null
  sensitive   = false
}

output "dr_rds_arn" {
  description = "ARN of the DR region RDS instance for IAM and monitoring"
  value       = var.enable_dr ? module.dr_rds[0].rds_arn : null
  sensitive   = false
}

output "dr_rds_security_group_id" {
  description = "Security group ID associated with the DR RDS instance"
  value       = var.enable_dr ? module.dr_rds[0].rds_security_group_id : null
  sensitive   = false
}

# Network Configuration Outputs
output "nat_gateway_ips" {
  description = "List of NAT Gateway public IPs for egress traffic"
  value       = module.vpc.nat_gateway_ips
  sensitive   = false
}

# Monitoring and Security Outputs
output "cloudwatch_log_group_arn" {
  description = "ARN of the CloudWatch Log Group for VPC flow logs"
  value       = module.vpc.cloudwatch_log_group_arn
  sensitive   = false
}

output "kms_key_arn" {
  description = "ARN of the KMS key used for RDS encryption"
  value       = module.rds.kms_key_arn
  sensitive   = true
}

# Tags Output
output "infrastructure_tags" {
  description = "Common tags applied to all infrastructure resources"
  value = {
    Project             = "OTPless Billing System"
    Environment         = "production"
    ManagedBy          = "Terraform"
    SecurityCompliance  = "high"
    DataClassification = "sensitive"
    CostCenter         = "billing-infrastructure"
  }
  sensitive = false
}