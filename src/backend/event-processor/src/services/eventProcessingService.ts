import { injectable } from 'inversify';
import { Producer } from 'kafkajs';
import { Logger } from 'pino';
import { Counter, Histogram, Gauge } from 'prom-client';
import { validateEvent, transformEvent } from '../models/Event';
import { ValidationError } from '../utils/validation';
import { createKafkaClient, createProducer } from '../config/kafka';

// Constants for configuration
const BATCH_SIZE = 100;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const CIRCUIT_BREAKER_THRESHOLD = 0.5;
const HEALTH_CHECK_INTERVAL_MS = 30000;

// Interfaces
interface ProcessingResult {
  successCount: number;
  failureCount: number;
  errors: Error[];
  processingTime: number;
  retryCount: number;
}

interface CircuitBreakerState {
  failures: number;
  total: number;
  isOpen: boolean;
  lastCheck: number;
}

// Decorators
function measureLatency(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = async function (...args: any[]) {
    const start = performance.now();
    try {
      const result = await originalMethod.apply(this, args);
      const duration = performance.now() - start;
      this.processingLatency.observe(duration / 1000);
      return result;
    } catch (error) {
      throw error;
    }
  };
  return descriptor;
}

function circuitBreaker(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = async function (...args: any[]) {
    if (this.circuitBreaker.isOpen) {
      if (Date.now() - this.circuitBreaker.lastCheck > HEALTH_CHECK_INTERVAL_MS) {
        this.circuitBreaker.isOpen = false;
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    try {
      const result = await originalMethod.apply(this, args);
      this.updateCircuitBreaker(true);
      return result;
    } catch (error) {
      this.updateCircuitBreaker(false);
      throw error;
    }
  };
  return descriptor;
}

@injectable()
export class EventProcessor {
  private readonly kafkaProducer: Producer;
  private readonly logger: Logger;
  private readonly eventCounter: Counter;
  private readonly processingLatency: Histogram;
  private readonly batchSize: Gauge;
  private readonly circuitBreaker: CircuitBreakerState;

  constructor(
    kafkaProducer: Producer,
    logger: Logger,
    metricsRegistry: any
  ) {
    this.kafkaProducer = kafkaProducer;
    this.logger = logger;

    // Initialize metrics
    this.eventCounter = new Counter({
      name: 'event_processor_events_total',
      help: 'Total number of events processed',
      labelNames: ['status']
    });

    this.processingLatency = new Histogram({
      name: 'event_processor_latency_seconds',
      help: 'Event processing latency in seconds',
      buckets: [0.01, 0.05, 0.1, 0.5, 1]
    });

    this.batchSize = new Gauge({
      name: 'event_processor_batch_size',
      help: 'Current batch size being processed'
    });

    this.circuitBreaker = {
      failures: 0,
      total: 0,
      isOpen: false,
      lastCheck: Date.now()
    };
  }

  private updateCircuitBreaker(success: boolean): void {
    this.circuitBreaker.total++;
    if (!success) {
      this.circuitBreaker.failures++;
    }

    const failureRate = this.circuitBreaker.failures / this.circuitBreaker.total;
    if (failureRate > CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitBreaker.isOpen = true;
      this.circuitBreaker.lastCheck = Date.now();
      this.logger.warn('Circuit breaker opened due to high failure rate');
    }
  }

  @measureLatency
  @circuitBreaker
  public async processEvent(rawEvent: any): Promise<boolean> {
    try {
      const validationStart = performance.now();
      await validateEvent(rawEvent);
      const validationTime = performance.now() - validationStart;

      const transformedEvent = await transformEvent(rawEvent);
      transformedEvent.performance.validationTime = validationTime;

      const idempotencyKey = `${transformedEvent.accountId}-${transformedEvent.id}`;

      await this.kafkaProducer.send({
        topic: 'usage-events',
        messages: [{
          key: idempotencyKey,
          value: JSON.stringify(transformedEvent),
          headers: {
            'idempotency-key': idempotencyKey,
            'event-type': transformedEvent.type
          }
        }]
      });

      this.eventCounter.inc({ status: 'success' });
      this.logger.info('Event processed successfully', { eventId: transformedEvent.id });
      return true;
    } catch (error) {
      this.eventCounter.inc({ status: 'failure' });
      this.logger.error('Event processing failed', { error: error.message });
      throw error;
    }
  }

  @measureLatency
  @circuitBreaker
  public async processBatch(rawEvents: any[]): Promise<ProcessingResult> {
    const result: ProcessingResult = {
      successCount: 0,
      failureCount: 0,
      errors: [],
      processingTime: 0,
      retryCount: 0
    };

    const startTime = performance.now();
    this.batchSize.set(rawEvents.length);

    // Parallel validation
    const validationPromises = rawEvents.map(event => validateEvent(event).catch(error => ({ error })));
    const validationResults = await Promise.all(validationPromises);

    const validEvents = rawEvents.filter((_, index) => !validationResults[index].error);
    const transformPromises = validEvents.map(event => transformEvent(event));
    const transformedEvents = await Promise.all(transformPromises);

    if (transformedEvents.length > 0) {
      try {
        await this.kafkaProducer.sendBatch({
          topicMessages: [{
            topic: 'usage-events',
            messages: transformedEvents.map(event => ({
              key: `${event.accountId}-${event.id}`,
              value: JSON.stringify(event),
              headers: {
                'idempotency-key': `${event.accountId}-${event.id}`,
                'event-type': event.type
              }
            }))
          }]
        });
        result.successCount = transformedEvents.length;
      } catch (error) {
        result.errors.push(error);
        result.failureCount = transformedEvents.length;
      }
    }

    result.failureCount += rawEvents.length - validEvents.length;
    result.errors.push(...validationResults
      .filter(r => r.error)
      .map(r => r.error));
    
    result.processingTime = performance.now() - startTime;
    
    this.logger.info('Batch processing completed', {
      total: rawEvents.length,
      success: result.successCount,
      failures: result.failureCount,
      processingTime: result.processingTime
    });

    return result;
  }

  @measureLatency
  private async retryFailedEvent(event: any, retryCount: number): Promise<boolean> {
    if (retryCount >= MAX_RETRIES) {
      this.logger.error('Max retries exceeded', { eventId: event.id });
      return false;
    }

    const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      return await this.processEvent(event);
    } catch (error) {
      return this.retryFailedEvent(event, retryCount + 1);
    }
  }

  public async start(): Promise<void> {
    const kafka = await createKafkaClient();
    const producer = await createProducer(kafka);
    this.logger.info('Event processor service started');
  }

  public async stop(): Promise<void> {
    await this.kafkaProducer.disconnect();
    this.logger.info('Event processor service stopped');
  }

  public async health(): Promise<boolean> {
    return !this.circuitBreaker.isOpen;
  }
}

export type { ProcessingResult };