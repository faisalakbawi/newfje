/**
 * PROFESSIONAL LOOTER SYSTEM
 * Replicates the EXACT technique used by professional Looter bots
 * Key insight: They PRE-CALCULATE exact outputs and find specific pools
 */

const { ethers } = require('ethers');

class ProfessionalLooterSystem {
  constructor(provider) {
    this.provider = provider;
    
    // Professional Looter bot addresses
    this.UNISWAP_V3_ROUTER = '0x2626664c2603336E57B271c5C0b26F421741e481';
    this.UNISWAP_V3_FACTORY = '0x33128a8fC17869897dcE68Ed026d694621f6FDfD';
    this.WETH = '0x4200000000000000000000000000000000000006';
    
    // Known successful pool from transaction
    this.KNOWN_TONY_POOL = '0x89649AF832915FF8F24100a58b6A6FBc498de911';
    
    this.FACTORY_ABI = [
      'function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)'
    ];
    
    this.POOL_ABI = [
      'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
      'function liquidity() external view returns (uint128)',
      'function token0() external view returns (address)',
      'function token1() external view returns (address)',
      'function fee() external view returns (uint24)'
    ];
    
    this.ROUTER_ABI = [
      'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
      'function exactInput((bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum)) external payable returns (uint256 amountOut)'
    ];
    
    this.ERC20_ABI = [
      'function balanceOf(address account) external view returns (uint256)',
      'function decimals() external view returns (uint8)',
      'function name() external view returns (string)',
      'function symbol() external view returns (string)'
    ];
  }
  
  /**
   * PROFESSIONAL EXEC BUY - EXACT REPLICA
   */
  async execBuy(walletPrivateKey, tokenAddress, amountETH) {
    console.log(`🤖 ========== PROFESSIONAL LOOTER SYSTEM ==========`);
    console.log(`🎯 Token: ${tokenAddress}`);
    console.log(`💰 Amount: ${amountETH} ETH`);
    console.log(`🔍 Using professional pool discovery and pre-calculation`);
    
    const wallet = new ethers.Wallet(walletPrivateKey, this.provider);
    console.log(`👤 Wallet: ${wallet.address}`);
    
    // Get token info
    const token = new ethers.Contract(tokenAddress, this.ERC20_ABI, wallet);
    let tokenInfo;
    try {
      const [name, symbol, decimals] = await Promise.all([
        token.name().catch(() => 'Unknown'),
        token.symbol().catch(() => 'UNK'),
        token.decimals().catch(() => 18)
      ]);
      tokenInfo = { name, symbol, decimals };
      console.log(`📋 Token: ${name} (${symbol}) - ${decimals} decimals`);
    } catch (error) {
      return {
        success: false,
        error: 'Invalid token contract',
        method: 'token-validation-failed'
      };
    }
    
    // Get initial token balance
    const balanceBefore = await token.balanceOf(wallet.address);
    console.log(`📊 ${tokenInfo.symbol} balance before: ${ethers.utils.formatUnits(balanceBefore, tokenInfo.decimals)}`);
    
    try {
      // Step 1: Find all possible pools for this token
      console.log(`\n🔍 STEP 1: Professional Pool Discovery`);
      const pools = await this.findAllPools(tokenAddress);
      console.log(`📊 Found ${pools.length} potential pools`);
      
      if (pools.length === 0) {
        return {
          success: false,
          error: `No Uniswap V3 pools found for ${tokenInfo.symbol}`,
          method: 'no-pools-found'
        };
      }
      
      // Step 2: Calculate exact outputs for each pool (like professional bots)
      console.log(`\n🧮 STEP 2: Pre-calculating Exact Outputs`);
      const calculations = await this.calculateExactOutputs(pools, amountETH);
      
      if (calculations.length === 0) {
        return {
          success: false,
          error: `No pools with liquidity found for ${tokenInfo.symbol}`,
          method: 'no-liquid-pools-found'
        };
      }
      
      // Step 3: Find the best pool (highest output)
      const bestPool = calculations.reduce((best, current) => 
        current.expectedOutput.gt(best.expectedOutput) ? current : best
      );
      
      console.log(`🏆 Best pool found:`);
      console.log(`  📍 Pool: ${bestPool.pool}`);
      console.log(`  💰 Fee: ${bestPool.fee / 10000}%`);
      console.log(`  🪙 Expected output: ${ethers.utils.formatUnits(bestPool.expectedOutput, tokenInfo.decimals)} ${tokenInfo.symbol}`);
      console.log(`  💧 Liquidity: ${bestPool.liquidity.toString()}`);
      
      // Step 4: Execute the swap with pre-calculated values
      console.log(`\n🚀 STEP 3: Executing Professional Swap`);
      const result = await this.executeProfessionalSwap(
        wallet, 
        tokenAddress, 
        amountETH, 
        bestPool,
        tokenInfo
      );
      
      if (result.success) {
        // Verify tokens received
        const balanceAfter = await token.balanceOf(wallet.address);
        const tokensReceived = balanceAfter.sub(balanceBefore);
        
        if (tokensReceived.gt(0)) {
          console.log(`🎉 PROFESSIONAL EXEC BUY SUCCESS!`);
          console.log(`📊 ${tokenInfo.symbol} received: ${ethers.utils.formatUnits(tokensReceived, tokenInfo.decimals)}`);
          console.log(`🎯 Expected: ${ethers.utils.formatUnits(bestPool.expectedOutput, tokenInfo.decimals)}`);
          console.log(`📈 Accuracy: ${(tokensReceived.mul(100).div(bestPool.expectedOutput)).toString()}%`);
          
          return {
            success: true,
            txHash: result.txHash,
            gasUsed: result.gasUsed,
            tokensReceived: ethers.utils.formatUnits(tokensReceived, tokenInfo.decimals),
            expectedTokens: ethers.utils.formatUnits(bestPool.expectedOutput, tokenInfo.decimals),
            method: 'professional-exec-buy',
            blockNumber: result.blockNumber,
            pool: bestPool.pool,
            fee: bestPool.fee,
            tokenInfo: tokenInfo
          };
        }
      }
      
      return {
        success: false,
        error: result.error || 'Professional swap failed',
        method: 'professional-swap-failed'
      };
      
    } catch (error) {
      console.error(`❌ Professional exec buy failed:`, error.message);
      return {
        success: false,
        error: error.message,
        method: 'professional-error'
      };
    }
  }
  
