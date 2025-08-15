/**
 * LOOTER.AI CLONE - CALLBACKS HANDLER
 * All button interactions exactly like Looter.ai
 * 🚀 UPDATED: Removed authentication - All users can now trade!
 */

const WalletUI = require('./wallet-ui');
const TradingUI = require('./trading-ui');
const BuyTokenUI = require('./buy-token-ui');

class Callbacks {
  constructor(bot, auth, walletManager, trading, userStates) {
    this.bot = bot;
    this.auth = auth;
    this.walletManager = walletManager;
    this.trading = trading;
    this.userStates = userStates;
    
    // UI helpers
    this.walletUI = new WalletUI(bot, walletManager, userStates);
    this.tradingUI = new TradingUI(bot, trading);
    this.buyTokenUI = new BuyTokenUI(bot, walletManager, trading.chainManager);
  }

  // Main callback handler
  async handle(callbackQuery) {
    const { data, from, message } = callbackQuery;
    const chatId = from.id;
    const messageId = message.message_id;

    try {
      // 🚀 REMOVED AUTHENTICATION - Allow all users to trade
      console.log(`🎉 User ${chatId} (${from?.username || 'unknown'}) accessing callback: ${data}`);

      // Auto-create user if doesn't exist
      await this.walletManager.ensureUserExists(chatId, from);

      console.log(`🔘 ========== CALLBACK RECEIVED ==========`);
      console.log(`🔘 Data: ${data}`);
      console.log(`🔘 From user: ${chatId}`);
      console.log(`🔘 Message ID: ${messageId}`);
      console.log(`🔘 =======================================`);
      
      // Route callbacks to appropriate handlers
      if (data === 'main_menu') {
        await this.handleMainMenu(chatId, messageId);
      }
      
      // Wallet management
      else if (data === 'wallets_menu') {
        await this.walletUI.showChainSelection(chatId, messageId);
      }
      else if (data.startsWith('chain_')) {
        const chain = data.replace('chain_', '');
        await this.walletUI.showWalletManagement(chatId, messageId, chain);
      }
      else if (data.startsWith('wallet_')) {
        await this.walletUI.handleWalletAction(callbackQuery);
      }
      
      // Trading
      else if (data === 'buy_menu') {
        await this.buyTokenUI.handleBuyTokenMenu(chatId, messageId);
      }
      else if (data.startsWith('buy_')) {
        await this.handleBuyAction(callbackQuery);
      }
      else if (data === 'sell_menu') {
        await this.handleSellMenu(chatId, messageId);
      }
      else if (data === 'snipe_menu') {
        await this.handleSnipeMenu(chatId, messageId);
      }
      else if (data === 'limit_menu') {
        await this.handleLimitMenu(chatId, messageId);
      }
      
      // Portfolio
      else if (data === 'portfolio_menu') {
        await this.handlePortfolio(chatId, messageId);
      }
      
      // Settings
      else if (data === 'settings_menu') {
        await this.handleSettings(chatId, messageId);
      }
      
      // Help
      else if (data === 'help_menu') {
        await this.handleHelp(chatId, messageId);
      }
      
      // Expert mode
      else if (data.startsWith('expert_')) {
        await this.handleExpertMode(callbackQuery);
      }
      
      // Unknown callback
      else {
        console.log('❓ Unknown callback received:', data);
        await this.handleUnknown(callbackQuery);
      }

      // Answer callback query
      await this.bot.answerCallbackQuery(callbackQuery.id);

    } catch (error) {
      console.error('❌ Callback error:', error.message);
      
      try {
        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: '❌ An error occurred. Please try again.',
          show_alert: false
        });
      } catch (answerError) {
        console.error('❌ Failed to answer callback query:', answerError.message);
      }
    }
  }

  // Handle main menu
  async handleMainMenu(chatId, messageId) {
    const welcomeMessage = 
      `🏠 **Looter.ai Clone - Main Menu**\n\n` +
      `🎯 **Ready to trade? Choose an option below:**\n\n` +
      `• 🔥 **Buy Token** - Instant token purchases\n` +
      `• 💸 **Sell Tokens** - Manage your positions\n` +
      `• 🎯 **Snipe Orders** - Catch new launches\n` +
      `• 📊 **Limit Orders** - Set target prices\n` +
      `• 💼 **Manage Wallets** - Your trading wallets\n` +
      `• 📈 **Portfolio** - Track your performance`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🔥 Buy Token', callback_data: 'buy_menu' },
          { text: '💸 Sell Tokens', callback_data: 'sell_menu' }
        ],
        [
          { text: '🎯 Snipe Orders', callback_data: 'snipe_menu' },
          { text: '📊 Limit Orders', callback_data: 'limit_menu' }
        ],
        [
          { text: '💼 Manage Wallets', callback_data: 'wallets_menu' },
          { text: '📈 Portfolio', callback_data: 'portfolio_menu' }
        ],
        [
          { text: '⚙️ Settings', callback_data: 'settings_menu' },
          { text: '🆘 Help', callback_data: 'help_menu' }
        ]
      ]
    };

    await this.bot.editMessageText(welcomeMessage, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  // Handle buy actions
  async handleBuyAction(callbackQuery) {
    await this.bot.answerCallbackQuery(callbackQuery.id, {
      text: '🔥 Buy token functionality powered by Enhanced Base Trading!',
      show_alert: true
    });
  }

  // Handle sell menu
  async handleSellMenu(chatId, messageId) {
    const message = 
      `💸 **Sell Tokens**\n\n` +
      `📊 **Your Positions:**\n` +
      `_No positions found_\n\n` +
      `💡 *Buy some tokens first to see positions here*`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🔄 Refresh', callback_data: 'sell_menu' },
          { text: '🔙 Back to Main Menu', callback_data: 'main_menu' }
        ]
      ]
    };

    await this.bot.editMessageText(message, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  // Handle snipe menu
  async handleSnipeMenu(chatId, messageId) {
    const message = 
      `🎯 **Snipe Orders**\n\n` +
      `🚀 **Active Snipe Orders:**\n` +
      `_No active snipe orders_\n\n` +
      `💡 *Create snipe orders to catch new token launches*`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '➕ Create Snipe', callback_data: 'snipe_create' },
          { text: '📋 View All', callback_data: 'snipe_view' }
        ],
        [
          { text: '🔙 Back to Main Menu', callback_data: 'main_menu' }
        ]
      ]
    };

    await this.bot.editMessageText(message, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  // Handle limit menu
  async handleLimitMenu(chatId, messageId) {
    const message = 
      `📊 **Limit Orders**\n\n` +
      `📈 **Active Limit Orders:**\n` +
      `_No active limit orders_\n\n` +
      `💡 *Set target prices for automatic trading*`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '➕ Create Limit Order', callback_data: 'limit_create' },
          { text: '📋 View All', callback_data: 'limit_view' }
        ],
        [
          { text: '🔙 Back to Main Menu', callback_data: 'main_menu' }
        ]
      ]
    };

    await this.bot.editMessageText(message, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  // Handle portfolio
  async handlePortfolio(chatId, messageId) {
    const message = 
      `📈 **Your Portfolio**\n\n` +
      `💰 **Total Value:** $0.00\n` +
      `📊 **P&L Today:** $0.00 (0%)\n` +
      `🎯 **Active Positions:** 0\n\n` +
      `🔄 **Recent Trades:**\n` +
      `_No trades yet_\n\n` +
      `💡 *Start trading to see your portfolio here*`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🔄 Refresh', callback_data: 'portfolio_menu' },
          { text: '📊 Detailed View', callback_data: 'portfolio_detailed' }
        ],
        [
          { text: '🔙 Back to Main Menu', callback_data: 'main_menu' }
        ]
      ]
    };

    await this.bot.editMessageText(message, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  // Handle settings
  async handleSettings(chatId, messageId) {
    const message = 
      `⚙️ **Bot Settings**\n\n` +
      `🔧 **Current Settings:**\n` +
      `• Default Chain: Base\n` +
      `• Slippage: 1.0%\n` +
      `• Gas Limit: 500,000\n` +
      `• MEV Protection: Enabled\n` +
      `• Auto Refresh: Enabled\n\n` +
      `💡 *Customize your trading experience*`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '⛓️ Default Chain', callback_data: 'settings_chain' },
          { text: '💧 Slippage', callback_data: 'settings_slippage' }
        ],
        [
          { text: '⛽ Gas Settings', callback_data: 'settings_gas' },
          { text: '🛡️ MEV Protection', callback_data: 'settings_mev' }
        ],
        [
          { text: '🔄 Auto Refresh', callback_data: 'settings_refresh' }
        ],
        [
          { text: '🔙 Back to Main Menu', callback_data: 'main_menu' }
        ]
      ]
    };

    await this.bot.editMessageText(message, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  // Handle help
  async handleHelp(chatId, messageId) {
    const message = 
      `🆘 **Looter.ai Clone - Help & Guide**\n\n` +
      `**🚀 Getting Started:**\n` +
      `1. Choose "Manage Wallets" to set up your trading wallets\n` +
      `2. Select a blockchain network\n` +
      `3. Generate or import wallets\n` +
      `4. Start trading with "Buy Token"\n\n` +
      `**💡 Expert Mode:**\n` +
      `Send: \`TOKEN_ADDRESS AMOUNT TIP\`\n` +
      `Example: \`0x1234...5678 0.1 0.01\`\n\n` +
      `**🔗 Supported Chains:**\n` +
      `Ethereum, Base, BSC, Arbitrum, Polygon, Avalanche, Solana, Blast, Optimism\n\n` +
      `**🛡️ Security:**\n` +
      `• Private keys stored securely\n` +
      `• MEV protection enabled\n` +
      `• Secure wallet management`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '📖 User Guide', callback_data: 'help_guide' },
          { text: '❓ FAQ', callback_data: 'help_faq' }
        ],
        [
          { text: '🔙 Back to Main Menu', callback_data: 'main_menu' }
        ]
      ]
    };

    await this.bot.editMessageText(message, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  // Handle expert mode
  async handleExpertMode(callbackQuery) {
    await this.bot.answerCallbackQuery(callbackQuery.id, {
      text: '🎯 Expert mode coming soon!',
      show_alert: true
    });
  }

  // Handle unknown callbacks
  async handleUnknown(callbackQuery) {
    const { data, from, message } = callbackQuery;
    const chatId = from.id;
    const messageId = message.message_id;

    console.log(`⚠️ Unknown callback: ${data} from user ${chatId}`);

    await this.bot.editMessageText(
      `🚧 **Feature Coming Soon!**\n\n` +
      `This feature is being developed and will be available soon.\n\n` +
      `Thank you for your patience!`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Back to Main Menu', callback_data: 'main_menu' }]
        ]
      }
    });
  }

  // Handle wallet import from user messages
  async handleWalletImport(msg) {
    const chatId = msg.chat.id;
    
    try {
      // Auto-create user if doesn't exist
      await this.walletManager.ensureUserExists(chatId, msg.from);
      
      // Forward to wallet UI handler
      await this.walletUI.handleWalletImport(msg);
      
    } catch (error) {
      console.error('❌ Wallet import error:', error.message);
      await this.bot.sendMessage(chatId, '❌ Wallet import failed. Please try again.');
    }
  }

  // Handle transfer message input
  async handleTransferMessage(msg) {
    const chatId = msg.chat.id;
    
    try {
      // Auto-create user if doesn't exist
      await this.walletManager.ensureUserExists(chatId, msg.from);
      
      await this.bot.sendMessage(chatId, '💸 Transfer functionality coming soon!');
      
    } catch (error) {
      console.error('❌ Transfer message error:', error.message);
    }
  }

  // Handle custom amount message
  async handleCustomAmountMessage(msg) {
    const chatId = msg.chat.id;
    
    try {
      // Auto-create user if doesn't exist
      await this.walletManager.ensureUserExists(chatId, msg.from);
      
      await this.bot.sendMessage(chatId, '💰 Custom amount functionality coming soon!');
      
    } catch (error) {
      console.error('❌ Custom amount error:', error.message);
    }
  }

  // Handle custom slippage input
  async handleCustomSlippageInput(msg) {
    const chatId = msg.chat.id;
    
    try {
      // Auto-create user if doesn't exist
      await this.walletManager.ensureUserExists(chatId, msg.from);
      
      await this.bot.sendMessage(chatId, '📊 Custom slippage functionality coming soon!');
      
    } catch (error) {
      console.error('❌ Custom slippage error:', error.message);
    }
  }
}

module.exports = Callbacks;