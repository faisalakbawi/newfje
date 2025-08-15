#!/usr/bin/env node

/**
 * LOOTER.AI CLONE - MAIN BOT
 * Professional structure, clean code, secure and working
 * Exactly like Looter.ai interface and functionality
 */

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

// Import all components
const Config = require('./config/config');
const Auth = require('./auth/auth');
const ChainManager = require('./chains/chain-manager'); // NEW: For real balance fetching
const WalletDBManager = require('./database/wallet-db-manager'); // NEW: Database-powered wallet manager
const Commands = require('./commands/commands');
const Trading = require('./trading/trading');
const Callbacks = require('./callbacks/callbacks');
const UserStates = require('./utils/user-states');

// NEW: Base Trading Service with Fee Collection (canonical, fee-aware)
const BaseTrading = require('./src/services/base-trading');

// NEW: Monetization Services
const UniversalFeeManager = require('./src/services/universal-fee-manager');
const PremiumFeaturesManager = require('./src/services/premium-features-manager');
const FeeTransferManager = require('./src/services/fee-transfer-manager');

// NEW: DEX Aggregator for auto-discovery
const DexAggregator = require('./src/services/dex-aggregator');

class LooterBot {
  constructor() {
    console.log('🚀 Initializing Looter.ai Clone...');
    
    // Core bot with enhanced polling
    this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { 
      polling: {
        interval: 1000,    // Poll every 1 second
        autoStart: true,   // Start polling automatically
        params: {
          timeout: 10      // Long polling timeout
        }
      }
    });
    
    // Add polling event listeners with enhanced debugging
    this.bot.on('polling_error', (error) => {
      console.error('❌ Polling error:', error.code, error.message);
    });
    
    this.bot.on('error', (error) => {
      console.error('❌ Bot error:', error);
    });
    
    // Debug: Log all incoming updates
    this.bot.on('message', (msg) => {
      console.log(`📨 MESSAGE RECEIVED: ${msg.text || '[no text]'}`);
    });
    
    this.bot.on('callback_query', (query) => {
      console.log(`📞 CALLBACK RECEIVED AT BOT LEVEL: ${query.data || '[no data]'}`);
    });
    
    // Components
    this.config = new Config();
    this.auth = new Auth();
    this.chainManager = new ChainManager(); // NEW: For real balance fetching
    this.walletManager = new WalletDBManager(this.chainManager); // NEW: Using database wallet manager with chain manager
    this.userStates = new UserStates();
    this.commands = new Commands(this.bot, this.auth, this.walletManager);
    
    // NEW: Initialize Base Trading Service FIRST
    this.baseTrading = new BaseTrading();
    
    // Pass baseTrading service to Trading constructor
    this.trading = new Trading(this.bot, this.walletManager, this.baseTrading);
    
    this.callbacks = new Callbacks(this.bot, this.auth, this.walletManager, this.trading, this.userStates, this.chainManager);
    
    // NEW: Monetization Services (initialize after database)
    this.feeManager = null;
    this.featuresManager = null;
    
