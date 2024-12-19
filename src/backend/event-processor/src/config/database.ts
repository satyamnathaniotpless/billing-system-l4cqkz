// External dependencies
// pg: ^8.11.0 - PostgreSQL connection pooling
import { Pool, PoolConfig } from 'pg';
// dotenv: ^16.0.3 - Environment configuration
import * as dotenv from 'dotenv';
// winston: ^3.10.0 - Logging functionality
import { createLogger, format, transports } from 'winston';

// Load environment variables
dotenv.config();

// Configure logger
const logger = createLogger({
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    })
  ]
});

// Database configuration with type safety
const DB_CONFIG: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'otpless_events',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: parseInt(process.env.DB_POOL_MAX || '20'),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000'),
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false // Modify based on your SSL requirements
  } : undefined,
  application_name: 'otpless_event_processor',
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000'),
  query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000')
};

/**
 * Creates and configures a database connection pool with comprehensive error handling
 * @returns Configured Pool instance
 */
const createPool = (): Pool => {
  const pool = new Pool(DB_CONFIG);

  // Error handling for the pool
  pool.on('error', (err: Error) => {
    logger.error('Unexpected error on idle client', { error: err.message });
  });

  pool.on('connect', (client) => {
    logger.info('New client connected to database', {
      pid: client.processID,
      database: DB_CONFIG.database
    });
  });

  pool.on('acquire', () => {
    logger.debug('Client acquired from pool', {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount
    });
  });

  pool.on('remove', () => {
    logger.debug('Client removed from pool', {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount
    });
  });

  return pool;
};

/**
 * Performs a health check on the database connection
 * @returns Promise<boolean> indicating database health status
 */
export const healthCheck = async (): Promise<boolean> => {
  const client = await pool.connect();
  try {
    // Verify basic connectivity
    await client.query('SELECT 1');

    // Verify TimescaleDB extension
    const extensionResult = await client.query(
      "SELECT extname FROM pg_extension WHERE extname = 'timescaledb'"
    );
    if (extensionResult.rows.length === 0) {
      logger.error('TimescaleDB extension not found');
      return false;
    }

    // Check connection latency
    const startTime = Date.now();
    await client.query('SELECT NOW()');
    const latency = Date.now() - startTime;

    logger.info('Database health check successful', { latency });
    return true;
  } catch (error) {
    logger.error('Database health check failed', { error: (error as Error).message });
    return false;
  } finally {
    client.release();
  }
};

/**
 * Gracefully closes the database connection pool
 * @returns Promise<void>
 */
export const closePool = async (): Promise<void> => {
  logger.info('Initiating database pool closure');
  
  try {
    // Wait for active queries to complete (with timeout)
    const timeout = parseInt(process.env.POOL_SHUTDOWN_TIMEOUT || '5000');
    const shutdownPromise = new Promise<void>((resolve) => {
      const checkQueries = setInterval(() => {
        if (pool.waitingCount === 0 && pool.idleCount === pool.totalCount) {
          clearInterval(checkQueries);
          resolve();
        }
      }, 100);
    });

    await Promise.race([
      shutdownPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Pool shutdown timeout')), timeout))
    ]);

    await pool.end();
    logger.info('Database pool closed successfully');
  } catch (error) {
    logger.error('Error during pool closure', { error: (error as Error).message });
    // Force pool closure in case of timeout
    await pool.end();
  }
};

// Create and export the pool instance
const pool = createPool();

// Export pool as default and additional utilities
export default pool;