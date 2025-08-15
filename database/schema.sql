-- LOOTER.AI CLONE - PostgreSQL Database Schema
-- Comprehensive database structure for user data management
-- Created: 2024

-- Enable UUID extension for unique identifiers
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USERS TABLE - Main user information
-- =====================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    is_premium BOOLEAN DEFAULT FALSE,
    language_code VARCHAR(10) DEFAULT 'en',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- =====================================================
-- CHAINS TABLE - Supported blockchain networks
-- =====================================================
CREATE TABLE chains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chain_id VARCHAR(50) UNIQUE NOT NULL, -- 'ethereum', 'base', 'bsc', etc.
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(10) NOT NULL, -- 'ETH', 'BNB', 'SOL', etc.
    icon VARCHAR(10),
    network_id INTEGER, -- Chain ID number (1 for Ethereum, 56 for BSC, etc.)
    rpc_url TEXT,
    explorer_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- WALLETS TABLE - User wallets for each chain
-- =====================================================
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chain_id UUID NOT NULL REFERENCES chains(id) ON DELETE CASCADE,
    wallet_slot VARCHAR(10) NOT NULL, -- 'W1', 'W2', 'W3', 'W4', 'W5'
    address VARCHAR(255) NOT NULL,
    private_key TEXT NOT NULL, -- Encrypted
    seed_phrase TEXT, -- Encrypted, optional
    wallet_name VARCHAR(100), -- Optional custom name
    is_imported BOOLEAN DEFAULT FALSE, -- TRUE if imported, FALSE if generated
    balance DECIMAL(36, 18) DEFAULT 0, -- Current balance
    last_balance_update TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Ensure one wallet per slot per chain per user
    UNIQUE(user_id, chain_id, wallet_slot)
);

-- =====================================================
-- WALLET_HISTORY TABLE - Track wallet operations
-- =====================================================
CREATE TABLE wallet_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL, -- 'created', 'imported', 'exported', 'deleted', 'renamed'
    old_value TEXT, -- Previous value (for updates)
    new_value TEXT, -- New value
    metadata JSONB, -- Additional data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- TOKENS TABLE - Track tokens for each chain
-- =====================================================
CREATE TABLE tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chain_id UUID NOT NULL REFERENCES chains(id) ON DELETE CASCADE,
    contract_address VARCHAR(255) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    decimals INTEGER NOT NULL DEFAULT 18,
    logo_url TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure unique token per chain
    UNIQUE(chain_id, contract_address)
);

-- =====================================================
-- TRADES TABLE - All trading activities
-- =====================================================
CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    chain_id UUID NOT NULL REFERENCES chains(id) ON DELETE CASCADE,
    token_id UUID REFERENCES tokens(id) ON DELETE SET NULL,
    
    -- Trade details
    trade_type VARCHAR(20) NOT NULL, -- 'buy', 'sell', 'transfer'
    token_address VARCHAR(255),
    token_symbol VARCHAR(20),
    token_name VARCHAR(255),
    
    -- Amounts
    amount_in DECIMAL(36, 18), -- Amount of input token
    amount_out DECIMAL(36, 18), -- Amount of output token
    amount_in_usd DECIMAL(18, 2), -- USD value of input
    amount_out_usd DECIMAL(18, 2), -- USD value of output
    
    -- Prices
    token_price DECIMAL(36, 18), -- Token price at time of trade
    token_price_usd DECIMAL(18, 8), -- Token price in USD
    
    -- Transaction details
    transaction_hash VARCHAR(255),
    gas_used DECIMAL(18, 0),
    gas_price DECIMAL(36, 18),
    gas_fee DECIMAL(36, 18), -- Total gas fee
    gas_fee_usd DECIMAL(18, 2), -- Gas fee in USD
    
    -- Trade settings
    slippage DECIMAL(5, 2), -- Slippage percentage
    deadline INTEGER, -- Transaction deadline
    
    -- Status and timing
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'confirmed', 'failed', 'cancelled'
    block_number BIGINT,
    confirmation_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Profit/Loss calculation
    pnl_amount DECIMAL(36, 18), -- Profit/Loss amount
    pnl_percentage DECIMAL(10, 4), -- Profit/Loss percentage
    pnl_usd DECIMAL(18, 2), -- Profit/Loss in USD
    
    -- Additional metadata
    metadata JSONB -- Store additional trade data
);

