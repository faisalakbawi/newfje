/**
 * INTELLIGENT TRADING SYSTEM
 * Uses token intelligence to trade on the exact pool/DEX with liquidity
 * Pre-analyzes tokens to know exactly where and how to trade
 */

const { ethers } = require('ethers');
const TokenIntelligenceSystem = require('../../token-intelligence-system');

class IntelligentTradingSystem {
  constructor(provider) {
    this.provider = provider;
    this.intelligence = new TokenIntelligenceSystem();
    
    this.abis = {
      ERC20: [
        'function name() external view returns (string)',
        'function symbol() external view returns (string)',
        'function decimals() external view returns (uint8)',
        'function balanceOf(address account) external view returns (uint256)',
        'function allowance(address owner, address spender) external view returns (uint256)',
        'function approve(address spender, uint256 amount) external returns (bool)'
      ],
      
      UNISWAP_V3_ROUTER: [
        'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
        'function exactInput((bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum)) external payable returns (uint256 amountOut)'
      ],
      
      UNISWAP_V2_ROUTER: [
        'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
        'function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable'
      ]
    };
    
    this.WETH = '0x4200000000000000000000000000000000000006';
  }
  
  /**
   * INTELLIGENT EXEC BUY
   * Uses pre-analyzed token intelligence for optimal trading
   */
  async execBuy(walletPrivateKey, tokenAddress, amountETH) {
    console.log(`🧠 ========== INTELLIGENT TRADING SYSTEM ==========`);
    console.log(`🎯 Token: ${tokenAddress}`);
    console.log(`💰 Amount: ${amountETH} ETH`);
    console.log(`🔍 Using token intelligence for optimal trading...`);
    
    const wallet = new ethers.Wallet(walletPrivateKey, this.provider);
    console.log(`👤 Wallet: ${wallet.address}`);
    
    try {
      // STEP 1: Get or create token intelligence
      console.log(`\n🧠 STEP 1: Token Intelligence Analysis`);
      let tokenIntel = this.intelligence.getTokenIntelligence(tokenAddress);
      
      if (!tokenIntel) {
        console.log(`  🔍 No cached intelligence, analyzing token...`);
        tokenIntel = await this.intelligence.analyzeToken(tokenAddress);
      } else {
        console.log(`  💾 Using cached intelligence`);
        console.log(`  🏆 Best DEX: ${tokenIntel.tradingStrategy.recommended}`);
        console.log(`  🏊 Pool: ${tokenIntel.bestPool?.address || 'None'}`);
        console.log(`  📊 Liquidity Score: ${tokenIntel.bestPool?.liquidityScore || 0}/100`);
      }
      
      // Check if we have a viable trading strategy
      if (!tokenIntel.bestPool) {
        return {
          success: false,
          error: `No liquidity found for token. ${tokenIntel.tradingStrategy.reason}`,
          method: 'intelligent-no-liquidity',
          suggestion: tokenIntel.tradingStrategy.fallback
        };
      }
      
      // Get token info
      const token = new ethers.Contract(tokenAddress, this.abis.ERC20, wallet);
      const balanceBefore = await token.balanceOf(wallet.address);
      console.log(`📊 ${tokenIntel.tokenInfo.symbol} balance before: ${ethers.utils.formatUnits(balanceBefore, tokenIntel.tokenInfo.decimals)}`);
      
      // STEP 2: Validate trade size
      console.log(`\n💰 STEP 2: Trade Size Validation`);
      const maxTradeSize = tokenIntel.tradingStrategy.maxTradeSize;
      const requestedAmount = parseFloat(amountETH);
      
      if (requestedAmount > maxTradeSize) {
        console.log(`  ⚠️ Trade size too large!`);
        console.log(`  📊 Requested: ${requestedAmount} ETH`);
        console.log(`  📊 Max safe: ${maxTradeSize} ETH`);
        console.log(`  🔧 Reducing to safe amount...`);
        amountETH = maxTradeSize.toString();
      }
      
      console.log(`  ✅ Final trade amount: ${amountETH} ETH`);
      
      // STEP 3: Execute intelligent trade
      console.log(`\n🚀 STEP 3: Intelligent Trade Execution`);
      console.log(`  🎯 Using: ${tokenIntel.tradingStrategy.recommended}`);
      console.log(`  🏊 Pool: ${tokenIntel.bestPool.address}`);
      console.log(`  ⚡ Method: ${tokenIntel.tradingStrategy.method}`);
      
      if (tokenIntel.bestPool.type === 'v3') {
        return await this.executeV3Trade(wallet, tokenIntel, amountETH, balanceBefore);
      } else {
        return await this.executeV2Trade(wallet, tokenIntel, amountETH, balanceBefore);
      }
      
    } catch (error) {
      console.error(`❌ Intelligent trading failed:`, error.message);
      return {
        success: false,
        error: error.message,
        method: 'intelligent-error'
      };
    }
  }
  
