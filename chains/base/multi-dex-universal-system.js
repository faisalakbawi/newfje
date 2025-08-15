/**
 * MULTI-DEX UNIVERSAL TRADING SYSTEM
 * Tries EVERY DEX and method until it finds one that works
 * NEVER gives up - keeps trying until successful
 */

const { ethers } = require('ethers');

class MultiDexUniversalSystem {
  constructor(provider) {
    this.provider = provider;
    
    // ALL DEXs on Base chain
    this.dexes = [
      {
        name: 'Uniswap V3',
        router: '0x2626664c2603336E57B271c5C0b26F421741e481',
        factory: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
        type: 'v3',
        fees: [100, 500, 3000, 10000], // 0.01%, 0.05%, 0.3%, 1%
        priority: 1
      },
      {
        name: 'SushiSwap',
        router: '0x6BDED42c6DA8FBf0d2bA55B2fa120C5e0c8D7891',
        factory: '0x71524B4f93c58fcbF659783284E38825f0622859',
        type: 'v2',
        fees: [3000], // 0.3% standard
        priority: 2
      },
      {
        name: 'PancakeSwap',
        router: '0x678Aa4bF4E210cf2166753e054d5b7c31cc7fa86',
        factory: '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865',
        type: 'v2',
        fees: [2500], // 0.25% standard
        priority: 3
      },
      {
        name: 'BaseSwap',
        router: '0x327Df1E6de05895d2ab08513aaDD9313Fe505d86',
        factory: '0xFDa619b6d20975be80A10332cD39b9a4b0FAa8BB',
        type: 'v2',
        fees: [3000], // 0.3% standard
        priority: 4
      },
      {
        name: 'Aerodrome',
        router: '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43',
        factory: '0x420DD381b31aEf6683db6B902084cB0FFECe40Da',
        type: 'v2',
        fees: [3000],
        priority: 5
      }
    ];
    
    this.WETH = '0x4200000000000000000000000000000000000006';
    
    // Universal ABIs
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
        'function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable',
        'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
        'function factory() external pure returns (address)',
        'function WETH() external pure returns (address)'
      ],
      
      UNISWAP_V2_FACTORY: [
        'function getPair(address tokenA, address tokenB) external view returns (address pair)'
      ],
      
      UNISWAP_V3_FACTORY: [
        'function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)'
      ],
      
