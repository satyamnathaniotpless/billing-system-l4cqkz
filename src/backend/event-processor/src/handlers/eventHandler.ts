import { injectable } from 'inversify';
import express, { Request, Response } from 'express'; // v4.18.2
import pino from 'pino'; // v8.15.0
import * as promClient from 'prom-client'; // v14.2.0
import Redis from 'ioredis'; // v5.3.2
import CircuitBreaker from 'opossum'; // v7.1.0

import { Event, validateEvent, transformEvent } from '../models/Event';
import { validateEventData } from '../utils/validation';
import { EventProcessor, ProcessingResult } from '../services/eventProcessingService';
import { createKafkaClient } from '../config/kafka';

// Global constants from specification
const EVENT_BATCH_SIZE = 100;
const REQUEST_TIMEOUT = 5000;
const MAX_RETRIES = 3;
const CACHE_TTL = 300;

@injectable()
export class EventRequestHandler {
    private readonly processor: EventProcessor;
    private readonly logger: pino.Logger;
    private readonly cache: Redis;
    private readonly metrics: {
        requestDuration: promClient.Histogram;
        eventCounter: promClient.Counter;
        batchSize: promClient.Gauge;
        cacheHits: promClient.Counter;
    };
    private readonly circuitBreaker: CircuitBreaker;

    constructor(config: { redisUrl: string }) {
        // Initialize logger
        this.logger = pino({
            name: 'event-handler',
            level: process.env.LOG_LEVEL || 'info'
        });

        // Initialize Redis cache
        this.cache = new Redis(config.redisUrl, {
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            retryStrategy: (times: number) => Math.min(times * 50, 2000)
        });

        // Initialize Prometheus metrics
        this.metrics = {
            requestDuration: new promClient.Histogram({
                name: 'event_handler_request_duration_seconds',
                help: 'Duration of event handler requests',
                labelNames: ['operation', 'status']
            }),
            eventCounter: new promClient.Counter({
                name: 'event_handler_events_total',
                help: 'Total number of events processed',
                labelNames: ['status']
            }),
            batchSize: new promClient.Gauge({
                name: 'event_handler_batch_size',
                help: 'Current batch processing size'
            }),
            cacheHits: new promClient.Counter({
                name: 'event_handler_cache_hits_total',
                help: 'Total number of cache hits'
            })
        };

        // Initialize circuit breaker
        this.circuitBreaker = new CircuitBreaker(async (req: Request) => {
            return this.processRequest(req);
        }, {
            timeout: REQUEST_TIMEOUT,
            errorThresholdPercentage: 50,
            resetTimeout: 30000
        });

        // Initialize event processor
        this.initializeProcessor();
    }

    private async initializeProcessor(): Promise<void> {
        const kafka = await createKafkaClient();
        this.processor = new EventProcessor(
            await kafka.producer(),
            this.logger,
            promClient.register
        );
        await this.processor.start();
    }

    public setupRoutes(router: express.Router): express.Router {
        // Health check endpoint
        router.get('/health', async (_req: Request, res: Response) => {
            const isHealthy = await this.processor.health();
            res.status(isHealthy ? 200 : 503).json({ status: isHealthy ? 'healthy' : 'unhealthy' });
        });

        // Metrics endpoint
        router.get('/metrics', async (_req: Request, res: Response) => {
            res.set('Content-Type', promClient.register.contentType);
            res.end(await promClient.register.metrics());
        });

        // Single event processing endpoint
        router.post('/event', this.handleEvent.bind(this));

        // Batch event processing endpoint
        router.post('/events/batch', this.handleBatchEvents.bind(this));

        return router;
    }

    @promClient.metrics.histogram('event_handler_duration_seconds')
    private async handleEvent(req: Request, res: Response): Promise<void> {
        const startTime = performance.now();
        const idempotencyKey = req.headers['x-idempotency-key'] as string;

        try {
            // Check cache for idempotency
            if (idempotencyKey) {
                const cached = await this.cache.get(idempotencyKey);
                if (cached) {
                    this.metrics.cacheHits.inc();
                    res.status(200).json(JSON.parse(cached));
                    return;
                }
            }

            // Validate request schema
            await validateEventData(req.body);

            // Process event through circuit breaker
            const result = await this.circuitBreaker.fire(req);
            
            // Cache successful result
            if (idempotencyKey) {
                await this.cache.set(idempotencyKey, JSON.stringify(result), 'EX', CACHE_TTL);
            }

            this.metrics.eventCounter.inc({ status: 'success' });
            res.status(200).json(result);

        } catch (error) {
            this.handleError(error, res);
            this.metrics.eventCounter.inc({ status: 'failure' });
        } finally {
            const duration = (performance.now() - startTime) / 1000;
            this.metrics.requestDuration.observe({ operation: 'single' }, duration);
        }
    }

    @promClient.metrics.histogram('batch_handler_duration_seconds')
    private async handleBatchEvents(req: Request, res: Response): Promise<void> {
        const startTime = performance.now();

        try {
            const events = req.body.events;
            if (!Array.isArray(events) || events.length > EVENT_BATCH_SIZE) {
                throw new Error(`Invalid batch size. Maximum allowed: ${EVENT_BATCH_SIZE}`);
            }

            this.metrics.batchSize.set(events.length);

            const result: ProcessingResult = await this.processor.processBatch(events);

            res.status(200).json({
                success: result.successCount,
                failures: result.failureCount,
                errors: result.errors.map(e => e.message),
                processingTime: result.processingTime
            });

        } catch (error) {
            this.handleError(error, res);
        } finally {
            const duration = (performance.now() - startTime) / 1000;
            this.metrics.requestDuration.observe({ operation: 'batch' }, duration);
        }
    }

    private async processRequest(req: Request): Promise<any> {
        const event = await transformEvent(req.body);
        return this.processor.processEvent(event);
    }

    private handleError(error: any, res: Response): void {
        this.logger.error('Error processing request', error);
        
        if (error.name === 'ValidationError') {
            res.status(400).json({
                error: 'Validation Error',
                details: error.details
            });
            return;
        }

        if (error.name === 'CircuitBreakerError') {
            res.status(503).json({
                error: 'Service Temporarily Unavailable',
                message: 'Circuit breaker is open'
            });
            return;
        }

        res.status(500).json({
            error: 'Internal Server Error',
            message: process.env.NODE_ENV === 'production' ? 
                'An unexpected error occurred' : 
                error.message
        });
    }

    public async shutdown(): Promise<void> {
        await this.processor.stop();
        await this.cache.quit();
        this.logger.info('Event handler shutdown complete');
    }
}

export { handleEvent, handleBatchEvents } from './EventRequestHandler';