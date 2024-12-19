package com.otpless.billing.model;

import com.fasterxml.jackson.databind.JsonNode;
import com.otpless.security.annotation.EncryptedField;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Cache;
import org.hibernate.annotations.CacheConcurrencyStrategy;
import org.hibernate.annotations.Cacheable;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import javax.persistence.*;
import javax.validation.constraints.DecimalMin;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Enterprise-grade entity class representing a price plan in the OTPless Internal Billing System.
 * Manages pricing tiers, rates, and billing configurations with comprehensive audit and security features.
 *
 * @version 1.0
 * @since 2023-11-01
 */
@Entity
@Table(name = "price_plans")
@Cacheable
@Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
@EntityListeners(AuditingEntityListener.class)
@Data
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
public class PricePlan {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @NotNull
    @Size(min = 3, max = 100)
    @Column(nullable = false)
    private String name;

    @Size(max = 500)
    private String description;

    @NotNull
    @Size(min = 3, max = 3)
    @Column(nullable = false)
    private String currency;

    @NotNull
    @DecimalMin(value = "0.0")
    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal basePrice;

    @Column(nullable = false)
    private Long includedUsage;

    @NotNull
    @DecimalMin(value = "0.0")
    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal perUnitPrice;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "price_plan_id")
    private List<PriceComponent> priceComponents = new ArrayList<>();

    @NotNull
    @Column(nullable = false)
    private String billingFrequency;

    @Column(nullable = false)
    private boolean active;

    @NotNull
    @Column(nullable = false)
    private LocalDateTime validFrom;

    private LocalDateTime validUntil;

    @EncryptedField
    @Column(name = "contract_id")
    private String contractId;

    @Column(columnDefinition = "jsonb")
    private JsonNode customTerms;

    @Version
    private Long version;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @CreatedBy
    @Column(nullable = false, updatable = false)
    private String createdBy;

    @LastModifiedDate
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @LastModifiedBy
    @Column(nullable = false)
    private String updatedBy;

    /**
     * Calculates the total price for the given usage amount considering all pricing components
     * and custom contract terms.
     *
     * @param usage The usage amount to calculate price for
     * @return The calculated total price with proper precision
     * @throws IllegalArgumentException if usage is negative
     */
    @Cacheable("price-calculations")
    public BigDecimal calculatePrice(Long usage) {
        if (usage < 0) {
            throw new IllegalArgumentException("Usage cannot be negative");
        }

        if (!isActive()) {
            throw new IllegalStateException("Cannot calculate price for inactive plan");
        }

        // Calculate base tier price
        BigDecimal totalPrice = basePrice;
        
        // Calculate overage if usage exceeds included amount
        if (usage > includedUsage) {
            Long overageUnits = usage - includedUsage;
            BigDecimal overagePrice = perUnitPrice.multiply(BigDecimal.valueOf(overageUnits));
            totalPrice = totalPrice.add(overagePrice);
        }

        // Apply price components (volume discounts, etc.)
        for (PriceComponent component : priceComponents) {
            if (component.isApplicable(usage)) {
                totalPrice = component.applyPricing(totalPrice, usage);
            }
        }

        // Apply custom contract terms if present
        if (customTerms != null && customTerms.has("priceModifiers")) {
            totalPrice = applyCustomTerms(totalPrice);
        }

        // Return final price rounded to 4 decimal places
        return totalPrice.setScale(4, RoundingMode.HALF_UP);
    }

    /**
     * Checks if the price plan is currently active and valid.
     *
     * @return true if the plan is active and within its validity period
     */
    public boolean isActive() {
        LocalDateTime now = LocalDateTime.now();
        boolean validityCheck = now.isAfter(validFrom) && 
            (validUntil == null || now.isBefore(validUntil));
        
        return active && validityCheck;
    }

    /**
     * Applies custom contract terms to the calculated price.
     *
     * @param basePrice The base price before applying custom terms
     * @return The modified price after applying custom terms
     */
    private BigDecimal applyCustomTerms(BigDecimal basePrice) {
        BigDecimal modifiedPrice = basePrice;
        
        JsonNode modifiers = customTerms.get("priceModifiers");
        if (modifiers.has("discount")) {
            BigDecimal discount = BigDecimal.valueOf(modifiers.get("discount").asDouble());
            modifiedPrice = modifiedPrice.multiply(BigDecimal.ONE.subtract(discount));
        }
        
        return modifiedPrice;
    }
}