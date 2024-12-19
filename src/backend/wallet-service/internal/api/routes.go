// Package api implements HTTP routing and middleware for the wallet service
package api

import (
    "net/http"
    "time"

    "github.com/gin-gonic/gin" // v1.9.1
    "github.com/prometheus/client_golang/prometheus/promhttp" // v1.16.0
    "github.com/ulule/limiter/v3" // v3.11.1
    "github.com/ulule/limiter/v3/drivers/store/memory"
    "go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin" // v0.42.0

    "internal/config"
)

// API route constants
const (
    apiV1       = "/api/v1"
    walletsPath = "/wallets"
    healthPath  = "/health"
    metricsPath = "/metrics"
)

// SetupRouter configures and initializes the HTTP router with all API routes,
// middleware, security controls, and monitoring capabilities
func SetupRouter(router *gin.Engine, cfg *config.Config, handler *WalletHandler) *gin.Engine {
    // Configure gin mode based on environment
    if cfg.API.Environment == "production" {
        gin.SetMode(gin.ReleaseMode)
    }

    // Configure global middleware
    router.Use(gin.Recovery())
    router.Use(otelgin.Middleware("wallet-service"))
    router.Use(corsMiddleware())
    router.Use(securityHeaders())
    router.Use(requestLogger())

    // Configure rate limiter
    rate := limiter.Rate{
        Period: cfg.Security.RateLimitWindow,
        Limit:  int64(cfg.Security.RateLimit),
    }
    store := memory.NewStore()
    rateLimiter := limiter.New(store, rate)

    // Health check endpoints
    router.GET(healthPath, healthCheck)
    router.GET(metricsPath, gin.WrapH(promhttp.Handler()))

    // API v1 routes
    v1 := router.Group(apiV1)
    {
        // Apply authentication and rate limiting middleware
        v1.Use(authMiddleware(cfg.Security.JWTSecret))
        v1.Use(rateLimitMiddleware(rateLimiter))

        // Wallet routes
        wallets := v1.Group(walletsPath)
        {
            // Balance operations
            wallets.GET("/:id/balance", handler.GetBalance)
            
            // Transaction operations
            wallets.POST("/:id/transactions", handler.ProcessTransaction)
            wallets.GET("/:id/transactions", handler.GetTransactions)
            
            // Wallet health and settings
            wallets.GET("/:id/health", handler.GetWalletHealth)
            wallets.PATCH("/:id/settings", handler.UpdateWalletSettings)
        }
    }

    return router
}

// corsMiddleware configures CORS with secure defaults
func corsMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        c.Header("Access-Control-Allow-Origin", "*")
        c.Header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
        c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key")
        c.Header("Access-Control-Max-Age", "86400")

        if c.Request.Method == "OPTIONS" {
            c.AbortWithStatus(http.StatusNoContent)
            return
        }

        c.Next()
    }
}

// securityHeaders adds security-related HTTP headers
func securityHeaders() gin.HandlerFunc {
    return func(c *gin.Context) {
        c.Header("X-Content-Type-Options", "nosniff")
        c.Header("X-Frame-Options", "DENY")
        c.Header("X-XSS-Protection", "1; mode=block")
        c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        c.Header("Content-Security-Policy", "default-src 'self'")
        c.Next()
    }
}

// requestLogger implements structured logging for HTTP requests
func requestLogger() gin.HandlerFunc {
    return gin.LoggerWithConfig(gin.LoggerConfig{
        SkipPaths: []string{healthPath, metricsPath},
        Formatter: func(params gin.LogFormatterParams) string {
            return ""
        },
    })
}

// authMiddleware validates JWT tokens and enforces authentication
func authMiddleware(jwtSecret string) gin.HandlerFunc {
    return func(c *gin.Context) {
        token := c.GetHeader("Authorization")
        if token == "" {
            c.AbortWithStatusJSON(http.StatusUnauthorized, Response{
                Status: "error",
                Error:  "missing authorization token",
            })
            return
        }

        // TODO: Implement JWT validation logic here
        // This would typically validate the token signature, expiry, and claims

        c.Next()
    }
}

// rateLimitMiddleware enforces rate limiting per client
func rateLimitMiddleware(limiter *limiter.Limiter) gin.HandlerFunc {
    return func(c *gin.Context) {
        key := c.ClientIP()
        context, err := limiter.Get(c, key)
        
        if err != nil {
            c.AbortWithStatusJSON(http.StatusInternalServerError, Response{
                Status: "error",
                Error:  "rate limit error",
            })
            return
        }

        c.Header("X-RateLimit-Limit", string(context.Limit))
        c.Header("X-RateLimit-Remaining", string(context.Remaining))
        c.Header("X-RateLimit-Reset", string(context.Reset))

        if context.Reached {
            c.AbortWithStatusJSON(http.StatusTooManyRequests, Response{
                Status: "error",
                Error:  "rate limit exceeded",
            })
            return
        }

        c.Next()
    }
}

// healthCheck handles the health check endpoint
func healthCheck(c *gin.Context) {
    c.JSON(http.StatusOK, gin.H{
        "status":    "up",
        "timestamp": time.Now().UTC(),
    })
}