package com.otpless.billing.service;

import com.otpless.billing.model.Bill;
import com.otpless.billing.model.Bill.BillStatus;
import com.otpless.billing.model.PricePlan;
import com.otpless.billing.model.UsageEvent;
import com.otpless.billing.repository.BillingRepository;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.Assert;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Enterprise-grade service implementing core billing operations with enhanced resilience and monitoring.
 * Handles bill generation, payment processing, and usage tracking with performance optimizations.
 *
 * @version 1.0
 * @since 2023-11-01
 */
@Slf4j
@Service
@Transactional
public class BillingService {

    private final BillingRepository billingRepository;
    private final Counter billGenerationCounter;
    private final Counter eventProcessingCounter;
    private final Counter paymentProcessingCounter;
    private final Set<String> processedIdempotencyKeys = ConcurrentHashMap.newKeySet();

    /**
     * Initializes the billing service with required dependencies and metrics.
     *
     * @param billingRepository Repository for bill data access
     * @param meterRegistry Registry for metrics collection
     */
    public BillingService(BillingRepository billingRepository, MeterRegistry meterRegistry) {
        Assert.notNull(billingRepository, "BillingRepository must not be null");
        Assert.notNull(meterRegistry, "MeterRegistry must not be null");

        this.billingRepository = billingRepository;
        
        // Initialize metrics counters
        this.billGenerationCounter = Counter.builder("billing.bills.generated")
            .description("Number of bills generated")
            .register(meterRegistry);
            
        this.eventProcessingCounter = Counter.builder("billing.events.processed")
            .description("Number of usage events processed")
            .register(meterRegistry);
            
        this.paymentProcessingCounter = Counter.builder("billing.payments.processed")
            .description("Number of payments processed")
            .register(meterRegistry);
    }

    /**
     * Generates a new bill for customer usage with enhanced validation and metrics.
     *
     * @param customerId Customer identifier
     * @param accountId Account identifier
     * @param pricePlanId Price plan identifier
     * @param usage Usage amount
     * @return Generated bill with calculated amounts
     * @throws IllegalArgumentException if input parameters are invalid
     * @throws IllegalStateException if price plan is inactive
     */
    @Transactional
    @CircuitBreaker(name = "billGeneration", fallbackMethod = "fallbackGenerateBill")
    @Retry(name = "billGeneration")
    public Bill generateBill(String customerId, String accountId, UUID pricePlanId, Long usage) {
        log.debug("Generating bill for customer: {}, account: {}, usage: {}", customerId, accountId, usage);
        
        try {
            // Validate inputs
            Assert.hasText(customerId, "Customer ID must not be empty");
            Assert.hasText(accountId, "Account ID must not be empty");
            Assert.notNull(pricePlanId, "Price Plan ID must not be null");
            Assert.isTrue(usage >= 0, "Usage must not be negative");

            // Create new bill
            Bill bill = new Bill(
                customerId,
                accountId,
                getPricePlan(pricePlanId),
                usage,
                "USD" // Default currency, should be configurable
            );

            // Calculate amounts
            bill.calculateTotalAmount();
            
            // Set tax information based on jurisdiction
            bill.setTaxInformation(
                new BigDecimal("0.18"), // 18% tax rate
                "IN", // India
                "GST" // Tax type
            );

            // Finalize and persist
            bill.finalize();
            Bill savedBill = billingRepository.save(bill);
            
            // Record metric
            billGenerationCounter.increment();
            
            log.info("Generated bill: {} for customer: {}, amount: {}", 
                    savedBill.getId(), customerId, savedBill.getTotalAmount());
            
            return savedBill;
            
        } catch (Exception e) {
            log.error("Error generating bill for customer: {}", customerId, e);
            throw e;
        }
    }

