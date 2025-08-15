/**
 * DYNAMIC SNIPER SYSTEM
 * Adaptive execBuy() that works with ANY ETH amount and adjusts to live price changes
 */

const { ethers } = require('ethers');

class DynamicSniperSystem {
  constructor(provider) {
    this.provider = provider;
    
    // The proven sniper contract
    this.SNIPER_CONTRACT = '0xe111b0C3605aDc45CFb0CD75E5543F63CC3ec425';
    
    // Base network addresses
    this.WETH = '0x4200000000000000000000000000000000000006';
    this.UNISWAP_V3_FACTORY = '0x33128a8fC17869897dcE68Ed026d694621f6FDfD';
    this.UNISWAP_V3_QUOTER = '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a';
    
    // ABIs
    this.PAIR_ABI = [
      'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
      'function token0() external view returns (address)',
      'function token1() external view returns (address)'
    ];
    
    this.ERC20_ABI = [
      'function name() external view returns (string)',
      'function symbol() external view returns (string)',
      'function decimals() external view returns (uint8)',
      'function balanceOf(address account) external view returns (uint256)'
    ];
    
    this.QUOTER_ABI = [
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
        "stateMutability": "nonpayable",
        "type": "function"
      }
    ];
  }
  
  /**
   * GET ACCURATE PRICE FROM QUOTER V2
   * Uses Uniswap's QuoterV2 for precise price calculation
   */
  async getQuoterPrice(tokenAddress, ethAmountWei) {
    try {
      console.log(`    🔍 QuoterV2: Getting price for ${ethers.utils.formatEther(ethAmountWei)} ETH → ${tokenAddress}`);
      
      const quoter = new ethers.Contract(this.UNISWAP_V3_QUOTER, this.QUOTER_ABI, this.provider);
      
      const quote = await quoter.quoteExactInputSingle(
        this.WETH,           // tokenIn
        tokenAddress,        // tokenOut
        10000,              // fee (1%)
        ethAmountWei,       // amountIn
        0                   // sqrtPriceLimitX96
      );
      
      console.log(`    ✅ QuoterV2 result: ${ethers.utils.formatEther(quote.amountOut)} tokens`);
      console.log(`    ⛽ Gas estimate: ${quote.gasEstimate.toString()}`);
      
      return {
        success: true,
        amountOut: quote.amountOut,
        gasEstimate: quote.gasEstimate
      };
      
    } catch (error) {
      console.log(`    ❌ QuoterV2 failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * MAIN ENTRY POINT - Dynamic execBuy for ANY ETH amount
   */
  async execBuy(walletPrivateKey, tokenAddress, amountETH) {
    console.log(`🌊 ========== DYNAMIC SNIPER SYSTEM ==========`);
    console.log(`🎯 Token: ${tokenAddress}`);
    console.log(`💰 Amount: ${amountETH} ETH`);
    console.log(`⚡ Method: Dynamic execBuy() with real-time calculations`);
    
    const wallet = new ethers.Wallet(walletPrivateKey, this.provider);
    console.log(`👤 Wallet: ${wallet.address}`);
    
    try {
      // STEP 1: Get token info
      console.log(`\n🔍 STEP 1: Token Analysis`);
      const tokenInfo = await this.getTokenInfo(tokenAddress, wallet);
      
      // STEP 2: Get real-time pool data
      console.log(`\n📊 STEP 2: Real-Time Pool Data`);
      const poolData = await this.getRealTimePoolData(tokenAddress);
      
      // STEP 3: Calculate dynamic parameters
      console.log(`\n🧠 STEP 3: Dynamic Parameter Calculation`);
      const params = await this.calculateDynamicParams(amountETH, tokenAddress, poolData);
      
      // STEP 4: Execute adaptive sniper transaction
      console.log(`\n🚀 STEP 4: Execute Adaptive Sniper`);
      return await this.executeAdaptiveSniper(wallet, params, tokenInfo, amountETH);
      
    } catch (error) {
      console.error(`❌ Dynamic sniper failed:`, error.message);
      return {
        success: false,
        error: error.message,
        method: 'dynamic-sniper-error'
      };
    }
  }
  
  /**
   * GET TOKEN INFO
   */
  async getTokenInfo(tokenAddress, wallet) {
    const token = new ethers.Contract(tokenAddress, this.ERC20_ABI, wallet);
    
    try {
      const [name, symbol, decimals, balance] = await Promise.all([
        token.name().catch(() => 'Unknown'),
        token.symbol().catch(() => 'UNK'),
        token.decimals().catch(() => 18),
        token.balanceOf(wallet.address).catch(() => ethers.BigNumber.from(0))
      ]);
      
      console.log(`  📋 Token: ${name} (${symbol}) - ${decimals} decimals`);
      console.log(`  📊 Current balance: ${ethers.utils.formatUnits(balance, decimals)} ${symbol}`);
      
      return { address: tokenAddress, name, symbol, decimals, balanceBefore: balance };
    } catch (error) {
      throw new Error(`Invalid token contract: ${error.message}`);
    }
  }
  
  /**
   * GET REAL-TIME POOL DATA
   * Uses known pool data and calculates current price
   */
  async getRealTimePoolData(tokenAddress) {
    console.log(`  🔍 Fetching real-time pool data...`);
    
    // TONY token specific data (from intelligence analysis)
    if (tokenAddress.toLowerCase() === '0x36a947baa2492c72bf9d3307117237e79145a87d') {
      console.log(`  🎯 Using TONY token pool data...`);
      
      try {
        // Known TONY pool on Uniswap V3
        const TONY_POOL = '0x89649AF832915FF8F24100a58b6A6FBc498de911';
        const FEE_TIER = 10000; // 1%
        
        // Get current pool state directly
        const poolContract = new ethers.Contract(TONY_POOL, [
          'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
          'function liquidity() external view returns (uint128)',
          'function token0() external view returns (address)',
          'function token1() external view returns (address)'
        ], this.provider);
        
        const [slot0, liquidity, token0, token1] = await Promise.all([
          poolContract.slot0(),
          poolContract.liquidity(),
          poolContract.token0(),
          poolContract.token1()
        ]);
        
        console.log(`  ✅ Pool found: ${TONY_POOL}`);
        console.log(`  💧 Liquidity: ${liquidity.toString()}`);
        console.log(`  🔄 Token0: ${token0}`);
        console.log(`  🔄 Token1: ${token1}`);
        
        // Calculate price from sqrtPriceX96
        const sqrtPriceX96 = slot0.sqrtPriceX96;
        const price = sqrtPriceX96.mul(sqrtPriceX96).div(ethers.BigNumber.from(2).pow(192));
        
        // Determine if WETH is token0 or token1 and calculate accordingly
        let tokensPerETH;
        if (token0.toLowerCase() === this.WETH.toLowerCase()) {
          // WETH is token0, TONY is token1
          tokensPerETH = ethers.utils.parseEther('1').div(price);
        } else {
          // TONY is token0, WETH is token1  
          tokensPerETH = price.mul(ethers.utils.parseEther('1'));
        }
        
        console.log(`  💱 Current price: 1 ETH = ${ethers.utils.formatUnits(tokensPerETH, 18)} TONY`);
        
        return {
          hasPool: true,
          currentPrice: tokensPerETH,
          feeTier: FEE_TIER,
          poolAddress: TONY_POOL,
          method: 'direct-pool-access'
        };
        
      } catch (error) {
        console.log(`  ❌ Direct pool access failed: ${error.message}`);
        console.log(`  🔄 Using reliable fallback method...`);
      }
      
      // RELIABLE FALLBACK: Use approximate price from known liquidity
      // From intelligence: 4.72 WETH + 161M TONY = ~34,110 TONY per ETH
      const approximatePrice = ethers.utils.parseUnits('34110', 18);
      
      console.log(`  ✅ Using reliable price: 1 ETH = ${ethers.utils.formatUnits(approximatePrice, 18)} TONY`);
      
      return {
        hasPool: true,
        currentPrice: approximatePrice,
        feeTier: 10000,
        poolAddress: '0x89649AF832915FF8F24100a58b6A6FBc498de911',
        method: 'reliable-fallback'
      };
    }
    
    // For other tokens, try the quoter method
    try {
      const quoter = new ethers.Contract(this.UNISWAP_V3_QUOTER, this.QUOTER_ABI, this.provider);
      
      // Test different fee tiers
      const feeTiers = [500, 3000, 10000]; // 0.05%, 0.3%, 1%
      let bestQuote = null;
      let bestFee = null;
      
      for (const fee of feeTiers) {
        try {
          const oneETH = ethers.utils.parseEther('1');
          const quote = await quoter.callStatic.quoteExactInputSingle(
            this.WETH,
            tokenAddress,
            fee,
            oneETH,
            0
          );
          
          if (quote.gt(0)) {
            console.log(`    ✅ Fee tier ${fee/100}%: 1 ETH = ${ethers.utils.formatUnits(quote, 18)} tokens`);
            if (!bestQuote || quote.gt(bestQuote)) {
              bestQuote = quote;
              bestFee = fee;
            }
          }
        } catch (error) {
          console.log(`    ❌ Fee tier ${fee/100}%: No pool`);
        }
      }
      
      if (bestQuote) {
        return {
          hasPool: true,
          currentPrice: bestQuote,
          feeTier: bestFee,
          method: 'uniswap-v3-quoter'
        };
      } else {
        throw new Error('No liquidity pools found for this token');
      }
      
    } catch (error) {
      console.log(`  ❌ Pool detection failed: ${error.message}`);
      throw new Error(`No liquidity available for token: ${error.message}`);
    }
  }
  
  /**
   * CALCULATE DYNAMIC PARAMETERS
   * Computes correct execBuy() parameters for any ETH amount
   */
  async calculateDynamicParams(amountETH, tokenAddress, poolData) {
    console.log(`  🧠 Calculating parameters for ${amountETH} ETH...`);
    
    const ethAmountWei = ethers.utils.parseEther(amountETH.toString());
    
    // Calculate expected output tokens
    console.log(`  🔍 Debug - ETH amount wei: ${ethAmountWei.toString()}`);
    console.log(`  🔍 Debug - Current price: ${poolData.currentPrice.toString()}`);
    
    // Use QuoterV2 for accurate price calculation
    console.log(`  🔍 Getting accurate price from QuoterV2...`);
    const quoterResult = await this.getQuoterPrice(tokenAddress, ethAmountWei);
    
    let expectedTokens;
    if (quoterResult.success) {
      expectedTokens = quoterResult.amountOut;
      console.log(`  ✅ QuoterV2 price: ${ethers.utils.formatUnits(expectedTokens, 18)} tokens`);
    } else {
      // Fallback to pool calculation if QuoterV2 fails
      expectedTokens = poolData.currentPrice.mul(ethAmountWei).div(ethers.utils.parseEther('1'));
      console.log(`  ⚠️ Using fallback price: ${ethers.utils.formatUnits(expectedTokens, 18)} tokens`);
    }
    
    console.log(`  📊 Expected tokens: ${ethers.utils.formatUnits(expectedTokens, 18)}`);
    console.log(`  🔍 Debug - Expected tokens wei: ${expectedTokens.toString()}`);
    
    // DEFAULT 20% SLIPPAGE for all micro-cap token trades
    const slippageBps = 2000; // 20% default slippage
    
    console.log(`  🎯 DEFAULT SLIPPAGE: Using 20% for all trades (micro-cap optimized)`);
    
    console.log(`  🎯 Adaptive slippage: ${slippageBps/100}% (${slippageBps} bps)`);
    
    // Calculate minimum output with slippage protection
    const minOut = expectedTokens.mul(10000 - slippageBps).div(10000);
    console.log(`  🛡️ Minimum output: ${ethers.utils.formatUnits(minOut, 18)} tokens`);
    console.log(`  🔍 Debug - MinOut wei: ${minOut.toString()}`);
    
    // Safety check - ensure minOut is not zero
    if (minOut.eq(0)) {
      console.log(`  ⚠️ WARNING: minOut is 0! Using fallback calculation...`);
      // Fallback: Calculate a reasonable minimum (0.001 ETH should get at least 30 TONY with 20% slippage)
      const fallbackMinOut = ethers.utils.parseUnits('27', 18); // 20% slippage from ~34 TONY
      console.log(`  🔄 Using fallback minOut: ${ethers.utils.formatUnits(fallbackMinOut, 18)} tokens`);
      
      // Fresh deadline (5 minutes from now)
      const deadline = Math.floor(Date.now() / 1000) + 300;
      
      // Build path data (WETH -> Token with fee tier)
      const path = ethers.utils.solidityPack(
        ['address', 'uint24', 'address'],
        [this.WETH, poolData.feeTier, tokenAddress]
      );
      
      return {
        param1: 0x0a,                    // Route ID (keep same)
        param2: 0x100,                   // Path offset (keep same)
        param3: ethAmountWei,            // ✅ ETH amount in wei
        param4: fallbackMinOut,          // ✅ Fallback minimum output
        param5: 0x0,                     // Flags
        param6: 0x0,                     // Flags
        param7: slippageBps,             // ✅ 20% slippage
        param8: deadline,                // ✅ Fresh deadline
        path: path,                      // ✅ Optimal path with fee tier
        expectedTokens: expectedTokens.gt(0) ? expectedTokens : fallbackMinOut.mul(125).div(100),
        slippagePercent: slippageBps / 100
      };
    }
    
    // Fresh deadline (5 minutes from now)
    const deadline = Math.floor(Date.now() / 1000) + 300;
    console.log(`  ⏰ Deadline: ${new Date(deadline * 1000).toISOString()}`);
    
    // Build path data (WETH -> Token with fee tier)
    const path = ethers.utils.solidityPack(
      ['address', 'uint24', 'address'],
      [this.WETH, poolData.feeTier, tokenAddress]
    );
    
    return {
      param1: 0x0a,                    // Route ID (keep same)
      param2: 0x100,                   // Path offset (keep same)
      param3: ethAmountWei,            // ✅ ETH amount in wei
      param4: minOut,                  // ✅ Calculated minimum output
      param5: 0x0,                     // Flags
      param6: 0x0,                     // Flags
      param7: slippageBps,             // ✅ Adaptive slippage
      param8: deadline,                // ✅ Fresh deadline
      path: path,                      // ✅ Optimal path with fee tier
      expectedTokens: expectedTokens,
      slippagePercent: slippageBps / 100
    };
  }
  
  /**
   * EXECUTE ADAPTIVE SNIPER
   * Builds and executes the transaction with calculated parameters
   */
  async executeAdaptiveSniper(wallet, params, tokenInfo, amountETH) {
    console.log(`  🚀 Executing adaptive sniper transaction...`);
    
    // Build input data for execBuy()
    const inputData = this.buildExecBuyInputData(params);
    
    try {
      // Method 1: Direct transaction with calculated parameters
      console.log(`    🎯 Method 1: Direct adaptive execBuy...`);
      
      const txParams = {
        to: this.SNIPER_CONTRACT,
        value: ethers.utils.parseEther(amountETH.toString()),
        data: inputData,
        gasLimit: 800000, // Higher gas limit for sniper contracts (800k)
        gasPrice: (await this.provider.getGasPrice()).mul(150).div(100) // 50% higher gas price
      };
      
      // Estimate gas
      try {
        const gasEstimate = await wallet.estimateGas(txParams);
        txParams.gasLimit = gasEstimate.mul(130).div(100); // 30% buffer
        console.log(`    ✅ Gas estimate: ${gasEstimate.toString()}`);
      } catch (gasError) {
        console.log(`    ⚠️ Gas estimation failed, using default: ${gasError.message}`);
      }
      
      const tx = await wallet.sendTransaction(txParams);
      console.log(`    📝 Adaptive sniper transaction: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`    ✅ Confirmed: ${receipt.gasUsed.toString()} gas used`);
      
      return await this.checkResults(wallet, tokenInfo, tx.hash, receipt, params);
      
    } catch (error) {
      console.log(`    ❌ Adaptive sniper failed: ${error.message}`);
      
      // Method 2: Retry with higher slippage
      try {
        console.log(`    🔄 Method 2: Retry with higher slippage...`);
        
        // Increase slippage by 5% (for micro-cap tokens)
        const higherSlippage = params.param7 + 500;
        const newMinOut = params.expectedTokens.mul(10000 - higherSlippage).div(10000);
        
        const retryParams = { ...params, param7: higherSlippage, param4: newMinOut };
        const retryInputData = this.buildExecBuyInputData(retryParams);
        
        console.log(`    📊 Increased slippage to ${higherSlippage/100}%`);
        
        const retryTx = await wallet.sendTransaction({
          to: this.SNIPER_CONTRACT,
          value: ethers.utils.parseEther(amountETH.toString()),
          data: retryInputData,
          gasLimit: 800000,
          gasPrice: (await this.provider.getGasPrice()).mul(180).div(100) // Even higher gas
        });
        
        console.log(`    📝 Retry transaction: ${retryTx.hash}`);
        const retryReceipt = await retryTx.wait();
        
        return await this.checkResults(wallet, tokenInfo, retryTx.hash, retryReceipt, retryParams);
        
      } catch (retryError) {
        return {
          success: false,
          error: `All adaptive methods failed. Last error: ${retryError.message}`,
          method: 'adaptive-sniper-all-failed',
          txHash: tx?.hash,
          sniperContract: this.SNIPER_CONTRACT
        };
      }
    }
  }
  
  /**
   * BUILD EXECBUY INPUT DATA
   */
  buildExecBuyInputData(params) {
    const selector = '0xc981cc3c';
    
    // Convert parameters to hex strings (64 chars each)
    const param1Hex = ethers.BigNumber.from(params.param1).toHexString().padStart(64, '0');
    const param2Hex = ethers.BigNumber.from(params.param2).toHexString().padStart(64, '0');
    const param3Hex = params.param3.toHexString().padStart(64, '0');
    const param4Hex = params.param4.toHexString().padStart(64, '0');
    const param5Hex = ethers.BigNumber.from(params.param5).toHexString().padStart(64, '0');
    const param6Hex = ethers.BigNumber.from(params.param6).toHexString().padStart(64, '0');
    const param7Hex = ethers.BigNumber.from(params.param7).toHexString().padStart(64, '0');
    const param8Hex = ethers.BigNumber.from(params.param8).toHexString().padStart(64, '0');
    
    // Path data (remove 0x prefix)
    const pathHex = params.path.slice(2);
    
    // Combine all parts
    const fullInputData = selector + 
      param1Hex.replace('0x', '') +
      param2Hex.replace('0x', '') +
      param3Hex.replace('0x', '') +
      param4Hex.replace('0x', '') +
      param5Hex.replace('0x', '') +
      param6Hex.replace('0x', '') +
      param7Hex.replace('0x', '') +
      param8Hex.replace('0x', '') +
      pathHex;
    
    console.log(`    🔧 Input data built: ${fullInputData.length} characters`);
    console.log(`    📊 ETH amount: ${ethers.utils.formatEther(params.param3)} ETH`);
    console.log(`    🛡️ Min output: ${ethers.utils.formatUnits(params.param4, 18)} tokens`);
    console.log(`    🎯 Slippage: ${params.param7/100}%`);
    
    return fullInputData;
  }
  
  /**
   * CHECK RESULTS
   */
  async checkResults(wallet, tokenInfo, txHash, receipt, params) {
    console.log(`  🔍 Checking adaptive sniper results...`);
    
    // Check token balance after transaction
    const token = new ethers.Contract(tokenInfo.address, this.ERC20_ABI, wallet);
    const balanceAfter = await token.balanceOf(wallet.address);
    const tokensReceived = balanceAfter.sub(tokenInfo.balanceBefore);
    
    if (tokensReceived.gt(0)) {
      console.log(`  🎉 ADAPTIVE SNIPER SUCCESS!`);
      console.log(`  📊 Tokens received: ${ethers.utils.formatUnits(tokensReceived, tokenInfo.decimals)} ${tokenInfo.symbol}`);
      console.log(`  💰 Expected: ${ethers.utils.formatUnits(params.expectedTokens, 18)}`);
      console.log(`  🎯 Slippage used: ${params.slippagePercent}%`);
      
      return {
        success: true,
        txHash: txHash,
        gasUsed: receipt.gasUsed.toString(),
        tokensReceived: ethers.utils.formatUnits(tokensReceived, tokenInfo.decimals),
        expectedTokens: ethers.utils.formatUnits(params.expectedTokens, 18),
        slippageUsed: params.slippagePercent,
        method: 'adaptive-sniper-success',
        blockNumber: receipt.blockNumber,
        tokenInfo: tokenInfo,
        sniperContract: this.SNIPER_CONTRACT
      };
    } else {
      return {
        success: false,
        error: 'Transaction succeeded but no tokens received',
        method: 'adaptive-sniper-no-tokens',
        txHash: txHash,
        sniperContract: this.SNIPER_CONTRACT
      };
    }
  }
}

module.exports = DynamicSniperSystem;