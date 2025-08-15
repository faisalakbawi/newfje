/**
 * BUY TOKEN UI - Looter.ai style token buying interface
 * Handles token analysis, display, and buy execution
 */

const TokenAnalyzer = require('../trading/token-analyzer');

class BuyTokenUI {
  constructor(bot, walletManager, chainManager) {
    this.bot = bot;
    this.walletManager = walletManager;
    this.chainManager = chainManager;
    this.tokenAnalyzer = new TokenAnalyzer(chainManager);
    
    // Store user states for buy flow
    this.userStates = new Map();
    
    // Store token sessions with short IDs (to avoid Telegram callback data limit)
    this.tokenSessions = new Map();
    this.sessionCounter = 1;
    
    // Track selected wallets per user per session
    this.walletSelections = new Map();
    
    // Store slippage per token session
    this.tokenSlippage = new Map();
    
    // Store gas settings per token session
    this.tokenGasSettings = new Map();
    
    // 💰 NEW: Store speed tier per session (for revenue)
    this.speedTiers = new Map();
    
    // Track selected amounts per session
    this.amountSelections = new Map();
    
    // Cleanup old sessions periodically (every 30 minutes)
    setInterval(() => this.cleanupOldSessions(), 30 * 60 * 1000);
  }

  // Clean up old sessions to prevent memory leaks
  cleanupOldSessions() {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour
    
    let cleanedCount = 0;
    
    // Clean up token sessions
    for (const [sessionId, sessionData] of this.tokenSessions.entries()) {
      if (now - sessionData.createdAt > maxAge) {
        this.tokenSessions.delete(sessionId);
        cleanedCount++;
        
        // Clean up related data
        for (const [key, value] of this.walletSelections.entries()) {
          if (key.includes(`_${sessionId}`)) {
            this.walletSelections.delete(key);
          }
        }
        
        for (const [key, value] of this.amountSelections.entries()) {
          if (key.includes(`_${sessionId}`)) {
            this.amountSelections.delete(key);
          }
        }
        
        for (const [key, value] of this.tokenSlippage.entries()) {
          if (key.includes(`_${sessionId}`)) {
            this.tokenSlippage.delete(key);
          }
        }
        
        for (const [key, value] of this.tokenGasSettings.entries()) {
          if (key.includes(`_${sessionId}`)) {
            this.tokenGasSettings.delete(key);
          }
        }
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} old token sessions`);
    }
  }

  // Handle Buy Token button click
  async handleBuyTokenMenu(chatId, messageId) {
    try {
      const message = 
        `🔥 **Buy Token**\n\n` +
        `Send me a **contract address (CA)** and I'll analyze the token for you!\n\n` +
        `📝 **Supported formats:**\n` +
        `• **EVM chains:** \`0x1234...5678\` (Ethereum, Base, BSC, etc.)\n` +
        `• **Solana:** \`ABC123...XYZ789\` (Base58 format)\n\n` +
        `🤖 **I'll automatically:**\n` +
        `• Detect the blockchain\n` +
        `• Fetch token information\n` +
        `• Show price, market cap, taxes\n` +
        `• Provide buy options\n\n` +
        `💡 **Just paste the contract address below!**`;

      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📋 Example: ETH Token', callback_data: 'buy_example_eth' },
              { text: '📋 Example: SOL Token', callback_data: 'buy_example_sol' }
            ],
            [
              { text: '🔙 Back to Main Menu', callback_data: 'main_menu' }
            ]
          ]
        }
      });

      // Set user state to expect contract address
      this.userStates.set(chatId, {
        action: 'waiting_for_contract_address',
        messageId: messageId
      });

    } catch (error) {
      console.error('❌ Error showing buy token menu:', error.message);
    }
  }

  // Handle contract address input
  async handleContractAddress(msg) {
    const chatId = msg.chat.id;
    const contractAddress = msg.text.trim();

    try {
      // Show analyzing message
      const analyzingMsg = await this.bot.sendMessage(chatId, 
        `🔍 **Analyzing Token...**\n\n` +
        `📝 **Contract:** \`${contractAddress}\`\n` +
        `⏳ Detecting blockchain and fetching data...`, {
        parse_mode: 'Markdown'
      });

      // Analyze the token
      const analysis = await this.tokenAnalyzer.analyzeToken(contractAddress);
      
      if (!analysis.success) {
        throw new Error(analysis.error);
      }
      
      const tokenData = analysis.data;
      
      // Get user's wallet balances for this chain
      const walletBalances = await this.getUserWalletBalances(chatId, tokenData.chain);
      
      // Format and display token information
      const tokenInfo = this.tokenAnalyzer.formatTokenInfo(tokenData, walletBalances);
      
      // Create buy buttons with smart wallet selection
      const buyKeyboard = await this.createBuyKeyboard(chatId, tokenData);

      // Update the analyzing message with token info
      await this.bot.editMessageText(tokenInfo, {
        chat_id: chatId,
        message_id: analyzingMsg.message_id,
        parse_mode: 'Markdown',
        reply_markup: buyKeyboard,
        disable_web_page_preview: true
      });

      // Store token data for buy actions
      this.userStates.set(chatId, {
        action: 'token_analyzed',
        tokenData: tokenData,
        messageId: analyzingMsg.message_id
      });

    } catch (error) {
      console.error('❌ Token analysis error:', error.message);
      
      await this.bot.sendMessage(chatId, 
        `❌ **Token Analysis Failed**\n\n` +
        `📝 **Contract:** \`${contractAddress}\`\n` +
        `💥 **Error:** ${error.message}\n\n` +
        `💡 **Please check:**\n` +
        `• Contract address is correct\n` +
        `• Token exists on supported chains\n` +
        `• Network connection is stable`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Try Again', callback_data: 'buy_menu' }],
            [{ text: '🔙 Back to Main Menu', callback_data: 'main_menu' }]
          ]
        }
      });
    }
  }

  // Get user's wallet balances for the token's chain with smart prioritization
  async getUserWalletBalances(chatId, chain) {
    try {
      const chainWallets = await this.walletManager.getChainWallets(chatId, chain);
      const balances = {};

      if (chainWallets) {
        for (let i = 1; i <= 5; i++) {
          const walletSlot = `W${i}`;
          const wallet = chainWallets[walletSlot];
          
          if (wallet) {
            try {
              const balance = await this.walletManager.getWalletBalance(wallet.address, chain);
              balances[walletSlot] = balance || '0';
            } catch (error) {
              console.error(`❌ Error getting balance for ${walletSlot}:`, error.message);
              balances[walletSlot] = '0';
            }
          } else {
            balances[walletSlot] = '0';
          }
        }
      } else {
        // No wallets generated yet
        for (let i = 1; i <= 5; i++) {
          balances[`W${i}`] = '0';
        }
      }

      return balances;
    } catch (error) {
      console.error('❌ Error getting wallet balances:', error.message);
      return {};
    }
  }

  // Smart wallet selection - prioritize recently imported/replaced wallets with balance
  async getSmartWalletSelection(chatId, chain) {
    try {
      console.log('🧠 Smart wallet selection for user:', chatId, 'chain:', chain);
      
      const chainWallets = await this.walletManager.getChainWallets(chatId, chain);
      const walletPriorities = [];

      // Analyze each wallet and assign priority scores
      for (let i = 1; i <= 5; i++) {
        const walletSlot = `W${i}`;
        const wallet = chainWallets[walletSlot];
        
        if (wallet) {
          let balance = 0;
          try {
            const balanceStr = await this.walletManager.getWalletBalance(wallet.address, chain);
            balance = (balanceStr && !isNaN(parseFloat(balanceStr))) ? parseFloat(balanceStr) : 0;
          } catch (error) {
            console.error(`❌ Error getting balance for ${walletSlot}:`, error.message);
            balance = 0; // Default to 0 if balance fetch fails
          }
          
          const createdAt = new Date(wallet.createdAt).getTime();
          const isImported = wallet.isImported || false;
          
          // Calculate priority score
          let priorityScore = 0;
          
          // 1. Imported wallets get highest priority (100 points)
          if (isImported) {
            priorityScore += 100;
            console.log(`🎯 ${walletSlot}: +100 points (imported wallet)`);
          }
          
          // 2. Wallets with balance get high priority (50 points + balance weight)
          if (balance > 0) {
            priorityScore += 50 + Math.min(balance * 10, 50); // Cap at 50 extra points
            console.log(`🎯 ${walletSlot}: +${50 + Math.min(balance * 10, 50)} points (has balance: ${balance})`);
          }
          
          // 3. More recent wallets get priority (up to 20 points)
          const ageInDays = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
          const recencyScore = Math.max(0, 20 - ageInDays);
          priorityScore += recencyScore;
          console.log(`🎯 ${walletSlot}: +${recencyScore.toFixed(1)} points (recency)`);
          
          walletPriorities.push({
            slot: i,
            walletSlot,
            wallet,
            balance,
            isImported,
            createdAt,
            priorityScore,
            address: wallet.address
          });
          
          console.log(`🎯 ${walletSlot}: Total score = ${priorityScore.toFixed(1)} (${wallet.address})`);
        }
      }

      // Sort by priority score (highest first)
      walletPriorities.sort((a, b) => b.priorityScore - a.priorityScore);
      
      console.log('🧠 Wallet priority ranking:');
      walletPriorities.forEach((w, index) => {
        console.log(`   ${index + 1}. ${w.walletSlot}: ${w.priorityScore.toFixed(1)} points (${w.balance} ETH) ${w.isImported ? '[IMPORTED]' : '[GENERATED]'}`);
      });

      return walletPriorities;
    } catch (error) {
      console.error('❌ Error in smart wallet selection:', error.message);
      return [];
    }
  }

  // Auto-select the best wallet for trading
  async autoSelectBestWallet(chatId, sessionId, chain) {
    try {
      console.log('🤖 Auto-selecting best wallet for trading...');
      
      const walletPriorities = await this.getSmartWalletSelection(chatId, chain);
      
      if (walletPriorities.length === 0) {
        console.log('❌ No wallets available for auto-selection');
        return false;
      }

      // Find the best wallet (highest priority with balance > 0)
      const bestWallet = walletPriorities.find(w => w.balance > 0);
      
      if (bestWallet) {
        console.log(`🎯 Auto-selected best wallet: ${bestWallet.walletSlot} (${bestWallet.balance} ETH, score: ${bestWallet.priorityScore.toFixed(1)})`);
        
        // Auto-select this wallet
        const selectedWallets = new Set([bestWallet.slot]);
        this.setSelectedWallets(chatId, sessionId, selectedWallets);
        
        return bestWallet;
      } else {
        console.log('⚠️ No wallets with balance found for auto-selection');
        
        // Select the highest priority wallet even if it has 0 balance
        const fallbackWallet = walletPriorities[0];
        console.log(`🎯 Fallback selection: ${fallbackWallet.walletSlot} (score: ${fallbackWallet.priorityScore.toFixed(1)})`);
        
        const selectedWallets = new Set([fallbackWallet.slot]);
        this.setSelectedWallets(chatId, sessionId, selectedWallets);
        
        return fallbackWallet;
      }
    } catch (error) {
      console.error('❌ Error in auto wallet selection:', error.message);
      return false;
    }
  }

  // Create buy keyboard with amount options
  async createBuyKeyboard(chatId, tokenData) {
    console.log('🔧 Creating buy keyboard for chatId:', chatId);
    console.log('🔧 Token data:', tokenData.symbol);
    
    const chainInfo = this.tokenAnalyzer.getChainInfo(tokenData.chain);
    const symbol = chainInfo.symbol;
    
    // Create a session for this token to avoid long callback data
    const sessionId = this.createTokenSession(chatId, tokenData);
    console.log('🔧 Created session ID:', sessionId);
    
    return await this.buildKeyboard(chatId, sessionId, tokenData, symbol);
  }

  // Create buy keyboard using existing session (for updates)
  async createBuyKeyboardWithSession(chatId, tokenData, sessionId, customAmount = null) {
    console.log('🔧 Creating buy keyboard with existing session:', sessionId);
    console.log('🔧 Token data:', tokenData.symbol);
    console.log('🔧 Custom amount:', customAmount);
    
    // If custom amount is provided, set it
    if (customAmount) {
      this.setSelectedAmount(chatId, sessionId, customAmount);
    }
    
    const chainInfo = this.tokenAnalyzer.getChainInfo(tokenData.chain);
    const symbol = chainInfo.symbol;
    
    return await this.buildKeyboard(chatId, sessionId, tokenData, symbol);
  }

  // Build the actual keyboard (shared logic)
  async buildKeyboard(chatId, sessionId, tokenData, symbol) {
    // Get selected wallets for this session
    const selectedWallets = this.getSelectedWallets(chatId, sessionId);
    console.log('🔧 Selected wallets:', Array.from(selectedWallets));
    
    // Get wallet balances to show in buttons
    const walletBalances = await this.getUserWalletBalances(chatId, tokenData.chain);
    
    // Create wallet selection row with balance info
    const walletRow = [];
    for (let i = 1; i <= 5; i++) {
      const isSelected = selectedWallets.has(i);
      const walletSlot = `W${i}`;
      const balanceStr = walletBalances[walletSlot] || '0';
      const balance = (balanceStr && !isNaN(parseFloat(balanceStr))) ? parseFloat(balanceStr) : 0;
      
      // Create button text with balance info
      let buttonText;
      if (isSelected) {
        buttonText = `✅ ${walletSlot}`;
      } else {
        // Show balance status
        if (balance > 0) {
          buttonText = `💰 ${walletSlot}`;  // Has balance
        } else {
          buttonText = `⚪ ${walletSlot}`;  // Empty
        }
      }
      
      const callbackData = `ws_${sessionId}_${i}`;
      console.log(`🔧 Creating wallet button ${walletSlot}: ${buttonText} (${balance} ETH) with callback: ${callbackData}`);
      walletRow.push({
        text: buttonText,
        callback_data: callbackData
      });
    }
    
    console.log('🔧 Wallet row created:', walletRow.map(btn => `${btn.text}:${btn.callback_data}`));

    return {
      inline_keyboard: [
        // Wallet selection row
        walletRow,
        [
          { text: this.getAmountButtonText(chatId, sessionId, 0.01, symbol), callback_data: `buy_select_amount_${sessionId}_0.01` },
          { text: this.getAmountButtonText(chatId, sessionId, 0.05, symbol), callback_data: `buy_select_amount_${sessionId}_0.05` }
        ],
        [
          { text: this.getAmountButtonText(chatId, sessionId, 0.1, symbol), callback_data: `buy_select_amount_${sessionId}_0.1` },
          { text: this.getAmountButtonText(chatId, sessionId, 0.5, symbol), callback_data: `buy_select_amount_${sessionId}_0.5` }
        ],
        [
          { text: this.getCustomAmountButtonText(chatId, sessionId), callback_data: `buy_custom_${sessionId}` },
          { text: `📊 Auto-Optimized`, callback_data: `auto_optimized_info_${sessionId}` }
        ],
        // 🔥 SPEED TIER SELECTION (Revenue)
        [
          { text: this.getSpeedTierButtonText(chatId, sessionId, 'standard'), callback_data: `speed_${sessionId}_standard` },
          { text: this.getSpeedTierButtonText(chatId, sessionId, 'fast'), callback_data: `speed_${sessionId}_fast` }
        ],
        [
          { text: this.getSpeedTierButtonText(chatId, sessionId, 'instant'), callback_data: `speed_${sessionId}_instant` }
        ],
        [
          { text: '✅ CONFIRM', callback_data: `buy_confirm_new_${sessionId}` }
        ],
        [
          { text: '🔙 Back to Main Menu', callback_data: 'main_menu' }
        ]
      ]
    };
  }

  // Handle buy execution
  async handleBuyExecution(callbackQuery) {
    const { from, message, data } = callbackQuery;
    const chatId = from.id;
    const messageId = message.message_id;

    try {
      // Parse callback data: buy_execute_SESSIONID_AMOUNT
      const parts = data.split('_');
      const sessionId = parts[2];
      const amount = parseFloat(parts[3]);
      
      // Get token data from session
      const tokenData = this.getTokenSession(chatId, sessionId);
      if (!tokenData) {
        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: '❌ Session expired. Please try again.',
          show_alert: true
        });
        return;
      }

      // Get selected wallets
      const selectedWallets = this.getSelectedWallets(chatId, sessionId);
      if (selectedWallets.size === 0) {
        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: '⚠️ Please select at least one wallet first!',
          show_alert: true
        });
        return;
      }

      // Get chain info
      const chainInfo = this.tokenAnalyzer.getChainInfo(tokenData.chain);
      const symbol = chainInfo.symbol;

      // Get user's wallets for this chain
      const chainWallets = await this.walletManager.getChainWallets(chatId, tokenData.chain);
      
      if (!chainWallets || Object.keys(chainWallets).length === 0) {
        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: '❌ No wallets found. Generate wallets first.',
          show_alert: true
        });
        return;
      }

      // Validate selected wallets have enough balance
      const insufficientWallets = [];
      const validWallets = [];

      for (const walletNum of selectedWallets) {
        const walletSlot = `W${walletNum}`;
        const wallet = chainWallets[walletSlot];
        
        if (wallet) {
          const balance = await this.walletManager.getWalletBalance(wallet.address, tokenData.chain);
          const balanceNum = parseFloat(balance) || 0;
          
          if (balanceNum >= amount) {
            validWallets.push({ walletNum, wallet, balance: balanceNum });
          } else {
            insufficientWallets.push({ walletNum, wallet, balance: balanceNum });
          }
        }
      }

      // Check if any selected wallets have insufficient balance
      if (insufficientWallets.length > 0) {
        let errorMessage = `❌ **Insufficient Balance**\n\n`;
        errorMessage += `The following selected wallets don't have enough ${symbol}:\n\n`;
        
        for (const { walletNum, balance } of insufficientWallets) {
          errorMessage += `• W${walletNum}: ${balance.toFixed(6)} ${symbol} (need ${amount})\n`;
        }
        
        errorMessage += `\n**Please:**\n`;
        errorMessage += `• Deselect wallets with insufficient balance\n`;
        errorMessage += `• Add more ${symbol} to those wallets\n`;
        errorMessage += `• Or choose a smaller amount`;

        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: `❌ Some selected wallets have insufficient balance!`,
          show_alert: true
        });

        // Also send a detailed message
        await this.bot.sendMessage(chatId, errorMessage, {
          parse_mode: 'Markdown',
          reply_to_message_id: messageId
        });
        return;
      }

      // All selected wallets have sufficient balance - proceed with buy
      if (validWallets.length > 0) {
        await this.executeBuyForMultipleWallets(callbackQuery, tokenData, amount, validWallets, sessionId);
      }

    } catch (error) {
      console.error('❌ Buy execution error:', error.message);
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Error processing buy request',
        show_alert: true
      });
    }
  }

  // Show wallet selection for buying
  async showWalletSelection(chatId, messageId, sessionId, amount, tokenData, chainWallets) {
    try {
      const chainInfo = this.tokenAnalyzer.getChainInfo(tokenData.chain);
      const symbol = chainInfo.symbol;

      let message = `🔥 **Select Wallet for Buy**\n\n`;
      message += `🪙 **Token:** \`${tokenData.address}\`\n`;
      message += `💰 **Amount:** ${amount} ${symbol}\n`;
      message += `⛓️ **Chain:** ${chainInfo.name}\n\n`;
      message += `**Choose which wallet to use for this trade:**\n\n`;

      const walletButtons = [];

      // Add wallet buttons with balances
      for (let i = 1; i <= 5; i++) {
        const walletSlot = `W${i}`;
        const wallet = chainWallets[walletSlot];
        
        if (wallet) {
          const balance = await this.walletManager.getWalletBalance(wallet.address, tokenData.chain);
          const balanceNum = parseFloat(balance) || 0;
          const hasEnoughBalance = balanceNum >= parseFloat(amount);
          
          const statusEmoji = hasEnoughBalance ? '✅' : '❌';
          const balanceDisplay = `${balanceNum.toFixed(3)} ${symbol}`;
          
          message += `${i}. ${wallet.address} - ${balanceDisplay} ${statusEmoji}\n`;
          
          walletButtons.push([{
            text: `${statusEmoji} Wallet ${i} (${balanceDisplay})`,
            callback_data: `buy_confirm_${sessionId}_${amount}_${walletSlot}`
          }]);
        } else {
          message += `${i}. empty\n`;
          walletButtons.push([{
            text: `➕ Generate Wallet ${i}`,
            callback_data: `wallet_generate_${walletSlot}_${tokenData.chain}`
          }]);
        }
      }

      walletButtons.push([
        { text: '🔙 Back to Token', callback_data: `buy_refresh_${sessionId}` }
      ]);

      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: walletButtons }
      });

    } catch (error) {
      console.error('❌ Error showing wallet selection:', error.message);
    }
  }

  // Handle example token display
  async handleExampleToken(callbackQuery, type) {
    const { from, message } = callbackQuery;
    const chatId = from.id;
    const messageId = message.message_id;

    try {
      let exampleAddress;
      if (type === 'eth') {
        // Example Ethereum token (USDC)
        exampleAddress = '0xA0b86a33E6441b8C4505B8C4505B8C4505B8C4505';
      } else {
        // Example Solana token
        exampleAddress = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
      }

      // Simulate contract address input
      await this.handleContractAddressFromCallback(chatId, messageId, exampleAddress);

    } catch (error) {
      console.error('❌ Error showing example token:', error.message);
    }
  }

  // Handle contract address from callback (for examples)
  async handleContractAddressFromCallback(chatId, messageId, contractAddress) {
    try {
      // Show analyzing message
      await this.bot.editMessageText(
        `🔍 **Analyzing Example Token...**\n\n` +
        `📝 **Contract:** \`${contractAddress}\`\n` +
        `⏳ Detecting blockchain and fetching data...`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown'
      });

      // Analyze the token
      const tokenData = await this.tokenAnalyzer.analyzeToken(contractAddress);
      
      // Get user's wallet balances for this chain
      const walletBalances = await this.getUserWalletBalances(chatId, tokenData.chain);
      
      // Format and display token information
      const tokenInfo = this.tokenAnalyzer.formatTokenInfo(tokenData, walletBalances);
      
      // Create buy buttons with smart wallet selection
      const buyKeyboard = await this.createBuyKeyboard(chatId, tokenData);

      // Update message with token info
      await this.bot.editMessageText(tokenInfo, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: buyKeyboard,
        disable_web_page_preview: true
      });

      // Store token data for buy actions
      this.userStates.set(chatId, {
        action: 'token_analyzed',
        tokenData: tokenData,
        messageId: messageId
      });

    } catch (error) {
      console.error('❌ Example token analysis error:', error.message);
      
      await this.bot.editMessageText(
        `❌ **Example Token Analysis Failed**\n\n` +
        `💥 **Error:** ${error.message}\n\n` +
        `This is just an example. Try with a real contract address!`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Try Real Token', callback_data: 'buy_menu' }],
            [{ text: '🔙 Back to Main Menu', callback_data: 'main_menu' }]
          ]
        }
      });
    }
  }

  // Check if user is waiting for contract address
  isWaitingForContractAddress(chatId) {
    const state = this.userStates.get(chatId);
    return state && state.action === 'waiting_for_contract_address';
  }

  // Clear user state
  clearUserState(chatId) {
    this.userStates.delete(chatId);
  }

  // Create a token session with short ID
  createTokenSession(chatId, tokenData) {
    const sessionId = `t${this.sessionCounter++}`;
    const sessionKey = `${chatId}_${sessionId}`;
    
    console.log('📝 Creating token session:', sessionKey);
    console.log('📝 Session ID:', sessionId);
    
    const sessionData = {
      tokenData,
      createdAt: Date.now(),
      chatId
    };
    
    this.tokenSessions.set(sessionKey, sessionData);
    
    console.log('📝 Token session created. Total sessions:', this.tokenSessions.size);
    console.log('📝 Session stored with key:', sessionKey);
    console.log('📝 Session data:', {
      symbol: tokenData.symbol,
      address: tokenData.address,
      createdAt: sessionData.createdAt
    });
    
    // Clean up old sessions (older than 1 hour)
    this.cleanupOldSessions();
    
    return sessionId;
  }

  // Get token data from session
  getTokenSession(chatId, sessionId) {
    const sessionKey = `${chatId}_${sessionId}`;
    console.log(`🔍 Looking for session: ${sessionKey}`);
    console.log(`🔍 Available sessions: ${Array.from(this.tokenSessions.keys()).join(', ')}`);
    
    const session = this.tokenSessions.get(sessionKey);
    
    if (!session) {
      console.log(`❌ Session ${sessionKey} not found in memory`);
      return null;
    }
    
    // Check if session is still valid (1 hour)
    const age = Date.now() - session.createdAt;
    console.log(`🔍 Session age: ${age}ms (max: 3600000ms)`);
    
    if (age > 3600000) {
      console.log(`❌ Session ${sessionKey} expired (age: ${age}ms)`);
      this.tokenSessions.delete(sessionKey);
      return null;
    }
    
    console.log(`✅ Session ${sessionKey} found and valid`);
    return session.tokenData;
  }

  // Update token data in existing session (for refresh)
  updateTokenSession(chatId, sessionId, newTokenData) {
    const sessionKey = `${chatId}_${sessionId}`;
    console.log(`🔄 Updating session: ${sessionKey}`);
    
    const session = this.tokenSessions.get(sessionKey);
    if (session) {
      session.tokenData = newTokenData;
      // Don't update createdAt to keep the original session timing
      console.log(`✅ Session ${sessionKey} updated with refreshed data`);
    } else {
      console.log(`❌ Session ${sessionKey} not found for update`);
    }
  }

  // Clean up old sessions
  cleanupOldSessions() {
    const now = Date.now();
    for (const [key, session] of this.tokenSessions.entries()) {
      if (now - session.createdAt > 3600000) { // 1 hour
        this.tokenSessions.delete(key);
        
        // Clean wallet selections for this session
        const sessionId = key.split('_')[1]; // Extract session ID
        for (const [selectionKey] of this.walletSelections.entries()) {
          if (selectionKey.endsWith(`_${sessionId}`)) {
            this.walletSelections.delete(selectionKey);
          }
        }
      }
    }
  }

  // Wallet selection methods
  getSelectedWallets(chatId, sessionId) {
    const key = `${chatId}_${sessionId}`;
    return this.walletSelections.get(key) || new Set();
  }

  setSelectedWallets(chatId, sessionId, selectedWallets) {
    const key = `${chatId}_${sessionId}`;
    this.walletSelections.set(key, selectedWallets);
  }

  toggleWallet(chatId, sessionId, walletNum) {
    const selectedWallets = this.getSelectedWallets(chatId, sessionId);
    if (selectedWallets.has(walletNum)) {
      selectedWallets.delete(walletNum);
    } else {
      selectedWallets.add(walletNum);
    }
    this.setSelectedWallets(chatId, sessionId, selectedWallets);
    return selectedWallets;
  }

  // Amount selection methods
  getSelectedAmount(chatId, sessionId) {
    const key = `${chatId}_${sessionId}`;
    return this.amountSelections.get(key) || null;
  }

  setSelectedAmount(chatId, sessionId, amount) {
    const key = `${chatId}_${sessionId}`;
    this.amountSelections.set(key, amount);
    console.log(`💰 Amount selected for session ${sessionId}: ${amount}`);
  }

  clearSelectedAmount(chatId, sessionId) {
    const key = `${chatId}_${sessionId}`;
    this.amountSelections.delete(key);
    console.log(`🗑️ Amount cleared for session ${sessionId}`);
  }

  // Get amount button text with selection indicator
  getAmountButtonText(chatId, sessionId, amount, symbol) {
    const selectedAmount = this.getSelectedAmount(chatId, sessionId);
    const isSelected = selectedAmount === amount;
    const emoji = isSelected ? '✅' : '💰';
    return `${emoji} ${amount} ${symbol}`;
  }

  // Get custom amount button text with selection indicator
  getCustomAmountButtonText(chatId, sessionId) {
    const selectedAmount = this.getSelectedAmount(chatId, sessionId);
    
    // Check if selected amount is a custom amount (not one of the preset amounts)
    const presetAmounts = [0.01, 0.05, 0.1, 0.5];
    const isCustomAmount = selectedAmount && !presetAmounts.includes(selectedAmount);
    
    if (isCustomAmount) {
      return `✅ Custom: ${selectedAmount}`;
    } else {
      return `💰 Custom Amount`;
    }
  }

  selectAllWallets(chatId, sessionId, toggle = true) {
    const selectedWallets = this.getSelectedWallets(chatId, sessionId);
    if (toggle && selectedWallets.size === 5) {
      // If all are selected, deselect all
      selectedWallets.clear();
    } else {
      // Select all wallets (1-5)
      selectedWallets.clear();
      for (let i = 1; i <= 5; i++) {
        selectedWallets.add(i);
      }
    }
    this.setSelectedWallets(chatId, sessionId, selectedWallets);
    return selectedWallets;
  }

  // Execute buy for multiple selected wallets
  async executeBuyForMultipleWallets(callbackQuery, tokenData, amount, validWallets, sessionId) {
    const { from, message } = callbackQuery;
    const chatId = from.id;
    const messageId = message.message_id;

    try {
      const chainInfo = this.tokenAnalyzer.getChainInfo(tokenData.chain);
      const symbol = chainInfo.symbol;
      const totalAmount = amount * validWallets.length;

      // Show confirmation message
      let confirmMessage = `🔥 **Confirm Multi-Wallet Buy**\n\n`;
      confirmMessage += `🪙 **Token:** ${tokenData.name} (${tokenData.symbol})\n`;
      confirmMessage += `💰 **Amount per wallet:** ${amount} ${symbol}\n`;
      confirmMessage += `📊 **Total amount:** ${totalAmount} ${symbol}\n`;
      confirmMessage += `🏦 **Selected wallets:** ${validWallets.length}\n\n`;

      confirmMessage += `**Wallets to be used:**\n`;
      for (const { walletNum, balance } of validWallets) {
        confirmMessage += `• W${walletNum}: ${balance.toFixed(6)} ${symbol} ✅\n`;
      }

      confirmMessage += `\n⚠️ **Each wallet will buy ${amount} ${symbol} worth of tokens**\n`;
      confirmMessage += `💡 Total cost: ${totalAmount} ${symbol}`;

      await this.bot.editMessageText(confirmMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Confirm Buy', callback_data: `buy_multi_confirm_${sessionId}_${amount}` },
              { text: '❌ Cancel', callback_data: `buy_refresh_${sessionId}` }
            ],
            [
              { text: '🔙 Back to Token', callback_data: `buy_refresh_${sessionId}` }
            ]
          ]
        }
      });

      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: `🔥 Confirm buy with ${validWallets.length} wallets`
      });

    } catch (error) {
      console.error('❌ Error showing multi-wallet buy confirmation:', error.message);
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Error preparing buy confirmation',
        show_alert: true
      });
    }
  }

  // ========== SLIPPAGE MANAGEMENT ==========

  // Get slippage for a token session
  getTokenSlippage(chatId, sessionId) {
    const slippageKey = `${chatId}_${sessionId}`;
    return this.tokenSlippage.get(slippageKey) || this.getDefaultSlippage(chatId, sessionId);
  }

  // Set slippage for a token session
  setTokenSlippage(chatId, sessionId, slippagePercent) {
    const slippageKey = `${chatId}_${sessionId}`;
    this.tokenSlippage.set(slippageKey, slippagePercent);
    console.log(`📊 Set slippage for ${slippageKey}: ${slippagePercent}%`);
  }

  // Get smart default slippage based on token type (Enhanced for low liquidity)
  getDefaultSlippage(chatId, sessionId) {
    const tokenData = this.getTokenSession(chatId, sessionId);
    if (!tokenData) return 30; // Higher default fallback for low liquidity

    const token = tokenData;
    
    // Enhanced smart defaults for low liquidity handling
    if (token.liquidity && token.liquidity > 10000000) {
      // Very high liquidity = lower slippage
      return 3;
    } else if (token.liquidity && token.liquidity > 1000000) {
      // High liquidity = lower slippage
      return 8;
    } else if (token.marketCap && token.marketCap < 50000) {
      // Ultra micro cap = very high slippage needed
      return 50;
    } else if (token.marketCap && token.marketCap < 200000) {
      // Micro cap = higher slippage needed
      return 40;
    } else if (token.marketCap && token.marketCap < 500000) {
      // Small cap = moderate high slippage
      return 30;
    } else if (token.buyTax > 10 || token.sellTax > 10) {
      // Very high tax tokens need extra slippage
      return 35;
    } else if (token.buyTax > 5 || token.sellTax > 5) {
      // High tax tokens need extra slippage
      return 25;
    }
    
    // Default for most low liquidity meme coins
    return 25;
  }

  // Get gas settings for session
  getTokenGasSettings(chatId, sessionId) {
    const sessionKey = `${chatId}_${sessionId}`;
    return this.tokenGasSettings.get(sessionKey) || {
      type: 'fast', // Default to Fast instead of standard
      gasPrice: null, // Will use network default
      priorityFee: null,
      gasLimit: null
    };
  }

  // Set gas settings for session
  setTokenGasSettings(chatId, sessionId, gasSettings) {
    const sessionKey = `${chatId}_${sessionId}`;
    this.tokenGasSettings.set(sessionKey, gasSettings);
    console.log(`⛽ Set gas for ${sessionKey}:`, gasSettings);
  }

  // Get gas display text for button
  getGasDisplayText(chatId, sessionId, tokenData) {
    const gasSettings = this.getTokenGasSettings(chatId, sessionId);
    
    // Check if user has made a selection
    const sessionKey = `${chatId}_${sessionId}`;
    const hasCustomSettings = this.tokenGasSettings.has(sessionKey);
    
    if (!hasCustomSettings) {
      // Default button text before any selection
      return `⛽ GAS`;
    }
    
    // Show what user selected
    if (gasSettings.type === 'custom' && gasSettings.gasPrice) {
      return `💡 ${gasSettings.gasPrice}`;
    } else if (gasSettings.type === 'fast') {
      return `🚀 Fast`;
    } else if (gasSettings.type === 'instant') {
      return `⚡ Instant`;
    } else if (gasSettings.type === 'standard') {
      return `🐌 Standard`;
    } else {
      return `⛽ GAS`;
    }
  }

  // Handle slippage button click
  async handleSlippageMenu(callbackQuery) {
    const { from, message, data } = callbackQuery;
    const chatId = from.id;
    const messageId = message.message_id;

    console.log('🚀 SLIPPAGE HANDLER CALLED!');
    console.log('🚀 Callback data:', data);
    console.log('🚀 Chat ID:', chatId);
    
    try {
      console.log('🔧 Step 1: About to process callback data...');
      console.log('🔧 Slippage menu callback data:', data);
      
      console.log('🔧 Step 2: About to parse session ID...');
      // Parse sessionId from callback data: slippage_sessionId
      const sessionId = data.replace('slippage_', '');
      console.log('🔧 Parsed session ID:', sessionId);
      
      console.log('🔧 Step 3: About to get token session...');
      console.log('🔧 Calling getTokenSession with:', chatId, sessionId);
      console.log('🔧 Current sessions in memory:');
      for (let [key, session] of this.tokenSessions.entries()) {
        console.log(`   - ${key}: ${session.tokenData?.symbol || 'unknown'} (age: ${Date.now() - session.createdAt}ms)`);
      }
      
      let tokenData;
      try {
        tokenData = this.getTokenSession(chatId, sessionId);
        console.log('🔧 Step 4: Token session call completed successfully');
      } catch (sessionError) {
        console.error('❌ Error in getTokenSession:', sessionError.message);
        throw new Error(`Failed to get token session: ${sessionError.message}`);
      }
      
      console.log('🔧 Token data found:', !!tokenData);
      console.log('🔧 Token data details:', tokenData ? 'exists' : 'null');
      
      if (!tokenData) {
        console.log('❌ Token data not found!');
        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: '❌ Session expired. Please try again.',
          show_alert: true
        });
        return;
      }

      console.log('✅ Token data found, getting slippage values...');
      const currentSlippage = this.getTokenSlippage(chatId, sessionId);
      console.log('🔧 Current slippage:', currentSlippage);
      
      console.log('🔧 Getting recommended slippage...');
      console.log('🔧 Token data structure:', tokenData);
      
      let recommendedSlippage;
      try {
        recommendedSlippage = this.getRecommendedSlippage(tokenData);
        console.log('🔧 Recommended slippage:', recommendedSlippage);
      } catch (recError) {
        console.error('❌ Error getting recommended slippage:', recError.message);
        console.log('🔧 Falling back to default slippage: 1.0');
        recommendedSlippage = 1.0;
      }
      
      let slippageMessage = `📊 **Slippage Settings**\n\n`;
      slippageMessage += `🎯 **Current:** ${currentSlippage}%\n`;
      slippageMessage += `💡 **Recommended:** ${recommendedSlippage}%\n\n`;
      
      slippageMessage += `**What is Slippage?**\n`;
      slippageMessage += `The max price difference you'll accept between expected and actual trade price.\n\n`;
      
      // Check for token taxes (handle different data structures)
      const buyTax = tokenData.tax?.buyTax || tokenData.buyTax || 0;
      const sellTax = tokenData.tax?.sellTax || tokenData.sellTax || 0;
      
      if (buyTax > 0 || sellTax > 0) {
        slippageMessage += `⚠️ **This token has taxes:**\n`;
        slippageMessage += `📈 Buy Tax: ${buyTax}%\n`;
        slippageMessage += `📉 Sell Tax: ${sellTax}%\n`;
        slippageMessage += `🔧 Consider higher slippage to account for taxes.\n\n`;
      }
      
      slippageMessage += `**Reply with your desired slippage percentage:**\n`;
      slippageMessage += `Example: \`15\` (for 15%)`;

      console.log('🔧 Setting user state for slippage input...');
      // Set user state to await slippage input
      this.userStates.set(chatId, {
        state: 'awaiting_slippage',
        sessionId: sessionId,
        messageId: messageId
      });

      console.log('🔧 Attempting to edit message...');
      console.log('🔧 Chat ID:', chatId, 'Message ID:', messageId);
      
      // Debug: Log the buttons being created
      const buttons = [
        [
          { text: `🎯 Use Current (${currentSlippage}%)`, callback_data: `slippage_set_${sessionId}_${currentSlippage}` },
          { text: `💡 Custom %`, callback_data: `slippage_custom_${sessionId}` }
        ],
        [
          { text: '🔙 Back to Token', callback_data: `back_to_token_${sessionId}` }
        ]
      ];
      
      console.log('🔧 ========== SLIPPAGE BUTTONS DEBUG ==========');
      console.log('🔧 Button 1:', buttons[0][0].text, '→', buttons[0][0].callback_data);
      console.log('🔧 Button 2:', buttons[0][1].text, '→', buttons[0][1].callback_data);
      console.log('🔧 Button 3:', buttons[1][0].text, '→', buttons[1][0].callback_data);
      console.log('🔧 ==========================================');
      
      await this.bot.editMessageText(slippageMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: buttons
        }
      });

      console.log('🔧 Message edited successfully, answering callback query...');
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: '📊 Slippage settings opened',
        show_alert: false
      });
      console.log('✅ Slippage menu completed successfully!');

    } catch (error) {
      console.error('❌ Error showing slippage menu:', error);
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Error showing slippage menu',
        show_alert: true
      });
    }
  }

  // Get recommended slippage based on token analysis
  getRecommendedSlippage(tokenData) {
    let recommended = 1.0; // Base recommendation (1%)
    
    // Adjust based on taxes (handle different data structures)
    const buyTax = tokenData.tax?.buyTax || tokenData.buyTax || 0;
    const sellTax = tokenData.tax?.sellTax || tokenData.sellTax || 0;
    
    if (buyTax > 0 || sellTax > 0) {
      const maxTax = Math.max(buyTax, sellTax);
      recommended = Math.max(recommended, maxTax + 1.0); // Tax + buffer
    }
    
    // Adjust based on liquidity (if available)
    if (tokenData.liquidity) {
      try {
        const liquidity = parseFloat(tokenData.liquidity);
        if (!isNaN(liquidity)) {
          if (liquidity < 50000) recommended += 2.0;      // Low liquidity
          else if (liquidity < 100000) recommended += 1.0; // Medium liquidity
          else if (liquidity > 1000000) recommended -= 0.5; // High liquidity
        }
      } catch (liqError) {
        console.log('⚠️ Liquidity parsing error:', liqError.message);
      }
    }
    
    // Adjust based on market cap (if available)
    if (tokenData.marketCap && typeof tokenData.marketCap === 'string') {
      try {
        const marketCapStr = tokenData.marketCap.replace(/[$,B,M,K]/g, '');
        const marketCap = parseFloat(marketCapStr);
        if (!isNaN(marketCap)) {
          if (marketCap < 0.1) recommended += 1.0;     // Micro cap
          else if (marketCap > 100) recommended -= 0.5; // Established
        }
      } catch (mcError) {
        console.log('⚠️ Market cap parsing error:', mcError.message);
      }
    }
    
    // Reasonable bounds (0.5% to 10%)
    return Math.max(0.5, Math.min(10.0, recommended));
  }

  // Handle slippage input message
  async handleSlippageInput(msg, sessionId, originalMessageId) {
    const chatId = msg.chat.id;
    
    try {
      const input = msg.text.trim();
      const slippagePercent = parseFloat(input);
      
      // Validate input
      if (isNaN(slippagePercent) || slippagePercent < 0.1 || slippagePercent > 100) {
        await this.bot.sendMessage(chatId, 
          `❌ Invalid slippage. Please enter a number between 0.1 and 100.\n\nExample: \`15\` for 15%`,
          { parse_mode: 'Markdown' }
        );
        return;
      }
      
      // Set the slippage
      this.setTokenSlippage(chatId, sessionId, slippagePercent);
      
      // Clear user state
      this.userStates.delete(chatId);
      
      // Go back to token page with updated slippage
      await this.returnToTokenPage(chatId, originalMessageId, sessionId);
      
      // Delete the input message
      try {
        await this.bot.deleteMessage(chatId, msg.message_id);
      } catch (deleteError) {
        // Ignore deletion errors
      }
      
      // Show confirmation
      await this.bot.answerCallbackQuery({ id: 'fake' }, {
        text: `✅ Slippage set to ${slippagePercent}%`
      });
      
    } catch (error) {
      console.error('❌ Error handling slippage input:', error);
      await this.bot.sendMessage(chatId, '❌ Error setting slippage. Please try again.');
    }
  }

  // Return to token page after setting slippage
  async returnToTokenPage(chatId, messageId, sessionId) {
    console.log('🔙 Returning to token page...');
    console.log('🔙 Chat ID:', chatId, 'Message ID:', messageId, 'Session ID:', sessionId);
    
    try {
      console.log('🔙 Step 1: Getting token session...');
      const tokenData = this.getTokenSession(chatId, sessionId);
      if (!tokenData) {
        console.error('❌ No token data found for session:', sessionId);
        throw new Error('Token session not found');
      }
      
      console.log('🔙 Step 2: Token data found:', tokenData.symbol, 'on', tokenData.chain);
      
      console.log('🔙 Step 3: Getting wallet balances...');
      // Get fresh token info and keyboard - tokenData is the direct token object
      const walletBalances = await this.getUserWalletBalances(chatId, tokenData.chain);
      console.log('🔙 Step 4: Wallet balances retrieved');
      
      console.log('🔙 Step 5: Formatting token info...');
      const tokenInfo = this.tokenAnalyzer.formatTokenInfo(tokenData, walletBalances);
      console.log('🔙 Step 6: Token info formatted');
      
      console.log('🔙 Step 7: Creating buy keyboard...');
      const buyKeyboard = await this.createBuyKeyboardWithSession(chatId, tokenData, sessionId);
      console.log('🔙 Step 8: Buy keyboard created');
      
      console.log('🔙 Step 9: About to edit message with token info...');
      console.log('🔙 Edit params:', { chatId, messageId, textLength: tokenInfo.length });
      
      await this.bot.editMessageText(tokenInfo, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: buyKeyboard,
        disable_web_page_preview: true
      });
      
      console.log('✅ Step 10: Successfully returned to token page');
      
    } catch (error) {
      console.error('❌ Error returning to token page:', error.message);
      console.error('❌ Error stack:', error.stack);
      console.error('❌ Error details:', {
        chatId,
        messageId,
        sessionId,
        errorName: error.name,
        errorCode: error.code
      });
      throw error; // Re-throw so the calling function knows it failed
    }
  }

  // Handle gas settings menu (Looter.ai style)
  async handleGasMenu(callbackQuery) {
    const { from, message, data } = callbackQuery;
    const chatId = from.id;
    const messageId = message.message_id;

    console.log('⛽ GAS MENU HANDLER CALLED!');
    console.log('⛽ Callback data:', data);
    console.log('⛽ Chat ID:', chatId);

    try {
      // Extract session ID from callback data (gas_sessionId)
      const sessionId = data.replace('gas_', '');
      console.log('⛽ Session ID extracted:', sessionId);

      // Get token data for this session
      const tokenData = this.getTokenSession(chatId, sessionId);
      if (!tokenData) {
        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: '❌ Session expired. Please try again.',
          show_alert: true
        });
        return;
      }

      // Get current gas settings
      const currentGasSettings = this.getTokenGasSettings(chatId, sessionId);
      const currentGas = tokenData.gas?.current || '15';
      const recommendedGas = tokenData.gas?.recommended || '20';
      const instantGas = Math.round(parseFloat(recommendedGas) * 1.5);

      // Create gas settings message (Looter.ai style)
      const gasMessage = 
        `⛽ **Gas Settings**\n\n` +
        `📊 **Current Network:** ${currentGas} gwei\n` +
        `⚡ **Recommended:** ${recommendedGas} gwei\n\n` +
        `💡 **Select gas speed for your transaction:**\n` +
        `• **Standard** - Normal confirmation (~2 min)\n` +
        `• **Fast** - Quick confirmation (~30 sec)\n` +
        `• **Instant** - Fastest confirmation (~15 sec)\n` +
        `• **Custom** - Set your own gas price\n\n` +
        `🔥 **Higher gas = Faster confirmation**`;

      // Create gas options keyboard (shorter text)
      const gasKeyboard = {
        inline_keyboard: [
          [
            { text: `🐌 Standard`, callback_data: `gas_set_${sessionId}_standard` },
            { text: `🚀 Fast`, callback_data: `gas_set_${sessionId}_fast` }
          ],
          [
            { text: `⚡ Instant`, callback_data: `gas_set_${sessionId}_instant` },
            { text: `💡 Custom`, callback_data: `gas_custom_${sessionId}` }
          ],
          [
            { text: '🔙 Back', callback_data: `back_to_token_${sessionId}` }
          ]
        ]
      };

      await this.bot.editMessageText(gasMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: gasKeyboard
      });

      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: '⛽ Gas settings opened',
        show_alert: false
      });

    } catch (error) {
      console.error('❌ Error showing gas menu:', error);
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Error showing gas menu',
        show_alert: true
      });
    }
  }

  // Handle gas setting selection
  async handleGasSet(callbackQuery) {
    const { from, message, data } = callbackQuery;
    const chatId = from.id;
    const messageId = message.message_id;

    try {
      // Parse callback data: gas_set_sessionId_type
      const parts = data.split('_');
      const sessionId = parts[2];
      const gasType = parts[3];

      console.log('⛽ Setting gas:', { sessionId, gasType });

      // Get token data
      const tokenData = this.getTokenSession(chatId, sessionId);
      if (!tokenData) {
        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: '❌ Session expired',
          show_alert: true
        });
        return;
      }

      // Set gas settings based on type
      let gasSettings;
      let confirmationText;
      const currentGas = tokenData.gas?.current || '15';
      const recommendedGas = tokenData.gas?.recommended || '20';

      switch (gasType) {
        case 'standard':
          gasSettings = {
            type: 'standard',
            gasPrice: currentGas,
            priorityFee: '1',
            gasLimit: null
          };
          confirmationText = `✅ Gas set to Standard (${currentGas} gwei)`;
          break;

        case 'fast':
          gasSettings = {
            type: 'fast',
            gasPrice: recommendedGas,
            priorityFee: '2',
            gasLimit: null
          };
          confirmationText = `✅ Gas set to Fast (${recommendedGas} gwei)`;
          break;

        case 'instant':
          const instantGas = Math.round(parseFloat(recommendedGas) * 1.5);
          gasSettings = {
            type: 'instant',
            gasPrice: instantGas.toString(),
            priorityFee: '5',
            gasLimit: null
          };
          confirmationText = `✅ Gas set to Instant (${instantGas} gwei)`;
          break;

        default:
          throw new Error('Invalid gas type');
      }

      // Save gas settings
      this.setTokenGasSettings(chatId, sessionId, gasSettings);

      // Return to token page
      await this.returnToTokenPage(chatId, messageId, sessionId);

      // Show confirmation
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: confirmationText,
        show_alert: false
      });

    } catch (error) {
      console.error('❌ Error setting gas:', error);
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Error setting gas',
        show_alert: true
      });
    }
  }

  // Handle custom gas input
  async handleCustomGas(callbackQuery) {
    const { from, message, data } = callbackQuery;
    const chatId = from.id;
    const messageId = message.message_id;

    try {
      // Extract session ID
      const sessionId = data.replace('gas_custom_', '');

      // Send reply message asking for gas amount
      const replyMessage = await this.bot.sendMessage(chatId, 
        `⛽ **Custom Gas Price**\n\n` +
        `💡 **Please enter your desired gas price in gwei:**\n\n` +
        `📊 **Examples:**\n` +
        `• \`15\` - Standard speed\n` +
        `• \`25\` - Fast speed\n` +
        `• \`35\` - Instant speed\n\n` +
        `⚠️ **Note:** Higher gas = Faster confirmation but higher cost`, {
        parse_mode: 'Markdown',
        reply_to_message_id: messageId
      });

      // Set user state to wait for gas input
      this.userStates.set(chatId, {
        action: 'waiting_for_gas_input',
        sessionId: sessionId,
        originalMessageId: messageId,
        replyMessageId: replyMessage.message_id
      });

      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: '💡 Reply with your gas price in gwei',
        show_alert: false
      });

    } catch (error) {
      console.error('❌ Error showing custom gas input:', error);
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Error showing custom gas input',
        show_alert: true
      });
    }
  }

  // Handle custom gas input message
  async handleGasInput(msg, sessionId, originalMessageId) {
    const chatId = msg.chat.id;
    
    try {
      const input = msg.text.trim();
      const gasPrice = parseFloat(input);
      
      // Get the user state to find the reply message ID
      const userState = this.userStates.get(chatId);
      
      // Validate input
      if (isNaN(gasPrice) || gasPrice < 1 || gasPrice > 500) {
        await this.bot.sendMessage(chatId, 
          `❌ **Invalid gas price!**\n\n` +
          `Please enter a number between 1 and 500 gwei.\n\n` +
          `💡 **Examples:** 15, 25, 35`, {
          parse_mode: 'Markdown'
        });
        return;
      }

      // Set custom gas settings
      const gasSettings = {
        type: 'custom',
        gasPrice: gasPrice.toString(),
        priorityFee: Math.max(1, Math.round(gasPrice * 0.1)).toString(),
        gasLimit: null
      };

      this.setTokenGasSettings(chatId, sessionId, gasSettings);

      // Delete the user's input message
      try {
        await this.bot.deleteMessage(chatId, msg.message_id);
      } catch (deleteError) {
        console.log('⚠️ Could not delete user message:', deleteError.message);
      }

      // Delete the bot's reply message asking for gas input
      try {
        if (userState?.replyMessageId) {
          await this.bot.deleteMessage(chatId, userState.replyMessageId);
        }
      } catch (deleteError) {
        console.log('⚠️ Could not delete bot reply message:', deleteError.message);
      }

      // Return to token page
      await this.returnToTokenPage(chatId, originalMessageId, sessionId);

      // Clear user state
      this.userStates.delete(chatId);

      // Send confirmation message
      const confirmMessage = await this.bot.sendMessage(chatId, 
        `✅ **Custom gas set to ${gasPrice} gwei**\n\n` +
        `⚡ Your transactions will use this gas price for faster confirmation!`, {
        parse_mode: 'Markdown'
      });

      // Delete confirmation message after 3 seconds
      setTimeout(async () => {
        try {
          await this.bot.deleteMessage(chatId, confirmMessage.message_id);
        } catch (deleteError) {
          console.log('⚠️ Could not delete confirmation message:', deleteError.message);
        }
      }, 3000);

    } catch (error) {
      console.error('❌ Error setting custom gas:', error);
      await this.bot.sendMessage(chatId, '❌ Error setting gas. Please try again.');
    }
  }

  // Get estimated gas prices for fallback
  getEstimatedGasPrices(chain) {
    console.log('🔍 Getting estimated gas prices for chain:', chain);
    const estimates = {
      ethereum: { fastGwei: 25, standardGwei: 15, slowGwei: 8 },
      base: { fastGwei: 0.5, standardGwei: 0.2, slowGwei: 0.1 },
      bsc: { fastGwei: 5, standardGwei: 3, slowGwei: 1 },
      arbitrum: { fastGwei: 0.5, standardGwei: 0.2, slowGwei: 0.1 },
      polygon: { fastGwei: 50, standardGwei: 30, slowGwei: 15 },
      avalanche: { fastGwei: 30, standardGwei: 20, slowGwei: 10 },
      solana: { fastGwei: 0.001, standardGwei: 0.0005, slowGwei: 0.0001 }
    };

    return estimates[chain] || { fastGwei: 5, standardGwei: 3, slowGwei: 1 };
  }

  // Check if user is awaiting slippage input
  isAwaitingSlippageInput(chatId) {
    const state = this.userStates.get(chatId);
    return state && state.state === 'awaiting_slippage';
  }

  // Check if user is waiting for gas input
  isAwaitingGasInput(chatId) {
    const state = this.userStates.get(chatId);
    return state && state.action === 'waiting_for_gas_input';
  }

  // 💰 ========== SPEED TIER MANAGEMENT (REVENUE SYSTEM) ==========
  
  // Get speed tier for session
  getSpeedTier(chatId, sessionId) {
    const key = `${chatId}_${sessionId}`;
    return this.speedTiers.get(key) || 'standard'; // Default to standard
  }
  
  // Set speed tier for session
  setSpeedTier(chatId, sessionId, tier) {
    const key = `${chatId}_${sessionId}`;
    this.speedTiers.set(key, tier);
    console.log(`💰 Speed tier set for ${key}: ${tier}`);
  }
  
  // Get speed tier configuration
  getSpeedTierConfig(tier) {
    const configs = {
      standard: {
        name: 'Standard',
        icon: '🐌',
        feePercent: 0.3,
        gasMultiplier: 1.0,
        priorityFee: '1',
        description: 'Normal speed execution'
      },
      fast: {
        name: 'Fast',
        icon: '🚀',
        feePercent: 0.5,
        gasMultiplier: 1.3,
        priorityFee: '3',
        description: 'Priority execution + 30% higher gas'
      },
      instant: {
        name: 'Instant',
        icon: '⚡',
        feePercent: 1.0,
        gasMultiplier: 2.0,
        priorityFee: '10',
        description: 'Maximum speed + MEV protection'
      }
    };
    
    return configs[tier] || configs.standard;
  }
  
  // Calculate platform fee based on speed tier
  calculatePlatformFee(amount, tier) {
    const config = this.getSpeedTierConfig(tier);
    const feeAmount = amount * (config.feePercent / 100);
    const netAmount = amount - feeAmount;
    
    return {
      grossAmount: amount,
      feeAmount: feeAmount,
      netAmount: netAmount,
      feePercent: config.feePercent,
      tierName: config.name
    };
  }
  
  // Get speed tier button text
  getSpeedTierButtonText(chatId, sessionId, tier) {
    const selectedTier = this.getSpeedTier(chatId, sessionId);
    const config = this.getSpeedTierConfig(tier);
    const isSelected = selectedTier === tier;
    
    const emoji = isSelected ? '✅' : config.icon;
    return `${emoji} ${config.name} (${config.feePercent}%)`;
  }
}

module.exports = BuyTokenUI;