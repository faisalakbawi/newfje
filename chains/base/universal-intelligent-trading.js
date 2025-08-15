const { ethers } = require('ethers');

/**
 * Universal Intelligent Trading System
 * 
 * This system analyzes any token and automatically:
 * 1. Finds the best trading route (DEX + fee tier)
 * 2. Calculates optimal gas limits
 * 3. Determines appropriate slippage
 * 4. Handles any amount intelligently
 * 5. Works with any ERC-20 token on Base
 * 
 * Based on analysis of successful TONY transaction and other patterns
 */

class UniversalIntelligentTrading {
  constructor(provider) {
    this.provider = provider;
    
    // Base network constants
    this.WETH = '0x4200000000000000000000000000000000000006';
    this.USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
    
    // DEX configurations with their optimal settings
    this.dexConfigs = {
      uniswapV3: {
        router: '0x2626664c2603336E57B271c5C0b26F421741e481',
        quoter: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
        factory: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
        feeTiers: [100, 500, 3000, 10000], // 0.01%, 0.05%, 0.3%, 1%
        gasMultiplier: 1.2,
        name: 'Uniswap V3'
      },
      aerodrome: {
        router: '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43',
        factory: '0x420DD381b31aEf6683db96b3aaC7C7aA9DFb1b8',
        gasMultiplier: 1.15,
        name: 'Aerodrome'
      },
      sushiswap: {
        router: '0x6BDED42c6DA8FBf0d2bA55B2fa120C5e0c8D7891',
        factory: '0x71524B4f93c58fcbF659783284E38825f0622859',
        gasMultiplier: 1.1,
        name: 'SushiSwap'
      }
    };
    
    // Special token configurations (like TONY)
    this.specialTokens = {
      '0x36a947baa2492c72bf9d3307117237e79145a87d': { // TONY
        name: 'TONY',
        preferredDex: 'uniswapV3',
        preferredFeeTier: 10000, // 1%
        customContract: '0xe111b0C3605aDc45CFb0CD75E5543F63CC3ec425',
        hasCustomLogic: true,
        minGasLimit: 200000,
        maxSlippage: 30
      }
    };
    
    // ABIs
    this.erc20ABI = [
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function decimals() view returns (uint8)',
      'function balanceOf(address) view returns (uint256)',
      'function totalSupply() view returns (uint256)'
    ];
    
    this.quoterABI = [
      'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)'
    ];
    
    this.routerABI = [
      'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)'
    ];
  }

