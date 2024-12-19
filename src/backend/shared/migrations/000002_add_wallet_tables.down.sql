-- Migration: 000002_add_wallet_tables.down.sql
-- Description: Drops wallet-related tables in the correct order to maintain referential integrity
-- and ensure secure cleanup of sensitive financial data.

-- Safety checks to ensure no active transactions before dropping
DO $$ 
BEGIN
    -- Check for active transactions
    IF EXISTS (
        SELECT 1 
        FROM pg_stat_activity 
        WHERE state = 'active' 
        AND query LIKE '%wallet_transactions%'
    ) THEN
        RAISE EXCEPTION 'Cannot drop tables while active transactions exist';
    END IF;
END $$;

-- Step 1: Drop wallet_transactions table first (child table with foreign key dependency)
-- This will automatically remove related indexes and constraints due to CASCADE
DROP TABLE IF EXISTS wallet_transactions CASCADE;

-- Step 2: Drop wallets table (parent table) after dependent tables are removed
-- CASCADE will clean up any remaining dependent objects
DROP TABLE IF EXISTS wallets CASCADE;