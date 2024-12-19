-- Begin transaction for atomic execution
BEGIN;

-- Verify no active connections are modifying schema
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM pg_stat_activity 
        WHERE datname = current_database()
        AND state = 'active'
        AND pid <> pg_backend_pid()
        AND query ~* '^(alter|create|drop)'
    ) THEN
        RAISE EXCEPTION 'Cannot execute migration while other connections are modifying the schema';
    END IF;
END
$$;

-- Drop tables in reverse order of creation to maintain referential integrity
-- Each DROP CASCADE will automatically remove dependent objects like indexes and constraints

-- Drop line_items first (child table of invoices)
DROP TABLE IF EXISTS line_items CASCADE;

-- Drop invoices (depends on accounts)
DROP TABLE IF EXISTS invoices CASCADE;

-- Drop usage_events (depends on accounts)
DROP TABLE IF EXISTS usage_events CASCADE;

-- Drop price_components (child table of price_plans)
DROP TABLE IF EXISTS price_components CASCADE;

-- Drop price_plans (depends on accounts)
DROP TABLE IF EXISTS price_plans CASCADE;

-- Drop accounts (depends on customers)
DROP TABLE IF EXISTS accounts CASCADE;

-- Drop customers last (root table)
DROP TABLE IF EXISTS customers CASCADE;

-- Verify all tables are dropped
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN (
            'line_items',
            'invoices',
            'usage_events',
            'price_components',
            'price_plans',
            'accounts',
            'customers'
        )
    ) THEN
        RAISE EXCEPTION 'Not all tables were successfully dropped';
    END IF;
END
$$;

COMMIT;