    this.isRunning = false;
  }

  async start() {
    try {
      console.log('🔧 Initializing database connection...');
      
      // Initialize database wallet manager
      await this.walletManager.initialize();
      console.log('✅ Database wallet manager initialized');
      
      // NEW: Initialize monetization services
      this.feeManager = new UniversalFeeManager(this.walletManager.db);
      this.featuresManager = new PremiumFeaturesManager(this.walletManager.db);
      this.feeTransferManager = new FeeTransferManager();
      console.log('💰 Monetization services initialized');
      
      // NEW: DEX Aggregator health check
      console.log('🔍 Checking DEX Aggregator health...');
      const dexHealth = await DexAggregator.healthCheck();
      if (dexHealth.healthy) {
        console.log(`✅ DEX Aggregator ready: ${dexHealth.summary}`);
      } else {
        console.warn(`⚠️ DEX Aggregator issues: ${dexHealth.error || 'Some DEXs unavailable'}`);
      }
      
      console.log('🔧 Setting up bot handlers...');
      
      // Setup command handlers
      this.setupCommands();
      
      // Setup callback handlers
      console.log('🔧 Callbacks object exists:', !!this.callbacks);
      console.log('🔧 Callbacks handle method exists:', typeof this.callbacks.handle);
      this.setupCallbacks();
      
      // Setup error handling
      this.setupErrorHandling();
      
      this.isRunning = true;
      
      console.log('✅ Looter.ai Clone Bot Started Successfully!');
      console.log('🎯 Features: Multi-chain trading, wallet management, sniping');
      console.log('🔍 Auto-Discovery: DEX, fee tier, slippage optimization');
      console.log('💎 Supported DEXs: Uniswap V3, Aerodrome, SushiSwap, BaseSwap, PancakeSwap');
      console.log('🗄️ Database: PostgreSQL with encrypted wallet storage');
      console.log('💡 Send /start to begin');
      
    } catch (error) {
      console.error('❌ Failed to start bot:', error.message);
      process.exit(1);
    }
  }

  setupCommands() {
    // /start command - Allow all users (no auth check)
    this.bot.onText(/\/start/, (msg) => {
      this.commands.handleStart(msg);
    });

    // /help command
    this.bot.onText(/\/help/, (msg) => {
      this.commands.handleHelp(msg);
    });

    // NEW: Trading help command
    this.bot.onText(/\/trading/, async (msg) => {
      await this.handleTradingHelp(msg);
    });

    // /wallets command
    this.bot.onText(/\/wallets/, (msg) => {
      this.commands.handleWallets(msg);
    });

    // NEW: Exec Buy commands
    this.bot.onText(/\/execbuy (.+) ([0-9.]+) ([0-9.]+) ?([0-9]+)?/, async (msg, match) => {
      await this.handleExecBuy(msg, match);
    });

    this.bot.onText(/\/quote (.+) ([0-9.]+) ?([0-9]+)?/, async (msg, match) => {
      await this.handleQuote(msg, match);
    });

    // NEW: Subscription and tier commands
    this.bot.onText(/\/tier/, async (msg) => {
      await this.handleTierInfo(msg);
    });

    this.bot.onText(/\/revenue/, async (msg) => {
      await this.handleRevenueStats(msg);
    });

    this.bot.onText(/\/treasury/, async (msg) => {
      await this.handleTreasuryStatus(msg);
    });

    // NEW: Test fee collection system
    this.bot.onText(/\/testfees/, async (msg) => {
      await this.handleTestFees(msg);
    });

    // Handle all messages (expert mode + wallet import)
    this.bot.on('message', (msg) => {
      console.log('📨 MESSAGE RECEIVED:', msg.text);
      this.handleMessage(msg);
    });
  }

  // Handle all incoming messages
  async handleMessage(msg) {
    const chatId = msg.chat.id;
    
    // Skip if it's a command (already handled by command handlers)
    if (msg.text && msg.text.startsWith('/')) {
      return;
    }
    
    // Check if user is in wallet import state
    if (this.userStates.isImporting(chatId)) {
      await this.callbacks.handleWalletImport(msg);
      return;
    }
    
    // Check if user is in transfer state
    if (this.userStates.isTransferring(chatId)) {
      await this.callbacks.handleTransferMessage(msg);
      return;
    }
    
    // Check if user is waiting for custom amount input
    if (this.userStates.isWaitingForCustomAmount(chatId)) {
      await this.callbacks.handleCustomAmountMessage(msg);
      return;
    }
    
    // Check if user is waiting for custom slippage input (both regular and reply messages)
    if (this.userStates.isAwaitingCustomSlippage(chatId)) {
      await this.callbacks.handleCustomSlippageInput(msg);
      return;
    }
    
    // Check if user is waiting for regular slippage input
    if (this.callbacks.buyTokenUI.isAwaitingSlippageInput(chatId)) {
      const state = this.callbacks.buyTokenUI.userStates.get(chatId);
      await this.callbacks.buyTokenUI.handleSlippageInput(msg, state.sessionId, state.messageId);
      return;
    }
    
    // Check if user is waiting for gas input
    if (this.callbacks.buyTokenUI.isAwaitingGasInput(chatId)) {
      const state = this.callbacks.buyTokenUI.userStates.get(chatId);
      await this.callbacks.buyTokenUI.handleGasInput(msg, state.sessionId, state.originalMessageId);
      return;
    }
    
    // Check if user is waiting for contract address (Buy Token flow)
    if (this.callbacks.buyTokenUI.isWaitingForContractAddress(chatId)) {
      await this.callbacks.buyTokenUI.handleContractAddress(msg);
      return;
    }
    
    // Auto-detect contract addresses (even without clicking Buy Token)
    if (this.isContractAddress(msg.text)) {
      await this.callbacks.buyTokenUI.handleContractAddress(msg);
      return;
    }
    
    // Handle expert mode (token detection)
    this.commands.handleExpertMode(msg);
  }

  // Check if text looks like a contract address
  isContractAddress(text) {
    if (!text) return false;
    
    // Clean the text - remove only whitespace, keep 0x prefix
    const cleanText = text.trim();
    
    // Ethereum/EVM contract address (0x + 40 hex characters)
    if (/^0x[a-fA-F0-9]{40}$/.test(cleanText)) {
      return true;
    }
    
    // Solana contract address (base58, 32-44 characters)
    // More flexible validation for Solana addresses
    if (cleanText.length >= 32 && cleanText.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(cleanText)) {
      return true;
    }
    
    return false;
  }

  // NEW: Handle Exec Buy command
  async handleExecBuy(msg, match) {
    const chatId = msg.chat.id;
    const tokenAddress = match[1].trim();
    const ethAmount = parseFloat(match[2]);
    const slippagePercent = parseFloat(match[3]);
    const feeTier = match[4] ? parseInt(match[4]) : 3000;

    try {
      console.log(`🚀 EXEC BUY: ${ethAmount} ETH -> ${tokenAddress} (${slippagePercent}% slippage)`);
      
      // Get user's active wallet
      const chainWallets = await this.walletManager.getChainWallets(chatId, 'base');
      const walletSlots = Object.keys(chainWallets);
      
      if (walletSlots.length === 0) {
        await this.bot.sendMessage(chatId, '❌ No wallets found. Please import a wallet first with /wallets');
        return;
      }

      // Use first available wallet
      const firstWallet = chainWallets[walletSlots[0]];
      if (!firstWallet.privateKey) {
        await this.bot.sendMessage(chatId, '❌ Wallet private key not available');
        return;
      }

      // NEW: Get user tier and process fee
      const userTier = await this.featuresManager.getUserTier(chatId);
      const tradeSettings = await this.featuresManager.getTradeSettings(chatId);
      
      // Process universal fee (everyone pays this)
      const feeResult = await this.feeManager.processTradeWithFee(
        chatId, 
        ethAmount, 
        userTier, 
        null,
        {
          chainId: 'base',
          tokenAddress: tokenAddress
        }
      );

      await this.bot.sendMessage(chatId, `🚀 **Executing Tiered Trade**\n\n` +
        `🎯 Token: \`${tokenAddress}\`\n` +
        `💰 Original: ${ethAmount} ETH\n` +
        `💸 Fee: ${feeResult.feeAmount} ETH (${feeResult.feePercent}%)\n` +
        `✅ Net: ${feeResult.netAmount} ETH\n` +
        `🏷️ Tier: ${feeResult.tierName}\n` +
        `⚡ Speed: ${tradeSettings.expectedTime}\n` +
        `🛡️ Slippage: ${slippagePercent}%\n` +
        `👤 Wallet: \`${firstWallet.address}\`\n\n` +
        `⏳ Processing with ${tradeSettings.executionSpeed} execution...`, { parse_mode: 'Markdown' });

      // Execute the buy using NEW tiered system with fees
      const result = await this.baseTrading.execBuyWithFeeV2({
        privateKey: firstWallet.privateKey,
        tokenOut: tokenAddress,
        amountEth: ethAmount, // Original amount
        slippageBps: Math.floor(slippagePercent * 100),
        feeTier: feeTier,
        userTier: userTier,
        feeInfo: feeResult,
        gasSettings: this.featuresManager.getGasSettings(userTier, 'normal')
      });

      if (result.success) {
        let message = `🎉 **TIERED TRADE SUCCESSFUL!**\n\n`;
        message += `📍 **Trade TX**: \`${result.txHash}\`\n`;
        message += `🪙 **Token**: ${result.tokenInfo.symbol} (${result.tokenInfo.name})\n`;
        message += `💰 **Original**: ${ethAmount} ETH\n`;
        message += `💸 **Fee Collected**: ${result.feeInfo.feeAmount} ETH (${result.feeInfo.feePercent}%)\n`;
        message += `✅ **Net Traded**: ${result.feeInfo.netAmount} ETH\n`;
        message += `🏷️ **Your Tier**: ${result.feeInfo.tierName}\n`;
        message += `⛽ **Gas Used**: ${result.gasUsed}\n`;
        message += `📊 **Block**: ${result.blockNumber}\n`;
        message += `🔗 **Trade**: [View on BaseScan](${result.explorerUrl})\n`;
        
        // Add fee transfer information
        if (result.feeTransfer) {
          if (result.feeTransfer.success && !result.feeTransfer.skipped) {
            message += `\n💳 **Fee Transfer**: SUCCESS\n`;
            message += `🏦 **Treasury**: \`${result.feeTransfer.treasuryWallet.slice(0,10)}...${result.feeTransfer.treasuryWallet.slice(-8)}\`\n`;
            message += `🔗 **Fee TX**: [View Fee Transfer](${result.feeTransfer.explorerUrl})\n`;
          } else if (result.feeTransfer.skipped) {
            message += `\n💰 **Fee**: ${result.feeTransfer.reason === 'below_minimum' ? 'Below minimum transfer' : 'Transfer skipped'}\n`;
          } else {
            message += `\n⚠️ **Fee Transfer**: Failed (trade still successful)\n`;
          }
        }
        
        message += `\n`;
        
        if (result.userTier === 'FREE_TIER') {
          message += `💡 **Want faster trades?** Upgrade to Pro for 3x speed!\n`;
          message += `⚡ Pro: 2-4 seconds + MEV protection ($29.99/month)\n`;
          message += `🚀 Whale: 1-2 seconds + 50% fee discount ($99.99/month)`;
        } else {
          message += `🌟 **Premium Features Active:**\n`;
          message += `• ${tradeSettings.expectedTime} execution speed\n`;
          if (tradeSettings.mevProtection) message += `• MEV Protection enabled\n`;
          if (result.userTier === 'WHALE_TIER') message += `• 50% fee discount applied\n`;
        }

        await this.bot.sendMessage(chatId, message, { 
          parse_mode: 'Markdown',
          disable_web_page_preview: true 
        });
      } else {
        let errorMessage = `❌ **TIERED TRADE FAILED**\n\n`;
        errorMessage += `🔧 **Error**: ${result.error}\n`;
        errorMessage += `🏷️ **Your Tier**: ${result.feeInfo?.tierName || 'Unknown'}\n\n`;
        errorMessage += `💡 **Try**: Different fee tier (500, 3000, 10000) or higher slippage`;
        
        await this.bot.sendMessage(chatId, errorMessage, { parse_mode: 'Markdown' });
      }

    } catch (error) {
      console.error('❌ Exec buy error:', error.message);
      await this.bot.sendMessage(chatId, `❌ Exec buy failed: ${error.message}`);
    }
  }

  // NEW: Handle Quote command
  async handleQuote(msg, match) {
    const chatId = msg.chat.id;
    const tokenAddress = match[1].trim();
    const ethAmount = parseFloat(match[2]);
    const feeTier = match[3] ? parseInt(match[3]) : 3000;

    try {
      console.log(`📊 QUOTE: ${ethAmount} ETH -> ${tokenAddress}`);
      
      await this.bot.sendMessage(chatId, `⏳ Getting quote for ${ethAmount} ETH...`);

      const tokenInfo = await this.baseTrading.getTokenInfo(tokenAddress);
      const quote = await this.baseTrading.quoteExactInputSingle(tokenAddress, ethAmount, feeTier);
      
      const { ethers } = require('ethers');
      const expectedFormatted = ethers.utils.formatUnits(quote.amountOut, tokenInfo.decimals);

      let message = `📊 **Quote Result**\n\n`;
      message += `🪙 **Token**: ${tokenInfo.symbol} (${tokenInfo.name})\n`;
      message += `💰 **Input**: ${ethAmount} ETH\n`;
      message += `📤 **Expected Output**: ${parseFloat(expectedFormatted).toFixed(6)} ${tokenInfo.symbol}\n`;
      message += `🏊 **Fee Tier**: ${feeTier / 10000}%\n`;
      message += `⛽ **Gas Estimate**: ${quote.gasEstimate.toString()}\n\n`;
      message += `💡 **To execute**: \`/execbuy ${tokenAddress} ${ethAmount} 1 ${feeTier}\``;

      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

    } catch (error) {
      console.error('❌ Quote error:', error.message);
      await this.bot.sendMessage(chatId, `❌ Quote failed: ${error.message}`);
    }
  }

  // NEW: Handle Trading Help command
  async handleTradingHelp(msg) {
    const chatId = msg.chat.id;

    const message = `🎯 **Tiered Trading System**\n\n` +
      `💰 **Everyone can trade! We take 0.3% fee from each trade**\n` +
      `🚀 **Subscriptions unlock speed & features, not trading access**\n\n` +
      `**📊 Commands:**\n` +
      `\`/quote <token> <eth> [tier]\` - Get price quote\n` +
      `\`/execbuy <token> <eth> <slip%> [tier]\` - Execute trade\n` +
      `\`/tier\` - View your tier & upgrade options\n` +
      `\`/treasury\` - Treasury status (admin only)\n\n` +
      `**🏷️ Trading Tiers:**\n` +
      `• **Free**: 0.3% fee, 5-10s execution, full access\n` +
      `• **Pro ($30/month)**: 0.3% fee, 2-4s execution, MEV protection\n` +
      `• **Whale ($100/month)**: 0.15% fee, 1-2s execution, enterprise features\n\n` +
      `**Example:**\n` +
      `\`/execbuy 0x36a...87d 0.01 1.5 3000\`\n` +
      `= Buy token with 0.01 ETH, 1.5% slippage, 0.3% fee tier\n\n` +
      `**Parameters:**\n` +
      `• Token: Contract address\n` +
      `• ETH: Amount to spend (before fee)\n` +
      `• Slippage: 1-50%\n` +
      `• Fee Tier: 500/3000/10000\n\n` +
      `**Setup:** Import wallet with /wallets first`;

    await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  }

  // NEW: Handle Tier Info command
  async handleTierInfo(msg) {
    const chatId = msg.chat.id;

    try {
      const userTier = await this.featuresManager.getUserTier(chatId);
      const tierInfo = this.feeManager.getTierInfo(userTier);
      const tradeSettings = await this.featuresManager.getTradeSettings(chatId);

      let message = `🏷️ **Your Trading Tier**\n\n`;
      message += `**Current Tier**: ${tierInfo.name}\n`;
      message += `**Trade Fee**: ${tierInfo.tradeFee}\n`;
      message += `**Execution Speed**: ${tradeSettings.expectedTime}\n`;
      message += `**RPC Endpoints**: ${tradeSettings.rpcEndpoints}\n`;
      message += `**MEV Protection**: ${tradeSettings.mevProtection ? '✅ Enabled' : '❌ Disabled'}\n\n`;

      if (userTier === 'FREE_TIER') {
        message += `**🚀 Upgrade Benefits:**\n`;
        message += `• **Pro Trader ($29.99/month)**:\n`;
        message += `  - 3x faster trades (2-4 seconds)\n`;
        message += `  - MEV protection enabled\n`;
        message += `  - Priority support\n`;
        message += `  - Advanced analytics\n\n`;
        message += `• **Whale Trader ($99.99/month)**:\n`;
        message += `  - 5x faster trades (1-2 seconds)\n`;
        message += `  - Enterprise MEV protection\n`;
        message += `  - 50% fee discount (0.15% vs 0.3%)\n`;
        message += `  - API access\n`;
        message += `  - Dedicated support\n\n`;
        message += `💡 Everyone can trade freely - subscriptions just add speed & features!`;
      } else {
        const userStats = await this.feeManager.getUserFeesStats(chatId);
        message += `**📊 Your Stats (30 days):**\n`;
        message += `• Trades: ${userStats.tradeCount}\n`;
        message += `• Fees Paid: ${userStats.totalFeesPaid.toFixed(6)} ETH\n`;
        message += `• Volume: ${userStats.totalTradeVolume.toFixed(4)} ETH\n`;
        message += `• Avg Fee: ${userStats.averageFeeRate}%\n\n`;
        message += `🌟 **Premium Features Active!**`;
      }

      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

    } catch (error) {
      console.error('❌ Error handling tier info:', error.message);
      await this.bot.sendMessage(chatId, '❌ Error getting tier information');
    }
  }

  // NEW: Handle Revenue Stats command (admin only)
  async handleRevenueStats(msg) {
    const chatId = msg.chat.id;

    try {
      // Simple admin check - you should replace this with proper admin auth
      if (chatId.toString() !== process.env.ADMIN_CHAT_ID && !process.env.ALLOWED_CHAT_IDS?.includes(chatId.toString())) {
        await this.bot.sendMessage(chatId, '❌ Admin access required');
        return;
      }

      const dashboard = await this.feeManager.getRevenueDashboard();
      
      let message = `📊 **Revenue Dashboard**\n\n`;
      
      if (dashboard.totalRevenue?.length > 0) {
        const total = dashboard.totalRevenue[0];
        message += `**Total Revenue (All Time):**\n`;
        message += `• ${parseFloat(total.total_eth || 0).toFixed(6)} ETH\n`;
        message += `• $${parseFloat(total.total_usd || 0).toFixed(2)} USD\n\n`;
      }

      if (dashboard.revenueByTier?.length > 0) {
        message += `**Revenue by Tier:**\n`;
        dashboard.revenueByTier.forEach(tier => {
          message += `• ${tier.user_tier}: ${parseFloat(tier.eth).toFixed(4)} ETH (${tier.transactions} trades)\n`;
        });
        message += `\n`;
      }

      if (dashboard.subscriptionStats?.length > 0) {
        message += `**Active Subscriptions:**\n`;
        dashboard.subscriptionStats.forEach(sub => {
          message += `• ${sub.plan_type}: ${sub.active_subs} users\n`;
        });
      }

      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

    } catch (error) {
      console.error('❌ Error handling revenue stats:', error.message);
      await this.bot.sendMessage(chatId, '❌ Error getting revenue statistics');
    }
  }

  // NEW: Handle Treasury Status command (admin only)
  async handleTreasuryStatus(msg) {
    const chatId = msg.chat.id;

    try {
      // Simple admin check
      if (chatId.toString() !== process.env.ADMIN_CHAT_ID && !process.env.ALLOWED_CHAT_IDS?.includes(chatId.toString())) {
        await this.bot.sendMessage(chatId, '❌ Admin access required');
        return;
      }

      console.log('💳 Getting treasury status...');

      // Get treasury validation and balance
      const [validation, treasuryBalance] = await Promise.all([
        this.feeTransferManager.validateTreasuryWallet(),
        this.feeTransferManager.getTreasuryBalance()
      ]);

      const config = this.feeTransferManager.getConfig();

      let message = `💳 **Treasury Wallet Status**\n\n`;
      
      // Wallet validation
      if (validation.valid) {
        message += `✅ **Status**: Valid and ready\n`;
        message += `🏦 **Address**: \`${validation.address}\`\n`;
        message += `💰 **Balance**: ${treasuryBalance.balance?.toFixed(6) || 'Error'} ETH\n`;
      } else {
        message += `❌ **Status**: ${validation.error}\n`;
        message += `🏦 **Address**: \`${config.treasuryWallet}\`\n`;
      }

      message += `\n**Configuration**:\n`;
      message += `🔄 Auto Transfer: ${config.autoTransfer ? '✅ Enabled' : '❌ Disabled'}\n`;
      message += `💵 Min Transfer: ${config.minTransferAmount} ETH\n`;
      message += `🎛️ Fee Collection: ${config.feeCollectionEnabled ? '✅ Active' : '❌ Disabled'}\n`;

      // Get recent revenue stats
      try {
        const dashboard = await this.feeManager.getRevenueDashboard();
        if (dashboard.totalRevenue?.length > 0) {
          const total = dashboard.totalRevenue[0];
          message += `\n**Total Fees Earned**:\n`;
          message += `💰 ${parseFloat(total.total_eth || 0).toFixed(6)} ETH\n`;
          message += `💵 $${parseFloat(total.total_usd || 0).toFixed(2)} USD\n`;
        }
      } catch (err) {
        message += `\n⚠️ Revenue stats unavailable`;
      }

      // Warning if treasury wallet is not configured
      if (!validation.valid || config.treasuryWallet === '0x742d35Cc4Bd4E1C3a29c7c2F7b2C7A8D7E2C8E2F') {
        message += `\n⚠️ **Action Required**: Update TREASURY_WALLET in .env to your wallet address!`;
      }

      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

    } catch (error) {
      console.error('❌ Error handling treasury status:', error.message);
      await this.bot.sendMessage(chatId, '❌ Error getting treasury status');
    }
  }

  // NEW: Test fee collection system directly
  async handleTestFees(msg) {
    const chatId = msg.chat.id;

    try {
      // Simple admin check
      if (chatId.toString() !== process.env.ADMIN_CHAT_ID && !process.env.ALLOWED_CHAT_IDS?.includes(chatId.toString())) {
        await this.bot.sendMessage(chatId, '❌ Admin access required');
        return;
      }

      console.log('🧪 Testing fee collection system directly...');

      // Get user's first wallet
      const chainWallets = await this.walletManager.getChainWallets(chatId, 'base');
      const walletSlots = Object.keys(chainWallets);
      
      if (walletSlots.length === 0) {
        await this.bot.sendMessage(chatId, '❌ No Base wallets found. Import a wallet first with /wallets');
        return;
      }

      const wallet = chainWallets[walletSlots[0]];
      if (!wallet.privateKey) {
        await this.bot.sendMessage(chatId, '❌ Wallet private key not found');
        return;
      }

      await this.bot.sendMessage(chatId, 
        `🧪 **TESTING FEE COLLECTION**\n\n` +
        `🏦 Using wallet: ${wallet.address.slice(0,10)}...${wallet.address.slice(-8)}\n` +
        `🪙 Token: TONY (0x36A947Baa2492C72Bf9D3307117237E79145A87d)\n` +
        `💰 Amount: 0.001 ETH\n` +
        `⏳ Executing test trade...`,
        { parse_mode: 'Markdown' }
      );

      // Execute test trade using our fee collection system
      const result = await this.baseTrading.tieredExecBuy(
        wallet.privateKey,
        '0x36A947Baa2492C72Bf9D3307117237E79145A87d', // TONY token
        0.001, // 0.001 ETH
        25, // 25% slippage for safety
        chatId, // User ID
        'standard' // Speed tier
      );

      if (result.success) {
        let message = `✅ **TEST TRADE SUCCESSFUL!**\n\n`;
        message += `📍 **Trade TX**: \`${result.txHash}\`\n`;
        message += `💰 **Original**: 0.001 ETH\n`;
        message += `💸 **Fee Collected**: ${result.feeInfo.feeAmount} ETH\n`;
        message += `✅ **Net Traded**: ${result.feeInfo.netAmount} ETH\n`;
        message += `🔗 **Trade**: [View on BaseScan](${result.explorerUrl})\n`;
        
        // Add fee transfer information
        if (result.feeTransfer) {
          if (result.feeTransfer.success && !result.feeTransfer.skipped) {
            message += `\n💳 **Fee Transfer**: SUCCESS ✅\n`;
            message += `🏦 **Treasury**: \`${result.feeTransfer.treasuryWallet.slice(0,10)}...${result.feeTransfer.treasuryWallet.slice(-8)}\`\n`;
            message += `🔗 **Fee TX**: [View Fee Transfer](${result.feeTransfer.explorerUrl})\n`;
            message += `\n🎉 **CHECK YOUR TREASURY WALLET - FEES SHOULD BE THERE!**`;
          } else if (result.feeTransfer.skipped) {
            message += `\n💰 **Fee**: Transfer skipped (${result.feeTransfer.reason})\n`;
          } else {
            message += `\n⚠️ **Fee Transfer**: Failed - ${result.feeTransfer.error}\n`;
          }
        }

        await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      } else {
        await this.bot.sendMessage(chatId, 
          `❌ **TEST TRADE FAILED**\n\n` +
          `Error: ${result.error}\n\n` +
          `Try again or check wallet balance.`,
          { parse_mode: 'Markdown' }
        );
      }

    } catch (error) {
      console.error('❌ Error testing fees:', error.message);
      await this.bot.sendMessage(chatId, `❌ Error testing fees: ${error.message}`);
    }
  }

  setupCallbacks() {
    this.bot.on('callback_query', async (callbackQuery) => {
      try {
        console.log('🎯 CALLBACK RECEIVED:', callbackQuery.data);
        console.log('🎯 Full callback object:', JSON.stringify(callbackQuery, null, 2));
        console.log('🎯 About to call this.callbacks.handle()...');
        console.log('🎯 Callbacks object exists:', !!this.callbacks);
        console.log('🎯 Callbacks handle method exists:', typeof this.callbacks.handle);
        await this.callbacks.handle(callbackQuery);
        console.log('🎯 Callbacks.handle() completed successfully');
      } catch (error) {
        console.error('❌ Callback handler error:', error);
        console.error('❌ Error stack:', error.stack);
      }
    });
  }

  setupErrorHandling() {
    this.bot.on('error', (error) => {
      console.error('❌ Bot error:', error.message);
    });

    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught exception:', error.message);
    });

    process.on('unhandledRejection', (error) => {
      console.error('❌ Unhandled rejection:', error.message);
    });
  }

  async stop() {
    if (this.isRunning) {
      this.bot.stopPolling();
      
      // Close database connection
      if (this.walletManager && this.walletManager.close) {
        await this.walletManager.close();
        console.log('🗄️ Database connection closed');
      }
      
      this.isRunning = false;
      console.log('🛑 Bot stopped');
    }
  }
}

// Start the bot
if (require.main === module) {
  const bot = new LooterBot();
  bot.start();

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await bot.stop();
    process.exit(0);
  });
}

module.exports = LooterBot;