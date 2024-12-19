package com.otpless.billing.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;

import java.util.HashMap;
import java.util.Map;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.apache.kafka.common.serialization.StringSerializer;

/**
 * Kafka configuration class for high-throughput event processing in the billing service.
 * Implements optimized settings for reliable message delivery, batch processing, and error handling.
 * 
 * @version 1.0
 * @since 2023-11-01
 */
@Configuration
public class KafkaConfig {

    @Value("${kafka.bootstrap-servers}")
    private String bootstrapServers;

    @Value("${kafka.consumer.group-id}")
    private String consumerGroupId;

    @Value("${kafka.topics.usage-events}")
    private String usageEventsTopic;

    @Value("${kafka.topics.billing-events}")
    private String billingEventsTopic;

    /**
     * Creates and configures a Kafka consumer factory with optimized settings for batch processing
     * and reliable message consumption.
     *
     * @return ConsumerFactory<String, String> Configured consumer factory instance
     */
    @Bean
    public ConsumerFactory<String, String> consumerFactory() {
        Map<String, Object> config = new HashMap<>();
        
        // Core settings
        config.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        config.put(ConsumerConfig.GROUP_ID_CONFIG, consumerGroupId);
        config.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        config.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        
        // Performance optimization
        config.put(ConsumerConfig.MAX_POLL_RECORDS_CONFIG, 500); // Batch size
        config.put(ConsumerConfig.FETCH_MIN_BYTES_CONFIG, 1024 * 1024); // 1MB minimum fetch
        config.put(ConsumerConfig.FETCH_MAX_WAIT_MS_CONFIG, 500); // Max wait time for batch
        
        // Reliability settings
        config.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, true);
        config.put(ConsumerConfig.AUTO_COMMIT_INTERVAL_MS_CONFIG, 5000); // 5 seconds
        config.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        config.put(ConsumerConfig.SESSION_TIMEOUT_MS_CONFIG, 45000); // 45 seconds
        config.put(ConsumerConfig.HEARTBEAT_INTERVAL_MS_CONFIG, 15000); // 15 seconds
        
        // Monitoring
        config.put(ConsumerConfig.INTERCEPTOR_CLASSES_CONFIG, 
                  "io.confluent.monitoring.clients.interceptor.MonitoringConsumerInterceptor");

        return new DefaultKafkaConsumerFactory<>(config);
    }

    /**
     * Creates and configures a Kafka producer factory with reliability guarantees
     * and optimized performance settings.
     *
     * @return ProducerFactory<String, String> Configured producer factory instance
     */
    @Bean
    public ProducerFactory<String, String> producerFactory() {
        Map<String, Object> config = new HashMap<>();
        
        // Core settings
        config.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        config.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        config.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        
        // Reliability settings
        config.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);
        config.put(ProducerConfig.ACKS_CONFIG, "all");
        config.put(ProducerConfig.RETRIES_CONFIG, 3);
        config.put(ProducerConfig.RETRY_BACKOFF_MS_CONFIG, 1000); // 1 second backoff
        
        // Performance optimization
        config.put(ProducerConfig.BATCH_SIZE_CONFIG, 16384); // 16KB batch size
        config.put(ProducerConfig.LINGER_MS_CONFIG, 5); // 5ms linger
        config.put(ProducerConfig.COMPRESSION_TYPE_CONFIG, "lz4");
        config.put(ProducerConfig.BUFFER_MEMORY_CONFIG, 33554432); // 32MB buffer
        
        // Monitoring
        config.put(ProducerConfig.INTERCEPTOR_CLASSES_CONFIG,
                  "io.confluent.monitoring.clients.interceptor.MonitoringProducerInterceptor");

        return new DefaultKafkaProducerFactory<>(config);
    }

    /**
     * Creates a KafkaTemplate with configured producer factory and error handling.
     *
     * @return KafkaTemplate<String, String> Configured Kafka template instance
     */
    @Bean
    public KafkaTemplate<String, String> kafkaTemplate() {
        KafkaTemplate<String, String> template = new KafkaTemplate<>(producerFactory());
        template.setDefaultTopic(billingEventsTopic);
        
        // Configure error handling
        template.setProducerListener(new LoggingProducerListener<>());
        
        return template;
    }

    /**
     * Custom producer listener for logging failed deliveries and monitoring.
     */
    private static class LoggingProducerListener<K, V> implements ProducerListener<K, V> {
        @Override
        public void onError(ProducerRecord<K, V> record, RecordMetadata metadata, Exception exception) {
            log.error("Error sending message to topic {}: {}", 
                     record.topic(), exception.getMessage(), exception);
        }
    }
}