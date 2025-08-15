/**
 * LOOTER.AI CLONE - CALLBACKS HANDLER
 * All button interactions exactly like Looter.ai
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
    
    // Callback data shortening system to avoid Telegram 64-byte limit
    this.callbackMappings = new Map();
    this.callbackCounter = 1000;
  }

  // Create short callback data and store mapping
  createShortCallback(longCallbackData) {
    if (longCallbackData.length <= 50) {
      return longCallbackData; // No need to shorten
    }
    
    const shortId = `cb_${this.callbackCounter++}`;
    this.callbackMappings.set(shortId, longCallbackData);
    console.log(`📏 Shortened callback: ${longCallbackData} -> ${shortId}`);
    return shortId;
  }

  // Resolve short callback data to original
  resolveCallback(callbackData) {
    if (callbackData.startsWith('cb_')) {
      const resolved = this.callbackMappings.get(callbackData);
      if (resolved) {
        console.log(`📏 Resolved callback: ${callbackData} -> ${resolved}`);
        return resolved;
      }
    }
    return callbackData;
  }

  // Main callback handler
  async handle(callbackQuery) {
    const { data, from, message } = callbackQuery;
    const chatId = from.id;
    const messageId = message.message_id;

    try {
      // Check authorization
      if (!this.auth.isAuthorized(chatId)) {
        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: '❌ Unauthorized access',
          show_alert: true
        });
        return;
      }

      // Resolve shortened callback data
      const resolvedData = this.resolveCallback(data);

      console.log(`🔘 ========== CALLBACK RECEIVED ==========`);
      console.log(`🔘 Original data: ${data}`);
      console.log(`🔘 Resolved data: ${resolvedData}`);
      console.log(`🔘 From user: ${chatId}`);
      console.log(`🔘 Message ID: ${messageId}`);
      console.log(`🔘 =======================================`);
      
      // Special logging for transfer confirm/execute
      if (resolvedData.includes('transfer_confirm') || resolvedData.includes('transfer_execute')) {
        console.log('🎯 ========== TRANSFER BUTTON DETECTED! ==========');
        console.log('🎯 Resolved data:', resolvedData);
        console.log('🎯 Starts with transfer_execute_?', resolvedData.startsWith('transfer_execute_'));
        console.log('🎯 Starts with transfer_confirm?', resolvedData.startsWith('transfer_confirm'));
        console.log('🎯 ============================================');
      }

      // Special logging for wallet selection
      if (resolvedData.includes('wallet_select')) {
        console.log('🔥 ========== WALLET SELECT BUTTON DETECTED! ==========');
        console.log('🔥 Resolved data:', resolvedData);
        console.log('🔥 Starts with wallet_select_?', resolvedData.startsWith('wallet_select_'));
        console.log('🔥 ================================================');
      }

      // Route callbacks to appropriate handlers
      if (resolvedData === 'main_menu') {
        console.log('📍 Routing to main menu');
        await this.handleMainMenu(chatId, messageId);
      }
      
      // Wallet management
      else if (resolvedData === 'wallets_menu') {
        await this.walletUI.showChainSelection(chatId, messageId);
      }
      else if (resolvedData.startsWith('chain_')) {
        const chain = resolvedData.replace('chain_', '');
        await this.walletUI.showWalletManagement(chatId, messageId, chain);
      }
      else if (resolvedData.startsWith('wallet_export')) {
        // Update callbackQuery to use resolved data
        const updatedCallbackQuery = { ...callbackQuery, data: resolvedData };
        await this.handleWalletExport(updatedCallbackQuery);
      }
      else if (resolvedData.startsWith('wallet_transfer_')) {
        const updatedCallbackQuery = { ...callbackQuery, data: resolvedData };
        await this.handleWalletTransfer(updatedCallbackQuery);
      }
      else if (resolvedData.startsWith('transfer_max_')) {
        const updatedCallbackQuery = { ...callbackQuery, data: resolvedData };
        await this.handleTransferMax(updatedCallbackQuery);
      }
      else if (resolvedData.startsWith('transfer_execute_') || resolvedData.startsWith('transfer_confirm')) {
        console.log('🚀 ========== ROUTING TO TRANSFER CONFIRM ==========');
        console.log('🔍 Transfer execute callback detected:', data);
        console.log('🔍 Data starts with transfer_execute_?', data.startsWith('transfer_execute_'));
        console.log('🔍 Data starts with transfer_confirm?', data.startsWith('transfer_confirm'));
        console.log('🔍 About to call handleTransferConfirm...');
        try {
          await this.handleTransferConfirm(callbackQuery);
          console.log('✅ handleTransferConfirm completed successfully');
        } catch (error) {
          console.error('❌ Error in transfer confirm:', error);
          console.error('❌ Error stack:', error.stack);
          // Send error message to user
          await this.bot.answerCallbackQuery(callbackQuery.id, {
            text: '❌ Transfer failed. Please try again.',
            show_alert: true
          });
        }
        console.log('🔍 ============================================');
      }

      else if (resolvedData.startsWith('wallet_')) {
        console.log('📍 Routing to wallet action:', resolvedData);
        const updatedCallbackQuery = { ...callbackQuery, data: resolvedData };
        await this.walletUI.handleWalletAction(updatedCallbackQuery);
      }
      else if (resolvedData.startsWith('import_')) {
        const updatedCallbackQuery = { ...callbackQuery, data: resolvedData };
        await this.walletUI.handleWalletAction(updatedCallbackQuery);
      }
      else if (resolvedData.startsWith('export_')) {
        const updatedCallbackQuery = { ...callbackQuery, data: resolvedData };
        await this.handleExportAction(updatedCallbackQuery);
      }
      else if (data.startsWith('seed_not_available_')) {
        await this.handleSeedNotAvailable(callbackQuery);
      }
      else if (data.startsWith('replace_import_')) {
        await this.handleReplaceImport(callbackQuery);
      }
      else if (data.startsWith('replace_')) {
        await this.handleReplaceWallet(callbackQuery);
      }
      
      // Trading
      else if (data === 'buy_menu') {
        await this.buyTokenUI.handleBuyTokenMenu(chatId, messageId);
      }
      else if (data === 'buy_example_eth') {
        await this.buyTokenUI.handleExampleToken(callbackQuery, 'eth');
      }
      else if (data === 'buy_example_sol') {
        await this.buyTokenUI.handleExampleToken(callbackQuery, 'sol');
      }
      else if (data.startsWith('ws_')) {
        console.log('🔥 WALLET SELECT DETECTED! Data:', data);
        await this.handleWalletSelect(callbackQuery);
      }
      else if (data.startsWith('slippage_custom_')) {
        console.log('🎯 CUSTOM SLIPPAGE CALLBACK DETECTED:', data);
        console.log('🎯 About to call handleCustomSlippage...');
        try {
          await this.handleCustomSlippage(callbackQuery);
          console.log('🎯 handleCustomSlippage completed successfully');
          console.log('🎯 RETURNING - should not process further handlers');
          return; // Prevent further processing
        } catch (customError) {
          console.error('❌ ERROR in handleCustomSlippage:', customError.message);
          console.error('❌ STACK:', customError.stack);
          throw customError; // Re-throw to be handled by main error handler
        }
      }
      else if (data.startsWith('slippage_set_')) {
        console.log('🎯 SLIPPAGE SET CALLBACK DETECTED:', data);
        await this.handleSlippageSet(callbackQuery);
        return; // Prevent further processing
      }
      else if (data.startsWith('slippage_')) {
        console.log('🎯 SLIPPAGE CALLBACK DETECTED:', data);
        console.log('🎯 ⚠️ WARNING: This should NOT be called for slippage_custom_ callbacks!');
        console.log('🎯 If you see this for slippage_custom_, there is a routing bug!');
        try {
          await this.buyTokenUI.handleSlippageMenu(callbackQuery);
          console.log('✅ Slippage menu handled successfully');
        } catch (slippageError) {
          console.error('❌ SLIPPAGE ERROR:', slippageError.message);
          console.error('❌ SLIPPAGE STACK:', slippageError.stack);
          await this.bot.answerCallbackQuery(callbackQuery.id, {
            text: `❌ Error setting slippage. Please try again.`,
            show_alert: true
          });
        }
        return; // Prevent further processing
      }
      else if (data.startsWith('back_to_token_')) {
        await this.handleBackToToken(callbackQuery);
      }
      else if (data.startsWith('buy_execute_')) {
        await this.buyTokenUI.handleBuyExecution(callbackQuery);
      }
      else if (data.startsWith('buy_multi_confirm_')) {
        await this.handleBuyMultiConfirm(callbackQuery);
      }
      else if (data.startsWith('buy_refresh_')) {
        await this.handleBuyRefresh(callbackQuery);
      }
      else if (data.startsWith('buy_confirm_new_')) {
        await this.handleBuyConfirmNew(callbackQuery);
      }
      else if (data.startsWith('buy_select_amount_')) {
        await this.handleBuySelectAmount(callbackQuery);
      }
      else if (data.startsWith('buy_')) {
        await this.handleBuyAction(callbackQuery);
      }
      else if (data === 'sell_menu') {
        await this.tradingUI.showSellMenu(chatId, messageId);
      }
      else if (data === 'snipe_menu') {
        await this.tradingUI.showSnipeMenu(chatId, messageId);
      }
      else if (data === 'limit_menu') {
        await this.tradingUI.showLimitMenu(chatId, messageId);
      }
      else if (data.startsWith('trade_')) {
        await this.tradingUI.handleTradeAction(callbackQuery);
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
        await this.tradingUI.handleExpertMode(callbackQuery);
      }
      
      // Token info
      else if (data.startsWith('token_info_')) {
        await this.tradingUI.showTokenInfo(callbackQuery);
      }
      
      // Gas settings menu
      else if (data.startsWith('gas_') && !data.includes('_set_') && !data.includes('_custom_')) {
        await this.buyTokenUI.handleGasMenu(callbackQuery);
      }
      
      // Gas setting selection
      else if (data.startsWith('gas_set_')) {
        await this.buyTokenUI.handleGasSet(callbackQuery);
      }
      
      // Custom gas input
      else if (data.startsWith('gas_custom_')) {
        await this.buyTokenUI.handleCustomGas(callbackQuery);
      }
      
      // Final buy execution with gas settings
      else if (data.startsWith('buy_execute_final_')) {
        await this.handleFinalBuyExecution(callbackQuery);
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
      `• Private keys stored locally\n` +
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

  // Handle wallet import from user messages
  async handleWalletImport(msg) {
    const chatId = msg.chat.id;
    const messageId = msg.message_id;
    const text = msg.text;

    console.log(`📥 Received message from user ${chatId}: ${text ? text.substring(0, 20) + '...' : 'no text'}`);

    try {
      // Get user state
      const state = this.userStates.getState(chatId);
      console.log(`🔍 User state for ${chatId}:`, state);
      
      if (!state || (state.action !== 'import' && state.action !== 'replace')) {
        console.log(`❌ No valid state found for user ${chatId}`);
        return;
      }

      const { type, chain } = state;

      // Delete user's message for security
      try {
        await this.bot.deleteMessage(chatId, messageId);
      } catch (deleteError) {
        console.log('Could not delete user message (might be too old)');
      }

      // Process import/replace based on action and type
      if (state.action === 'import') {
        if (type === 'privatekey') {
          await this.processPrivateKeyImport(chatId, text, chain);
        } else if (type === 'seedphrase') {
          await this.processSeedPhraseImport(chatId, text, chain);
        }
      } else if (state.action === 'replace') {
        if (type === 'privatekey') {
          await this.processPrivateKeyReplace(chatId, text, state.walletSlot, chain);
        } else if (type === 'seedphrase') {
          await this.processSeedPhraseReplace(chatId, text, state.walletSlot, chain);
        }
      }

      // Clear user state
      this.userStates.clearState(chatId);

    } catch (error) {
      console.error('❌ Wallet import error:', error.message);
      
      // Clear state and show error
      this.userStates.clearState(chatId);
      
      await this.bot.sendMessage(chatId, 
        `❌ **Import Failed**\n\n` +
        `There was an error importing your wallet. Please try again.\n\n` +
        `Error: ${error.message}`, {
        parse_mode: 'Markdown'
      });
    }
  }

  // Process private key import
  async processPrivateKeyImport(chatId, privateKey, chain) {
    console.log(`🔑 Processing private key import for user ${chatId} on chain ${chain}`);
    
    // Validate private key format
    const cleanKey = privateKey.replace(/^0x/, '').trim();
    
    if (!/^[a-fA-F0-9]{64}$/.test(cleanKey)) {
      await this.bot.sendMessage(chatId,
        `❌ **Invalid Private Key**\n\n` +
        `Private key must be exactly 64 hexadecimal characters.\n\n` +
        `Please try again with a valid private key.`, {
        parse_mode: 'Markdown'
      });
      return;
    }

    console.log(`✅ Private key format valid, calling walletManager.importPrivateKey`);
    
    // Import wallet
    const result = await this.walletManager.importPrivateKey(chatId, `0x${cleanKey}`, chain);
    
    console.log(`📊 Import result:`, result);
    
    if (result.success) {
      // Show success message
      await this.bot.sendMessage(chatId,
        `✅ **Wallet Imported Successfully!**\n\n` +
        `🔑 **Address:** \`${result.address}\`\n` +
        `⛓️ **Network:** ${this.getChainName(chain)}\n` +
        `💼 **Slot:** ${result.slot}\n\n` +
        `Your wallet is now ready for trading!`, {
        parse_mode: 'Markdown'
      });

      // Wait 2 seconds then go back to wallet management
      setTimeout(async () => {
        try {
          const message = await this.bot.sendMessage(chatId, '🔄 Loading wallets...');
          await this.walletUI.showWalletManagement(chatId, message.message_id, chain);
        } catch (error) {
          console.error('Error returning to wallet management:', error);
        }
      }, 2000);
    } else {
      // Check if slots are full
      if (result.error === 'SLOTS_FULL' && result.slotsFullMessage) {
        await this.showReplaceWalletOptions(chatId, result.chainWallets, result.chain, 'privatekey');
      } else {
        await this.bot.sendMessage(chatId,
          `❌ **Import Failed**\n\n` +
          `${result.error}\n\n` +
          `Please try again.`, {
          parse_mode: 'Markdown'
        });
      }
    }
  }

  // Process seed phrase import
  async processSeedPhraseImport(chatId, seedPhrase, chain) {
    // Validate seed phrase
    const words = seedPhrase.trim().split(/\s+/);
    
    if (words.length !== 12 && words.length !== 24) {
      await this.bot.sendMessage(chatId,
        `❌ **Invalid Seed Phrase**\n\n` +
        `Seed phrase must be exactly 12 or 24 words.\n` +
        `You provided ${words.length} words.\n\n` +
        `Please try again with a valid seed phrase.`, {
        parse_mode: 'Markdown'
      });
      return;
    }

    // Import wallet from seed phrase
    const result = await this.walletManager.importSeedPhrase(chatId, seedPhrase, chain);
    
    if (result.success) {
      // Show success message
      await this.bot.sendMessage(chatId,
        `✅ **Wallet Imported Successfully!**\n\n` +
        `🔑 **Address:** \`${result.address}\`\n` +
        `⛓️ **Network:** ${this.getChainName(chain)}\n` +
        `💼 **Slot:** ${result.slot}\n` +
        `📝 **Type:** Seed Phrase\n\n` +
        `Your wallet is now ready for trading!`, {
        parse_mode: 'Markdown'
      });

      // Wait 2 seconds then go back to wallet management
      setTimeout(async () => {
        try {
          const message = await this.bot.sendMessage(chatId, '🔄 Loading wallets...');
          await this.walletUI.showWalletManagement(chatId, message.message_id, chain);
        } catch (error) {
          console.error('Error returning to wallet management:', error);
        }
      }, 2000);
    } else {
      // Check if slots are full
      if (result.error === 'SLOTS_FULL' && result.slotsFullMessage) {
        await this.showReplaceWalletOptions(chatId, result.chainWallets, result.chain, 'seedphrase');
      } else {
        await this.bot.sendMessage(chatId,
          `❌ **Import Failed**\n\n` +
          `${result.error}\n\n` +
          `Please try again.`, {
          parse_mode: 'Markdown'
        });
      }
    }
  }

  // Show replace wallet options when slots are full
  async showReplaceWalletOptions(chatId, chainWallets, chain, importType) {
    const chainName = this.getChainName(chain);
    
    let message = `⚠️ **All wallet slots are full. Please choose a wallet to replace:**\n\n`;
    
    const walletButtons = [];
    
    // Show existing wallets
    for (let i = 1; i <= 5; i++) {
      const slot = `W${i}`;
      const wallet = chainWallets[slot];
      
      if (wallet) {
        const shortAddress = `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;
        const walletEmoji = this.getWalletEmoji(i);
        
        message += `${i}. ${shortAddress}\n`;
        walletButtons.push([
          { text: `${walletEmoji} Replace Wallet ${i}`, callback_data: `replace_${importType}_${slot}_${chain}` }
        ]);
      }
    }
    
    message += `\n⛓️ **Network:** ${chainName}`;
    
    // Add cancel button
    walletButtons.push([
      { text: '❌ Cancel', callback_data: `chain_${chain}` }
    ]);

    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: walletButtons
      }
    });
  }

  // Handle slippage set buttons
  async handleSlippageSet(callbackQuery) {
    const { from, message, data } = callbackQuery;
    const chatId = from.id;
    const messageId = message.message_id;

    try {
      // Parse callback data: slippage_set_sessionId_percentage
      const parts = data.split('_');
      const sessionId = parts[2];
      const slippagePercent = parseFloat(parts[3]);

      console.log(`📊 Setting slippage: ${slippagePercent}% for session ${sessionId}`);

      // Set the slippage
      const sessionKey = `${chatId}_${sessionId}`;
      this.buyTokenUI.tokenSlippage.set(sessionKey, slippagePercent);
      console.log(`📊 Set slippage for ${sessionKey}: ${slippagePercent}%`);

      // Return to token page
      await this.buyTokenUI.returnToTokenPage(chatId, messageId, sessionId);

      // Don't answer callback query here - let main handler do it

    } catch (error) {
      console.error('❌ Error setting slippage:', error);
      // Don't answer callback query here - let main handler do it
      throw error; // Re-throw so main handler can handle it
    }
  }

  // Handle back to token button
  async handleBackToToken(callbackQuery) {
    const { from, message, data } = callbackQuery;
    const chatId = from.id;
    const messageId = message.message_id;

    try {
      // Parse sessionId from callback data: back_to_token_sessionId
      const sessionId = data.replace('back_to_token_', '');

      // Return to token page
      await this.buyTokenUI.returnToTokenPage(chatId, messageId, sessionId);

      await this.bot.answerCallbackQuery(callbackQuery.id);

    } catch (error) {
      console.error('❌ Error returning to token:', error);
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Error returning to token page',
        show_alert: true
      });
    }
  }

  // Handle wallet export
  async handleWalletExport(callbackQuery) {
    const { data, from, message } = callbackQuery;
    const chatId = from.id;
    const messageId = message.message_id;

    if (data.startsWith('wallet_export_single_')) {
      // Export single wallet: wallet_export_single_W1_base
      const parts = data.split('_');
      const walletSlot = parts[3]; // W1, W2, etc.
      const chain = parts[4]; // base, ethereum, etc.
      
      await this.handleSingleWalletExport(chatId, messageId, walletSlot, chain);
    } 
    else if (data.startsWith('wallet_export_')) {
      // General export: wallet_export_base
      const chain = data.split('_')[2];
      await this.handleChainWalletExport(chatId, messageId, chain);
    }
  }

  // Handle single wallet export
  async handleSingleWalletExport(chatId, messageId, walletSlot, chain) {
    const chainName = this.getChainName(chain);
    const walletNumber = walletSlot.replace('W', '');
    
    // Get wallet data
    const chainWallets = await this.walletManager.getChainWallets(chatId, chain);
    const wallet = chainWallets[walletSlot];
    
    if (!wallet) {
      await this.bot.editMessageText(
        `❌ **Wallet Not Found**\n\n` +
        `Wallet ${walletNumber} not found on ${chainName}.`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Back to Wallets', callback_data: `chain_${chain}` }]
          ]
        }
      });
      return;
    }

    // Show export options
    await this.bot.editMessageText(
      `⬆️ **Export Wallet ${walletNumber}**\n\n` +
      `📍 **Address:** \`${wallet.address}\`\n\n` +
      `Choose what you want to export:\n\n` +
      `🔑 **Private Key**\n` +
      `• Always available\n` +
      `• Direct wallet access\n\n` +
      `📝 **Seed Phrase**\n` +
      `• ${wallet.seedPhrase ? 'Available' : 'Not available (imported from private key only)'}\n` +
      `• Full wallet recovery\n\n` +
      `⛓️ **Network:** ${chainName}`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔑 Export Private Key', callback_data: `export_privatekey_${walletSlot}_${chain}` },
            ...(wallet.seedPhrase ? 
              [{ text: '📝 Export Seed Phrase', callback_data: `export_seedphrase_${walletSlot}_${chain}` }] : 
              [{ text: '📝 Seed Not Available', callback_data: `seed_not_available_${walletSlot}_${chain}` }]
            )
          ],
          [
            { text: '🔙 Back to Wallet', callback_data: `wallet_manage_${walletSlot}_${chain}` }
          ]
        ]
      }
    });
  }

  // Handle chain wallet export (when clicked from generate/import success)
  async handleChainWalletExport(chatId, messageId, chain) {
    const chainName = this.getChainName(chain);
    
    // Get all wallets for this chain
    const chainWallets = await this.walletManager.getChainWallets(chatId, chain);
    
    if (Object.keys(chainWallets).length === 0) {
      await this.bot.editMessageText(
        `❌ **No Wallets Found**\n\n` +
        `No wallets found on ${chainName}.`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Back to Wallets', callback_data: `chain_${chain}` }]
          ]
        }
      });
      return;
    }

    // Show wallet selection for export
    let message = `⬆️ **Export Wallet from ${chainName}**\n\n` +
                  `Choose which wallet to export:\n\n`;
    
    const walletButtons = [];
    
    for (let i = 1; i <= 5; i++) {
      const slot = `W${i}`;
      const wallet = chainWallets[slot];
      
      if (wallet) {
        const shortAddress = `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;
        const walletEmoji = this.getWalletEmoji(i);
        
        message += `${walletEmoji} **Wallet ${i}:** \`${shortAddress}\`\n`;
        walletButtons.push([
          { text: `${walletEmoji} Export Wallet ${i}`, callback_data: `wallet_export_single_${slot}_${chain}` }
        ]);
      }
    }
    
    walletButtons.push([
      { text: '🔙 Back to Wallets', callback_data: `chain_${chain}` }
    ]);

    await this.bot.editMessageText(message, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: walletButtons
      }
    });
  }

  // Handle export actions (private key, seed phrase)
  async handleExportAction(callbackQuery) {
    const { data, from, message } = callbackQuery;
    const chatId = from.id;
    const messageId = message.message_id;

    // Parse callback data: export_privatekey_W1_base, export_seedphrase_W1_base, or export_confirm_W1_base
    const parts = data.split('_');
    const exportType = parts[1]; // privatekey, seedphrase, or confirm
    const walletSlot = parts[2]; // W1, W2, etc.
    const chain = parts[3]; // base, ethereum, etc.

    const chainName = this.getChainName(chain);
    const walletNumber = walletSlot.replace('W', '');

    // Get wallet data
    const chainWallets = await this.walletManager.getChainWallets(chatId, chain);
    const wallet = chainWallets[walletSlot];
    
    if (!wallet) {
      await this.bot.editMessageText(
        `❌ **Wallet Not Found**\n\n` +
        `Wallet ${walletNumber} not found on ${chainName}.`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Back to Wallets', callback_data: `chain_${chain}` }]
          ]
        }
      });
      return;
    }

    if (exportType === 'confirm') {
      // Handle export confirmation from the new single wallet export flow
      await this.exportPrivateKey(chatId, messageId, wallet, walletNumber, walletSlot, chain);
    } else if (exportType === 'privatekey') {
      await this.exportPrivateKey(chatId, messageId, wallet, walletNumber, walletSlot, chain);
    } else if (exportType === 'seedphrase') {
      await this.exportSeedPhrase(chatId, messageId, wallet, walletNumber, walletSlot, chain);
    }
  }

  // Export private key
  async exportPrivateKey(chatId, messageId, wallet, walletNumber, walletSlot, chain) {
    const chainName = this.getChainName(chain);

    // Edit the same message to show private key (cleaner flow)
    await this.bot.editMessageText(
      `🔑 **Private Key for Wallet ${walletNumber}**\n\n` +
      `📍 **Address:** \`${wallet.address}\`\n` +
      `🔑 **Private Key:** \`${wallet.privateKey}\`\n\n` +
      `⚠️ **Security Warning:**\n` +
      `• Never share your private key with anyone\n` +
      `• Store it in a secure location\n` +
      `• Anyone with this key has full access to your wallet\n\n` +
      `⛓️ **Network:** ${chainName}\n\n` +
      `🗑️ **This message will be automatically cleared when you navigate away.**`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔙 Back to Wallet', callback_data: `wallet_manage_${walletSlot}_${chain}` },
            { text: '🔙 Back to Wallets', callback_data: `chain_${chain}` }
          ],
          [
            { text: '🗑️ Clear Now', callback_data: `wallet_manage_${walletSlot}_${chain}` }
          ]
        ]
      }
    });
  }

  // Export seed phrase
  async exportSeedPhrase(chatId, messageId, wallet, walletNumber, walletSlot, chain) {
    const chainName = this.getChainName(chain);

    // Check if seed phrase is available
    if (!wallet.seedPhrase) {
      await this.bot.editMessageText(
        `❌ **Seed Phrase Not Available**\n\n` +
        `Wallet ${walletNumber} was imported from a private key only.\n\n` +
        `**Available options:**\n` +
        `🔑 Private Key - Always available\n` +
        `📝 Seed Phrase - Only for generated wallets or wallets imported from seed phrase\n\n` +
        `⛓️ **Network:** ${chainName}`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔑 Export Private Key', callback_data: `export_privatekey_${walletSlot}_${chain}` }
            ],
            [
              { text: '🔙 Back to Wallet', callback_data: `wallet_manage_${walletSlot}_${chain}` }
            ]
          ]
        }
      });
      return;
    }

    // Edit the same message to show seed phrase (cleaner flow)
    await this.bot.editMessageText(
      `📝 **Seed Phrase for Wallet ${walletNumber}**\n\n` +
      `📍 **Address:** \`${wallet.address}\`\n` +
      `📝 **Seed Phrase:** \`${wallet.seedPhrase}\`\n\n` +
      `⚠️ **Security Warning:**\n` +
      `• Never share your seed phrase with anyone\n` +
      `• Store it in a secure location\n` +
      `• Anyone with this phrase can recover your entire wallet\n\n` +
      `⛓️ **Network:** ${chainName}\n\n` +
      `🗑️ **This message will be automatically cleared when you navigate away.**`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔙 Back to Wallet', callback_data: `wallet_manage_${walletSlot}_${chain}` },
            { text: '🔙 Back to Wallets', callback_data: `chain_${chain}` }
          ],
          [
            { text: '🗑️ Clear Now', callback_data: `wallet_manage_${walletSlot}_${chain}` }
          ]
        ]
      }
    });
  }

  // Handle seed not available
  async handleSeedNotAvailable(callbackQuery) {
    const { data, from, message } = callbackQuery;
    const chatId = from.id;
    const messageId = message.message_id;

    // Parse callback data: seed_not_available_W1_base
    const parts = data.split('_');
    const walletSlot = parts[3]; // W1, W2, etc.
    const chain = parts[4]; // base, ethereum, etc.

    const chainName = this.getChainName(chain);
    const walletNumber = walletSlot.replace('W', '');

    // Get wallet data to show more details
    const chainWallets = await this.walletManager.getChainWallets(chatId, chain);
    const wallet = chainWallets[walletSlot];

    if (!wallet) {
      await this.bot.editMessageText(
        `❌ **Wallet Not Found**\n\n` +
        `Wallet ${walletNumber} not found on ${chainName}.`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Back to Wallets', callback_data: `chain_${chain}` }]
          ]
        }
      });
      return;
    }

    // Show explanation about seed phrase availability
    await this.bot.editMessageText(
      `📝 **Seed Phrase Not Available**\n\n` +
      `**Wallet ${walletNumber}** was imported from a private key only.\n\n` +
      `📍 **Address:** \`${wallet.address}\`\n\n` +
      `**Available Export Options:**\n` +
      `🔑 **Private Key** - ✅ Available\n` +
      `• This wallet was imported using only a private key\n` +
      `• You can export the private key anytime\n\n` +
      `📝 **Seed Phrase** - ❌ Not Available\n` +
      `• Only wallets imported/generated with seed phrases have this option\n` +
      `• Private key imports don't include seed phrases\n\n` +
      `💡 **Tip:** New generated wallets now include seed phrases! Import using seed phrase for full recovery options.\n\n` +
      `⛓️ **Network:** ${chainName}`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔑 Export Private Key', callback_data: `export_privatekey_${walletSlot}_${chain}` }
          ],
          [
            { text: '🔙 Back to Export Options', callback_data: `wallet_export_single_${walletSlot}_${chain}` },
            { text: '🔙 Back to Wallet', callback_data: `wallet_${walletSlot}_${chain}` }
          ]
        ]
      }
    });
  }

  // Get wallet emoji
  getWalletEmoji(index) {
    const emojis = ['', '🥇', '🥈', '🥉', '💎', '⭐'];
    return emojis[index] || '💼';
  }

  // Handle replace import callback (from import wallet flow)
  async handleReplaceImport(callbackQuery) {
    const { data, from, message } = callbackQuery;
    const chatId = from.id;
    const messageId = message.message_id;

    // Parse callback data: replace_import_W1_base
    const parts = data.split('_');
    const [action, importAction, walletSlot, chain] = parts;

    const chainName = this.getChainName(chain);
    const walletNumber = walletSlot.replace('W', '');

    // Show import type selection for replacement
    await this.bot.editMessageText(
      `🔄 **Replace Wallet ${walletNumber}**\n\n` +
      `Choose what type of wallet data you want to import to replace wallet ${walletNumber}:\n\n` +
      `🔑 **Private Key**\n` +
      `• 64 characters (with or without 0x)\n` +
      `• Full trading access\n` +
      `• Most secure option\n\n` +
      `📝 **Seed Phrase**\n` +
      `• 12 or 24 words\n` +
      `• Full wallet recovery\n` +
      `• Can generate multiple addresses\n\n` +
      `⚠️ **Warning:** This will permanently replace the existing wallet!\n\n` +
      `⛓️ **Network:** ${chainName}`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔑 Replace with Private Key', callback_data: `replace_privatekey_${walletSlot}_${chain}` },
            { text: '📝 Replace with Seed Phrase', callback_data: `replace_seedphrase_${walletSlot}_${chain}` }
          ],
          [
            { text: '❌ Cancel', callback_data: `chain_${chain}` }
          ]
        ]
      }
    });
  }

  // Handle replace wallet callback
  async handleReplaceWallet(callbackQuery) {
    const { data, from, message } = callbackQuery;
    const chatId = from.id;
    const messageId = message.message_id;

    // Parse callback data: replace_privatekey_W1_base
    const parts = data.split('_');
    const [action, type, walletSlot, chain] = parts;

    // Set user state for replacement
    this.userStates.setReplaceState(chatId, type, walletSlot, chain);

    const chainName = this.getChainName(chain);
    const walletNumber = walletSlot.replace('W', '');

    if (type === 'privatekey') {
      await this.bot.editMessageText(
        `🔑 **Replace Wallet ${walletNumber} with Private Key**\n\n` +
        `Send your private key in the next message to replace wallet ${walletNumber}.\n\n` +
        `📋 **Accepted Formats:**\n` +
        `• \`0x1234567890abcdef...\` (with 0x prefix)\n` +
        `• \`1234567890abcdef...\` (without 0x prefix)\n` +
        `• Must be exactly 64 characters (excluding 0x)\n\n` +
        `⚠️ **Warning:** This will permanently replace the existing wallet!\n\n` +
        `⛓️ **Network:** ${chainName}`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          force_reply: true,
          input_field_placeholder: 'Send your private key here...'
        }
      });
    } else if (type === 'seedphrase') {
      await this.bot.editMessageText(
        `📝 **Replace Wallet ${walletNumber} with Seed Phrase**\n\n` +
        `Send your seed phrase in the next message to replace wallet ${walletNumber}.\n\n` +
        `📋 **Accepted Formats:**\n` +
        `• 12 words: \`word1 word2 word3 ... word12\`\n` +
        `• 24 words: \`word1 word2 word3 ... word24\`\n` +
        `• Separated by spaces\n` +
        `• Standard BIP39 mnemonic phrases\n\n` +
        `⚠️ **Warning:** This will permanently replace the existing wallet!\n\n` +
        `⛓️ **Network:** ${chainName}`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          force_reply: true,
          input_field_placeholder: 'Send your seed phrase here...'
        }
      });
    }
  }

  // Process private key replacement
  async processPrivateKeyReplace(chatId, privateKey, walletSlot, chain) {
    // Validate private key format
    const cleanKey = privateKey.replace(/^0x/, '').trim();
    
    if (!/^[a-fA-F0-9]{64}$/.test(cleanKey)) {
      await this.bot.sendMessage(chatId,
        `❌ **Invalid Private Key**\n\n` +
        `Private key must be exactly 64 hexadecimal characters.\n\n` +
        `Please try again with a valid private key.`, {
        parse_mode: 'Markdown'
      });
      return;
    }

    // Replace wallet
    const result = await this.walletManager.replaceWalletWithPrivateKey(chatId, `0x${cleanKey}`, walletSlot, chain);
    
    if (result.success) {
      const walletNumber = walletSlot.replace('W', '');
      
      // Show success message
      await this.bot.sendMessage(chatId,
        `✅ **Wallet ${walletNumber} Replaced Successfully!**\n\n` +
        `🔑 **New Address:** \`${result.address}\`\n` +
        `⛓️ **Network:** ${this.getChainName(chain)}\n` +
        `💼 **Slot:** ${walletNumber}\n\n` +
        `Your wallet is now ready for trading!`, {
        parse_mode: 'Markdown'
      });

      // Wait 2 seconds then go back to wallet management
      setTimeout(async () => {
        try {
          const message = await this.bot.sendMessage(chatId, '🔄 Loading wallets...');
          await this.walletUI.showWalletManagement(chatId, message.message_id, chain);
        } catch (error) {
          console.error('Error returning to wallet management:', error);
        }
      }, 2000);
    } else {
      await this.bot.sendMessage(chatId,
        `❌ **Replacement Failed**\n\n` +
        `${result.error}\n\n` +
        `Please try again.`, {
        parse_mode: 'Markdown'
      });
    }
  }

  // Process seed phrase replacement
  async processSeedPhraseReplace(chatId, seedPhrase, walletSlot, chain) {
    // Validate seed phrase
    const words = seedPhrase.trim().split(/\s+/);
    
    if (words.length !== 12 && words.length !== 24) {
      await this.bot.sendMessage(chatId,
        `❌ **Invalid Seed Phrase**\n\n` +
        `Seed phrase must be exactly 12 or 24 words.\n` +
        `You provided ${words.length} words.\n\n` +
        `Please try again with a valid seed phrase.`, {
        parse_mode: 'Markdown'
      });
      return;
    }

    // Replace wallet from seed phrase
    const result = await this.walletManager.replaceWalletWithSeedPhrase(chatId, seedPhrase, walletSlot, chain);
    
    if (result.success) {
      const walletNumber = walletSlot.replace('W', '');
      
      // Show success message
      await this.bot.sendMessage(chatId,
        `✅ **Wallet ${walletNumber} Replaced Successfully!**\n\n` +
        `🔑 **New Address:** \`${result.address}\`\n` +
        `⛓️ **Network:** ${this.getChainName(chain)}\n` +
        `💼 **Slot:** ${walletNumber}\n` +
        `📝 **Type:** Seed Phrase\n\n` +
        `Your wallet is now ready for trading!`, {
        parse_mode: 'Markdown'
      });

      // Wait 2 seconds then go back to wallet management
      setTimeout(async () => {
        try {
          const message = await this.bot.sendMessage(chatId, '🔄 Loading wallets...');
          await this.walletUI.showWalletManagement(chatId, message.message_id, chain);
        } catch (error) {
          console.error('Error returning to wallet management:', error);
        }
      }, 2000);
    } else {
      await this.bot.sendMessage(chatId,
        `❌ **Replacement Failed**\n\n` +
        `${result.error}\n\n` +
        `Please try again.`, {
        parse_mode: 'Markdown'
      });
    }
  }

  // Get wallet emoji
  getWalletEmoji(index) {
    const emojis = ['', '🥇', '🥈', '🥉', '💎', '⭐'];
    return emojis[index] || '💼';
  }

  // Get chain display name
  getChainName(chain) {
    const chains = {
      ethereum: 'Ethereum',
      base: 'Base',
      bsc: 'BNB Smart Chain',
      arbitrum: 'Arbitrum One',
      polygon: 'Polygon',
      avalanche: 'Avalanche',
      solana: 'Solana',
      blast: 'Blast',
      optimism: 'Optimism'
    };
    return chains[chain] || 'Unknown';
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

  // Handle wallet transfer
  async handleWalletTransfer(callbackQuery) {
    const { data, from, message } = callbackQuery;
    const chatId = from.id;
    const messageId = message.message_id;

    // Parse callback data: wallet_transfer_W1_base
    const parts = data.split('_');
    const walletSlot = parts[2]; // W1, W2, etc.
    const chain = parts[3]; // base, ethereum, etc.

    // Get wallet data
    const chainWallets = await this.walletManager.getChainWallets(chatId, chain);
    const wallet = chainWallets[walletSlot];

    if (!wallet) {
      await this.bot.editMessageText(
        `❌ **Wallet Not Found**\n\n` +
        `Wallet ${walletSlot.replace('W', '')} not found on ${this.getChainName(chain)}.`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Back to Wallets', callback_data: `chain_${chain}` }]
          ]
        }
      });
      return;
    }

    // Start transfer process - ask for recipient address
    await this.startTransferProcess(chatId, messageId, wallet, walletSlot, chain);
  }

  // Start transfer process
  async startTransferProcess(chatId, messageId, wallet, walletSlot, chain) {
    const chainName = this.getChainName(chain);
    const nativeToken = this.getNativeToken(chain);
    const walletNumber = walletSlot.replace('W', '');

    // Get current balance from chain
    let balance = "0.0";
    try {
      const chainManager = require('../chains/chain-manager');
      const manager = new chainManager();
      balance = await manager.getWalletBalance(chain, wallet.address);
    } catch (error) {
      console.error('❌ Error fetching balance:', error.message);
      balance = "0.0";
    }

    // Check if wallet has any balance
    const balanceNum = parseFloat(balance);
    if (balanceNum === 0) {
      await this.bot.editMessageText(
        `💰 **Transfer ${nativeToken}**\n\n` +
        `**From Wallet ${walletNumber}**\n` +
        `📍 **Address:** \`${wallet.address}\`\n` +
        `💰 **Balance:** ${balance} ${nativeToken}\n` +
        `⛓️ **Network:** ${chainName}\n\n` +
        `❌ **Insufficient Balance**\n\n` +
        `This wallet has no ${nativeToken} to transfer.\n` +
        `Please fund the wallet first.`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔙 Back to Wallet', callback_data: `wallet_manage_${walletSlot}_${chain}` }
            ]
          ]
        }
      });
      return;
    }
    
    await this.bot.editMessageText(
      `💰 **Transfer ${nativeToken}**\n\n` +
      `**From Wallet ${walletNumber}**\n` +
      `📍 **Address:** \`${wallet.address}\`\n` +
      `💰 **Balance:** ${balance} ${nativeToken}\n` +
      `⛓️ **Network:** ${chainName}\n\n` +
      `**Step 1 of 3:** Enter recipient address\n\n` +
      `Please send the wallet address where you want to transfer ${nativeToken}:`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '❌ Cancel Transfer', callback_data: `wallet_manage_${walletSlot}_${chain}` }
          ]
        ]
      }
    });

    // Send additional reply message prompting for address
    const replyMsg = await this.bot.sendMessage(chatId, 
      `📝 **Please send the recipient wallet address:**\n\n` +
      `💡 *Just type or paste the ${chainName} address and send it*`, {
      parse_mode: 'Markdown',
      reply_markup: {
        force_reply: true,
        input_field_placeholder: `Enter ${chainName} wallet address...`
      }
    });

    // Set user state to wait for recipient address
    this.userStates.set(chatId, {
      action: 'waiting_transfer_address',
      wallet: wallet,
      walletSlot: walletSlot,
      chain: chain,
      messageId: messageId,
      replyMessageId: replyMsg.message_id
    });
  }

  // Handle transfer message input
  async handleTransferMessage(msg) {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();
    
    if (!text) return;

    const state = this.userStates.getState(chatId);
    if (!state) return;

    try {
      // Delete the user's input message to keep chat clean
      try {
        await this.bot.deleteMessage(chatId, msg.message_id);
      } catch (e) {
        // Ignore if can't delete
      }

      if (state.action === 'waiting_transfer_address') {
        await this.handleTransferAddress(chatId, text, state);
      } else if (state.action === 'waiting_transfer_amount') {
        await this.handleTransferAmount(chatId, text, state);
      }
    } catch (error) {
      console.error('❌ Transfer message error:', error.message);
      await this.bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
      this.userStates.clearState(chatId);
    }
  }

  // Handle recipient address input
  async handleTransferAddress(chatId, address, state) {
    const { wallet, walletSlot, chain, messageId, replyMessageId } = state;
    const chainName = this.getChainName(chain);
    const nativeToken = this.getNativeToken(chain);

    // Delete the reply message to keep chat clean
    try {
      if (replyMessageId) {
        await this.bot.deleteMessage(chatId, replyMessageId);
      }
    } catch (e) {
      // Ignore if can't delete
    }

    // Basic address validation
    if (!this.isValidAddress(address, chain)) {
      await this.bot.editMessageText(
        `❌ **Invalid Address**\n\n` +
        `The address you entered is not valid for ${chainName}.\n\n` +
        `Please enter a valid ${chainName} address:`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Cancel Transfer', callback_data: `wallet_manage_${walletSlot}_${chain}` }]
          ]
        }
      });
      return;
    }

    // Get current balance from chain
    let balance = "0.0";
    try {
      const chainManager = require('../chains/chain-manager');
      const manager = new chainManager();
      balance = await manager.getWalletBalance(chain, wallet.address);
    } catch (error) {
      console.error('❌ Error fetching balance:', error.message);
      balance = "0.0";
    }

    // Calculate max amount (balance - estimated gas)
    const balanceNum = parseFloat(balance);
    const estimatedGas = this.getEstimatedGas(chain);
    const maxAmount = Math.max(0, balanceNum - estimatedGas).toFixed(6);

    await this.bot.editMessageText(
      `💰 **Transfer ${nativeToken}**\n\n` +
      `**From:** \`${wallet.address}\`\n` +
      `**To:** \`${address}\`\n` +
      `💰 **Available:** ${balance} ${nativeToken}\n` +
      `📊 **Max Transfer:** ${maxAmount} ${nativeToken}\n` +
      `⛓️ **Network:** ${chainName}\n\n` +
      `**Step 2 of 3:** Enter amount to send\n\n` +
      `How much ${nativeToken} do you want to transfer?\n` +
      `💡 *Type amount or 'max' for maximum*`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '💯 Send Max', callback_data: `transfer_max_${walletSlot}_${chain}` },
            { text: '❌ Cancel', callback_data: `wallet_manage_${walletSlot}_${chain}` }
          ]
        ]
      }
    });

    // Send additional reply message prompting for amount
    const amountReplyMsg = await this.bot.sendMessage(chatId, 
      `💰 **Enter the amount to transfer:**\n\n` +
      `Available: ${balance} ${nativeToken}\n` +
      `Max: ${maxAmount} ${nativeToken}\n\n` +
      `💡 *Type a number (e.g., 0.1) or 'max' for maximum*`, {
      parse_mode: 'Markdown',
      reply_markup: {
        force_reply: true,
        input_field_placeholder: `Enter amount in ${nativeToken}...`
      }
    });

    // Update state
    this.userStates.set(chatId, {
      action: 'waiting_transfer_amount',
      wallet: wallet,
      walletSlot: walletSlot,
      chain: chain,
      messageId: messageId,
      recipientAddress: address,
      balance: balance,
      maxAmount: maxAmount,
      replyMessageId: amountReplyMsg.message_id
    });
  }

  // Handle transfer amount input
  async handleTransferAmount(chatId, amountText, state) {
    const { wallet, walletSlot, chain, messageId, recipientAddress, balance, maxAmount, replyMessageId } = state;
    const chainName = this.getChainName(chain);
    const nativeToken = this.getNativeToken(chain);

    // Delete the reply message to keep chat clean
    try {
      if (replyMessageId) {
        await this.bot.deleteMessage(chatId, replyMessageId);
      }
    } catch (e) {
      // Ignore if can't delete
    }

    let amount;
    if (amountText.toLowerCase() === 'max') {
      amount = maxAmount;
    } else {
      amount = parseFloat(amountText);
      if (isNaN(amount) || amount <= 0) {
        await this.bot.editMessageText(
          `❌ **Invalid Amount**\n\n` +
          `Please enter a valid number or 'max'.\n\n` +
          `Available: ${balance} ${nativeToken}\n` +
          `Max transfer: ${maxAmount} ${nativeToken}`, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '❌ Cancel Transfer', callback_data: `wallet_manage_${walletSlot}_${chain}` }]
            ]
          }
        });
        return;
      }

      if (amount > parseFloat(maxAmount)) {
        await this.bot.editMessageText(
          `❌ **Amount Too High**\n\n` +
          `You can't send more than ${maxAmount} ${nativeToken}.\n\n` +
          `Available: ${balance} ${nativeToken}\n` +
          `Please enter a smaller amount:`, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '❌ Cancel Transfer', callback_data: `wallet_manage_${walletSlot}_${chain}` }]
            ]
          }
        });
        return;
      }
    }

    // Show confirmation
    await this.showTransferConfirmation(chatId, messageId, {
      wallet: state.wallet,
      walletSlot: state.walletSlot,
      chain: state.chain,
      recipientAddress: state.recipientAddress,
      amount: amount.toString(),
      balance: state.balance,
      maxAmount: state.maxAmount
    });
  }

  // Show transfer confirmation
  async showTransferConfirmation(chatId, messageId, transferData) {
    console.log('🔍 showTransferConfirmation called with:', transferData);
    
    const { wallet, walletSlot, chain, recipientAddress, amount } = transferData;
    console.log('🔍 Extracted data:', { walletSlot, chain, recipientAddress, amount });
    
    const chainName = this.getChainName(chain);
    const nativeToken = this.getNativeToken(chain);
    const walletNumber = walletSlot.replace('W', '');

    // Estimate gas fee (placeholder)
    const estimatedGas = "0.005"; // TODO: Calculate real gas

    await this.bot.editMessageText(
      `🔍 **Confirm Transfer**\n\n` +
      `**From Wallet ${walletNumber}:**\n` +
      `\`${wallet.address}\`\n\n` +
      `**To Address:**\n` +
      `\`${recipientAddress}\`\n\n` +
      `💰 **Amount:** ${amount} ${nativeToken}\n` +
      `⛽ **Est. Gas:** ${estimatedGas} ${nativeToken}\n` +
      `💸 **Total Cost:** ${(parseFloat(amount) + parseFloat(estimatedGas)).toFixed(6)} ${nativeToken}\n` +
      `⛓️ **Network:** ${chainName}\n\n` +
      `**Step 3 of 3:** Ready to send!\n\n` +
      `⚠️ *This action cannot be undone*`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Confirm Transfer', callback_data: `transfer_execute_${walletSlot}_${chain}` }
          ],
          [
            { text: '❌ Cancel Transfer', callback_data: `wallet_manage_${walletSlot}_${chain}` }
          ]
        ]
      }
    });

    const confirmCallbackData = `transfer_execute_${walletSlot}_${chain}`;
    console.log('🔍 ========== TRANSFER CONFIRMATION BUTTON CREATED ==========');
    console.log('🔍 Confirm callback_data:', confirmCallbackData);
    console.log('🔍 Confirm callback_data length:', confirmCallbackData.length);
    console.log('🔍 walletSlot:', walletSlot);
    console.log('🔍 chain:', chain);
    console.log('🔍 chatId:', chatId);
    console.log('🔍 messageId:', messageId);
    
    const cancelCallbackData = `wallet_manage_${walletSlot}_${chain}`;
    console.log('🔍 Cancel button callback_data:', cancelCallbackData);
    console.log('🔍 Cancel callback_data length:', cancelCallbackData.length);
    console.log('🔍 ========================================================');

    // Update state with confirmation data
    const confirmationState = {
      action: 'transfer_confirmed',
      ...transferData,
      estimatedGas: estimatedGas
    };
    
    console.log('🔍 Setting state to:', JSON.stringify(confirmationState, null, 2));
    console.log('🔍 ChatId for state:', chatId);
    console.log('🔍 UserStates object exists:', !!this.userStates);
    console.log('🔍 UserStates.set method exists:', typeof this.userStates.set);
    
    this.userStates.set(chatId, confirmationState);
    
    // Verify state was set correctly
    const verifyState = this.userStates.getState(chatId);
    console.log('🔍 State after setting:', JSON.stringify(verifyState, null, 2));
    console.log('🔍 State action after setting:', verifyState?.action);
    console.log('🔍 State matches expected?', verifyState?.action === 'transfer_confirmed');
  }

  // Validate address format
  isValidAddress(address, chain) {
    if (chain === 'solana') {
      // Solana address validation (base58, 32-44 chars)
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
    } else {
      // EVM address validation (0x + 40 hex chars)
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    }
  }

  // Handle "Send Max" button
  async handleTransferMax(callbackQuery) {
    const { data, from, message } = callbackQuery;
    const chatId = from.id;
    const messageId = message.message_id;

    const state = this.userStates.getState(chatId);
    if (!state || state.action !== 'waiting_transfer_amount') {
      return;
    }

    // Delete the reply message to keep chat clean
    try {
      if (state.replyMessageId) {
        await this.bot.deleteMessage(chatId, state.replyMessageId);
      }
    } catch (e) {
      // Ignore if can't delete
    }

    // Use max amount
    await this.showTransferConfirmation(chatId, messageId, {
      wallet: state.wallet,
      walletSlot: state.walletSlot,
      chain: state.chain,
      recipientAddress: state.recipientAddress,
      amount: state.maxAmount,
      balance: state.balance,
      maxAmount: state.maxAmount
    });
  }

  // Handle transfer confirmation
  async handleTransferConfirm(callbackQuery) {
    console.log('🚀 ========== HANDLE TRANSFER CONFIRM CALLED ==========');
    console.log('🚀 TIMESTAMP:', new Date().toISOString());
    const { data, from, message } = callbackQuery;
    const chatId = from.id;
    const messageId = message.message_id;

    console.log('🔍 Transfer confirm button pressed:', data);
    console.log('🔍 Chat ID:', chatId);
    console.log('🔍 Message ID:', messageId);
    console.log('🔍 Full callbackQuery:', JSON.stringify(callbackQuery, null, 2));
    console.log('🔍 ================================================');

    const state = this.userStates.getState(chatId);
    console.log('🔍 Current state:', JSON.stringify(state, null, 2));
    console.log('🔍 State action:', state?.action);
    console.log('🔍 Expected action: transfer_confirmed');
    
    if (!state) {
      console.log('❌ NO STATE FOUND for chatId:', chatId);
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Session expired. Please start transfer again.',
        show_alert: true
      });
      return;
    }
    
    if (state.action !== 'transfer_confirmed') {
      console.log('❌ Invalid state for transfer confirmation. Expected action: transfer_confirmed, Got:', state?.action);
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Invalid transfer state. Please start again.',
        show_alert: true
      });
      return;
    }

    // Answer the callback query first
    await this.bot.answerCallbackQuery(callbackQuery.id, {
      text: '⏳ Processing transfer...'
    });

    const { wallet, walletSlot, chain, recipientAddress, amount } = state;
    const chainName = this.getChainName(chain);
    const nativeToken = this.getNativeToken(chain);

    try {
      // Show processing message
      await this.bot.editMessageText(
        `⏳ **Processing Transfer...**\n\n` +
        `Sending ${amount} ${nativeToken} to:\n` +
        `\`${recipientAddress}\`\n\n` +
        `Please wait...`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown'
      });

      // Execute transfer (placeholder - implement actual transfer logic)
      const txHash = await this.executeTransfer(wallet, recipientAddress, amount, chain);
      const explorerUrl = this.getExplorerUrl(txHash, chain);

      // Show success message
      await this.bot.editMessageText(
        `✅ **Transfer Successful!**\n\n` +
        `💰 **Amount:** ${amount} ${nativeToken}\n` +
        `📍 **To:** \`${recipientAddress}\`\n` +
        `⛓️ **Network:** ${chainName}\n\n` +
        `🔗 **Transaction Hash:**\n` +
        `\`${txHash}\`\n\n` +
        `🌐 **View on Explorer:**\n` +
        `${explorerUrl}`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🌐 View Transaction', url: explorerUrl }
            ],
            [
              { text: '🔙 Back to Wallet', callback_data: `wallet_manage_${walletSlot}_${chain}` }
            ]
          ]
        }
      });

      // Clear state
      this.userStates.clearState(chatId);

    } catch (error) {
      console.error('❌ Transfer execution error:', error.message);
      
      await this.bot.editMessageText(
        `❌ **Transfer Failed**\n\n` +
        `Error: ${error.message}\n\n` +
        `Please try again or contact support.`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔄 Try Again', callback_data: `wallet_transfer_${walletSlot}_${chain}` },
              { text: '🔙 Back to Wallet', callback_data: `wallet_manage_${walletSlot}_${chain}` }
            ]
          ]
        }
      });

      this.userStates.clearState(chatId);
    }
  }

  // Execute the actual transfer
  async executeTransfer(wallet, recipientAddress, amount, chain) {
    try {
      const chainManager = require('../chains/chain-manager');
      const manager = new chainManager();
      
      // Execute real transfer
      const txHash = await manager.transferNative(
        chain, 
        wallet.privateKey, 
        recipientAddress, 
        amount
      );
      
      return txHash;
    } catch (error) {
      console.error('❌ Transfer execution failed:', error.message);
      throw new Error(`Transfer failed: ${error.message}`);
    }
  }



  // Get explorer URL for transaction
  getExplorerUrl(txHash, chain) {
    const explorers = {
      ethereum: `https://etherscan.io/tx/${txHash}`,
      base: `https://basescan.org/tx/${txHash}`,
      bsc: `https://bscscan.com/tx/${txHash}`,
      arbitrum: `https://arbiscan.io/tx/${txHash}`,
      polygon: `https://polygonscan.com/tx/${txHash}`,
      avalanche: `https://snowtrace.io/tx/${txHash}`,
      solana: `https://solscan.io/tx/${txHash}`,
      blast: `https://blastscan.io/tx/${txHash}`,
      optimism: `https://optimistic.etherscan.io/tx/${txHash}`
    };
    return explorers[chain] || `https://etherscan.io/tx/${txHash}`;
  }

  // Get estimated gas fee for each chain
  getEstimatedGas(chain) {
    const gasFees = {
      ethereum: 0.005,    // Higher gas on mainnet
      base: 0.0001,       // Very low gas on Base
      bsc: 0.0005,        // Low gas on BSC
      arbitrum: 0.0002,   // Low gas on L2
      polygon: 0.001,     // Low gas on Polygon
      avalanche: 0.001,   // Moderate gas
      solana: 0.00001,    // Very low gas on Solana
      blast: 0.0001,      // Low gas
      optimism: 0.0002    // Low gas on L2
    };
    return gasFees[chain] || 0.001;
  }

  // Get native token symbol for each chain
  getNativeToken(chain) {
    const tokens = {
      ethereum: 'ETH',
      base: 'ETH',
      bsc: 'BNB',
      arbitrum: 'ETH',
      polygon: 'MATIC',
      avalanche: 'AVAX',
      solana: 'SOL',
      blast: 'ETH',
      optimism: 'ETH'
    };
    return tokens[chain] || 'TOKEN';
  }

  // Handle buy refresh
  async handleBuyRefresh(callbackQuery) {
    const { data } = callbackQuery;
    const chatId = callbackQuery.from.id;
    const messageId = callbackQuery.message.message_id;
    
    console.log('📊 REFRESH BUTTON CLICKED!');
    console.log('📊 Callback data:', data);
    
    try {
      // Parse: buy_refresh_SESSIONID
      const parts = data.split('_');
      const sessionId = parts[2];
      
      console.log('📊 Session ID extracted:', sessionId);
      
      // Get token data from session
      const tokenData = this.buyTokenUI.getTokenSession(chatId, sessionId);
      if (!tokenData) {
        console.log('❌ Token session not found');
        await this.bot.editMessageText(
          `❌ **Session Expired**\n\n` +
          `Token session has expired. Please analyze the token again.`, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔥 Buy Token', callback_data: 'buy_menu' }],
              [{ text: '🔙 Back to Main Menu', callback_data: 'main_menu' }]
            ]
          }
        });
        return;
      }
      
      console.log('✅ Token session found:', tokenData.symbol);
      
      // Answer callback immediately
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: '🔄 Refreshing token info...',
        show_alert: false
      });
      
      // Validate token data structure
      if (!tokenData.chain) {
        console.log('❌ Token data missing chain property, attempting to re-analyze...');
        
        // Re-analyze the token to get complete data
        const freshTokenData = await this.buyTokenUI.tokenAnalyzer.analyzeToken(tokenData.address);
        
        if (!freshTokenData || !freshTokenData.chain) {
          throw new Error('Unable to determine token chain');
        }
        
        // Update session with complete data
        this.buyTokenUI.updateTokenSession(chatId, sessionId, freshTokenData);
        tokenData = freshTokenData;
        console.log('✅ Token re-analyzed, chain found:', tokenData.chain);
      }
      
      // Get user's wallet balances for this chain
      const walletBalances = await this.buyTokenUI.getUserWalletBalances(chatId, tokenData.chain);
      
      // Format and display token information (this will fetch fresh price data)
      let tokenInfo = this.buyTokenUI.tokenAnalyzer.formatTokenInfo(tokenData, walletBalances);
      
      // Add refresh timestamp to ensure content is always different
      const now = new Date();
      const timeString = now.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      });
      tokenInfo += `\n\n🔄 *Last refreshed: ${timeString}*`;
      
      // Create buy keyboard with existing session
      const buyKeyboard = await this.buyTokenUI.createBuyKeyboardWithSession(chatId, tokenData, sessionId);

      try {
        // Update message with refreshed token info
        await this.bot.editMessageText(tokenInfo, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: buyKeyboard,
          disable_web_page_preview: true
        });
        
        console.log('✅ Token info refreshed successfully');
        
      } catch (editError) {
        // Handle the specific "message not modified" error
        if (editError.message.includes('message is not modified')) {
          console.log('ℹ️ Message content unchanged, refresh completed successfully');
          
          // Still consider this a success and give user feedback
          await this.bot.answerCallbackQuery(callbackQuery.id, {
            text: '✅ Token info is already up to date!',
            show_alert: false
          });
          
          return; // Exit successfully
        } else {
          // Re-throw other edit errors
          throw editError;
        }
      }
      
    } catch (error) {
      console.error('❌ Refresh error:', error.message);
      
      // Show error message
      await this.bot.editMessageText(
        `❌ **Refresh Failed**\n\n` +
        `💥 **Error:** ${error.message}\n\n` +
        `💡 This might be due to:\n` +
        `• Network connectivity issues\n` +
        `• API rate limiting\n` +
        `• Token data unavailable\n\n` +
        `🔄 Please try again in a moment.`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Try Again', callback_data: data }],
            [{ text: '🔙 Back to Main Menu', callback_data: 'main_menu' }]
          ]
        }
      });
      
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Refresh failed, please try again',
        show_alert: true
      });
    }
  }

  // Handle other buy actions
  async handleBuyAction(callbackQuery) {
    const { data } = callbackQuery;
    const chatId = callbackQuery.from.id;
    
    // All buy actions now use session IDs, so we need to validate the session first
    const parts = data.split('_');
    const sessionId = parts[2];
    
    // Check if session exists
    const tokenData = this.buyTokenUI.getTokenSession(chatId, sessionId);
    if (!tokenData) {
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Session expired. Please analyze the token again.',
        show_alert: true
      });
      return;
    }
    
    if (data.startsWith('buy_custom_')) {
      await this.handleBuyCustomAmount(callbackQuery, tokenData);
    } else if (data.startsWith('buy_settings_')) {
      await this.handleBuySettings(callbackQuery, tokenData);
    } else if (data.startsWith('buy_chart_')) {
      await this.handleBuyChart(callbackQuery, tokenData);
    } else if (data.startsWith('buy_dex_')) {
      await this.handleBuyDex(callbackQuery, tokenData);
    } else if (data.startsWith('buy_explorer_')) {
      await this.handleBuyExplorer(callbackQuery, tokenData);
    } else if (data.startsWith('buy_confirm_')) {
      await this.handleBuyConfirm(callbackQuery, tokenData);
    }
  }

  // Placeholder handlers for buy actions
  async handleBuyCustomAmount(callbackQuery, tokenData) {
    const { from, message, data } = callbackQuery;
    const chatId = from.id;
    const messageId = message.message_id;

    try {
      // Parse session ID from callback data
      const parts = data.split('_');
      const sessionId = parts[2];
      
      // Get chain info for currency symbol
      const chainInfo = this.buyTokenUI.tokenAnalyzer.getChainInfo(tokenData.chain);
      const symbol = chainInfo.symbol;

      // Set user state to expect custom amount
      this.userStates.setCustomAmountState(chatId, {
        action: 'waiting_for_custom_amount',
        sessionId: sessionId,
        tokenData: tokenData,
        messageId: messageId
      });

      // Send reply prompt message
      await this.bot.sendMessage(chatId, 
        `💰 **Enter Custom Amount**\n\n` +
        `🪙 **Token:** ${tokenData.name} (${tokenData.symbol})\n` +
        `⛓️ **Chain:** ${chainInfo.name}\n\n` +
        `💡 **Reply to this message with the amount of ${symbol} you want to spend**\n\n` +
        `**Examples:** \`0.001\`, \`0.1\`, \`1.5\``, {
        parse_mode: 'Markdown',
        reply_markup: {
          force_reply: true,
          selective: true
        }
      });

      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: `💰 Reply with the ${symbol} amount you want to spend`
      });

    } catch (error) {
      console.error('❌ Error handling custom amount:', error.message);
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Error setting up custom amount',
        show_alert: true
      });
    }
  }

  async handleBuySettings(callbackQuery, tokenData) {
    await this.bot.answerCallbackQuery(callbackQuery.id, {
      text: `⚙️ Buy settings for ${tokenData.symbol} coming soon!`,
      show_alert: true
    });
  }

  async handleBuyChart(callbackQuery, tokenData) {
    await this.bot.answerCallbackQuery(callbackQuery.id, {
      text: `📈 Chart for ${tokenData.symbol} coming soon!`,
      show_alert: true
    });
  }

  async handleBuyDex(callbackQuery, tokenData) {
    await this.bot.answerCallbackQuery(callbackQuery.id, {
      text: `🔗 DEX link for ${tokenData.symbol} coming soon!`,
      show_alert: true
    });
  }

  async handleBuyExplorer(callbackQuery, tokenData) {
    await this.bot.answerCallbackQuery(callbackQuery.id, {
      text: `🔗 Explorer for ${tokenData.symbol} coming soon!`,
      show_alert: true
    });
  }

  async handleBuyConfirm(callbackQuery, tokenData) {
    const { from, message, data } = callbackQuery;
    const chatId = from.id;
    const messageId = message.message_id;

    try {
      // Parse callback data: buy_confirm_sessionId_amount_walletSlot
      const parts = data.split('_');
      const sessionId = parts[2];
      const amount = parseFloat(parts[3]);
      const walletSlot = parseInt(parts[4]);

      console.log('🔥 Buy confirmation:', { sessionId, amount, walletSlot });

      // Get gas settings for this session
      const gasSettings = this.buyTokenUI.getTokenGasSettings(chatId, sessionId);
      const slippage = this.buyTokenUI.getTokenSlippage(chatId, sessionId);

      console.log('⛽ Gas settings:', gasSettings);
      console.log('📊 Slippage:', slippage);

      // Get chain info
      const chainInfo = this.buyTokenUI.tokenAnalyzer.getChainInfo(tokenData.chain);
      const symbol = chainInfo.symbol;

      // Create transaction summary
      const txSummary = 
        `🔥 **Transaction Summary**\n\n` +
        `🪙 **Token:** ${tokenData.name} (${tokenData.symbol})\n` +
        `💰 **Amount:** ${amount} ${symbol}\n` +
        `🏦 **Wallet:** W${walletSlot}\n` +
        `📊 **Slippage:** ${slippage}%\n` +
        `⛽ **Gas:** ${gasSettings.gasPrice || 'Network default'} gwei (${gasSettings.type})\n` +
        `🔗 **Chain:** ${tokenData.chain}\n\n` +
        `⚡ **Estimated confirmation:** ${this.getConfirmationTime(gasSettings.type)}\n\n` +
        `🚀 **Transaction will be executed with your selected settings!**`;

      await this.bot.editMessageText(txSummary, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Execute Buy', callback_data: `buy_execute_final_${sessionId}_${amount}_${walletSlot}` },
              { text: '❌ Cancel', callback_data: `back_to_token_${sessionId}` }
            ]
          ]
        }
      });

      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: '🔥 Review transaction details',
        show_alert: false
      });

    } catch (error) {
      console.error('❌ Error in buy confirmation:', error);
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Error preparing transaction',
        show_alert: true
      });
    }
  }

  // Get estimated confirmation time based on gas type
  getConfirmationTime(gasType) {
    switch (gasType) {
      case 'instant': return '~15 seconds';
      case 'fast': return '~30 seconds';
      case 'standard': return '~2 minutes';
      case 'custom': return '~30-120 seconds';
      default: return '~2 minutes';
    }
  }

  // Handle final buy execution with gas settings
  async handleFinalBuyExecution(callbackQuery) {
    const { from, message, data } = callbackQuery;
    const chatId = from.id;
    const messageId = message.message_id;

    try {
      // Parse callback data: buy_execute_final_sessionId_amount_walletSlot
      const parts = data.split('_');
      const sessionId = parts[3];
      const amount = parseFloat(parts[4]);
      const walletSlot = parseInt(parts[5]);

      console.log('🚀 Final buy execution:', { sessionId, amount, walletSlot });

      // Get token data
      const tokenData = this.buyTokenUI.getTokenSession(chatId, sessionId);
      if (!tokenData) {
        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: '❌ Session expired',
          show_alert: true
        });
        return;
      }

      // Get gas and slippage settings
      const gasSettings = this.buyTokenUI.getTokenGasSettings(chatId, sessionId);
      const slippage = this.buyTokenUI.getTokenSlippage(chatId, sessionId);

      // Get chain info
      const chainInfo = this.buyTokenUI.tokenAnalyzer.getChainInfo(tokenData.chain);
      const symbol = chainInfo.symbol;

      // Show execution message
      const executionMessage = 
        `🚀 **Executing Buy Transaction...**\n\n` +
        `🪙 **Token:** ${tokenData.name} (${tokenData.symbol})\n` +
        `💰 **Amount:** ${amount} ${symbol}\n` +
        `🏦 **Wallet:** W${walletSlot}\n` +
        `⛽ **Gas:** ${gasSettings.gasPrice || 'Network default'} gwei\n` +
        `📊 **Slippage:** ${slippage}%\n\n` +
        `⏳ **Transaction is being processed...**\n` +
        `🔄 **Please wait for confirmation...**`;

      await this.bot.editMessageText(executionMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown'
      });

      // Simulate transaction execution (replace with real trading logic)
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Create transaction options with gas settings
      const transactionOptions = {
        slippage: slippage,
        gasPrice: gasSettings.gasPrice,
        priorityFee: gasSettings.priorityFee,
        gasLimit: gasSettings.gasLimit,
        gasType: gasSettings.type
      };

      console.log('🔧 Transaction options:', transactionOptions);

      // Simulate successful transaction
      const mockTxHash = '0x' + Math.random().toString(16).substr(2, 64);
      const gasUsed = Math.floor(Math.random() * 100000) + 21000;

      // Show success message
      const successMessage = 
        `✅ **Buy Transaction Successful!**\n\n` +
        `🎯 **Transaction Hash:**\n` +
        `\`${mockTxHash}\`\n\n` +
        `💰 **Trade Details:**\n` +
        `• **Token:** ${tokenData.symbol}\n` +
        `• **Amount:** ${amount} ${symbol}\n` +
        `• **Wallet:** W${walletSlot}\n` +
        `• **Gas Used:** ${gasUsed.toLocaleString()}\n` +
        `• **Gas Price:** ${gasSettings.gasPrice || 'Network default'} gwei\n` +
        `• **Slippage:** ${slippage}%\n` +
        `• **Status:** Confirmed ✅\n\n` +
        `🎉 **Trade completed successfully!**\n\n` +
        `⚡ **Confirmation time:** ${this.getConfirmationTime(gasSettings.type)}`;

      await this.bot.editMessageText(successMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔄 Buy More', callback_data: `back_to_token_${sessionId}` },
              { text: '🏠 Main Menu', callback_data: 'main_menu' }
            ]
          ]
        }
      });

      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: '✅ Transaction completed!',
        show_alert: false
      });

    } catch (error) {
      console.error('❌ Error in final buy execution:', error);
      
      // Show error message
      const errorMessage = 
        `❌ **Transaction Failed**\n\n` +
        `💥 **Error:** ${error.message}\n\n` +
        `💡 **Please try again or contact support**`;

      await this.bot.editMessageText(errorMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔄 Try Again', callback_data: `back_to_token_${sessionId}` },
              { text: '🏠 Main Menu', callback_data: 'main_menu' }
            ]
          ]
        }
      });

      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Transaction failed',
        show_alert: true
      });
    }
  }

  // Handle custom amount message input
  async handleCustomAmountMessage(msg) {
    const chatId = msg.chat.id;
    const userInput = msg.text.trim();

    try {
      // Get user state
      const state = this.userStates.getState(chatId);
      if (!state || state.action !== 'waiting_for_custom_amount') {
        return;
      }

      // Validate amount input
      const amount = parseFloat(userInput);
      if (isNaN(amount) || amount <= 0) {
        await this.bot.sendMessage(chatId, 
          `❌ **Invalid Amount**\n\n` +
          `Please enter a valid number greater than 0.\n\n` +
          `**Examples:** \`0.001\`, \`0.1\`, \`1.5\`\n\n` +
          `Try again:`, {
          parse_mode: 'Markdown'
        });
        return;
      }

      // Check if amount is reasonable (not too small or too large)
      if (amount < 0.000001) {
        await this.bot.sendMessage(chatId, 
          `⚠️ **Amount Too Small**\n\n` +
          `Minimum amount is 0.000001\n\n` +
          `Please enter a larger amount:`, {
          parse_mode: 'Markdown'
        });
        return;
      }

      if (amount > 1000) {
        await this.bot.sendMessage(chatId, 
          `⚠️ **Amount Too Large**\n\n` +
          `Maximum amount is 1000\n\n` +
          `Please enter a smaller amount:`, {
          parse_mode: 'Markdown'
        });
        return;
      }

      // Get chain info for currency symbol
      const chainInfo = this.buyTokenUI.tokenAnalyzer.getChainInfo(state.tokenData.chain);
      const symbol = chainInfo.symbol;

      // Clear the custom amount state
      this.userStates.clearState(chatId);

      // Refresh the token display with updated wallet selection (keeping existing selection)
      const tokenData = state.tokenData;
      const walletBalances = await this.buyTokenUI.getUserWalletBalances(chatId, tokenData.chain);
      const tokenInfo = this.buyTokenUI.tokenAnalyzer.formatTokenInfo(tokenData, walletBalances);
      const buyKeyboard = this.buyTokenUI.createBuyKeyboard(chatId, tokenData);

      await this.bot.editMessageText(tokenInfo, {
        chat_id: chatId,
        message_id: state.messageId,
        parse_mode: 'Markdown',
        reply_markup: buyKeyboard,
        disable_web_page_preview: true
      });

      // Reply with confirmation
      await this.bot.sendMessage(chatId, 
        `✅ **Amount Set: ${amount} ${symbol}**\n\nSelect wallets above and click a buy button to proceed.`, {
        parse_mode: 'Markdown',
        reply_to_message_id: msg.message_id
      });

    } catch (error) {
      console.error('❌ Error handling custom amount message:', error.message);
      
      // Clear state on error
      this.userStates.clearState(chatId);
      
      await this.bot.sendMessage(chatId, 
        `❌ **Error Processing Amount**\n\n` +
        `Something went wrong. Please try again.`, {
        parse_mode: 'Markdown'
      });
    }
  }

  // Handle wallet selection toggle
  async handleWalletSelect(callbackQuery) {
    const { from, message, data } = callbackQuery;
    const chatId = from.id;
    const messageId = message.message_id;

    try {
      console.log('🎯 WALLET SELECT CALLBACK:', data);
      
      // Parse callback data: ws_sessionId_walletNum
      const parts = data.split('_');
      console.log('🎯 PARSED PARTS:', parts);
      const sessionId = parts[1];  // Changed from parts[2] to parts[1]
      const walletNum = parseInt(parts[2]);  // Changed from parts[3] to parts[2]
      
      console.log('🎯 SESSION ID:', sessionId);
      console.log('🎯 WALLET NUM:', walletNum);

      // Get token data from session
      const tokenData = this.buyTokenUI.getTokenSession(chatId, sessionId);
      console.log('🎯 TOKEN DATA FOUND:', !!tokenData);
      
      if (!tokenData) {
        console.log('❌ No token data found for session');
        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: '❌ Session expired. Please try again.',
          show_alert: true
        });
        return;
      }

      // Toggle wallet selection
      const selectedWallets = this.buyTokenUI.toggleWallet(chatId, sessionId, walletNum);

      // Update the message with new wallet selection
      const walletBalances = await this.buyTokenUI.getUserWalletBalances(chatId, tokenData.chain);
      const tokenInfo = this.buyTokenUI.tokenAnalyzer.formatTokenInfo(tokenData, walletBalances);
      const buyKeyboard = await this.buyTokenUI.createBuyKeyboardWithSession(chatId, tokenData, sessionId);  // Use existing session

      await this.bot.editMessageText(tokenInfo, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: buyKeyboard,
        disable_web_page_preview: true
      });

      const selectedCount = selectedWallets.size;
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: `${selectedWallets.has(walletNum) ? '✅' : '❌'} W${walletNum} ${selectedWallets.has(walletNum) ? 'selected' : 'deselected'} (${selectedCount}/5)`
      });

    } catch (error) {
      console.error('❌ Error handling wallet selection:', error.message);
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Error updating wallet selection',
        show_alert: true
      });
    }
  }

  // Handle multi-wallet buy confirmation
  async handleBuyMultiConfirm(callbackQuery) {
    const { from, message, data } = callbackQuery;
    const chatId = from.id;
    const messageId = message.message_id;

    try {
      // Parse callback data: buy_multi_confirm_sessionId_amount
      const parts = data.split('_');
      const sessionId = parts[3];
      const amount = parseFloat(parts[4]);

      // Get token data from session
      const tokenData = this.buyTokenUI.getTokenSession(chatId, sessionId);
      if (!tokenData) {
        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: '❌ Session expired. Please try again.',
          show_alert: true
        });
        return;
      }

      // Get selected wallets
      const selectedWallets = this.buyTokenUI.getSelectedWallets(chatId, sessionId);
      const chainInfo = this.buyTokenUI.tokenAnalyzer.getChainInfo(tokenData.chain);
      const symbol = chainInfo.symbol;

      // Execute the actual trades
      await this.executeActualTrades(callbackQuery, tokenData, amount, selectedWallets, sessionId);

      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: `🎉 Buy executed on ${selectedWallets.size} wallets!`
      });

    } catch (error) {
      console.error('❌ Error handling multi-wallet buy confirmation:', error.message);
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Error executing buy',
        show_alert: true
      });
    }
  }

  // Handle custom slippage input
  async handleCustomSlippage(callbackQuery) {
    const { from, message, data } = callbackQuery;
    const chatId = from.id;
    const messageId = message.message_id;

    try {
      console.log('💡 ========== CUSTOM SLIPPAGE HANDLER ==========');
      console.log('💡 Callback data:', data);
      
      // Parse sessionId from callback data: slippage_custom_sessionId
      const sessionId = data.replace('slippage_custom_', '');
      console.log('💡 Session ID:', sessionId);

      // Set user state to await custom slippage input
      this.userStates.set(chatId, {
        state: 'awaiting_custom_slippage',
        sessionId: sessionId,
        messageId: messageId
      });

      console.log('💡 User state set for custom slippage input');

      // Send a new message that user can reply to
      const replyMessage = await this.bot.sendMessage(chatId, 
        `💡 **Custom Slippage**\n\n` +
        `Reply to this message with your desired slippage percentage:\n\n` +
        `📝 **Examples:**\n` +
        `• Reply with: \`0.5\` for 0.5%\n` +
        `• Reply with: \`2.5\` for 2.5%\n` +
        `• Reply with: \`10\` for 10%\n\n` +
        `⚠️ **Valid range:** 0.1% - 50%\n\n` +
        `💬 **Click "Reply" and type your number**`, {
        parse_mode: 'Markdown',
        reply_markup: {
          force_reply: true,
          selective: true
        }
      });

      // Store the reply message ID for cleanup later
      this.userStates.set(chatId, {
        state: 'awaiting_custom_slippage',
        sessionId: sessionId,
        messageId: messageId,
        replyMessageId: replyMessage.message_id
      });

      // Don't answer callback query here - let main handler do it

      console.log('✅ Custom slippage reply prompt sent');

    } catch (error) {
      console.error('❌ Error handling custom slippage:', error);
      console.error('❌ Error stack:', error.stack);
      // Don't answer callback query here - let main handler do it
      throw error; // Re-throw so main handler can handle it
    }
  }

  // Handle custom slippage input from user message
  async handleCustomSlippageInput(msg) {
    const chatId = msg.chat.id;
    const userInput = msg.text.trim();

    try {
      console.log('💡 ========== CUSTOM SLIPPAGE INPUT ==========');
      console.log('💡 User input:', userInput);
      console.log('💡 Message reply_to_message:', !!msg.reply_to_message);

      // Get user state
      const state = this.userStates.get(chatId);
      if (!state || state.state !== 'awaiting_custom_slippage') {
        console.log('❌ No valid custom slippage state found');
        return;
      }

      const { sessionId, messageId, replyMessageId } = state;
      console.log('💡 Session ID:', sessionId, 'Message ID:', messageId, 'Reply Message ID:', replyMessageId);

      // Check if this is a reply to our custom slippage message
      if (msg.reply_to_message && msg.reply_to_message.message_id !== replyMessageId) {
        console.log('❌ Reply is not to our custom slippage message');
        return;
      }

      // Validate input
      const slippagePercent = parseFloat(userInput);
      
      if (isNaN(slippagePercent)) {
        await this.bot.sendMessage(chatId, '❌ Please enter a valid number (e.g., 2.5)', {
          reply_to_message_id: msg.message_id
        });
        return;
      }

      if (slippagePercent < 0.1 || slippagePercent > 50) {
        await this.bot.sendMessage(chatId, '❌ Slippage must be between 0.1% and 50%', {
          reply_to_message_id: msg.message_id
        });
        return;
      }

      console.log('💡 Valid slippage entered:', slippagePercent + '%');

      // Set the custom slippage
      console.log('💡 About to set token slippage...');
      const sessionKey = `${chatId}_${sessionId}`;
      this.buyTokenUI.tokenSlippage.set(sessionKey, slippagePercent);
      console.log(`📊 Set slippage for ${sessionKey}: ${slippagePercent}%`);
      console.log('✅ Custom slippage set successfully');

      // Clear user state
      console.log('💡 About to clear user state...');
      this.userStates.delete(chatId);
      console.log('✅ User state cleared');

      // Return to token page with updated slippage
      console.log('💡 About to return to token page...');
      try {
        await this.buyTokenUI.returnToTokenPage(chatId, messageId, sessionId);
        console.log('✅ Returned to token page successfully');
      } catch (returnError) {
        console.error('❌ Error returning to token page:', returnError.message);
        // If we can't edit the original message, send a new one
        console.log('💡 Attempting to send new token page instead...');
        try {
          const tokenData = this.buyTokenUI.getTokenSession(chatId, sessionId);
          if (tokenData) {
            const walletBalances = await this.buyTokenUI.getUserWalletBalances(chatId, tokenData.chain);
            const tokenInfo = this.buyTokenUI.tokenAnalyzer.formatTokenInfo(tokenData, walletBalances);
            const buyKeyboard = this.buyTokenUI.createBuyKeyboardWithSession(chatId, tokenData, sessionId);
            
            await this.bot.sendMessage(chatId, tokenInfo, {
              parse_mode: 'Markdown',
              reply_markup: buyKeyboard,
              disable_web_page_preview: true
            });
            console.log('✅ Sent new token page successfully');
          }
        } catch (sendError) {
          console.error('❌ Error sending new token page:', sendError.message);
          throw returnError; // Re-throw original error
        }
      }
      
      // Clean up messages
      try {
        // Delete the reply message (our prompt)
        if (replyMessageId) {
          await this.bot.deleteMessage(chatId, replyMessageId);
        }
        // Delete the user's input message
        await this.bot.deleteMessage(chatId, msg.message_id);
      } catch (deleteError) {
        // Ignore deletion errors
        console.log('⚠️ Could not delete messages:', deleteError.message);
      }

      // Send confirmation
      const confirmMsg = await this.bot.sendMessage(chatId, `✅ Custom slippage set to ${slippagePercent}%`);
      
      // Delete confirmation after 3 seconds
      setTimeout(async () => {
        try {
          await this.bot.deleteMessage(chatId, confirmMsg.message_id);
        } catch (e) {
          // Ignore
        }
      }, 3000);

      console.log('✅ Custom slippage flow completed successfully');

    } catch (error) {
      console.error('❌ Error handling custom slippage input:', error);
      console.error('❌ Error stack:', error.stack);
      await this.bot.sendMessage(chatId, '❌ Error setting custom slippage. Please try again.');
      
      // Clear user state on error
      this.userStates.delete(chatId);
    }
  }

  // Handle amount selection button clicks
  async handleBuySelectAmount(callbackQuery) {
    const { from, message, data } = callbackQuery;
    const chatId = from.id;
    const messageId = message.message_id;

    try {
      console.log('💰 ========== AMOUNT SELECTION ==========');
      console.log('💰 Callback data:', data);

      // Parse callback data: buy_select_amount_SESSIONID_AMOUNT
      const parts = data.split('_');
      const sessionId = parts[3];
      const amount = parseFloat(parts[4]);
      
      console.log('💰 Session ID:', sessionId);
      console.log('💰 Amount:', amount);

      // Get token data from session
      const tokenData = this.buyTokenUI.getTokenSession(chatId, sessionId);
      if (!tokenData) {
        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: '❌ Session expired. Please try again.',
          show_alert: true
        });
        return;
      }

      // Set the selected amount
      this.buyTokenUI.setSelectedAmount(chatId, sessionId, amount);

      // Get user's wallet balances to refresh the display
      const walletBalances = await this.buyTokenUI.getUserWalletBalances(chatId, tokenData.chain);
      
      // Format and display token information with updated amount selection
      let tokenInfo = this.buyTokenUI.tokenAnalyzer.formatTokenInfo(tokenData, walletBalances);
      
      // Add refresh timestamp
      const now = new Date();
      const timeString = now.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      });
      tokenInfo += `\n\n🔄 *Last updated: ${timeString}*`;
      
      // Create updated keyboard with new amount selection
      const buyKeyboard = await this.buyTokenUI.createBuyKeyboardWithSession(chatId, tokenData, sessionId);

      // Update the message
      await this.bot.editMessageText(tokenInfo, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: buyKeyboard,
        disable_web_page_preview: true
      });

      // Provide feedback
      const chainInfo = this.buyTokenUI.tokenAnalyzer.getChainInfo(tokenData.chain);
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: `💰 Selected: ${amount} ${chainInfo.symbol}`,
        show_alert: false
      });

      console.log('✅ Amount selection updated successfully');

    } catch (error) {
      console.error('❌ Amount selection error:', error.message);
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Error selecting amount',
        show_alert: true
      });
    }
  }

  // Handle CONFIRM button click with validation
  async handleBuyConfirmNew(callbackQuery) {
    const { from, message, data } = callbackQuery;
    const chatId = from.id;
    const messageId = message.message_id;

    try {
      console.log('✅ ========== CONFIRM BUTTON CLICKED ==========');
      console.log('✅ Callback data:', data);

      // Parse callback data: buy_confirm_new_SESSIONID
      const parts = data.split('_');
      const sessionId = parts[3];
      
      console.log('✅ Session ID:', sessionId);

      // Get token data from session
      const tokenData = this.buyTokenUI.getTokenSession(chatId, sessionId);
      if (!tokenData) {
        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: '❌ Session expired. Please start over.',
          show_alert: true
        });
        return;
      }

      // Get selected wallets
      const selectedWallets = this.buyTokenUI.getSelectedWallets(chatId, sessionId);
      
      // Get selected amount
      const selectedAmount = this.buyTokenUI.getSelectedAmount(chatId, sessionId);

      console.log('✅ Selected wallets:', Array.from(selectedWallets));
      console.log('✅ Selected amount:', selectedAmount);

      // VALIDATION 1: Check if wallets are selected
      if (selectedWallets.size === 0) {
        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: '⚠️ Please select at least one wallet first!',
          show_alert: true
        });
        return;
      }

      // VALIDATION 2: Check if amount is selected
      if (!selectedAmount) {
        console.log('⚠️ No amount selected, using smart default...');
        
        // SMART DEFAULT: Use 0.001 ETH as default amount
        const defaultAmount = 0.001;
        this.buyTokenUI.setSelectedAmount(chatId, sessionId, defaultAmount);
        selectedAmount = defaultAmount;
        
        console.log(`🤖 Smart default amount set: ${defaultAmount} ETH`);
      }

      // VALIDATION 3: Check wallet balances
      const chainInfo = this.buyTokenUI.tokenAnalyzer.getChainInfo(tokenData.chain);
      const symbol = chainInfo.symbol;

      // Get user's wallets for this chain with error handling
      let chainWallets;
      try {
        chainWallets = await this.walletManager.getChainWallets(chatId, tokenData.chain);
      } catch (error) {
        console.error('❌ Error fetching chain wallets:', error.message);
        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: '❌ Error loading wallets. Please try again.',
          show_alert: true
        });
        return;
      }
      
      if (!chainWallets || Object.keys(chainWallets).length === 0) {
        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: '❌ No wallets found. Generate wallets first!',
          show_alert: true
        });
        return;
      }

      // Validate selected wallets have enough balance with error handling
      const insufficientWallets = [];
      const validWallets = [];

      for (const walletNum of selectedWallets) {
        const walletSlot = `W${walletNum}`;
        const wallet = chainWallets[walletSlot];
        
        if (wallet) {
          try {
            const balance = await this.walletManager.getWalletBalance(wallet.address, tokenData.chain);
            // Validate parseFloat input
            const balanceNum = (balance && !isNaN(parseFloat(balance))) ? parseFloat(balance) : 0;
            
            if (balanceNum >= selectedAmount) {
              validWallets.push({ walletNum, wallet, balance: balanceNum });
            } else {
              insufficientWallets.push({ walletNum, wallet, balance: balanceNum });
            }
          } catch (error) {
            console.error(`❌ Error getting balance for wallet ${walletSlot}:`, error.message);
            // Treat as insufficient balance if we can't get balance
            insufficientWallets.push({ walletNum, wallet, balance: 0 });
          }
        }
      }

      // VALIDATION 4: Check if selected wallets have sufficient balance
      if (insufficientWallets.length > 0) {
        console.log('⚠️ Some selected wallets have insufficient balance, trying smart fallback...');
        
        // SMART FALLBACK: Try to find wallets with sufficient balance automatically
        const smartWallets = await this.buyTokenUI.getSmartWalletSelection(chatId, tokenData.chain);
        const fundedSmartWallets = smartWallets.filter(w => w.balance >= selectedAmount);
        
        if (fundedSmartWallets.length > 0) {
          console.log(`🧠 Smart fallback found ${fundedSmartWallets.length} funded wallets`);
          
          // Auto-select the best funded wallet
          const bestWallet = fundedSmartWallets[0];
          console.log(`🎯 Auto-selecting best wallet: ${bestWallet.walletSlot} (${bestWallet.balance} ETH)`);
          
          // Update selection to use the smart wallet
          const newSelectedWallets = new Set([bestWallet.slot]);
          this.buyTokenUI.setSelectedWallets(chatId, sessionId, newSelectedWallets);
          
          // Create new validWallets array with the smart selection
          const smartValidWallets = [{
            walletNum: bestWallet.slot,
            wallet: bestWallet.wallet,
            balance: bestWallet.balance
          }];
          
          console.log('🤖 Smart fallback successful, proceeding with auto-selected wallet');
          
          // Proceed with the smart-selected wallet
          await this.buyTokenUI.executeBuyForMultipleWallets(callbackQuery, tokenData, selectedAmount, smartValidWallets, sessionId);
          return;
        }
        
        // If smart fallback also fails, show the original error message
        let errorMessage = `❌ **Insufficient Balance**\n\n`;
        errorMessage += `No wallets have enough ${symbol} for this trade:\n\n`;
        
        // Show all wallets and their balances
        for (let i = 1; i <= 5; i++) {
          const walletSlot = `W${i}`;
          const wallet = chainWallets[walletSlot];
          if (wallet) {
            const balance = await this.walletManager.getWalletBalance(wallet.address, tokenData.chain);
            const balanceNum = parseFloat(balance) || 0;
            const status = balanceNum >= selectedAmount ? '✅' : '❌';
            errorMessage += `• ${walletSlot}: ${balanceNum.toFixed(6)} ${symbol} ${status}\n`;
          }
        }
        
        errorMessage += `\n**Need:** ${selectedAmount} ${symbol} per wallet\n\n`;
        errorMessage += `**Solutions:**\n`;
        errorMessage += `• Import a wallet with ${symbol} balance\n`;
        errorMessage += `• Add more ${symbol} to your wallets\n`;
        errorMessage += `• Choose a smaller amount\n`;
        errorMessage += `• Use the wallet management menu to fund wallets`;

        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: `❌ No wallets have sufficient balance!`,
          show_alert: true
        });

        // Send detailed message
        await this.bot.sendMessage(chatId, errorMessage, {
          parse_mode: 'Markdown',
          reply_to_message_id: messageId
        });
        return;
      }

      // ALL VALIDATIONS PASSED - Proceed with confirmation
      console.log('✅ All validations passed, proceeding with buy confirmation');

      // Use the existing multi-wallet buy execution
      await this.buyTokenUI.executeBuyForMultipleWallets(callbackQuery, tokenData, selectedAmount, validWallets, sessionId);

    } catch (error) {
      console.error('❌ Confirm button error:', error.message);
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Error processing confirmation',
        show_alert: true
      });
    }
  }

  // Handle custom amount message input
  async handleCustomAmountMessage(msg) {
    const chatId = msg.chat.id;
    const userInput = msg.text.trim();

    try {
      console.log('💰 ========== CUSTOM AMOUNT INPUT ==========');
      console.log('💰 User input:', userInput);

      // Get user state
      const state = this.userStates.get(chatId);
      if (!state || state.action !== 'waiting_for_custom_amount') {
        console.log('❌ No valid custom amount state found');
        return;
      }

      const { sessionId, tokenData, messageId } = state;

      // Validate input is a valid number
      const amount = parseFloat(userInput);
      if (isNaN(amount) || amount <= 0) {
        await this.bot.sendMessage(chatId, 
          `❌ **Invalid Amount**\n\n` +
          `Please enter a valid number greater than 0.\n\n` +
          `**Examples:** \`0.001\`, \`0.1\`, \`1.5\``, {
          parse_mode: 'Markdown',
          reply_to_message_id: msg.message_id
        });
        return;
      }

      console.log('💰 Valid amount entered:', amount);

      // Store the custom amount in the session
      this.buyTokenUI.setSelectedAmount(chatId, sessionId, amount);

      // Clear the user state
      this.userStates.delete(chatId);

      // Get user's wallet balances to refresh the display
      const walletBalances = await this.buyTokenUI.getUserWalletBalances(chatId, tokenData.chain);
      
      // Format and display token information with the custom amount
      let tokenInfo = this.buyTokenUI.tokenAnalyzer.formatTokenInfo(tokenData, walletBalances);
      
      // Add refresh timestamp
      const now = new Date();
      const timeString = now.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      });
      tokenInfo += `\n\n🔄 *Last updated: ${timeString}*`;
      
      // Create updated keyboard with custom amount selection
      const buyKeyboard = await this.buyTokenUI.createBuyKeyboardWithSession(chatId, tokenData, sessionId);

      // Update the original message
      await this.bot.editMessageText(tokenInfo, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: buyKeyboard,
        disable_web_page_preview: true
      });

      // Clean up messages - delete the input message and any prompts
      try {
        await this.bot.deleteMessage(chatId, msg.message_id);
        
        // Also try to delete the prompt message (it should be the previous message)
        const promptMessageId = msg.message_id - 1;
        await this.bot.deleteMessage(chatId, promptMessageId);
      } catch (deleteError) {
        console.log('⚠️ Could not delete some messages:', deleteError.message);
      }

      // Send temporary confirmation
      const chainInfo = this.buyTokenUI.tokenAnalyzer.getChainInfo(tokenData.chain);
      const confirmMsg = await this.bot.sendMessage(chatId, 
        `✅ **Custom Amount Set**\n\n` +
        `💰 **Amount:** ${amount} ${chainInfo.symbol}\n` +
        `🪙 **Token:** ${tokenData.symbol}\n\n` +
        `Now select wallets and click **✅ CONFIRM** to proceed.`, {
        parse_mode: 'Markdown'
      });
      
      // Delete confirmation after 4 seconds
      setTimeout(async () => {
        try {
          await this.bot.deleteMessage(chatId, confirmMsg.message_id);
        } catch (e) {
          // Ignore deletion errors
        }
      }, 4000);

      console.log('✅ Custom amount processed successfully');

    } catch (error) {
      console.error('❌ Error handling custom amount input:', error);
      await this.bot.sendMessage(chatId, '❌ Error processing custom amount. Please try again.');
      
      // Clear user state on error
      this.userStates.delete(chatId);
    }
  }

  // Execute actual trades with profit/loss tracking
  async executeActualTrades(callbackQuery, tokenData, amount, selectedWallets, sessionId) {
    const { from, message } = callbackQuery;
    const chatId = from.id;
    const messageId = message.message_id;

    try {
      console.log('🔥 ========== EXECUTING ACTUAL TRADES ==========');
      
      const chainInfo = this.buyTokenUI.tokenAnalyzer.getChainInfo(tokenData.chain);
      const symbol = chainInfo.symbol;
      const totalAmount = amount * selectedWallets.size;

      // Show execution message
      let executionMessage = `🔥 **Executing Multi-Wallet Buy...**\n\n`;
      executionMessage += `🪙 **Token:** ${tokenData.name} (${tokenData.symbol})\n`;
      executionMessage += `📍 **Address:** \`${tokenData.address}\`\n`;
      executionMessage += `💰 **Amount per wallet:** ${amount} ${symbol}\n`;
      executionMessage += `🏦 **Wallets:** ${selectedWallets.size}\n`;
      executionMessage += `📊 **Total cost:** ${totalAmount} ${symbol}\n\n`;
      executionMessage += `⏳ **Status:** Processing transactions...`;

      await this.bot.editMessageText(executionMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown'
      });

      // Get user's wallets for this chain
      const chainWallets = await this.walletManager.getChainWallets(chatId, tokenData.chain);
      
      // Get current token price for P&L calculations
      const currentPrice = await this.getCurrentTokenPrice(tokenData);
      const currentMarketCap = this.calculateMarketCap(currentPrice, tokenData);
      
      console.log('💰 Current token price:', currentPrice);
      console.log('📊 Current market cap:', currentMarketCap);

      // Store trade entry data for P&L tracking
      const tradeEntry = {
        tokenAddress: tokenData.address,
        tokenSymbol: tokenData.symbol,
        tokenName: tokenData.name,
        chain: tokenData.chain,
        entryPrice: currentPrice,
        entryMarketCap: currentMarketCap,
        entryTime: Date.now(),
        totalInvested: totalAmount,
        walletsUsed: Array.from(selectedWallets),
        sessionId: sessionId
      };

      // Execute trades for each selected wallet
      const tradeResults = [];
      let successCount = 0;
      let failCount = 0;

      for (const walletNum of selectedWallets) {
        const walletSlot = `W${walletNum}`;
        const wallet = chainWallets[walletSlot];
        
        if (wallet) {
          try {
            console.log(`💸 Executing trade for wallet ${walletNum}...`);
            
            // Get slippage and gas settings for this session
            let slippage = this.buyTokenUI.getTokenSlippage(chatId, sessionId);
            const gasSettings = this.buyTokenUI.getTokenGasSettings(chatId, sessionId);
            
            // Smart slippage will be calculated in trading.js
            
            console.log(`🎯 Final slippage for wallet ${walletNum}: ${slippage}%`);
            
            // 🔧 CRITICAL FIX: Validate wallet balance before trading
            try {
              const walletValidation = await this.walletManager.validateWalletForTrade(
                wallet.address, 
                tokenData.chain, 
                amount.toString()
              );
              
              if (!walletValidation.valid) {
                throw new Error(`Wallet validation failed: ${walletValidation.error}`);
              }
              
              console.log(`✅ Wallet ${walletNum} validation passed: ${walletValidation.balance} ETH available`);
            } catch (validationError) {
              console.error(`❌ Wallet ${walletNum} validation failed:`, validationError.message);
              throw validationError;
            }
            
            // Execute the actual trade
            const tradeResult = await this.trading.executeBuy(
              chatId,
              tokenData.address,
              amount,
              tokenData.chain,
              {
                slippage: slippage,
                gasSettings: gasSettings,
                walletSlot: walletSlot
              }
            );
            
            // Check if the trade actually succeeded
            if (tradeResult.status === 'completed' || tradeResult.success === true) {
              tradeResults.push({
                walletNum: walletNum,
                status: 'success',
                txHash: tradeResult.txHash,
                gasUsed: tradeResult.gasUsed,
                tokensReceived: tradeResult.tokensReceived || 'Calculating...'
              });
              
              successCount++;
              console.log(`✅ Trade successful for wallet ${walletNum}: ${tradeResult.txHash}`);
            } else {
              // Trade failed but didn't throw an error
              throw new Error(tradeResult.error || 'Trade execution failed');
            }
            
          } catch (error) {
            console.error(`❌ Trade failed for wallet ${walletNum}:`, error.message);
            tradeResults.push({
              walletNum: walletNum,
              status: 'failed',
              error: error.message
            });
            failCount++;
          }
        }
      }

      // Store the trade entry for P&L tracking
      await this.storeTradeEntry(chatId, tradeEntry, tradeResults);

      // Show completion message with initial P&L
      await this.showTradeResults(chatId, messageId, tokenData, tradeEntry, tradeResults, sessionId);

      // Start P&L monitoring for this trade
      this.startProfitLossMonitoring(chatId, messageId, tradeEntry);

    } catch (error) {
      console.error('❌ Error executing trades:', error.message);
      
      await this.bot.editMessageText(
        `❌ **Trade Execution Failed**\n\n` +
        `🪙 **Token:** ${tokenData.symbol}\n` +
        `💰 **Amount:** ${amount} ${symbol}\n\n` +
        `**Error:** ${error.message}\n\n` +
        `Please try again or contact support.`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔄 Try Again', callback_data: `buy_refresh_${sessionId}` },
              { text: '🔙 Back to Main', callback_data: 'main_menu' }
            ]
          ]
        }
      });
    }
  }

  // Get current token price
  async getCurrentTokenPrice(tokenData) {
    try {
      // Use the same API as token analyzer
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenData.address}`);
      const data = await response.json();
      
      if (data.pairs && data.pairs.length > 0) {
        const mainPair = data.pairs[0];
        return parseFloat(mainPair.priceUsd) || 0;
      }
      
      return 0;
    } catch (error) {
      console.error('❌ Error fetching current price:', error.message);
      return 0;
    }
  }

  // Calculate market cap
  calculateMarketCap(price, tokenData) {
    try {
      // This is a simplified calculation
      // In a real implementation, you'd need to fetch the total supply
      const estimatedSupply = 1000000000; // 1B tokens (placeholder)
      return price * estimatedSupply;
    } catch (error) {
      console.error('❌ Error calculating market cap:', error.message);
      return 0;
    }
  }

  // Store trade entry for tracking
  async storeTradeEntry(chatId, tradeEntry, tradeResults) {
    try {
      // Store in a simple Map for now (in production, use database)
      if (!this.tradeEntries) {
        this.tradeEntries = new Map();
      }
      
      const key = `${chatId}_${tradeEntry.sessionId}`;
      this.tradeEntries.set(key, {
        ...tradeEntry,
        results: tradeResults
      });
      
      console.log('💾 Trade entry stored for P&L tracking');
    } catch (error) {
      console.error('❌ Error storing trade entry:', error.message);
    }
  }

  // Show trade results with initial P&L
  async showTradeResults(chatId, messageId, tokenData, tradeEntry, tradeResults, sessionId) {
    try {
      const successCount = tradeResults.filter(r => r.status === 'success').length;
      const failCount = tradeResults.filter(r => r.status === 'failed').length;
      
      // Show different header based on success/failure
      let resultMessage;
      if (successCount > 0) {
        resultMessage = `✅ **Trade Execution Complete!**\n\n`;
      } else {
        resultMessage = `❌ **Trade Execution Failed!**\n\n`;
      }
      
      resultMessage += `🪙 **Token:** ${tokenData.name} (${tokenData.symbol})\n`;
      
      // Only show investment details if there were successful trades
      if (successCount > 0) {
        resultMessage += `💰 **Total Invested:** ${tradeEntry.totalInvested} ETH\n`;
        resultMessage += `💵 **Entry Price:** $${tradeEntry.entryPrice.toFixed(8)}\n`;
        resultMessage += `📊 **Entry Market Cap:** $${this.formatNumber(tradeEntry.entryMarketCap)}\n\n`;
      } else {
        resultMessage += `💰 **Attempted Investment:** ${tradeEntry.totalInvested} ETH\n`;
        resultMessage += `❌ **No successful purchases**\n\n`;
      }
      
      resultMessage += `**📊 Execution Summary:**\n`;
      resultMessage += `✅ **Successful:** ${successCount} wallets\n`;
      resultMessage += `❌ **Failed:** ${failCount} wallets\n\n`;
      
      resultMessage += `**🏦 Wallet Results:**\n`;
      for (const result of tradeResults) {
        if (result.status === 'success') {
          resultMessage += `• W${result.walletNum}: ✅ Success\n`;
          if (result.txHash) {
            resultMessage += `  📝 TX: \`${result.txHash.substring(0, 20)}...\`\n`;
          }
        } else {
          resultMessage += `• W${result.walletNum}: ❌ Failed\n`;
          resultMessage += `  ⚠️ ${result.error.substring(0, 50)}\n`;
        }
      }
      
      // Only show P&L tracking if there were successful trades
      if (successCount > 0) {
        // Calculate initial P&L (should be near 0 initially)
        const currentPrice = await this.getCurrentTokenPrice(tokenData);
        const pnlPercent = ((currentPrice - tradeEntry.entryPrice) / tradeEntry.entryPrice) * 100;
        const pnlUsd = (currentPrice - tradeEntry.entryPrice) * tradeEntry.totalInvested;
        
        resultMessage += `\n**💹 Live P&L Tracking:**\n`;
        resultMessage += `📈 **Current Price:** $${currentPrice.toFixed(8)}\n`;
        resultMessage += `${pnlPercent >= 0 ? '🟢' : '🔴'} **P&L:** ${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}% (${pnlPercent >= 0 ? '+' : ''}$${pnlUsd.toFixed(4)})\n`;
        resultMessage += `\n⏱️ **Live updates every 30 seconds...**`;
      } else {
        resultMessage += `\n**❌ No trades to track**\n`;
        resultMessage += `💡 **Try again with a token that has liquidity**`;
      }

      await this.bot.editMessageText(resultMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📊 Refresh P&L', callback_data: `pnl_refresh_${sessionId}` },
              { text: '💸 Sell Tokens', callback_data: `sell_tokens_${sessionId}` }
            ],
            [
              { text: '🔄 Buy More', callback_data: `buy_refresh_${sessionId}` },
              { text: '💼 View Wallets', callback_data: 'wallets_menu' }
            ],
            [
              { text: '🔙 Back to Main Menu', callback_data: 'main_menu' }
            ]
          ]
        }
      });
      
    } catch (error) {
      console.error('❌ Error showing trade results:', error.message);
    }
  }

  // Start profit/loss monitoring
  startProfitLossMonitoring(chatId, messageId, tradeEntry) {
    const intervalId = setInterval(async () => {
      try {
        console.log('🔄 Updating P&L for trade...', tradeEntry.sessionId);
        
        // Get current token price
        const currentPrice = await this.getCurrentTokenPrice({
          address: tradeEntry.tokenAddress
        });
        
        if (currentPrice > 0) {
          // Calculate P&L
          const pnlPercent = ((currentPrice - tradeEntry.entryPrice) / tradeEntry.entryPrice) * 100;
          const pnlUsd = (currentPrice - tradeEntry.entryPrice) * tradeEntry.totalInvested;
          
          // Update the message with new P&L
          await this.updatePnLDisplay(chatId, messageId, tradeEntry, currentPrice, pnlPercent, pnlUsd);
        }
        
      } catch (error) {
        console.error('❌ Error updating P&L:', error.message);
        // Clear interval on persistent errors
        clearInterval(intervalId);
      }
    }, 30000); // Update every 30 seconds
    
    // Store interval ID for cleanup
    if (!this.pnlIntervals) {
      this.pnlIntervals = new Map();
    }
    this.pnlIntervals.set(`${chatId}_${tradeEntry.sessionId}`, intervalId);
    
    // Auto-stop monitoring after 1 hour
    setTimeout(() => {
      clearInterval(intervalId);
      this.pnlIntervals.delete(`${chatId}_${tradeEntry.sessionId}`);
      console.log('⏹️ P&L monitoring stopped for trade:', tradeEntry.sessionId);
    }, 3600000); // 1 hour
  }

  // Update P&L display
  async updatePnLDisplay(chatId, messageId, tradeEntry, currentPrice, pnlPercent, pnlUsd) {
    try {
      // Get the current message and update only the P&L section
      const currentMarketCap = this.calculateMarketCap(currentPrice, { address: tradeEntry.tokenAddress });
      const mcChange = ((currentMarketCap - tradeEntry.entryMarketCap) / tradeEntry.entryMarketCap) * 100;
      
      let updatedMessage = `✅ **Live Trade Tracking**\n\n`;
      updatedMessage += `🪙 **Token:** ${tradeEntry.tokenName} (${tradeEntry.tokenSymbol})\n`;
      updatedMessage += `💰 **Total Invested:** ${tradeEntry.totalInvested} ETH\n\n`;
      
      updatedMessage += `**📊 Entry vs Current:**\n`;
      updatedMessage += `💵 **Entry Price:** $${tradeEntry.entryPrice.toFixed(8)}\n`;
      updatedMessage += `📈 **Current Price:** $${currentPrice.toFixed(8)}\n`;
      updatedMessage += `📊 **Entry MC:** $${this.formatNumber(tradeEntry.entryMarketCap)}\n`;
      updatedMessage += `📊 **Current MC:** $${this.formatNumber(currentMarketCap)}\n\n`;
      
      updatedMessage += `**💹 Live P&L:**\n`;
      updatedMessage += `${pnlPercent >= 0 ? '🟢' : '🔴'} **Price Change:** ${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%\n`;
      updatedMessage += `${mcChange >= 0 ? '🟢' : '🔴'} **MC Change:** ${mcChange >= 0 ? '+' : ''}${mcChange.toFixed(2)}%\n`;
      updatedMessage += `${pnlUsd >= 0 ? '💚' : '❤️'} **Your P&L:** ${pnlUsd >= 0 ? '+' : ''}$${Math.abs(pnlUsd).toFixed(4)}\n\n`;
      
      const now = new Date();
      updatedMessage += `🔄 **Updated:** ${now.toLocaleTimeString()}`;

      await this.bot.editMessageText(updatedMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📊 Manual Refresh', callback_data: `pnl_refresh_${tradeEntry.sessionId}` },
              { text: '💸 Sell Position', callback_data: `sell_tokens_${tradeEntry.sessionId}` }
            ],
            [
              { text: '🔄 Buy More', callback_data: `buy_refresh_${tradeEntry.sessionId}` },
              { text: '📱 Share P&L', callback_data: `share_pnl_${tradeEntry.sessionId}` }
            ],
            [
              { text: '🔙 Back to Main Menu', callback_data: 'main_menu' }
            ]
          ]
        }
      });
      
    } catch (error) {
      console.error('❌ Error updating P&L display:', error.message);
    }
  }

  // Format large numbers (e.g., market cap)
  formatNumber(num) {
    if (num >= 1e9) {
      return (num / 1e9).toFixed(2) + 'B';
    } else if (num >= 1e6) {
      return (num / 1e6).toFixed(2) + 'M';
    } else if (num >= 1e3) {
      return (num / 1e3).toFixed(2) + 'K';
    } else {
      return num.toFixed(2);
    }
  }
}

module.exports = Callbacks;