    /**
     * Processes payment for a bill with enhanced error handling.
     *
     * @param billId Bill identifier
     * @param amount Payment amount
     * @param paymentReference Payment reference number
     * @return Updated bill with payment status
     * @throws IllegalArgumentException if payment details are invalid
     * @throws IllegalStateException if bill cannot be paid
     */
    @Transactional
    @CircuitBreaker(name = "paymentProcessing", fallbackMethod = "fallbackProcessPayment")
    @Retry(name = "paymentProcessing")
    public Bill processBillPayment(UUID billId, BigDecimal amount, String paymentReference) {
        log.debug("Processing payment for bill: {}, amount: {}, reference: {}", 
                billId, amount, paymentReference);
        
        try {
            // Validate inputs
            Assert.notNull(billId, "Bill ID must not be null");
            Assert.notNull(amount, "Payment amount must not be null");
            Assert.hasText(paymentReference, "Payment reference must not be empty");

            // Retrieve and validate bill
            Bill bill = billingRepository.findById(billId)
                .orElseThrow(() -> new IllegalArgumentException("Bill not found: " + billId));

            // Validate payment amount
            if (amount.compareTo(bill.getTotalAmount()) != 0) {
                throw new IllegalArgumentException("Payment amount does not match bill total");
            }

            // Process payment
            bill.markAsPaid(paymentReference, "ONLINE");
            Bill updatedBill = billingRepository.save(bill);
            
            // Record metric
            paymentProcessingCounter.increment();
            
            log.info("Processed payment for bill: {}, amount: {}", billId, amount);
            
            return updatedBill;
            
        } catch (Exception e) {
            log.error("Error processing payment for bill: {}", billId, e);
            throw e;
        }
    }

    /**
     * Processes batch of usage events with idempotency.
     *
     * @param events List of usage events
     * @param idempotencyKey Idempotency key for batch processing
     * @throws IllegalArgumentException if events are invalid
     */
    @Async
    @Transactional
    @CircuitBreaker(name = "eventProcessing", fallbackMethod = "fallbackProcessEvents")
    public void processUsageEventBatch(List<UsageEvent> events, String idempotencyKey) {
        log.debug("Processing {} usage events with key: {}", events.size(), idempotencyKey);
        
        try {
            // Check idempotency
            if (!processedIdempotencyKeys.add(idempotencyKey)) {
                log.info("Skipping duplicate event batch: {}", idempotencyKey);
                return;
            }

            // Validate events
            Assert.notEmpty(events, "Events list must not be empty");
            
            // Process events in batch
            Map<String, Long> usageByAccount = new HashMap<>();
            
            for (UsageEvent event : events) {
                usageByAccount.merge(event.getAccountId(), event.getUsage(), Long::sum);
                eventProcessingCounter.increment();
            }

            // Generate bills if needed
            usageByAccount.forEach((accountId, totalUsage) -> {
                if (shouldGenerateBill(accountId, totalUsage)) {
                    generateBill(
                        getCustomerId(accountId),
                        accountId,
                        getActivePricePlan(accountId),
                        totalUsage
                    );
                }
            });
            
            log.info("Processed {} events successfully", events.size());
            
        } catch (Exception e) {
            log.error("Error processing usage events batch", e);
            throw e;
        }
    }

    // Private helper methods

    private PricePlan getPricePlan(UUID pricePlanId) {
        // Implementation to retrieve price plan
        return null; // Placeholder
    }

    private boolean shouldGenerateBill(String accountId, Long usage) {
        // Implementation to check billing criteria
        return false; // Placeholder
    }

    private String getCustomerId(String accountId) {
        // Implementation to get customer ID
        return null; // Placeholder
    }

    private UUID getActivePricePlan(String accountId) {
        // Implementation to get active price plan
        return null; // Placeholder
    }

    // Fallback methods for circuit breaker

    private Bill fallbackGenerateBill(String customerId, String accountId, UUID pricePlanId, 
            Long usage, Exception e) {
        log.error("Fallback: Bill generation failed", e);
        throw new RuntimeException("Unable to generate bill, please try again later");
    }

    private Bill fallbackProcessPayment(UUID billId, BigDecimal amount, 
            String paymentReference, Exception e) {
        log.error("Fallback: Payment processing failed", e);
        throw new RuntimeException("Unable to process payment, please try again later");
    }

    private void fallbackProcessEvents(List<UsageEvent> events, String idempotencyKey, 
            Exception e) {
        log.error("Fallback: Event processing failed", e);
        throw new RuntimeException("Unable to process usage events, please try again later");
    }
}