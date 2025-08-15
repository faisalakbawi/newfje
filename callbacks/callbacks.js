/**
 * LOOTER.AI CLONE - CALLBACKS HANDLER
 * All button interactions exactly like Looter.ai
 * 🚀 UPDATED: Removed authentication - All users can now trade!
 */

const WalletUI = require('./wallet-ui');
const TradingUI = require('./trading-ui');
const BuyTokenUI = require('./buy-token-ui');

class Callbacks {
  constructor(bot, auth, walletManager, trading, userStates, chainManager) {
    this.bot = bot;
    this.auth = auth;
    this.walletManager = walletManager;
    this.trading = trading;
    this.userStates = userStates;
    this.chainManager = chainManager;
    
    // UI helpers
    this.walletUI = new WalletUI(bot, walletManager, userStates);
    this.tradingUI = new TradingUI(bot, trading);
    this.buyTokenUI = new BuyTokenUI(bot, walletManager, chainManager);
  }

  // Main callback handler
  async handle(callbackQuery) {
    const { data, from, message } = callbackQuery;
    const chatId = from.id;
    const messageId = message.message_id;
    let acknowledged = false;

    try {
      // Helper function to acknowledge callback only once
      const acknowledge = async (text = null, showAlert = false) => {
        if (!acknowledged) {
          try {
            await this.bot.answerCallbackQuery(callbackQuery.id, {
              text: text,
              show_alert: showAlert
            });
            acknowledged = true;
          } catch (ackError) {
            console.error('❌ Failed to acknowledge callback:', ackError.message);
          }
        }
      };

      // 🚨 IMMEDIATELY acknowledge callback to prevent timeout
      await acknowledge();
      
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
      
      // 🔥 WALLET SELECTION FOR TRADING (ws_ callbacks)
      else if (data.startsWith('ws_')) {
        console.log('🔥 WALLET SELECT DETECTED! Data:', data);
        await this.handleWalletSelect(callbackQuery);
      }
      
      // Trading actions
      else if (data === 'buy_menu') {
        await this.buyTokenUI.handleBuyTokenMenu(chatId, messageId);
      }
      else if (data.startsWith('buy_select_amount_')) {
        await this.handleBuySelectAmount(callbackQuery);
      }
      else if (data.startsWith('buy_confirm_new_')) {
        await this.handleBuyConfirmNew(callbackQuery);
      }
      else if (data.startsWith('buy_refresh_')) {
        await this.handleBuyRefresh(callbackQuery);
      }
      else if (data.startsWith('buy_custom_')) {
        await this.handleBuyCustom(callbackQuery);
      }
      else if (data.startsWith('slippage_')) {
        await this.handleSlippage(callbackQuery);
      }
      else if (data.startsWith('gas_')) {
        await this.handleGas(callbackQuery);
      }
      // 💰 NEW: Speed tier selection
      else if (data.startsWith('speed_')) {
        await this.handleSpeedTier(callbackQuery);
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

    } catch (error) {
      console.error('❌ Callback error:', error.message);
      
      // Acknowledge callback even if there was an error
      if (!acknowledged) {
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
  }

  // Handle wallet selection toggle (ws_ callbacks)
  async handleWalletSelect(callbackQuery) {
    const { from, message, data } = callbackQuery;
    const chatId = from.id;
    const messageId = message.message_id;

    try {
      console.log('🎯 WALLET SELECT CALLBACK:', data);
      
      // Parse callback data: ws_sessionId_walletNum
      const parts = data.split('_');
      console.log('🎯 PARSED PARTS:', parts);
      const sessionId = parts[1];  // t1, t2, etc.
      const walletNum = parseInt(parts[2]);  // 1, 2, 3, 4, 5
      
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
      const buyKeyboard = await this.buyTokenUI.createBuyKeyboardWithSession(chatId, tokenData, sessionId);

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

  // Handle buy amount selection
  async handleBuySelectAmount(callbackQuery) {
    const { data } = callbackQuery;
    const chatId = callbackQuery.from.id;
    
    console.log('💰 BUY AMOUNT SELECTED:', data);
    
    try {
      // Parse: buy_select_amount_sessionId_amount
      const parts = data.split('_');
      const sessionId = parts[3]; // t1, t2, etc.
      const amount = parseFloat(parts[4]); // 0.01, 0.05, etc.
      
      console.log(`💰 Amount ${amount} ETH selected for session ${sessionId}`);
      
      // Store the selected amount in the buyTokenUI
      this.buyTokenUI.setSelectedAmount(chatId, sessionId, amount);
      
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: `💰 ${amount} ETH selected! Now select wallets and click CONFIRM.`
      });
      
    } catch (error) {
      console.error('❌ Error handling amount selection:', error.message);
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Error selecting amount',
        show_alert: true
      });
    }
  }

  // Handle buy confirmation
  async handleBuyConfirmNew(callbackQuery) {
    const { data } = callbackQuery;
    const chatId = callbackQuery.from.id;
    const messageId = callbackQuery.message.message_id;
    
    console.log('✅ BUY CONFIRM CLICKED:', data);
    
    try {
      // Parse: buy_confirm_new_sessionId
      const parts = data.split('_');
      const sessionId = parts[3]; // t1, t2, etc.
      
      // Get token data and selected options
      const tokenData = this.buyTokenUI.getTokenSession(chatId, sessionId);
      const selectedWallets = this.buyTokenUI.getSelectedWallets(chatId, sessionId);
      const selectedAmount = this.buyTokenUI.getSelectedAmount(chatId, sessionId);
      // 💰 NEW: Get selected speed tier
      const speedTier = this.buyTokenUI.getSpeedTier(chatId, sessionId);
      
      if (!tokenData) {
        await this.bot.sendMessage(chatId, '❌ Session expired. Please try again.');
        return;
      }
      
      if (selectedWallets.size === 0) {
        await this.bot.sendMessage(chatId, '❌ Please select at least one wallet first!');
        return;
      }
      
      if (!selectedAmount) {
        await this.bot.sendMessage(chatId, '❌ Please select an amount first!');
        return;
      }
      
      // 🚀 IMMEDIATELY show execution starting message
      await this.bot.sendMessage(chatId, 
        `🚀 **EXECUTING TRADE**\n\n` +
        `🪙 Token: ${tokenData.symbol}\n` +
        `💰 Amount: ${selectedAmount} ETH\n` +
        `⏳ Processing...`, 
        { parse_mode: 'Markdown' }
      );
      
      // Execute the buy using Multi-DEX Base Trading system (async, don't wait for callback ack)
      this.executeBuyTrade(callbackQuery, tokenData, selectedAmount, selectedWallets, sessionId, speedTier)
        .catch(error => {
          console.error('❌ Error in async buy execution:', error.message);
          this.bot.sendMessage(chatId, `❌ Trade failed: ${error.message}`);
        });
      
    } catch (error) {
      console.error('❌ Error in buy confirmation:', error.message);
      await this.bot.sendMessage(chatId, `❌ Error executing buy: ${error.message}`);
    }
  }

  // Execute the actual buy trade
  async executeBuyTrade(callbackQuery, tokenData, amount, selectedWallets, sessionId, speedTier = 'standard') {
    const chatId = callbackQuery.from.id;
    const messageId = callbackQuery.message.message_id;
    
    try {
      console.log('🚀 EXECUTING BUY TRADE...');
      console.log(`Token: ${tokenData.symbol} (${tokenData.address})`);
      console.log(`Amount: ${amount} ETH`);
      console.log(`Wallets: ${Array.from(selectedWallets).join(', ')}`);
      console.log(`💰 Speed Tier: ${speedTier}`);
      
      // 💰 Calculate platform fee based on speed tier
      const feeCalc = this.buyTokenUI.calculatePlatformFee(amount, speedTier);
      const speedConfig = this.buyTokenUI.getSpeedTierConfig(speedTier);
      
      console.log(`💰 Platform fee calculation:`);
      console.log(`  - Gross amount: ${feeCalc.grossAmount} ETH`);
      console.log(`  - Platform fee: ${feeCalc.feeAmount} ETH (${feeCalc.feePercent}%)`);
      console.log(`  - Net trade amount: ${feeCalc.netAmount} ETH`);
      
      // Show execution message
      await this.bot.editMessageText(
        `🚀 **Executing ${speedConfig.name} Buy Order...**\n\n` +
        `🪙 **Token:** ${tokenData.name} (${tokenData.symbol})\n` +
        `💰 **Amount:** ${amount} ETH per wallet\n` +
        `🏦 **Wallets:** ${Array.from(selectedWallets).map(w => `W${w}`).join(', ')}\n` +
        `⛓️ **Chain:** Base Network\n` +
        `${speedConfig.icon} **Speed:** ${speedConfig.name} (${speedConfig.feePercent}% fee)\n` +
        `💰 **Platform Fee:** ${feeCalc.feeAmount} ETH\n` +
        `💵 **Net Trade:** ${feeCalc.netAmount} ETH\n\n` +
        `⏳ **Processing transaction(s)...**\n` +
        `🔄 **Please wait for confirmation...**`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown'
      });
      
      // Get user wallets for Base chain
      const chainWallets = await this.walletManager.getChainWallets(chatId, 'base');
      
      let successCount = 0;
      let failCount = 0;
      const results = [];
      
      // Execute buy for each selected wallet
      for (const walletNum of selectedWallets) {
        const walletSlot = `W${walletNum}`;
        const wallet = chainWallets[walletSlot];
        
        if (!wallet || !wallet.privateKey) {
          console.log(`❌ Wallet ${walletSlot} not found or missing private key`);
          failCount++;
          continue;
        }
        
        try {
          console.log(`🔄 Executing trade with wallet ${walletSlot}: ${wallet.address}`);
          
          // 🚀 USE OUR BASE TRADING SERVICE WITH FEE COLLECTION
          console.log(`💰 Using BaseTrading service with fee collection enabled`);
          console.log(`🔍 this.trading exists: ${!!this.trading}`);
          console.log(`🔍 this.trading.baseTrading exists: ${!!this.trading?.baseTrading}`);
          console.log(`🔍 typeof this.trading.baseTrading: ${typeof this.trading?.baseTrading}`);
          console.log(`🔍 execBuyWithFee method exists: ${!!this.trading?.baseTrading?.execBuyWithFee}`);
          
          // List all available methods on baseTrading
          if (this.trading?.baseTrading) {
            console.log(`🔍 Available methods on baseTrading:`, Object.getOwnPropertyNames(Object.getPrototypeOf(this.trading.baseTrading)));
            console.log(`🔍 All properties on baseTrading:`, Object.keys(this.trading.baseTrading));
          }
          
          if (!this.trading || !this.trading.baseTrading) {
            throw new Error('BaseTrading service is not available in callbacks');
          }
          
          if (typeof this.trading.baseTrading.execBuyWithFee !== 'function') {
            throw new Error('execBuyWithFee method is not available on baseTrading service');
          }
          
          // 💰 Execute trade using our fee collection system
          // This will automatically deduct fees and transfer them to treasury wallet
          console.log(`🚀 Executing tiered trade with fee collection...`);
          console.log(`  💰 Token: ${tokenData.address}`);
          console.log(`  💰 Amount: ${amount} ETH`);
          console.log(`  ⚡ Speed Tier: ${speedTier} (${speedTier === 'fast' ? '0.5%' : speedTier === 'instant' ? '1.0%' : '0.3%'} fee)`);
          
          // 💰 Execute trade with 30-second timeout using the correct method
          console.log(`🚀 Starting execBuyWithFee with 30s timeout...`);
          
          // Calculate fee info for the trade
          const feeCalc = this.buyTokenUI.calculatePlatformFee(amount, speedTier);
          const speedConfig = this.buyTokenUI.getSpeedTierConfig(speedTier);
          
          console.log(`💰 Using execBuyWithFee method with fee info:`, {
            grossAmount: feeCalc.grossAmount,
            feeAmount: feeCalc.feeAmount,
            netAmount: feeCalc.netAmount,
            feePercent: feeCalc.feePercent
          });
          
          const result = await Promise.race([
            this.trading.baseTrading.execBuyWithFee({
              privateKey: wallet.privateKey,
              tokenOut: tokenData.address,
              amountEth: amount, // Gross amount
              slippageBps: 2500, // 25% slippage
              feeTier: 3000, // 0.3% pool fee
              userTier: speedTier.toUpperCase() + '_TIER',
              feeInfo: {
                feeAmount: feeCalc.feeAmount,
                netAmount: feeCalc.netAmount,
                feePercent: feeCalc.feePercent
              },
              gasSettings: {
                gasPrice: speedConfig.gasPrice || 1000000000, // 1 gwei default
                gasLimit: speedConfig.gasLimit || 300000
              }
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Trade execution timeout (30s)')), 30000)
            )
          ]);
          console.log(`✅ execBuyWithFee completed successfully!`);
          
          if (result.success) {
            console.log(`✅ Buy successful for ${walletSlot}: ${result.txHash}`);
            
            // Log fee transfer result
            if (result.feeTransfer) {
              if (result.feeTransfer.success && !result.feeTransfer.skipped) {
                console.log(`💳 Fee transfer successful: ${result.feeInfo.feeAmount} ETH → Treasury`);
              } else {
                console.log(`💰 Fee transfer skipped: ${result.feeTransfer.reason || 'unknown'}`);
              }
            }
            
            results.push({
              wallet: walletSlot,
              success: true,
              txHash: result.txHash,
              explorerUrl: result.explorerUrl,
              // 💰 Actual fee information from our system
              feeInfo: result.feeInfo,
              feeTransfer: result.feeTransfer,
              userTier: result.userTier,
              gasUsed: result.gasUsed
            });
            successCount++;
          } else {
            console.log(`❌ Buy failed for ${walletSlot}: ${result.error}`);
            results.push({
              wallet: walletSlot,
              success: false,
              error: result.error
            });
            failCount++;
          }
          
        } catch (error) {
          console.error(`❌ Exception during buy for ${walletSlot}:`, error.message);
          results.push({
            wallet: walletSlot,
            success: false,
            error: error.message
          });
          failCount++;
        }
      }
      
      // Show results with safe message formatting
      let resultMessage = `🎉 **Buy Order Complete!**\n\n`;
      resultMessage += `📊 **Summary:**\n`;
      resultMessage += `• ✅ Successful: ${successCount}\n`;
      resultMessage += `• ❌ Failed: ${failCount}\n\n`;
      
      if (successCount > 0) {
        resultMessage += `✅ **Successful Transactions:**\n`;
        results.filter(r => r.success).forEach(r => {
          // Safe formatting for links and special characters
          const txHashShort = r.txHash ? r.txHash.substring(0, 10) + '...' : 'N/A';
          resultMessage += `• **${r.wallet}:** \`${txHashShort}\`\n`;
        });
        resultMessage += '\n';
        
        // Add transaction links in a safe way
        resultMessage += `🔗 **View on BaseScan:**\n`;
        results.filter(r => r.success).forEach(r => {
          if (r.txHash) {
            resultMessage += `${r.wallet}: https://basescan.org/tx/${r.txHash}\n`;
          }
        });
        resultMessage += '\n';
      }
      
      if (failCount > 0) {
        resultMessage += `❌ **Failed Transactions:**\n`;
        results.filter(r => !r.success).forEach(r => {
          // Clean error messages to avoid special characters
          const cleanError = r.error.replace(/[_*\[\]()~`>#+=|{}.!-]/g, '').substring(0, 100);
          resultMessage += `• **${r.wallet}:** ${cleanError}\n`;
        });
      }
      
      await this.bot.editMessageText(resultMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔄 Buy More', callback_data: `buy_refresh_${sessionId}` },
              { text: '🏠 Main Menu', callback_data: 'main_menu' }
            ]
          ]
        },
        disable_web_page_preview: true
      });
      
      // Best-effort: callback queries expire quickly; ignore errors
      try {
        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: `🎉 ${successCount} successful, ${failCount} failed`
        });
      } catch (ackErr) {
        console.warn('⚠️ CallbackQuery expired or invalid, ignoring:', ackErr.message);
      }
      
    } catch (error) {
      console.error('❌ Error executing buy trade:', error.message);
      
      await this.bot.editMessageText(
        `❌ **Buy Order Failed**\n\n` +
        `💥 **Error:** ${error.message}\n\n` +
        `💡 **Please try again or contact support**`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔄 Try Again', callback_data: `buy_refresh_${sessionId}` },
              { text: '🏠 Main Menu', callback_data: 'main_menu' }
            ]
          ]
        }
      });
    }
  }

  // Placeholder handlers for other actions
  async handleBuyRefresh(callbackQuery) {
    await this.bot.answerCallbackQuery(callbackQuery.id, {
      text: '🔄 Refresh functionality coming soon!',
      show_alert: true
    });
  }

  async handleBuyCustom(callbackQuery) {
    const { data } = callbackQuery;
    const chatId = callbackQuery.from.id;
    const messageId = callbackQuery.message.message_id;
    
    console.log('💰 BUY CUSTOM AMOUNT CLICKED:', data);
    
    try {
      // Parse: buy_custom_sessionId
      const parts = data.split('_');
      const sessionId = parts[2]; // t1, t2, etc.
      
      console.log(`💰 Setting up custom amount input for session ${sessionId}`);
      
      // Get token data for context
      const tokenData = this.buyTokenUI.getTokenSession(chatId, sessionId);
      
      if (!tokenData) {
        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: '❌ Session expired. Please try again.',
          show_alert: true
        });
        return;
      }
      
      // Set user state to expect custom amount input using UserStates class
      this.userStates.setCustomAmountState(chatId, {
        sessionId: sessionId,
        tokenData: tokenData,
        messageId: messageId
      });
      
      // Show custom amount input message
      const inputMessage = 
        `💰 **Custom Amount Input**\n\n` +
        `🪙 **Token:** ${tokenData.name} (${tokenData.symbol})\n` +
        `⛓️ **Chain:** Base Network\n\n` +
        `💡 **Please enter the amount of ETH you want to spend:**\n\n` +
        `**Examples:**\n` +
        `• \`0.01\` - Spend 0.01 ETH\n` +
        `• \`0.05\` - Spend 0.05 ETH\n` +
        `• \`0.1\` - Spend 0.1 ETH\n` +
        `• \`1.5\` - Spend 1.5 ETH\n\n` +
        `⚠️ **Note:** Amount will be spent from each selected wallet\n\n` +
        `📝 **Type your amount and send it as a message:**`;
      
      const keyboard = {
        inline_keyboard: [
          [
            { text: '❌ Cancel', callback_data: `buy_refresh_${sessionId}` }
          ]
        ]
      };
      
      await this.bot.editMessageText(inputMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
      
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: '💰 Please type your custom amount in ETH'
      });
      
    } catch (error) {
      console.error('❌ Error handling custom amount input:', error.message);
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Error setting up custom amount input',
        show_alert: true
      });
    }
  }

  async handleSlippage(callbackQuery) {
    await this.bot.answerCallbackQuery(callbackQuery.id, {
      text: '📊 Slippage settings coming soon!',
      show_alert: true
    });
  }

  async handleGas(callbackQuery) {
    await this.bot.answerCallbackQuery(callbackQuery.id, {
      text: '⛽ Gas settings coming soon!',
      show_alert: true
    });
  }

  // 💰 Handle speed tier selection
  async handleSpeedTier(callbackQuery) {
    const { data, from, message } = callbackQuery;
    const chatId = from.id;
    const messageId = message.message_id;
    
    try {
      // Parse: speed_sessionId_tier
      const parts = data.split('_');
      const sessionId = parts[1]; // t1, t2, etc.
      const tier = parts[2]; // standard, fast, instant
      
      console.log(`💰 Speed tier selected: ${tier} for session ${sessionId}`);
      
      // Set the speed tier
      this.buyTokenUI.setSpeedTier(chatId, sessionId, tier);
      
      // Get tier config for confirmation
      const config = this.buyTokenUI.getSpeedTierConfig(tier);
      
      // Update the buy interface to show the new selection
      const tokenData = this.buyTokenUI.getTokenSession(chatId, sessionId);
      
      if (!tokenData) {
        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: '❌ Session expired. Please try again.',
          show_alert: true
        });
        return;
      }
      
      // Refresh the buy interface
      const walletBalances = await this.buyTokenUI.getUserWalletBalances(chatId, tokenData.chain);
      const tokenInfo = this.buyTokenUI.tokenAnalyzer.formatTokenInfo(tokenData, walletBalances);
      const buyKeyboard = await this.buyTokenUI.createBuyKeyboardWithSession(chatId, tokenData, sessionId);
      
      await this.bot.editMessageText(tokenInfo, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: buyKeyboard,
        disable_web_page_preview: true
      });
      
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: `${config.icon} ${config.name} selected! Fee: ${config.feePercent}% | ${config.description}`
      });
      
    } catch (error) {
      console.error('❌ Error handling speed tier selection:', error.message);
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Error setting speed tier',
        show_alert: true
      });
    }
  }

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

  async handleBuyAction(callbackQuery) {
    await this.bot.answerCallbackQuery(callbackQuery.id, {
      text: '🔥 Buy functionality with Multi-DEX Base Trading (Uniswap V3, Aerodrome, SushiSwap, PancakeSwap, BaseSwap)!',
      show_alert: true
    });
  }

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

  async handleExpertMode(callbackQuery) {
    await this.bot.answerCallbackQuery(callbackQuery.id, {
      text: '🎯 Expert mode coming soon!',
      show_alert: true
    });
  }

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

  // Placeholder message handlers
  async handleWalletImport(msg) {
    const chatId = msg.chat.id;
    await this.walletManager.ensureUserExists(chatId, msg.from);
    await this.walletUI.handleWalletImport(msg);
  }

  async handleTransferMessage(msg) {
    const chatId = msg.chat.id;
    await this.walletManager.ensureUserExists(chatId, msg.from);
    await this.bot.sendMessage(chatId, '💸 Transfer functionality coming soon!');
  }

  async handleCustomAmountMessage(msg) {
    const chatId = msg.chat.id;
    await this.walletManager.ensureUserExists(chatId, msg.from);
    
    // Check if user is waiting for custom amount input
    const userState = this.userStates.getState(chatId);
    
    if (!userState || userState.action !== 'waiting_for_custom_amount') {
      // Not waiting for custom amount - ignore this message
      return;
    }
    
    const sessionId = userState.sessionId;
    const amountText = msg.text.trim();
    
    console.log(`💰 Processing custom amount input: "${amountText}" for session ${sessionId}`);
    
    try {
      // Validate the amount
      const amount = parseFloat(amountText);
      
      if (isNaN(amount) || amount <= 0) {
        await this.bot.sendMessage(chatId, 
          `❌ **Invalid Amount**\n\n` +
          `Please enter a valid positive number.\n` +
          `Example: \`0.1\` for 0.1 ETH\n\n` +
          `📝 Try again:`, {
          parse_mode: 'Markdown'
        });
        return;
      }
      
      if (amount > 100) {
        await this.bot.sendMessage(chatId,
          `⚠️ **Amount Too Large**\n\n` +
          `Maximum amount is 100 ETH for safety.\n` +
          `Please enter a smaller amount.\n\n` +
          `📝 Try again:`, {
          parse_mode: 'Markdown'
        });
        return;
      }
      
      // Amount is valid - store it and show the buy interface again
      this.buyTokenUI.setSelectedAmount(chatId, sessionId, amount);
      
      // Clear the user state
      this.userStates.clearState(chatId);
      
      // Get token data
      const tokenData = this.buyTokenUI.getTokenSession(chatId, sessionId);
      
      if (!tokenData) {
        await this.bot.sendMessage(chatId,
          `❌ **Session Expired**\n\n` +
          `Please start a new token purchase.`, {
          parse_mode: 'Markdown'
        });
        return;
      }
      
      // Show success message and return to buy interface
      await this.bot.sendMessage(chatId,
        `✅ **Custom Amount Set**\n\n` +
        `💰 **Amount:** ${amount} ETH\n` +
        `🪙 **Token:** ${tokenData.symbol}\n\n` +
        `Now select your wallets and click CONFIRM to execute the trade!`, {
        parse_mode: 'Markdown'
      });
      
      // Update the buy interface to show the new amount
      const walletBalances = await this.buyTokenUI.getUserWalletBalances(chatId, tokenData.chain);
      const tokenInfo = this.buyTokenUI.tokenAnalyzer.formatTokenInfo(tokenData, walletBalances);
      const buyKeyboard = await this.buyTokenUI.createBuyKeyboardWithSession(chatId, tokenData, sessionId, amount);
      
      await this.bot.sendMessage(chatId, tokenInfo, {
        parse_mode: 'Markdown',
        reply_markup: buyKeyboard,
        disable_web_page_preview: true
      });
      
    } catch (error) {
      console.error('❌ Error processing custom amount:', error.message);
      
      await this.bot.sendMessage(chatId,
        `❌ **Error Processing Amount**\n\n` +
        `There was an error processing your amount.\n` +
        `Please try again or use the preset amounts.`, {
        parse_mode: 'Markdown'
      });
      
      // Clear the user state
      this.userStates.clearState(chatId);
    }
  }

  async handleCustomSlippageInput(msg) {
    const chatId = msg.chat.id;
    await this.walletManager.ensureUserExists(chatId, msg.from);
    await this.bot.sendMessage(chatId, '📊 Custom slippage functionality coming soon!');
  }
}

module.exports = Callbacks;