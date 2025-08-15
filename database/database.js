/**
 * LOOTER.AI CLONE - PostgreSQL Database Manager
 * Comprehensive database operations for user data management
 */

const { Pool } = require('pg');
const crypto = require('crypto');

class Database {
  constructor() {
    this.pool = null;
    this.isConnected = false;
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'your-32-char-secret-key-here-change-this';
  }

  // Initialize database connection
  async initialize() {
    try {
      this.pool = new Pool({
        user: process.env.DB_USER || process.env.USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'looter_ai_clone',
        password: process.env.DB_PASSWORD || '',
        port: process.env.DB_PORT || 5432,
        max: 20, // Maximum number of clients in the pool
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.isConnected = true;
      console.log('🗄️ PostgreSQL Database connected successfully');
      
      // Initialize default data
      await this.initializeDefaultData();
      
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      throw error;
    }
  }

  // Initialize default data (chains, etc.)
  async initializeDefaultData() {
    try {
      // Check if chains are already initialized
      const chainsResult = await this.query('SELECT COUNT(*) FROM chains');
      const chainCount = parseInt(chainsResult.rows[0].count);
      
      if (chainCount === 0) {
        console.log('🔧 Initializing default chains...');
        // Chains are inserted via schema.sql
      }
      
      console.log(`✅ Database initialized with ${chainCount} chains`);
    } catch (error) {
      console.error('❌ Error initializing default data:', error.message);
    }
  }

  // Execute query
  async query(text, params) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    
    try {
      const start = Date.now();
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      // Log slow queries (> 100ms)
      if (duration > 100) {
        console.log(`🐌 Slow query (${duration}ms):`, text.substring(0, 100));
      }
      
      return result;
    } catch (error) {
      console.error('❌ Database query error:', error.message);
      console.error('Query:', text);
      console.error('Params:', params);
      throw error;
    }
  }

  // Get database client for transactions
  async getClient() {
    return await this.pool.connect();
  }

  // Encrypt sensitive data
  encrypt(text) {
    if (!text) return null;
    
    try {
      const algorithm = 'aes-256-cbc';
      const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
      const iv = crypto.randomBytes(16);
      
      const cipher = crypto.createCipheriv(algorithm, key, iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('❌ Encryption error:', error.message);
      return null;
    }
  }

  // Decrypt sensitive data
  decrypt(encryptedText) {
    if (!encryptedText) return null;
    
    try {
      const algorithm = 'aes-256-cbc';
      const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
      
      const textParts = encryptedText.split(':');
      const iv = Buffer.from(textParts.shift(), 'hex');
      const encrypted = textParts.join(':');
      
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('❌ Decryption error:', error.message);
      return null;
    }
  }

  // Close database connection
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      console.log('🗄️ Database connection closed');
    }
  }

  // =====================================================
  // USER OPERATIONS
  // =====================================================

  // Create or get user
  async createUser(telegramId, userData = {}) {
    try {
      const { username, first_name, last_name, language_code } = userData;
      
      const result = await this.query(`
        INSERT INTO users (telegram_id, username, first_name, last_name, language_code)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (telegram_id) 
        DO UPDATE SET 
          username = EXCLUDED.username,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          last_active = CURRENT_TIMESTAMP
        RETURNING *
      `, [telegramId, username, first_name, last_name, language_code]);

      // Log user activity
      await this.logActivity(result.rows[0].id, 'user_login', 'user', result.rows[0].id, {
        description: 'User logged in',
        telegram_data: userData
      });

      return result.rows[0];
    } catch (error) {
      console.error('❌ Error creating/updating user:', error.message);
      throw error;
    }
  }

