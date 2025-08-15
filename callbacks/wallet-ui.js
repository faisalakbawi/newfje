/**
 * LOOTER.AI CLONE - WALLET UI
 * Beautiful wallet management interface (YOUR design!)
 */

class WalletUI {
  constructor(bot, walletManager, userStates) {
    this.bot = bot;
    this.walletManager = walletManager;
    this.userStates = userStates;
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

  // Show chain selection for wallet management
  async showChainSelection(chatId, messageId) {
    const message = 
      `⛓️ **Select Blockchain Network**\n\n` +
      `Choose which blockchain you want to manage wallets for:\n\n` +
      `🟣 **Ethereum** - The original blockchain, high security\n` +
      `🔵 **Base** - Low fees, fast transactions\n` +
      `🟡 **BSC** - Binance Smart Chain, low cost\n` +
      `🔷 **Arbitrum** - Layer 2 scaling solution\n` +
      `🟣 **Polygon** - Ultra-low fees, eco-friendly\n` +
      `🔴 **Avalanche** - High performance blockchain\n` +
      `🟢 **Solana** - Lightning fast transactions\n` +
      `💥 **Blast** - Native yield generation\n` +
      `🔴 **Optimism** - Optimistic rollup technology\n\n` +
      `💡 *Each chain has separate wallet storage*`;

    const keyboard = {
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

    await this.bot.editMessageText(message, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  // Show wallet management for specific chain (Looter.ai style)
  async showWalletManagement(chatId, messageId, chain) {
    try {
      const startTime = Date.now();
      const chainInfo = this.getChainInfo(chain);
      
      // Get wallets once (no duplicate calls)
      const updatedWallets = await this.walletManager.getChainWallets(chatId, chain);
      
      // Build wallet display exactly like Looter.ai
      let walletDisplay = '';
      let totalBalance = 0;
      let activeWallets = 0;
      const walletButtons = [];

      // Fetch all balances in parallel for better performance
      const balancePromises = [];
      const walletData = [];
      
      for (let i = 1; i <= 5; i++) {
        const walletSlot = `W${i}`;
        const wallet = updatedWallets[walletSlot];
        
        walletData.push({ slot: i, walletSlot, wallet });
        
        if (wallet) {
          // Add error handling for each balance fetch
          balancePromises.push(
            this.walletManager.getWalletBalance(wallet.address, chain)
              .catch(error => {
                console.error(`❌ Error fetching balance for ${walletSlot}:`, error.message);
                return "0.0"; // Return default balance on error
              })
          );
        } else {
          balancePromises.push(Promise.resolve("0.0"));
        }
      }
      
      // Wait for all balance calls to complete in parallel
      const balances = await Promise.all(balancePromises);
      
      // Process results
      for (let i = 0; i < 5; i++) {
        const { slot, walletSlot, wallet } = walletData[i];
        const balance = balances[i];
        const balanceNum = (balance && !isNaN(parseFloat(balance))) ? parseFloat(balance) : 0;
        
        if (wallet) {
          totalBalance += balanceNum;
          activeWallets++;
          
          // Format exactly like Looter.ai: "1. 0x1234... 0.000 ETH"
          walletDisplay += `${slot}. ${wallet.address} ${balanceNum.toFixed(3)} ${chainInfo.symbol}\n`;
          
          // Add individual wallet button with emoji and number only
          const walletEmoji = this.getWalletEmoji(slot);
          const statusEmoji = balanceNum > 0 ? '💰' : '🔴';
          walletButtons.push([
            { text: `${walletEmoji} ${statusEmoji} Wallet ${slot}`, callback_data: `wallet_manage_${walletSlot}_${chain}` }
          ]);
        } else {
          // Show empty slot exactly like Looter.ai
          walletDisplay += `${slot}. empty\n`;
          const walletEmoji = this.getWalletEmoji(slot);
          walletButtons.push([
            { text: `${walletEmoji} ➕ Generate Wallet ${slot}`, callback_data: `wallet_generate_${walletSlot}_${chain}` }
          ]);
        }
      }

      const message = 
        `📊 **Manage Wallet** ⬇️\n\n` +
        `To replace, regenerate or export the private key of a wallet, simply select which wallet you wish to manage using the buttons below.\n\n` +
        `**Wallets:**\n` +
        `${walletDisplay}\n` +
        `💰 **Total Balance:** ${totalBalance.toFixed(3)} ${chainInfo.symbol}\n` +
        `⛓️ **Network:** ${chainInfo.name}`;

      // Add management buttons at the bottom
      walletButtons.push(
        [
          { text: '⬇️ Import Wallet', callback_data: `wallet_import_${chain}` }
        ],
        [
          { text: '🔙 Back to Chains', callback_data: 'wallets_menu' }
        ]
      );

      const keyboard = { inline_keyboard: walletButtons };

      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
      
      // Performance logging
      const endTime = Date.now();
      const duration = endTime - startTime;
      console.log(`⚡ Wallet UI loaded in ${duration}ms (${activeWallets} wallets, ${chain})`);

    } catch (error) {
      console.error('❌ Error showing wallet management:', error.message);
      
      await this.bot.editMessageText(
        `❌ **Error Loading Wallets**\n\n` +
        `Failed to load wallet information for ${chain}.\n` +
        `Please try again.`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Try Again', callback_data: `chain_${chain}` }],
            [{ text: '🔙 Back to Chains', callback_data: 'wallets_menu' }]
          ]
        }
      });
    }
  }

  // Handle wallet actions
  async handleWalletAction(callbackQuery) {
    console.log('🔧 handleWalletAction called with data:', callbackQuery.data);
    
    const { data, from, message } = callbackQuery;
    const chatId = from.id;
    const messageId = message.message_id;

    const parts = data.split('_');
    console.log('🔧 Split parts:', parts);
    const [action, operation] = parts;
    console.log('🔧 Action:', action, 'Operation:', operation);

    if (operation === 'manage') {
      console.log('🔧 Handling manage operation');
      // Handle individual wallet management: wallet_manage_W1_base
      const walletSlot = parts[2];
      const chain = parts[3];
      console.log('🔧 WalletSlot:', walletSlot, 'Chain:', chain);
      console.log('🔧 About to call showIndividualWallet...');
      await this.showIndividualWallet(chatId, messageId, walletSlot, chain);
      console.log('🔧 showIndividualWallet completed successfully');
    } else if (operation === 'generate') {
      // Handle wallet generation
      if (parts.length === 4) {
        // Specific slot: wallet_generate_W1_base
        const walletSlot = parts[2];
        const chain = parts[3];
        await this.handleGenerateSpecificWallet(chatId, messageId, walletSlot, chain);
      } else {
        // General generate: wallet_generate_base
        const chain = parts[2];
        await this.handleGenerateWallet(chatId, messageId, chain);
      }
    } else if (operation === 'import') {
      const chain = parts[2];
      await this.handleImportWallet(chatId, messageId, chain);
    } else if (action === 'import' && operation === 'privatekey') {
      const chain = parts[2];
      await this.handleImportPrivateKey(chatId, messageId, chain);
    } else if (action === 'import' && operation === 'seedphrase') {
      const chain = parts[2];
      await this.handleImportSeedPhrase(chatId, messageId, chain);
    } else if (operation === 'export') {
      if (parts[2] === 'single') {
        // Handle single wallet export: wallet_export_single_W1_base
        const walletSlot = parts[3];
        const chain = parts[4];
        await this.handleExportSingleWallet(chatId, messageId, walletSlot, chain);
      } else {
        // Handle general export: wallet_export_base
        const chain = parts[2];
        await this.handleExportWallet(chatId, messageId, chain);
      }
    } else if (operation === 'delete') {
      if (parts[2] === 'single') {
        // Handle single wallet deletion: wallet_delete_single_W1_base
        const walletSlot = parts[3];
        const chain = parts[4];
        await this.handleDeleteSingleWallet(chatId, messageId, walletSlot, chain);
      } else if (parts[2] === 'confirm') {
        // Handle delete confirmation: wallet_delete_confirm_W1_base
        const walletSlot = parts[3];
        const chain = parts[4];
        await this.handleDeleteConfirm(chatId, messageId, walletSlot, chain);
      } else {
        // Handle general delete: wallet_delete_base
        const chain = parts[2];
        await this.handleDeleteWallet(chatId, messageId, chain);
      }
    } else if (operation === 'explorer') {
      // Handle wallet explorer: wallet_explorer_W1_base
      const walletSlot = parts[2];
      const chain = parts[3];
      await this.handleWalletExplorer(chatId, messageId, walletSlot, chain, callbackQuery);
    }
  }

  // Show individual wallet management (Looter.ai style)
  async showIndividualWallet(chatId, messageId, walletSlot, chain) {
    try {
      const chainWallets = await this.walletManager.getChainWallets(chatId, chain);
      const wallet = chainWallets[walletSlot];
      const chainInfo = this.getChainInfo(chain);

      if (!wallet) {
        await this.bot.editMessageText(
          `❌ **Wallet Not Found**\n\n` +
          `${walletSlot} is not generated yet.\n` +
          `Generate it first to manage.`, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '➕ Generate Now', callback_data: `wallet_generate_${walletSlot}_${chain}` }],
              [{ text: '🔙 Back to Wallets', callback_data: `chain_${chain}` }]
            ]
          }
        });
        return;
      }

      // Get balance with timeout and fallback
      let balance = "0.0";
      try {
        const balancePromise = this.walletManager.getWalletBalance(wallet.address, chain);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Balance fetch timeout')), 8000)
        );
        
        balance = await Promise.race([balancePromise, timeoutPromise]);
      } catch (balanceError) {
        console.error(`❌ Balance fetch failed: ${balanceError.message}`);
        balance = "0.0"; // Use fallback balance
      }
      
      const balanceNum = parseFloat(balance) || 0;
      const status = balanceNum > 0 ? '🟢' : '🔴';
      const shortAddress = `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;

      const walletNumber = walletSlot.replace('W', '');
      
      // Add timestamp to ensure content is unique on each refresh (fixes Telegram duplicate content error)
      const refreshTime = new Date().toLocaleTimeString();
      
      const message = 
        `📊 **Wallet ${walletNumber} Management**\n\n` +
        `**Address:** \`${wallet.address}\`\n\n` +
        `💰 **Balance:** ${balanceNum.toFixed(3)} ${chainInfo.symbol}\n` +
        `⛓️ **Network:** ${chainInfo.name}\n` +
        `📅 **Created:** ${new Date(wallet.createdAt).toLocaleDateString()}\n` +
        `🔄 **Last Updated:** ${refreshTime}\n\n` +
        `Select an action for this wallet:`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '🔄 Refresh', callback_data: `wallet_manage_${walletSlot}_${chain}` }
          ],
          [
            { text: '⬆️ Export Key', callback_data: `wallet_export_single_${walletSlot}_${chain}` },
            { text: `💰 Transfer ${this.getNativeToken(chain)}`, callback_data: `wallet_transfer_${walletSlot}_${chain}` }
          ],
          [
            { text: '🗑️ Delete Wallet', callback_data: `wallet_delete_single_${walletSlot}_${chain}` },
            { text: '📊 View on Explorer', callback_data: `wallet_explorer_${walletSlot}_${chain}` }
          ],
          [
            { text: '🔙 Back to All Wallets', callback_data: `chain_${chain}` }
          ]
        ]
      };

      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } catch (error) {
      console.error('❌ Error showing individual wallet:', error);
      
      await this.bot.editMessageText(
        `❌ **Error Loading Wallet**\n\n` +
        `Failed to load ${walletSlot} information.\n` +
        `Please try again.`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Back to Wallets', callback_data: `chain_${chain}` }]
          ]
        }
      });
    }
  }

  // Handle generating specific wallet slot
  async handleGenerateSpecificWallet(chatId, messageId, walletSlot, chain) {
    try {
      const chainWallets = await this.walletManager.getChainWallets(chatId, chain);
      const chainInfo = this.getChainInfo(chain);

      if (chainWallets[walletSlot]) {
        await this.bot.editMessageText(
          `⚠️ **Wallet Already Exists**\n\n` +
          `${walletSlot} is already generated for ${chainInfo.name}.\n` +
          `Delete it first if you want to generate a new one.`, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '👁️ View Wallet', callback_data: `wallet_manage_${walletSlot}_${chain}` }],
              [{ text: '🔙 Back to Wallets', callback_data: `chain_${chain}` }]
            ]
          }
        });
        return;
      }

      // Generate wallet in specific slot
      const address = await this.walletManager.generateWallet(chatId, walletSlot, chain);

      // Show success message with buttons to manage the new wallet
      await this.bot.editMessageText(
        `✅ **${walletSlot} Generated Successfully!**\n\n` +
        `🎯 **Slot:** ${walletSlot}\n` +
        `🔗 **Chain:** ${chainInfo.name}\n` +
        `📍 **Address:** \`${address}\`\n\n` +
        `💡 *Your new wallet is ready for trading!*`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '👁️ Manage This Wallet', callback_data: `wallet_manage_${walletSlot}_${chain}` }
            ],
            [
              { text: '🔙 Back to All Wallets', callback_data: `chain_${chain}` }
            ]
          ]
        }
      });

    } catch (error) {
      console.error('❌ Error generating specific wallet:', error.message);
      
      await this.bot.editMessageText(
        `❌ **Failed to Generate ${walletSlot}**\n\n` +
        `An error occurred while generating the wallet.\n` +
        `Please try again.`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Back to Wallets', callback_data: `chain_${chain}` }]
          ]
        }
      });
    }
  }

  // Handle generate wallet
  async handleGenerateWallet(chatId, messageId, chain) {
    try {
      const chainWallets = await this.walletManager.getChainWallets(chatId, chain);
      const availableSlots = [];

      for (let i = 1; i <= 5; i++) {
        const walletSlot = `W${i}`;
        if (!chainWallets[walletSlot]) {
          availableSlots.push(walletSlot);
        }
      }

      if (availableSlots.length === 0) {
        await this.bot.editMessageText(
          `⚠️ **All Wallet Slots Full**\n\n` +
          `You already have 5 wallets for ${chain}.\n` +
          `Delete a wallet first to generate a new one.`, {
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

      // Generate wallet in first available slot
      const walletSlot = availableSlots[0];
      const address = this.walletManager.generateWallet(chatId, walletSlot, chain);
      const chainInfo = this.getChainInfo(chain);

      // Show success message briefly, then redirect to wallet list
      await this.bot.editMessageText(
        `✅ **Wallet Generated Successfully!**\n\n` +
        `🎯 **Slot:** ${walletSlot}\n` +
        `🔗 **Chain:** ${chainInfo.name}\n` +
        `📍 **Address:** \`${address}\`\n\n` +
        `💡 *Your new wallet is ready for trading!*`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown'
      });

      // Immediately redirect to wallet list
      await this.showWalletManagement(chatId, messageId, chain);

    } catch (error) {
      console.error('❌ Error generating wallet:', error.message);
      
      await this.bot.editMessageText(
        `❌ **Failed to Generate Wallet**\n\n` +
        `An error occurred while generating the wallet.\n` +
        `Please try again.`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Back to Wallets', callback_data: `chain_${chain}` }]
          ]
        }
      });
    }
  }

  // Handle import wallet with options
  async handleImportWallet(chatId, messageId, chain) {
    const chainInfo = this.getChainInfo(chain);
    
    // Check if all wallet slots are full
    const chainWallets = await this.walletManager.getChainWallets(chatId, chain);
    
    console.log(`🔍 Checking wallet slots for user ${chatId} on ${chain}`);
    console.log('Chain wallets:', Object.keys(chainWallets));
    
    let availableSlot = null;
    for (let i = 1; i <= 5; i++) {
      const slot = `W${i}`;
      console.log(`Checking slot ${slot}: ${chainWallets[slot] ? 'OCCUPIED' : 'AVAILABLE'}`);
      if (!chainWallets[slot]) {
        availableSlot = slot;
        break;
      }
    }
    
    console.log(`Available slot: ${availableSlot}`);
    
    // If all slots are full, show replacement options
    if (!availableSlot) {
      console.log('🚫 All slots full, showing replacement options');
      await this.showReplaceWalletOptions(chatId, messageId, chainWallets, chain);
      return;
    }
    
    // If slots available, show normal import options
    await this.bot.editMessageText(
      `⬇️ **Import Wallet to ${chainInfo.name}**\n\n` +
      `Choose what type of wallet data you want to import:\n\n` +
      `🔑 **Private Key**\n` +
      `• 64 characters (with or without 0x)\n` +
      `• Full trading access\n` +
      `• Most secure option\n\n` +
      `📝 **Seed Phrase**\n` +
      `• 12 or 24 words\n` +
      `• Full wallet recovery\n` +
      `• Can generate multiple addresses\n\n` +
      `⚠️ **Security Notice:** Your wallet data is encrypted and stored securely`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔑 Import Private Key', callback_data: `import_privatekey_${chain}` },
            { text: '📝 Import Seed Phrase', callback_data: `import_seedphrase_${chain}` }
          ],
          [
            { text: '❌ Cancel', callback_data: `chain_${chain}` }
          ]
        ]
      }
    });
  }

  // Show replace wallet options when slots are full
  async showReplaceWalletOptions(chatId, messageId, chainWallets, chain) {
    const chainName = this.getChainInfo(chain).name;
    
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
          { text: `${walletEmoji} Replace Wallet ${i}`, callback_data: `replace_import_${slot}_${chain}` }
        ]);
      }
    }
    
    message += `\n⛓️ **Network:** ${chainName}`;
    
    // Add cancel button
    walletButtons.push([
      { text: '❌ Cancel', callback_data: `chain_${chain}` }
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

  // Get wallet emoji
  getWalletEmoji(index) {
    const emojis = ['', '🥇', '🥈', '🥉', '💎', '⭐'];
    return emojis[index] || '💼';
  }

  // Handle import private key
  async handleImportPrivateKey(chatId, messageId, chain) {
    console.log(`🔑 Import private key requested for user ${chatId} on ${chain}`);
    
    const chainInfo = this.getChainInfo(chain);
    
    // Set user state to expect private key input
    this.userStates.setImportState(chatId, 'privatekey', chain);
    console.log(`✅ User state set for ${chatId}: import privatekey on ${chain}`);
    
    // Send reply message asking for private key
    const replyMessage = await this.bot.sendMessage(chatId,
      `🔑 **Send your Private Key**\n\n` +
      `Please send your private key in your next message.\n\n` +
      `📋 **Accepted Formats:**\n` +
      `• \`0x1234567890abcdef...\` (with 0x prefix)\n` +
      `• \`1234567890abcdef...\` (without 0x prefix)\n` +
      `• Must be exactly 64 characters (excluding 0x)\n\n` +
      `⚠️ **Security Notice:**\n` +
      `• Your message will be deleted immediately\n` +
      `• Private key is encrypted before storage\n` +
      `• Only you can access this wallet`, {
      parse_mode: 'Markdown',
      reply_markup: {
        force_reply: true,
        input_field_placeholder: 'Send your private key here...'
      }
    });

    // Delete the original message
    try {
      await this.bot.deleteMessage(chatId, messageId);
    } catch (error) {
      console.log('Could not delete original message');
    }
  }

  // Handle import seed phrase
  async handleImportSeedPhrase(chatId, messageId, chain) {
    const chainInfo = this.getChainInfo(chain);
    
    // Set user state to expect seed phrase input
    this.userStates.setImportState(chatId, 'seedphrase', chain);
    
    // Send reply message asking for seed phrase
    const replyMessage = await this.bot.sendMessage(chatId,
      `📝 **Send your Seed Phrase**\n\n` +
      `Please send your seed phrase in your next message.\n\n` +
      `📋 **Accepted Formats:**\n` +
      `• 12 words: \`word1 word2 word3 ... word12\`\n` +
      `• 24 words: \`word1 word2 word3 ... word24\`\n` +
      `• Separated by spaces\n` +
      `• Standard BIP39 mnemonic phrases\n\n` +
      `⚠️ **Security Notice:**\n` +
      `• Your message will be deleted immediately\n` +
      `• Seed phrase is encrypted before storage\n` +
      `• Can recover multiple wallet addresses`, {
      parse_mode: 'Markdown',
      reply_markup: {
        force_reply: true,
        input_field_placeholder: 'Send your seed phrase here...'
      }
    });

    // Delete the original message
    try {
      await this.bot.deleteMessage(chatId, messageId);
    } catch (error) {
      console.log('Could not delete original message');
    }
  }

  // Handle export wallet (placeholder)
  async handleExportWallet(chatId, messageId, chain) {
    const chainWallets = await this.walletManager.getChainWallets(chatId, chain);
    const walletButtons = [];

    for (let i = 1; i <= 5; i++) {
      const walletSlot = `W${i}`;
      if (chainWallets[walletSlot]) {
        const shortAddress = `${chainWallets[walletSlot].address.slice(0, 6)}...${chainWallets[walletSlot].address.slice(-4)}`;
        walletButtons.push([{ text: `${walletSlot}: ${shortAddress}`, callback_data: `export_${walletSlot}_${chain}` }]);
      }
    }

    if (walletButtons.length === 0) {
      await this.bot.editMessageText(
        `⚠️ **No Wallets to Export**\n\n` +
        `You don't have any wallets for ${chain}.\n` +
        `Generate a wallet first.`, {
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

    walletButtons.push([{ text: '🔙 Back to Wallets', callback_data: `chain_${chain}` }]);

    await this.bot.editMessageText(
      `⬆️ **Export Wallet**\n\n` +
      `Select which wallet you want to export:\n\n` +
      `⚠️ **Security Warning:**\n` +
      `Private key will be sent in a secure message that auto-deletes.`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: walletButtons
      }
    });
  }

  // Handle export single wallet
  async handleExportSingleWallet(chatId, messageId, walletSlot, chain) {
    try {
      const chainWallets = await this.walletManager.getChainWallets(chatId, chain);
      const wallet = chainWallets[walletSlot];
      const chainInfo = this.getChainInfo(chain);
      const walletNumber = walletSlot.replace('W', '');

      if (!wallet) {
        await this.bot.editMessageText(
          `❌ **Wallet Not Found**\n\n` +
          `Wallet ${walletNumber} doesn't exist on ${chainInfo.name}.`, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 Back to Wallet', callback_data: `wallet_manage_${walletSlot}_${chain}` }]
            ]
          }
        });
        return;
      }

      // Show export confirmation
      const shortAddress = `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;
      
      await this.bot.editMessageText(
        `⬆️ **Export Wallet ${walletNumber} Private Key**\n\n` +
        `**Wallet Details:**\n` +
        `📍 Address: \`${shortAddress}\`\n` +
        `⛓️ Network: ${chainInfo.name}\n\n` +
        `⚠️ **Security Warning:**\n` +
        `• Private key will be sent in a secure message\n` +
        `• Message will auto-delete after 30 seconds\n` +
        `• Never share your private key with anyone\n` +
        `• Store it safely offline\n\n` +
        `Are you sure you want to export this private key?`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '❌ Cancel', callback_data: `wallet_manage_${walletSlot}_${chain}` },
              { text: '⬆️ Export Key', callback_data: `export_confirm_${walletSlot}_${chain}` }
            ]
          ]
        }
      });

    } catch (error) {
      console.error('❌ Error in handleExportSingleWallet:', error);
      
      await this.bot.editMessageText(
        `❌ **Error**\n\n` +
        `Failed to load wallet information.\n` +
        `Please try again.`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Back to Wallet', callback_data: `wallet_manage_${walletSlot}_${chain}` }]
          ]
        }
      });
    }
  }

  // Handle delete single wallet
  async handleDeleteSingleWallet(chatId, messageId, walletSlot, chain) {
    try {
      const chainWallets = await this.walletManager.getChainWallets(chatId, chain);
      const wallet = chainWallets[walletSlot];
      const chainInfo = this.getChainInfo(chain);
      const walletNumber = walletSlot.replace('W', '');

      if (!wallet) {
        await this.bot.editMessageText(
          `❌ **Wallet Not Found**\n\n` +
          `Wallet ${walletNumber} doesn't exist on ${chainInfo.name}.`, {
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

      // Get wallet balance to show in confirmation
      let balance = "0.0";
      try {
        balance = await this.walletManager.getWalletBalance(wallet.address, chain);
      } catch (error) {
        console.error('Balance fetch failed for delete confirmation:', error.message);
      }

      const balanceNum = parseFloat(balance) || 0;
      const shortAddress = `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;

      // Show confirmation dialog
      await this.bot.editMessageText(
        `🗑️ **Delete Wallet ${walletNumber}**\n\n` +
        `⚠️ **WARNING: This action cannot be undone!**\n\n` +
        `**Wallet Details:**\n` +
        `📍 Address: \`${shortAddress}\`\n` +
        `💰 Balance: ${balanceNum.toFixed(3)} ${chainInfo.symbol}\n` +
        `⛓️ Network: ${chainInfo.name}\n\n` +
        `${balanceNum > 0 ? '💸 **Transfer your funds before deleting!**\n\n' : ''}` +
        `Are you sure you want to permanently delete this wallet?`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '❌ Cancel', callback_data: `wallet_manage_${walletSlot}_${chain}` },
              { text: '🗑️ DELETE FOREVER', callback_data: `wallet_delete_confirm_${walletSlot}_${chain}` }
            ]
          ]
        }
      });

    } catch (error) {
      console.error('❌ Error in handleDeleteSingleWallet:', error);
      
      await this.bot.editMessageText(
        `❌ **Error**\n\n` +
        `Failed to load wallet information.\n` +
        `Please try again.`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Back to Wallets', callback_data: `chain_${chain}` }]
          ]
        }
      });
    }
  }

  // Handle delete confirmation - actually delete the wallet
  async handleDeleteConfirm(chatId, messageId, walletSlot, chain) {
    try {
      const chainWallets = await this.walletManager.getChainWallets(chatId, chain);
      const wallet = chainWallets[walletSlot];
      const chainInfo = this.getChainInfo(chain);
      const walletNumber = walletSlot.replace('W', '');

      if (!wallet) {
        await this.bot.editMessageText(
          `❌ **Wallet Not Found**\n\n` +
          `Wallet ${walletNumber} doesn't exist on ${chainInfo.name}.`, {
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

      // Delete the wallet from database
      const success = await this.walletManager.deleteWallet(chatId, walletSlot, chain);

      if (success) {
        // Show success message
        await this.bot.editMessageText(
          `✅ **Wallet Deleted Successfully**\n\n` +
          `🗑️ Wallet ${walletNumber} has been permanently removed from ${chainInfo.name}.\n\n` +
          `📍 **Address:** \`${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}\`\n\n` +
          `💡 You can generate a new wallet anytime.`, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '➕ Generate New Wallet', callback_data: `wallet_generate_${walletSlot}_${chain}` }
              ],
              [
                { text: '🔙 Back to Wallets', callback_data: `chain_${chain}` }
              ]
            ]
          }
        });
      } else {
        // Show error message
        await this.bot.editMessageText(
          `❌ **Delete Failed**\n\n` +
          `Failed to delete Wallet ${walletNumber}.\n` +
          `Please try again.`, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🔄 Try Again', callback_data: `wallet_delete_single_${walletSlot}_${chain}` },
                { text: '❌ Cancel', callback_data: `wallet_manage_${walletSlot}_${chain}` }
              ]
            ]
          }
        });
      }

    } catch (error) {
      console.error('❌ Error in handleDeleteConfirm:', error);
      
      await this.bot.editMessageText(
        `❌ **Delete Error**\n\n` +
        `An error occurred while deleting the wallet.\n` +
        `Please try again.`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔄 Try Again', callback_data: `wallet_delete_single_${walletSlot}_${chain}` },
              { text: '🔙 Back to Wallets', callback_data: `chain_${chain}` }
            ]
          ]
        }
      });
    }
  }

  // Handle delete wallet (placeholder)
  async handleDeleteWallet(chatId, messageId, chain) {
    await this.bot.editMessageText(
      `🚧 **Delete Wallet**\n\n` +
      `This feature is coming soon!\n\n` +
      `You'll be able to safely delete wallets here.`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Back to Wallets', callback_data: `chain_${chain}` }]
        ]
      }
    });
  }

  // Handle wallet explorer view
  async handleWalletExplorer(chatId, messageId, walletSlot, chain, callbackQuery) {
    try {
      const chainWallets = await this.walletManager.getChainWallets(chatId, chain);
      const wallet = chainWallets[walletSlot];
      const chainInfo = this.getChainInfo(chain);
      
      if (!wallet) {
        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: '❌ Wallet not found',
          show_alert: true
        });
        return;
      }

      const explorerUrl = this.getExplorerUrl(wallet.address, chain);
      const walletNumber = walletSlot.replace('W', '');
      const shortAddress = `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;

      // First acknowledge the callback
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: `🌐 Opening ${chainInfo.name} Explorer...`,
        show_alert: false
      });

      // Then send a new message with the explorer button
      const message = 
        `🌐 **Wallet ${walletNumber} Explorer**\n\n` +
        `**Address:** \`${wallet.address}\`\n\n` +
        `**Short Address:** ${shortAddress}\n` +
        `**Chain:** ${chainInfo.name} ${chainInfo.icon}\n` +
        `**Explorer:** ${chainInfo.explorer}\n\n` +
        `Click the button below to open the wallet in ${chainInfo.explorer}:`;

      const keyboard = {
        inline_keyboard: [
          [
            { 
              text: `🌐 Open in ${chainInfo.explorer}`, 
              url: explorerUrl 
            }
          ],
          [
            { 
              text: '🔙 Back to Wallet', 
              callback_data: `wallet_manage_${walletSlot}_${chain}` 
            }
          ]
        ]
      };

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } catch (error) {
      console.error('❌ Error showing wallet explorer:', error);
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Could not load wallet explorer information',
        show_alert: true
      });
    }
  }



  // Get wallet explorer URL for address
  getWalletExplorerUrl(address, chain) {
    const explorers = {
      ethereum: `https://etherscan.io/address/${address}`,
      base: `https://basescan.org/address/${address}`,
      bsc: `https://bscscan.com/address/${address}`,
      arbitrum: `https://arbiscan.io/address/${address}`,
      polygon: `https://polygonscan.com/address/${address}`,
      avalanche: `https://snowtrace.io/address/${address}`,
      solana: `https://solscan.io/account/${address}`,
      blast: `https://blastscan.io/address/${address}`,
      optimism: `https://optimistic.etherscan.io/address/${address}`
    };
    return explorers[chain] || `https://etherscan.io/address/${address}`;
  }

  // Get wallet emoji for each wallet number
  getWalletEmoji(walletNumber) {
    const walletEmojis = {
      1: '🥇', // Gold medal for wallet 1
      2: '🥈', // Silver medal for wallet 2  
      3: '🥉', // Bronze medal for wallet 3
      4: '💎', // Diamond for wallet 4
      5: '⭐'  // Star for wallet 5
    };
    return walletEmojis[walletNumber] || '💼';
  }

  // Get chain information
  getChainInfo(chain) {
    const chains = {
      ethereum: { name: 'Ethereum', symbol: 'ETH', icon: '🟣', explorer: 'Etherscan.io' },
      base: { name: 'Base', symbol: 'ETH', icon: '🔵', explorer: 'BaseScan.org' },
      bsc: { name: 'BNB Smart Chain', symbol: 'BNB', icon: '🟡', explorer: 'BSCScan.com' },
      arbitrum: { name: 'Arbitrum One', symbol: 'ETH', icon: '🔷', explorer: 'Arbiscan.io' },
      polygon: { name: 'Polygon', symbol: 'MATIC', icon: '🟣', explorer: 'PolygonScan.com' },
      avalanche: { name: 'Avalanche', symbol: 'AVAX', icon: '🔴', explorer: 'SnowTrace.io' },
      solana: { name: 'Solana', symbol: 'SOL', icon: '🟢', explorer: 'Solscan.io' },
      blast: { name: 'Blast', symbol: 'ETH', icon: '💥', explorer: 'BlastScan.io' },
      optimism: { name: 'Optimism', symbol: 'ETH', icon: '🔴', explorer: 'Optimistic.Etherscan.io' }
    };

    return chains[chain] || chains.base;
  }

  // Get explorer URL for wallet address
  getExplorerUrl(address, chain) {
    const explorerUrls = {
      ethereum: `https://etherscan.io/address/${address}`,
      base: `https://basescan.org/address/${address}`,
      bsc: `https://bscscan.com/address/${address}`,
      arbitrum: `https://arbiscan.io/address/${address}`,
      polygon: `https://polygonscan.com/address/${address}`,
      avalanche: `https://snowtrace.io/address/${address}`,
      solana: `https://solscan.io/account/${address}`,
      blast: `https://blastscan.io/address/${address}`,
      optimism: `https://optimistic.etherscan.io/address/${address}`
    };

    return explorerUrls[chain] || explorerUrls.base;
  }
}

module.exports = WalletUI;