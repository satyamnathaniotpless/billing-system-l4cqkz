package com.otpless.billing.controller;

import com.otpless.billing.model.Bill;
import com.otpless.billing.service.BillingService;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.micrometer.core.annotation.Timed;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * REST controller for managing billing operations in the OTPless Internal Billing System.
 * Provides secure endpoints with comprehensive monitoring and resilience features.
 *
 * @version 1.0
 * @since 2023-11-01
 */
@RestController
@RequestMapping("/api/v1/billing")
@Validated
@SecurityRequirement(name = "bearer-jwt")
@Tag(name = "Billing Operations", description = "Endpoints for managing billing operations")
@Slf4j
public class BillingController {

    private final BillingService billingService;
    private final MeterRegistry meterRegistry;
    private final Timer billGenerationTimer;
    private final Timer billRetrievalTimer;

    /**
     * Initializes the billing controller with required dependencies.
     *
     * @param billingService Service for billing operations
     * @param meterRegistry Registry for metrics collection
     */
    public BillingController(BillingService billingService, MeterRegistry meterRegistry) {
        this.billingService = billingService;
        this.meterRegistry = meterRegistry;

        // Initialize performance metrics
        this.billGenerationTimer = Timer.builder("billing.generation.time")
                .description("Time taken to generate bills")
                .register(meterRegistry);
        this.billRetrievalTimer = Timer.builder("billing.retrieval.time")
                .description("Time taken to retrieve bills")
                .register(meterRegistry);
    }

    /**
     * Generates a new bill with enhanced validation and monitoring.
     *
     * @param request Bill generation request
     * @param correlationId Request correlation ID for tracing
     * @return Generated bill with HTTP status
     */
    @PostMapping("/bills")
    @Operation(summary = "Generate new bill", description = "Generates a new bill for customer usage")
    @ApiResponse(responseCode = "201", description = "Bill generated successfully")
    @CircuitBreaker(name = "billing", fallbackMethod = "fallbackGenerateBill")
    @Timed("billing.generate")
    @PreAuthorize("hasRole('BILLING_ADMIN')")
    public ResponseEntity<Bill> generateBill(
            @Valid @RequestBody BillRequest request,
            @RequestHeader("X-Correlation-ID") String correlationId) {
        
        log.info("Generating bill for customer: {}, correlation ID: {}", 
                request.getCustomerId(), correlationId);

        return billGenerationTimer.record(() -> {
            Bill bill = billingService.generateBill(
                request.getCustomerId(),
                request.getAccountId(),
                request.getPricePlanId(),
                request.getUsage()
            );
            
            log.info("Generated bill: {} for customer: {}", bill.getId(), request.getCustomerId());
            return ResponseEntity.status(HttpStatus.CREATED).body(bill);
        });
    }

    /**
     * Retrieves bills for a customer with caching support.
     *
     * @param customerId Customer identifier
     * @param pageable Pagination parameters
     * @param correlationId Request correlation ID for tracing
     * @return Page of customer bills
     */
    @GetMapping("/customers/{customerId}/bills")
    @Operation(summary = "Get customer bills", description = "Retrieves bills for a customer")
    @ApiResponse(responseCode = "200", description = "Bills retrieved successfully")
    @Cacheable(value = "customer-bills", key = "#customerId + #pageable")
    @CircuitBreaker(name = "billing", fallbackMethod = "fallbackGetCustomerBills")
    @Timed("billing.retrieve")
    @PreAuthorize("hasAnyRole('BILLING_ADMIN', 'BILLING_VIEW')")
    public ResponseEntity<Page<Bill>> getCustomerBills(
            @PathVariable @NotNull String customerId,
            Pageable pageable,
            @RequestHeader("X-Correlation-ID") String correlationId) {
        
        log.info("Retrieving bills for customer: {}, correlation ID: {}", 
                customerId, correlationId);

        return billRetrievalTimer.record(() -> {
            Page<Bill> bills = billingService.getCustomerBills(customerId, pageable);
            return ResponseEntity.ok(bills);
        });
    }