  /**
   * FIND ALL POOLS - PROFESSIONAL DISCOVERY
   */
  async findAllPools(tokenAddress) {
    console.log(`  🔍 Discovering all Uniswap V3 pools for token...`);
    
    const factory = new ethers.Contract(this.UNISWAP_V3_FACTORY, this.FACTORY_ABI, this.provider);
    const pools = [];
    
    // Check all common fee tiers
    const feeTiers = [100, 500, 3000, 10000]; // 0.01%, 0.05%, 0.3%, 1%
    
    for (const fee of feeTiers) {
      try {
        const poolAddress = await factory.getPool(this.WETH, tokenAddress, fee);
        
        if (poolAddress !== ethers.constants.AddressZero) {
          console.log(`    ✅ Found pool: ${poolAddress} (${fee / 10000}% fee)`);
          pools.push({
            address: poolAddress,
            fee: fee,
            token0: this.WETH,
            token1: tokenAddress
          });
        }
      } catch (error) {
        console.log(`    ❌ Fee tier ${fee / 10000}% failed:`, error.message);
      }
    }
    
    // Also check reverse order (token/WETH instead of WETH/token)
    for (const fee of feeTiers) {
      try {
        const poolAddress = await factory.getPool(tokenAddress, this.WETH, fee);
        
        if (poolAddress !== ethers.constants.AddressZero) {
          // Check if we already have this pool
          const exists = pools.find(p => p.address.toLowerCase() === poolAddress.toLowerCase());
          if (!exists) {
            console.log(`    ✅ Found reverse pool: ${poolAddress} (${fee / 10000}% fee)`);
            pools.push({
              address: poolAddress,
              fee: fee,
              token0: tokenAddress,
              token1: this.WETH
            });
          }
        }
      } catch (error) {
        // Ignore reverse order failures
      }
    }
    
    return pools;
  }
  
