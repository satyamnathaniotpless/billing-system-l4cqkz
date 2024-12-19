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

# Main VPC Resource
resource "aws_vpc" "vpc" {
  cidr_block                           = var.vpc_cidr
  enable_dns_hostnames                 = true
  enable_dns_support                   = true
  enable_ipv6                          = false
  instance_tenancy                     = "default"
  enable_network_address_usage_metrics = true

  tags = merge(
    {
      Name          = "otpless-billing-vpc-${var.environment}"
      Environment   = var.environment
      Project       = "OTPless Billing System"
      ManagedBy     = "Terraform"
      SecurityZone  = "restricted"
      CreatedAt     = timestamp()
    },
    var.tags
  )
}

# Public Subnets
resource "aws_subnet" "public_subnets" {
  count                           = length(var.availability_zones)
  vpc_id                         = aws_vpc.vpc.id
  cidr_block                     = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone              = var.availability_zones[count.index]
  map_public_ip_on_launch       = true
  assign_ipv6_address_on_creation = false

  tags = merge(
    {
      Name                        = "otpless-public-subnet-${count.index + 1}"
      Environment                 = var.environment
      Type                        = "Public"
      "kubernetes.io/role/elb"    = "1"
      "kubernetes.io/cluster/otpless-billing" = "shared"
      ManagedBy                   = "Terraform"
      SubnetTier                  = "public"
    },
    var.tags
  )
}

# Private Subnets
resource "aws_subnet" "private_subnets" {
  count                           = length(var.availability_zones)
  vpc_id                         = aws_vpc.vpc.id
  cidr_block                     = cidrsubnet(var.vpc_cidr, 8, count.index + length(var.availability_zones))
  availability_zone              = var.availability_zones[count.index]
  map_public_ip_on_launch       = false
  assign_ipv6_address_on_creation = false

  tags = merge(
    {
      Name                        = "otpless-private-subnet-${count.index + 1}"
      Environment                 = var.environment
      Type                        = "Private"
      "kubernetes.io/role/internal-elb" = "1"
      "kubernetes.io/cluster/otpless-billing" = "shared"
      ManagedBy                   = "Terraform"
      SubnetTier                  = "private"
    },
    var.tags
  )
}

# Internet Gateway
resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.vpc.id

  tags = merge(
    {
      Name        = "otpless-igw-${var.environment}"
      Environment = var.environment
      ManagedBy   = "Terraform"
    },
    var.tags
  )
}

# Elastic IPs for NAT Gateways
resource "aws_eip" "nat" {
  count  = length(var.availability_zones)
  domain = "vpc"

  tags = merge(
    {
      Name        = "otpless-nat-eip-${count.index + 1}"
      Environment = var.environment
      ManagedBy   = "Terraform"
    },
    var.tags
  )

  depends_on = [aws_internet_gateway.igw]
}

# NAT Gateways
resource "aws_nat_gateway" "nat" {
  count         = length(var.availability_zones)
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public_subnets[count.index].id

  tags = merge(
    {
      Name        = "otpless-nat-${count.index + 1}"
      Environment = var.environment
      ManagedBy   = "Terraform"
    },
    var.tags
  )

  depends_on = [aws_internet_gateway.igw]
}

# Route Tables for Public Subnets
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }

  tags = merge(
    {
      Name        = "otpless-public-rt-${var.environment}"
      Environment = var.environment
      Type        = "Public"
      ManagedBy   = "Terraform"
    },
    var.tags
  )
}

# Route Tables for Private Subnets
resource "aws_route_table" "private" {
  count  = length(var.availability_zones)
  vpc_id = aws_vpc.vpc.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.nat[count.index].id
  }

  tags = merge(
    {
      Name        = "otpless-private-rt-${count.index + 1}"
      Environment = var.environment
      Type        = "Private"
      ManagedBy   = "Terraform"
    },
    var.tags
  )
}

# Route Table Associations for Public Subnets
resource "aws_route_table_association" "public" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.public_subnets[count.index].id
  route_table_id = aws_route_table.public.id
}

# Route Table Associations for Private Subnets
resource "aws_route_table_association" "private" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.private_subnets[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# VPC Flow Logs
resource "aws_flow_log" "vpc_flow_logs" {
  vpc_id                   = aws_vpc.vpc.id
  traffic_type            = "ALL"
  iam_role_arn           = aws_iam_role.vpc_flow_log_role.arn
  log_destination_type   = "cloud-watch-logs"
  log_destination        = aws_cloudwatch_log_group.vpc_flow_logs.arn
  max_aggregation_interval = 60

  tags = merge(
    {
      Name        = "otpless-vpc-flow-logs"
      Environment = var.environment
      ManagedBy   = "Terraform"
    },
    var.tags
  )
}

# CloudWatch Log Group for VPC Flow Logs
resource "aws_cloudwatch_log_group" "vpc_flow_logs" {
  name              = "/aws/vpc/flow-logs/${var.environment}"
  retention_in_days = 30

  tags = merge(
    {
      Name        = "otpless-vpc-flow-logs"
      Environment = var.environment
      ManagedBy   = "Terraform"
    },
    var.tags
  )
}

# IAM Role for VPC Flow Logs
resource "aws_iam_role" "vpc_flow_log_role" {
  name = "otpless-vpc-flow-log-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "vpc-flow-logs.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(
    {
      Name        = "otpless-vpc-flow-log-role"
      Environment = var.environment
      ManagedBy   = "Terraform"
    },
    var.tags
  )
}

# IAM Policy for VPC Flow Logs
resource "aws_iam_role_policy" "vpc_flow_log_policy" {
  name = "otpless-vpc-flow-log-policy-${var.environment}"
  role = aws_iam_role.vpc_flow_log_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ]
        Resource = "*"
      }
    ]
  })
}

# Outputs
output "vpc_id" {
  description = "ID of the created VPC"
  value       = aws_vpc.vpc.id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs for EKS and RDS deployment"
  value       = aws_subnet.private_subnets[*].id
}

output "public_subnet_ids" {
  description = "List of public subnet IDs for load balancers"
  value       = aws_subnet.public_subnets[*].id
}

output "nat_gateway_ips" {
  description = "List of NAT Gateway public IPs"
  value       = aws_eip.nat[*].public_ip
}