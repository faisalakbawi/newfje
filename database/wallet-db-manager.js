/**
 * LOOTER.AI CLONE - Database-Integrated Wallet Manager
 * Replaces file-based storage with PostgreSQL database
 */

const Database = require('./database');

class WalletDBManager {
  constructor(chainManager = null) {
    this.db = new Database();
    this.chainManager = chainManager;
    this.isInitialized = false;
    
    // Balance cache for performance (30 second TTL)
    this.balanceCache = new Map();
    this.CACHE_TTL = 30000; // 30 seconds
    
    // Clean up cache every 60 seconds
    setInterval(() => this.cleanupCache(), 60000);
  }

  async initialize() {
    try {
      await this.db.initialize();
      this.isInitialized = true;
      console.log('💼 Database Wallet Manager initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Database Wallet Manager:', error.message);
      throw error;
    }
  }

  // =====================================================
  // USER MANAGEMENT
  // =====================================================

  async createUser(telegramId, userData = {}) {
    if (!this.isInitialized) await this.initialize();
    
    try {
      const user = await this.db.createUser(telegramId, userData);
      console.log(`👤 User created/updated: ${user.telegram_id}`);
      return user;
    } catch (error) {
      console.error('❌ Error creating user:', error.message);
      throw error;
    }
  }

  async getUser(telegramId) {
    if (!this.isInitialized) await this.initialize();
    
    try {
      const user = await this.db.getUserByTelegramId(telegramId);
      if (user) {
        await this.db.updateUserActivity(telegramId);
      }
      return user;
    } catch (error) {
      console.error('❌ Error getting user:', error.message);
      throw error;
    }
  }

  // Ensure user exists (called on /start to preserve original flow)
  async ensureUserExists(telegramId, telegramUser = {}) {
    if (!this.isInitialized) await this.initialize();
    
    try {
      let user = await this.getUser(telegramId);
      if (!user) {
        console.log(`👤 Auto-creating user on /start: ${telegramId}`);
        user = await this.createUser(telegramId, {
          username: telegramUser.username || 'unknown',
          first_name: telegramUser.first_name || 'User',
          last_name: telegramUser.last_name || ''
        });
      }
      return user;
    } catch (error) {
      console.error('❌ Error ensuring user exists:', error.message);
      throw error;
    }
  }

  // =====================================================
  // WALLET OPERATIONS
  // =====================================================

  async generateWallet(telegramId, walletSlot, chain) {
    if (!this.isInitialized) await this.initialize();
    
    try {
      const user = await this.getUser(telegramId);
      if (!user) {
        throw new Error('User not found - please send /start first');
      }

      // Generate wallet using existing logic
      const ethers = require('ethers');
      const wallet = ethers.Wallet.createRandom();
      
      // Store in database
      const dbWallet = await this.db.createWallet(
        user.id,
        chain,
        walletSlot,
        wallet.address,
        wallet.privateKey,
        wallet.mnemonic.phrase,
        false // not imported
      );

      console.log(`🔑 Generated wallet ${walletSlot} for ${chain}: ${wallet.address}`);
      return wallet.address;
      
    } catch (error) {
      console.error('❌ Error generating wallet:', error.message);
      throw error;
    }
  }

