"""
Configuration management module for the OTPless Internal Billing System's Invoice Service.
Handles environment variables, secrets, and service configuration with comprehensive validation.

Uses Pydantic for settings management with strong typing and validation.
"""

# pydantic-settings v2.0.0
from pydantic_settings import BaseSettings
# pydantic v2.0.0
from pydantic import SecretStr, Field, validator
from typing import List, Dict, Optional
import os
from pathlib import Path

class Settings(BaseSettings):
    """
    Configuration settings for the Invoice Service with comprehensive validation and security measures.
    All sensitive values are handled using SecretStr for secure string management.
    """
    
    # Application Settings
    APP_NAME: str = Field(
        default="OTPless Invoice Service",
        description="Name of the service"
    )
    APP_VERSION: str = Field(
        default="1.0.0",
        description="Service version"
    )
    ENV: str = Field(
        default="development",
        description="Deployment environment",
        regex="^(development|staging|production)$"
    )
    
    # API Settings
    API_PREFIX: str = Field(
        default="/api/v1",
        description="API route prefix"
    )
    ALLOWED_HOSTS: List[str] = Field(
        default=["localhost", "127.0.0.1"],
        description="List of allowed hosts"
    )
    CORS_ORIGINS: List[str] = Field(
        default=["http://localhost:3000"],
        description="Allowed CORS origins"
    )
    
    # Security Settings
    JWT_SECRET_KEY: SecretStr = Field(
        ...,
        description="Secret key for JWT signing",
        min_length=32
    )
    JWT_ALGORITHM: str = Field(
        default="RS256",
        description="JWT signing algorithm"
    )
    JWT_EXPIRY_MINUTES: int = Field(
        default=30,
        description="JWT token expiry in minutes",
        ge=5,
        le=60
    )
    
    # Database Settings
    DATABASE_URL: str = Field(
        ...,
        description="PostgreSQL connection URL",
        regex="^postgresql://.*$"
    )
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection URL",
        regex="^redis://.*$"
    )
    
    # AWS Settings
    S3_BUCKET_NAME: str = Field(
        ...,
        description="S3 bucket for invoice storage"
    )
    AWS_ACCESS_KEY_ID: str = Field(
        ...,
        description="AWS access key ID"
    )
    AWS_SECRET_ACCESS_KEY: SecretStr = Field(
        ...,
        description="AWS secret access key"
    )
    AWS_REGION: str = Field(
        default="us-east-1",
        description="AWS region for services"
    )
    
    # Invoice Settings
    SUPPORTED_CURRENCIES: List[str] = Field(
        default=["USD", "INR", "IDR"],
        description="Supported billing currencies"
    )
    INVOICE_NUMBER_PREFIX: int = Field(
        default=1000,
        description="Starting invoice number prefix",
        ge=1000
    )
    PDF_TEMPLATE_PATH: str = Field(
        default="templates/invoice.html",
        description="Path to invoice PDF template"
    )

    @validator("PDF_TEMPLATE_PATH")
    def validate_template_path(cls, v: str) -> str:
        """Validates that the PDF template file exists."""
        path = Path(v)
        if not path.exists():
            raise ValueError(f"Template file not found: {v}")
        return str(path)

    @validator("DATABASE_URL")
    def validate_database_url(cls, v: str) -> str:
        """Validates database URL format and basic connectivity requirements."""
        if not v.startswith("postgresql://"):
            raise ValueError("Database URL must be a PostgreSQL connection string")
        return v

    @validator("AWS_REGION")
    def validate_aws_region(cls, v: str) -> str:
        """Validates AWS region format."""
        valid_regions = [
            "us-east-1", "us-east-2", "us-west-1", "us-west-2",
            "ap-south-1", "ap-southeast-1", "ap-southeast-2",
            "eu-west-1", "eu-central-1"
        ]
        if v not in valid_regions:
            raise ValueError(f"Invalid AWS region. Must be one of: {', '.join(valid_regions)}")
        return v

    class Config:
        """Pydantic model configuration."""
        case_sensitive = True
        env_prefix = "INVOICE_SVC_"
        validate_assignment = True
        extra = "forbid"
        frozen = True

# Global settings instance
_settings_instance: Optional[Settings] = None

def get_settings() -> Settings:
    """
    Factory function to get or create a validated Settings instance.
    Implements singleton pattern for settings management.
    
    Returns:
        Settings: Validated settings instance
    """
    global _settings_instance
    if _settings_instance is None:
        _settings_instance = Settings()
    return _settings_instance