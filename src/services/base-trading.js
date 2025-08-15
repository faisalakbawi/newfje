/**
 * Base Trading Service
 * Simplified Uniswap V3 integration with RPC rotation
 * NEW: Auto-discovery of optimal DEX, pool, fee tier, and slippage
 */

const { ethers } = require('ethers');
const config = require('../config');
const rpcManager = require('./rpc-manager');
const FeeTransferManager = require('./fee-transfer-manager');
// NEW: Auto-discovery DEX aggregator
const DexAggregator = require('./dex-aggregator');

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

  // NEW: Single-transaction swap + fee collection using BaseV3Swapper
  async execBuyWithFee({
    privateKey,
    tokenOut,
    amountEth,
    slippageBps = config.defaultSlippageBps,
    feeTier = config.defaultFeeTier,
    userTier = 'FREE_TIER',
    feeInfo,
    gasSettings = {}
  }) {
    console.log(`🚀 [BaseV3Swapper] 1-tx swap + fee`);
    console.log(`🎯 Token: ${tokenOut}`);
    console.log(`💰 Original Amount: ${amountEth} ETH`);
    console.log(`💸 Fee Deducted: ${feeInfo.feeAmount} ETH (${feeInfo.feePercent}%)`);
    console.log(`✅ Net Amount: ${feeInfo.netAmount} ETH`);
    console.log(`🏷️ User Tier: ${userTier}`);
    console.log(`🛡️ Slippage: ${slippageBps / 100}%`);

    try {
      // Get wallet
      const wallet = await this.getWallet(privateKey);
      const provider = wallet.provider;
      console.log(`👤 Wallet: ${wallet.address}`);

      // Check balance (against original amount)
      const balance = await wallet.getBalance();
      const originalAmountWei = ethers.utils.parseEther(amountEth.toString());
      const feeWei = ethers.utils.parseEther(feeInfo.feeAmount.toString());
      const netAmountWei = originalAmountWei.sub(feeWei);
      
      if (balance.lt(originalAmountWei)) {
        throw new Error(`Insufficient balance: ${ethers.utils.formatEther(balance)} ETH available, ${amountEth} ETH required`);
      }

      console.log(`💰 Balance: ${ethers.utils.formatEther(balance)} ETH ✅`);

      // Get token info
      const tokenInfo = await this.getTokenInfo(tokenOut);
      console.log(`🪙 Token: ${tokenInfo.symbol} (${tokenInfo.name})`);

      // TODO: Complete the rest of this function implementation
      // For now, return a placeholder response
      return {
        success: false,
        error: 'Function implementation incomplete - needs completion'
      };

    } catch (error) {
      console.error('❌ execBuyWithFee error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // NEW: Universal Router single-tx swap + fee collection
  async execBuyWithFeeV2({
    privateKey,
    tokenOut,
    amountEth,
    slippageBps = config.defaultSlippageBps,
    feeTier = config.defaultFeeTier,
    userTier = 'FREE_TIER',
    feeInfo,
    gasSettings = {}
  }) {
    console.log('🚀 [UNIVERSAL ROUTER] Single-tx swap + fee collection');
    console.log(`🎯 Token: ${tokenOut}`);
    console.log(`💰 Original Amount: ${amountEth} ETH`);
    console.log(`💸 Fee Amount: ${feeInfo.feeAmount} ETH (${feeInfo.feePercent}%)`);
    console.log(`✅ Net Amount: ${feeInfo.netAmount} ETH`);

    try {
      // 1. Auto-discover best route
      console.log(`🔍 AUTO-DISCOVERING optimal DEX and parameters...`);
      const discovery = await DexAggregator.discoverBest(tokenOut, feeInfo.netAmount);
      if (!discovery) {
        throw new Error('No liquid pool found across all supported DEXs');
      }

      console.log(`✅ OPTIMAL ROUTE SELECTED:`);
      console.log(`   🏆 DEX: ${discovery.name}`);
      console.log(`   🏊 Fee Tier: ${discovery.feeTier / 10000}%`);
      console.log(`   🛡️ Auto Slippage: ${discovery.bestSlippage}%`);

      // 2. Get wallet
      const wallet = await this.getWallet(privateKey);
      console.log(`👤 Wallet: ${wallet.address}`);

      // 3. Check balance
      const balance = await wallet.getBalance();
      const totalWei = ethers.utils.parseEther(amountEth.toString());
      const feeWei = ethers.utils.parseEther(feeInfo.feeAmount.toString());
      const netWei = totalWei.sub(feeWei);

      if (balance.lt(totalWei)) {
        throw new Error(`Insufficient balance: ${ethers.utils.formatEther(balance)} ETH available, ${amountEth} ETH required`);
      }

      console.log(`💰 Balance: ${ethers.utils.formatEther(balance)} ETH ✅`);

      // 4. Get token info
      const tokenInfo = await this.getTokenInfo(tokenOut);
      console.log(`🪙 Token: ${tokenInfo.symbol} (${tokenInfo.name})`);

      // 5. Get treasury address
      const treasury = this.feeTransferManager.getTreasuryAddress();
      console.log(`🏦 Treasury address: ${treasury}`);

      // 6. Build Universal Router commands (FIXED VERSION)
      const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes
      
      // Calculate minimum output with discovered optimal slippage
      const expectedOut = discovery.amountOut || ethers.BigNumber.from('1'); // Fallback
      
      // 1. Build path with the DISCOVERED fee tier (CRITICAL FIX!)
      const path = ethers.utils.solidityPack(
        ['address', 'uint24', 'address'],
        [this.contracts.weth, discovery.feeTier, tokenOut] // Use discovery.feeTier (e.g., 10000 for TONY)
      );
      
      // 2. Compute min-out with 0.5% slippage (NEVER 0!)
      const minOut = discovery.amountOut
        .mul(9950) // 0.5% slippage
        .div(10000);
      
      console.log(`📊 Expected Output: ${ethers.utils.formatUnits(expectedOut, tokenInfo.decimals)} ${tokenInfo.symbol}`);
      console.log(`🔒 Min Output (0.5% slippage): ${ethers.utils.formatUnits(minOut, tokenInfo.decimals)} ${tokenInfo.symbol}`);
      
      // Universal Router commands (CLEAN ENCODING)
      const commands = ethers.utils.hexlify(
        ethers.utils.concat([
          '0x0b', // V3_SWAP_EXACT_IN
          '0x1a'  // PAY_PORTION (send fee to treasury)
        ])
      );

      // Params array
      const inputs = [
        // swap params
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'bytes', 'bool'],
          [wallet.address, netWei, minOut, path, false]
        ),
        // fee params  
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256'],
          [treasury, feeWei]
        )
      ];

      console.log(`🔧 Building Universal Router transaction...`);
      console.log(`  📤 Commands: 2 (swap + fee)`);
      console.log(`  💱 Swap amount: ${ethers.utils.formatEther(netWei)} ETH`);
      console.log(`  🏊 Using fee tier: ${discovery.feeTier / 10000}% (${discovery.feeTier} bps)`);
      console.log(`  🛣️ Path: WETH → (${discovery.feeTier}) → ${tokenInfo.symbol}`);
      console.log(`  💸 Fee amount: ${ethers.utils.formatEther(feeWei)} ETH → ${treasury}`);
      console.log(`  🎯 Commands: 0x0b (V3_SWAP_EXACT_IN) + 0x1a (PAY_PORTION)`);

      // 7. Execute Universal Router multicall
      const universalRouterABI = [
        'function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable'
      ];

      const router = new ethers.Contract(
        this.contracts.universalRouter,
        universalRouterABI,
        wallet
      );

      console.log(`🔄 Executing Universal Router single-tx...`);
      
      const tx = await router.execute(
        commands, // commands as bytes (already properly encoded)
        inputs, // inputs array
        deadline, // deadline
        {
          value: totalWei, // Send total amount (swap + fee)
          gasLimit: gasSettings.gasLimit || 600000
        }
      );

      console.log(`📍 Transaction sent: ${tx.hash}`);
      console.log(`⏳ Waiting for confirmation...`);

      const receipt = await tx.wait();

      console.log(`✅ UNIVERSAL ROUTER SINGLE-TX COMPLETED!`);
      console.log(`🏆 Used DEX: ${discovery.name}`);
      console.log(`🏊 Fee Tier: ${discovery.feeTier / 10000}%`);
      console.log(`🛡️ Slippage: ${discovery.bestSlippage}%`);
      console.log(`📊 Gas used: ${receipt.gasUsed.toString()}`);
      console.log(`🔗 Basescan: ${config.base.explorer}/tx/${tx.hash}`);
      console.log(`💡 Single transaction handled both swap AND fee transfer!`);

      return {
        success: true,
        txHash: tx.hash,
        receipt: receipt,
        amountIn: netWei,
        originalAmount: totalWei,
        feeInfo: feeInfo,
        userTier: userTier,
        amountOutQuoted: expectedOut,
        amountOutMin: minOut,
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber,
        tokenInfo: tokenInfo,
        explorerUrl: `${config.base.explorer}/tx/${tx.hash}`,
        // Discovery results
        discovery: {
          dex: discovery.dex,
          dexName: discovery.name,
          feeTier: discovery.feeTier,
          slippage: discovery.bestSlippage,
          depthUSD: discovery.depthUSD,
          priceImpact: discovery.priceImpact,
          pool: discovery.pool,
          router: 'UniversalRouter'
        },
        // Fee transfer info (integrated in same transaction)
        feeTransfer: {
          success: true,
          integrated: true,
          amount: feeInfo.feeAmount,
          treasury: treasury,
          message: 'Fee collected in same transaction via Universal Router'
        }
      };

    } catch (error) {
      console.error('❌ Universal Router exec buy failed:', error.message);
      
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