  /**
   * Analyze token and find optimal trading strategy
   */
  async analyzeToken(tokenAddress, amountETH) {
    console.log(`🔍 ========== ANALYZING TOKEN ==========`);
    console.log(`🪙 Token: ${tokenAddress}`);
    console.log(`💰 Amount: ${amountETH} ETH`);
    
    try {
      // Get token info
      const tokenInfo = await this.getTokenInfo(tokenAddress);
      console.log(`📊 Token: ${tokenInfo.name} (${tokenInfo.symbol}) - ${tokenInfo.decimals} decimals`);
      
      // Check if it's a special token
      const specialConfig = this.specialTokens[tokenAddress.toLowerCase()];
      if (specialConfig) {
        console.log(`⭐ Special token detected: ${specialConfig.name}`);
        return await this.analyzeSpecialToken(tokenAddress, amountETH, specialConfig, tokenInfo);
      }
      
      // Regular token analysis
      return await this.analyzeRegularToken(tokenAddress, amountETH, tokenInfo);
      
    } catch (error) {
      console.error(`❌ Token analysis failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Get comprehensive token information
   */
  async getTokenInfo(tokenAddress) {
    const contract = new ethers.Contract(tokenAddress, this.erc20ABI, this.provider);
    
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      contract.name().catch(() => 'Unknown'),
      contract.symbol().catch(() => 'UNK'),
      contract.decimals().catch(() => 18),
      contract.totalSupply().catch(() => ethers.BigNumber.from(0))
    ]);
    
    return { name, symbol, decimals, totalSupply, address: tokenAddress };
  }

  /**
   * Analyze special tokens (like TONY) with custom logic
   */
  async analyzeSpecialToken(tokenAddress, amountETH, specialConfig, tokenInfo) {
    console.log(`🎯 Analyzing special token: ${specialConfig.name}`);
    
    // For TONY and similar tokens, we know they work best with specific settings
    const analysis = {
      token: tokenInfo,
      specialConfig: specialConfig,
      recommendedStrategy: {
        method: 'custom_contract',
        dex: specialConfig.preferredDex,
        feeTier: specialConfig.preferredFeeTier,
        customContract: specialConfig.customContract,
        gasLimit: Math.max(specialConfig.minGasLimit, this.calculateGasLimit(amountETH, 'special')),
        slippage: Math.min(specialConfig.maxSlippage, this.calculateOptimalSlippage(amountETH)),
        priority: 'high'
      },
      fallbackStrategies: [
        {
          method: 'direct_uniswap_v3',
          dex: 'uniswapV3',
          feeTier: specialConfig.preferredFeeTier,
          gasLimit: this.calculateGasLimit(amountETH, 'uniswapV3'),
          slippage: this.calculateOptimalSlippage(amountETH) + 5, // Higher slippage for fallback
          priority: 'medium'
        },
        {
          method: 'multi_dex_scan',
          gasLimit: this.calculateGasLimit(amountETH, 'multi'),
          slippage: this.calculateOptimalSlippage(amountETH) + 10,
          priority: 'low'
        }
      ]
    };
    
    console.log(`✅ Special token analysis complete`);
    return analysis;
  }

  /**
   * Analyze regular tokens by scanning all DEXs
   */
  async analyzeRegularToken(tokenAddress, amountETH, tokenInfo) {
    console.log(`🔄 Analyzing regular token: ${tokenInfo.symbol}`);
    
    const amountWei = ethers.utils.parseEther(amountETH.toString());
    const strategies = [];
    
    // Test Uniswap V3 with all fee tiers
    for (const feeTier of this.dexConfigs.uniswapV3.feeTiers) {
      try {
        const quote = await this.getUniswapV3Quote(tokenAddress, amountWei, feeTier);
        if (quote && quote.gt(0)) {
          strategies.push({
            method: 'uniswap_v3',
            dex: 'uniswapV3',
            feeTier: feeTier,
            expectedOutput: quote,
            gasLimit: this.calculateGasLimit(amountETH, 'uniswapV3'),
            slippage: this.calculateOptimalSlippage(amountETH),
            priority: this.calculatePriority(quote, feeTier),
            confidence: 'high'
          });
        }
      } catch (error) {
        console.log(`⚠️ Fee tier ${feeTier} failed: ${error.message}`);
      }
    }
    
    // Test other DEXs (Aerodrome, SushiSwap, etc.)
    // This would be expanded with actual implementations
    
    // Sort strategies by priority and expected output
    strategies.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return b.expectedOutput.sub(a.expectedOutput).gt(0) ? 1 : -1;
    });
    
    const analysis = {
      token: tokenInfo,
      recommendedStrategy: strategies[0] || null,
      fallbackStrategies: strategies.slice(1, 3),
      totalStrategiesFound: strategies.length
    };
    
    console.log(`✅ Regular token analysis complete - ${strategies.length} strategies found`);
    return analysis;
  }

  /**
   * Get Uniswap V3 quote for specific fee tier
   */
  async getUniswapV3Quote(tokenAddress, amountWei, feeTier) {
    try {
      const quoterContract = new ethers.Contract(
        this.dexConfigs.uniswapV3.quoter,
        this.quoterABI,
        this.provider
      );
      
      const quote = await quoterContract.callStatic.quoteExactInputSingle(
        this.WETH,
        tokenAddress,
        feeTier,
        amountWei,
        0
      );
      
      console.log(`📊 Fee tier ${feeTier}: ${ethers.utils.formatEther(quote)} tokens`);
      return quote;
    } catch (error) {
      return null;
    }
  }

  /**
   * Calculate optimal gas limit based on amount and method
   */
  calculateGasLimit(amountETH, method) {
    const baseGas = {
      'special': 200000,
      'uniswapV3': 150000,
      'aerodrome': 120000,
      'sushiswap': 100000,
      'multi': 300000
    };
    
    // Increase gas for larger amounts
    const amountMultiplier = amountETH > 1 ? 1.5 : amountETH > 0.1 ? 1.2 : 1.0;
    
    return Math.floor(baseGas[method] * amountMultiplier);
  }

  /**
   * Calculate optimal slippage based on amount and market conditions
   */
  calculateOptimalSlippage(amountETH) {
    // Smaller amounts can use lower slippage
    if (amountETH <= 0.01) return 5;   // 5% for micro trades
    if (amountETH <= 0.1) return 10;   // 10% for small trades  
    if (amountETH <= 1) return 15;     // 15% for medium trades
    return 25;                         // 25% for large trades
  }

  /**
   * Calculate strategy priority
   */
  calculatePriority(expectedOutput, feeTier) {
    // Higher output = higher priority
    // Lower fee tier = higher priority (less fees)
    const outputScore = expectedOutput.div(ethers.utils.parseEther('1000')).toNumber();
    const feeScore = (10000 - feeTier) / 100;
    
    return outputScore + feeScore;
  }

  /**
   * Execute trade using the analyzed strategy
   */
  async executeTrade(analysis, wallet, amountETH, userSlippage = null) {
    if (!analysis || !analysis.recommendedStrategy) {
      throw new Error('No valid trading strategy found');
    }
    
    const strategy = analysis.recommendedStrategy;
    const slippage = userSlippage || strategy.slippage;
    
    console.log(`🚀 ========== EXECUTING TRADE ==========`);
    console.log(`📊 Strategy: ${strategy.method}`);
    console.log(`🏪 DEX: ${strategy.dex}`);
    console.log(`💰 Amount: ${amountETH} ETH`);
    console.log(`🛡️ Slippage: ${slippage}%`);
    console.log(`⛽ Gas Limit: ${strategy.gasLimit}`);
    
    try {
      switch (strategy.method) {
        case 'custom_contract':
          return await this.executeCustomContract(analysis, wallet, amountETH, slippage);
        
        case 'uniswap_v3':
        case 'direct_uniswap_v3':
          return await this.executeUniswapV3(analysis, wallet, amountETH, slippage, strategy);
        
        case 'multi_dex_scan':
          return await this.executeMultiDex(analysis, wallet, amountETH, slippage);
        
        default:
          throw new Error(`Unknown strategy method: ${strategy.method}`);
      }
    } catch (error) {
      console.log(`❌ Primary strategy failed: ${error.message}`);
      
      // Try fallback strategies
      for (const fallback of analysis.fallbackStrategies || []) {
        try {
          console.log(`🔄 Trying fallback: ${fallback.method}`);
          return await this.executeTrade({
            ...analysis,
            recommendedStrategy: fallback
          }, wallet, amountETH, slippage + 5);
        } catch (fallbackError) {
          console.log(`❌ Fallback failed: ${fallbackError.message}`);
        }
      }
      
      throw new Error('All trading strategies failed');
    }
  }

  /**
   * Execute trade using custom contract (for special tokens like TONY)
   */
  async executeCustomContract(analysis, wallet, amountETH, slippage) {
    const { specialConfig, token } = analysis;
    
    console.log(`🎯 Executing custom contract trade for ${specialConfig.name}`);
    
    // This would implement the custom contract logic
    // For now, fall back to direct Uniswap V3
    return await this.executeUniswapV3(analysis, wallet, amountETH, slippage, {
      method: 'direct_uniswap_v3',
      dex: 'uniswapV3',
      feeTier: specialConfig.preferredFeeTier,
      gasLimit: specialConfig.minGasLimit
    });
  }

  /**
   * Execute trade using Uniswap V3
   */
  async executeUniswapV3(analysis, wallet, amountETH, slippage, strategy) {
    const { token } = analysis;
    const amountWei = ethers.utils.parseEther(amountETH.toString());
    
    console.log(`🦄 Executing Uniswap V3 trade`);
    console.log(`🏊 Fee tier: ${strategy.feeTier} (${strategy.feeTier / 10000}%)`);
    
    // Get fresh quote
    const expectedOutput = await this.getUniswapV3Quote(token.address, amountWei, strategy.feeTier);
    if (!expectedOutput || expectedOutput.eq(0)) {
      throw new Error('No liquidity available for this token');
    }
    
    // Calculate minimum output with slippage
    const minOutput = expectedOutput.mul(10000 - (slippage * 100)).div(10000);
    
    console.log(`📈 Expected output: ${ethers.utils.formatUnits(expectedOutput, token.decimals)} ${token.symbol}`);
    console.log(`🛡️ Min output: ${ethers.utils.formatUnits(minOutput, token.decimals)} ${token.symbol}`);
    
    // Prepare swap parameters
    const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes
    const swapParams = {
      tokenIn: this.WETH,
      tokenOut: token.address,
      fee: strategy.feeTier,
      recipient: wallet.address,
      deadline: deadline,
      amountIn: amountWei,
      amountOutMinimum: minOutput,
      sqrtPriceLimitX96: 0
    };
    
    // Execute swap
    const routerContract = new ethers.Contract(
      this.dexConfigs.uniswapV3.router,
      this.routerABI,
      wallet
    );
    
    const gasLimit = ethers.BigNumber.from(strategy.gasLimit);
    
    const tx = await routerContract.exactInputSingle(swapParams, {
      value: amountWei,
      gasLimit: gasLimit
    });
    
    console.log(`📍 Transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    
    return {
      success: true,
      txHash: tx.hash,
      gasUsed: receipt.gasUsed.toString(),
      method: `Intelligent ${strategy.dex} (${strategy.feeTier / 10000}% fee)`,
      expectedOutput: ethers.utils.formatUnits(expectedOutput, token.decimals),
      minOutput: ethers.utils.formatUnits(minOutput, token.decimals),
      explorerUrl: `https://basescan.org/tx/${tx.hash}`,
      strategy: strategy
    };
  }

  /**
   * Execute multi-DEX scanning (fallback method)
   */
  async executeMultiDex(analysis, wallet, amountETH, slippage) {
    console.log(`🌐 Executing multi-DEX scan`);
    
    // This would implement the multi-DEX logic
    // For now, throw error to indicate it needs implementation
    throw new Error('Multi-DEX execution not yet implemented');
  }
}

module.exports = UniversalIntelligentTrading;