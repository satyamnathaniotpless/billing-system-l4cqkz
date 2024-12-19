import express, { Express, Request, Response, NextFunction } from 'express'; // v4.18.2
import helmet from 'helmet'; // v7.0.0
import cors from 'cors'; // v2.8.5
import pino from 'pino'; // v8.15.0
import * as promClient from 'prom-client'; // v14.2.0
import { Server } from 'http';
import { v4 as uuidv4 } from 'uuid'; // v9.0.0

import { EventProcessor } from './services/eventProcessingService';
import { EventRequestHandler } from './handlers/eventHandler';
import { createKafkaClient } from './config/kafka';

// Environment variables with defaults
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const SHUTDOWN_TIMEOUT = 30000;
const CORS_WHITELIST = process.env.CORS_WHITELIST?.split(',') || [];

// Initialize logger
const logger = pino({
    name: 'event-processor',
    level: process.env.LOG_LEVEL || 'info',
    redact: ['req.headers.authorization', 'req.headers.cookie'],
    serializers: pino.stdSerializers,
});

// Initialize metrics
promClient.collectDefaultMetrics();
const httpRequestDuration = new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

/**
 * Configures and initializes the Express server with middleware and security controls
 */
async function setupServer(): Promise<Express> {
    const app = express();

    // Security middleware
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'"],
                imgSrc: ["'self'"],
                connectSrc: ["'self'"],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"]
            }
        },
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true
        }
    }));

    // CORS configuration
    app.use(cors({
        origin: (origin, callback) => {
            if (!origin || CORS_WHITELIST.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-idempotency-key'],
        maxAge: 86400
    }));

    // Request parsing
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true, limit: '1mb' }));

    // Request logging and tracing
    app.use((req: Request, res: Response, next: NextFunction) => {
        const requestId = req.headers['x-request-id'] || uuidv4();
        res.setHeader('x-request-id', requestId);
        
        const startTime = process.hrtime();
        
        res.on('finish', () => {
            const [seconds, nanoseconds] = process.hrtime(startTime);
            const duration = seconds + nanoseconds / 1e9;
            
            httpRequestDuration.observe(
                { method: req.method, route: req.route?.path || 'unknown', status_code: res.statusCode },
                duration
            );

            logger.info({
                requestId,
                method: req.method,
                url: req.url,
                statusCode: res.statusCode,
                duration,
                userAgent: req.headers['user-agent']
            });
        });

        next();
    });

    // Initialize event handler with routes
    const eventHandler = new EventRequestHandler({
        redisUrl: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    const router = express.Router();
    app.use('/api/v1', eventHandler.setupRoutes(router));

    // Global error handler
    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        logger.error({
            err,
            requestId: res.getHeader('x-request-id'),
            method: req.method,
            url: req.url
        });

        res.status(500).json({
            error: NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
            requestId: res.getHeader('x-request-id')
        });
    });

    return app;
}

/**
 * Initializes and starts the HTTP server with event processing capabilities
 */
async function startServer(app: Express): Promise<void> {
    try {
        // Initialize Kafka client
        const kafka = await createKafkaClient();
        const eventProcessor = new EventProcessor(
            await kafka.producer(),
            logger,
            promClient.register
        );
        await eventProcessor.start();

        // Start HTTP server
        const server = app.listen(PORT, () => {
            logger.info(`Event processor service started on port ${PORT}`);
        });

        // Configure graceful shutdown
        setupGracefulShutdown(server, eventProcessor);

    } catch (error) {
        logger.error('Failed to start server', error);
        process.exit(1);
    }
}

/**
 * Manages graceful shutdown of server and dependent services
 */
function setupGracefulShutdown(server: Server, processor: EventProcessor): void {
    let isShuttingDown = false;

    const shutdown = async (signal: string) => {
        if (isShuttingDown) return;
        isShuttingDown = true;

        logger.info(`Received ${signal}. Starting graceful shutdown...`);

        // Create shutdown timeout
        const timeoutId = setTimeout(() => {
            logger.error('Shutdown timeout reached. Forcing exit.');
            process.exit(1);
        }, SHUTDOWN_TIMEOUT);

        try {
            // Stop accepting new connections
            server.close(async () => {
                logger.info('HTTP server closed');
                
                try {
                    // Cleanup services
                    await processor.stop();
                    logger.info('Event processor stopped');

                    // Clear timeout and exit
                    clearTimeout(timeoutId);
                    process.exit(0);
                } catch (error) {
                    logger.error('Error during cleanup', error);
                    process.exit(1);
                }
            });
        } catch (error) {
            logger.error('Error during shutdown', error);
            process.exit(1);
        }
    };

    // Register shutdown handlers
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('uncaughtException', (error) => {
        logger.error('Uncaught exception', error);
        shutdown('uncaughtException');
    });
    process.on('unhandledRejection', (reason) => {
        logger.error('Unhandled rejection', reason);
        shutdown('unhandledRejection');
    });
}

// Start the application
if (require.main === module) {
    setupServer()
        .then(startServer)
        .catch((error) => {
            logger.error('Failed to initialize application', error);
            process.exit(1);
        });
}

export const app = setupServer();