  // Get user by telegram ID
  async getUserByTelegramId(telegramId) {
    try {
      const result = await this.query(
        'SELECT * FROM users WHERE telegram_id = $1 AND is_active = TRUE',
        [telegramId]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ Error getting user:', error.message);
      throw error;
    }
  }

  // Update user last active
  async updateUserActivity(telegramId) {
    try {
      await this.query(
        'UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE telegram_id = $1',
        [telegramId]
      );
    } catch (error) {
      console.error('❌ Error updating user activity:', error.message);
    }
  }

  // =====================================================
  // CHAIN OPERATIONS
  // =====================================================

  // Get all chains
  async getAllChains() {
    try {
      const result = await this.query(
        'SELECT * FROM chains WHERE is_active = TRUE ORDER BY name'
      );
      return result.rows;
    } catch (error) {
      console.error('❌ Error getting chains:', error.message);
      throw error;
    }
  }

  // Get chain by ID
  async getChainById(chainId) {
    try {
      const result = await this.query(
        'SELECT * FROM chains WHERE chain_id = $1 AND is_active = TRUE',
        [chainId]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ Error getting chain:', error.message);
      throw error;
    }
  }

  // =====================================================
  // WALLET OPERATIONS
  // =====================================================

  // Create wallet
  async createWallet(userId, chainId, walletSlot, address, privateKey, seedPhrase = null, isImported = false) {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');

      // Get chain info
      console.log(`🔍 Looking for chain with chain_id: ${chainId}`);
      const chainResult = await client.query(
        'SELECT id FROM chains WHERE chain_id = $1',
        [chainId]
      );
      
      console.log(`📊 Chain query result:`, chainResult.rows);
      
      if (chainResult.rows.length === 0) {
        throw new Error(`Chain ${chainId} not found`);
      }
      
      const chainUuid = chainResult.rows[0].id;
      console.log(`✅ Found chain UUID: ${chainUuid}`);

      // Encrypt sensitive data
      const encryptedPrivateKey = this.encrypt(privateKey);
      const encryptedSeedPhrase = seedPhrase ? this.encrypt(seedPhrase) : null;

      // Insert wallet
      const walletResult = await client.query(`
        INSERT INTO wallets (user_id, chain_id, wallet_slot, address, private_key, seed_phrase, is_imported, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
        ON CONFLICT (user_id, chain_id, wallet_slot)
        DO UPDATE SET 
          address = EXCLUDED.address,
          private_key = EXCLUDED.private_key,
          seed_phrase = EXCLUDED.seed_phrase,
          is_imported = EXCLUDED.is_imported,
          is_active = TRUE,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [userId, chainUuid, walletSlot, address, encryptedPrivateKey, encryptedSeedPhrase, isImported]);

      const wallet = walletResult.rows[0];

      // Log wallet creation
      await client.query(`
        INSERT INTO wallet_history (wallet_id, action_type, new_value, metadata)
        VALUES ($1, $2, $3, $4)
      `, [
        wallet.id,
        isImported ? 'imported' : 'created',
        address,
        JSON.stringify({ wallet_slot: walletSlot, chain_id: chainId })
      ]);

      // Log activity
      await this.logActivity(userId, isImported ? 'wallet_imported' : 'wallet_created', 'wallet', wallet.id, {
        description: `Wallet ${walletSlot} ${isImported ? 'imported' : 'created'} on ${chainId}`,
        wallet_slot: walletSlot,
        chain_id: chainId,
        address: address
      }, client);

      await client.query('COMMIT');
      return wallet;

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error creating wallet:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get user wallets for a chain
  async getUserWallets(userId, chainId) {
    try {
      const result = await this.query(`
        SELECT w.*, c.chain_id, c.name as chain_name, c.symbol
        FROM wallets w
        JOIN chains c ON w.chain_id = c.id
        WHERE w.user_id = $1 AND c.chain_id = $2 AND w.is_active = TRUE
        ORDER BY w.wallet_slot
      `, [userId, chainId]);

      // Decrypt private keys
      return result.rows.map(wallet => ({
        ...wallet,
        private_key: this.decrypt(wallet.private_key),
        seed_phrase: wallet.seed_phrase ? this.decrypt(wallet.seed_phrase) : null
      }));
    } catch (error) {
      console.error('❌ Error getting user wallets:', error.message);
      throw error;
    }
  }

  // Get all user wallets
  async getAllUserWallets(userId) {
    try {
      const result = await this.query(`
        SELECT w.*, c.chain_id, c.name as chain_name, c.symbol
        FROM wallets w
        JOIN chains c ON w.chain_id = c.id
        WHERE w.user_id = $1 AND w.is_active = TRUE
        ORDER BY c.chain_id, w.wallet_slot
      `, [userId]);

      // Decrypt private keys
      return result.rows.map(wallet => ({
        ...wallet,
        private_key: this.decrypt(wallet.private_key),
        seed_phrase: wallet.seed_phrase ? this.decrypt(wallet.seed_phrase) : null
      }));
    } catch (error) {
      console.error('❌ Error getting all user wallets:', error.message);
      throw error;
    }
  }

  // Update wallet balance
  async updateWalletBalance(walletId, balance) {
    try {
      await this.query(`
        UPDATE wallets 
        SET balance = $1, last_balance_update = CURRENT_TIMESTAMP 
        WHERE id = $2
      `, [balance, walletId]);
    } catch (error) {
      console.error('❌ Error updating wallet balance:', error.message);
      throw error;
    }
  }

  // Delete wallet
  async deleteWallet(userId, chainId, walletSlot) {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');

      // Get wallet
      const walletResult = await client.query(`
        SELECT w.* FROM wallets w
        JOIN chains c ON w.chain_id = c.id
        WHERE w.user_id = $1 AND c.chain_id = $2 AND w.wallet_slot = $3
      `, [userId, chainId, walletSlot]);

      if (walletResult.rows.length === 0) {
        throw new Error('Wallet not found');
      }

      const wallet = walletResult.rows[0];

      // Soft delete wallet
      await client.query(
        'UPDATE wallets SET is_active = FALSE WHERE id = $1',
        [wallet.id]
      );

      // Log deletion
      await client.query(`
        INSERT INTO wallet_history (wallet_id, action_type, old_value, metadata)
        VALUES ($1, $2, $3, $4)
      `, [
        wallet.id,
        'deleted',
        wallet.address,
        JSON.stringify({ wallet_slot: walletSlot, chain_id: chainId })
      ]);

      // Log activity
      await this.logActivity(userId, 'wallet_deleted', 'wallet', wallet.id, {
        description: `Wallet ${walletSlot} deleted on ${chainId}`,
        wallet_slot: walletSlot,
        chain_id: chainId,
        address: wallet.address
      }, client);

      await client.query('COMMIT');
      return true;

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error deleting wallet:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  // =====================================================
  // TRADING OPERATIONS
  // =====================================================

  // Record trade
  async recordTrade(tradeData) {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');

      const {
        userId, walletId, chainId, tokenAddress, tokenSymbol, tokenName,
        tradeType, amountIn, amountOut, amountInUsd, amountOutUsd,
        tokenPrice, tokenPriceUsd, transactionHash, gasUsed, gasPrice,
        gasFee, gasFeeUsd, slippage, status, blockNumber, metadata
      } = tradeData;

      // Get chain UUID
      const chainResult = await client.query(
        'SELECT id FROM chains WHERE chain_id = $1',
        [chainId]
      );
      const chainUuid = chainResult.rows[0]?.id;

      // Insert trade
      const tradeResult = await client.query(`
        INSERT INTO trades (
          user_id, wallet_id, chain_id, token_address, token_symbol, token_name,
          trade_type, amount_in, amount_out, amount_in_usd, amount_out_usd,
          token_price, token_price_usd, transaction_hash, gas_used, gas_price,
          gas_fee, gas_fee_usd, slippage, status, block_number, metadata
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
        ) RETURNING *
      `, [
        userId, walletId, chainUuid, tokenAddress, tokenSymbol, tokenName,
        tradeType, amountIn, amountOut, amountInUsd, amountOutUsd,
        tokenPrice, tokenPriceUsd, transactionHash, gasUsed, gasPrice,
        gasFee, gasFeeUsd, slippage, status, blockNumber, JSON.stringify(metadata || {})
      ]);

      const trade = tradeResult.rows[0];

      // Log activity
      await this.logActivity(userId, 'trade_executed', 'trade', trade.id, {
        description: `${tradeType.toUpperCase()} ${tokenSymbol} for ${amountInUsd ? `$${amountInUsd}` : amountIn}`,
        trade_type: tradeType,
        token_symbol: tokenSymbol,
        amount_usd: amountInUsd,
        transaction_hash: transactionHash
      }, client);

      await client.query('COMMIT');
      return trade;

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error recording trade:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  // Update trade status
  async updateTradeStatus(tradeId, status, confirmationData = {}) {
    try {
      const { blockNumber, confirmationTime, pnlAmount, pnlPercentage, pnlUsd } = confirmationData;
      
      await this.query(`
        UPDATE trades 
        SET status = $1, block_number = $2, confirmation_time = $3,
            pnl_amount = $4, pnl_percentage = $5, pnl_usd = $6
        WHERE id = $7
      `, [status, blockNumber, confirmationTime, pnlAmount, pnlPercentage, pnlUsd, tradeId]);

    } catch (error) {
      console.error('❌ Error updating trade status:', error.message);
      throw error;
    }
  }

  // Get user trades
  async getUserTrades(userId, chainId = null, limit = 100) {
    try {
      let query = `
        SELECT t.*, c.chain_id, c.name as chain_name, c.symbol as chain_symbol,
               w.wallet_slot, w.address as wallet_address
        FROM trades t
        JOIN chains c ON t.chain_id = c.id
        JOIN wallets w ON t.wallet_id = w.id
        WHERE t.user_id = $1
      `;
      
      const params = [userId];
      
      if (chainId) {
        query += ' AND c.chain_id = $2';
        params.push(chainId);
      }
      
      query += ' ORDER BY t.created_at DESC LIMIT $' + (params.length + 1);
      params.push(limit);

      const result = await this.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('❌ Error getting user trades:', error.message);
      throw error;
    }
  }

  // =====================================================
  // TRANSFER OPERATIONS
  // =====================================================

  // Record transfer
  async recordTransfer(transferData) {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');

      const {
        userId, fromWalletId, chainId, toAddress, amount, amountUsd,
        transactionHash, gasUsed, gasPrice, gasFee, gasFeeUsd,
        status, blockNumber, note, metadata
      } = transferData;

      // Get chain UUID
      const chainResult = await client.query(
        'SELECT id FROM chains WHERE chain_id = $1',
        [chainId]
      );
      const chainUuid = chainResult.rows[0]?.id;

      // Insert transfer
      const transferResult = await client.query(`
        INSERT INTO transfers (
          user_id, from_wallet_id, chain_id, to_address, amount, amount_usd,
          transaction_hash, gas_used, gas_price, gas_fee, gas_fee_usd,
          status, block_number, note, metadata
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        ) RETURNING *
      `, [
        userId, fromWalletId, chainUuid, toAddress, amount, amountUsd,
        transactionHash, gasUsed, gasPrice, gasFee, gasFeeUsd,
        status, blockNumber, note, JSON.stringify(metadata || {})
      ]);

      const transfer = transferResult.rows[0];

      // Log activity
      await this.logActivity(userId, 'transfer_sent', 'transfer', transfer.id, {
        description: `Transferred ${amount} to ${toAddress}`,
        to_address: toAddress,
        amount: amount,
        amount_usd: amountUsd,
        transaction_hash: transactionHash
      }, client);

      await client.query('COMMIT');
      return transfer;

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error recording transfer:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  // Update transfer status
  async updateTransferStatus(transferId, status, confirmationData = {}) {
    try {
      const { blockNumber, confirmationTime } = confirmationData;
      
      await this.query(`
        UPDATE transfers 
        SET status = $1, block_number = $2, confirmation_time = $3
        WHERE id = $4
      `, [status, blockNumber, confirmationTime, transferId]);

    } catch (error) {
      console.error('❌ Error updating transfer status:', error.message);
      throw error;
    }
  }

  // Get user transfers
  async getUserTransfers(userId, chainId = null, limit = 100) {
    try {
      let query = `
        SELECT t.*, c.chain_id, c.name as chain_name, c.symbol as chain_symbol,
               w.wallet_slot, w.address as from_address
        FROM transfers t
        JOIN chains c ON t.chain_id = c.id
        JOIN wallets w ON t.from_wallet_id = w.id
        WHERE t.user_id = $1
      `;
      
      const params = [userId];
      
      if (chainId) {
        query += ' AND c.chain_id = $2';
        params.push(chainId);
      }
      
      query += ' ORDER BY t.created_at DESC LIMIT $' + (params.length + 1);
      params.push(limit);

      const result = await this.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('❌ Error getting user transfers:', error.message);
      throw error;
    }
  }

  // =====================================================
  // ACTIVITY LOGGING
  // =====================================================

  // Log user activity
  async logActivity(userId, activityType, entityType, entityId, data = {}, client = null) {
    try {
      const queryClient = client || this.pool;
      
      await queryClient.query(`
        INSERT INTO activity_logs (user_id, activity_type, entity_type, entity_id, description, new_data, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        userId,
        activityType,
        entityType,
        entityId,
        data.description || '',
        JSON.stringify(data),
        JSON.stringify({ timestamp: new Date().toISOString(), ...data.metadata })
      ]);

    } catch (error) {
      console.error('❌ Error logging activity:', error.message);
      // Don't throw error for logging failures
    }
  }

  // Get user activity
  async getUserActivity(userId, limit = 50) {
    try {
      const result = await this.query(`
        SELECT * FROM activity_logs 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2
      `, [userId, limit]);

      return result.rows;
    } catch (error) {
      console.error('❌ Error getting user activity:', error.message);
      throw error;
    }
  }

  // =====================================================
  // ANALYTICS AND REPORTING
  // =====================================================

  // Get user summary
  async getUserSummary(userId) {
    try {
      const [walletSummary, tradingSummary, recentActivity] = await Promise.all([
        this.query(`
          SELECT 
            c.chain_id,
            c.name as chain_name,
            c.symbol,
            COUNT(w.id) as wallet_count,
            SUM(w.balance) as total_balance
          FROM chains c
          LEFT JOIN wallets w ON c.id = w.chain_id AND w.user_id = $1 AND w.is_active = TRUE
          WHERE c.is_active = TRUE
          GROUP BY c.id, c.chain_id, c.name, c.symbol
          ORDER BY c.chain_id
        `, [userId]),
        
        this.query(`
          SELECT 
            c.chain_id,
            COUNT(t.id) as total_trades,
            SUM(CASE WHEN t.trade_type = 'buy' THEN 1 ELSE 0 END) as buy_trades,
            SUM(CASE WHEN t.trade_type = 'sell' THEN 1 ELSE 0 END) as sell_trades,
            SUM(t.amount_in_usd) as total_volume_usd,
            SUM(t.pnl_usd) as total_pnl_usd
          FROM chains c
          LEFT JOIN trades t ON c.id = t.chain_id AND t.user_id = $1
          WHERE c.is_active = TRUE
          GROUP BY c.id, c.chain_id
          ORDER BY c.chain_id
        `, [userId]),
        
        this.getUserActivity(userId, 10)
      ]);

      return {
        wallets: walletSummary.rows,
        trading: tradingSummary.rows,
        recent_activity: recentActivity
      };
    } catch (error) {
      console.error('❌ Error getting user summary:', error.message);
      throw error;
    }
  }

  // =====================================================
  // SUBSCRIPTION MANAGEMENT METHODS
  // =====================================================

  async createSubscription(userId, planType, duration = 30, paymentData = {}) {
    const query = `
      INSERT INTO subscriptions (user_id, plan_type, status, end_date, payment_method, payment_amount, payment_currency, payment_tx_hash)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + duration);
    
    const values = [
      userId,
      planType,
      'active',
      endDate,
      paymentData.method || 'crypto',
      paymentData.amount || null,
      paymentData.currency || 'ETH',
      paymentData.txHash || null
    ];

    try {
      const result = await this.pool.query(query, values);
      console.log(`📦 Created subscription: ${planType} for user ${userId}`);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error creating subscription:', error.message);
      throw error;
    }
  }

  async getUserSubscription(userId) {
    const query = `
      SELECT * FROM subscriptions 
      WHERE user_id = $1 AND status = 'active' AND end_date > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `;

    try {
      const result = await this.pool.query(query, [userId]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ Error getting user subscription:', error.message);
      throw error;
    }
  }

  async expireSubscription(subscriptionId) {
    const query = `
      UPDATE subscriptions 
      SET status = 'expired', updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [subscriptionId]);
      console.log(`⏰ Expired subscription: ${subscriptionId}`);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error expiring subscription:', error.message);
      throw error;
    }
  }

  // =====================================================
  // REVENUE TRACKING METHODS
  // =====================================================

  async recordRevenue(revenueData) {
    const query = `
      INSERT INTO revenue_tracking 
      (user_id, trade_id, subscription_id, revenue_type, amount_eth, amount_usd, fee_percentage, user_tier, original_amount, chain_id, token_address, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const values = [
      revenueData.userId,
      revenueData.tradeId || null,
      revenueData.subscriptionId || null,
      revenueData.revenueType,
      revenueData.amountEth,
      revenueData.amountUsd || null,
      revenueData.feePercentage || null,
      revenueData.userTier,
      revenueData.originalAmount || null,
      revenueData.chainId || null,
      revenueData.tokenAddress || null,
      revenueData.metadata ? JSON.stringify(revenueData.metadata) : null
    ];

    try {
      const result = await this.pool.query(query, values);
      console.log(`💰 Recorded revenue: ${revenueData.amountEth} ETH from ${revenueData.userTier} user`);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error recording revenue:', error.message);
      throw error;
    }
  }

  async getTotalRevenue(period = '30 days') {
    const query = `
      SELECT 
        COUNT(*) as total_transactions,
        SUM(amount_eth) as total_eth,
        SUM(amount_usd) as total_usd,
        revenue_type,
        user_tier
      FROM revenue_tracking 
      WHERE created_at >= NOW() - INTERVAL '${period}'
      GROUP BY revenue_type, user_tier
      ORDER BY total_eth DESC
    `;

    try {
      const result = await this.pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('❌ Error getting total revenue:', error.message);
      throw error;
    }
  }

  async getUserRevenue(userId, period = '30 days') {
    const query = `
      SELECT 
        COUNT(*) as transaction_count,
        SUM(amount_eth) as total_fees_paid_eth,
        SUM(amount_usd) as total_fees_paid_usd,
        revenue_type
      FROM revenue_tracking 
      WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '${period}'
      GROUP BY revenue_type
    `;

    try {
      const result = await this.pool.query(query, [userId]);
      return result.rows;
    } catch (error) {
      console.error('❌ Error getting user revenue:', error.message);
      throw error;
    }
  }

  // =====================================================
  // ANALYTICS METHODS
  // =====================================================

  async getRevenueDashboard() {
    const queries = {
      totalRevenue: `SELECT SUM(amount_eth) as total_eth, SUM(amount_usd) as total_usd FROM revenue_tracking`,
      revenueByTier: `SELECT user_tier, SUM(amount_eth) as eth, COUNT(*) as transactions FROM revenue_tracking GROUP BY user_tier`,
      revenueByType: `SELECT revenue_type, SUM(amount_eth) as eth, COUNT(*) as transactions FROM revenue_tracking GROUP BY revenue_type`,
      subscriptionStats: `SELECT plan_type, COUNT(*) as active_subs FROM subscriptions WHERE status = 'active' AND end_date > NOW() GROUP BY plan_type`,
      monthlyTrend: `
        SELECT 
          DATE_TRUNC('day', created_at) as date,
          SUM(amount_eth) as daily_eth,
          COUNT(*) as daily_transactions
        FROM revenue_tracking 
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY date
      `
    };

    try {
      const results = {};
      for (const [key, query] of Object.entries(queries)) {
        const result = await this.pool.query(query);
        results[key] = result.rows;
      }
      
      return results;
    } catch (error) {
      console.error('❌ Error getting revenue dashboard:', error.message);
      throw error;
    }
  }
}

module.exports = Database;