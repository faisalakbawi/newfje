/**
 * LOOTER.AI CLONE - TRADING ENGINE
 * Core trading functionality for all chains
 * UPDATED: 1735703900000 - SMART SLIPPAGE ENABLED
 */

const ChainManager = require('../chains/chain-manager');

class Trading {
  constructor(bot, walletManager, baseTrading = null) {
    this.bot = bot;
    this.walletManager = walletManager;
    this.chainManager = new ChainManager();
    this.activeOrders = new Map(); // orderId -> order details
    this.tradeHistory = new Map(); // chatId -> trades[]
    
    // 💰 Fee collection service
    this.baseTrading = baseTrading;
    
    console.log('💰 Trading Engine initialized');
    console.log(`💰 BaseTrading service: ${this.baseTrading ? '✅ Available' : '❌ Not available'}`);
  }

  // Execute buy order
  async executeBuy(chatId, tokenAddress, amount, chain = 'base', options = {}) {
    try {
      console.log(`🚨🚨🚨 ========== TRADING.JS EXECUTEBUY CALLED ========== TIMESTAMP: ${Date.now()}`);
      console.log(`🚨🚨🚨 THIS IS THE MAIN TRADING ENTRY POINT - SMART SLIPPAGE WILL BE CALCULATED HERE`);
      console.log(`🔥 Executing buy: ${amount} ETH for ${tokenAddress} on ${chain}`);
      
      // Get user wallets for the chain
      const chainWallets = await this.walletManager.getChainWallets(chatId, chain);
      console.log(`🔍 Retrieved wallets for ${chain}:`, Object.keys(chainWallets));
      console.log(`🔍 Requested wallet slot: ${options.walletSlot}`);
      const walletAddresses = Object.values(chainWallets).map(w => w.address);
      
      if (walletAddresses.length === 0) {
        console.log(`❌ No wallets found for user ${chatId} on ${chain}`);
        throw new Error('No wallets available for trading');
      }
      
      console.log(`✅ Found ${walletAddresses.length} wallets for trading`);

      // Execute real trade using chain manager
      const trade = {
        id: this.generateTradeId(),
        type: 'buy',
        tokenAddress,
        amount: (amount && !isNaN(parseFloat(amount))) ? parseFloat(amount) : 0,
        chain,
        wallets: walletAddresses,
        timestamp: Date.now(),
        status: 'pending',
        txHash: null,
        gasUsed: 0,
        mevTip: options.tip || 0
      };

      // Add to trade history
      if (!this.tradeHistory.has(chatId)) {
        this.tradeHistory.set(chatId, []);
      }
      this.tradeHistory.get(chatId).push(trade);

      // Execute trade on the specific chain
      try {
        // Use the specific wallet slot if provided, otherwise use first available
        let walletToUse;
        console.log(`🔍 ========== WALLET SELECTION DEBUG ==========`);
        console.log(`   - User ID: ${chatId}`);
        console.log(`   - Chain: ${chain}`);
        console.log(`   - Requested slot: "${options.walletSlot}"`);
        console.log(`   - Available slots:`, Object.keys(chainWallets));
        console.log(`   - Slot exists:`, !!chainWallets[options.walletSlot]);
        
        // Show all available wallets
        Object.keys(chainWallets).forEach(slot => {
          const wallet = chainWallets[slot];
          console.log(`   - ${slot}: ${wallet.address} (imported: ${wallet.isImported})`);
        });
        
        if (options.walletSlot && chainWallets[options.walletSlot]) {
          walletToUse = chainWallets[options.walletSlot];
          console.log(`🎯 ✅ USING SELECTED WALLET ${options.walletSlot}: ${walletToUse.address}`);
          console.log(`🎯 ✅ WALLET IS IMPORTED: ${walletToUse.isImported}`);
        } else {
          walletToUse = Object.values(chainWallets)[0];
          const firstSlot = Object.keys(chainWallets)[0];
          console.log(`🎯 ❌ FALLBACK TO FIRST WALLET ${firstSlot}: ${walletToUse?.address}`);
          console.log(`⚠️  FALLBACK REASON: ${!options.walletSlot ? 'No slot specified' : 'Requested slot not found'}`);
          console.log(`⚠️  THIS IS THE PROBLEM - USER SELECTED DIFFERENT WALLET!`);
        }
        
        if (walletToUse && walletToUse.privateKey) {
          console.log(`🚀 Executing trade with wallet: ${walletToUse.address}`);
          
          console.log(`🚨🚨🚨 SMART SLIPPAGE DEBUG - TIMESTAMP: ${Date.now()}`);
          console.log(`🔧 DEBUG: About to start smart slippage calculation...`);
          console.log(`🔧 DEBUG: Current line after wallet message`);
          
          // 🔧 CRITICAL FIX: Apply smart slippage calculation
          let finalSlippage = options.slippage || 1.0;
          
          try {
            console.log(`🎯 Original slippage: ${finalSlippage}%`);
            console.log(`🔧 About to import TokenAnalyzer...`);
            
            // Import TokenAnalyzer for smart slippage
            const TokenAnalyzer = require('./token-analyzer');
            console.log(`✅ TokenAnalyzer imported successfully`);
            
            const tokenAnalyzer = new TokenAnalyzer(this.chainManager);
            console.log(`✅ TokenAnalyzer instance created`);
            
            // Analyze token liquidity to get smart slippage recommendation
            console.log(`🔍 Analyzing token: ${tokenAddress} on ${chain}`);
            const tokenAnalysis = await tokenAnalyzer.analyzeEVMToken(tokenAddress, chain);
            console.log(`✅ Token analysis completed:`, !!tokenAnalysis);
            
            if (tokenAnalysis) {
              console.log(`🔍 Analyzing liquidity conditions...`);
              const liquidityAnalysis = await tokenAnalyzer.analyzeLiquidityConditions(tokenAnalysis);
              console.log(`✅ Liquidity analysis completed`);
              
              const smartSlippage = tokenAnalyzer.getSmartSlippageRecommendation(liquidityAnalysis, amount);
              console.log(`✅ Smart slippage calculated: ${smartSlippage}%`);
              
              console.log(`🧠 Smart slippage recommendation: ${smartSlippage}%`);
              console.log(`📊 Liquidity category: ${liquidityAnalysis.liquidityCategory}`);
              console.log(`⚠️ Risk level: ${liquidityAnalysis.riskLevel}`);
              
              // Use smart slippage if it's higher than current slippage
              if (smartSlippage > finalSlippage) {
                console.log(`🔄 Upgrading slippage: ${finalSlippage}% -> ${smartSlippage}%`);
                finalSlippage = smartSlippage;
              } else {
                console.log(`✅ Current slippage ${finalSlippage}% is sufficient (smart: ${smartSlippage}%)`);
              }
            } else {
              console.log(`⚠️ Token analysis returned null - using original slippage`);
            }
          } catch (slippageError) {
            console.error('⚠️ Smart slippage calculation failed, using original:', slippageError.message);
            console.error('⚠️ Error stack:', slippageError.stack);
          }
          
          console.log(`🎯 Final slippage for trade: ${finalSlippage}%`);
          
          const result = await this.chainManager.executeBuy(
            chain, 
            walletToUse.privateKey, 
            tokenAddress, 
            amount, 
            finalSlippage
          );
          
          // Check if the buy was actually successful
          if (result.success) {
            trade.status = 'completed';
            trade.txHash = result.txHash;
            trade.gasUsed = result.gasUsed;
            trade.method = result.method || 'unknown';
            console.log(`✅ Trade completed: ${result.txHash} (${result.method})`);
          } else {
            // Buy failed - mark as failed
            trade.status = 'failed';
            trade.error = result.error || 'Buy execution failed';
            console.error(`❌ Trade failed: ${trade.error}`);
            throw new Error(trade.error);
          }
        } else {
          throw new Error(`Wallet ${options.walletSlot || 'first available'} not found or missing private key`);
        }
      } catch (error) {
        trade.status = 'failed';
        trade.error = error.message;
        console.error('❌ Trade execution failed:', error.message);
      }

      return trade;

    } catch (error) {
      console.error('❌ Buy execution error:', error.message);
      throw error;
    }
  }

