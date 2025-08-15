/**
 * UNIVERSAL FEE MANAGER
 * Handles fee collection from ALL trades + subscription benefits
 * Everyone can trade, but we take a small fee from every transaction
 */

const axios = require('axios');

class UniversalFeeManager {
  constructor(database) {
    this.db = database;
    this.treasuryWallet = process.env.TREASURY_WALLET || '0x742d35Cc4Bd4E1C3a29c7c2F7b2C7A8D7E2C8E2F';
    
    // Fee structure based on user tiers
    this.fees = {
      FREE_TIER: {
        tradeFeePercent: 0.003,    // 0.3% per trade
        name: 'Free Trader',
        benefits: []
      },
      PRO_TIER: {
        tradeFeePercent: 0.003,    // Same 0.3% (subscription gives speed, not fee discount)
        name: 'Pro Trader',
        benefits: ['fast_execution', 'mev_protection', 'priority_support']
      },
      WHALE_TIER: {
        tradeFeePercent: 0.0015,   // 0.15% (50% discount as whale incentive)
        name: 'Whale Trader',
        benefits: ['lightning_execution', 'enterprise_mev', 'dedicated_support', 'api_access']
      }
    };

    // Price cache for ETH/USD conversion
    this.ethPriceCache = null;
    this.lastPriceUpdate = 0;
    this.PRICE_CACHE_TTL = 60000; // 1 minute cache

    console.log('💰 Universal Fee Manager initialized');
    console.log(`📈 Fee structure: FREE(0.3%), PRO(0.3%), WHALE(0.15%)`);
    console.log(`💳 Treasury wallet: ${this.treasuryWallet}`);
  }

  // =====================================================
  // CORE FEE PROCESSING
  // =====================================================

  async processTradeWithFee(userId, tradeAmount, userTier = 'FREE_TIER', tradeId = null, additionalData = {}) {
    try {
      const feeConfig = this.fees[userTier];
      const feeAmount = tradeAmount * feeConfig.tradeFeePercent;
      const netAmount = tradeAmount - feeAmount;
      
      console.log(`💰 TRADE FEE PROCESSING:`);
      console.log(`  👤 User: ${userId} (${feeConfig.name})`);
      console.log(`  💵 Original: ${tradeAmount} ETH`);
      console.log(`  🔢 Fee Rate: ${feeConfig.tradeFeePercent * 100}%`);
      console.log(`  💸 Fee Amount: ${feeAmount} ETH`);
      console.log(`  ✅ Net Amount: ${netAmount} ETH`);
      
      // Record revenue in database
      await this.recordTradeRevenue({
        userId,
        tradeId,
        revenueType: 'trade_fee',
        amountEth: feeAmount,
        feePercentage: feeConfig.tradeFeePercent,
        userTier,
        originalAmount: tradeAmount,
        chainId: additionalData.chainId || 'base',
        tokenAddress: additionalData.tokenAddress || null,
        metadata: {
          executionTime: additionalData.executionTime || null,
          gasUsed: additionalData.gasUsed || null,
          txHash: additionalData.txHash || null,
          timestamp: Date.now()
        }
      });

      return {
        success: true,
        originalAmount: tradeAmount,
        feeAmount,
        netAmount,
        feePercent: feeConfig.tradeFeePercent * 100,
        userTier,
        tierName: feeConfig.name,
        benefits: feeConfig.benefits
      };

    } catch (error) {
      console.error('❌ Error processing trade fee:', error.message);
      throw error;
    }
  }

  // Process fee but don't deduct from amount (for display purposes)
  async calculateTradeFee(tradeAmount, userTier = 'FREE_TIER') {
    const feeConfig = this.fees[userTier];
    const feeAmount = tradeAmount * feeConfig.tradeFeePercent;
    
    return {
      originalAmount: tradeAmount,
      feeAmount,
      feePercent: feeConfig.tradeFeePercent * 100,
      tierName: feeConfig.name
    };
  }

  // =====================================================
  // REVENUE TRACKING
  // =====================================================

  async recordTradeRevenue(revenueData) {
    try {
      // Get ETH price for USD conversion
      const ethPrice = await this.getETHPrice();
      const amountUsd = revenueData.amountEth * ethPrice;

      const revenue = await this.db.recordRevenue({
        userId: revenueData.userId,
        tradeId: revenueData.tradeId,
        revenueType: revenueData.revenueType,
        amountEth: revenueData.amountEth,
        amountUsd: amountUsd,
        feePercentage: revenueData.feePercentage,
        userTier: revenueData.userTier,
        originalAmount: revenueData.originalAmount,
        chainId: revenueData.chainId,
        tokenAddress: revenueData.tokenAddress,
        metadata: revenueData.metadata
      });

      console.log(`📊 Revenue recorded: ${revenueData.amountEth} ETH ($${amountUsd.toFixed(2)}) from ${revenueData.userTier}`);
      return revenue;

    } catch (error) {
      console.error('❌ Error recording trade revenue:', error.message);
      throw error;
    }
  }

