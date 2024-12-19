import { z } from 'zod'; // v3.22.0

/**
 * Maximum allowed quantity for a single event
 */
export const MAX_QUANTITY = 10000;

/**
 * Mapping of event types to their display labels
 */
export const EVENT_TYPE_LABELS = {
  SMS_AUTH: 'SMS',
  WHATSAPP_AUTH: 'WhatsApp',
  EMAIL_AUTH: 'Email'
} as const;

/**
 * Enumeration of supported authentication event types
 */
export enum EventType {
  SMS_AUTH = 'SMS_AUTH',
  WHATSAPP_AUTH = 'WHATSAPP_AUTH',
  EMAIL_AUTH = 'EMAIL_AUTH'
}

/**
 * Enumeration of supported time periods for event aggregation
 */
export enum EventPeriod {
  HOURLY = 'HOURLY',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY'
}

/**
 * Default aggregation period for analytics
 */
export const DEFAULT_AGGREGATION_PERIOD = EventPeriod.DAILY;

/**
 * Interface defining the structure of an authentication event
 */
export interface Event {
  /** Unique identifier for the event */
  id: string;
  /** Account identifier associated with the event */
  accountId: string;
  /** Type of authentication event */
  type: EventType;
  /** ISO 8601 timestamp of when the event occurred */
  timestamp: string;
  /** Number of authentication attempts in this event */
  quantity: number;
  /** Additional event metadata */
  metadata: Record<string, unknown>;
}

/**
 * Enhanced interface for aggregated event data used in analytics
 */
export interface EventAggregation {
  /** Type of event being aggregated */
  eventType: EventType;
  /** Total count of events in the period */
  count: number;
  /** Aggregation time period */
  period: EventPeriod;
  /** Total cost for the aggregated events */
  cost: number;
  /** Percentage of total events this type represents */
  percentageOfTotal: number;
  /** Time series data for trend analysis */
  trendData: Array<{
    timestamp: string;
    count: number;
  }>;
}

/**
 * Interface for comprehensive event filtering options in analytics
 */
export interface EventFilters {
  /** Start date for filtering (ISO 8601) */
  startDate: string;
  /** End date for filtering (ISO 8601) */
  endDate: string;
  /** Array of event types to include */
  types: EventType[];
  /** Optional account ID filter */
  accountId: string;
  /** Aggregation period for results */
  aggregationPeriod: EventPeriod;
}

/**
 * Zod schema for runtime validation of event data
 */
export const EventSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  type: z.nativeEnum(EventType),
  timestamp: z.string().datetime({ offset: true }),
  quantity: z.number().int().min(1).max(MAX_QUANTITY),
  metadata: z.record(z.unknown()).refine(
    (data) => {
      // Ensure required metadata fields are present
      const requiredFields = ['region', 'deviceType', 'status'];
      return requiredFields.every((field) => field in data);
    },
    {
      message: 'Missing required metadata fields'
    }
  )
});

/**
 * Validates event data against the enhanced event schema
 * @param event Event data to validate
 * @returns Promise resolving to true if valid, throws ValidationError if invalid
 */
export async function validateEventData(event: Event): Promise<boolean> {
  try {
    await EventSchema.parseAsync(event);
    return true;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Event validation failed: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
}