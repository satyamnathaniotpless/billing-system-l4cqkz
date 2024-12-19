import { jest } from '@jest/globals';
import { mock, mockDeep } from 'jest-mock-extended';
import { Kafka, Producer, logLevel } from 'kafkajs';
import { Logger } from 'pino';
import { EventProcessor } from '../src/services/eventProcessingService';
import { Event } from '../src/models/Event';
import { ValidationError } from '../src/utils/validation';
import { createKafkaClient, createProducer } from '../src/config/kafka';

// Test configuration constants
const TEST_KAFKA_BROKERS = process.env.TEST_KAFKA_BROKERS || 'localhost:9092';
const TEST_TOPIC = 'test-events';
const PERFORMANCE_TEST_EVENTS = 1000;
const LATENCY_THRESHOLD_MS = 100;

// Helper function to create test events
const createTestEvent = (overrides: Partial<Event> = {}): Event => {
  return new Event({
    accountId: overrides.accountId || `test-${Date.now()}`,
    type: overrides.type || 'SMS',
    timestamp: overrides.timestamp || new Date().toISOString(),
    quantity: overrides.quantity || 1,
    metadata: overrides.metadata || {}
  });
};

// Helper function to create batch of test events
const createTestEventBatch = (count: number, overrides: Partial<Event> = {}): Event[] => {
  return Array.from({ length: count }, () => createTestEvent(overrides));
};

describe('EventProcessor', () => {
  let processor: EventProcessor;
  let kafkaClient: Kafka;
  let producer: Producer;
  let logger: Logger;

  beforeAll(async () => {
    // Setup test environment
    logger = mock<Logger>();
    kafkaClient = await createKafkaClient();
    producer = await createProducer(kafkaClient);
    
    // Initialize processor with mocked dependencies
    processor = new EventProcessor(
      producer,
      logger,
      mockDeep<any>() // Metrics registry mock
    );

    await processor.start();
  });

  afterAll(async () => {
    await processor.stop();
    await producer.disconnect();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Event Validation', () => {
    it('should successfully validate a valid event', async () => {
      const event = createTestEvent();
      const result = await processor.processEvent(event);
      expect(result).toBe(true);
    });

    it('should reject event with invalid account ID', async () => {
      const event = createTestEvent({ accountId: 'invalid-id' });
      await expect(processor.processEvent(event)).rejects.toThrow(ValidationError);
    });

    it('should reject event with future timestamp', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      
      const event = createTestEvent({
        timestamp: futureDate.toISOString()
      });
      
      await expect(processor.processEvent(event)).rejects.toThrow(ValidationError);
    });

    it('should reject event with invalid type', async () => {
      const event = createTestEvent({
        type: 'INVALID' as any
      });
      
      await expect(processor.processEvent(event)).rejects.toThrow(ValidationError);
    });

    it('should reject event with invalid quantity', async () => {
      const event = createTestEvent({
        quantity: -1
      });
      
      await expect(processor.processEvent(event)).rejects.toThrow(ValidationError);
    });
  });

  describe('Event Processing', () => {
    it('should process single event successfully', async () => {
      const event = createTestEvent();
      const result = await processor.processEvent(event);
      
      expect(result).toBe(true);
      expect(logger.info).toHaveBeenCalledWith(
        'Event processed successfully',
        expect.objectContaining({ eventId: event.id })
      );
    });

    it('should process batch of events successfully', async () => {
      const events = createTestEventBatch(10);
      const result = await processor.processBatch(events);
      
      expect(result.successCount).toBe(10);
      expect(result.failureCount).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle mixed valid and invalid events in batch', async () => {
      const validEvents = createTestEventBatch(5);
      const invalidEvents = createTestEventBatch(5, { quantity: -1 });
      const mixedEvents = [...validEvents, ...invalidEvents];
      
      const result = await processor.processBatch(mixedEvents);
      
      expect(result.successCount).toBe(5);
      expect(result.failureCount).toBe(5);
      expect(result.errors).toHaveLength(5);
    });

    it('should handle idempotent event processing', async () => {
      const event = createTestEvent();
      
      // Process same event multiple times
      await processor.processEvent(event);
      await processor.processEvent(event);
      await processor.processEvent(event);
      
      // Verify only one successful processing
      expect(logger.info).toHaveBeenCalledTimes(1);
    });
  });

  describe('Performance Tests', () => {
    it(`should process ${PERFORMANCE_TEST_EVENTS} events within performance requirements`, async () => {
      const events = createTestEventBatch(PERFORMANCE_TEST_EVENTS);
      const startTime = Date.now();
      
      const result = await processor.processBatch(events);
      const duration = Date.now() - startTime;
      
      // Verify throughput meets 1000+ events/second
      const eventsPerSecond = (result.successCount / duration) * 1000;
      expect(eventsPerSecond).toBeGreaterThanOrEqual(1000);
      
      // Verify latency under 100ms
      expect(result.processingTime).toBeLessThanOrEqual(LATENCY_THRESHOLD_MS);
      
      // Verify all events processed successfully
      expect(result.successCount).toBe(PERFORMANCE_TEST_EVENTS);
      expect(result.failureCount).toBe(0);
    });

    it('should maintain performance under concurrent load', async () => {
      const concurrentBatches = 5;
      const eventsPerBatch = 200;
      const promises = Array.from({ length: concurrentBatches }, () => 
        processor.processBatch(createTestEventBatch(eventsPerBatch))
      );
      
      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result.successCount).toBe(eventsPerBatch);
        expect(result.processingTime).toBeLessThanOrEqual(LATENCY_THRESHOLD_MS);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle Kafka producer failures gracefully', async () => {
      // Simulate Kafka producer failure
      jest.spyOn(producer, 'send').mockRejectedValueOnce(new Error('Kafka error'));
      
      const event = createTestEvent();
      await expect(processor.processEvent(event)).rejects.toThrow('Kafka error');
    });

    it('should handle validation failures with proper error context', async () => {
      const invalidEvent = createTestEvent({ accountId: '' });
      
      try {
        await processor.processEvent(invalidEvent);
        fail('Should have thrown validation error');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.code).toBeDefined();
        expect(error.details).toBeDefined();
        expect(error.field).toBe('accountId');
      }
    });

    it('should handle circuit breaker activation', async () => {
      // Force multiple failures to trigger circuit breaker
      const failureCount = 10;
      jest.spyOn(producer, 'send').mockRejectedValue(new Error('Kafka error'));
      
      const event = createTestEvent();
      const promises = Array.from({ length: failureCount }, () => 
        processor.processEvent(event).catch(() => {})
      );
      
      await Promise.all(promises);
      
      // Verify circuit breaker is open
      await expect(processor.processEvent(event))
        .rejects.toThrow('Circuit breaker is open');
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should track processing metrics', async () => {
      const event = createTestEvent();
      await processor.processEvent(event);
      
      // Verify metrics were recorded
      const metrics = await processor.getMetrics();
      expect(metrics.eventCounter.get({ status: 'success' })).toBe(1);
      expect(metrics.processingLatency.observe).toHaveBeenCalled();
    });
  });
});