/**
 * PREMIUM FEATURES MANAGER
 * Manages subscription tiers and premium features access
 * Determines execution speed, RPC endpoints, and advanced features
 */

class PremiumFeaturesManager {
  constructor(database) {
    this.db = database;
    
    // Subscription plans and pricing
    this.subscriptionPlans = {
      pro: {
        name: 'Pro Trader',
        price: 29.99,
        priceETH: null, // Dynamic based on ETH price
        duration: 30, // days
        tier: 'PRO_TIER',
        features: {
          executionSpeed: 'fast',
          rpcTier: 'premium',
          mevProtection: true,
          prioritySupport: true,
          advancedAnalytics: true,
          copyTrading: true,
          maxTradeSize: 50, // ETH
          gasOptimization: 'aggressive'
        },
        description: '3x faster trades with MEV protection'
      },
      whale: {
        name: 'Whale Trader', 
        price: 99.99,
        priceETH: null,
        duration: 30,
        tier: 'WHALE_TIER',
        features: {
          executionSpeed: 'lightning',
          rpcTier: 'enterprise',
          mevProtection: 'enterprise',
          prioritySupport: 'dedicated',
          advancedAnalytics: 'professional',
          copyTrading: true,
          apiAccess: true,
          customStrategies: true,
          maxTradeSize: 1000, // ETH
          gasOptimization: 'maximum',
          feeDiscount: 50 // 50% fee discount
        },
        description: '5x faster trades with enterprise protection + 50% fee discount'
      }
    };

    // Feature definitions
    this.featureMatrix = {
      FREE_TIER: {
        executionSpeed: 'standard',
        expectedTime: '5-10 seconds',
        rpcEndpoints: 'standard',
        gasStrategy: 'conservative',
        mevProtection: false,
        analytics: 'basic',
        support: 'community',
        maxTradeSize: 5, // ETH
        dailyTradeLimit: null, // unlimited
        features: []
      },
      PRO_TIER: {
        executionSpeed: 'fast',
        expectedTime: '2-4 seconds',
        rpcEndpoints: 'premium',
        gasStrategy: 'aggressive',
        mevProtection: true,
        analytics: 'advanced',
        support: 'priority',
        maxTradeSize: 50, // ETH
        dailyTradeLimit: null,
        features: ['MEV Protection', 'Priority Support', 'Advanced Analytics', 'Copy Trading']
      },
      WHALE_TIER: {
        executionSpeed: 'lightning',
        expectedTime: '1-2 seconds',
        rpcEndpoints: 'enterprise',
        gasStrategy: 'maximum',
        mevProtection: 'enterprise',
        analytics: 'professional',
        support: 'dedicated',
        maxTradeSize: 1000, // ETH
        dailyTradeLimit: null,
        features: ['Lightning Speed', 'Enterprise MEV', 'API Access', 'Custom Strategies', '50% Fee Discount']
      }
    };

    console.log('⭐ Premium Features Manager initialized');
    console.log(`📋 Plans available: ${Object.keys(this.subscriptionPlans).join(', ')}`);
  }

  // =====================================================
  // USER TIER MANAGEMENT
  // =====================================================

  async getUserTier(userId) {
    try {
      const user = await this.db.getUserByTelegramId ? 
        await this.db.getUserByTelegramId(userId) : 
        await this.db.query('SELECT id FROM users WHERE telegram_id = $1', [userId]);

      if (!user && !user.id) {
        return 'FREE_TIER';
      }

      const actualUserId = user.id || user.rows[0]?.id;
      const subscription = await this.db.getUserSubscription(actualUserId);
      
      if (!subscription || subscription.status !== 'active') {
        return 'FREE_TIER';
      }
      
      // Check if subscription is expired
      if (new Date() > new Date(subscription.end_date)) {
        await this.expireSubscription(subscription.id);
        return 'FREE_TIER';
      }
      
      return subscription.plan_type.toUpperCase() + '_TIER';

    } catch (error) {
      console.error('❌ Error getting user tier:', error.message);
      return 'FREE_TIER';
    }
  }