  // Import wallet from private key (auto-finds available slot like original)
  async importPrivateKey(telegramId, privateKey, chain = 'base') {
    if (!this.isInitialized) await this.initialize();
    
    try {
      const user = await this.getUser(telegramId);
      if (!user) {
        throw new Error('User not found - please send /start first');
      }

      // Validate private key format
      const cleanKey = privateKey.replace(/^0x/, '');
      if (!/^[a-fA-F0-9]{64}$/.test(cleanKey)) {
        return { success: false, error: 'Invalid private key format' };
      }

      // Create wallet from private key
      const ethers = require('ethers');
      const wallet = new ethers.Wallet(`0x${cleanKey}`);
      const address = wallet.address;

      // Find available slot
      const chainWallets = await this.getChainWallets(telegramId, chain);
      
      let availableSlot = null;
      for (let i = 1; i <= 5; i++) {
        const walletSlot = `W${i}`;
        if (!chainWallets[walletSlot]) {
          availableSlot = walletSlot;
          break;
        }
      }

      if (!availableSlot) {
        return { success: false, error: 'All wallet slots are full. Delete a wallet first.' };
      }

      // Store in database
      console.log(`🔧 About to call db.createWallet with:`, {
        userId: user.id,
        chain: chain,
        availableSlot: availableSlot,
        address: wallet.address,
        isImported: true
      });
      
      const dbWallet = await this.db.createWallet(
        user.id,
        chain,
        availableSlot,
        wallet.address,
        wallet.privateKey,
        null, // no seed phrase for imported private key
        true // imported
      );

      console.log(`📥 Imported wallet ${availableSlot} for ${chain}: ${wallet.address}`);
      console.log(`📊 Database result:`, dbWallet);
      
      return { 
        success: true, 
        address: wallet.address, 
        slot: availableSlot,
        chain: chain 
      };
      
    } catch (error) {
      console.error('❌ Error importing private key:', error.message);
      return { success: false, error: error.message };
    }
  }

  async importWallet(telegramId, walletSlot, chain, privateKeyOrSeed, type = 'privatekey') {
    if (!this.isInitialized) await this.initialize();
    
    try {
      const user = await this.getUser(telegramId);
      if (!user) {
        throw new Error('User not found - please send /start first');
      }

      let wallet;
      let privateKey;
      let seedPhrase = null;

      if (type === 'privatekey') {
        const ethers = require('ethers');
        wallet = new ethers.Wallet(privateKeyOrSeed);
        privateKey = privateKeyOrSeed;
      } else if (type === 'seedphrase') {
        const ethers = require('ethers');
        wallet = ethers.Wallet.fromMnemonic(privateKeyOrSeed);
        privateKey = wallet.privateKey;
        seedPhrase = privateKeyOrSeed;
      } else {
        throw new Error('Invalid import type');
      }

      // Store in database
      const dbWallet = await this.db.createWallet(
        user.id,
        chain,
        walletSlot,
        wallet.address,
        privateKey,
        seedPhrase,
        true // imported
      );

      console.log(`📥 Imported wallet ${walletSlot} for ${chain}: ${wallet.address}`);
      return wallet.address;
      
    } catch (error) {
      console.error('❌ Error importing wallet:', error.message);
      throw error;
    }
  }

  async getChainWallets(telegramId, chain) {
    if (!this.isInitialized) await this.initialize();
    
    try {
      const user = await this.getUser(telegramId);
      if (!user) {
        return {};
      }

      const wallets = await this.db.getUserWallets(user.id, chain);
      
      // Convert to the expected format
      const chainWallets = {};
      wallets.forEach(wallet => {
        if (wallet.private_key) {  // Only include wallets with valid private keys
          chainWallets[wallet.wallet_slot] = {
            address: wallet.address,
            privateKey: wallet.private_key,
            seedPhrase: wallet.seed_phrase,
            createdAt: wallet.created_at,
            isImported: wallet.is_imported,
            balance: wallet.balance || '0'
          };
        }
      });

      return chainWallets;
      
    } catch (error) {
      console.error('❌ Error getting chain wallets:', error.message);
      return {};
    }
  }

  async getUserWallets(telegramId) {
    if (!this.isInitialized) await this.initialize();
    
    try {
      const user = await this.getUser(telegramId);
      if (!user) {
        return {};
      }

      const wallets = await this.db.getAllUserWallets(user.id);
      
      // Convert to the expected format
      const userWallets = {};
      wallets.forEach(wallet => {
        if (!userWallets[wallet.chain_id]) {
          userWallets[wallet.chain_id] = {};
        }
        
        userWallets[wallet.chain_id][wallet.wallet_slot] = {
          address: wallet.address,
          privateKey: wallet.private_key,
          seedPhrase: wallet.seed_phrase,
          createdAt: wallet.created_at,
          isImported: wallet.is_imported,
          balance: wallet.balance || '0'
        };
      });

      return userWallets;
      
    } catch (error) {
      console.error('❌ Error getting user wallets:', error.message);
      return {};
    }
  }