  /**
   * CALCULATE EXACT OUTPUTS - PROFESSIONAL PRE-CALCULATION
   */
  async calculateExactOutputs(pools, amountETH) {
    console.log(`  🧮 Pre-calculating outputs for ${pools.length} pools...`);
    
    const calculations = [];
    const amountIn = ethers.utils.parseEther(amountETH.toString());
    
    for (const poolInfo of pools) {
      try {
        const pool = new ethers.Contract(poolInfo.address, this.POOL_ABI, this.provider);
        
        // Get pool state
        const [slot0, liquidity, token0, token1] = await Promise.all([
          pool.slot0(),
          pool.liquidity(),
          pool.token0(),
          pool.token1()
        ]);
        
        console.log(`    📊 Pool ${poolInfo.address}:`);
        console.log(`      💧 Liquidity: ${liquidity.toString()}`);
        console.log(`      📈 Current tick: ${slot0.tick}`);
        console.log(`      🔄 Token0: ${token0}, Token1: ${token1}`);
        
        // Skip pools with no liquidity
        if (liquidity.eq(0)) {
          console.log(`      ❌ No liquidity`);
          continue;
        }
        
        // Calculate expected output using the sqrt price
        // This is a simplified calculation - professional bots use more complex math
        const sqrtPriceX96 = slot0.sqrtPriceX96;
        const price = sqrtPriceX96.mul(sqrtPriceX96).div(ethers.BigNumber.from(2).pow(192));
        
        let expectedOutput;
        if (token0.toLowerCase() === this.WETH.toLowerCase()) {
          // WETH is token0, so we're buying token1
          expectedOutput = amountIn.mul(price).div(ethers.utils.parseEther('1'));
        } else {
          // WETH is token1, so we're buying token0
          expectedOutput = amountIn.div(price).mul(ethers.utils.parseEther('1'));
        }
        
        console.log(`      🎯 Expected output: ${expectedOutput.toString()}`);
        
        calculations.push({
          pool: poolInfo.address,
          fee: poolInfo.fee,
          token0: token0,
          token1: token1,
          liquidity: liquidity,
          sqrtPriceX96: sqrtPriceX96,
          tick: slot0.tick,
          expectedOutput: expectedOutput,
          poolInfo: poolInfo
        });
        
      } catch (error) {
        console.log(`    ❌ Pool ${poolInfo.address} calculation failed:`, error.message);
      }
    }
    
    return calculations.filter(calc => calc.expectedOutput.gt(0));
  }
  
  /**
   * EXECUTE PROFESSIONAL SWAP - WITH PRE-CALCULATED VALUES
   */
  async executeProfessionalSwap(wallet, tokenAddress, amountETH, bestPool, tokenInfo) {
    try {
      console.log(`  🚀 Executing swap on pool: ${bestPool.pool}`);
      
      const router = new ethers.Contract(this.UNISWAP_V3_ROUTER, this.ROUTER_ABI, wallet);
      
      // Determine token order
      const isWETHToken0 = bestPool.token0.toLowerCase() === this.WETH.toLowerCase();
      
      const params = {
        tokenIn: this.WETH,
        tokenOut: tokenAddress,
        fee: bestPool.fee,
        recipient: wallet.address,
        deadline: Math.floor(Date.now() / 1000) + 300,
        amountIn: ethers.utils.parseEther(amountETH.toString()),
        amountOutMinimum: bestPool.expectedOutput.mul(95).div(100), // 5% slippage
        sqrtPriceLimitX96: 0
      };
      
      console.log(`  📊 Swap parameters:`);
      console.log(`    💰 Amount in: ${amountETH} ETH`);
      console.log(`    🎯 Min amount out: ${ethers.utils.formatUnits(params.amountOutMinimum, tokenInfo.decimals)} ${tokenInfo.symbol}`);
      console.log(`    💸 Fee: ${bestPool.fee / 10000}%`);
      
      // Get gas estimate
      const gasEstimate = await router.estimateGas.exactInputSingle(params, {
        value: ethers.utils.parseEther(amountETH.toString())
      });
      
      console.log(`  ⛽ Gas estimate: ${gasEstimate.toString()}`);
      
      // Execute the swap
      const tx = await router.exactInputSingle(params, {
        value: ethers.utils.parseEther(amountETH.toString()),
        gasLimit: gasEstimate.mul(120).div(100), // 20% buffer
        gasPrice: await this.provider.getGasPrice()
      });
      
      console.log(`  📝 Professional transaction: ${tx.hash}`);
      console.log(`  ⏳ Waiting for confirmation...`);
      
      const receipt = await tx.wait();
      console.log(`  ✅ Professional swap confirmed in block ${receipt.blockNumber}`);
      console.log(`  ⛽ Gas used: ${receipt.gasUsed.toString()}`);
      
      return {
        success: true,
        txHash: tx.hash,
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber
      };
      
    } catch (error) {
      console.log(`  ❌ Professional swap execution failed:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ProfessionalLooterSystem;