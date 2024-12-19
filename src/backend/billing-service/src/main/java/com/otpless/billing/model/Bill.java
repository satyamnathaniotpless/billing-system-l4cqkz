package com.otpless.billing.model;

import javax.persistence.*;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.DecimalMin;
import javax.validation.constraints.Size;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.UUID;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;
import lombok.AccessLevel;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Enterprise-grade entity class representing a bill/invoice in the OTPless Internal Billing System.
 * Provides comprehensive billing record management with features including multi-currency support,
 * tax handling, and payment lifecycle management.
 *
 * @version 1.0
 * @since 2023-11-01
 */
@Entity
@Table(name = "bills", indexes = {
    @Index(name = "idx_customer_id", columnList = "customer_id"),
    @Index(name = "idx_status", columnList = "status"),
    @Index(name = "idx_billing_period", columnList = "billing_period_start, billing_period_end")
})
@EntityListeners(AuditingEntityListener.class)
@Data
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Bill {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @NotNull
    @Column(name = "customer_id", nullable = false)
    private String customerId;

    @NotNull
    @Column(name = "account_id", nullable = false)
    private String accountId;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "price_plan_id", nullable = false)
    private PricePlan pricePlan;

    @NotNull
    @Column(nullable = false)
    private Long usage;

    @NotNull
    @DecimalMin("0.0")
    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal amount;

    @NotNull
    @DecimalMin("0.0")
    @Column(name = "tax_rate", nullable = false, precision = 5, scale = 2)
    private BigDecimal taxRate;

    @NotNull
    @DecimalMin("0.0")
    @Column(name = "tax_amount", nullable = false, precision = 19, scale = 4)
    private BigDecimal taxAmount;

    @NotNull
    @DecimalMin("0.0")
    @Column(name = "total_amount", nullable = false, precision = 19, scale = 4)
    private BigDecimal totalAmount;

    @NotNull
    @Size(min = 3, max = 3)
    @Column(nullable = false)
    private String currency;

    @NotNull
    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private BillStatus status;

    @Column(name = "tax_jurisdiction")
    private String taxJurisdiction;

    @Column(name = "tax_identifier")
    private String taxIdentifier;

    @NotNull
    @Column(name = "billing_period_start", nullable = false)
    private LocalDateTime billingPeriodStart;

    @NotNull
    @Column(name = "billing_period_end", nullable = false)
    private LocalDateTime billingPeriodEnd;

    @NotNull
    @Column(name = "due_date", nullable = false)
    private LocalDateTime dueDate;

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    @Column(name = "payment_reference")
    private String paymentReference;

    @Column(name = "payment_method")
    private String paymentMethod;

    @Version
    private Long version;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @CreatedBy
    @Column(name = "created_by", nullable = false, updatable = false)
    private String createdBy;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @LastModifiedBy
    @Column(name = "updated_by", nullable = false)
    private String updatedBy;

    /**
     * Enumeration of possible bill statuses.
     */
    public enum BillStatus {
        DRAFT, PENDING, PAID, OVERDUE, CANCELLED, VOID
    }

    /**
     * Constructs a new Bill with required initial data.
     *
     * @param customerId Customer identifier
     * @param accountId Account identifier
     * @param pricePlan Price plan for the bill
     * @param usage Usage amount
     * @param currency Currency code
     * @throws IllegalArgumentException if any required parameter is invalid
     */
    public Bill(String customerId, String accountId, PricePlan pricePlan, Long usage, String currency) {
        if (customerId == null || accountId == null || pricePlan == null || usage == null || currency == null) {
            throw new IllegalArgumentException("All parameters are required");
        }
        
        this.customerId = customerId;
        this.accountId = accountId;
        this.pricePlan = pricePlan;
        this.usage = usage;
        this.currency = currency.toUpperCase();
        this.status = BillStatus.DRAFT;
        
        // Initialize with zero amounts - to be calculated
        this.amount = BigDecimal.ZERO;
        this.taxRate = BigDecimal.ZERO;
        this.taxAmount = BigDecimal.ZERO;
        this.totalAmount = BigDecimal.ZERO;
        
        // Set billing period
        this.billingPeriodStart = LocalDateTime.now().withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0);
        this.billingPeriodEnd = billingPeriodStart.plusMonths(1).minusSeconds(1);
        this.dueDate = billingPeriodEnd.plusDays(30); // 30 days payment terms
    }

    /**
     * Calculates the total bill amount including taxes with precision handling.
     *
     * @return The calculated total amount with taxes
     * @throws IllegalStateException if price plan is inactive
     */
    public BigDecimal calculateTotalAmount() {
        if (!pricePlan.isActive()) {
            throw new IllegalStateException("Cannot calculate amount with inactive price plan");
        }

        // Calculate base amount using price plan
        this.amount = pricePlan.calculatePrice(usage);

        // Calculate tax amount based on jurisdiction
        this.taxAmount = amount.multiply(taxRate)
            .setScale(4, RoundingMode.HALF_UP);

        // Calculate total amount
        this.totalAmount = amount.add(taxAmount)
            .setScale(4, RoundingMode.HALF_UP);

        return this.totalAmount;
    }

    /**
     * Determines if the bill is overdue based on due date and payment status.
     *
     * @return true if bill is unpaid and past due date
     */
    public boolean isOverdue() {
        if (status == BillStatus.PAID || status == BillStatus.CANCELLED || status == BillStatus.VOID) {
            return false;
        }
        
        return LocalDateTime.now().isAfter(dueDate);
    }

    /**
     * Updates bill status to paid with payment details.
     *
     * @param paymentReference Payment reference identifier
     * @param paymentMethod Method of payment
     * @throws IllegalStateException if bill is not in a payable state
     */
    public void markAsPaid(String paymentReference, String paymentMethod) {
        if (status != BillStatus.PENDING && status != BillStatus.OVERDUE) {
            throw new IllegalStateException("Bill cannot be marked as paid in current status: " + status);
        }

        this.paymentReference = paymentReference;
        this.paymentMethod = paymentMethod;
        this.paidAt = LocalDateTime.now();
        this.status = BillStatus.PAID;
    }

    /**
     * Sets the tax rate and jurisdiction information for the bill.
     *
     * @param taxRate Tax rate to apply
     * @param taxJurisdiction Tax jurisdiction
     * @param taxIdentifier Tax registration number or identifier
     */
    public void setTaxInformation(BigDecimal taxRate, String taxJurisdiction, String taxIdentifier) {
        this.taxRate = taxRate;
        this.taxJurisdiction = taxJurisdiction;
        this.taxIdentifier = taxIdentifier;
        
        // Recalculate amounts with new tax rate
        calculateTotalAmount();
    }

    /**
     * Finalizes the bill and changes status to PENDING.
     *
     * @throws IllegalStateException if bill is not in DRAFT status
     */
    public void finalize() {
        if (status != BillStatus.DRAFT) {
            throw new IllegalStateException("Only DRAFT bills can be finalized");
        }

        calculateTotalAmount(); // Ensure final amounts are calculated
        this.status = BillStatus.PENDING;
    }
}