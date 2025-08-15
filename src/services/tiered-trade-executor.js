/**
 * TIERED TRADE EXECUTOR
 * Main trading engine that combines fee collection with tiered execution speeds
 * Everyone can trade, but premium users get faster execution and better features
 */

const { ethers } = require('ethers');
const UniversalFeeManager = require('./universal-fee-manager');
const PremiumFeaturesManager = require('./premium-features-manager');

class TieredTradeExecutor {
  constructor(database, chainManager) {
    this.db = database;
    this.chainManager = chainManager;
    this.feeManager = new UniversalFeeManager(database);
    this.featuresManager = new PremiumFeaturesManager(database);
    
    // Execution strategies based on tiers
    this.executionStrategies = {
      'standard': this.executeStandardTrade.bind(this),
      'fast': this.executeFastTrade.bind(this),
      'lightning': this.executeLightningTrade.bind(this)
    };

    // RPC providers cache
    this.rpcProviders = new Map();
    this.gasCache = new Map();
    this.CACHE_TTL = 5000; // 5 seconds

    console.log('⚡ Tiered Trade Executor initialized');
    console.log('🎯 Execution modes: standard (5-10s), fast (2-4s), lightning (1-2s)');
  }

  // =====================================================
  // MAIN TRADE EXECUTION ENTRY POINT
  // =====================================================

  async executeTrade(userId, tradeParams) {
    const startTime = Date.now();
    console.log(`\n🚀 ========== TRADE EXECUTION START ==========`);
    console.log(`👤 User: ${userId}`);
    console.log(`💰 Amount: ${tradeParams.amount} ETH`);
    console.log(`🎯 Token: ${tradeParams.tokenAddress}`);
    
    try {
      // 1. Get user tier and trading settings
      const [userTier, tradeSettings, permissions] = await Promise.all([
        this.featuresManager.getUserTier(userId),
        this.featuresManager.getTradeSettings(userId),
        this.featuresManager.validateTradePermissions(userId, tradeParams.amount, tradeParams.tokenAddress)
      ]);

      console.log(`🏷️ User Tier: ${userTier} (${tradeSettings.executionSpeed} speed)`);

      // 2. Validate permissions
      if (!permissions.allowed) {
        throw new Error(`Trade not allowed: ${permissions.warnings.join(', ')}`);
      }

      // 3. Process universal trade fee (EVERYONE pays this)
      const feeResult = await this.feeManager.processTradeWithFee(
        userId, 
        tradeParams.amount, 
        userTier,
        null, // tradeId will be set after execution
        {
          chainId: tradeParams.chain || 'base',
          tokenAddress: tradeParams.tokenAddress
        }
      );

      console.log(`💸 Fee processed: ${feeResult.feeAmount} ETH (${feeResult.feePercent}%)`);

      // 4. Execute trade using tier-specific strategy
      const executionResult = await this.executeWithTierStrategy({
        ...tradeParams,
        netAmount: feeResult.netAmount, // Trade with amount after fee
        userTier,
        settings: tradeSettings,
        feeInfo: feeResult
      });

      // 5. Update fee record with trade ID
      if (executionResult.success && executionResult.tradeId) {
        await this.feeManager.recordTradeRevenue({
          userId,
          tradeId: executionResult.tradeId,
          revenueType: 'trade_fee',
          amountEth: feeResult.feeAmount,
          feePercentage: feeResult.feePercent / 100,
          userTier,
          originalAmount: tradeParams.amount,
          chainId: tradeParams.chain || 'base',
          tokenAddress: tradeParams.tokenAddress,
          metadata: {
            executionTime: Date.now() - startTime,
            gasUsed: executionResult.gasUsed,
            txHash: executionResult.txHash,
            executionSpeed: tradeSettings.executionSpeed
          }
        });
      }

      const totalExecutionTime = Date.now() - startTime;
      console.log(`⚡ TRADE COMPLETED in ${totalExecutionTime}ms for ${userTier} user`);
      console.log(`🎉 ========== TRADE EXECUTION END ==========\n`);
      
      return {
        ...executionResult,
        feeInfo: feeResult,
        executionTime: totalExecutionTime,
        tier: userTier,
        tierName: tradeSettings.executionSpeed,
        features: tradeSettings.features
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`❌ TRADE FAILED after ${executionTime}ms:`, error.message);
      console.log(`💥 ========== TRADE EXECUTION FAILED ==========\n`);
      
      return {
        success: false,
        error: error.message,
        executionTime,
        tier: 'UNKNOWN'
      };
    }
  }