  async deleteWallet(telegramId, walletSlot, chain) {
    if (!this.isInitialized) await this.initialize();
    
    try {
      const user = await this.getUser(telegramId);
      if (!user) {
        throw new Error('User not found');
      }

      await this.db.deleteWallet(user.id, chain, walletSlot);
      console.log(`🗑️ Deleted wallet ${walletSlot} for ${chain}`);
      return true;
      
    } catch (error) {
      console.error('❌ Error deleting wallet:', error.message);
      throw error;
    }
  }

  // Replace wallet with private key
  async replaceWalletWithPrivateKey(telegramId, privateKey, walletSlot, chain) {
    if (!this.isInitialized) await this.initialize();
    
    try {
      console.log(`🔄 Replacing wallet ${walletSlot} on ${chain} with private key for user ${telegramId}`);
      
      const user = await this.getUser(telegramId);
      if (!user) {
        throw new Error('User not found - please send /start first');
      }

      // Validate and create wallet from private key
      const ethers = require('ethers');
      const wallet = new ethers.Wallet(privateKey);
      
      // Replace wallet in database (this will update the existing wallet in the same slot)
      const dbWallet = await this.db.createWallet(
        user.id,
        chain,
        walletSlot,
        wallet.address,
        wallet.privateKey,
        wallet.mnemonic ? wallet.mnemonic.phrase : null,
        true // imported
      );

      console.log(`🔄 Replaced wallet ${walletSlot} for ${chain}: ${wallet.address}`);
      return { 
        success: true, 
        address: wallet.address,
        walletSlot: walletSlot,
        chain: chain
      };
      
    } catch (error) {
      console.error('❌ Error replacing wallet with private key:', error.message);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // Replace wallet with seed phrase
  async replaceWalletWithSeedPhrase(telegramId, seedPhrase, walletSlot, chain) {
    if (!this.isInitialized) await this.initialize();
    
    try {
      console.log(`🔄 Replacing wallet ${walletSlot} on ${chain} with seed phrase for user ${telegramId}`);
      
      const user = await this.getUser(telegramId);
      if (!user) {
        throw new Error('User not found - please send /start first');
      }

      // Validate and create wallet from seed phrase
      const ethers = require('ethers');
      const wallet = ethers.Wallet.fromMnemonic(seedPhrase);
      
      // Replace wallet in database (this will update the existing wallet in the same slot)
      const dbWallet = await this.db.createWallet(
        user.id,
        chain,
        walletSlot,
        wallet.address,
        wallet.privateKey,
        seedPhrase,
        true // imported
      );

      console.log(`🔄 Replaced wallet ${walletSlot} for ${chain}: ${wallet.address}`);
      return { 
        success: true, 
        address: wallet.address,
        walletSlot: walletSlot,
        chain: chain
      };
      
    } catch (error) {
      console.error('❌ Error replacing wallet with seed phrase:', error.message);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // Clean up expired cache entries
  cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.balanceCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.balanceCache.delete(key);
      }
    }
  }

  // Pre-trade wallet validation
  async validateWalletForTrade(walletAddress, chain, requiredETH) {
    try {
      console.log(`💼 Validating wallet ${walletAddress.substring(0, 10)}... for ${requiredETH} ETH`);
      
      // Get current balance
      const balance = await this.getWalletBalance(walletAddress, chain);
      const balanceETH = parseFloat(balance);
      const requiredAmount = parseFloat(requiredETH);
      
      // Estimate gas costs based on chain
      let estimatedGas = 0.005; // Conservative estimate for Uniswap trades
      if (chain === 'bsc') estimatedGas = 0.002; // Lower gas on BSC
      if (chain === 'polygon') estimatedGas = 0.001; // Even lower on Polygon
      if (chain === 'solana') estimatedGas = 0.0001; // Very low on Solana
      
      const totalRequired = requiredAmount + estimatedGas;
      
      console.log(`   💰 Current balance: ${balanceETH} ETH`);
      console.log(`   💸 Required amount: ${requiredAmount} ETH`);
      console.log(`   ⛽ Estimated gas: ${estimatedGas} ETH`);
      console.log(`   📊 Total needed: ${totalRequired} ETH`);
      
      if (balanceETH < totalRequired) {
        return {
          valid: false,
          error: `Insufficient balance: ${balanceETH} ETH (need ${totalRequired} ETH)`,
          balance: balanceETH,
          required: totalRequired,
          shortfall: totalRequired - balanceETH
        };
      }
      
      return {
        valid: true,
        balance: balanceETH,
        required: totalRequired,
        available: balanceETH - totalRequired
      };
      
    } catch (error) {
      return {
        valid: false,
        error: `Wallet validation failed: ${error.message}`,
        balance: 0,
        required: parseFloat(requiredETH)
      };
    }
  }

  async getWalletBalance(address, chain) {
    try {
      // Check cache first
      const cacheKey = `${chain}_${address}`;
      const cached = this.balanceCache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
        return cached.balance;
      }
      
      // Use chain manager to get real balance
      if (this.chainManager) {
        const balance = await this.chainManager.getWalletBalance(chain, address);
        
        // Cache the result
        this.balanceCache.set(cacheKey, {
          balance: balance,
          timestamp: Date.now()
        });
        
        return balance;
      }
      
      // Fallback to cached balance from database if no chain manager
      return "0.0";
    } catch (error) {
      console.error('❌ Error getting wallet balance:', error.message);
      return "0.0";
    }
  }