  /**
   * EXECUTE V3 TRADE
   */
  async executeV3Trade(wallet, tokenIntel, amountETH, balanceBefore) {
    console.log(`  🔷 Executing Uniswap V3 trade...`);
    
    const router = new ethers.Contract(tokenIntel.bestPool.router, this.abis.UNISWAP_V3_ROUTER, wallet);
    const pool = tokenIntel.bestPool;
    
    // Determine token order
    const isWETHToken0 = pool.token0.toLowerCase() === this.WETH.toLowerCase();
    const tokenIn = this.WETH;
    const tokenOut = isWETHToken0 ? pool.token1 : pool.token0;
    
    console.log(`    🔄 Direction: WETH → ${tokenIntel.tokenInfo.symbol}`);
    console.log(`    💸 Fee: ${pool.fee / 10000}%`);
    
    // Method 1: exactInputSingle
    try {
      console.log(`    🎯 Trying exactInputSingle...`);
      
      const params = {
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        fee: pool.fee,
        recipient: wallet.address,
        deadline: Math.floor(Date.now() / 1000) + 300,
        amountIn: ethers.utils.parseEther(amountETH.toString()),
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0
      };
      
      // Check if we need to handle concentrated liquidity
      if (pool.currentTick && pool.sqrtPriceX96) {
        console.log(`    📊 Current tick: ${pool.currentTick}`);
        console.log(`    📈 Price: ${pool.sqrtPriceX96}`);
      }
      
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
      
      return await this.checkTokensReceived(wallet, tokenIntel, balanceBefore, tx.hash, receipt, 'V3-exactInputSingle');
      
    } catch (error) {
      console.log(`    ❌ exactInputSingle failed: ${error.message}`);
      
      // Method 2: exactInput with path
      try {
        console.log(`    🛤️ Trying exactInput with path...`);
        
        const path = ethers.utils.solidityPack(
          ['address', 'uint24', 'address'],
          [tokenIn, pool.fee, tokenOut]
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
        
        const tx2 = await router.exactInput(pathParams, {
          value: ethers.utils.parseEther(amountETH.toString()),
          gasLimit: gasEstimate2.mul(120).div(100),
          gasPrice: await this.provider.getGasPrice()
        });
        
        console.log(`    📝 Path transaction: ${tx2.hash}`);
        const receipt2 = await tx2.wait();
        
        return await this.checkTokensReceived(wallet, tokenIntel, balanceBefore, tx2.hash, receipt2, 'V3-exactInput');
        
      } catch (pathError) {
        console.log(`    ❌ exactInput also failed: ${pathError.message}`);
        
        // Method 3: Try with different price limit
        try {
          console.log(`    🎯 Trying with price limit...`);
          
          // Use a more permissive price limit
          const params3 = {
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: pool.fee,
            recipient: wallet.address,
            deadline: Math.floor(Date.now() / 1000) + 300,
            amountIn: ethers.utils.parseEther(amountETH.toString()),
            amountOutMinimum: 0,
            sqrtPriceLimitX96: pool.sqrtPriceX96 // Use current pool price as limit
          };
          
          const tx3 = await router.exactInputSingle(params3, {
            value: ethers.utils.parseEther(amountETH.toString()),
            gasLimit: 500000, // Higher gas limit
            gasPrice: (await this.provider.getGasPrice()).mul(150).div(100) // Higher gas price
          });
          
          console.log(`    📝 Price limit transaction: ${tx3.hash}`);
          const receipt3 = await tx3.wait();
          
          return await this.checkTokensReceived(wallet, tokenIntel, balanceBefore, tx3.hash, receipt3, 'V3-priceLimit');
          
        } catch (priceLimitError) {
          console.log(`    ❌ Price limit also failed: ${priceLimitError.message}`);
          
          return {
            success: false,
            error: `All V3 methods failed. Last error: ${priceLimitError.message}`,
            method: 'intelligent-v3-all-failed',
            poolUsed: pool.address,
            dexUsed: tokenIntel.tradingStrategy.recommended
          };
        }
      }
    }
  }
  
  /**
   * EXECUTE V2 TRADE
   */
  async executeV2Trade(wallet, tokenIntel, amountETH, balanceBefore) {
    console.log(`  🔶 Executing V2 trade...`);
    
    const router = new ethers.Contract(tokenIntel.bestPool.router, this.abis.UNISWAP_V2_ROUTER, wallet);
    const path = [this.WETH, tokenIntel.tokenAddress];
    
    console.log(`    🔄 Path: WETH → ${tokenIntel.tokenInfo.symbol}`);
    console.log(`    💧 Reserves: ${tokenIntel.bestPool.liquidityInfo}`);
    
    // Method 1: Standard swap
    try {
      console.log(`    🔄 Trying standard swap...`);
      
      const gasEstimate = await router.estimateGas.swapExactETHForTokens(
        0,
        path,
        wallet.address,
        Math.floor(Date.now() / 1000) + 300,
        { value: ethers.utils.parseEther(amountETH.toString()) }
      );
      
      const tx = await router.swapExactETHForTokens(
        0,
        path,
        wallet.address,
        Math.floor(Date.now() / 1000) + 300,
        {
          value: ethers.utils.parseEther(amountETH.toString()),
          gasLimit: gasEstimate.mul(120).div(100),
          gasPrice: await this.provider.getGasPrice()
        }
      );
      
      console.log(`    📝 Standard swap transaction: ${tx.hash}`);
      const receipt = await tx.wait();
      
      return await this.checkTokensReceived(wallet, tokenIntel, balanceBefore, tx.hash, receipt, 'V2-standard');
      
    } catch (error) {
      console.log(`    ❌ Standard swap failed: ${error.message}`);
      
      // Method 2: Fee-on-transfer
      try {
        console.log(`    🔄 Trying fee-on-transfer swap...`);
        
        const gasEstimate2 = await router.estimateGas.swapExactETHForTokensSupportingFeeOnTransferTokens(
          0,
          path,
          wallet.address,
          Math.floor(Date.now() / 1000) + 300,
          { value: ethers.utils.parseEther(amountETH.toString()) }
        );
        
        const tx2 = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
          0,
          path,
          wallet.address,
          Math.floor(Date.now() / 1000) + 300,
          {
            value: ethers.utils.parseEther(amountETH.toString()),
            gasLimit: gasEstimate2.mul(120).div(100),
            gasPrice: await this.provider.getGasPrice()
          }
        );
        
        console.log(`    📝 Fee-on-transfer transaction: ${tx2.hash}`);
        const receipt2 = await tx2.wait();
        
        return await this.checkTokensReceived(wallet, tokenIntel, balanceBefore, tx2.hash, receipt2, 'V2-feeOnTransfer');
        
      } catch (feeError) {
        return {
          success: false,
          error: `All V2 methods failed. Last error: ${feeError.message}`,
          method: 'intelligent-v2-all-failed',
          poolUsed: tokenIntel.bestPool.address,
          dexUsed: tokenIntel.tradingStrategy.recommended
        };
      }
    }
  }
  
