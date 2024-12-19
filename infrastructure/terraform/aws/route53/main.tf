# AWS Route53 Configuration for OTPless Internal Billing System
# Provider version: hashicorp/aws ~> 5.0

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Primary hosted zone configuration with DNSSEC enabled
resource "aws_route53_zone" "primary" {
  name    = var.domain_name
  comment = "Primary DNS zone for OTPless Internal Billing System"

  # Enable DNSSEC for enhanced security
  enable_dnssec = true
  
  # Prevent accidental deletion
  force_destroy = false

  tags = merge(
    var.tags,
    {
      Name = "otpless-billing-primary-zone"
    }
  )
}

# DNSSEC key signing configuration
resource "aws_route53_key_signing_key" "primary" {
  hosted_zone_id             = aws_route53_zone.primary.id
  key_management_service_arn = aws_kms_key.dnssec.arn
  name                      = "primary-key"
}

# Enable DNSSEC signing
resource "aws_route53_hosted_zone_dnssec" "primary" {
  hosted_zone_id = aws_route53_zone.primary.id
}

# Primary region health check configuration
resource "aws_route53_health_check" "primary_region" {
  fqdn              = "api.${var.domain_name}"
  port              = 443
  type              = var.health_check_type
  resource_path     = "/health"
  failure_threshold = 3
  request_interval  = var.health_check_interval
  
  # Enable advanced monitoring features
  measure_latency = true
  regions         = ["us-east-1", "eu-west-1", "ap-southeast-1"]
  enable_sni      = true
  search_string   = "healthy"

  tags = merge(
    var.tags,
    {
      Name   = "primary-region-health-check"
      Region = "Primary"
    }
  )
}

# Secondary (DR) region health check configuration
resource "aws_route53_health_check" "secondary_region" {
  fqdn              = "api-dr.${var.domain_name}"
  port              = 443
  type              = var.health_check_type
  resource_path     = "/health"
  failure_threshold = 2
  request_interval  = var.health_check_interval
  
  measure_latency = true
  regions         = ["us-west-2", "ap-southeast-2", "eu-central-1"]
  enable_sni      = true
  search_string   = "healthy"

  tags = merge(
    var.tags,
    {
      Name   = "secondary-region-health-check"
      Region = "Secondary"
    }
  )
}

# Primary API endpoint record with failover routing
resource "aws_route53_record" "api_primary" {
  zone_id = aws_route53_zone.primary.zone_id
  name    = "api"
  type    = "A"

  alias {
    name                   = var.api_endpoint
    zone_id               = var.api_zone_id
    evaluate_target_health = true
  }

  set_identifier = "primary"
  health_check_id = aws_route53_health_check.primary_region.id
  
  failover_routing_policy {
    type = "PRIMARY"
  }
}

# Secondary (DR) API endpoint record with failover routing
resource "aws_route53_record" "api_secondary" {
  zone_id = aws_route53_zone.primary.zone_id
  name    = "api"
  type    = "A"

  alias {
    name                   = var.api_endpoint
    zone_id               = var.api_zone_id
    evaluate_target_health = true
  }

  set_identifier = "secondary"
  health_check_id = aws_route53_health_check.secondary_region.id
  
  failover_routing_policy {
    type = "SECONDARY"
  }
}

# Web application record
resource "aws_route53_record" "web" {
  zone_id = aws_route53_zone.primary.zone_id
  name    = "billing"
  type    = "A"

  alias {
    name                   = var.web_endpoint
    zone_id               = var.web_zone_id
    evaluate_target_health = true
  }
}

# Output definitions for reference
output "zone_id" {
  description = "ID of the primary Route53 hosted zone"
  value       = aws_route53_zone.primary.zone_id
}

output "name_servers" {
  description = "List of name servers for the hosted zone"
  value       = aws_route53_zone.primary.name_servers
}

output "health_check_ids" {
  description = "IDs of the configured health checks"
  value = {
    primary   = aws_route53_health_check.primary_region.id
    secondary = aws_route53_health_check.secondary_region.id
  }
}