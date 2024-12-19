import { z } from 'zod'; // v3.22.0
import { isISO8601, sanitize } from 'validator'; // v13.11.0
import { RateLimiter } from 'rate-limiter-flexible'; // v2.4.1
import { Logger } from 'winston'; // v3.8.0
import { v4 as uuidv4 } from 'uuid'; // Required for ID generation

// Global constants
const EVENT_TYPES = ['SMS', 'WhatsApp', 'Email'] as const;
const MAX_QUANTITY = 10000;
const RATE_LIMIT_WINDOW = 60000; // 1 minute in ms
const MAX_EVENTS_PER_WINDOW = 1200;

// Configure rate limiter
const rateLimiter = new RateLimiter({
    points: MAX_EVENTS_PER_WINDOW,
    duration: RATE_LIMIT_WINDOW,
    blockDuration: RATE_LIMIT_WINDOW
});

// Configure logger
const logger = Logger.createLogger({
    level: 'info',
    format: Logger.format.json(),
    defaultMeta: { service: 'event-processor' }
});

// Performance tracking decorator
function metrics(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
        const start = performance.now();
        try {
            const result = await originalMethod.apply(this, args);
            const duration = performance.now() - start;
            logger.info('Performance metric', {
                method: propertyKey,
                duration,
                success: true
            });
            return result;
        } catch (error) {
            const duration = performance.now() - start;
            logger.error('Performance metric', {
                method: propertyKey,
                duration,
                success: false,
                error: error.message
            });
            throw error;
        }
    };
    return descriptor;
}

// Rate limiting decorator
function rateLimited(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
        const accountId = args[0]?.accountId || 'default';
        try {
            await rateLimiter.consume(accountId);
            return await originalMethod.apply(this, args);
        } catch (error) {
            logger.warn('Rate limit exceeded', { accountId });
            throw new Error('Rate limit exceeded');
        }
    };
    return descriptor;
}

// Audit logging decorator
function auditLog(constructor: Function) {
    return class extends (constructor as any) {
        constructor(...args: any[]) {
            super(...args);
            logger.info('Event created', {
                eventId: this.id,
                accountId: this.accountId,
                type: this.type
            });
        }
    };
}

// Zod schema for event validation
export const EventSchema = z.object({
    id: z.string().uuid().optional(),
    accountId: z.string().min(1).max(64),
    type: z.enum(EVENT_TYPES),
    timestamp: z.string().refine((val) => isISO8601(val), {
        message: 'Invalid ISO8601 timestamp'
    }),
    quantity: z.number().int().min(1).max(MAX_QUANTITY),
    metadata: z.record(z.string(), z.any()).optional(),
    auditInfo: z.object({
        createdAt: z.string(),
        createdBy: z.string(),
        version: z.string()
    }).optional(),
    performance: z.object({
        processingTime: z.number(),
        validationTime: z.number()
    }).optional()
});

export type EventType = z.infer<typeof EventSchema>;

@auditLog
export class Event implements EventType {
    public readonly id: string;
    public readonly accountId: string;
    public readonly type: typeof EVENT_TYPES[number];
    public readonly timestamp: string;
    public readonly quantity: number;
    public readonly metadata?: Record<string, any>;
    public readonly auditInfo: {
        createdAt: string;
        createdBy: string;
        version: string;
    };
    public readonly performance: {
        processingTime: number;
        validationTime: number;
    };

    constructor(eventData: Omit<EventType, 'id' | 'auditInfo' | 'performance'>) {
        const startTime = performance.now();

        this.id = uuidv4();
        this.accountId = sanitize(eventData.accountId);
        this.type = eventData.type;
        this.timestamp = eventData.timestamp;
        this.quantity = eventData.quantity;
        this.metadata = eventData.metadata;

        this.auditInfo = {
            createdAt: new Date().toISOString(),
            createdBy: 'event-processor',
            version: '1.0.0'
        };

        this.performance = {
            processingTime: 0,
            validationTime: performance.now() - startTime
        };
    }

    @metrics
    public toJSON(): Record<string, any> {
        const startTime = performance.now();
        const json = {
            id: this.id,
            accountId: this.accountId,
            type: this.type,
            timestamp: this.timestamp,
            quantity: this.quantity,
            metadata: this.metadata,
            auditInfo: this.auditInfo,
            performance: {
                ...this.performance,
                processingTime: performance.now() - startTime
            }
        };
        return json;
    }
}

@metrics
@rateLimited
export async function validateEvent(event: EventType): Promise<boolean> {
    const startTime = performance.now();
    try {
        // Sanitize input
        const sanitizedEvent = {
            ...event,
            accountId: sanitize(event.accountId)
        };

        // Validate schema
        await EventSchema.parseAsync(sanitizedEvent);

        // Additional business rule validations
        if (new Date(event.timestamp).getTime() > Date.now()) {
            throw new Error('Future timestamps are not allowed');
        }

        logger.info('Event validation successful', {
            eventId: event.id,
            accountId: event.accountId
        });

        return true;
    } catch (error) {
        logger.error('Event validation failed', {
            error: error.message,
            event
        });
        throw error;
    } finally {
        const validationTime = performance.now() - startTime;
        logger.debug('Validation performance', { validationTime });
    }
}

@metrics
export async function transformEvent(rawEvent: Record<string, any>): Promise<Event> {
    const startTime = performance.now();
    try {
        // Transform and normalize event data
        const transformedData = {
            accountId: sanitize(rawEvent.accountId),
            type: rawEvent.type.toUpperCase(),
            timestamp: new Date(rawEvent.timestamp).toISOString(),
            quantity: Number(rawEvent.quantity),
            metadata: rawEvent.metadata || {}
        };

        // Create new event instance
        const event = new Event(transformedData);

        logger.info('Event transformation successful', {
            eventId: event.id,
            accountId: event.accountId
        });

        return event;
    } catch (error) {
        logger.error('Event transformation failed', {
            error: error.message,
            rawEvent
        });
        throw error;
    } finally {
        const transformTime = performance.now() - startTime;
        logger.debug('Transform performance', { transformTime });
    }
}