/**
 * DEX AGGREGATOR SERVICE
 * Auto-discovers the optimal DEX, pool, fee tier, and slippage
 * Supports: Uniswap V3, Aerodrome, SushiSwap, BaseSwap, PancakeSwap
 */

const { ethers } = require('ethers');
const config = require('../config');
const rpcManager = require('./rpc-manager');

// DEX configuration map for Base network
const dexMap = {
  uniswapV3: {
    name: 'Uniswap V3',
    factory: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
    quoter: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
    router: '0x2626664c2603336E57B271c5C0b26F421741e481',
    fees: [500, 3000, 10000],
    type: 'v3'
  },
  aerodrome: {
    name: 'Aerodrome',
    factory: '0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A',
    quoter: '0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A',
    router: '0xcF77a3Ba9A5Ca399B7C97c74d54e6b744631f8cA',
    fees: [100, 500, 2500, 10000],
    type: 'v3'
  },
  sushiswap: {
    name: 'SushiSwap V3',
    factory: '0x7169d38820dfd117C3FA1f22a7d5A3D26Ee16AD3',
    quoter: '0x64b5b0e5B77FbD1e7f1c6b3EA0B9f0B3Bc4B5d5C',
    router: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b4799756',
    fees: [500, 3000, 10000],
    type: 'v3'
  },
  baseswap: {
    name: 'BaseSwap',
    factory: '0xFDa619b6d2095bE1B8a32124C59c6a7bF5b7E6D5',
    quoter: '0xFDa619b6d2095bE1B8a32124C59c6a7bF5b7E6D5',
    router: '0x327Df1E6de05895d2ab08513aaDD9313Fe505d86',
    fees: [500, 3000, 10000],
    type: 'v3'
  },
  pancakeswap: {
    name: 'PancakeSwap V3',
    factory: '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865',
    quoter: '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997',
    router: '0x1b81D678ffb9C0263b24A97847620C99d213eB14',
    fees: [100, 500, 2500, 10000],
    type: 'v3'
  }
};

class DexAggregator {
  constructor() {
    this.dexMap = dexMap;
    console.log('🔍 DEX Aggregator initialized with', Object.keys(dexMap).length, 'DEXs');
  }

  /**
   * Discover the best DEX, pool, fee tier, and slippage for a token trade
   * @param {string} tokenOut - Token contract address to buy
   * @param {number} amountEth - Amount of ETH to trade (net amount after fees)
   * @returns {Object} Best trading parameters or null if no pools found
   */
  async discoverBest(tokenOut, amountEth) {
    console.log(`🔍 AUTO-DISCOVERING optimal parameters for ${amountEth} ETH → ${tokenOut.slice(0, 10)}...`);
    
    try {
      const provider = await rpcManager.getHealthyProvider();
      const amountWei = ethers.utils.parseEther(amountEth.toString());
      const wethAddress = config.base.contracts.weth;

      let best = null;
      const results = [];

      // Check all DEXs and fee tiers in parallel for speed
      const promises = [];
      
      for (const [dexName, dexConfig] of Object.entries(this.dexMap)) {
        for (const feeTier of dexConfig.fees) {
          promises.push(
            this.analyzePool(dexName, dexConfig, wethAddress, tokenOut, feeTier, amountWei, provider)
              .catch(error => {
                console.log(`⚠️ ${dexName} fee ${feeTier}: ${error.message}`);
                return null;
              })
          );
        }
      }

      // Wait for all analyses to complete
      const allResults = await Promise.all(promises);
      
      // Filter out failed attempts and collect valid results
      for (const result of allResults) {
        if (result) {
          results.push(result);
          
          // Update best if this has higher liquidity depth
          if (!best || result.depthUSD > best.depthUSD) {
            best = result;
          }
        }
      }

      if (best) {
        console.log(`✅ OPTIMAL ROUTE DISCOVERED:`);
        console.log(`   🏆 DEX: ${best.name}`);
        console.log(`   🏊 Fee Tier: ${best.feeTier / 10000}%`);
        console.log(`   💧 Liquidity: $${best.depthUSD.toLocaleString()}`);
        console.log(`   🛡️ Auto Slippage: ${best.bestSlippage}%`);
        console.log(`   📈 Expected Output: ${ethers.utils.formatEther(best.amountOut)} tokens`);
        console.log(`   📍 Pool: ${best.pool}`);
        
        return best;
      } else {
        console.log(`❌ No liquid pools found across ${Object.keys(this.dexMap).length} DEXs`);
        
        // Log what was attempted for debugging
        console.log(`🔍 Attempted combinations:`);
        Object.entries(this.dexMap).forEach(([name, config]) => {
          console.log(`   • ${name}: ${config.fees.join(', ')} bps fee tiers`);
        });
        
        return null;
      }

    } catch (error) {
      console.error('❌ Error in DEX discovery:', error.message);
      return null;
    }
  }

