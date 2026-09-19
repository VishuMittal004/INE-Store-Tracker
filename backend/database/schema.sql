-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table for tracking products
CREATE TABLE IF NOT EXISTS tracked_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_product_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    product_url TEXT NOT NULL,
    image_url TEXT,
    current_price DECIMAL(10, 2),
    current_stock BOOLEAN,
    scrape_frequency_minutes INTEGER DEFAULT 120,
    last_scraped_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for price and stock history (only valid observations)
CREATE TABLE IF NOT EXISTS price_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tracked_product_id UUID REFERENCES tracked_products(id) ON DELETE CASCADE,
    price DECIMAL(10, 2) NOT NULL,
    stock BOOLEAN NOT NULL,
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create a function to delete old scrape logs (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_scrape_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM scrape_logs 
    WHERE started_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Table for in-app alerts
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tracked_product_id UUID REFERENCES tracked_products(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'price_drop' or 'back_in_stock'
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for detailed scrape attempt logs
CREATE TABLE IF NOT EXISTS scrape_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tracked_product_id UUID REFERENCES tracked_products(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    finished_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL, -- e.g., 'success', 'failed'
    attempt_number INTEGER DEFAULT 1,
    message TEXT,
    price_recorded DECIMAL(10, 2),
    http_code INTEGER
);

-- Table for alert rules per product
CREATE TABLE IF NOT EXISTS alert_settings (
    product_id UUID PRIMARY KEY REFERENCES tracked_products(id) ON DELETE CASCADE,
    drop_threshold DECIMAL(5, 2), -- percentage drop to trigger alert
    back_in_stock_flag BOOLEAN DEFAULT FALSE,
    email_flag BOOLEAN DEFAULT FALSE,
    email_address VARCHAR(255)
);

-- Table for sent alerts history
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES tracked_products(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- e.g., 'price_drop', 'back_in_stock'
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'pending'
);

-- Indexes for performance
-- Indexing due-time fields (used in due logic: cron job)
CREATE INDEX IF NOT EXISTS idx_tracked_products_last_scraped ON tracked_products(last_scraped_at);

-- Indexing history and logs timestamps for fast dashboard queries
CREATE INDEX IF NOT EXISTS idx_price_history_scraped_at ON price_history(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_logs_started_at ON scrape_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_logs_product_id ON scrape_logs(tracked_product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_product_id ON price_history(tracked_product_id);
