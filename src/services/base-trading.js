/**
 * Base Trading Service
 * Simplified Uniswap V3 integration with RPC rotation
 */

const { ethers } = require('ethers');
const config = require('../config');
const rpcManager = require('./rpc-manager');
const FeeTransferManager = require('./fee-transfer-manager');

class BaseTrading {
  constructor() {
    this.contracts = config.base.contracts;
    
    // Initialize fee transfer manager
    this.feeTransferManager = new FeeTransferManager();
    
    // Router ABI (minimal for exactInputSingle)
    this.routerABI = [
      {
        "inputs": [
          {
            "components": [
              {"internalType": "address", "name": "tokenIn", "type": "address"},
              {"internalType": "address", "name": "tokenOut", "type": "address"},
              {"internalType": "uint24", "name": "fee", "type": "uint24"},
              {"internalType": "address", "name": "recipient", "type": "address"},
              {"internalType": "uint256", "name": "deadline", "type": "uint256"},
              {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
              {"internalType": "uint256", "name": "amountOutMinimum", "type": "uint256"},
              {"internalType": "uint160", "name": "sqrtPriceLimitX96", "type": "uint160"}
            ],
            "internalType": "struct ISwapRouter.ExactInputSingleParams",
            "name": "params",
            "type": "tuple"
          }
        ],
        "name": "exactInputSingle",
        "outputs": [{"internalType": "uint256", "name": "amountOut", "type": "uint256"}],
        "stateMutability": "payable",
        "type": "function"
      }
    ];

    // Quoter ABI (minimal for quoteExactInputSingle)
    this.quoterABI = [
      {
        "inputs": [
          {"internalType": "address", "name": "tokenIn", "type": "address"},
          {"internalType": "address", "name": "tokenOut", "type": "address"},
          {"internalType": "uint24", "name": "fee", "type": "uint24"},
          {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
          {"internalType": "uint160", "name": "sqrtPriceLimitX96", "type": "uint160"}
        ],
        "name": "quoteExactInputSingle",
        "outputs": [
          {"internalType": "uint256", "name": "amountOut", "type": "uint256"},
          {"internalType": "uint160", "name": "sqrtPriceX96After", "type": "uint160"},
          {"internalType": "uint32", "name": "initializedTicksCrossed", "type": "uint32"},
          {"internalType": "uint256", "name": "gasEstimate", "type": "uint256"}
        ],
        "stateMutability": "view",
        "type": "function"
      }
    ];

    // ERC20 ABI (minimal for token info)
    this.erc20ABI = [
      {
        "inputs": [],
        "name": "decimals",
        "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "symbol",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "name",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
      }
    ];

    console.log('🔵 Base Trading Service initialized');
  }

  async getWallet(privateKey) {
    const provider = await rpcManager.getHealthyProvider();
    return new ethers.Wallet(privateKey, provider);
  }

  async getTokenInfo(tokenAddress) {
    return await rpcManager.executeWithRetry(async (provider) => {
      const contract = new ethers.Contract(tokenAddress, this.erc20ABI, provider);
      
      const [decimals, symbol, name] = await Promise.all([
        contract.decimals().catch(() => 18),
        contract.symbol().catch(() => 'UNKNOWN'),
        contract.name().catch(() => 'Unknown Token')
      ]);

      return {
        address: tokenAddress,
        decimals: Number(decimals),
        symbol,
        name
      };
    });
  }

  async quoteExactInputSingle(tokenOut, amountEth, feeTier = config.defaultFeeTier) {
    return await rpcManager.executeWithRetry(async (provider) => {
      const quoter = new ethers.Contract(this.contracts.quoterV2, this.quoterABI, provider);
      const amountIn = ethers.utils.parseEther(amountEth.toString());

      console.log(`📊 Getting quote for ${amountEth} ETH -> ${tokenOut}`);
      console.log(`🏊 Fee tier: ${feeTier / 10000}%`);

      const result = await quoter.callStatic.quoteExactInputSingle(
        this.contracts.weth,
        tokenOut,
        feeTier,
        amountIn,
        0
      );

      const [amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate] = result;

      console.log(`📈 Quote result:`);
      console.log(`  📤 Amount out: ${ethers.utils.formatUnits(amountOut, 18)}`);
      console.log(`  ⛽ Gas estimate: ${gasEstimate.toString()}`);

      return {
        amountIn,
        amountOut,
        sqrtPriceX96After,
        initializedTicksCrossed,
        gasEstimate
      };
    });
  }

  async execBuy({
    privateKey,
    tokenOut,
    amountEth,
    slippageBps = config.defaultSlippageBps,
    feeTier = config.defaultFeeTier
  }) {
    console.log(`🚀 ========== EXEC BUY (NO FEES) ==========`);
    console.log(`🎯 Token: ${tokenOut}`);
    console.log(`💰 Amount: ${amountEth} ETH`);
    console.log(`🛡️ Slippage: ${slippageBps / 100}%`);
    console.log(`🏊 Fee Tier: ${feeTier / 10000}%`);

    try {
      // Get wallet
      const wallet = await this.getWallet(privateKey);
      console.log(`👤 Wallet: ${wallet.address}`);

      // Check balance
      const balance = await wallet.getBalance();
      const amountWei = ethers.utils.parseEther(amountEth.toString());
      
      if (balance.lt(amountWei)) {
        throw new Error(`Insufficient balance: ${ethers.utils.formatEther(balance)} ETH available, ${amountEth} ETH required`);
      }

      console.log(`💰 Balance: ${ethers.utils.formatEther(balance)} ETH ✅`);

      // Get token info
      const tokenInfo = await this.getTokenInfo(tokenOut);
      console.log(`🪙 Token: ${tokenInfo.symbol} (${tokenInfo.name})`);

      // Get quote
      const quote = await this.quoteExactInputSingle(tokenOut, amountEth, feeTier);
      
      // Calculate minimum output with slippage
      const minOut = quote.amountOut.mul(10000 - slippageBps).div(10000);
      
      console.log(`📊 Trade calculation:`);
      console.log(`  📤 Expected: ${ethers.utils.formatUnits(quote.amountOut, tokenInfo.decimals)} ${tokenInfo.symbol}`);
      console.log(`  🛡️ Min out: ${ethers.utils.formatUnits(minOut, tokenInfo.decimals)} ${tokenInfo.symbol}`);

      // Prepare swap parameters
      const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes
      const swapParams = {
        tokenIn: this.contracts.weth,
        tokenOut: tokenOut,
        fee: feeTier,
        recipient: wallet.address,
        deadline: deadline,
        amountIn: amountWei,
        amountOutMinimum: minOut,
        sqrtPriceLimitX96: 0
      };

      // Execute swap
      const router = new ethers.Contract(this.contracts.swapRouter, this.routerABI, wallet);
      
      console.log(`🔄 Executing swap...`);
      
      // Estimate gas
      let gasLimit;
      try {
        gasLimit = await router.estimateGas.exactInputSingle(swapParams, { value: amountWei });
        gasLimit = gasLimit.mul(120).div(100); // 20% buffer
        console.log(`⛽ Gas limit: ${gasLimit.toString()}`);
      } catch (gasError) {
        console.warn(`⚠️ Gas estimation failed: ${gasError.message}`);
        gasLimit = ethers.BigNumber.from('500000'); // Fallback
      }

      const tx = await router.exactInputSingle(swapParams, {
        value: amountWei,
        gasLimit: gasLimit
      });

      console.log(`📍 Transaction sent: ${tx.hash}`);
      console.log(`⏳ Waiting for confirmation...`);

      const receipt = await tx.wait();

      console.log(`✅ SWAP COMPLETED SUCCESSFULLY!`);
      console.log(`📊 Gas used: ${receipt.gasUsed.toString()}`);
      console.log(`🔗 Basescan: ${config.base.explorer}/tx/${tx.hash}`);

      return {
        success: true,
        txHash: tx.hash,
        receipt: receipt,
        amountIn: amountWei,
        amountOutQuoted: quote.amountOut,
        amountOutMin: minOut,
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber,
        tokenInfo: tokenInfo,
        explorerUrl: `${config.base.explorer}/tx/${tx.hash}`
      };

    } catch (error) {
      console.error('❌ Exec buy failed:', error.message);
      
      // Enhanced error handling
      let errorMessage = error.message;
      if (error.message.includes('INSUFFICIENT_OUTPUT_AMOUNT')) {
        errorMessage = `Insufficient output amount. Try increasing slippage or using a different fee tier (500, 3000, or 10000).`;
      } else if (error.message.includes('execution reverted')) {
        errorMessage = `Transaction reverted. This might be due to insufficient liquidity or wrong fee tier.`;
      }

      return {
        success: false,
        error: errorMessage,
        originalError: error.message,
        code: error.code
      };
    }
  }

  // NEW: Exec Buy with Tiered Execution and Fee Collection
  async execBuyWithFee({
    privateKey,
    tokenOut,
    amountEth,
    slippageBps = config.defaultSlippageBps,
    feeTier = config.defaultFeeTier,
    userTier = 'FREE_TIER',
    feeInfo,
    gasSettings
  }) {
    console.log(`🚀 ========== TIERED EXEC BUY WITH FEE ==========`);
    console.log(`🎯 Token: ${tokenOut}`);
    console.log(`💰 Original Amount: ${amountEth} ETH`);
    console.log(`💸 Fee Deducted: ${feeInfo.feeAmount} ETH (${feeInfo.feePercent}%)`);
    console.log(`✅ Net Amount: ${feeInfo.netAmount} ETH`);
    console.log(`🏷️ User Tier: ${userTier}`);
    console.log(`🛡️ Slippage: ${slippageBps / 100}%`);

    try {
      // Get wallet
      const wallet = await this.getWallet(privateKey);
      console.log(`👤 Wallet: ${wallet.address}`);

      // Check balance (against original amount)
      const balance = await wallet.getBalance();
      const originalAmountWei = ethers.utils.parseEther(amountEth.toString());
      const netAmountWei = ethers.utils.parseEther(feeInfo.netAmount.toString());
      
      if (balance.lt(originalAmountWei)) {
        throw new Error(`Insufficient balance: ${ethers.utils.formatEther(balance)} ETH available, ${amountEth} ETH required`);
      }

      console.log(`💰 Balance: ${ethers.utils.formatEther(balance)} ETH ✅`);

      // Get token info
      const tokenInfo = await this.getTokenInfo(tokenOut);
      console.log(`🪙 Token: ${tokenInfo.symbol} (${tokenInfo.name})`);

      // Get quote for net amount (after fee) with automatic fee tier fallback
      let quote;
      let usedFeeTier = feeTier;
      const candidateFees = [feeTier, 500, 3000, 10000]
        .filter((v, i, arr) => v && arr.indexOf(v) === i); // unique, keep provided first

      for (const ft of candidateFees) {
        try {
          console.log(`📊 Trying quote for ${feeInfo.netAmount} ETH at fee tier ${ft / 10000}%...`);
          quote = await this.quoteExactInputSingle(tokenOut, feeInfo.netAmount, ft);
          usedFeeTier = ft;
          break;
        } catch (qErr) {
          console.warn(`⚠️ Quote failed at fee tier ${ft / 10000}%: ${qErr.message}`);
        }
      }

      if (!quote) {
        throw new Error('Unable to quote trade on available Uniswap V3 fee tiers (tried 0.05%, 0.3%, 1%). Pool may not exist.');
      }

      const minOut = quote.amountOut.mul(10000 - slippageBps).div(10000);
      console.log(`📊 Quote: ${ethers.utils.formatUnits(quote.amountOut, tokenInfo.decimals)} ${tokenInfo.symbol}`);
      console.log(`🔒 Min Output: ${ethers.utils.formatUnits(minOut, tokenInfo.decimals)} ${tokenInfo.symbol}`);
      console.log(`🏊 Using fee tier: ${usedFeeTier / 10000}%`);

      // Build swap parameters
      const deadline = Math.floor(Date.now() / 1000) + 600; // 10 minutes
      const swapParams = {
        tokenIn: this.contracts.weth,
        tokenOut: tokenOut,
        fee: usedFeeTier,
        recipient: wallet.address,
        deadline: deadline,
        amountIn: netAmountWei, // Use net amount after fee
        amountOutMinimum: minOut,
        sqrtPriceLimitX96: 0
      };

      // Execute swap with tier-specific settings
      const router = new ethers.Contract(this.contracts.swapRouter, this.routerABI, wallet);
      console.log(`🔄 Executing swap with ${userTier} settings...`);
      
      // Estimate gas with tier-specific limits
      let gasLimit;
      try {
        gasLimit = await router.estimateGas.exactInputSingle(swapParams, { value: netAmountWei });
        gasLimit = gasLimit.mul(120).div(100); // 20% buffer
        console.log(`⛽ Gas limit: ${gasLimit.toString()}`);
      } catch (gasError) {
        console.warn(`⚠️ Gas estimation failed: ${gasError.message}`);
        gasLimit = ethers.BigNumber.from(gasSettings?.gasLimit || '500000'); // Use tier-specific fallback
      }

      // Build transaction options with tier-specific gas settings
      const txOptions = {
        value: netAmountWei, // Send net amount after fee
        gasLimit: gasLimit
      };

      // Apply tier-specific gas pricing
      if (gasSettings) {
        if (gasSettings.maxFeePerGas) {
          txOptions.maxFeePerGas = gasSettings.maxFeePerGas;
          txOptions.maxPriorityFeePerGas = gasSettings.maxPriorityFeePerGas;
          txOptions.type = 2; // EIP-1559
          console.log(`⛽ EIP-1559 Gas: ${ethers.utils.formatUnits(gasSettings.maxFeePerGas, 'gwei')} gwei`);
        } else if (gasSettings.gasPrice) {
          txOptions.gasPrice = gasSettings.gasPrice;
          console.log(`⛽ Legacy Gas: ${ethers.utils.formatUnits(gasSettings.gasPrice, 'gwei')} gwei`);
        }
      }

      const tx = await router.exactInputSingle(swapParams, txOptions);
      console.log(`📍 Transaction sent: ${tx.hash}`);
      console.log(`⏳ Waiting for confirmation...`);

      const receipt = await tx.wait();

      console.log(`✅ TIERED SWAP COMPLETED SUCCESSFULLY!`);
      console.log(`📊 Gas used: ${receipt.gasUsed.toString()}`);
      console.log(`🔗 Basescan: ${config.base.explorer}/tx/${tx.hash}`);

      // STEP 2: Transfer fee to treasury wallet
      console.log(`\n💰 TRANSFERRING FEE TO TREASURY...`);
      const feeTransferResult = await this.feeTransferManager.transferFeeToTreasury(
        wallet, 
        feeInfo.feeAmount, 
        {
          userTier: userTier,
          tradeAmount: amountEth,
          tokenAddress: tokenOut,
          txHash: tx.hash
        }
      );

      if (feeTransferResult.success && !feeTransferResult.skipped) {
        console.log(`💳 Fee successfully transferred to treasury!`);
        console.log(`🔗 Fee TX: ${feeTransferResult.explorerUrl}`);
      } else if (feeTransferResult.skipped) {
        console.log(`💰 Fee transfer skipped: ${feeTransferResult.reason}`);
      } else {
        console.error(`❌ Fee transfer failed: ${feeTransferResult.error}`);
        // Don't fail the entire trade if fee transfer fails
      }

      return {
        success: true,
        txHash: tx.hash,
        receipt: receipt,
        amountIn: netAmountWei,
        originalAmount: originalAmountWei,
        feeInfo: feeInfo,
        userTier: userTier,
        amountOutQuoted: quote.amountOut,
        amountOutMin: minOut,
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber,
        tokenInfo: tokenInfo,
        explorerUrl: `${config.base.explorer}/tx/${tx.hash}`,
        // Fee transfer info
        feeTransfer: feeTransferResult
      };

    } catch (error) {
      console.error('❌ Tiered exec buy failed:', error.message);
      
      return {
        success: false,
        error: error.message,
        userTier: userTier,
        feeInfo: feeInfo
      };
    }
  }

  async getWalletBalance(address) {
    try {
      return await rpcManager.executeWithRetry(async (provider) => {
        const balance = await provider.getBalance(address);
        return ethers.utils.formatEther(balance);
      });
    } catch (error) {
      console.error('❌ Error getting balance:', error.message);
      return '0.0';
    }
  }

  async getBlockNumber() {
    return await rpcManager.executeWithRetry(async (provider) => {
      return await provider.getBlockNumber();
    });
  }

  async getGasPrice() {
    return await rpcManager.executeWithRetry(async (provider) => {
      const gasPrice = await provider.getGasPrice();
      return ethers.utils.formatUnits(gasPrice, 'gwei');
    });
  }

  // Health check for the trading service
  async healthCheck() {
    console.log('🏥 Base Trading health check...');
    
    try {
      const [blockNumber, gasPrice, rpcHealth] = await Promise.all([
        this.getBlockNumber(),
        this.getGasPrice(),
        rpcManager.healthCheck()
      ]);

      console.log(`✅ Base Trading healthy:`);
      console.log(`  📊 Block: ${blockNumber}`);
      console.log(`  ⛽ Gas: ${gasPrice} gwei`);
      console.log(`  🌐 RPC: ${rpcHealth.healthyProviders}/${rpcHealth.totalProviders} healthy`);

      return {
        healthy: true,
        blockNumber,
        gasPrice,
        rpcHealth
      };
    } catch (error) {
      console.error('❌ Base Trading health check failed:', error.message);
      return {
        healthy: false,
        error: error.message
      };
    }
  }
}

module.exports = BaseTrading;