  // =====================================================
  // TIER-SPECIFIC EXECUTION STRATEGIES
  // =====================================================

  async executeWithTierStrategy(params) {
    const strategy = this.executionStrategies[params.settings.executionSpeed];
    if (!strategy) {
      throw new Error(`Unknown execution strategy: ${params.settings.executionSpeed}`);
    }

    console.log(`🎯 Executing ${params.settings.executionSpeed} trade strategy`);
    return await strategy(params);
  }

  async executeStandardTrade(params) {
    console.log(`📊 STANDARD EXECUTION (5-10 seconds)`);
    
    // Use free RPC endpoints
    const rpcConfig = this.featuresManager.getRPCEndpoints('FREE_TIER');
    const gasSettings = this.featuresManager.getGasSettings('FREE_TIER', 'normal');
    
    // Execute trade with conservative settings
    return await this.performTrade({
      ...params,
      rpcConfig,
      gasSettings,
      executionMode: 'conservative'
    });
  }

  async executeFastTrade(params) {
    console.log(`🚀 FAST EXECUTION (2-4 seconds)`);
    
    // Use premium RPC endpoints with parallel requests
    const rpcConfig = this.featuresManager.getRPCEndpoints('PRO_TIER');
    const gasSettings = this.featuresManager.getGasSettings('PRO_TIER', 'normal');
    
    // Execute with aggressive gas and MEV protection
    const result = await this.performTrade({
      ...params,
      rpcConfig,
      gasSettings,
      executionMode: 'aggressive',
      mevProtection: true,
      parallelRequests: true
    });

    result.premiumFeatures = ['MEV Protection', 'Premium RPC', 'Aggressive Gas'];
    return result;
  }

  async executeLightningTrade(params) {
    console.log(`⚡ LIGHTNING EXECUTION (1-2 seconds)`);
    
    // Use enterprise RPC endpoints with all optimizations
    const rpcConfig = this.featuresManager.getRPCEndpoints('WHALE_TIER');
    const gasSettings = this.featuresManager.getGasSettings('WHALE_TIER', 'urgent');
    
    // Execute with maximum optimizations
    const result = await this.performOptimizedTrade({
      ...params,
      rpcConfig,
      gasSettings,
      executionMode: 'maximum',
      mevProtection: 'enterprise',
      parallelRequests: true,
      preSignedTransactions: true,
      websocketConnection: true
    });

    result.premiumFeatures = ['Enterprise MEV', 'Pre-signed TX', 'WebSocket', 'Maximum Gas', '50% Fee Discount'];
    return result;
  }

  // =====================================================
  // ACTUAL TRADE EXECUTION METHODS
  // =====================================================