    /**
     * Processes payment for a bill with validation.
     *
     * @param billId Bill identifier
     * @param request Payment request details
     * @param correlationId Request correlation ID for tracing
     * @return Updated bill status
     */
    @PostMapping("/bills/{billId}/payments")
    @Operation(summary = "Process bill payment", description = "Processes payment for a bill")
    @ApiResponse(responseCode = "200", description = "Payment processed successfully")
    @CircuitBreaker(name = "billing", fallbackMethod = "fallbackProcessPayment")
    @Timed("billing.payment")
    @PreAuthorize("hasRole('BILLING_ADMIN')")
    public ResponseEntity<Bill> processPayment(
            @PathVariable @NotNull UUID billId,
            @Valid @RequestBody PaymentRequest request,
            @RequestHeader("X-Correlation-ID") String correlationId) {
        
        log.info("Processing payment for bill: {}, correlation ID: {}", 
                billId, correlationId);

        Bill updatedBill = billingService.processBillPayment(
            billId,
            request.getAmount(),
            request.getPaymentReference()
        );
        
        log.info("Processed payment for bill: {}, status: {}", 
                billId, updatedBill.getStatus());
        
        return ResponseEntity.ok(updatedBill);
    }

    /**
     * Retrieves overdue bills with filtering support.
     *
     * @param asOfDate Reference date for overdue calculation
     * @param correlationId Request correlation ID for tracing
     * @return List of overdue bills
     */
    @GetMapping("/bills/overdue")
    @Operation(summary = "Get overdue bills", description = "Retrieves all overdue bills")
    @ApiResponse(responseCode = "200", description = "Overdue bills retrieved successfully")
    @CircuitBreaker(name = "billing", fallbackMethod = "fallbackGetOverdueBills")
    @Timed("billing.overdue")
    @PreAuthorize("hasRole('BILLING_ADMIN')")
    public ResponseEntity<List<Bill>> getOverdueBills(
            @RequestParam(required = false) LocalDateTime asOfDate,
            @RequestHeader("X-Correlation-ID") String correlationId) {
        
        log.info("Retrieving overdue bills, correlation ID: {}", correlationId);
        
        LocalDateTime referenceDate = asOfDate != null ? asOfDate : LocalDateTime.now();
        List<Bill> overdueBills = billingService.getOverdueBills(referenceDate);
        
        return ResponseEntity.ok(overdueBills);
    }

    // Fallback methods for circuit breaker

    private ResponseEntity<Bill> fallbackGenerateBill(BillRequest request, String correlationId, 
            Exception e) {
        log.error("Fallback: Bill generation failed for customer: {}", 
                request.getCustomerId(), e);
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .build();
    }

    private ResponseEntity<Page<Bill>> fallbackGetCustomerBills(String customerId, 
            Pageable pageable, String correlationId, Exception e) {
        log.error("Fallback: Failed to retrieve bills for customer: {}", customerId, e);
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .build();
    }

    private ResponseEntity<Bill> fallbackProcessPayment(UUID billId, PaymentRequest request, 
            String correlationId, Exception e) {
        log.error("Fallback: Payment processing failed for bill: {}", billId, e);
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .build();
    }

    private ResponseEntity<List<Bill>> fallbackGetOverdueBills(LocalDateTime asOfDate, 
            String correlationId, Exception e) {
        log.error("Fallback: Failed to retrieve overdue bills", e);
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .build();
    }

    // Request/Response DTOs

    @Data
    @Validated
    public static class BillRequest {
        @NotNull
        private String customerId;
        
        @NotNull
        private String accountId;
        
        @NotNull
        private UUID pricePlanId;
        
        @NotNull
        private Long usage;
    }

    @Data
    @Validated
    public static class PaymentRequest {
        @NotNull
        private BigDecimal amount;
        
        @NotNull
        private String paymentReference;
    }
}