package com.otpless.billing;

import com.otpless.billing.model.Bill;
import com.otpless.billing.model.Bill.BillStatus;
import com.otpless.billing.model.PricePlan;
import com.otpless.billing.model.UsageEvent;
import com.otpless.billing.repository.BillingRepository;
import com.otpless.billing.service.BillingService;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Timeout;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Comprehensive test suite for BillingService verifying billing operations,
 * performance requirements, and enterprise-grade quality standards.
 *
 * @version 1.0
 * @since 2023-11-01
 */
@ExtendWith(MockitoExtension.class)
public class BillingServiceTests {

    @Mock
    private BillingRepository billingRepository;

    private BillingService billingService;
    private MeterRegistry meterRegistry;

    @BeforeEach
    void setUp() {
        meterRegistry = new SimpleMeterRegistry();
        billingService = new BillingService(billingRepository, meterRegistry);
    }

    @Test
    @Timeout(value = 100, unit = TimeUnit.MILLISECONDS)
    void testGenerateBill() {
        // Arrange
        String customerId = "CUST001";
        String accountId = "ACC001";
        UUID pricePlanId = UUID.randomUUID();
        Long usage = 1000L;

        PricePlan pricePlan = PricePlan.builder()
            .id(pricePlanId)
            .name("Standard Plan")
            .currency("USD")
            .basePrice(BigDecimal.valueOf(100))
            .includedUsage(500L)
            .perUnitPrice(BigDecimal.valueOf(0.1))
            .active(true)
            .validFrom(LocalDateTime.now().minusDays(30))
            .build();

        Bill expectedBill = new Bill(customerId, accountId, pricePlan, usage, "USD");
        expectedBill.setTaxInformation(new BigDecimal("0.18"), "IN", "GST");
        expectedBill.calculateTotalAmount();
        expectedBill.finalize();

        when(billingRepository.save(any(Bill.class))).thenReturn(expectedBill);

        // Act
        Bill generatedBill = billingService.generateBill(customerId, accountId, pricePlanId, usage);

        // Assert
        assertThat(generatedBill).isNotNull();
        assertThat(generatedBill.getStatus()).isEqualTo(BillStatus.PENDING);
        assertThat(generatedBill.getTotalAmount()).isGreaterThan(BigDecimal.ZERO);
        assertThat(generatedBill.getTaxAmount()).isGreaterThan(BigDecimal.ZERO);
        assertThat(generatedBill.getTaxRate()).isEqualTo(new BigDecimal("0.18"));
        
        verify(billingRepository).save(any(Bill.class));
    }

    @Test
    void testProcessBillPayment() {
        // Arrange
        UUID billId = UUID.randomUUID();
        BigDecimal amount = BigDecimal.valueOf(118.00); // Including 18% tax
        String paymentReference = "PAY-REF-001";

        Bill bill = mock(Bill.class);
        when(bill.getTotalAmount()).thenReturn(amount);
        when(bill.getStatus()).thenReturn(BillStatus.PENDING);
        when(billingRepository.findById(billId)).thenReturn(Optional.of(bill));
        when(billingRepository.save(any(Bill.class))).thenReturn(bill);

        // Act
        Bill updatedBill = billingService.processBillPayment(billId, amount, paymentReference);

        // Assert
        assertThat(updatedBill).isNotNull();
        verify(bill).markAsPaid(paymentReference, "ONLINE");
        verify(billingRepository).save(bill);
    }

    @RepeatedTest(1000)
    @Timeout(value = 100, unit = TimeUnit.MILLISECONDS)
    void testBillGenerationPerformance() {
        // Arrange
        String customerId = "CUST001";
        String accountId = "ACC001";
        UUID pricePlanId = UUID.randomUUID();
        Long usage = 1000L;

        PricePlan pricePlan = PricePlan.builder()
            .id(pricePlanId)
            .name("Standard Plan")
            .currency("USD")
            .basePrice(BigDecimal.valueOf(100))
            .includedUsage(500L)
            .perUnitPrice(BigDecimal.valueOf(0.1))
            .active(true)
            .validFrom(LocalDateTime.now().minusDays(30))
            .build();

        Bill expectedBill = new Bill(customerId, accountId, pricePlan, usage, "USD");
        when(billingRepository.save(any(Bill.class))).thenReturn(expectedBill);

        // Act & Assert - Should complete within timeout
        Bill generatedBill = billingService.generateBill(customerId, accountId, pricePlanId, usage);
        assertThat(generatedBill).isNotNull();
    }

    @Test
    void testProcessUsageEventBatch() {
        // Arrange
        List<UsageEvent> events = new ArrayList<>();
        for (int i = 0; i < 100; i++) {
            UsageEvent event = new UsageEvent();
            // Set required event properties
            events.add(event);
        }
        String idempotencyKey = UUID.randomUUID().toString();

        // Act
        billingService.processUsageEventBatch(events, idempotencyKey);

        // Assert
        // Verify metrics were recorded
        assertThat(meterRegistry.get("billing.events.processed").counter().count())
            .isEqualTo(events.size());
    }

    @Test
    void testBillGenerationWithInvalidInputs() {
        // Arrange
        String customerId = null;
        String accountId = "ACC001";
        UUID pricePlanId = UUID.randomUUID();
        Long usage = 1000L;

        // Act & Assert
        assertThatThrownBy(() -> 
            billingService.generateBill(customerId, accountId, pricePlanId, usage))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Customer ID must not be empty");
    }

    @Test
    void testPaymentProcessingWithInvalidAmount() {
        // Arrange
        UUID billId = UUID.randomUUID();
        BigDecimal amount = BigDecimal.valueOf(100.00);
        String paymentReference = "PAY-REF-001";

        Bill bill = mock(Bill.class);
        when(bill.getTotalAmount()).thenReturn(BigDecimal.valueOf(118.00));
        when(billingRepository.findById(billId)).thenReturn(Optional.of(bill));

        // Act & Assert
        assertThatThrownBy(() -> 
            billingService.processBillPayment(billId, amount, paymentReference))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Payment amount does not match bill total");
    }

    @Test
    void testConcurrentBillProcessing() throws InterruptedException {
        // Arrange
        int numThreads = 10;
        Thread[] threads = new Thread[numThreads];
        String customerId = "CUST001";
        String accountId = "ACC001";
        UUID pricePlanId = UUID.randomUUID();

        when(billingRepository.save(any(Bill.class))).thenAnswer(i -> i.getArgument(0));

        // Act
        for (int i = 0; i < numThreads; i++) {
            final long usage = (i + 1) * 1000L;
            threads[i] = new Thread(() -> {
                billingService.generateBill(customerId, accountId, pricePlanId, usage);
            });
            threads[i].start();
        }

        // Wait for all threads to complete
        for (Thread thread : threads) {
            thread.join();
        }

        // Assert
        verify(billingRepository, times(numThreads)).save(any(Bill.class));
    }
}