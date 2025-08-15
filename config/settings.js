// Bot Configuration Settings
// Looter.ai compatible settings with enhanced features

require('dotenv').config();

const CONFIG = {
  // Telegram Bot Configuration
  TELEGRAM: {
    BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    ALLOWED_CHAT_IDS: process.env.ALLOWED_CHAT_IDS ? 
      process.env.ALLOWED_CHAT_IDS.split(',').filter(id => id.trim() !== '') : [],
    MAX_MESSAGE_LENGTH: 4096,
    CALLBACK_TIMEOUT: 30000, // 30 seconds
    POLLING_TIMEOUT: 10,
    WEBHOOK_URL: process.env.WEBHOOK_URL || null
  },

  // Wallet Configuration
  WALLETS: {
    DEFAULT_COUNT: 5, // Like Looter.ai - 5 fresh wallets
    MAX_WALLETS: 10,
    PRIVATE_KEY: process.env.PRIVATE_KEY,
    AUTO_DELETE_TIMEOUT: 30, // seconds for private key messages
    IMPORT_TIMEOUT: 10, // seconds for import instructions
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || 'default-key-change-in-production'
  },

  // Trading Configuration
  TRADING: {
    // Slippage settings (like Looter.ai)
    DEFAULT_SLIPPAGE: 5, // 5%
    MIN_SLIPPAGE: 0.1, // 0.1%
    MAX_SLIPPAGE: 50, // 50%
    AUTO_SLIPPAGE: true,
    
    // Gas settings
    DEFAULT_GAS_LIMIT: 300000,
    MAX_GAS_LIMIT: 1000000,
    PRIORITY_FEE_MULTIPLIER: 1.2,
    
    // Quick buy amounts (like Looter.ai)
    QUICK_BUY_AMOUNTS: [0.1, 0.2, 0.5, 1.0], // ETH amounts
    CUSTOM_AMOUNT_MIN: 0.001,
    CUSTOM_AMOUNT_MAX: 100,
    
    // MEV Protection
    MEV_PROTECTION: true,
    DYNAMIC_TIPPING: true,
    FIRST_BUNDLE_ONLY: false,
    
    // Multi-wallet trading
    MAX_CONCURRENT_TRADES: 5,
    TRADE_TIMEOUT: 300 // 5 minutes
  },

  // Snipe Orders (Looter.ai feature)
  SNIPING: {
    MAX_SNIPE_ORDERS: 50,
    DEFAULT_TIP: 0.01, // ETH
    MIN_TIP: 0.001,
    MAX_TIP: 10,
    
    // Safety settings
    DEFAULT_MAX_MARKET_CAP: 1000000, // $1M
    MIN_LIQUIDITY: 0.1, // ETH
    MAX_TRANSACTION_TAX: 25, // 25%
    
    // Auto-sell settings
    AUTO_SELL_ENABLED: false,
    AUTO_SELL_PERCENTAGE: 100, // 100% of tokens
    AUTO_SELL_PROFIT_TARGET: 200, // 200% profit
    
    // Advanced settings
    FIRST_BUNDLE_GUARANTEE: false,
    DYNAMIC_TIP_OPTIMIZATION: true,
    SNIPE_TIMEOUT: 3600 // 1 hour
  },

  // Limit Orders (Looter.ai feature)
  LIMIT_ORDERS: {
    MAX_LIMIT_ORDERS: 100,
    PRICE_CHECK_INTERVAL: 10, // seconds
    ORDER_TIMEOUT: 86400, // 24 hours
    MIN_ORDER_SIZE: 0.001, // ETH
    MAX_ORDER_SIZE: 1000, // ETH
    
    // Price tolerance
    PRICE_TOLERANCE: 0.5, // 0.5% tolerance for execution
    SLIPPAGE_BUFFER: 2 // 2% extra slippage for limit orders
  },

  // Token Information
  TOKENS: {
    CACHE_DURATION: 60000, // 1 minute
    PRICE_CACHE_DURATION: 30000, // 30 seconds
    AUTO_REFRESH_INTERVAL: 12, // 12 seconds (like Looter.ai)
    
    // API endpoints
    DEXSCREENER_API: 'https://api.dexscreener.com/latest/dex',
    COINGECKO_API: 'https://api.coingecko.com/api/v3',
    
    // Tax detection
    MAX_BUY_TAX: 25, // 25%
    MAX_SELL_TAX: 25, // 25%
    TAX_WARNING_THRESHOLD: 10 // 10%
  },

  // User Interface
  UI: {
    AUTO_REFRESH_ENABLED: true,
    AUTO_REFRESH_INTERVAL: 12, // seconds (like Looter.ai)
    MESSAGE_EDIT_TIMEOUT: 300, // 5 minutes
    BUTTON_TIMEOUT: 300, // 5 minutes
    
    // Pagination
    ITEMS_PER_PAGE: 5,
    MAX_PAGES: 20,
    
    // Formatting
    DECIMAL_PLACES: 6,
    CURRENCY_SYMBOL: '$',
    PERCENTAGE_DECIMALS: 2
  },

  // User Settings (Looter.ai feature)
  USER_SETTINGS: {
    DEFAULT_TIMEZONE: 0, // UTC
    DEFAULT_LANGUAGE: 'en',
    SUPPORTED_LANGUAGES: ['en', 'zh'],
    
    // Date formats
    DATE_FORMATS: [
      'DD/MM/YYYY HH:mm:ss',
      'MM/DD/YYYY HH:mm:ss',
      'YYYY-MM-DD HH:mm:ss'
    ],
    
    // Currency preferences
    SUPPORTED_CURRENCIES: ['USD', 'EUR', 'GBP', 'JPY'],
    DEFAULT_CURRENCY: 'USD'
  },

  // Trade History (Looter.ai feature)
  TRADE_HISTORY: {
    MAX_HISTORY_ENTRIES: 1000,
    EXPORT_FORMATS: ['json', 'csv'],
    P_AND_L_CALCULATION: true,
    
    // Statistics
    CALCULATE_WIN_RATE: true,
    CALCULATE_TOTAL_VOLUME: true,
    CALCULATE_TOTAL_PROFIT: true
  },

  // Referral System (Looter.ai feature)
  REFERRALS: {
    ENABLED: true,
    DIRECT_COMMISSION: 10, // 10% of trading fees
    SECOND_LAYER_COMMISSION: 1, // 1% of sub-referral fees
    MIN_WITHDRAWAL: 100, // $100 minimum
    
    // Tracking
    TRACK_REFERRAL_VOLUME: true,
    TRACK_REFERRAL_PROFITS: true,
    REFERRAL_LINK_EXPIRY: 2592000 // 30 days
  },

  // Security
  SECURITY: {
    RATE_LIMIT_ENABLED: true,
    MAX_REQUESTS_PER_MINUTE: 60,
    MAX_TRADES_PER_HOUR: 100,
    
    // Authorization
    REQUIRE_AUTHORIZATION: false, // Set to true in production
    ADMIN_CHAT_IDS: process.env.ADMIN_CHAT_IDS ? 
      process.env.ADMIN_CHAT_IDS.split(',').filter(id => id.trim() !== '') : [],
    
    // Data protection
    ENCRYPT_PRIVATE_KEYS: true,
    AUTO_DELETE_SENSITIVE: true,
    LOG_SENSITIVE_DATA: false
  },

  // Performance
  PERFORMANCE: {
    CACHE_ENABLED: true,
    CACHE_SIZE_LIMIT: 1000,
    CONCURRENT_REQUESTS: 10,
    REQUEST_TIMEOUT: 30000, // 30 seconds
    
    // Database
    AUTO_SAVE_INTERVAL: 30000, // 30 seconds
    BACKUP_INTERVAL: 3600000, // 1 hour
    MAX_LOG_SIZE: 10485760 // 10MB
  },

  // Expert Mode (Looter.ai feature)
  EXPERT_MODE: {
    ENABLED: true,
    INSTANT_EXECUTION: true,
    SKIP_CONFIRMATIONS: true,
    
    // Format: TOKEN_ADDRESS AMOUNT [TIP]
    REGEX_PATTERN: /^(0x[a-fA-F0-9]{40})\s+([\d.]+)(?:\s+([\d.]+))?$/,
    
    // Safety limits
    MAX_INSTANT_BUY: 10, // ETH
    MAX_INSTANT_TIP: 1 // ETH
  },

  // Development
  DEVELOPMENT: {
    DEBUG_MODE: process.env.NODE_ENV === 'development',
    VERBOSE_LOGGING: process.env.VERBOSE_LOGGING === 'true',
    TEST_MODE: process.env.TEST_MODE === 'true',
    
    // Mock data
    USE_MOCK_PRICES: false,
    USE_MOCK_TRANSACTIONS: false,
    SIMULATE_TRADES: false
  }
};

