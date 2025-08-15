/**
 * LOOTER.AI CLONE - COMMANDS HANDLER
 * All bot commands exactly like Looter.ai
 * 🚀 UPDATED: Removed authentication - All users can now trade!
 */

class Commands {
  constructor(bot, auth, walletManager) {
    this.bot = bot;
    this.auth = auth;
    this.walletManager = walletManager;
  }

  // Handle /start command
  async handleStart(msg) {
    const chatId = msg.chat.id;
    
    try {
      // 🚀 REMOVED AUTHENTICATION - Allow all users to trade
      console.log(`🎉 New user accessing bot: ${chatId} (${msg.from?.username || 'unknown'})`);

      // Auto-create user in database (preserves original wallet generation flow)
      await this.walletManager.ensureUserExists(chatId, msg.from);

      // Don't auto-generate wallets - let users generate them manually

      // Send Looter.ai style welcome message
      const welcomeMessage = this.buildWelcomeMessage();
      const keyboard = this.buildMainMenuKeyboard();

      await this.bot.sendMessage(chatId, welcomeMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

      console.log(`✅ Start command handled for user ${chatId}`);

    } catch (error) {
      console.error('❌ Error in start command:', error.message);
      await this.bot.sendMessage(chatId, '❌ Something went wrong. Please try again.');
    }
  }

  // Handle /help command
  async handleHelp(msg) {
    const chatId = msg.chat.id;

    // 🚀 REMOVED AUTHENTICATION - Allow all users

    const helpMessage = 
      `🆘 **Looter.ai Clone - Help**\n\n` +
      `**Commands:**\n` +
      `• /start - Start the bot\n` +
      `• /help - Show this help\n` +
      `• /wallets - Quick wallet access\n\n` +
      `**Expert Mode:**\n` +
      `Send: \`TOKEN_ADDRESS AMOUNT TIP\`\n` +
      `Example: \`0x1234...5678 0.1 0.01\`\n\n` +
      `**Features:**\n` +
      `• Multi-chain trading (9 chains)\n` +
      `• 5 fresh wallets per chain\n` +
      `• MEV protection\n` +
      `• Snipe orders\n` +
      `• Limit orders\n` +
      `• Portfolio tracking`;

    await this.bot.sendMessage(chatId, helpMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🏠 Back to Main Menu', callback_data: 'main_menu' }]
        ]
      }
    });
  }

  // Handle /wallets command
  async handleWallets(msg) {
    const chatId = msg.chat.id;

    // 🚀 REMOVED AUTHENTICATION - Allow all users
    
    // Auto-create user if doesn't exist
    await this.walletManager.ensureUserExists(chatId, msg.from);

    // Show chain selection for wallet management
    const message = this.buildChainSelectionMessage();
    const keyboard = this.buildChainSelectionKeyboard();

    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  // Handle expert mode (detect token addresses)
  async handleExpertMode(msg) {
    const chatId = msg.chat.id;
    const text = msg.text;

    // 🚀 REMOVED AUTHENTICATION - Allow all users
    if (!text) {
      return;
    }

    // Skip if it's a command
    if (text.startsWith('/')) {
      return;
    }

    // Expert mode pattern: TOKEN_ADDRESS AMOUNT [TIP]
    const expertPattern = /^(0x[a-fA-F0-9]{40})\s+([\d.]+)(?:\s+([\d.]+))?$/;
    const match = text.match(expertPattern);

    if (match) {
      const [, tokenAddress, amount, tip] = match;
      
      // Auto-create user if doesn't exist
      await this.walletManager.ensureUserExists(chatId, msg.from);
      
      const confirmMessage = 
        `🎯 **Expert Mode Detected**\n\n` +
        `🪙 **Token:** \`${tokenAddress}\`\n` +
        `💰 **Amount:** ${amount} ETH\n` +
        `💸 **Tip:** ${tip || '0'} ETH\n\n` +
        `⚡ **Ready to execute trade?**`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '✅ Confirm Trade', callback_data: `expert_buy_${tokenAddress}_${amount}_${tip || '0'}` },
            { text: '❌ Cancel', callback_data: 'main_menu' }
          ],
          [
            { text: '📊 Analyze Token', callback_data: `token_info_${tokenAddress}` }
          ]
        ]
      };

      await this.bot.sendMessage(chatId, confirmMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    }
  }

  // Build welcome message (Looter.ai style)
  buildWelcomeMessage() {
    return `🤖 **Welcome to Looter.ai Clone!**\n\n` +
           `🎯 **The most advanced multi-chain trading bot**\n\n` +
           `✨ **Features:**\n` +
           `• 🔥 **Instant Buy/Snipe** - Lightning fast execution\n` +
           `• 💼 **5 Fresh Wallets** - Auto-generated per chain\n` +
           `• 🛡️ **MEV Protection** - Secure your trades\n` +
           `• 📊 **Limit Orders** - Set your target prices\n` +
           `• 💸 **Smart Selling** - Multi-wallet distribution\n` +
           `• 📈 **Portfolio Tracking** - Real-time P&L\n` +
           `• 🎯 **Expert Mode** - Advanced trading\n\n` +
           `🌐 **Supported Chains (9):**\n` +
           `🟣 Ethereum • 🔵 Base • 🟡 BSC • 🔷 Arbitrum\n` +
           `🟣 Polygon • 🔴 Avalanche • 🟢 Solana • 💥 Blast • 🔴 Optimism\n\n` +
           `🚀 **Choose an option below to get started!**`;
  }

  // Build main menu keyboard (Looter.ai style)
  buildMainMenuKeyboard() {
    return {
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
  }

  // Build chain selection message
  buildChainSelectionMessage() {
    return `⛓️ **Select Blockchain Network**\n\n` +
           `Choose which blockchain you want to manage wallets for:\n\n` +
           `🟣 **Ethereum** - The original blockchain\n` +
           `🔵 **Base** - Low fees, fast transactions\n` +
           `🟡 **BSC** - Binance Smart Chain\n` +
           `🔷 **Arbitrum** - Layer 2 scaling\n` +
           `🟣 **Polygon** - Ultra-low fees\n` +
           `🔴 **Avalanche** - High performance\n` +
           `🟢 **Solana** - Lightning fast\n` +
           `💥 **Blast** - Native yield\n` +
           `🔴 **Optimism** - Optimistic rollup\n\n` +
           `💡 *Each chain has separate wallet storage*`;
  }

  // Build chain selection keyboard
  buildChainSelectionKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: '🟣 Ethereum', callback_data: 'chain_ethereum' },
          { text: '🔵 Base', callback_data: 'chain_base' }
        ],
        [
          { text: '🟡 BSC', callback_data: 'chain_bsc' },
          { text: '🔷 Arbitrum', callback_data: 'chain_arbitrum' }
        ],
        [
          { text: '🟣 Polygon', callback_data: 'chain_polygon' },
          { text: '🔴 Avalanche', callback_data: 'chain_avalanche' }
        ],
        [
          { text: '🟢 Solana', callback_data: 'chain_solana' },
          { text: '💥 Blast', callback_data: 'chain_blast' }
        ],
        [
          { text: '🔴 Optimism', callback_data: 'chain_optimism' }
        ],
        [
          { text: '🔙 Back to Main Menu', callback_data: 'main_menu' }
        ]
      ]
    };
  }
}

module.exports = Commands;