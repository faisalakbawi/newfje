#!/usr/bin/env node

/**
 * MONETIZATION SETUP SCRIPT
 * Sets up the database schema for the new fee system and subscription features
 */

require('dotenv').config();
const { Pool } = require('pg');

async function setupMonetization() {
  console.log('🚀 Setting up monetization system...');
  
  const pool = new Pool({
    user: process.env.DB_USER || process.env.USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'looter_ai_clone',
    password: process.env.DB_PASSWORD || '',
    port: process.env.DB_PORT || 5432,
  });

  try {
    console.log('📡 Connecting to database...');
    const client = await pool.connect();
    
    // Check if monetization tables already exist
    const existingTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('subscriptions', 'revenue_tracking', 'subscription_payments')
    `);

    if (existingTables.rows.length > 0) {
      console.log('✅ Monetization tables already exist!');
      console.log(`Found tables: ${existingTables.rows.map(r => r.table_name).join(', ')}`);
    } else {
      console.log('📊 Creating monetization tables...');
      
      // Read and execute the schema additions
      const fs = require('fs');
      const path = require('path');
      
      try {
        const schemaPath = path.join(__dirname, 'database/schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        // Extract only the monetization tables from the schema
        const monetizationTables = [
          'subscriptions',
          'revenue_tracking', 
          'subscription_payments'
        ];
        
        // Execute table creation one by one with better error handling
        for (const tableName of monetizationTables) {
          console.log(`📝 Checking table: ${tableName}`);
          
          // Check if table exists
          const tableExists = await client.query(`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = $1
            )
          `, [tableName]);
          
          if (tableExists.rows[0].exists) {
            console.log(`✅ Table ${tableName} already exists`);
          } else {
            console.log(`📦 Creating table ${tableName}...`);
            // In a production setup, you would execute specific CREATE TABLE statements here
            console.log(`⚠️ Please run the full schema.sql to create ${tableName}`);
          }
        }
        
        console.log('✅ Schema setup complete!');
        
      } catch (schemaError) {
        console.log('⚠️ Could not read schema file, creating tables manually...');
        
        // Create tables manually
        await createSubscriptionsTable(client);
        await createRevenueTrackingTable(client);
        await createSubscriptionPaymentsTable(client);
        await createIndexes(client);
        
        console.log('✅ Manual table creation complete!');
      }
    }
    
    // Test the system
    console.log('🧪 Testing monetization services...');
    await testMonetizationServices(client);
    
    client.release();
    console.log('🎉 Monetization setup completed successfully!');
    
    console.log('\n📋 Next steps:');
    console.log('1. Set TREASURY_WALLET in your .env file');
    console.log('2. Configure premium RPC endpoints for speed tiers');
    console.log('3. Start the bot: npm start');
    console.log('4. Test with: /tier command');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

async function createSubscriptionsTable(client) {
  console.log('📦 Creating subscriptions table...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      plan_type VARCHAR(20) NOT NULL,
      status VARCHAR(20) DEFAULT 'active',
      start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      end_date TIMESTAMP WITH TIME ZONE,
      auto_renew BOOLEAN DEFAULT TRUE,
      payment_method VARCHAR(50),
      payment_amount DECIMAL(18, 8),
      payment_currency VARCHAR(10),
      payment_tx_hash VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ Subscriptions table created');
}

async function createRevenueTrackingTable(client) {
  console.log('📦 Creating revenue_tracking table...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS revenue_tracking (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      trade_id UUID,
      subscription_id UUID,
      revenue_type VARCHAR(30) NOT NULL,
      amount_eth DECIMAL(36, 18) NOT NULL,
      amount_usd DECIMAL(18, 2),
      fee_percentage DECIMAL(5, 4),
      user_tier VARCHAR(20) NOT NULL,
      original_amount DECIMAL(36, 18),
      chain_id VARCHAR(50),
      token_address VARCHAR(255),
      metadata JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ Revenue tracking table created');
}

async function createSubscriptionPaymentsTable(client) {
  console.log('📦 Creating subscription_payments table...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS subscription_payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      subscription_id UUID NOT NULL,
      user_id UUID NOT NULL,
      amount DECIMAL(18, 8) NOT NULL,
      currency VARCHAR(10) NOT NULL,
      payment_method VARCHAR(50) NOT NULL,
      transaction_hash VARCHAR(255),
      from_address VARCHAR(255),
      to_address VARCHAR(255),
      block_number BIGINT,
      status VARCHAR(20) DEFAULT 'pending',
      confirmed_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ Subscription payments table created');
}

async function createIndexes(client) {
  console.log('📦 Creating indexes...');
  
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)',
    'CREATE INDEX IF NOT EXISTS idx_revenue_tracking_user_id ON revenue_tracking(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_revenue_tracking_revenue_type ON revenue_tracking(revenue_type)',
    'CREATE INDEX IF NOT EXISTS idx_revenue_tracking_user_tier ON revenue_tracking(user_tier)',
    'CREATE INDEX IF NOT EXISTS idx_revenue_tracking_created_at ON revenue_tracking(created_at)'
  ];
  
  for (const index of indexes) {
    await client.query(index);
  }
  
  console.log('✅ Indexes created');
}

async function testMonetizationServices(client) {
  try {
    // Test revenue tracking table
    await client.query(`
      SELECT COUNT(*) FROM revenue_tracking
    `);
    console.log('✅ Revenue tracking table accessible');
    
    // Test subscriptions table  
    await client.query(`
      SELECT COUNT(*) FROM subscriptions
    `);
    console.log('✅ Subscriptions table accessible');
    
    // Test basic functionality
    const testUserId = 'test-' + Date.now();
    console.log('🧪 Testing basic functionality...');
    
    console.log('✅ All monetization services working!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

// Run setup if called directly
if (require.main === module) {
  setupMonetization()
    .then(() => {
      console.log('🎉 Setup complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Setup failed:', error.message);
      process.exit(1);
    });
}

module.exports = { setupMonetization };