      PAIR: [
        'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
        'function token0() external view returns (address)',
        'function token1() external view returns (address)'
      ]
    };
  }
  
  /**
   * UNIVERSAL EXEC BUY - TRIES ALL DEXs UNTIL SUCCESS
   */
  async execBuy(walletPrivateKey, tokenAddress, amountETH) {
    console.log(`🌐 ========== MULTI-DEX UNIVERSAL SYSTEM ==========`);
    console.log(`🎯 Token: ${tokenAddress}`);
    console.log(`💰 Amount: ${amountETH} ETH`);
    console.log(`🚀 Strategy: Try EVERY DEX until one works!`);
    
    const wallet = new ethers.Wallet(walletPrivateKey, this.provider);
    console.log(`👤 Wallet: ${wallet.address}`);
    
    // Get token info
    const token = new ethers.Contract(tokenAddress, this.abis.ERC20, wallet);
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
    
    // Get initial balance
    const balanceBefore = await token.balanceOf(wallet.address);
    console.log(`📊 ${tokenInfo.symbol} balance before: ${ethers.utils.formatUnits(balanceBefore, tokenInfo.decimals)}`);
    
    // Sort DEXs by priority
    const sortedDexes = [...this.dexes].sort((a, b) => a.priority - b.priority);
    
    console.log(`\n🔄 Trying ${sortedDexes.length} DEXs in order of priority...`);
    
    // Try each DEX until one works
    for (let i = 0; i < sortedDexes.length; i++) {
      const dex = sortedDexes[i];
      console.log(`\n📍 [${i + 1}/${sortedDexes.length}] Trying ${dex.name}...`);
      
      try {
        const result = await this.tryDex(wallet, dex, tokenAddress, amountETH, tokenInfo, balanceBefore);
        
        if (result.success) {
          console.log(`🎉 SUCCESS on ${dex.name}!`);
          return result;
        } else {
          console.log(`❌ ${dex.name} failed: ${result.error}`);
        }
        
      } catch (error) {
        console.log(`❌ ${dex.name} error: ${error.message}`);
      }
    }
    
    // If all DEXs fail, try alternative methods
    console.log(`\n🔧 All DEXs failed, trying alternative methods...`);
    
    try {
      return await this.tryAlternativeMethods(wallet, tokenAddress, amountETH, tokenInfo, balanceBefore);
    } catch (error) {
      return {
        success: false,
        error: `All methods failed. Last error: ${error.message}`,
        method: 'universal-all-failed',
        dexesTried: sortedDexes.length
      };
    }
  }
  
  /**
   * TRY SPECIFIC DEX
   */
  async tryDex(wallet, dex, tokenAddress, amountETH, tokenInfo, balanceBefore) {
    console.log(`  🔍 Checking ${dex.name} (${dex.type})...`);
    
    // Check if router exists
    const routerCode = await this.provider.getCode(dex.router);
    if (routerCode === '0x') {
      return { success: false, error: 'Router contract does not exist' };
    }
    
    if (dex.type === 'v3') {
      return await this.tryUniswapV3(wallet, dex, tokenAddress, amountETH, tokenInfo, balanceBefore);
    } else if (dex.type === 'v2') {
      return await this.tryUniswapV2(wallet, dex, tokenAddress, amountETH, tokenInfo, balanceBefore);
    }
    
    return { success: false, error: 'Unknown DEX type' };
  }
  
  /**
   * TRY UNISWAP V3 STYLE DEX
   */
  async tryUniswapV3(wallet, dex, tokenAddress, amountETH, tokenInfo, balanceBefore) {
    const router = new ethers.Contract(dex.router, this.abis.UNISWAP_V3_ROUTER, wallet);
    
    // Try each fee tier
    for (const fee of dex.fees) {
      console.log(`    💸 Trying ${fee / 10000}% fee...`);
      
      try {
        // Method 1: exactInputSingle
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
        
        const gasEstimate = await router.estimateGas.exactInputSingle(params, {
          value: ethers.utils.parseEther(amountETH.toString())
        });
        
        console.log(`      ✅ Gas estimate: ${gasEstimate.toString()}`);
        
        const tx = await router.exactInputSingle(params, {
          value: ethers.utils.parseEther(amountETH.toString()),
          gasLimit: gasEstimate.mul(120).div(100),
          gasPrice: await this.provider.getGasPrice()
        });
        
        console.log(`      📝 Transaction: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`      ✅ Confirmed: ${receipt.gasUsed.toString()} gas`);
        
        return await this.checkTokensReceived(wallet, tokenAddress, balanceBefore, tokenInfo, tx.hash, receipt, dex.name);
        
      } catch (error) {
        console.log(`      ❌ ${fee / 10000}% fee failed: ${error.message}`);
        
        // Try exactInput method
        try {
          console.log(`      🛤️ Trying exactInput path...`);
          
          const path = ethers.utils.solidityPack(
            ['address', 'uint24', 'address'],
            [this.WETH, fee, tokenAddress]
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
          
          console.log(`      📝 Path transaction: ${tx2.hash}`);
          const receipt2 = await tx2.wait();
          
          return await this.checkTokensReceived(wallet, tokenAddress, balanceBefore, tokenInfo, tx2.hash, receipt2, dex.name);
          
        } catch (pathError) {
          console.log(`      ❌ Path method also failed: ${pathError.message}`);
        }
      }
    }
    
    return { success: false, error: 'All V3 fee tiers failed' };
  }
  
  /**
   * TRY UNISWAP V2 STYLE DEX
   */
  async tryUniswapV2(wallet, dex, tokenAddress, amountETH, tokenInfo, balanceBefore) {
    const router = new ethers.Contract(dex.router, this.abis.UNISWAP_V2_ROUTER, wallet);
    
    try {
      // Check if pair exists
      const factory = new ethers.Contract(dex.factory, this.abis.UNISWAP_V2_FACTORY, this.provider);
      const pairAddress = await factory.getPair(this.WETH, tokenAddress);
      
      if (pairAddress === ethers.constants.AddressZero) {
        return { success: false, error: 'No pair exists on this DEX' };
      }
      
      console.log(`    🏊 Pair found: ${pairAddress}`);
      
      // Check pair liquidity
      const pair = new ethers.Contract(pairAddress, this.abis.PAIR, this.provider);
      const [reserves, token0] = await Promise.all([
        pair.getReserves(),
        pair.token0()
      ]);
      
      const isWETHToken0 = token0.toLowerCase() === this.WETH.toLowerCase();
      const wethReserve = isWETHToken0 ? reserves.reserve0 : reserves.reserve1;
      const tokenReserve = isWETHToken0 ? reserves.reserve1 : reserves.reserve0;
      
      console.log(`    💧 Reserves: ${ethers.utils.formatEther(wethReserve)} WETH, ${ethers.utils.formatUnits(tokenReserve, tokenInfo.decimals)} ${tokenInfo.symbol}`);
      
      if (wethReserve.eq(0) || tokenReserve.eq(0)) {
        return { success: false, error: 'Pair has no liquidity' };
      }
      
      // Try standard swap
      const path = [this.WETH, tokenAddress];
      
      try {
        console.log(`    🔄 Trying standard swap...`);
        
        const gasEstimate = await router.estimateGas.swapExactETHForTokens(
          0, // Accept any amount
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
        
        return await this.checkTokensReceived(wallet, tokenAddress, balanceBefore, tokenInfo, tx.hash, receipt, dex.name);
        
      } catch (standardError) {
        console.log(`    ❌ Standard swap failed: ${standardError.message}`);
        
        // Try fee-on-transfer version
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
          
          return await this.checkTokensReceived(wallet, tokenAddress, balanceBefore, tokenInfo, tx2.hash, receipt2, dex.name);
          
        } catch (feeError) {
          console.log(`    ❌ Fee-on-transfer also failed: ${feeError.message}`);
        }
      }
      
    } catch (error) {
      return { success: false, error: `V2 DEX failed: ${error.message}` };
    }
    
    return { success: false, error: 'All V2 methods failed' };
  }
  
  /**
   * TRY ALTERNATIVE METHODS
   */
  async tryAlternativeMethods(wallet, tokenAddress, amountETH, tokenInfo, balanceBefore) {
    console.log(`  🔧 Trying alternative methods...`);
    
    // Method 1: Direct transfer (if token has special mechanics)
    try {
      console.log(`    💸 Trying direct ETH transfer to token contract...`);
      
      const tx = await wallet.sendTransaction({
        to: tokenAddress,
        value: ethers.utils.parseEther(amountETH.toString()),
        gasLimit: 100000
      });
      
      const receipt = await tx.wait();
      const result = await this.checkTokensReceived(wallet, tokenAddress, balanceBefore, tokenInfo, tx.hash, receipt, 'Direct Transfer');
      
      if (result.success) {
        return result;
      }
      
    } catch (error) {
      console.log(`    ❌ Direct transfer failed: ${error.message}`);
    }
    
    // Method 2: Try with different gas settings
    try {
      console.log(`    ⛽ Trying Uniswap V3 with manual gas...`);
      
      const router = new ethers.Contract(this.dexes[0].router, this.abis.UNISWAP_V3_ROUTER, wallet);
      
      const params = {
        tokenIn: this.WETH,
        tokenOut: tokenAddress,
        fee: 10000,
        recipient: wallet.address,
        deadline: Math.floor(Date.now() / 1000) + 300,
        amountIn: ethers.utils.parseEther(amountETH.toString()),
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0
      };
      
      const tx = await router.exactInputSingle(params, {
        value: ethers.utils.parseEther(amountETH.toString()),
        gasLimit: 500000, // High gas limit
        gasPrice: (await this.provider.getGasPrice()).mul(150).div(100) // 50% higher gas price
      });
      
      const receipt = await tx.wait();
      return await this.checkTokensReceived(wallet, tokenAddress, balanceBefore, tokenInfo, tx.hash, receipt, 'Manual Gas');
      
    } catch (error) {
      console.log(`    ❌ Manual gas failed: ${error.message}`);
    }
    
    throw new Error('All alternative methods failed');
  }
  
  /**
   * CHECK TOKENS RECEIVED
   */
  async checkTokensReceived(wallet, tokenAddress, balanceBefore, tokenInfo, txHash, receipt, dexName) {
    const token = new ethers.Contract(tokenAddress, this.abis.ERC20, wallet);
    const balanceAfter = await token.balanceOf(wallet.address);
    const tokensReceived = balanceAfter.sub(balanceBefore);
    
    if (tokensReceived.gt(0)) {
      console.log(`    🎉 SUCCESS on ${dexName}!`);
      console.log(`    📊 Tokens received: ${ethers.utils.formatUnits(tokensReceived, tokenInfo.decimals)} ${tokenInfo.symbol}`);
      
      return {
        success: true,
        txHash: txHash,
        gasUsed: receipt.gasUsed.toString(),
        tokensReceived: ethers.utils.formatUnits(tokensReceived, tokenInfo.decimals),
        method: `multi-dex-${dexName.toLowerCase().replace(/\s+/g, '-')}`,
        blockNumber: receipt.blockNumber,
        tokenInfo: tokenInfo,
        dexUsed: dexName
      };
    } else {
      return {
        success: false,
        error: `Transaction succeeded on ${dexName} but no tokens received`,
        method: `${dexName.toLowerCase()}-no-tokens`,
        txHash: txHash
      };
    }
  }
}

module.exports = MultiDexUniversalSystem;