// @version: axios@1.x
// @version: typescript@5.0.x

import { apiClient, get, post, put } from './api';
import { API_ENDPOINTS } from '../config/api';
import { 
  PricePlan, 
  Bill, 
  BillStatus, 
  BillingFrequency,
  PriceComponent,
  BillCalculation,
  SupportedCurrency
} from '../types/billing';
import { formatCurrency, parseCurrency } from '../utils/currency';
import { CACHE_CONFIG } from '../config/constants';

// Constants
const DEFAULT_BILLING_FREQUENCY = BillingFrequency.MONTHLY;
const USAGE_METRICS_CACHE_TTL = CACHE_CONFIG.TTL.USAGE_METRICS;
const MAX_RETRY_ATTEMPTS = 3;
const REQUEST_TIMEOUT = 30000;

// Cache management
const cache = new Map<string, { data: any; timestamp: number }>();

/**
 * Retrieves available price plans with optional filtering
 * @param filters - Optional filters for price plans
 * @returns Promise<PricePlan[]> List of price plans
 */
async function getPricePlans(filters?: {
  status?: string;
  frequency?: BillingFrequency;
  currency?: SupportedCurrency;
}): Promise<PricePlan[]> {
  const cacheKey = `price_plans_${JSON.stringify(filters)}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_CONFIG.TTL.PRICE_PLANS * 1000) {
    return cached.data;
  }

  try {
    const response = await get<PricePlan[]>(API_ENDPOINTS.BILLING.PRICE_PLANS, {
      params: filters,
      timeout: REQUEST_TIMEOUT
    });

    // Format currency values in price plans
    const formattedPlans = response.data.map(plan => ({
      ...plan,
      basePrice: parseCurrency(formatCurrency(plan.basePrice, plan.currency)),
      perUnitPrice: parseCurrency(formatCurrency(plan.perUnitPrice, plan.currency)),
      priceComponents: plan.priceComponents.map(component => ({
        ...component,
        unitPrice: parseCurrency(formatCurrency(component.unitPrice, plan.currency))
      }))
    }));

    cache.set(cacheKey, { data: formattedPlans, timestamp: Date.now() });
    return formattedPlans;
  } catch (error) {
    console.error('Error fetching price plans:', error);
    throw error;
  }
}

/**
 * Retrieves a specific price plan by ID
 * @param planId - UUID of the price plan
 * @returns Promise<PricePlan> Detailed price plan information
 */
async function getPricePlanById(planId: string): Promise<PricePlan> {
  const cacheKey = `price_plan_${planId}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_CONFIG.TTL.PRICE_PLANS * 1000) {
    return cached.data;
  }

  try {
    const response = await get<PricePlan>(`${API_ENDPOINTS.BILLING.PRICE_PLANS}/${planId}`);
    const plan = response.data;

    // Format currency values
    const formattedPlan = {
      ...plan,
      basePrice: parseCurrency(formatCurrency(plan.basePrice, plan.currency)),
      perUnitPrice: parseCurrency(formatCurrency(plan.perUnitPrice, plan.currency)),
      priceComponents: plan.priceComponents.map(component => ({
        ...component,
        unitPrice: parseCurrency(formatCurrency(component.unitPrice, plan.currency))
      }))
    };

    cache.set(cacheKey, { data: formattedPlan, timestamp: Date.now() });
    return formattedPlan;
  } catch (error) {
    console.error('Error fetching price plan:', error);
    throw error;
  }
}

/**
 * Calculates billing amount based on usage and price plan
 * @param accountId - UUID of the account
 * @param pricePlanId - UUID of the price plan
 * @param billingPeriod - Start and end dates for billing period
 * @returns Promise<Bill> Calculated bill details
 */
async function calculateBill(
  accountId: string,
  pricePlanId: string,
  billingPeriod: { startDate: Date; endDate: Date }
): Promise<BillCalculation> {
  try {
    const response = await post<BillCalculation>(API_ENDPOINTS.BILLING.METRICS, {
      accountId,
      pricePlanId,
      billingPeriodStart: billingPeriod.startDate.toISOString(),
      billingPeriodEnd: billingPeriod.endDate.toISOString()
    });

    const calculation = response.data;

    // Format currency values in calculation
    return {
      ...calculation,
      baseAmount: parseCurrency(formatCurrency(calculation.baseAmount, calculation.currency)),
      taxAmount: parseCurrency(formatCurrency(calculation.taxAmount, calculation.currency)),
      totalAmount: parseCurrency(formatCurrency(calculation.totalAmount, calculation.currency)),
      breakdown: {
        ...calculation.breakdown,
        basePrice: parseCurrency(formatCurrency(calculation.breakdown.basePrice, calculation.currency)),
        additionalCharges: parseCurrency(formatCurrency(calculation.breakdown.additionalCharges, calculation.currency)),
        taxDetails: {
          ...calculation.breakdown.taxDetails,
          amount: parseCurrency(formatCurrency(calculation.breakdown.taxDetails.amount, calculation.currency))
        }
      }
    };
  } catch (error) {
    console.error('Error calculating bill:', error);
    throw error;
  }
}

/**
 * Retrieves usage metrics for an account
 * @param accountId - UUID of the account
 * @param timeRange - Time range for metrics
 * @returns Promise<object> Usage metrics data
 */
async function getUsageMetrics(
  accountId: string,
  timeRange: { startDate: Date; endDate: Date; granularity?: string }
): Promise<object> {
  const cacheKey = `usage_metrics_${accountId}_${timeRange.startDate}_${timeRange.endDate}_${timeRange.granularity}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < USAGE_METRICS_CACHE_TTL * 1000) {
    return cached.data;
  }

  try {
    const response = await get(API_ENDPOINTS.BILLING.USAGE, {
      params: {
        accountId,
        startDate: timeRange.startDate.toISOString(),
        endDate: timeRange.endDate.toISOString(),
        granularity: timeRange.granularity || 'day'
      }
    });

    cache.set(cacheKey, { data: response.data, timestamp: Date.now() });
    return response.data;
  } catch (error) {
    console.error('Error fetching usage metrics:', error);
    throw error;
  }
}

// Export the billing service
export const billingService = {
  getPricePlans,
  getPricePlanById,
  calculateBill,
  getUsageMetrics
};