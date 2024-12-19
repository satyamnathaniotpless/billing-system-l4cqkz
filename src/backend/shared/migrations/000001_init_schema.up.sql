-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types for status fields
CREATE TYPE customer_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE account_status AS ENUM ('active', 'suspended', 'closed');
CREATE TYPE bill_status AS ENUM ('draft', 'pending', 'paid', 'cancelled', 'overdue');
CREATE TYPE price_plan_type AS ENUM ('standard', 'custom', 'enterprise');
CREATE TYPE currency_code AS ENUM ('USD', 'INR', 'IDR');

-- Create customers table
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    phone VARCHAR(50),
    status customer_status NOT NULL DEFAULT 'active',
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_modified_by UUID NOT NULL,
    version INTEGER NOT NULL DEFAULT 1
);

-- Create accounts table (for multi-tenant isolation)
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    status account_status NOT NULL DEFAULT 'active',
    currency currency_code NOT NULL DEFAULT 'USD',
    balance DECIMAL(20,4) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
    low_balance_threshold DECIMAL(20,4) NOT NULL DEFAULT 100.00 CHECK (low_balance_threshold >= 0),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_modified_by UUID NOT NULL,
    version INTEGER NOT NULL DEFAULT 1
);

-- Create price plans table
CREATE TABLE price_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type price_plan_type NOT NULL,
    currency currency_code NOT NULL DEFAULT 'USD',
    base_price DECIMAL(20,4) NOT NULL DEFAULT 0.00 CHECK (base_price >= 0),
    usage_rates JSONB NOT NULL,
    metadata JSONB,
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_modified_by UUID NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT valid_date_range CHECK (valid_until IS NULL OR valid_until > valid_from)
);

-- Create account price plan associations
CREATE TABLE account_price_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    price_plan_id UUID NOT NULL REFERENCES price_plans(id) ON DELETE RESTRICT,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_modified_by UUID NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT valid_date_range CHECK (end_date IS NULL OR end_date > start_date)
);

-- Create usage events table with time-series optimization
CREATE TABLE usage_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    event_type VARCHAR(50) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    event_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    idempotency_key VARCHAR(255) NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT false
);

-- Create bills table
CREATE TABLE bills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    bill_number VARCHAR(50) NOT NULL UNIQUE,
    status bill_status NOT NULL DEFAULT 'draft',
    currency currency_code NOT NULL,
    subtotal DECIMAL(20,4) NOT NULL CHECK (subtotal >= 0),
    tax_amount DECIMAL(20,4) NOT NULL CHECK (tax_amount >= 0),
    total_amount DECIMAL(20,4) NOT NULL CHECK (total_amount >= 0),
    bill_date TIMESTAMP WITH TIME ZONE NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    line_items JSONB NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_modified_by UUID NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT valid_bill_period CHECK (period_end > period_start),
    CONSTRAINT valid_due_date CHECK (due_date >= bill_date)
);

-- Create audit logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    actor_id UUID NOT NULL,
    old_values JSONB,
    new_values JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_customers_active ON customers(status) WHERE status = 'active';

CREATE INDEX idx_accounts_customer ON accounts(customer_id);
CREATE INDEX idx_accounts_status ON accounts(status);
CREATE INDEX idx_accounts_balance ON accounts(balance) WHERE balance < low_balance_threshold;

CREATE INDEX idx_price_plans_type ON price_plans(type);
CREATE INDEX idx_price_plans_validity ON price_plans(valid_from, valid_until);

CREATE INDEX idx_account_plans_account ON account_price_plans(account_id);
CREATE INDEX idx_account_plans_dates ON account_price_plans(start_date, end_date);

CREATE INDEX idx_usage_events_account_time ON usage_events(account_id, event_time);
CREATE INDEX idx_usage_events_type ON usage_events(event_type);
CREATE INDEX idx_usage_events_composite ON usage_events(account_id, event_type, event_time);
CREATE UNIQUE INDEX idx_usage_events_idempotency ON usage_events(idempotency_key);

CREATE INDEX idx_bills_account ON bills(account_id);
CREATE INDEX idx_bills_status ON bills(status);
CREATE INDEX idx_bills_period ON bills(period_start, period_end);
CREATE INDEX idx_bills_account_status ON bills(account_id, status);

CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create audit logging trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (
        entity_type,
        entity_id,
        action,
        actor_id,
        old_values,
        new_values,
        metadata
    ) VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        COALESCE(NEW.last_modified_by, OLD.last_modified_by),
        CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
        jsonb_build_object('timestamp', CURRENT_TIMESTAMP)
    );
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_price_plans_updated_at
    BEFORE UPDATE ON price_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_account_price_plans_updated_at
    BEFORE UPDATE ON account_price_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bills_updated_at
    BEFORE UPDATE ON bills
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply audit triggers
CREATE TRIGGER audit_customers_trigger
    AFTER INSERT OR UPDATE OR DELETE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_accounts_trigger
    AFTER INSERT OR UPDATE OR DELETE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_price_plans_trigger
    AFTER INSERT OR UPDATE OR DELETE ON price_plans
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_bills_trigger
    AFTER INSERT OR UPDATE OR DELETE ON bills
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_function();

-- Create row level security policies
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_price_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;

-- Comments for documentation
COMMENT ON TABLE customers IS 'Core customer information for the billing system';
COMMENT ON TABLE accounts IS 'Multi-tenant account information with strict isolation';
COMMENT ON TABLE price_plans IS 'Pricing plans and rate configurations';
COMMENT ON TABLE account_price_plans IS 'Association between accounts and their active price plans';
COMMENT ON TABLE usage_events IS 'Usage event tracking with idempotency support';
COMMENT ON TABLE bills IS 'Generated bills with line items and payment status';
COMMENT ON TABLE audit_logs IS 'Audit trail for all important data changes';