  async performTrade(params) {
    const startTime = Date.now();
    
    try {
      // Get provider based on RPC config
      const provider = await this.getProviderForTier(params.rpcConfig);
      
      // Get user wallet
      const wallet = await this.getUserWallet(params.userId, params.chain || 'base');
      if (!wallet) {
        throw new Error('No wallet found for user');
      }

      // Connect wallet to provider
      const connectedWallet = new ethers.Wallet(wallet.privateKey, provider);
      
      // Get current gas prices
      const gasSettings = await this.calculateGasSettings(provider, params.gasSettings);
      
      // Build transaction
      const txParams = await this.buildSwapTransaction({
        wallet: connectedWallet,
        tokenOut: params.tokenAddress,
        amountEth: params.netAmount,
        slippageBps: Math.floor((params.slippage || 1) * 100),
        gasSettings
      });

      console.log(`📝 Transaction built in ${Date.now() - startTime}ms`);

      // Execute transaction
      let txResult;
      if (params.mevProtection) {
        txResult = await this.executeWithMEVProtection(connectedWallet, txParams);
      } else {
        txResult = await connectedWallet.sendTransaction(txParams);
      }

      // Wait for confirmation
      const receipt = await txResult.wait();
      
      console.log(`✅ Transaction confirmed: ${receipt.transactionHash}`);
      
      return {
        success: true,
        txHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber,
        explorerUrl: `https://basescan.org/tx/${receipt.transactionHash}`,
        executionTime: Date.now() - startTime,
        mevProtected: !!params.mevProtection
      };

    } catch (error) {
      console.error(`❌ Trade execution failed:`, error.message);
      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime
      };
    }
  }

  async performOptimizedTrade(params) {
    // Enhanced version with all optimizations for whale tier
    const startTime = Date.now();
    
    try {
      console.log(`⚡ Using enterprise optimizations...`);
      
      // Use multiple providers in parallel for fastest response
      const providers = await this.getMultipleProviders(params.rpcConfig);
      
      // Pre-calculate everything in parallel
      const [wallet, gasSettings, tokenInfo] = await Promise.all([
        this.getUserWallet(params.userId, params.chain || 'base'),
        this.calculateOptimalGasSettings(providers[0], params.gasSettings),
        this.getTokenInfoCached(params.tokenAddress, providers[0])
      ]);

      if (!wallet) {
        throw new Error('No wallet found for user');
      }

      const connectedWallet = new ethers.Wallet(wallet.privateKey, providers[0]);
      
      // Build optimized transaction
      const txParams = await this.buildOptimizedSwapTransaction({
        wallet: connectedWallet,
        tokenOut: params.tokenAddress,
        tokenInfo,
        amountEth: params.netAmount,
        slippageBps: Math.floor((params.slippage || 1) * 100),
        gasSettings,
        urgentMode: true
      });

      console.log(`🚀 Optimized transaction built in ${Date.now() - startTime}ms`);

      // Execute with enterprise MEV protection
      const txResult = await this.executeWithEnterpriseMEV(connectedWallet, txParams, providers);
      
      // Fast confirmation tracking
      const receipt = await this.waitForFastConfirmation(txResult, providers);
      
      console.log(`⚡ Lightning execution completed: ${receipt.transactionHash}`);
      
      return {
        success: true,
        txHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber,
        explorerUrl: `https://basescan.org/tx/${receipt.transactionHash}`,
        executionTime: Date.now() - startTime,
        mevProtected: true,
        enterpriseFeatures: true,
        optimizationsUsed: ['Multi-Provider', 'Pre-signed TX', 'Enterprise MEV', 'Fast Confirmation']
      };

    } catch (error) {
      console.error(`❌ Lightning execution failed:`, error.message);
      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime
      };
    }
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  async getProviderForTier(rpcConfig) {
    const cacheKey = JSON.stringify(rpcConfig.endpoints);
    
    if (this.rpcProviders.has(cacheKey)) {
      return this.rpcProviders.get(cacheKey);
    }

    // Create provider based on tier
    let provider;
    if (rpcConfig.concurrent > 1) {
      // Use fastest responding provider for premium tiers
      provider = await this.createRacingProvider(rpcConfig);
    } else {
      // Use single provider for free tier
      provider = new ethers.providers.JsonRpcProvider({
        url: rpcConfig.endpoints[0],
        timeout: rpcConfig.timeout
      });
    }

    this.rpcProviders.set(cacheKey, provider);
    return provider;
  }

  async createRacingProvider(rpcConfig) {
    // Create a provider that races multiple endpoints for fastest response
    const providers = rpcConfig.endpoints.map(url => 
      new ethers.providers.JsonRpcProvider({
        url,
        timeout: rpcConfig.timeout
      })
    );

    // Return a proxy that races all providers for each call
    return {
      async call(method, params) {
        const promises = providers.map(async (provider, index) => {
          try {
            const result = await provider.send(method, params);
            console.log(`🏆 RPC ${index + 1} won the race`);
            return result;
          } catch (error) {
            throw new Error(`RPC ${index + 1}: ${error.message}`);
          }
        });

        return Promise.any(promises);
      },
      
      // Proxy other provider methods
      async getGasPrice() { return providers[0].getGasPrice(); },
      async getBlock(blockTag) { return providers[0].getBlock(blockTag); },
      async sendTransaction(signedTx) { return providers[0].sendTransaction(signedTx); }
    };
  }

  async getUserWallet(userId, chain) {
    try {
      // This should use the wallet manager from the main bot
      // For now, we'll create a mock implementation
      console.log(`🔍 Getting wallet for user ${userId} on ${chain}`);
      
      // In real implementation, this would call:
      // return await this.walletManager.getChainWallets(userId, chain);
      
      return null; // Placeholder - needs integration with wallet manager
      
    } catch (error) {
      console.error('❌ Error getting user wallet:', error.message);
      return null;
    }
  }

  async calculateGasSettings(provider, gasConfig) {
    const cacheKey = `gas-${gasConfig.strategy}`;
    const cached = this.gasCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.settings;
    }

    try {
      const [block, gasPrice] = await Promise.all([
        provider.getBlock('latest'),
        provider.getGasPrice()
      ]);

      const baseFee = block.baseFeePerGas || gasPrice;
      
      const settings = {
        maxFeePerGas: baseFee.mul(Math.floor(gasConfig.baseFeeMultiplier * 100)).div(100),
        maxPriorityFeePerGas: ethers.utils.parseUnits(gasConfig.priorityFeeGwei.toString(), 'gwei'),
        gasLimit: gasConfig.gasLimit,
        type: 2 // EIP-1559
      };

      this.gasCache.set(cacheKey, {
        settings,
        timestamp: Date.now()
      });

      console.log(`⛽ Gas settings: ${gasConfig.strategy} - ${ethers.utils.formatUnits(settings.maxFeePerGas, 'gwei')} gwei`);
      return settings;

    } catch (error) {
      console.error('❌ Error calculating gas settings:', error.message);
      // Fallback gas settings
      return {
        gasLimit: gasConfig.gasLimit,
        gasPrice: ethers.utils.parseUnits('1', 'gwei')
      };
    }
  }

  // Placeholder methods that need to be implemented based on your existing trading logic
  async buildSwapTransaction(params) {
    // This should integrate with your existing Base trading service
    console.log(`🔧 Building swap transaction...`);
    throw new Error('buildSwapTransaction needs to be implemented with your existing trading logic');
  }

  async executeWithMEVProtection(wallet, txParams) {
    console.log(`🛡️ Executing with MEV protection...`);
    // This would integrate with Flashbots or other MEV protection services
    return await wallet.sendTransaction(txParams);
  }

  // =====================================================
  // PUBLIC API METHODS
  // =====================================================

  async getTierInfo(userId) {
    const userTier = await this.featuresManager.getUserTier(userId);
    return this.featuresManager.getTierInfo(userTier);
  }

  async getFeePlan(userId, tradeAmount) {
    const userTier = await this.featuresManager.getUserTier(userId);
    return await this.feeManager.calculateTradeFee(tradeAmount, userTier);
  }

  getFeeStructure() {
    return this.feeManager.getFeeStructure();
  }
}

module.exports = TieredTradeExecutor;