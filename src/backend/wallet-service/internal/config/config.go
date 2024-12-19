// Package config provides configuration management for the wallet service
// including database, cache, API and security settings with comprehensive validation
package config

import (
	"fmt"
	"os"
	"time"

	"github.com/spf13/viper" // v1.16.0
)

// Default configuration values
const (
	defaultDBPort         = 5432
	defaultRedisPort     = 6379
	defaultAPIPort       = 8080
	defaultConnTimeout   = time.Second * 30
	defaultRateLimitWindow = time.Minute
)

// Config represents the main configuration container for all service settings
type Config struct {
	Database DatabaseConfig
	Cache    RedisConfig
	API      APIConfig
	Security SecurityConfig
}

// DatabaseConfig holds PostgreSQL database configuration with connection pooling
type DatabaseConfig struct {
	Host            string
	Port            int
	User            string
	Password        string
	DBName          string
	SSLMode         string
	ConnTimeout     time.Duration
	MaxOpenConns    int
	MaxIdleConns    int
	MaxConnLifetime time.Duration
}

// RedisConfig holds Redis cache configuration with high availability settings
type RedisConfig struct {
	Host        string
	Port        int
	Password    string
	DB          int
	TTL         time.Duration
	ConnTimeout time.Duration
	MaxRetries  int
}

// APIConfig holds API server configuration with timeouts
type APIConfig struct {
	Host            string
	Port            int
	ReadTimeout     time.Duration
	WriteTimeout    time.Duration
	ShutdownTimeout time.Duration
	MaxRequestSize  int
}

// SecurityConfig holds security settings for authentication and rate limiting
type SecurityConfig struct {
	JWTSecret      string
	JWTExpiry      time.Duration
	RateLimit      int
	RateLimitWindow time.Duration
	EnableTLS      bool
	TLSCertPath    string
	TLSKeyPath     string
}

// LoadConfig loads and validates service configuration from files and environment variables
func LoadConfig(configPath string) (*Config, error) {
	v := viper.New()

	// Set configuration defaults
	setDefaults(v)

	// Configure viper
	v.SetConfigFile(configPath)
	v.AutomaticEnv()
	v.SetEnvPrefix("WALLET")

	// Read configuration file
	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("error reading config file: %w", err)
		}
	}

	// Initialize configuration struct
	config := &Config{}

	// Unmarshal configuration
	if err := v.Unmarshal(config); err != nil {
		return nil, fmt.Errorf("error unmarshaling config: %w", err)
	}

	// Validate configuration
	if err := validateConfig(config); err != nil {
		return nil, fmt.Errorf("config validation error: %w", err)
	}

	return config, nil
}

// setDefaults sets secure default values for all configuration options
func setDefaults(v *viper.Viper) {
	// Database defaults
	v.SetDefault("database.host", "localhost")
	v.SetDefault("database.port", defaultDBPort)
	v.SetDefault("database.sslmode", "verify-full")
	v.SetDefault("database.conntimeout", defaultConnTimeout)
	v.SetDefault("database.maxopenconns", 25)
	v.SetDefault("database.maxidleconns", 5)
	v.SetDefault("database.maxconnlifetime", time.Hour)

	// Redis defaults
	v.SetDefault("cache.host", "localhost")
	v.SetDefault("cache.port", defaultRedisPort)
	v.SetDefault("cache.db", 0)
	v.SetDefault("cache.ttl", time.Second*30)
	v.SetDefault("cache.conntimeout", defaultConnTimeout)
	v.SetDefault("cache.maxretries", 3)

	// API defaults
	v.SetDefault("api.host", "0.0.0.0")
	v.SetDefault("api.port", defaultAPIPort)
	v.SetDefault("api.readtimeout", time.Second*15)
	v.SetDefault("api.writetimeout", time.Second*15)
	v.SetDefault("api.shutdowntimeout", time.Second*30)
	v.SetDefault("api.maxrequestsize", 1<<20) // 1MB

	// Security defaults
	v.SetDefault("security.jwtexpiry", time.Hour)
	v.SetDefault("security.ratelimit", 100)
	v.SetDefault("security.ratelimitwindow", defaultRateLimitWindow)
	v.SetDefault("security.enabletls", true)
}

// validateConfig performs comprehensive validation of all configuration values
func validateConfig(config *Config) error {
	// Validate Database configuration
	if err := validateDatabaseConfig(&config.Database); err != nil {
		return fmt.Errorf("database config error: %w", err)
	}

	// Validate Redis configuration
	if err := validateRedisConfig(&config.Cache); err != nil {
		return fmt.Errorf("cache config error: %w", err)
	}

	// Validate API configuration
	if err := validateAPIConfig(&config.API); err != nil {
		return fmt.Errorf("api config error: %w", err)
	}

	// Validate Security configuration
	if err := validateSecurityConfig(&config.Security); err != nil {
		return fmt.Errorf("security config error: %w", err)
	}

	return nil
}

func validateDatabaseConfig(config *DatabaseConfig) error {
	if config.User == "" {
		return fmt.Errorf("database user is required")
	}
	if config.Password == "" {
		return fmt.Errorf("database password is required")
	}
	if config.DBName == "" {
		return fmt.Errorf("database name is required")
	}
	if config.MaxOpenConns < config.MaxIdleConns {
		return fmt.Errorf("maxOpenConns must be greater than or equal to maxIdleConns")
	}
	return nil
}

func validateRedisConfig(config *RedisConfig) error {
	if config.TTL <= 0 {
		return fmt.Errorf("cache TTL must be positive")
	}
	if config.MaxRetries < 0 {
		return fmt.Errorf("maxRetries must be non-negative")
	}
	return nil
}

func validateAPIConfig(config *APIConfig) error {
	if config.ReadTimeout <= 0 {
		return fmt.Errorf("readTimeout must be positive")
	}
	if config.WriteTimeout <= 0 {
		return fmt.Errorf("writeTimeout must be positive")
	}
	if config.ShutdownTimeout <= 0 {
		return fmt.Errorf("shutdownTimeout must be positive")
	}
	if config.MaxRequestSize <= 0 {
		return fmt.Errorf("maxRequestSize must be positive")
	}
	return nil
}

func validateSecurityConfig(config *SecurityConfig) error {
	if config.JWTSecret == "" {
		return fmt.Errorf("JWT secret is required")
	}
	if config.JWTExpiry <= 0 {
		return fmt.Errorf("JWT expiry must be positive")
	}
	if config.RateLimit <= 0 {
		return fmt.Errorf("rate limit must be positive")
	}
	if config.EnableTLS {
		if _, err := os.Stat(config.TLSCertPath); err != nil {
			return fmt.Errorf("TLS cert file not found: %w", err)
		}
		if _, err := os.Stat(config.TLSKeyPath); err != nil {
			return fmt.Errorf("TLS key file not found: %w", err)
		}
	}
	return nil
}