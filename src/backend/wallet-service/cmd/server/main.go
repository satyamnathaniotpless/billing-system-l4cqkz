// Package main provides the entry point for the wallet service
package main

import (
    "context"
    "fmt"
    "net/http"
    "os"
    "os/signal"
    "syscall"
    "time"

    "github.com/gin-gonic/gin"         // v1.9.1
    "github.com/go-redis/redis/v8"     // v8.11.5
    "go.uber.org/zap"                  // v1.24.0
    "gorm.io/gorm"                     // v1.25.0
    "github.com/prometheus/client_golang/prometheus" // v1.16.0
    "github.com/prometheus/client_golang/prometheus/promauto"

    "internal/config"
    "internal/api"
    "internal/service"
    "internal/repository"
)

// Build information, set during compilation
var (
    version   = "dev"
    buildTime = "unknown"
)

// Global logger instance
var logger *zap.Logger

// Metrics
var (
    httpRequestsTotal = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "wallet_http_requests_total",
            Help: "Total number of HTTP requests",
        },
        []string{"method", "endpoint", "status"},
    )
    
    transactionLatency = promauto.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "wallet_transaction_duration_seconds",
            Help:    "Transaction processing duration in seconds",
            Buckets: prometheus.DefBuckets,
        },
        []string{"type"},
    )
)

func main() {
    // Initialize logger
    var err error
    logger, err = setupLogger()
    if err != nil {
        fmt.Printf("Failed to setup logger: %v\n", err)
        os.Exit(1)
    }
    defer logger.Sync()

    // Load configuration
    cfg, err := config.LoadConfig("config/config.yaml")
    if err != nil {
        logger.Fatal("Failed to load configuration",
            zap.Error(err),
        )
    }

    // Setup database connection
    db, err := setupDatabase(cfg)
    if err != nil {
        logger.Fatal("Failed to setup database",
            zap.Error(err),
        )
    }

    // Setup Redis connection
    redisClient, err := setupRedis(cfg)
    if err != nil {
        logger.Fatal("Failed to setup Redis",
            zap.Error(err),
        )
    }
    defer redisClient.Close()

    // Initialize repository
    repo, err := repository.NewWalletRepository(db)
    if err != nil {
        logger.Fatal("Failed to create repository",
            zap.Error(err),
        )
    }

    // Initialize service
    walletService, err := service.NewWalletService(repo, cfg.Wallet.LowBalanceThreshold, logger)
    if err != nil {
        logger.Fatal("Failed to create wallet service",
            zap.Error(err),
        )
    }

    // Initialize HTTP handler
    handler, err := api.NewWalletHandler(walletService)
    if err != nil {
        logger.Fatal("Failed to create handler",
            zap.Error(err),
        )
    }

    // Setup Gin router
    gin.SetMode(gin.ReleaseMode)
    router := gin.New()
    router = api.SetupRouter(router, cfg, handler)

    // Create HTTP server
    srv := &http.Server{
        Addr:         fmt.Sprintf("%s:%d", cfg.API.Host, cfg.API.Port),
        Handler:      router,
        ReadTimeout:  cfg.API.ReadTimeout,
        WriteTimeout: cfg.API.WriteTimeout,
        IdleTimeout:  cfg.API.IdleTimeout,
    }

    // Start server in goroutine
    go func() {
        logger.Info("Starting server",
            zap.String("address", srv.Addr),
            zap.String("version", version),
            zap.String("buildTime", buildTime),
        )

        if cfg.Security.EnableTLS {
            if err := srv.ListenAndServeTLS(cfg.Security.TLSCertPath, cfg.Security.TLSKeyPath); err != nil && err != http.ErrServerClosed {
                logger.Fatal("Failed to start server",
                    zap.Error(err),
                )
            }
        } else {
            if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
                logger.Fatal("Failed to start server",
                    zap.Error(err),
                )
            }
        }
    }()

    // Wait for interrupt signal
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit

    logger.Info("Shutting down server...")

    // Create shutdown context with timeout
    ctx, cancel := context.WithTimeout(context.Background(), cfg.API.ShutdownTimeout)
    defer cancel()

    // Attempt graceful shutdown
    if err := srv.Shutdown(ctx); err != nil {
        logger.Error("Server forced to shutdown",
            zap.Error(err),
        )
    }

    logger.Info("Server exited")
}

// setupLogger initializes the production logger
func setupLogger() (*zap.Logger, error) {
    config := zap.NewProductionConfig()
    config.OutputPaths = []string{"stdout"}
    config.ErrorOutputPaths = []string{"stderr"}
    
    return config.Build(
        zap.AddCaller(),
        zap.AddStacktrace(zap.ErrorLevel),
    )
}

// setupDatabase establishes the database connection with proper configuration
func setupDatabase(cfg *config.Config) (*gorm.DB, error) {
    dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
        cfg.Database.Host,
        cfg.Database.Port,
        cfg.Database.User,
        cfg.Database.Password,
        cfg.Database.DBName,
        cfg.Database.SSLMode,
    )

    db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
        Logger: logger.WithOptions(zap.AddCallerSkip(1)),
        NowFunc: func() time.Time {
            return time.Now().UTC()
        },
    })
    if err != nil {
        return nil, fmt.Errorf("failed to connect to database: %w", err)
    }

    sqlDB, err := db.DB()
    if err != nil {
        return nil, fmt.Errorf("failed to get database instance: %w", err)
    }

    // Configure connection pool
    sqlDB.SetMaxIdleConns(cfg.Database.MaxIdleConns)
    sqlDB.SetMaxOpenConns(cfg.Database.MaxOpenConns)
    sqlDB.SetConnMaxLifetime(cfg.Database.MaxConnLifetime)

    return db, nil
}

// setupRedis establishes Redis connection with proper configuration
func setupRedis(cfg *config.Config) (*redis.Client, error) {
    client := redis.NewClient(&redis.Options{
        Addr:         fmt.Sprintf("%s:%d", cfg.Cache.Host, cfg.Cache.Port),
        Password:     cfg.Cache.Password,
        DB:          cfg.Cache.DB,
        DialTimeout:  cfg.Cache.ConnTimeout,
        ReadTimeout:  cfg.Cache.ConnTimeout,
        WriteTimeout: cfg.Cache.ConnTimeout,
        PoolSize:     10,
        MinIdleConns: 5,
        MaxRetries:   cfg.Cache.MaxRetries,
    })

    // Test connection
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    if err := client.Ping(ctx).Err(); err != nil {
        return nil, fmt.Errorf("failed to connect to Redis: %w", err)
    }

    return client, nil
}