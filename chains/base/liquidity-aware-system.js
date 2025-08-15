/**
 * LIQUIDITY-AWARE TRADING SYSTEM
 * Checks pool liquidity before executing trades
 * Only trades when both tokens are available in the pool
 */

const { ethers } = require('ethers');

class LiquidityAwareSystem {
  constructor(provider) {
    this.provider = provider;
    
    // Addresses
    this.UNISWAP_V3_ROUTER = '0x2626664c2603336E57B271c5C0b26F421741e481';
    this.WETH = '0x4200000000000000000000000000000000000006';
    this.TONY_TOKEN = '0x36a947baa2492c72bf9d3307117237e79145a87d';
    this.TONY_POOL = '0x89649AF832915FF8F24100a58b6A6FBc498de911';
    
    // Minimum liquidity thresholds
    this.MIN_WETH_LIQUIDITY = ethers.utils.parseEther('0.1'); // 0.1 WETH minimum
    this.MIN_TONY_LIQUIDITY = ethers.utils.parseEther('1000'); // 1000 TONY minimum
    
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
    
    this.POOL_ABI = [
      'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
      'function liquidity() external view returns (uint128)',
      'function token0() external view returns (address)',
      'function token1() external view returns (address)',
      'function fee() external view returns (uint24)'
    ];
  }
  