-- =====================================================
-- TRANSFERS TABLE - Native token transfers
-- =====================================================
CREATE TABLE transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    from_wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    chain_id UUID NOT NULL REFERENCES chains(id) ON DELETE CASCADE,
    
    -- Transfer details
    to_address VARCHAR(255) NOT NULL,
    amount DECIMAL(36, 18) NOT NULL,
    amount_usd DECIMAL(18, 2),
    
    -- Transaction details
    transaction_hash VARCHAR(255),
    gas_used DECIMAL(18, 0),
    gas_price DECIMAL(36, 18),
    gas_fee DECIMAL(36, 18),
    gas_fee_usd DECIMAL(18, 2),
    
    -- Status and timing
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'confirmed', 'failed'
    block_number BIGINT,
    confirmation_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Additional data
    note TEXT, -- Optional transfer note
    metadata JSONB
);

-- =====================================================
-- USER_SETTINGS TABLE - User preferences and settings
-- =====================================================
CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Trading settings
    default_slippage DECIMAL(5, 2) DEFAULT 1.0,
    default_gas_price VARCHAR(20) DEFAULT 'medium', -- 'slow', 'medium', 'fast'
    auto_approve BOOLEAN DEFAULT FALSE,
    
    -- Notification settings
    trade_notifications BOOLEAN DEFAULT TRUE,
    transfer_notifications BOOLEAN DEFAULT TRUE,
    price_alerts BOOLEAN DEFAULT TRUE,
    
    -- UI settings
    theme VARCHAR(20) DEFAULT 'dark', -- 'light', 'dark'
    language VARCHAR(10) DEFAULT 'en',
    currency VARCHAR(10) DEFAULT 'USD',
    
    -- Security settings
    require_confirmation BOOLEAN DEFAULT TRUE,
    session_timeout INTEGER DEFAULT 3600, -- seconds
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- One settings record per user
    UNIQUE(user_id)
);

-- =====================================================
-- PRICE_ALERTS TABLE - User price alerts
-- =====================================================
CREATE TABLE price_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_id UUID NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
    
    -- Alert settings
    alert_type VARCHAR(20) NOT NULL, -- 'above', 'below', 'change'
    target_price DECIMAL(36, 18),
    percentage_change DECIMAL(10, 4), -- For percentage-based alerts
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    triggered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- ACTIVITY_LOGS TABLE - Comprehensive user activity logging
-- =====================================================
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Activity details
    activity_type VARCHAR(50) NOT NULL, -- 'wallet_created', 'trade_executed', 'transfer_sent', etc.
    entity_type VARCHAR(50), -- 'wallet', 'trade', 'transfer', 'setting'
    entity_id UUID, -- ID of the related entity
    
    -- Activity data
    description TEXT,
    old_data JSONB, -- Previous state
    new_data JSONB, -- New state
    metadata JSONB, -- Additional context
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES for better performance
-- =====================================================

-- Users indexes
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_last_active ON users(last_active);

-- Chains indexes
CREATE INDEX idx_chains_chain_id ON chains(chain_id);
CREATE INDEX idx_chains_is_active ON chains(is_active);

-- Wallets indexes
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_wallets_chain_id ON wallets(chain_id);
CREATE INDEX idx_wallets_address ON wallets(address);
CREATE INDEX idx_wallets_user_chain ON wallets(user_id, chain_id);
CREATE INDEX idx_wallets_created_at ON wallets(created_at);

-- Trades indexes
CREATE INDEX idx_trades_user_id ON trades(user_id);
CREATE INDEX idx_trades_wallet_id ON trades(wallet_id);
CREATE INDEX idx_trades_chain_id ON trades(chain_id);
CREATE INDEX idx_trades_token_id ON trades(token_id);
CREATE INDEX idx_trades_trade_type ON trades(trade_type);
CREATE INDEX idx_trades_status ON trades(status);
CREATE INDEX idx_trades_created_at ON trades(created_at);
CREATE INDEX idx_trades_transaction_hash ON trades(transaction_hash);

