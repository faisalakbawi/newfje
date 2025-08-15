/**
 * TARGETED LOOTER SYSTEM
 * Specifically targets the EXACT pool and method from successful transaction
 * Pool: 0x89649AF832915FF8F24100a58b6A6FBc498de911 (WETH/TONY 1% fee)
 */

const { ethers } = require('ethers');

class TargetedLooterSystem {
  constructor(provider) {
    this.provider = provider;
    
    // EXACT addresses from successful transaction
    this.UNISWAP_V3_ROUTER = '0x2626664c2603336E57B271c5C0b26F421741e481';
    this.WETH = '0x4200000000000000000000000000000000000006';
    
    // EXACT pool from successful transaction
    this.TONY_POOL = '0x89649AF832915FF8F24100a58b6A6FBc498de911';
    this.TONY_TOKEN = '0x36a947baa2492c72bf9d3307117237e79145a87d';
    this.TONY_FEE = 10000; // 1% fee
    
    this.ROUTER_ABI = [
      'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)'
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
   * TARGETED EXEC BUY - USES EXACT SUCCESSFUL METHOD
   */
  async execBuy(walletPrivateKey, tokenAddress, amountETH) {
    console.log(`🎯 ========== TARGETED LOOTER SYSTEM ==========`);
    console.log(`🎯 Token: ${tokenAddress}`);
    console.log(`💰 Amount: ${amountETH} ETH`);
    console.log(`🏊 Target Pool: ${this.TONY_POOL}`);
    console.log(`💸 Target Fee: ${this.TONY_FEE / 10000}%`);
    
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
      // Check if this is TONY token - use exact method
      if (tokenAddress.toLowerCase() === this.TONY_TOKEN.toLowerCase()) {
        console.log(`\n🎯 DETECTED TONY TOKEN - Using exact successful method`);
        return await this.executeTonySwap(wallet, amountETH, tokenInfo, balanceBefore);
      }
      
      // For other tokens, try to find their pools
      console.log(`\n🔍 NON-TONY TOKEN - Searching for pools`);
      return await this.executeGenericSwap(wallet, tokenAddress, amountETH, tokenInfo, balanceBefore);
      
    } catch (error) {
      console.error(`❌ Targeted exec buy failed:`, error.message);
      return {
        success: false,
        error: error.message,
        method: 'targeted-error'
      };
    }
  }
  
  /**
   * EXECUTE TONY SWAP - EXACT METHOD FROM SUCCESSFUL TRANSACTION
   */
  async executeTonySwap(wallet, amountETH, tokenInfo, balanceBefore) {
    console.log(`  🎯 Executing EXACT TONY swap method...`);
    
    // First, verify the pool still exists and has liquidity
    const pool = new ethers.Contract(this.TONY_POOL, this.POOL_ABI, this.provider);
    
    try {
      const [slot0, liquidity, token0, token1, fee] = await Promise.all([
        pool.slot0(),
        pool.liquidity(),
        pool.token0(),
        pool.token1(),
        pool.fee()
      ]);
      
      console.log(`  📊 Pool verification:`);
      console.log(`    Token0: ${token0}`);
      console.log(`    Token1: ${token1}`);
      console.log(`    Fee: ${fee / 10000}%`);
      console.log(`    Liquidity: ${liquidity.toString()}`);
      console.log(`    Current tick: ${slot0.tick}`);
      console.log(`    Unlocked: ${slot0.unlocked}`);
      
      if (liquidity.eq(0)) {
        return {
          success: false,
          error: 'TONY pool has no liquidity',
          method: 'tony-no-liquidity'
        };
      }
      
      if (!slot0.unlocked) {
        return {
          success: false,
          error: 'TONY pool is locked',
          method: 'tony-pool-locked'
        };
      }
      
    } catch (error) {
      return {
        success: false,
        error: `Failed to verify TONY pool: ${error.message}`,
        method: 'tony-pool-verification-failed'
      };
    }
    
    // Execute the EXACT same swap as the successful transaction
    const router = new ethers.Contract(this.UNISWAP_V3_ROUTER, this.ROUTER_ABI, wallet);
    
    const params = {
      tokenIn: this.WETH,
      tokenOut: this.TONY_TOKEN,
      fee: this.TONY_FEE, // EXACT fee from successful transaction
      recipient: wallet.address,
      deadline: Math.floor(Date.now() / 1000) + 300,
      amountIn: ethers.utils.parseEther(amountETH.toString()),
      amountOutMinimum: 0, // Looter style - accept any amount
      sqrtPriceLimitX96: 0
    };
    
    console.log(`  🚀 Executing TONY swap with exact parameters...`);
    console.log(`    💰 Amount in: ${amountETH} ETH`);
    console.log(`    🎯 Token out: TONY`);
    console.log(`    💸 Fee: ${this.TONY_FEE / 10000}%`);
    console.log(`    📍 Pool: ${this.TONY_POOL}`);
    
    try {
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
      
      console.log(`  📝 TONY transaction submitted: ${tx.hash}`);
      console.log(`  ⏳ Waiting for confirmation...`);
      
      const receipt = await tx.wait();
      console.log(`  ✅ TONY swap confirmed in block ${receipt.blockNumber}`);
      console.log(`  ⛽ Gas used: ${receipt.gasUsed.toString()}`);
      
      // Check tokens received
      const token = new ethers.Contract(this.TONY_TOKEN, this.ERC20_ABI, wallet);
      const balanceAfter = await token.balanceOf(wallet.address);
      const tokensReceived = balanceAfter.sub(balanceBefore);
      
      if (tokensReceived.gt(0)) {
        console.log(`  🎉 TONY TOKENS RECEIVED!`);
        console.log(`  📊 Amount: ${ethers.utils.formatUnits(tokensReceived, tokenInfo.decimals)} TONY`);
        
        return {
          success: true,
          txHash: tx.hash,
          gasUsed: receipt.gasUsed.toString(),
          tokensReceived: ethers.utils.formatUnits(tokensReceived, tokenInfo.decimals),
          method: 'targeted-tony-swap',
          blockNumber: receipt.blockNumber,
          pool: this.TONY_POOL,
          fee: this.TONY_FEE,
          tokenInfo: tokenInfo
        };
      } else {
        return {
          success: false,
          error: 'Transaction succeeded but no TONY tokens received',
          method: 'tony-no-tokens-received',
          txHash: tx.hash
        };
      }
      
    } catch (error) {
      console.log(`  ❌ TONY swap execution failed:`, error.message);
      return {
        success: false,
        error: error.message,
        method: 'tony-swap-execution-failed'
      };
    }
  }
  
  /**
   * EXECUTE GENERIC SWAP - FOR NON-TONY TOKENS
   */
  async executeGenericSwap(wallet, tokenAddress, amountETH, tokenInfo, balanceBefore) {
    console.log(`  🔍 Searching for pools for ${tokenInfo.symbol}...`);
    
    // Try common fee tiers
    const feeTiers = [10000, 3000, 500, 100]; // Start with 1% (like TONY), then others
    const router = new ethers.Contract(this.UNISWAP_V3_ROUTER, this.ROUTER_ABI, wallet);
    
    for (const fee of feeTiers) {
      try {
        console.log(`    🎯 Trying ${fee / 10000}% fee tier...`);
        
        const params = {
          tokenIn: this.WETH,
          tokenOut: tokenAddress,
          fee: fee,
          recipient: wallet.address,
          deadline: Math.floor(Date.now() / 1000) + 300,
          amountIn: ethers.utils.parseEther(amountETH.toString()),
          amountOutMinimum: 0,
          sqrtPriceLimitX96: 0
        };
        
        // Try gas estimate first
        const gasEstimate = await router.estimateGas.exactInputSingle(params, {
          value: ethers.utils.parseEther(amountETH.toString())
        });
        
        console.log(`    ✅ Found working pool with ${fee / 10000}% fee!`);
        console.log(`    ⛽ Gas estimate: ${gasEstimate.toString()}`);
        
        // Execute the swap
        const tx = await router.exactInputSingle(params, {
          value: ethers.utils.parseEther(amountETH.toString()),
          gasLimit: gasEstimate.mul(120).div(100),
          gasPrice: await this.provider.getGasPrice()
        });
        
        console.log(`    📝 Transaction submitted: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`    ✅ Confirmed in block ${receipt.blockNumber}`);
        
        // Check tokens received
        const token = new ethers.Contract(tokenAddress, this.ERC20_ABI, wallet);
        const balanceAfter = await token.balanceOf(wallet.address);
        const tokensReceived = balanceAfter.sub(balanceBefore);
        
        if (tokensReceived.gt(0)) {
          console.log(`    🎉 TOKENS RECEIVED!`);
          console.log(`    📊 Amount: ${ethers.utils.formatUnits(tokensReceived, tokenInfo.decimals)} ${tokenInfo.symbol}`);
          
          return {
            success: true,
            txHash: tx.hash,
            gasUsed: receipt.gasUsed.toString(),
            tokensReceived: ethers.utils.formatUnits(tokensReceived, tokenInfo.decimals),
            method: 'targeted-generic-swap',
            blockNumber: receipt.blockNumber,
            fee: fee,
            tokenInfo: tokenInfo
          };
        }
        
      } catch (error) {
        console.log(`    ❌ ${fee / 10000}% fee failed:`, error.message);
        continue;
      }
    }
    
    return {
      success: false,
      error: `No working pools found for ${tokenInfo.symbol}`,
      method: 'generic-no-pools-found'
    };
  }
}

module.exports = TargetedLooterSystem;