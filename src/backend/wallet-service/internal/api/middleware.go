// Package api provides HTTP middleware components for the wallet service
// with comprehensive security, monitoring and observability features
package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin" // v1.9.x
	"github.com/golang-jwt/jwt/v5" // v5.0.0
	"github.com/go-redis/redis/v8" // v8.11.5
	"github.com/sirupsen/logrus" // v1.9.0
	"golang.org/x/time/rate" // v0.3.0
	"go.opentelemetry.io/otel" // v1.11.0
	"go.opentelemetry.io/otel/trace"
	
	"internal/config"
)

// Error variables for common middleware errors
var (
	errUnauthorized = errors.New("unauthorized access")
	errRateLimitExceeded = errors.New("rate limit exceeded")
	errInvalidToken = errors.New("invalid or expired token")
	errInvalidClaims = errors.New("invalid token claims")
)

// Custom claims structure for JWT tokens
type Claims struct {
	jwt.RegisteredClaims
	CustomerID string   `json:"customer_id"`
	Roles      []string `json:"roles"`
}

// AuthMiddleware creates a new authentication middleware handler
func AuthMiddleware(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Start authentication span
		ctx, span := otel.Tracer("middleware").Start(c.Request.Context(), "auth_middleware")
		defer span.End()

		// Generate correlation ID
		correlationID := generateCorrelationID()
		span.SetAttributes(trace.StringAttribute("correlation_id", correlationID))
		c.Set("correlation_id", correlationID)

		// Extract token from Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			handleAuthError(c, errUnauthorized, "missing or invalid authorization header")
			return
		}
		tokenString := strings.TrimPrefix(authHeader, "Bearer ")

		// Parse and validate JWT token
		token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
			// Verify signing algorithm
			if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			// Return public key for validation
			return loadPublicKey(cfg.Security.JWTSecret)
		})

		if err != nil {
			handleAuthError(c, errInvalidToken, err.Error())
			return
		}

		// Validate claims
		claims, ok := token.Claims.(*Claims)
		if !ok || !token.Valid {
			handleAuthError(c, errInvalidClaims, "invalid token claims")
			return
		}

		// Validate expiration
		if time.Now().After(claims.ExpiresAt.Time) {
			handleAuthError(c, errInvalidToken, "token expired")
			return
		}

		// Set customer context
		c.Set("customer_id", claims.CustomerID)
		c.Set("roles", claims.Roles)

		span.SetAttributes(
			trace.StringAttribute("customer_id", claims.CustomerID),
			trace.StringAttribute("roles", strings.Join(claims.Roles, ",")),
		)

		c.Next()
	}
}

// RateLimitMiddleware creates a new rate limiting middleware handler
func RateLimitMiddleware(cfg *config.Config) gin.HandlerFunc {
	// Initialize Redis client for distributed rate limiting
	rdb := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%d", cfg.Cache.Host, cfg.Cache.Port),
		Password: cfg.Cache.Password,
		DB:       cfg.Cache.DB,
	})

	return func(c *gin.Context) {
		ctx, span := otel.Tracer("middleware").Start(c.Request.Context(), "rate_limit_middleware")
		defer span.End()

		customerID, exists := c.Get("customer_id")
		if !exists {
			handleAuthError(c, errUnauthorized, "customer context not found")
			return
		}

		// Create rate limiter key
		key := fmt.Sprintf("ratelimit:%s", customerID)

		// Check rate limit
		limited, err := isRateLimited(ctx, rdb, key, cfg.Security.RateLimit, cfg.Security.RateLimitWindow)
		if err != nil {
			logrus.WithError(err).Error("rate limit check failed")
			c.Next() // Allow request on error
			return
		}

		if limited {
			span.SetAttributes(trace.BoolAttribute("rate_limited", true))
			c.Header("Retry-After", fmt.Sprintf("%d", cfg.Security.RateLimitWindow/time.Second))
			handleRateLimitError(c, errRateLimitExceeded)
			return
		}

		span.SetAttributes(trace.BoolAttribute("rate_limited", false))
		c.Next()
	}
}