  // Execute sell order
  async executeSell(chatId, tokenAddress, percentage, chain = 'base') {
    try {
      console.log(`💸 Executing sell: ${percentage}% of ${tokenAddress} on ${chain}`);
      
      // Get user positions (placeholder)
      const positions = this.getUserPositions(chatId, chain);
      const position = positions.find(p => p.tokenAddress === tokenAddress);
      
      if (!position) {
        throw new Error('No position found for this token');
      }

      const sellAmount = (position.amount * percentage) / 100;

      const trade = {
        id: this.generateTradeId(),
        type: 'sell',
        tokenAddress,
        amount: sellAmount,
        percentage,
        chain,
        timestamp: Date.now(),
        status: 'pending',
        txHash: null,
        gasUsed: 0
      };

      // Add to trade history
      if (!this.tradeHistory.has(chatId)) {
        this.tradeHistory.set(chatId, []);
      }
      this.tradeHistory.get(chatId).push(trade);

      // Simulate blockchain interaction
      await this.simulateBlockchainTrade(trade);

      return trade;

    } catch (error) {
      console.error('❌ Sell execution error:', error.message);
      throw error;
    }
  }

  // Create snipe order
  async createSnipeOrder(chatId, tokenAddress, amount, chain = 'base', options = {}) {
    try {
      const order = {
        id: this.generateOrderId(),
        type: 'snipe',
        chatId,
        tokenAddress,
        amount: parseFloat(amount),
        chain,
        options,
        status: 'active',
        createdAt: Date.now(),
        triggeredAt: null
      };

      this.activeOrders.set(order.id, order);
      
      console.log(`🎯 Snipe order created: ${order.id}`);
      return order;

    } catch (error) {
      console.error('❌ Snipe order error:', error.message);
      throw error;
    }
  }