  async createSubscription(userId, planType, paymentData = {}) {
    try {
      const user = await this.db.getUserByTelegramId ? 
        await this.db.getUserByTelegramId(userId) : 
        await this.db.query('SELECT id FROM users WHERE telegram_id = $1', [userId]);

      if (!user && !user.id) {
        throw new Error('User not found');
      }

      const actualUserId = user.id || user.rows[0]?.id;
      const plan = this.subscriptionPlans[planType];
      
      if (!plan) {
        throw new Error(`Invalid plan type: ${planType}`);
      }

      const subscription = await this.db.createSubscription(
        actualUserId,
        planType,
        plan.duration,
        paymentData
      );

      console.log(`🎉 Created ${plan.name} subscription for user ${userId}`);
      return {
        success: true,
        subscription,
        plan,
        tier: plan.tier
      };

    } catch (error) {
      console.error('❌ Error creating subscription:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async expireSubscription(subscriptionId) {
    try {
      await this.db.expireSubscription(subscriptionId);
      console.log(`⏰ Subscription expired: ${subscriptionId}`);
      return true;
    } catch (error) {
      console.error('❌ Error expiring subscription:', error.message);
      return false;
    }
  }

  // =====================================================
  // FEATURE ACCESS CONTROL
  // =====================================================

  async getTradeSettings(userId) {
    try {
      const userTier = await this.getUserTier(userId);
      const settings = this.featureMatrix[userTier];
      
      console.log(`⚙️ Trade settings for ${userTier}: ${settings.executionSpeed} speed, ${settings.rpcEndpoints} RPC`);
      
      return {
        userTier,
        ...settings,
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('❌ Error getting trade settings:', error.message);
      return this.featureMatrix.FREE_TIER;
    }
  }

  async validateTradePermissions(userId, tradeAmount, tokenAddress) {
    try {
      const userTier = await this.getUserTier(userId);
      const settings = this.featureMatrix[userTier];
      
      const validation = {
        allowed: true,
        userTier,
        settings,
        warnings: [],
        restrictions: {}
      };

      // Check trade size limits
      if (tradeAmount > settings.maxTradeSize) {
        validation.warnings.push(`Trade size ${tradeAmount} ETH exceeds limit of ${settings.maxTradeSize} ETH for ${userTier}`);
        validation.restrictions.maxTradeSize = settings.maxTradeSize;
      }

      return validation;

    } catch (error) {
      console.error('❌ Error validating trade permissions:', error.message);
      return {
        allowed: true,
        userTier: 'FREE_TIER',
        settings: this.featureMatrix.FREE_TIER,
        warnings: ['Error checking permissions - defaulting to free tier'],
        restrictions: {}
      };
    }
  }

  // =====================================================
  // RPC & EXECUTION SETTINGS
  // =====================================================

  getRPCEndpoints(userTier) {
    const rpcConfig = {
      FREE_TIER: {
        endpoints: [
          'https://mainnet.base.org',
          'https://base.publicnode.com'
        ],
        timeout: 5000,
        concurrent: 1,
        description: 'Free public endpoints'
      },
      PRO_TIER: {
        endpoints: [
          'https://base-mainnet.g.alchemy.com/v2/' + (process.env.ALCHEMY_API_KEY_PREMIUM || 'demo'),
          'https://base-mainnet.infura.io/v3/' + (process.env.INFURA_API_KEY_PREMIUM || 'demo'),
          'https://rpc.ankr.com/base/' + (process.env.ANKR_API_KEY_PREMIUM || 'demo')
        ],
        timeout: 2000,
        concurrent: 3,
        description: 'Premium endpoints with higher rate limits'
      },
      WHALE_TIER: {
        endpoints: [
          'https://base-mainnet.g.alchemy.com/v2/' + (process.env.ALCHEMY_API_KEY_ENTERPRISE || 'demo'),
          'wss://base-mainnet.g.alchemy.com/v2/' + (process.env.ALCHEMY_API_KEY_ENTERPRISE || 'demo'),
          'https://base.llamarpc.com/' + (process.env.LLAMARPC_API_KEY || 'demo'),
          'https://base.drpc.org/' + (process.env.DRPC_API_KEY || 'demo')
        ],
        timeout: 1000,
        concurrent: 5,
        websocket: true,
        privateMempool: true,
        description: 'Enterprise endpoints with WebSocket and private mempool access'
      }
    };

    return rpcConfig[userTier] || rpcConfig.FREE_TIER;
  }

  getGasSettings(userTier, urgency = 'normal') {
    const gasConfig = {
      FREE_TIER: {
        normal: {
          strategy: 'conservative',
          baseFeeMultiplier: 1.1, // 10% above base
          priorityFeeGwei: 0.1,
          gasLimit: 200000
        }
      },
      PRO_TIER: {
        normal: {
          strategy: 'aggressive', 
          baseFeeMultiplier: 1.5, // 50% above base
          priorityFeeGwei: 2,
          gasLimit: 300000
        },
        urgent: {
          strategy: 'aggressive',
          baseFeeMultiplier: 2.0, // 100% above base
          priorityFeeGwei: 5,
          gasLimit: 400000
        }
      },
      WHALE_TIER: {
        normal: {
          strategy: 'maximum',
          baseFeeMultiplier: 2.0, // 100% above base
          priorityFeeGwei: 10,
          gasLimit: 500000
        },
        urgent: {
          strategy: 'maximum',
          baseFeeMultiplier: 3.0, // 200% above base - guaranteed inclusion
          priorityFeeGwei: 20,
          gasLimit: 600000
        }
      }
    };

    return gasConfig[userTier]?.[urgency] || gasConfig[userTier]?.normal || gasConfig.FREE_TIER.normal;
  }

  // =====================================================
  // SUBSCRIPTION PLANS & PRICING
  // =====================================================

  getSubscriptionPlans(ethPrice = 2200) {
    const plans = {};
    
    for (const [key, plan] of Object.entries(this.subscriptionPlans)) {
      plans[key] = {
        ...plan,
        priceETH: (plan.price / ethPrice).toFixed(6),
        savings: key === 'whale' ? 'Save 50% on trading fees!' : null
      };
    }

    return plans;
  }

  getPlanDetails(planType, ethPrice = 2200) {
    const plan = this.subscriptionPlans[planType];
    if (!plan) {
      return null;
    }

    const features = this.featureMatrix[plan.tier];
    
    return {
      ...plan,
      priceETH: (plan.price / ethPrice).toFixed(6),
      features: {
        ...features,
        detailedFeatures: plan.features
      }
    };
  }

  // =====================================================
  // FEATURE COMPARISON
  // =====================================================

  getFeatureComparison() {
    return {
      tiers: this.featureMatrix,
      plans: this.subscriptionPlans,
      comparison: {
        tradingAccess: {
          free: '✅ Full Access',
          pro: '✅ Full Access', 
          whale: '✅ Full Access'
        },
        executionSpeed: {
          free: '5-10 seconds',
          pro: '2-4 seconds (3x faster)',
          whale: '1-2 seconds (5x faster)'
        },
        tradeFees: {
          free: '0.3%',
          pro: '0.3% (same)',
          whale: '0.15% (50% discount)'
        },
        mevProtection: {
          free: '❌',
          pro: '✅ Advanced',
          whale: '✅ Enterprise'
        },
        support: {
          free: 'Community',
          pro: 'Priority 24/7',
          whale: 'Dedicated Manager'
        }
      }
    };
  }

  // =====================================================
  // USER DASHBOARD DATA
  // =====================================================

  async getUserDashboard(userId) {
    try {
      const userTier = await this.getUserTier(userId);
      const settings = await this.getTradeSettings(userId);
      
      // Get subscription info if premium
      let subscription = null;
      if (userTier !== 'FREE_TIER') {
        const user = await this.db.getUserByTelegramId ? 
          await this.db.getUserByTelegramId(userId) : 
          await this.db.query('SELECT id FROM users WHERE telegram_id = $1', [userId]);
        
        const actualUserId = user.id || user.rows[0]?.id;
        subscription = await this.db.getUserSubscription(actualUserId);
      }

      return {
        userTier,
        tierName: this.featureMatrix[userTier].executionSpeed,
        subscription,
        settings,
        features: this.featureMatrix[userTier].features,
        availableUpgrades: userTier === 'FREE_TIER' ? Object.keys(this.subscriptionPlans) : [],
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('❌ Error getting user dashboard:', error.message);
      return {
        userTier: 'FREE_TIER',
        error: error.message
      };
    }
  }
}

module.exports = PremiumFeaturesManager;