-- Transfers indexes
CREATE INDEX idx_transfers_user_id ON transfers(user_id);
CREATE INDEX idx_transfers_from_wallet_id ON transfers(from_wallet_id);
CREATE INDEX idx_transfers_chain_id ON transfers(chain_id);
CREATE INDEX idx_transfers_status ON transfers(status);
CREATE INDEX idx_transfers_created_at ON transfers(created_at);
CREATE INDEX idx_transfers_transaction_hash ON transfers(transaction_hash);

-- Activity logs indexes
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_activity_type ON activity_logs(activity_type);
CREATE INDEX idx_activity_logs_entity_type ON activity_logs(entity_type);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);

-- =====================================================
-- FUNCTIONS for automatic timestamp updates
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SUBSCRIPTIONS TABLE - User premium subscriptions
-- =====================================================
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_type VARCHAR(20) NOT NULL, -- 'free', 'pro', 'whale'
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'expired', 'cancelled', 'pending'
    start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP WITH TIME ZONE,
    auto_renew BOOLEAN DEFAULT TRUE,
    payment_method VARCHAR(50), -- 'crypto', 'card', 'paypal'
    payment_amount DECIMAL(18, 8), -- Amount paid in payment currency
    payment_currency VARCHAR(10), -- 'ETH', 'USDC', 'USD'
    payment_tx_hash VARCHAR(255), -- Transaction hash for crypto payments
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- REVENUE_TRACKING TABLE - All revenue from users
-- =====================================================
CREATE TABLE revenue_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trade_id UUID REFERENCES trades(id) ON DELETE SET NULL,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    
    -- Revenue details
    revenue_type VARCHAR(30) NOT NULL, -- 'trade_fee', 'subscription', 'gas_markup'
    amount_eth DECIMAL(36, 18) NOT NULL,
    amount_usd DECIMAL(18, 2),
    fee_percentage DECIMAL(5, 4), -- Fee percentage applied (e.g., 0.003 = 0.3%)
    
    -- User context
    user_tier VARCHAR(20) NOT NULL, -- 'FREE_TIER', 'PRO_TIER', 'WHALE_TIER'
    original_amount DECIMAL(36, 18), -- Original trade amount before fee
    
    -- Metadata
    chain_id VARCHAR(50),
    token_address VARCHAR(255),
    metadata JSONB, -- Additional revenue context
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- SUBSCRIPTION_PAYMENTS TABLE - Payment tracking
-- =====================================================
CREATE TABLE subscription_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Payment details
    amount DECIMAL(18, 8) NOT NULL,
    currency VARCHAR(10) NOT NULL, -- 'ETH', 'USDC', 'USD'
    payment_method VARCHAR(50) NOT NULL,
    
    -- Crypto payment details
    transaction_hash VARCHAR(255),
    from_address VARCHAR(255),
    to_address VARCHAR(255),
    block_number BIGINT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'confirmed', 'failed'
    confirmed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- Indexes for monetization tables
-- =====================================================

-- Subscriptions indexes
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_plan_type ON subscriptions(plan_type);
CREATE INDEX idx_subscriptions_end_date ON subscriptions(end_date);

-- Revenue tracking indexes
CREATE INDEX idx_revenue_tracking_user_id ON revenue_tracking(user_id);
CREATE INDEX idx_revenue_tracking_revenue_type ON revenue_tracking(revenue_type);
CREATE INDEX idx_revenue_tracking_user_tier ON revenue_tracking(user_tier);
CREATE INDEX idx_revenue_tracking_created_at ON revenue_tracking(created_at);
CREATE INDEX idx_revenue_tracking_trade_id ON revenue_tracking(trade_id);

-- Subscription payments indexes
CREATE INDEX idx_subscription_payments_subscription_id ON subscription_payments(subscription_id);
CREATE INDEX idx_subscription_payments_user_id ON subscription_payments(user_id);
CREATE INDEX idx_subscription_payments_status ON subscription_payments(status);
CREATE INDEX idx_subscription_payments_transaction_hash ON subscription_payments(transaction_hash);