  /**
   * Analyze a specific pool on a DEX
   */
  async analyzePool(dexName, dexConfig, tokenA, tokenB, feeTier, amountWei, provider) {
    // 1. Check if pool exists
    const poolAddress = await this.getPoolAddress(dexConfig.factory, tokenA, tokenB, feeTier, provider);
    
    if (!poolAddress || poolAddress === ethers.constants.AddressZero) {
      throw new Error(`No pool found`);
    }

    // 2. Get pool liquidity depth
    const depthUSD = await this.getPoolDepth(poolAddress, provider);
    
    if (depthUSD < 1000) { // Minimum $1k liquidity
      throw new Error(`Low liquidity: $${depthUSD.toFixed(0)}`);
    }

    // 3. Get quote for the trade
    const quote = await this.getQuote(dexConfig.quoter, tokenA, tokenB, feeTier, amountWei, provider);
    
    if (!quote.amountOut || quote.amountOut.eq(0)) {
      throw new Error(`Zero output quote`);
    }

    // 4. Calculate optimal slippage based on trade size vs liquidity
    const bestSlippage = this.calculateOptimalSlippage(depthUSD, parseFloat(ethers.utils.formatEther(amountWei)));

    return {
      dex: dexName,
      name: dexConfig.name,
      router: dexConfig.router,
      pool: poolAddress,
      feeTier: feeTier,
      depthUSD: depthUSD,
      amountOut: quote.amountOut,
      gasEstimate: quote.gasEstimate || ethers.BigNumber.from('300000'),
      bestSlippage: bestSlippage,
      priceImpact: this.calculatePriceImpact(depthUSD, parseFloat(ethers.utils.formatEther(amountWei)))
    };
  }

  /**
   * Get pool address from factory
   */
  async getPoolAddress(factory, tokenA, tokenB, feeTier, provider) {
    try {
      const factoryContract = new ethers.Contract(factory, [
        'function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)'
      ], provider);
      
      return await factoryContract.getPool(tokenA, tokenB, feeTier);
    } catch (error) {
      throw new Error(`Factory call failed: ${error.message}`);
    }
  }

  /**
   * Get pool liquidity depth in USD (approximation)
   */
  async getPoolDepth(poolAddress, provider) {
    try {
      // Try to get liquidity from Uniswap V3 pool interface
      const poolContract = new ethers.Contract(poolAddress, [
        'function liquidity() external view returns (uint128)',
        'function token0() external view returns (address)',
        'function token1() external view returns (address)',
        'function fee() external view returns (uint24)'
      ], provider);
      
      const liquidity = await poolContract.liquidity();
      
      // Convert liquidity to approximate USD value
      // This is a rough approximation - in production you'd use price oracles
      const liquidityFloat = parseFloat(ethers.utils.formatUnits(liquidity, 18));
      const approximateUSD = liquidityFloat * 2000; // Rough ETH price approximation
      
      return Math.max(approximateUSD, 0);
    } catch (error) {
      // Fallback: try to get token balances
      try {
        const tokenContract = new ethers.Contract(poolAddress, [
          'function balanceOf(address) external view returns (uint256)'
        ], provider);
        
        const balance = await provider.getBalance(poolAddress);
        const balanceEth = parseFloat(ethers.utils.formatEther(balance));
        return balanceEth * 2000; // Rough conversion to USD
      } catch {
        return 0;
      }
    }
  }

