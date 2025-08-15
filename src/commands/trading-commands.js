/**
 * Simple Trading Commands for Testing
 * /quote and /execbuy commands for Base trading
 */

const BaseTrading = require('../services/base-trading');
const config = require('../config');

class TradingCommands {
  constructor(bot) {
    this.bot = bot;
    this.baseTrading = new BaseTrading();
    this.setupCommands();
    
    console.log('🎯 Trading commands initialized');
  }

  setupCommands() {
    // Health check command
    this.bot.onText(/\/health/, async (msg) => {
      await this.handleHealthCheck(msg);
    });

    // Quote command: /quote <token_address> <eth_amount> [fee_tier]
    this.bot.onText(/\/quote (.+) ([0-9.]+) ?([0-9]+)?/, async (msg, match) => {
      await this.handleQuote(msg, match);
    });

    // Exec buy command: /execbuy <token_address> <eth_amount> <slippage_percent> [fee_tier]
    this.bot.onText(/\/execbuy (.+) ([0-9.]+) ([0-9.]+) ?([0-9]+)?/, async (msg, match) => {
      await this.handleExecBuy(msg, match);
    });

    // Balance command
    this.bot.onText(/\/balance/, async (msg) => {
      await this.handleBalance(msg);
    });

    // Help command for trading
    this.bot.onText(/\/trading/, async (msg) => {
      await this.handleTradingHelp(msg);
    });
  }

  async handleHealthCheck(msg) {
    const chatId = msg.chat.id;
    
    try {
      console.log(`🏥 Health check requested by ${chatId}`);
      
      const health = await this.baseTrading.healthCheck();
      
      let message = `🏥 **Base Trading Health Check**\n\n`;
      
      if (health.healthy) {
        message += `✅ **Status**: Healthy\n`;
        message += `📊 **Block**: ${health.blockNumber}\n`;
        message += `⛽ **Gas Price**: ${health.gasPrice} gwei\n`;
        message += `🌐 **RPC**: ${health.rpcHealth.healthyProviders}/${health.rpcHealth.totalProviders} healthy\n`;
      } else {
        message += `❌ **Status**: Unhealthy\n`;
        message += `🔧 **Error**: ${health.error}\n`;
      }
      
      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      
    } catch (error) {
      console.error('❌ Health check error:', error.message);
      await this.bot.sendMessage(chatId, `❌ Health check failed: ${error.message}`);
    }
  }

  async handleQuote(msg, match) {
    const chatId = msg.chat.id;
    const tokenAddress = match[1].trim();
    const ethAmount = parseFloat(match[2]);
    const feeTier = match[3] ? parseInt(match[3]) : config.defaultFeeTier;

    try {
      console.log(`📊 Quote requested: ${ethAmount} ETH -> ${tokenAddress}`);
      
      // Validate inputs
      if (!tokenAddress.startsWith('0x') || tokenAddress.length !== 42) {
        await this.bot.sendMessage(chatId, '❌ Invalid token address format');
        return;
      }

      if (ethAmount <= 0 || ethAmount > 10) {
        await this.bot.sendMessage(chatId, '❌ ETH amount must be between 0 and 10');
        return;
      }

      if (![500, 3000, 10000].includes(feeTier)) {
        await this.bot.sendMessage(chatId, '❌ Fee tier must be 500, 3000, or 10000');
        return;
      }

      await this.bot.sendMessage(chatId, `⏳ Getting quote for ${ethAmount} ETH...`);

      // Get token info
      const tokenInfo = await this.baseTrading.getTokenInfo(tokenAddress);
      
      // Get quote
      const quote = await this.baseTrading.quoteExactInputSingle(tokenAddress, ethAmount, feeTier);
      
      const expectedTokens = quote.amountOut;
      const expectedFormatted = ethers.utils.formatUnits(expectedTokens, tokenInfo.decimals);

      let message = `📊 **Quote Result**\n\n`;
      message += `🪙 **Token**: ${tokenInfo.symbol} (${tokenInfo.name})\n`;
      message += `💰 **Input**: ${ethAmount} ETH\n`;
      message += `📤 **Expected Output**: ${parseFloat(expectedFormatted).toFixed(6)} ${tokenInfo.symbol}\n`;
      message += `🏊 **Fee Tier**: ${feeTier / 10000}%\n`;
      message += `⛽ **Gas Estimate**: ${quote.gasEstimate.toString()}\n`;
      message += `\n💡 To execute: \`/execbuy ${tokenAddress} ${ethAmount} 1 ${feeTier}\``;

      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

    } catch (error) {
      console.error('❌ Quote error:', error.message);
      
      let errorMessage = '❌ Quote failed: ';
      if (error.message.includes('execution reverted')) {
        errorMessage += 'No liquidity found for this token/fee tier combination. Try fee tier 500 or 10000.';
      } else {
        errorMessage += error.message;
      }
      
      await this.bot.sendMessage(chatId, errorMessage);
    }
  }

