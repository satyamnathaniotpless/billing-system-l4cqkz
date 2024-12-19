import { z } from 'zod'; // v3.22.0
import { isUUID, isISO8601 } from 'validator'; // v13.11.0
import { LRUCache } from 'lru-cache'; // v10.0.0
import { EventSchema, EventType } from '../models/Event';

// Global constants for validation
export const EVENT_TYPES = ['SMS', 'WhatsApp', 'Email'] as const;
export const MAX_QUANTITY = 10000;
export const MIN_TIMESTAMP = new Date('2023-01-01').toISOString();

// Validation result cache for performance optimization
const VALIDATION_CACHE = new LRUCache<string, boolean>({
    max: 10000, // Maximum cache size
    ttl: 1000 * 60 // Cache TTL: 1 minute
});

// Error codes for different validation failures
export const ERROR_CODES = {
    INVALID_SCHEMA: 'VAL001',
    INVALID_ACCOUNT: 'VAL002',
    INVALID_TIMESTAMP: 'VAL003',
    INVALID_TYPE: 'VAL004',
    INVALID_QUANTITY: 'VAL005'
} as const;

/**
 * Enhanced error class for validation failures with detailed context
 */
export class ValidationError extends Error {
    public readonly code: string;
    public readonly details: Record<string, any>;
    public readonly field: string;
    public readonly context: Record<string, any>;

    constructor(
        message: string,
        code: keyof typeof ERROR_CODES,
        details: Record<string, any>,
        field: string,
        context?: Record<string, any>
    ) {
        super(`Validation Error: ${message}`);
        this.code = ERROR_CODES[code];
        this.details = details;
        this.field = field;
        this.context = context || {};
        this.name = 'ValidationError';
        Error.captureStackTrace(this, ValidationError);
    }

    /**
     * Converts validation error to JSON format
     */
    toJSON(): Record<string, any> {
        const error = {
            name: this.name,
            message: this.message,
            code: this.code,
            field: this.field,
            details: this.details,
            context: this.context
        };

        if (process.env.NODE_ENV === 'development') {
            error['stack'] = this.stack;
        }

        return error;
    }
}

/**
 * Validates account ID format with UUID v4 check and caching
 */
function validateAccountId(accountId: string): boolean {
    const cacheKey = `account:${accountId}`;
    const cached = VALIDATION_CACHE.get(cacheKey);
    
    if (cached !== undefined) {
        return cached;
    }

    const isValid = isUUID(accountId, 4);
    VALIDATION_CACHE.set(cacheKey, isValid);
    
    return isValid;
}

/**
 * Validates event timestamp format and range with caching
 */
function validateTimestamp(timestamp: string): boolean {
    const cacheKey = `timestamp:${timestamp}`;
    const cached = VALIDATION_CACHE.get(cacheKey);
    
    if (cached !== undefined) {
        return cached;
    }

    const isValid = isISO8601(timestamp) && 
        timestamp >= MIN_TIMESTAMP && 
        timestamp <= new Date().toISOString();

    VALIDATION_CACHE.set(cacheKey, isValid);
    
    return isValid;
}

/**
 * Validates event type against supported types with type checking
 */
function validateEventType(type: string): type is typeof EVENT_TYPES[number] {
    return EVENT_TYPES.includes(type as typeof EVENT_TYPES[number]);
}

/**
 * High-performance validation of raw event data against schema and business rules
 * Implements caching for improved performance
 */
export async function validateEventData(eventData: Record<string, any>): Promise<boolean> {
    try {
        // Generate cache key from event data
        const cacheKey = `event:${JSON.stringify(eventData)}`;
        const cached = VALIDATION_CACHE.get(cacheKey);
        
        if (cached !== undefined) {
            return cached;
        }

        // Schema validation using Zod
        const parsedEvent = await EventSchema.parseAsync(eventData).catch((error) => {
            throw new ValidationError(
                'Invalid event schema',
                'INVALID_SCHEMA',
                error.errors,
                error.errors[0]?.path?.join('.') || 'schema',
                { eventData }
            );
        });

        // Account ID validation
        if (!validateAccountId(parsedEvent.accountId)) {
            throw new ValidationError(
                'Invalid account ID format',
                'INVALID_ACCOUNT',
                { accountId: parsedEvent.accountId },
                'accountId',
                { eventData }
            );
        }

        // Timestamp validation
        if (!validateTimestamp(parsedEvent.timestamp)) {
            throw new ValidationError(
                'Invalid timestamp',
                'INVALID_TIMESTAMP',
                { timestamp: parsedEvent.timestamp },
                'timestamp',
                { eventData }
            );
        }

        // Event type validation
        if (!validateEventType(parsedEvent.type)) {
            throw new ValidationError(
                'Invalid event type',
                'INVALID_TYPE',
                { type: parsedEvent.type, validTypes: EVENT_TYPES },
                'type',
                { eventData }
            );
        }

        // Quantity validation
        if (parsedEvent.quantity > MAX_QUANTITY) {
            throw new ValidationError(
                'Quantity exceeds maximum limit',
                'INVALID_QUANTITY',
                { quantity: parsedEvent.quantity, max: MAX_QUANTITY },
                'quantity',
                { eventData }
            );
        }

        // Cache successful validation result
        VALIDATION_CACHE.set(cacheKey, true);
        return true;

    } catch (error) {
        if (error instanceof ValidationError) {
            throw error;
        }
        throw new ValidationError(
            'Validation failed',
            'INVALID_SCHEMA',
            { message: error.message },
            'schema',
            { eventData }
        );
    }
}