  // Create limit order
  async createLimitOrder(chatId, tokenAddress, amount, targetPrice, type, chain = 'base') {
    try {
      const order = {
        id: this.generateOrderId(),
        type: 'limit',
        subType: type, // 'buy', 'sell', 'stop_loss', 'take_profit'
        chatId,
        tokenAddress,
        amount: parseFloat(amount),
        targetPrice: parseFloat(targetPrice),
        chain,
        status: 'active',
        createdAt: Date.now(),
        triggeredAt: null
      };

      this.activeOrders.set(order.id, order);
      
      console.log(`📊 Limit order created: ${order.id}`);
      return order;

    } catch (error) {
      console.error('❌ Limit order error:', error.message);
      throw error;
    }
  }

  // Get user trade history
  getUserTradeHistory(chatId) {
    return this.tradeHistory.get(chatId) || [];
  }

  // Get user active orders
  getUserActiveOrders(chatId) {
    const userOrders = [];
    for (const [orderId, order] of this.activeOrders.entries()) {
      if (order.chatId === chatId && order.status === 'active') {
        userOrders.push(order);
      }
    }
    return userOrders;
  }

  // Get user positions (placeholder)
  getUserPositions(chatId, chain) {
    // This would integrate with blockchain to get actual positions
    return [
      // Example position structure:
      // {
      //   tokenAddress: '0x...',
      //   symbol: 'TOKEN',
      //   amount: 1000,
      //   value: 100,
      //   pnl: 10,
      //   pnlPercentage: 10
      // }
    ];
  }

  // Cancel order
  async cancelOrder(orderId) {
    try {
      const order = this.activeOrders.get(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      order.status = 'cancelled';
      order.cancelledAt = Date.now();

      console.log(`❌ Order cancelled: ${orderId}`);
      return true;

    } catch (error) {
      console.error('❌ Cancel order error:', error.message);
      throw error;
    }
  }

  // Real blockchain trade execution via chain managers
  async simulateBlockchainTrade(trade) {
    console.log(`🚨 EXECUTING REAL TRADE via ${trade.chain} chain manager`);
    
    try {
      const chainInstance = this.chainManager.getChain(trade.chain);
      if (!chainInstance) {
        throw new Error(`Chain ${trade.chain} not supported`);
      }

      if (trade.type === 'buy') {
        // Get wallet for this trade
        const wallet = trade.wallets[0]; // Use first wallet for now
        const chainWallets = await this.walletManager.getChainWallets(trade.chatId, trade.chain);
        const walletData = chainWallets[Object.keys(chainWallets).find(slot => 
          chainWallets[slot].address.toLowerCase() === wallet.toLowerCase()
        )];
        
        if (!walletData || !walletData.privateKey) {
          throw new Error('Wallet not found or missing private key');
        }

        // Execute real buy via chain manager
        const result = await chainInstance.executeBuy(
          walletData.privateKey,
          trade.tokenAddress,
          trade.amount,
          trade.slippage || 1.0
        );

        trade.status = 'completed';
        trade.txHash = result.txHash;
        trade.gasUsed = result.gasUsed;
        trade.actualAmount = result.actualAmount;
        
        console.log(`✅ Real trade executed: ${result.txHash}`);
        return trade;
        
      } else if (trade.type === 'sell') {
        // Similar for sell trades
        const wallet = trade.wallets[0];
        const chainWallets = await this.walletManager.getChainWallets(trade.chatId, trade.chain);
        const walletData = chainWallets[Object.keys(chainWallets).find(slot => 
          chainWallets[slot].address.toLowerCase() === wallet.toLowerCase()
        )];
        
        if (!walletData || !walletData.privateKey) {
          throw new Error('Wallet not found or missing private key');
        }

        const result = await chainInstance.executeSell(
          walletData.privateKey,
          trade.tokenAddress,
          trade.amount
        );

        trade.status = 'completed';
        trade.txHash = result.txHash;
        trade.gasUsed = result.gasUsed;
        
        console.log(`✅ Real sell executed: ${result.txHash}`);
        return trade;
      }
      
    } catch (error) {
      console.error('❌ Real trade execution failed:', error.message);
      trade.status = 'failed';
      trade.error = error.message;
      throw error;
    }
  }

  // Generate unique trade ID
  generateTradeId() {
    return `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Generate unique order ID
  generateOrderId() {
    return `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Generate fake transaction hash
  generateTxHash() {
    return '0x' + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }

  // Get token price
  async getTokenPrice(tokenAddress, chain = 'base') {
    try {
      return await this.chainManager.getTokenPrice(chain, tokenAddress);
    } catch (error) {
      console.error('❌ Error getting token price:', error.message);
      throw error;
    }
  }

  // Get trading statistics
  getTradingStats(chatId) {
    const trades = this.getUserTradeHistory(chatId);
    const activeOrders = this.getUserActiveOrders(chatId);
    
    const stats = {
      totalTrades: trades.length,
      successfulTrades: trades.filter(t => t.status === 'completed').length,
      activeOrders: activeOrders.length,
      totalVolume: trades.reduce((sum, t) => sum + t.amount, 0),
      avgTradeSize: trades.length > 0 ? trades.reduce((sum, t) => sum + t.amount, 0) / trades.length : 0
    };

    return stats;
  }
}

module.exports = Trading;