  async handleExecBuy(msg, match) {
    const chatId = msg.chat.id;
    const tokenAddress = match[1].trim();
    const ethAmount = parseFloat(match[2]);
    const slippagePercent = parseFloat(match[3]);
    const feeTier = match[4] ? parseInt(match[4]) : config.defaultFeeTier;

    try {
      console.log(`🚀 Exec buy requested: ${ethAmount} ETH -> ${tokenAddress} (${slippagePercent}% slippage)`);
      
      // Validate inputs
      if (!tokenAddress.startsWith('0x') || tokenAddress.length !== 42) {
        await this.bot.sendMessage(chatId, '❌ Invalid token address format');
        return;
      }

      if (ethAmount <= 0 || ethAmount > 1) {
        await this.bot.sendMessage(chatId, '❌ ETH amount must be between 0 and 1 (safety limit)');
        return;
      }

      if (slippagePercent < 0.1 || slippagePercent > 50) {
        await this.bot.sendMessage(chatId, '❌ Slippage must be between 0.1% and 50%');
        return;
      }

      if (![500, 3000, 10000].includes(feeTier)) {
        await this.bot.sendMessage(chatId, '❌ Fee tier must be 500, 3000, or 10000');
        return;
      }

      // Check if private key is configured
      if (!config.pk || config.pk === 'your_private_key_here') {
        await this.bot.sendMessage(chatId, '❌ Private key not configured. Please set PRIVATE_KEY in .env file.');
        return;
      }

      await this.bot.sendMessage(chatId, `🚀 Executing buy: ${ethAmount} ETH -> token (${slippagePercent}% slippage)...`);

      // Execute the buy
      const result = await this.baseTrading.execBuy({
        privateKey: config.pk,
        tokenOut: tokenAddress,
        amountEth: ethAmount,
        slippageBps: Math.floor(slippagePercent * 100), // Convert to basis points
        feeTier: feeTier
      });

      if (result.success) {
        let message = `🎉 **Buy Successful!**\n\n`;
        message += `📍 **TX Hash**: \`${result.txHash}\`\n`;
        message += `🪙 **Token**: ${result.tokenInfo.symbol}\n`;
        message += `💰 **Input**: ${ethAmount} ETH\n`;
        message += `⛽ **Gas Used**: ${result.gasUsed}\n`;
        message += `📊 **Block**: ${result.blockNumber}\n`;
        message += `🔗 [View on Basescan](${result.explorerUrl})\n`;

        await this.bot.sendMessage(chatId, message, { 
          parse_mode: 'Markdown',
          disable_web_page_preview: true 
        });
      } else {
        let message = `❌ **Buy Failed**\n\n`;
        message += `🔧 **Error**: ${result.error}\n`;
        
        if (result.originalError) {
          message += `📋 **Details**: ${result.originalError}\n`;
        }

        await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      }

    } catch (error) {
      console.error('❌ Exec buy error:', error.message);
      await this.bot.sendMessage(chatId, `❌ Exec buy failed: ${error.message}`);
    }
  }

  async handleBalance(msg) {
    const chatId = msg.chat.id;

    try {
      if (!config.pk || config.pk === 'your_private_key_here') {
        await this.bot.sendMessage(chatId, '❌ Private key not configured');
        return;
      }

      const { ethers } = require('ethers');
      const wallet = new ethers.Wallet(config.pk);
      const balance = await this.baseTrading.getWalletBalance(wallet.address);

      let message = `💰 **Wallet Balance**\n\n`;
      message += `📍 **Address**: \`${wallet.address}\`\n`;
      message += `💰 **Balance**: ${balance} ETH\n`;
      message += `🌐 **Network**: Base\n`;

      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

    } catch (error) {
      console.error('❌ Balance error:', error.message);
      await this.bot.sendMessage(chatId, `❌ Balance check failed: ${error.message}`);
    }
  }

  async handleTradingHelp(msg) {
    const chatId = msg.chat.id;

    const message = `🎯 **Base Trading Commands**\n\n` +
      `📊 **Quote**: \`/quote <token> <eth_amount> [fee_tier]\`\n` +
      `   Example: \`/quote 0x36a947baa2492c72bf9d3307117237e79145a87d 0.001 3000\`\n\n` +
      `🚀 **Execute Buy**: \`/execbuy <token> <eth_amount> <slippage%> [fee_tier]\`\n` +
      `   Example: \`/execbuy 0x36a947baa2492c72bf9d3307117237e79145a87d 0.001 1 3000\`\n\n` +
      `💰 **Balance**: \`/balance\`\n` +
      `🏥 **Health**: \`/health\`\n\n` +
      `**Fee Tiers**: 500 (0.05%), 3000 (0.3%), 10000 (1%)\n` +
      `**Safety Limits**: Max 1 ETH per trade\n` +
      `**Network**: Base (uses public RPC)\n\n` +
      `⚠️ **Note**: Configure PRIVATE_KEY in .env to trade`;

    await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  }
}

module.exports = TradingCommands;