// LoggerMiddleware creates a new logging middleware with enhanced observability
func LoggerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		query := c.Request.URL.RawQuery

		// Start request span
		ctx, span := otel.Tracer("middleware").Start(c.Request.Context(), "request")
		defer span.End()

		// Set span attributes
		span.SetAttributes(
			trace.StringAttribute("http.method", c.Request.Method),
			trace.StringAttribute("http.path", path),
			trace.StringAttribute("http.query", query),
		)

		// Process request
		c.Next()

		// Calculate duration
		duration := time.Since(start)

		// Log request details
		logrus.WithFields(logrus.Fields{
			"correlation_id": c.GetString("correlation_id"),
			"method":        c.Request.Method,
			"path":         path,
			"query":        query,
			"status":       c.Writer.Status(),
			"duration_ms":  duration.Milliseconds(),
			"client_ip":    c.ClientIP(),
			"user_agent":   c.Request.UserAgent(),
		}).Info("request processed")

		// Update metrics
		updateRequestMetrics(c, duration)
	}
}

// ErrorMiddleware creates a new error handling middleware
func ErrorMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				// Start error span
				ctx, span := otel.Tracer("middleware").Start(c.Request.Context(), "error_handler")
				defer span.End()

				// Log error with stack trace
				logrus.WithFields(logrus.Fields{
					"correlation_id": c.GetString("correlation_id"),
					"error":         err,
					"stack_trace":   getStackTrace(),
				}).Error("panic recovered")

				// Update error metrics
				updateErrorMetrics("panic", c.Request.URL.Path)

				// Return 500 error
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
					"error": "internal server error",
					"code":  "INTERNAL_ERROR",
				})
			}
		}()

		c.Next()
	}
}

// Helper functions

func handleAuthError(c *gin.Context, err error, details string) {
	logrus.WithFields(logrus.Fields{
		"correlation_id": c.GetString("correlation_id"),
		"error":         err,
		"details":       details,
	}).Warn("authentication failed")

	updateErrorMetrics("auth", c.Request.URL.Path)

	c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
		"error": err.Error(),
		"code":  "UNAUTHORIZED",
	})
}

func handleRateLimitError(c *gin.Context, err error) {
	logrus.WithFields(logrus.Fields{
		"correlation_id": c.GetString("correlation_id"),
		"customer_id":   c.GetString("customer_id"),
	}).Warn("rate limit exceeded")

	updateErrorMetrics("rate_limit", c.Request.URL.Path)

	c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
		"error": err.Error(),
		"code":  "RATE_LIMITED",
	})
}

func isRateLimited(ctx context.Context, rdb *redis.Client, key string, limit int, window time.Duration) (bool, error) {
	pipe := rdb.Pipeline()
	now := time.Now().UnixNano()
	
	// Clean old requests
	pipe.ZRemRangeByScore(ctx, key, "0", fmt.Sprintf("%d", now-window.Nanoseconds()))
	
	// Count requests in window
	pipe.ZCard(ctx, key)
	
	// Add current request
	pipe.ZAdd(ctx, key, &redis.Z{Score: float64(now), Member: now})
	
	// Set key expiration
	pipe.Expire(ctx, key, window)
	
	cmders, err := pipe.Exec(ctx)
	if err != nil {
		return false, err
	}
	
	// Get request count
	count := cmders[1].(*redis.IntCmd).Val()
	return count > int64(limit), nil
}

func generateCorrelationID() string {
	// Implementation of correlation ID generation
	return fmt.Sprintf("req_%d", time.Now().UnixNano())
}

func updateRequestMetrics(c *gin.Context, duration time.Duration) {
	// Implementation of metrics update
	// This would integrate with your metrics collection system
}

func updateErrorMetrics(errorType string, path string) {
	// Implementation of error metrics update
	// This would integrate with your metrics collection system
}

func getStackTrace() string {
	// Implementation of stack trace collection
	return "stack trace implementation"
}

func loadPublicKey(keyData string) (interface{}, error) {
	// Implementation of public key loading
	// This would load and parse the RSA public key
	return nil, nil
}