  /**
   * LIQUIDITY-AWARE EXEC BUY
   */
  async execBuy(walletPrivateKey, tokenAddress, amountETH) {
    console.log(`💧 ========== LIQUIDITY-AWARE TRADING SYSTEM ==========`);
    console.log(`🎯 Token: ${tokenAddress}`);
    console.log(`💰 Amount: ${amountETH} ETH`);
    console.log(`🔍 Checking liquidity before trading...`);
    
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
      // STEP 1: Check liquidity first
      console.log(`\n💧 STEP 1: Liquidity Check`);
      const liquidityCheck = await this.checkPoolLiquidity(tokenAddress);
      
      if (!liquidityCheck.hasLiquidity) {
        return {
          success: false,
          error: liquidityCheck.reason,
          method: 'insufficient-liquidity',
          liquidityInfo: liquidityCheck
        };
      }
      
      console.log(`✅ Liquidity check passed!`);
      
      // STEP 2: Execute trade with liquidity awareness
      console.log(`\n🚀 STEP 2: Execute Trade`);
      
      if (tokenAddress.toLowerCase() === this.TONY_TOKEN.toLowerCase()) {
        return await this.executeLiquidityAwareTonySwap(wallet, amountETH, tokenInfo, balanceBefore, liquidityCheck);
      } else {
        return await this.executeLiquidityAwareGenericSwap(wallet, tokenAddress, amountETH, tokenInfo, balanceBefore);
      }
      
    } catch (error) {
      console.error(`❌ Liquidity-aware trading failed:`, error.message);
      return {
        success: false,
        error: error.message,
        method: 'liquidity-aware-error'
      };
    }
  }
  
  /**
   * CHECK POOL LIQUIDITY
   */
  async checkPoolLiquidity(tokenAddress) {
    console.log(`  💧 Checking pool liquidity...`);
    
    if (tokenAddress.toLowerCase() !== this.TONY_TOKEN.toLowerCase()) {
      return {
        hasLiquidity: false,
        reason: 'Only TONY token supported for liquidity checking',
        method: 'unsupported-token'
      };
    }
    
    try {
      const tonyToken = new ethers.Contract(this.TONY_TOKEN, this.ERC20_ABI, this.provider);
      const wethToken = new ethers.Contract(this.WETH, this.ERC20_ABI, this.provider);
      const pool = new ethers.Contract(this.TONY_POOL, this.POOL_ABI, this.provider);
      
      // Get pool state
      const [slot0, totalLiquidity, poolTonyBalance, poolWethBalance] = await Promise.all([
        pool.slot0(),
        pool.liquidity(),
        tonyToken.balanceOf(this.TONY_POOL),
        wethToken.balanceOf(this.TONY_POOL)
      ]);
      
      console.log(`    🏊 Pool State:`);
      console.log(`      TONY in pool: ${ethers.utils.formatEther(poolTonyBalance)} TONY`);
      console.log(`      WETH in pool: ${ethers.utils.formatEther(poolWethBalance)} WETH`);
      console.log(`      Total liquidity: ${totalLiquidity.toString()}`);
      console.log(`      Unlocked: ${slot0.unlocked}`);
      console.log(`      Current tick: ${slot0.tick}`);
      
      // Check minimum liquidity requirements
      const hasMinWeth = poolWethBalance.gte(this.MIN_WETH_LIQUIDITY);
      const hasMinTony = poolTonyBalance.gte(this.MIN_TONY_LIQUIDITY);
      const isUnlocked = slot0.unlocked;
      const hasLiquidity = totalLiquidity.gt(0);
      
      console.log(`    ✅ Checks:`);
      console.log(`      Min WETH (${ethers.utils.formatEther(this.MIN_WETH_LIQUIDITY)}): ${hasMinWeth}`);
      console.log(`      Min TONY (${ethers.utils.formatEther(this.MIN_TONY_LIQUIDITY)}): ${hasMinTony}`);
      console.log(`      Pool unlocked: ${isUnlocked}`);
      console.log(`      Has liquidity: ${hasLiquidity}`);
      
      const allChecksPassed = hasMinWeth && hasMinTony && isUnlocked && hasLiquidity;
      
      if (!allChecksPassed) {
        let reason = 'Pool liquidity insufficient: ';
        if (!hasMinWeth) reason += `WETH too low (${ethers.utils.formatEther(poolWethBalance)} < ${ethers.utils.formatEther(this.MIN_WETH_LIQUIDITY)}), `;
        if (!hasMinTony) reason += `TONY too low (${ethers.utils.formatEther(poolTonyBalance)} < ${ethers.utils.formatEther(this.MIN_TONY_LIQUIDITY)}), `;
        if (!isUnlocked) reason += 'Pool locked, ';
        if (!hasLiquidity) reason += 'No liquidity, ';
        
        return {
          hasLiquidity: false,
          reason: reason.slice(0, -2), // Remove trailing comma
          poolTonyBalance: ethers.utils.formatEther(poolTonyBalance),
          poolWethBalance: ethers.utils.formatEther(poolWethBalance),
          totalLiquidity: totalLiquidity.toString(),
          isUnlocked
        };
      }
      
      return {
        hasLiquidity: true,
        poolTonyBalance: ethers.utils.formatEther(poolTonyBalance),
        poolWethBalance: ethers.utils.formatEther(poolWethBalance),
        totalLiquidity: totalLiquidity.toString(),
        isUnlocked,
        currentTick: slot0.tick,
        sqrtPriceX96: slot0.sqrtPriceX96.toString()
      };
      
    } catch (error) {
      return {
        hasLiquidity: false,
        reason: `Liquidity check failed: ${error.message}`,
        method: 'liquidity-check-error'
      };
    }
  }
  
  /**
   * EXECUTE LIQUIDITY-AWARE TONY SWAP
   */
  async executeLiquidityAwareTonySwap(wallet, amountETH, tokenInfo, balanceBefore, liquidityInfo) {
    console.log(`  🎯 Executing liquidity-aware TONY swap...`);
    console.log(`  💧 Available WETH in pool: ${liquidityInfo.poolWethBalance} WETH`);
    console.log(`  🪙 Available TONY in pool: ${liquidityInfo.poolTonyBalance} TONY`);
    
    // Calculate maximum safe trade size (don't use more than 10% of pool WETH)
    const maxSafeTradeETH = parseFloat(liquidityInfo.poolWethBalance) * 0.1;
    const requestedETH = parseFloat(amountETH);
    
    if (requestedETH > maxSafeTradeETH) {
      console.log(`  ⚠️ Trade size too large! Requested: ${requestedETH} ETH, Max safe: ${maxSafeTradeETH.toFixed(6)} ETH`);
      console.log(`  💡 Reducing trade size to safe amount...`);
      amountETH = maxSafeTradeETH.toFixed(6);
    }
    
    console.log(`  💰 Final trade amount: ${amountETH} ETH`);
    
    const router = new ethers.Contract(this.UNISWAP_V3_ROUTER, this.ROUTER_ABI, wallet);
    
    // Method 1: exactInputSingle
    const params = {
      tokenIn: this.WETH,
      tokenOut: this.TONY_TOKEN,
      fee: 10000, // 1%
      recipient: wallet.address,
      deadline: Math.floor(Date.now() / 1000) + 300,
      amountIn: ethers.utils.parseEther(amountETH.toString()),
      amountOutMinimum: 0, // Accept any amount
      sqrtPriceLimitX96: 0
    };
    
    try {
      console.log(`    🎯 Trying exactInputSingle...`);
      
      const gasEstimate = await router.estimateGas.exactInputSingle(params, {
        value: ethers.utils.parseEther(amountETH.toString())
      });
      
      console.log(`    ✅ Gas estimate: ${gasEstimate.toString()}`);
      
      const tx = await router.exactInputSingle(params, {
        value: ethers.utils.parseEther(amountETH.toString()),
        gasLimit: gasEstimate.mul(120).div(100),
        gasPrice: await this.provider.getGasPrice()
      });
      
      console.log(`    📝 Transaction: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`    ✅ Confirmed: ${receipt.gasUsed.toString()} gas`);
      
      return await this.checkTokensReceived(wallet, balanceBefore, tokenInfo, tx.hash, receipt);
      
    } catch (error) {
      console.log(`    ❌ exactInputSingle failed: ${error.message}`);
      
      // Method 2: exactInput with path
      try {
        console.log(`    🎯 Trying exactInput with path...`);
        
        const path = ethers.utils.solidityPack(
          ['address', 'uint24', 'address'],
          [this.WETH, 10000, this.TONY_TOKEN]
        );
        
        const pathParams = {
          path: path,
          recipient: wallet.address,
          deadline: Math.floor(Date.now() / 1000) + 300,
          amountIn: ethers.utils.parseEther(amountETH.toString()),
          amountOutMinimum: 0
        };
        
        const gasEstimate2 = await router.estimateGas.exactInput(pathParams, {
          value: ethers.utils.parseEther(amountETH.toString())
        });
        
        console.log(`    ✅ Path gas estimate: ${gasEstimate2.toString()}`);
        
        const tx2 = await router.exactInput(pathParams, {
          value: ethers.utils.parseEther(amountETH.toString()),
          gasLimit: gasEstimate2.mul(120).div(100),
          gasPrice: await this.provider.getGasPrice()
        });
        
        console.log(`    📝 Path transaction: ${tx2.hash}`);
        const receipt2 = await tx2.wait();
        console.log(`    ✅ Path confirmed: ${receipt2.gasUsed.toString()} gas`);
        
        return await this.checkTokensReceived(wallet, balanceBefore, tokenInfo, tx2.hash, receipt2);
        
      } catch (error2) {
        console.log(`    ❌ exactInput also failed: ${error2.message}`);
        
        return {
          success: false,
          error: `Both methods failed. Last error: ${error2.message}`,
          method: 'liquidity-aware-all-methods-failed',
          liquidityInfo: liquidityInfo
        };
      }
    }
  }
  
  /**
   * EXECUTE LIQUIDITY-AWARE GENERIC SWAP
   */
  async executeLiquidityAwareGenericSwap(wallet, tokenAddress, amountETH, tokenInfo, balanceBefore) {
    console.log(`  🔍 Generic liquidity-aware swap for ${tokenInfo.symbol}...`);
    
    // For now, only TONY is supported
    return {
      success: false,
      error: 'Only TONY token is supported in liquidity-aware mode',
      method: 'generic-not-supported'
    };
  }
  
  /**
   * CHECK TOKENS RECEIVED
   */
  async checkTokensReceived(wallet, balanceBefore, tokenInfo, txHash, receipt) {
    const token = new ethers.Contract(this.TONY_TOKEN, this.ERC20_ABI, wallet);
    const balanceAfter = await token.balanceOf(wallet.address);
    const tokensReceived = balanceAfter.sub(balanceBefore);
    
    if (tokensReceived.gt(0)) {
      console.log(`    🎉 SUCCESS! TONY tokens received!`);
      console.log(`    📊 Amount: ${ethers.utils.formatEther(tokensReceived)} TONY`);
      
      return {
        success: true,
        txHash: txHash,
        gasUsed: receipt.gasUsed.toString(),
        tokensReceived: ethers.utils.formatEther(tokensReceived),
        method: 'liquidity-aware-success',
        blockNumber: receipt.blockNumber,
        tokenInfo: tokenInfo
      };
    } else {
      return {
        success: false,
        error: 'Transaction succeeded but no tokens received',
        method: 'liquidity-aware-no-tokens',
        txHash: txHash
      };
    }
  }
}

module.exports = LiquidityAwareSystem;