-- Create wallets table for managing customer wallet balances
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    balance DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0.00),
    currency VARCHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    low_balance_threshold DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (low_balance_threshold >= 0.00),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for wallet lookups and balance monitoring
CREATE INDEX idx_wallets_customer ON wallets(customer_id);
CREATE INDEX idx_wallets_balance_currency ON wallets(currency, balance);

-- Create wallet_transactions table for tracking all wallet operations
CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('CREDIT', 'DEBIT', 'REFUND')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('INITIATED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVERSED')),
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0.00),
    currency VARCHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    description TEXT,
    reference_id VARCHAR(255),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for transaction lookups and monitoring
CREATE INDEX idx_wallet_transactions_wallet ON wallet_transactions(wallet_id);
CREATE INDEX idx_wallet_transactions_status ON wallet_transactions(status);
CREATE INDEX idx_wallet_transactions_created ON wallet_transactions(created_at);
CREATE INDEX idx_wallet_transactions_reference ON wallet_transactions(reference_id);

-- Create trigger function to update wallet updated_at timestamp
CREATE OR REPLACE FUNCTION update_wallet_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for wallet timestamp updates
CREATE TRIGGER update_wallet_timestamp
    BEFORE UPDATE ON wallets
    FOR EACH ROW
    EXECUTE FUNCTION update_wallet_timestamp();

-- Add comment documentation for tables and columns
COMMENT ON TABLE wallets IS 'Stores customer wallet information with real-time balance tracking';
COMMENT ON TABLE wallet_transactions IS 'Records all wallet transactions with complete state management';

COMMENT ON COLUMN wallets.balance IS 'Current wallet balance with 2 decimal precision';
COMMENT ON COLUMN wallets.currency IS 'ISO 4217 three-letter currency code';
COMMENT ON COLUMN wallets.low_balance_threshold IS 'Threshold for triggering low balance alerts';

COMMENT ON COLUMN wallet_transactions.type IS 'Transaction type: CREDIT, DEBIT, or REFUND';
COMMENT ON COLUMN wallet_transactions.status IS 'Transaction state: INITIATED, PROCESSING, COMPLETED, FAILED, or REVERSED';
COMMENT ON COLUMN wallet_transactions.amount IS 'Transaction amount with 2 decimal precision';
COMMENT ON COLUMN wallet_transactions.reference_id IS 'External reference ID for transaction tracking';
COMMENT ON COLUMN wallet_transactions.metadata IS 'Additional transaction metadata stored as JSONB';