// Environment-specific overrides
if (process.env.NODE_ENV === 'production') {
  CONFIG.SECURITY.REQUIRE_AUTHORIZATION = true;
  CONFIG.DEVELOPMENT.DEBUG_MODE = false;
  CONFIG.DEVELOPMENT.VERBOSE_LOGGING = false;
  CONFIG.WALLETS.AUTO_DELETE_TIMEOUT = 10; // Shorter in production
}

// Validation function
function validateConfig() {
  const errors = [];
  
  if (!CONFIG.TELEGRAM.BOT_TOKEN) {
    errors.push('TELEGRAM_BOT_TOKEN is required');
  }
  
  if (CONFIG.TRADING.DEFAULT_SLIPPAGE < CONFIG.TRADING.MIN_SLIPPAGE || 
      CONFIG.TRADING.DEFAULT_SLIPPAGE > CONFIG.TRADING.MAX_SLIPPAGE) {
    errors.push('DEFAULT_SLIPPAGE must be between MIN_SLIPPAGE and MAX_SLIPPAGE');
  }
  
  if (CONFIG.WALLETS.DEFAULT_COUNT > CONFIG.WALLETS.MAX_WALLETS) {
    errors.push('DEFAULT_COUNT cannot exceed MAX_WALLETS');
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
  
  return true;
}

// Helper functions
function getChainConfig(chainId) {
  const chains = require('./chains');
  return chains.getChain(chainId);
}

function isFeatureEnabled(feature) {
  const featureMap = {
    'referrals': CONFIG.REFERRALS.ENABLED,
    'expert_mode': CONFIG.EXPERT_MODE.ENABLED,
    'mev_protection': CONFIG.TRADING.MEV_PROTECTION,
    'auto_refresh': CONFIG.UI.AUTO_REFRESH_ENABLED,
    'rate_limiting': CONFIG.SECURITY.RATE_LIMIT_ENABLED
  };
  
  return featureMap[feature] || false;
}

function getQuickBuyAmounts() {
  return CONFIG.TRADING.QUICK_BUY_AMOUNTS;
}

function getAutoRefreshInterval() {
  return CONFIG.UI.AUTO_REFRESH_INTERVAL * 1000; // Convert to milliseconds
}

module.exports = {
  CONFIG,
  validateConfig,
  getChainConfig,
  isFeatureEnabled,
  getQuickBuyAmounts,
  getAutoRefreshInterval
};