  /**
   * Get quote from DEX quoter
   */
  async getQuote(quoter, tokenIn, tokenOut, feeTier, amountIn, provider) {
    try {
      const quoterContract = new ethers.Contract(quoter, [
        'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)'
      ], provider);
      
      const result = await quoterContract.callStatic.quoteExactInputSingle(
        tokenIn,
        tokenOut,
        feeTier,
        amountIn,
        0 // No price limit
      );
      
      return {
        amountOut: result.amountOut || result[0],
        sqrtPriceX96After: result.sqrtPriceX96After || result[1],
        initializedTicksCrossed: result.initializedTicksCrossed || result[2],
        gasEstimate: result.gasEstimate || result[3]
      };
    } catch (error) {
      throw new Error(`Quote failed: ${error.message}`);
    }
  }

  /**
   * Calculate optimal slippage based on liquidity depth and trade size
   */
  calculateOptimalSlippage(depthUSD, amountEth) {
    const tradeValueUSD = amountEth * 2000; // Rough ETH price
    const impactRatio = tradeValueUSD / depthUSD;
    
    // Dynamic slippage based on trade impact
    if (impactRatio < 0.001) return 0.5;   // Very small trade: 0.5%
    if (impactRatio < 0.005) return 1.0;   // Small trade: 1.0%
    if (impactRatio < 0.01) return 2.0;    // Medium trade: 2.0%
    if (impactRatio < 0.05) return 5.0;    // Large trade: 5.0%
    if (impactRatio < 0.1) return 10.0;    // Very large trade: 10.0%
    return 15.0;                           // Massive trade: 15.0%
  }

  /**
   * Calculate price impact percentage
   */
  calculatePriceImpact(depthUSD, amountEth) {
    const tradeValueUSD = amountEth * 2000;
    const impact = (tradeValueUSD / depthUSD) * 100;
    return Math.min(impact, 50); // Cap at 50%
  }

  /**
   * Get all supported DEXs
   */
  getSupportedDEXs() {
    return Object.keys(this.dexMap);
  }

  /**
   * Health check - verify DEX contracts are accessible
   */
  async healthCheck() {
    console.log('🏥 DEX Aggregator health check...');
    
    try {
      const provider = await rpcManager.getHealthyProvider();
      const results = {};
      
      for (const [dexName, config] of Object.entries(this.dexMap)) {
        try {
          // Try to call a simple view function
          const factoryContract = new ethers.Contract(config.factory, [
            'function owner() external view returns (address)'
          ], provider);
          
          await factoryContract.owner();
          results[dexName] = { healthy: true };
        } catch (error) {
          results[dexName] = { 
            healthy: false, 
            error: error.message.substring(0, 100)
          };
        }
      }
      
      const healthyCount = Object.values(results).filter(r => r.healthy).length;
      const totalCount = Object.keys(results).length;
      
      console.log(`✅ DEX Health: ${healthyCount}/${totalCount} DEXs accessible`);
      Object.entries(results).forEach(([name, result]) => {
        console.log(`   ${result.healthy ? '✅' : '❌'} ${name}: ${result.healthy ? 'OK' : result.error}`);
      });
      
      return {
        healthy: healthyCount > 0,
        results,
        summary: `${healthyCount}/${totalCount} DEXs healthy`
      };
    } catch (error) {
      console.error('❌ DEX health check failed:', error.message);
      return {
        healthy: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
module.exports = new DexAggregator();
