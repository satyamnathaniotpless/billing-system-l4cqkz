package com.otpless.billing.repository;

import com.otpless.billing.model.Bill;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import javax.persistence.QueryHint;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository interface for managing billing records in the OTPless Internal Billing System.
 * Provides comprehensive data access methods with optimized query patterns and caching support.
 *
 * @version 1.0
 * @since 2023-11-01
 */
@Repository
public interface BillingRepository extends JpaRepository<Bill, UUID> {

    /**
     * Retrieves all bills for a customer with pagination and sorting support.
     * Results are cached for improved performance.
     *
     * @param customerId Customer identifier
     * @param pageable Pagination and sorting parameters
     * @return Page of bills for the customer
     */
    @Query("SELECT b FROM Bill b WHERE b.customerId = :customerId")
    @QueryHints(@QueryHint(name = "org.hibernate.cacheable", value = "true"))
    Page<Bill> findByCustomerId(@Param("customerId") String customerId, Pageable pageable);

    /**
     * Retrieves all bills for an account with pagination and sorting support.
     * Results are cached for improved performance.
     *
     * @param accountId Account identifier
     * @param pageable Pagination and sorting parameters
     * @return Page of bills for the account
     */
    @Query("SELECT b FROM Bill b WHERE b.accountId = :accountId")
    @QueryHints(@QueryHint(name = "org.hibernate.cacheable", value = "true"))
    Page<Bill> findByAccountId(@Param("accountId") String accountId, Pageable pageable);

    /**
     * Retrieves all unpaid bills for a customer.
     * Results are cached for improved performance.
     *
     * @param customerId Customer identifier
     * @return List of unpaid bills
     */
    @Query("SELECT b FROM Bill b WHERE b.customerId = :customerId AND b.status IN ('PENDING', 'OVERDUE')")
    @QueryHints(@QueryHint(name = "org.hibernate.cacheable", value = "true"))
    List<Bill> findUnpaidBills(@Param("customerId") String customerId);

    /**
     * Retrieves all overdue bills based on due date.
     * Results are cached for improved performance.
     *
     * @param currentDate Current date for comparison
     * @return List of overdue bills
     */
    @Query("SELECT b FROM Bill b WHERE b.status = 'PENDING' AND b.dueDate < :currentDate")
    @QueryHints(@QueryHint(name = "org.hibernate.cacheable", value = "true"))
    List<Bill> findOverdueBills(@Param("currentDate") LocalDateTime currentDate);

    /**
     * Retrieves bills for a customer within a specific billing period.
     * Results are cached for improved performance.
     *
     * @param customerId Customer identifier
     * @param startDate Period start date
     * @param endDate Period end date
     * @return List of bills within the period
     */
    @Query("SELECT b FROM Bill b WHERE b.customerId = :customerId " +
           "AND b.billingPeriodStart >= :startDate AND b.billingPeriodEnd <= :endDate")
    @QueryHints(@QueryHint(name = "org.hibernate.cacheable", value = "true"))
    List<Bill> findBillsByPeriod(
        @Param("customerId") String customerId,
        @Param("startDate") LocalDateTime startDate,
        @Param("endDate") LocalDateTime endDate
    );

    /**
     * Retrieves bills by status with pagination support.
     * Results are cached for improved performance.
     *
     * @param status Bill status
     * @param pageable Pagination and sorting parameters
     * @return Page of bills with specified status
     */
    @Query("SELECT b FROM Bill b WHERE b.status = :status")
    @QueryHints(@QueryHint(name = "org.hibernate.cacheable", value = "true"))
    Page<Bill> findByStatus(@Param("status") Bill.BillStatus status, Pageable pageable);

    /**
     * Retrieves bills due for payment within a date range.
     * Results are cached for improved performance.
     *
     * @param startDate Range start date
     * @param endDate Range end date
     * @return List of bills due within range
     */
    @Query("SELECT b FROM Bill b WHERE b.status = 'PENDING' " +
           "AND b.dueDate BETWEEN :startDate AND :endDate")
    @QueryHints(@QueryHint(name = "org.hibernate.cacheable", value = "true"))
    List<Bill> findBillsDueInRange(
        @Param("startDate") LocalDateTime startDate,
        @Param("endDate") LocalDateTime endDate
    );

    /**
     * Retrieves a bill by payment reference.
     * Results are cached for improved performance.
     *
     * @param paymentReference Payment reference identifier
     * @return Optional containing the bill if found
     */
    @Query("SELECT b FROM Bill b WHERE b.paymentReference = :paymentReference")
    @QueryHints(@QueryHint(name = "org.hibernate.cacheable", value = "true"))
    Optional<Bill> findByPaymentReference(@Param("paymentReference") String paymentReference);

    /**
     * Counts unpaid bills for a customer.
     *
     * @param customerId Customer identifier
     * @return Count of unpaid bills
     */
    @Query("SELECT COUNT(b) FROM Bill b WHERE b.customerId = :customerId " +
           "AND b.status IN ('PENDING', 'OVERDUE')")
    long countUnpaidBills(@Param("customerId") String customerId);
}