  async recordSubscriptionRevenue(userId, subscriptionId, amount, currency, userTier) {
    try {
      // Convert to ETH if needed
      let amountEth = amount;
      if (currency === 'USD') {
        const ethPrice = await this.getETHPrice();
        amountEth = amount / ethPrice;
      } else if (currency === 'USDC') {
        const ethPrice = await this.getETHPrice();
        amountEth = amount / ethPrice; // Assuming 1 USDC = 1 USD
      }

      const revenue = await this.db.recordRevenue({
        userId,
        subscriptionId,
        revenueType: 'subscription',
        amountEth: amountEth,
        amountUsd: currency === 'USD' ? amount : amountEth * await this.getETHPrice(),
        userTier,
        metadata: {
          originalCurrency: currency,
          originalAmount: amount,
          timestamp: Date.now()
        }
      });

      console.log(`💳 Subscription revenue: ${amountEth} ETH from ${userTier}`);
      return revenue;

    } catch (error) {
      console.error('❌ Error recording subscription revenue:', error.message);
      throw error;
    }
  }

  // =====================================================
  // PRICE FETCHING
  // =====================================================

  async getETHPrice() {
    try {
      // Use cached price if recent
      if (this.ethPriceCache && Date.now() - this.lastPriceUpdate < this.PRICE_CACHE_TTL) {
        return this.ethPriceCache;
      }

      // Fetch fresh price
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
        params: {
          ids: 'ethereum',
          vs_currencies: 'usd'
        },
        timeout: 5000
      });

      const price = response.data.ethereum.usd;
      this.ethPriceCache = price;
      this.lastPriceUpdate = Date.now();

      console.log(`💲 ETH price updated: $${price}`);
      return price;

    } catch (error) {
      console.warn('⚠️ Failed to fetch ETH price, using fallback: $2200');
      // Fallback price if API fails
      return 2200;
    }
  }

  // =====================================================
  // ANALYTICS & REPORTING
  // =====================================================

  async getTotalRevenue(period = '30 days') {
    try {
      return await this.db.getTotalRevenue(period);
    } catch (error) {
      console.error('❌ Error getting total revenue:', error.message);
      return [];
    }
  }

  async getUserFeesStats(userId, period = '30 days') {
    try {
      const stats = await this.db.getUserRevenue(userId, period);
      
      const summary = {
        totalFeesPaid: 0,
        totalTradeVolume: 0,
        averageFeeRate: 0,
        tradeCount: 0
      };

      stats.forEach(stat => {
        if (stat.revenue_type === 'trade_fee') {
          summary.totalFeesPaid = parseFloat(stat.total_fees_paid_eth || 0);
          summary.tradeCount = parseInt(stat.transaction_count || 0);
        }
      });

      // Calculate average fee rate and estimated volume
      if (summary.totalFeesPaid > 0 && summary.tradeCount > 0) {
        summary.averageFeeRate = 0.3; // We know our fee rate
        summary.totalTradeVolume = summary.totalFeesPaid / 0.003; // Reverse calculate volume
      }

      return summary;

    } catch (error) {
      console.error('❌ Error getting user fees stats:', error.message);
      return { totalFeesPaid: 0, totalTradeVolume: 0, averageFeeRate: 0, tradeCount: 0 };
    }
  }

  async getRevenueDashboard() {
    try {
      return await this.db.getRevenueDashboard();
    } catch (error) {
      console.error('❌ Error getting revenue dashboard:', error.message);
      return {};
    }
  }

  // =====================================================
  // FEE STRUCTURE INFO
  // =====================================================

  getFeeStructure() {
    return {
      treasury: this.treasuryWallet,
      tiers: this.fees,
      philosophy: "Everyone can trade freely - we take a small fee to sustain the service",
      subscriptionBenefits: "Subscriptions unlock speed and protection, not fee discounts (except whales)"
    };
  }

  getTierInfo(userTier) {
    const config = this.fees[userTier];
    if (!config) {
      return this.fees.FREE_TIER;
    }
    
    return {
      tier: userTier,
      name: config.name,
      tradeFee: `${config.tradeFeePercent * 100}%`,
      benefits: config.benefits,
      description: this.getTierDescription(userTier)
    };
  }

  getTierDescription(userTier) {
    const descriptions = {
      FREE_TIER: "Full trading access with standard execution speed",
      PRO_TIER: "Full trading access with fast execution (2-4s) + MEV protection", 
      WHALE_TIER: "Full trading access with lightning execution (1-2s) + enterprise features + 50% fee discount"
    };
    
    return descriptions[userTier] || descriptions.FREE_TIER;
  }
}

module.exports = UniversalFeeManager;