package com.otpless.billing.controller;

import com.otpless.billing.model.PricePlan;
import com.otpless.billing.service.BillingService;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import io.micrometer.core.annotation.Timed;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.CacheEvict;
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
 * REST controller for managing price plans in the OTPless Internal Billing System.
 * Provides secure endpoints for price plan CRUD operations with caching and monitoring.
 *
 * @version 1.0
 * @since 2023-11-01
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/price-plans")
@Validated
@Tag(name = "Price Plans", description = "Price plan management endpoints")
@SecurityRequirement(name = "bearer-auth")
public class PricePlanController {

    private final BillingService billingService;
    private final CacheManager cacheManager;

    /**
     * Initializes the controller with required dependencies.
     *
     * @param billingService Service for billing operations
     * @param cacheManager Cache manager for price plan data
     */
    public PricePlanController(BillingService billingService, CacheManager cacheManager) {
        this.billingService = billingService;
        this.cacheManager = cacheManager;
    }

    /**
     * Creates a new price plan.
     *
     * @param pricePlan Price plan details
     * @return Created price plan
     */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @RateLimiter(name = "pricePlanCreation")
    @Timed(value = "price.plan.creation", description = "Time taken to create price plan")
    @Operation(summary = "Create new price plan", description = "Creates a new price plan with validation")
    @ApiResponse(responseCode = "201", description = "Price plan created successfully")
    public ResponseEntity<PricePlan> createPricePlan(@Valid @RequestBody PricePlan pricePlan) {
        log.info("Creating new price plan: {}", pricePlan.getName());
        
        // Set creation metadata
        pricePlan.setCreatedAt(LocalDateTime.now());
        pricePlan.setUpdatedAt(LocalDateTime.now());
        
        // Validate and save price plan
        PricePlan savedPlan = billingService.validatePlan(pricePlan);
        
        // Clear relevant caches
        cacheManager.getCache("price-plans").clear();
        
        log.info("Created price plan with ID: {}", savedPlan.getId());
        return new ResponseEntity<>(savedPlan, HttpStatus.CREATED);
    }

    /**
     * Retrieves a specific price plan by ID.
     *
     * @param id Price plan ID
     * @return Price plan details
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    @Cacheable(value = "price-plans", key = "#id")
    @RateLimiter(name = "pricePlanRetrieval")
    @Timed(value = "price.plan.retrieval")
    @Operation(summary = "Get price plan", description = "Retrieves price plan by ID")
    public ResponseEntity<PricePlan> getPricePlan(@PathVariable @NotNull UUID id) {
        log.debug("Retrieving price plan: {}", id);
        return billingService.getPricePlan(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Updates an existing price plan.
     *
     * @param id Price plan ID
     * @param pricePlan Updated price plan details
     * @return Updated price plan
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @CacheEvict(value = "price-plans", key = "#id")
    @RateLimiter(name = "pricePlanUpdate")
    @Timed(value = "price.plan.update")
    @Operation(summary = "Update price plan", description = "Updates existing price plan")
    public ResponseEntity<PricePlan> updatePricePlan(
            @PathVariable @NotNull UUID id,
            @Valid @RequestBody PricePlan pricePlan) {
        log.info("Updating price plan: {}", id);
        
        pricePlan.setId(id);
        pricePlan.setUpdatedAt(LocalDateTime.now());
        
        PricePlan updatedPlan = billingService.validatePlan(pricePlan);
        
        log.info("Updated price plan: {}", id);
        return ResponseEntity.ok(updatedPlan);
    }

    /**
     * Retrieves all active price plans.
     *
     * @param pageable Pagination information
     * @return Page of active price plans
     */
    @GetMapping("/active")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    @Cacheable(value = "active-price-plans")
    @RateLimiter(name = "pricePlanList")
    @Timed(value = "price.plan.list.active")
    @Operation(summary = "List active price plans", description = "Retrieves all active price plans")
    public ResponseEntity<Page<PricePlan>> getActivePricePlans(Pageable pageable) {
        log.debug("Retrieving active price plans, page: {}", pageable.getPageNumber());
        return ResponseEntity.ok(billingService.getActivePricePlans(pageable));
    }

    /**
     * Calculates price for given usage amount using specified price plan.
     *
     * @param id Price plan ID
     * @param usage Usage amount
     * @return Calculated price
     */
    @GetMapping("/{id}/calculate")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    @Cacheable(value = "price-calculations", key = "#id + '-' + #usage")
    @RateLimiter(name = "priceCalculation")
    @Timed(value = "price.calculation")
    @Operation(summary = "Calculate price", description = "Calculates price for given usage")
    public ResponseEntity<BigDecimal> calculatePrice(
            @PathVariable @NotNull UUID id,
            @RequestParam @NotNull Long usage) {
        log.debug("Calculating price for plan: {}, usage: {}", id, usage);
        
        return billingService.getPricePlan(id)
            .map(plan -> ResponseEntity.ok(plan.calculatePrice(usage)))
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Deactivates a price plan.
     *
     * @param id Price plan ID
     * @return No content response
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @CacheEvict(value = {"price-plans", "active-price-plans"}, allEntries = true)
    @RateLimiter(name = "pricePlanDeactivation")
    @Timed(value = "price.plan.deactivation")
    @Operation(summary = "Deactivate price plan", description = "Deactivates existing price plan")
    public ResponseEntity<Void> deactivatePricePlan(@PathVariable @NotNull UUID id) {
        log.info("Deactivating price plan: {}", id);
        
        billingService.deactivatePricePlan(id);
        
        log.info("Deactivated price plan: {}", id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Exception handler for validation errors.
     *
     * @param ex Validation exception
     * @return Error response
     */
    @ExceptionHandler(javax.validation.ValidationException.class)
    public ResponseEntity<String> handleValidationException(javax.validation.ValidationException ex) {
        log.error("Validation error: ", ex);
        return ResponseEntity
            .badRequest()
            .body("Validation error: " + ex.getMessage());
    }
}