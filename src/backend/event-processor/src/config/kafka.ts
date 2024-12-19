import { Kafka, Producer, Consumer, KafkaConfig as KafkaJSConfig, logLevel } from 'kafkajs'; // ^2.2.4
import { validateEvent } from '../models/Event';
import pino from 'pino'; // ^8.15.0
import * as prometheus from 'prom-client'; // ^14.2.0

// Environment variables with defaults
const KAFKA_BROKERS = process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'];
const KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID || 'otpless-event-processor';
const KAFKA_GROUP_ID = process.env.KAFKA_GROUP_ID || 'event-processor-group';
const KAFKA_TOPIC_USAGE_EVENTS = process.env.KAFKA_TOPIC_USAGE_EVENTS || 'usage-events';
const KAFKA_TOPIC_DLQ = process.env.KAFKA_TOPIC_DLQ || 'usage-events-dlq';
const KAFKA_SSL_ENABLED = process.env.KAFKA_SSL_ENABLED === 'true';
const KAFKA_SASL_ENABLED = process.env.KAFKA_SASL_ENABLED === 'true';
const KAFKA_METRICS_ENABLED = process.env.KAFKA_METRICS_ENABLED === 'true';

// Initialize logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  name: 'kafka-client'
});

// Initialize Prometheus metrics
const kafkaProducerLatency = new prometheus.Histogram({
  name: 'kafka_producer_latency_seconds',
  help: 'Kafka producer message send latency in seconds',
  buckets: prometheus.exponentialBuckets(0.001, 2, 10)
});

const kafkaConsumerLatency = new prometheus.Histogram({
  name: 'kafka_consumer_latency_seconds',
  help: 'Kafka consumer message processing latency in seconds',
  buckets: prometheus.exponentialBuckets(0.001, 2, 10)
});

export class KafkaConfig {
  private readonly config: KafkaJSConfig;

  constructor() {
    this.config = {
      clientId: KAFKA_CLIENT_ID,
      brokers: KAFKA_BROKERS,
      logLevel: logLevel.INFO,
      retry: {
        initialRetryTime: 100,
        retries: 8,
        maxRetryTime: 30000,
        factor: 2
      },
      connectionTimeout: 3000,
      requestTimeout: 30000
    };

    if (KAFKA_SSL_ENABLED) {
      this.config.ssl = {
        rejectUnauthorized: true,
        ca: [process.env.KAFKA_SSL_CA!],
        key: process.env.KAFKA_SSL_KEY,
        cert: process.env.KAFKA_SSL_CERT
      };
    }

    if (KAFKA_SASL_ENABLED) {
      this.config.sasl = {
        mechanism: 'plain',
        username: process.env.KAFKA_SASL_USERNAME!,
        password: process.env.KAFKA_SASL_PASSWORD!
      };
    }
  }

  getProducerConfig(): any {
    return {
      allowAutoTopicCreation: false,
      transactionTimeout: 30000,
      idempotent: true,
      maxInFlightRequests: 5,
      compression: 'snappy',
      acks: -1, // all
      batch: {
        size: 16384, // 16KB
        lingerMs: 10
      }
    };
  }

  getConsumerConfig(): any {
    return {
      groupId: KAFKA_GROUP_ID,
      maxBytes: 1048576, // 1MB
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      maxWaitTimeInMs: 1000,
      autoCommit: true,
      autoCommitInterval: 5000,
      minBytes: 1,
      maxBytes: 1048576
    };
  }
}

export async function createKafkaClient(): Promise<Kafka> {
  const config = new KafkaConfig();
  return new Kafka(config.config);
}

export async function createProducer(kafka: Kafka): Promise<Producer> {
  const config = new KafkaConfig();
  const producer = kafka.producer(config.getProducerConfig());

  producer.on('producer.connect', () => {
    logger.info('Producer connected successfully');
  });

  producer.on('producer.disconnect', () => {
    logger.warn('Producer disconnected');
  });

  producer.on('producer.network.request_timeout', (error) => {
    logger.error('Producer network timeout', error);
  });

  await producer.connect();
  return producer;
}

export async function createConsumer(kafka: Kafka): Promise<Consumer> {
  const config = new KafkaConfig();
  const consumer = kafka.consumer(config.getConsumerConfig());

  consumer.on('consumer.connect', () => {
    logger.info('Consumer connected successfully');
  });

  consumer.on('consumer.disconnect', () => {
    logger.warn('Consumer disconnected');
  });

  consumer.on('consumer.group_join', ({ payload }) => {
    logger.info('Consumer joined group', payload);
  });

  consumer.on('consumer.crash', async ({ error, payload }) => {
    logger.error('Consumer crashed', { error, payload });
    
    // Handle dead letter queue
    if (payload && payload.topic === KAFKA_TOPIC_USAGE_EVENTS) {
      try {
        const producer = kafka.producer();
        await producer.connect();
        await producer.send({
          topic: KAFKA_TOPIC_DLQ,
          messages: [{ 
            key: payload.key,
            value: payload.value,
            headers: {
              error: error.message,
              originalTopic: KAFKA_TOPIC_USAGE_EVENTS,
              timestamp: Date.now().toString()
            }
          }]
        });
        await producer.disconnect();
      } catch (dlqError) {
        logger.error('Failed to send message to DLQ', dlqError);
      }
    }
  });

  // Implement graceful shutdown
  const errorTypes = ['unhandledRejection', 'uncaughtException'];
  const signalTraps = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

  errorTypes.forEach(type => {
    process.on(type, async (error) => {
      try {
        logger.error(`Process ${type}`, error);
        await consumer.disconnect();
        process.exit(1);
      } catch (disconnectError) {
        logger.error('Error during graceful shutdown', disconnectError);
        process.exit(1);
      }
    });
  });

  signalTraps.forEach(type => {
    process.once(type, async () => {
      try {
        await consumer.disconnect();
        process.exit(0);
      } catch (disconnectError) {
        logger.error('Error during graceful shutdown', disconnectError);
        process.exit(1);
      }
    });
  });

  await consumer.connect();
  return consumer;
}

// Export metrics if enabled
if (KAFKA_METRICS_ENABLED) {
  prometheus.collectDefaultMetrics();
}