  async updateWalletBalance(telegramId, walletSlot, chain, balance) {
    if (!this.isInitialized) await this.initialize();
    
    try {
      const user = await this.getUser(telegramId);
      if (!user) {
        return;
      }

      const wallets = await this.db.getUserWallets(user.id, chain);
      const wallet = wallets.find(w => w.wallet_slot === walletSlot);
      
      if (wallet) {
        await this.db.updateWalletBalance(wallet.id, balance);
      }
      
    } catch (error) {
      console.error('❌ Error updating wallet balance:', error.message);
    }
  }

  // =====================================================
  // TRADING OPERATIONS
  // =====================================================

  async recordTrade(telegramId, tradeData) {
    if (!this.isInitialized) await this.initialize();
    
    try {
      const user = await this.getUser(telegramId);
      if (!user) {
        throw new Error('User not found');
      }

      // Get wallet ID
      const wallets = await this.db.getUserWallets(user.id, tradeData.chain);
      const wallet = wallets.find(w => w.wallet_slot === tradeData.walletSlot);
      
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      const trade = await this.db.recordTrade({
        userId: user.id,
        walletId: wallet.id,
        chainId: tradeData.chain,
        ...tradeData
      });

      console.log(`📊 Trade recorded: ${trade.id}`);
      return trade;
      
    } catch (error) {
      console.error('❌ Error recording trade:', error.message);
      throw error;
    }
  }

  async updateTradeStatus(tradeId, status, confirmationData = {}) {
    if (!this.isInitialized) await this.initialize();
    
    try {
      await this.db.updateTradeStatus(tradeId, status, confirmationData);
      console.log(`📊 Trade ${tradeId} status updated to: ${status}`);
    } catch (error) {
      console.error('❌ Error updating trade status:', error.message);
      throw error;
    }
  }

  async getUserTrades(telegramId, chain = null, limit = 100) {
    if (!this.isInitialized) await this.initialize();
    
    try {
      const user = await this.getUser(telegramId);
      if (!user) {
        return [];
      }

      const trades = await this.db.getUserTrades(user.id, chain, limit);
      return trades;
      
    } catch (error) {
      console.error('❌ Error getting user trades:', error.message);
      return [];
    }
  }

  // =====================================================
  // TRANSFER OPERATIONS
  // =====================================================

  async recordTransfer(telegramId, transferData) {
    if (!this.isInitialized) await this.initialize();
    
    try {
      const user = await this.getUser(telegramId);
      if (!user) {
        throw new Error('User not found');
      }

      // Get wallet ID
      const wallets = await this.db.getUserWallets(user.id, transferData.chain);
      const wallet = wallets.find(w => w.wallet_slot === transferData.walletSlot);
      
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      const transfer = await this.db.recordTransfer({
        userId: user.id,
        fromWalletId: wallet.id,
        chainId: transferData.chain,
        ...transferData
      });

      console.log(`💸 Transfer recorded: ${transfer.id}`);
      return transfer;
      
    } catch (error) {
      console.error('❌ Error recording transfer:', error.message);
      throw error;
    }
  }

