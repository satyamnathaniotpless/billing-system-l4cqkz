"""
Main application entry point for the OTPless Internal Billing System's Invoice Service.
Implements a production-ready FastAPI application with comprehensive security and performance features.

Version: 1.0.0
"""

# fastapi v0.100.0
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

# uvicorn v0.22.0
import uvicorn

# fastapi-cache v0.9.0
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend

# redis v4.5.4
from redis import asyncio as aioredis

# prometheus-client v0.17.0
from prometheus_client import Counter, Histogram

# loguru v0.7.0
from loguru import logger

# Standard library
import sys
import signal
from typing import Callable
import time
import asyncio

# Internal imports
from .api.routes import router
from .core.config import Settings, get_settings

# Initialize FastAPI application with OpenAPI documentation
app = FastAPI(
    title="OTPless Invoice Service",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# Get settings instance
settings = get_settings()

# Configure metrics
REQUEST_COUNT = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status"]
)

REQUEST_LATENCY = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency",
    ["method", "endpoint"]
)

async def configure_middleware() -> None:
    """Configure application middleware including CORS, caching, and security."""
    
    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
        allow_headers=["*"],
        max_age=3600
    )
    
    # Security headers middleware
    @app.middleware("http")
    async def add_security_headers(request: Request, call_next: Callable):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response
    
    # Request ID middleware
    @app.middleware("http")
    async def add_request_id(request: Request, call_next: Callable):
        request_id = request.headers.get("X-Request-ID", str(time.time()))
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
    
    # Metrics middleware
    @app.middleware("http")
    async def metrics_middleware(request: Request, call_next: Callable):
        start_time = time.time()
        response = await call_next(request)
        
        REQUEST_COUNT.labels(
            method=request.method,
            endpoint=request.url.path,
            status=response.status_code
        ).inc()
        
        REQUEST_LATENCY.labels(
            method=request.method,
            endpoint=request.url.path
        ).observe(time.time() - start_time)
        
        return response

async def configure_routes() -> None:
    """Configure API routes and documentation."""
    
    # Include invoice API router
    app.include_router(router, prefix=settings.API_PREFIX)
    
    # Health check endpoint
    @app.get("/health")
    async def health_check():
        return {"status": "healthy", "version": settings.APP_VERSION}
    
    # Metrics endpoint
    @app.get("/metrics")
    async def metrics():
        from prometheus_client import generate_latest
        return Response(generate_latest())

@app.on_event("startup")
async def startup_event() -> None:
    """Handle application startup tasks."""
    try:
        # Configure Redis cache
        redis = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf8",
            decode_responses=True
        )
        
        # Initialize FastAPI cache
        FastAPICache.init(
            RedisBackend(redis),
            prefix="otpless-invoice-cache:",
            expire=300  # 5 minutes default TTL
        )
        
        # Configure logging
        logger.configure(
            handlers=[{
                "sink": sys.stdout,
                "format": "{time} {level} {message}",
                "level": "INFO"
            }]
        )
        
        # Configure middleware and routes
        await configure_middleware()
        await configure_routes()
        
        logger.info(f"Started {settings.APP_NAME} v{settings.APP_VERSION}")
        
    except Exception as e:
        logger.error(f"Startup error: {str(e)}")
        raise

@app.on_event("shutdown")
async def shutdown_event() -> None:
    """Handle graceful application shutdown."""
    try:
        # Clear cache
        await FastAPICache.clear()
        
        logger.info(f"Shutting down {settings.APP_NAME}")
        
    except Exception as e:
        logger.error(f"Shutdown error: {str(e)}")
        raise

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle request validation errors."""
    return JSONResponse(
        status_code=422,
        content={
            "detail": exc.errors(),
            "body": exc.body,
            "request_id": request.state.request_id
        }
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "request_id": request.state.request_id
        }
    )

def signal_handler(sig, frame):
    """Handle system signals for graceful shutdown."""
    logger.info(f"Received signal {sig}")
    sys.exit(0)

@logger.catch
def main():
    """Application entry point with proper error handling."""
    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Start uvicorn server
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.ENV == "development",
        workers=4,
        log_level="info",
        proxy_headers=True,
        forwarded_allow_ips="*",
        ssl_keyfile=settings.SSL_KEYFILE if settings.ENV == "production" else None,
        ssl_certfile=settings.SSL_CERTFILE if settings.ENV == "production" else None
    )

if __name__ == "__main__":
    main()