-- =====================================================
-- Triggers for automatic timestamp updates
-- =====================================================
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- INSERT DEFAULT CHAINS
-- =====================================================
INSERT INTO chains (chain_id, name, symbol, icon, network_id, rpc_url, explorer_url) VALUES
('ethereum', 'Ethereum', 'ETH', '🟣', 1, 'https://eth-mainnet.g.alchemy.com/v2/', 'https://etherscan.io'),
('base', 'Base', 'ETH', '🔵', 8453, 'https://base-mainnet.g.alchemy.com/v2/', 'https://basescan.org'),
('bsc', 'Binance Smart Chain', 'BNB', '🟡', 56, 'https://bsc-dataseed.binance.org/', 'https://bscscan.com'),
('arbitrum', 'Arbitrum', 'ETH', '🔷', 42161, 'https://arb-mainnet.g.alchemy.com/v2/', 'https://arbiscan.io'),
('polygon', 'Polygon', 'MATIC', '🟣', 137, 'https://polygon-mainnet.g.alchemy.com/v2/', 'https://polygonscan.com'),
('avalanche', 'Avalanche', 'AVAX', '🔴', 43114, 'https://api.avax.network/ext/bc/C/rpc', 'https://snowtrace.io'),
('solana', 'Solana', 'SOL', '🟢', NULL, 'https://api.mainnet-beta.solana.com', 'https://solscan.io'),
('blast', 'Blast', 'ETH', '💥', 81457, 'https://rpc.blast.io', 'https://blastscan.io'),
('optimism', 'Optimism', 'ETH', '🔴', 10, 'https://opt-mainnet.g.alchemy.com/v2/', 'https://optimistic.etherscan.io');

-- =====================================================
-- VIEWS for easy data access
-- =====================================================

-- User wallet summary view
CREATE VIEW user_wallet_summary AS
SELECT 
    u.telegram_id,
    u.username,
    c.chain_id,
    c.name as chain_name,
    c.symbol,
    COUNT(w.id) as wallet_count,
    SUM(w.balance) as total_balance,
    MAX(w.updated_at) as last_updated
FROM users u
LEFT JOIN wallets w ON u.id = w.user_id
LEFT JOIN chains c ON w.chain_id = c.id
WHERE u.is_active = TRUE AND (w.is_active = TRUE OR w.is_active IS NULL)
GROUP BY u.telegram_id, u.username, c.chain_id, c.name, c.symbol
ORDER BY u.telegram_id, c.chain_id;

-- User trading summary view
CREATE VIEW user_trading_summary AS
SELECT 
    u.telegram_id,
    u.username,
    c.chain_id,
    c.name as chain_name,
    COUNT(t.id) as total_trades,
    COUNT(CASE WHEN t.trade_type = 'buy' THEN 1 END) as buy_trades,
    COUNT(CASE WHEN t.trade_type = 'sell' THEN 1 END) as sell_trades,
    SUM(t.amount_in_usd) as total_volume_usd,
    SUM(t.pnl_usd) as total_pnl_usd,
    AVG(t.pnl_percentage) as avg_pnl_percentage
FROM users u
LEFT JOIN trades t ON u.id = t.user_id
LEFT JOIN chains c ON t.chain_id = c.id
WHERE u.is_active = TRUE
GROUP BY u.telegram_id, u.username, c.chain_id, c.name
ORDER BY u.telegram_id, c.chain_id;

-- Recent activity view
CREATE VIEW recent_activity AS
SELECT 
    u.telegram_id,
    u.username,
    al.activity_type,
    al.description,
    al.created_at,
    c.chain_id,
    c.name as chain_name
FROM activity_logs al
JOIN users u ON al.user_id = u.id
LEFT JOIN chains c ON al.new_data->>'chain_id' = c.chain_id
ORDER BY al.created_at DESC
LIMIT 1000;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE users IS 'Main user information and authentication data';
COMMENT ON TABLE chains IS 'Supported blockchain networks configuration';
COMMENT ON TABLE wallets IS 'User wallets for each supported chain';
COMMENT ON TABLE wallet_history IS 'Historical record of wallet operations';
COMMENT ON TABLE tokens IS 'Token information for each chain';
COMMENT ON TABLE trades IS 'Complete trading history and analytics';
COMMENT ON TABLE transfers IS 'Native token transfer records';
COMMENT ON TABLE user_settings IS 'User preferences and configuration';
COMMENT ON TABLE price_alerts IS 'User-defined price alert configurations';
COMMENT ON TABLE activity_logs IS 'Comprehensive audit trail of all user activities';