  async updateTransferStatus(transferId, status, confirmationData = {}) {
    if (!this.isInitialized) await this.initialize();
    
    try {
      await this.db.updateTransferStatus(transferId, status, confirmationData);
      console.log(`💸 Transfer ${transferId} status updated to: ${status}`);
    } catch (error) {
      console.error('❌ Error updating transfer status:', error.message);
      throw error;
    }
  }

  async getUserTransfers(telegramId, chain = null, limit = 100) {
    if (!this.isInitialized) await this.initialize();
    
    try {
      const user = await this.getUser(telegramId);
      if (!user) {
        return [];
      }

      const transfers = await this.db.getUserTransfers(user.id, chain, limit);
      return transfers;
      
    } catch (error) {
      console.error('❌ Error getting user transfers:', error.message);
      return [];
    }
  }

  // =====================================================
  // ANALYTICS AND REPORTING
  // =====================================================

  async getUserSummary(telegramId) {
    if (!this.isInitialized) await this.initialize();
    
    try {
      const user = await this.getUser(telegramId);
      if (!user) {
        return null;
      }

      const summary = await this.db.getUserSummary(user.id);
      return summary;
      
    } catch (error) {
      console.error('❌ Error getting user summary:', error.message);
      return null;
    }
  }

  async getUserActivity(telegramId, limit = 50) {
    if (!this.isInitialized) await this.initialize();
    
    try {
      const user = await this.getUser(telegramId);
      if (!user) {
        return [];
      }

      const activity = await this.db.getUserActivity(user.id, limit);
      return activity;
      
    } catch (error) {
      console.error('❌ Error getting user activity:', error.message);
      return [];
    }
  }

  // =====================================================
  // MIGRATION FROM FILE-BASED STORAGE
  // =====================================================

  async migrateFromFileStorage(oldWalletManager) {
    if (!this.isInitialized) await this.initialize();
    
    try {
      console.log('🔄 Starting migration from file-based storage...');
      
      // Get all users from old storage
      const oldWallets = {};
      if (oldWalletManager.userWallets) {
        for (const [chatId, wallets] of oldWalletManager.userWallets.entries()) {
          oldWallets[chatId] = wallets;
        }
      }
      
      for (const [telegramId, userWallets] of Object.entries(oldWallets)) {
        try {
          // Create user
          const user = await this.createUser(parseInt(telegramId), {
            username: `user_${telegramId}`,
            first_name: 'Migrated User'
          });

          // Migrate wallets for each chain
          for (const [chain, chainWallets] of Object.entries(userWallets)) {
            for (const [walletSlot, walletData] of Object.entries(chainWallets)) {
              try {
                await this.db.createWallet(
                  user.id,
                  chain,
                  walletSlot,
                  walletData.address,
                  walletData.privateKey,
                  walletData.seedPhrase || null,
                  walletData.isImported || false
                );
                
                console.log(`✅ Migrated ${chain}/${walletSlot} for user ${telegramId}`);
              } catch (error) {
                console.error(`❌ Failed to migrate wallet ${chain}/${walletSlot}:`, error.message);
              }
            }
          }
          
          console.log(`✅ Migrated user ${telegramId}`);
        } catch (error) {
          console.error(`❌ Failed to migrate user ${telegramId}:`, error.message);
        }
      }
      
      console.log('✅ Migration completed!');
      
    } catch (error) {
      console.error('❌ Migration failed:', error.message);
      throw error;
    }
  }

  // =====================================================
  // CLEANUP AND MAINTENANCE
  // =====================================================

  async close() {
    if (this.db) {
      await this.db.close();
      this.isInitialized = false;
      console.log('💼 Database Wallet Manager closed');
    }
  }
}

module.exports = WalletDBManager;