# AWS Provider configuration
# Provider version: ~> 5.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for resource naming and tagging
locals {
  distribution_name = "${var.project_name}-${var.environment}-cdn"
  common_tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    Component   = "cloudfront"
  }
}

# Data source for WAF ACL
data "aws_wafv2_web_acl" "main" {
  count = var.enable_waf ? 1 : 0
  name  = "${var.project_name}-${var.environment}-waf"
  scope = "CLOUDFRONT"
}

# Data source for S3 origin bucket
data "aws_s3_bucket" "origin" {
  bucket = "${var.project_name}-${var.environment}-origin"
}

# Data source for SSL certificate
data "aws_acm_certificate" "domain" {
  domain      = "*.${var.domain_name}"
  statuses    = ["ISSUED"]
  provider    = aws.us-east-1  # ACM certificates for CloudFront must be in us-east-1
  most_recent = true
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "CDN distribution for ${var.project_name} ${var.environment}"
  price_class         = var.price_class
  aliases             = ["${var.project_name}-${var.environment}.${var.domain_name}"]
  web_acl_id          = var.enable_waf ? data.aws_wafv2_web_acl.main[0].arn : null
  
  # Origin configuration
  origin {
    domain_name = data.aws_s3_bucket.origin.bucket_regional_domain_name
    origin_id   = "S3-${var.project_name}-${var.environment}"
    
    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.main.cloudfront_access_identity_path
    }
    
    custom_header {
      name  = "X-Origin-Verify"
      value = random_password.origin_verify.result
    }
  }

  # Default cache behavior for static content
  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${var.project_name}-${var.environment}"
    viewer_protocol_policy = "redirect-to-https"
    compress              = true
    
    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = var.min_ttl
    default_ttl = var.default_ttl
    max_ttl     = var.max_ttl
    
    # Security headers
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security_headers.id
  }

  # API endpoint cache behavior
  ordered_cache_behavior {
    path_pattern           = "/api/*"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${var.project_name}-${var.environment}"
    viewer_protocol_policy = "https-only"
    compress              = true

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"]
      cookies {
        forward = "all"
      }
    }

    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 0
  }

  # Custom error responses for SPA
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  # Access logging configuration
  dynamic "logging_config" {
    for_each = var.enable_logging ? [1] : []
    content {
      bucket          = var.logging_config.bucket
      prefix          = var.logging_config.prefix
      include_cookies = false
    }
  }

  # SSL/TLS configuration
  viewer_certificate {
    acm_certificate_arn      = data.aws_acm_certificate.domain.arn
    ssl_support_method       = var.ssl_support_method
    minimum_protocol_version = var.minimum_protocol_version
  }

  # Geo-restriction configuration
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = merge(local.common_tags, var.tags)
}

# Origin Access Identity for S3
resource "aws_cloudfront_origin_access_identity" "main" {
  comment = "OAI for ${local.distribution_name}"
}

# Security Headers Policy
resource "aws_cloudfront_response_headers_policy" "security_headers" {
  name    = "${local.distribution_name}-security-headers"
  comment = "Security headers policy for ${var.project_name} ${var.environment}"

  security_headers_config {
    content_security_policy {
      content_security_policy = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
      override = true
    }
    
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      preload                    = true
      override                   = true
    }
    
    content_type_options {
      override = true
    }
    
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    
    referrer_policy {
      referrer_policy = "same-origin"
      override        = true
    }
    
    xss_protection {
      mode_block = true
      protection = true
      override   = true
    }
  }
}

# Random password for origin verification header
resource "random_password" "origin_verify" {
  length  = 32
  special = false
}

# Outputs
output "cloudfront_distribution_id" {
  value       = aws_cloudfront_distribution.main.id
  description = "The identifier for the CloudFront distribution"
}

output "cloudfront_distribution_arn" {
  value       = aws_cloudfront_distribution.main.arn
  description = "The ARN for the CloudFront distribution"
}

output "cloudfront_domain_name" {
  value       = aws_cloudfront_distribution.main.domain_name
  description = "The domain name of the CloudFront distribution"
}