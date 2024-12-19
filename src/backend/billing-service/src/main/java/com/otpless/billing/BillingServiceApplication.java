package com.otpless.billing;

import com.codahale.metrics.MetricRegistry;
import com.codahale.metrics.health.HealthCheckRegistry;
import com.codahale.metrics.jvm.GarbageCollectorMetricSet;
import com.codahale.metrics.jvm.MemoryUsageGaugeSet;
import com.codahale.metrics.jvm.ThreadStatesGaugeSet;
import com.otpless.billing.config.KafkaConfig;
import com.otpless.billing.config.SecurityConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.Environment;
import javax.annotation.PreDestroy;
import java.util.concurrent.TimeUnit;

/**
 * Main application class for the OTPless Billing Service.
 * Implements production-grade configurations including security, messaging, monitoring,
 * and operational readiness features.
 *
 * @version 1.0
 * @since 2023-11-01
 */
@SpringBootApplication(scanBasePackages = "com.otpless.billing")
@EnableKafka
public class BillingServiceApplication {

    private static final Logger logger = LoggerFactory.getLogger(BillingServiceApplication.class);
    private final MetricRegistry metricRegistry;
    private final HealthCheckRegistry healthCheckRegistry;
    private ConfigurableApplicationContext applicationContext;

    /**
     * Constructor initializes core monitoring components and registries.
     */
    public BillingServiceApplication() {
        this.metricRegistry = new MetricRegistry();
        this.healthCheckRegistry = new HealthCheckRegistry();
        configureMetrics();
        configureHealthChecks();
    }

    /**
     * Application entry point with comprehensive initialization and error handling.
     *
     * @param args Command line arguments
     */
    public static void main(String[] args) {
        try {
            // Configure thread pool for optimal performance
            System.setProperty("java.util.concurrent.ForkJoinPool.common.parallelism", "20");

            // Start Spring application with proper exception handling
            SpringApplication app = new SpringApplication(BillingServiceApplication.class);
            ConfigurableApplicationContext context = app.run(args);

            // Log successful startup
            Environment env = context.getEnvironment();
            String port = env.getProperty("server.port");
            String activeProfiles = String.join(", ", env.getActiveProfiles());
            
            logger.info("OTPless Billing Service started successfully");
            logger.info("Running on port: {}", port);
            logger.info("Active profiles: {}", activeProfiles);
            
        } catch (Exception e) {
            logger.error("Failed to start OTPless Billing Service", e);
            System.exit(1);
        }
    }

    /**
     * Configures comprehensive application metrics collection.
     */
    private void configureMetrics() {
        // JVM metrics
        metricRegistry.register("jvm.memory", new MemoryUsageGaugeSet());
        metricRegistry.register("jvm.garbage", new GarbageCollectorMetricSet());
        metricRegistry.register("jvm.threads", new ThreadStatesGaugeSet());

        // Application metrics
        metricRegistry.counter("application.events.processed");
        metricRegistry.counter("application.errors");
        metricRegistry.timer("application.processing.time");

        // Configure reporters
        // Graphite reporter for metrics visualization
        /*
        final Graphite graphite = new Graphite(
            new InetSocketAddress("graphite.monitoring.svc", 2003));
        final GraphiteReporter reporter = GraphiteReporter.forRegistry(metricRegistry)
            .prefixedWith("billing-service")
            .convertRatesTo(TimeUnit.SECONDS)
            .convertDurationsTo(TimeUnit.MILLISECONDS)
            .build(graphite);
        reporter.start(1, TimeUnit.MINUTES);
        */

        logger.info("Metrics configuration completed");
    }

    /**
     * Configures health checks for critical system components.
     */
    private void configureHealthChecks() {
        // Database health check
        healthCheckRegistry.register("database", new DatabaseHealthCheck());
        
        // Kafka health check
        healthCheckRegistry.register("kafka", new KafkaHealthCheck());
        
        // Disk space health check
        healthCheckRegistry.register("diskSpace", new DiskSpaceHealthCheck());

        // Schedule health check reporting
        /*
        ScheduledReporter healthReporter = ScheduledReporter.forRegistry(healthCheckRegistry)
            .build();
        healthReporter.start(1, TimeUnit.MINUTES);
        */

        logger.info("Health checks configuration completed");
    }

    /**
     * Graceful shutdown hook for cleaning up resources.
     */
    @PreDestroy
    public void onShutdown() {
        logger.info("Initiating graceful shutdown of Billing Service");
        
        try {
            // Allow time for in-flight requests to complete
            Thread.sleep(TimeUnit.SECONDS.toMillis(10));
            
            if (applicationContext != null) {
                applicationContext.close();
            }
            
            logger.info("Billing Service shutdown completed successfully");
        } catch (Exception e) {
            logger.error("Error during application shutdown", e);
        }
    }
}