  /**
   * CHECK TOKENS RECEIVED
   */
  async checkTokensReceived(wallet, tokenIntel, balanceBefore, txHash, receipt, method) {
    const token = new ethers.Contract(tokenIntel.tokenAddress, this.abis.ERC20, wallet);
    const balanceAfter = await token.balanceOf(wallet.address);
    const tokensReceived = balanceAfter.sub(balanceBefore);
    
    if (tokensReceived.gt(0)) {
      console.log(`    🎉 SUCCESS!`);
      console.log(`    📊 Tokens received: ${ethers.utils.formatUnits(tokensReceived, tokenIntel.tokenInfo.decimals)} ${tokenIntel.tokenInfo.symbol}`);
      
      return {
        success: true,
        txHash: txHash,
        gasUsed: receipt.gasUsed.toString(),
        tokensReceived: ethers.utils.formatUnits(tokensReceived, tokenIntel.tokenInfo.decimals),
        method: `intelligent-${method}`,
        blockNumber: receipt.blockNumber,
        tokenInfo: tokenIntel.tokenInfo,
        dexUsed: tokenIntel.tradingStrategy.recommended,
        poolUsed: tokenIntel.bestPool.address,
        liquidityScore: tokenIntel.bestPool.liquidityScore
      };
    } else {
      return {
        success: false,
        error: `Transaction succeeded but no tokens received`,
        method: `intelligent-${method}-no-tokens`,
        txHash: txHash,
        dexUsed: tokenIntel.tradingStrategy.recommended
      };
    }
  }
}

module.exports = IntelligentTradingSystem;