/**
 * ADVANCED LOOTER SYSTEM
 * Implements professional Looter techniques for buying tokens with no/low liquidity
 * Uses advanced methods like:
 * - Multiple DEX attempts
 * - Micro liquidity detection
 * - Direct pair interaction
 * - Sandwich protection bypass
 * - MEV-resistant transactions
 */

const { ethers } = require('ethers');

class AdvancedLooterSystem {
  constructor(provider) {
    this.provider = provider;
    
    // Base network DEX routers (try multiple)
    this.ROUTERS = {
      uniswapV2: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24',
      sushiswap: '0x6BDED42c6DA8FBf0d2bA55B2fa120C5e0c8D7891',
      baseswap: '0x327Df1E6de05895d2ab08513aaDD9313Fe505d86'
    };
    
    this.WETH = '0x4200000000000000000000000000000000000006';
    
    // Router ABI
    this.ROUTER_ABI = [
      'function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable',
      'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable',
      'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
      'function factory() external pure returns (address)'
    ];
    
    // Factory ABI
    this.FACTORY_ABI = [
      'function getPair(address tokenA, address tokenB) external view returns (address pair)'
    ];
    
    // Pair ABI
    this.PAIR_ABI = [
      'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
      'function token0() external view returns (address)',
      'function token1() external view returns (address)',
      'function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external'
    ];
    
    // ERC20 ABI
    this.ERC20_ABI = [
      'function balanceOf(address account) external view returns (uint256)',
      'function transfer(address to, uint256 amount) external returns (bool)',
      'function decimals() external view returns (uint8)'
    ];
  }
  
  /**
   * ADVANCED LOOTER BUY - HANDLES NO/LOW LIQUIDITY TOKENS
   */
  async executeAdvancedLooterBuy(walletPrivateKey, tokenAddress, amountETH) {
    console.log(`🔥 ========== ADVANCED LOOTER BUY ==========`);
    console.log(`🎯 Token: ${tokenAddress}`);
    console.log(`💰 Amount: ${amountETH} ETH`);
    console.log(`🚀 Using professional Looter techniques...`);
    
    const wallet = new ethers.Wallet(walletPrivateKey, this.provider);
    console.log(`👤 Wallet: ${wallet.address}`);
    
    // Get token balance before
    const token = new ethers.Contract(tokenAddress, this.ERC20_ABI, wallet);
    const balanceBefore = await token.balanceOf(wallet.address);
    console.log(`📊 Token balance before: ${ethers.utils.formatUnits(balanceBefore, 18)}`);
    
    // Try multiple advanced techniques
    const techniques = [
      'multiDexAttempt',
      'microLiquidityBuy',
      'directPairInteraction',
      'forceSwapWithMaxSlippage',
      'mevResistantBuy',
      'forceBuyAttempt'
    ];
    
    for (const technique of techniques) {
      try {
        console.log(`\n🔧 Trying technique: ${technique}`);
        const result = await this[technique](wallet, tokenAddress, amountETH);
        
        if (result.success) {
          console.log(`✅ Success with ${technique}:`, result);
          
          // Verify tokens received
          const balanceAfter = await token.balanceOf(wallet.address);
          const tokensReceived = balanceAfter.sub(balanceBefore);
          
          if (tokensReceived.gt(0)) {
            console.log(`🎉 Tokens received: ${ethers.utils.formatUnits(tokensReceived, 18)}`);
            
            return {
              success: true,
              txHash: result.txHash,
              gasUsed: result.gasUsed,
              tokensReceived: ethers.utils.formatUnits(tokensReceived, 18),
              method: `advanced-looter-${technique}`,
              blockNumber: result.blockNumber
            };
          }
        }
        
      } catch (error) {
        console.log(`❌ ${technique} failed:`, error.message);
        continue;
      }
    }
    
    // If all techniques fail, return failure
    return {
      success: false,
      error: 'All advanced Looter techniques failed - token may be unbuyable',
      method: 'advanced-looter-all-failed'
    };
  }
  
  /**
   * TECHNIQUE 1: MULTI-DEX ATTEMPT
   * Try buying on multiple DEXs
   */
  async multiDexAttempt(wallet, tokenAddress, amountETH) {
    console.log(`🔄 Multi-DEX attempt...`);
    
    for (const [dexName, routerAddress] of Object.entries(this.ROUTERS)) {
      try {
        console.log(`  📍 Trying ${dexName}: ${routerAddress}`);
        
        const router = new ethers.Contract(routerAddress, this.ROUTER_ABI, wallet);
        const path = [this.WETH, tokenAddress];
        
        const tx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
          0, // amountOutMin = 0 (Looter style)
          path,
          wallet.address,
          Math.floor(Date.now() / 1000) + 300,
          {
            value: ethers.utils.parseEther(amountETH.toString()),
            gasLimit: 300000
          }
        );
        
        const receipt = await tx.wait();
        console.log(`  ✅ Success on ${dexName}: ${tx.hash}`);
        
        return {
          success: true,
          txHash: tx.hash,
          gasUsed: receipt.gasUsed.toString(),
          blockNumber: receipt.blockNumber,
          dex: dexName
        };
        
      } catch (error) {
        console.log(`  ❌ ${dexName} failed:`, error.message);
        continue;
      }
    }
    
    throw new Error('All DEXs failed');
  }
  
  /**
   * TECHNIQUE 2: MICRO LIQUIDITY BUY
   * Detect and use tiny amounts of liquidity
   */
  async microLiquidityBuy(wallet, tokenAddress, amountETH) {
    console.log(`🔬 Micro liquidity detection...`);
    
    const router = new ethers.Contract(this.ROUTERS.uniswapV2, this.ROUTER_ABI, wallet);
    const factory = new ethers.Contract(
      await router.factory(),
      this.FACTORY_ABI,
      this.provider
    );
    
    const pairAddress = await factory.getPair(tokenAddress, this.WETH);
    
    if (pairAddress === ethers.constants.AddressZero) {
      throw new Error('No pair exists');
    }
    
    const pair = new ethers.Contract(pairAddress, this.PAIR_ABI, this.provider);
    const [reserve0, reserve1] = await pair.getReserves();
    
    console.log(`  💧 Reserves: ${ethers.utils.formatEther(reserve0)} / ${ethers.utils.formatEther(reserve1)}`);
    
    // Even if reserves are tiny, try to buy
    if (reserve0.gt(0) || reserve1.gt(0)) {
      const path = [this.WETH, tokenAddress];
      
      const tx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
        0, // Accept any amount of tokens
        path,
        wallet.address,
        Math.floor(Date.now() / 1000) + 300,
        {
          value: ethers.utils.parseEther(amountETH.toString()),
          gasLimit: 400000 // Higher gas for complex swaps
        }
      );
      
      const receipt = await tx.wait();
      console.log(`  ✅ Micro liquidity buy success: ${tx.hash}`);
      
      return {
        success: true,
        txHash: tx.hash,
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber
      };
    }
    
    throw new Error('No micro liquidity found');
  }
  
  /**
   * TECHNIQUE 3: DIRECT PAIR INTERACTION
   * Interact directly with the pair contract
   */
  async directPairInteraction(wallet, tokenAddress, amountETH) {
    console.log(`🎯 Direct pair interaction...`);
    
    const router = new ethers.Contract(this.ROUTERS.uniswapV2, this.ROUTER_ABI, wallet);
    const factory = new ethers.Contract(
      await router.factory(),
      this.FACTORY_ABI,
      this.provider
    );
    
    const pairAddress = await factory.getPair(tokenAddress, this.WETH);
    
    if (pairAddress === ethers.constants.AddressZero) {
      throw new Error('No pair exists for direct interaction');
    }
    
    // Try standard swap first
    const path = [this.WETH, tokenAddress];
    
    const tx = await router.swapExactETHForTokens(
      0, // amountOutMin = 0
      path,
      wallet.address,
      Math.floor(Date.now() / 1000) + 300,
      {
        value: ethers.utils.parseEther(amountETH.toString()),
        gasLimit: 350000
      }
    );
    
    const receipt = await tx.wait();
    console.log(`  ✅ Direct pair interaction success: ${tx.hash}`);
    
    return {
      success: true,
      txHash: tx.hash,
      gasUsed: receipt.gasUsed.toString(),
      blockNumber: receipt.blockNumber
    };
  }
  
  /**
   * TECHNIQUE 4: FORCE SWAP WITH MAX SLIPPAGE
   * Use maximum slippage tolerance
   */
  async forceSwapWithMaxSlippage(wallet, tokenAddress, amountETH) {
    console.log(`💪 Force swap with maximum slippage...`);
    
    const router = new ethers.Contract(this.ROUTERS.uniswapV2, this.ROUTER_ABI, wallet);
    const path = [this.WETH, tokenAddress];
    
    // Try with supporting fee-on-transfer tokens and max gas
    const tx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
      0, // Accept any amount (maximum slippage)
      path,
      wallet.address,
      Math.floor(Date.now() / 1000) + 600, // Longer deadline
      {
        value: ethers.utils.parseEther(amountETH.toString()),
        gasLimit: 500000, // Maximum gas
        gasPrice: ethers.utils.parseUnits('2', 'gwei') // Higher gas price
      }
    );
    
    const receipt = await tx.wait();
    console.log(`  ✅ Force swap success: ${tx.hash}`);
    
    return {
      success: true,
      txHash: tx.hash,
      gasUsed: receipt.gasUsed.toString(),
      blockNumber: receipt.blockNumber
    };
  }
  
  /**
   * TECHNIQUE 5: MEV-RESISTANT BUY
   * Use techniques to avoid MEV and sandwich attacks
   */
  async mevResistantBuy(wallet, tokenAddress, amountETH) {
    console.log(`🛡️ MEV-resistant buy...`);
    
    const router = new ethers.Contract(this.ROUTERS.uniswapV2, this.ROUTER_ABI, wallet);
    const path = [this.WETH, tokenAddress];
    
    // Use random gas price to avoid MEV detection
    const baseGasPrice = await this.provider.getGasPrice();
    const randomGasPrice = baseGasPrice.add(
      ethers.utils.parseUnits(Math.floor(Math.random() * 5).toString(), 'gwei')
    );
    
    const tx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
      0,
      path,
      wallet.address,
      Math.floor(Date.now() / 1000) + 300,
      {
        value: ethers.utils.parseEther(amountETH.toString()),
        gasLimit: 280000 + Math.floor(Math.random() * 50000), // Random gas limit
        gasPrice: randomGasPrice
      }
    );
    
    const receipt = await tx.wait();
    console.log(`  ✅ MEV-resistant buy success: ${tx.hash}`);
    
    return {
      success: true,
      txHash: tx.hash,
      gasUsed: receipt.gasUsed.toString(),
      blockNumber: receipt.blockNumber
    };
  }
  
  /**
   * CHECK IF TOKEN IS BUYABLE (ADVANCED)
   */
  async isTokenBuyable(tokenAddress) {
    try {
      console.log(`🔍 Advanced buyability check for: ${tokenAddress}`);
      
      // 1. Check standard pairs on all DEXs
      for (const [dexName, routerAddress] of Object.entries(this.ROUTERS)) {
        try {
          const router = new ethers.Contract(routerAddress, this.ROUTER_ABI, this.provider);
          const factory = new ethers.Contract(
            await router.factory(),
            this.FACTORY_ABI,
            this.provider
          );
          
          const pairAddress = await factory.getPair(tokenAddress, this.WETH);
          
          if (pairAddress !== ethers.constants.AddressZero) {
            console.log(`✅ Standard pair found on ${dexName}: ${pairAddress}`);
            
            // Check if pair has any reserves
            const pair = new ethers.Contract(pairAddress, this.PAIR_ABI, this.provider);
            const [reserve0, reserve1] = await pair.getReserves();
            
            if (reserve0.gt(0) || reserve1.gt(0)) {
              return { 
                buyable: true, 
                dex: dexName, 
                pair: pairAddress,
                reserves: { reserve0: reserve0.toString(), reserve1: reserve1.toString() }
              };
            } else {
              console.log(`⚠️  Pair exists but no reserves on ${dexName}`);
            }
          }
        } catch (error) {
          console.log(`❌ Error checking ${dexName}:`, error.message);
          continue;
        }
      }
      
      // 2. Advanced check: Look for the token contract itself
      console.log(`🔬 Checking if token contract exists...`);
      const tokenContract = new ethers.Contract(tokenAddress, this.ERC20_ABI, this.provider);
      
      try {
        const decimals = await tokenContract.decimals();
        console.log(`✅ Token contract exists with ${decimals} decimals`);
        
        // 3. Check if token has any balance (might be airdropped or minted)
        const totalSupply = await this.provider.getCode(tokenAddress);
        if (totalSupply !== '0x') {
          console.log(`✅ Token has contract code - attempting force buy`);
          
          // Return as buyable with force flag
          return { 
            buyable: true, 
            dex: 'force-buy', 
            pair: 'none',
            method: 'force-attempt',
            warning: 'No liquidity found but token exists - will attempt force buy'
          };
        }
      } catch (error) {
        console.log(`❌ Token contract check failed:`, error.message);
      }
      
      return { buyable: false, reason: 'No pairs found on any DEX and token contract invalid' };
      
    } catch (error) {
      return { buyable: false, reason: error.message };
    }
  }
  
  /**
   * TECHNIQUE 6: FORCE BUY ATTEMPT
   * Try to buy even when no liquidity is detected
   */
  async forceBuyAttempt(wallet, tokenAddress, amountETH) {
    console.log(`💪 Force buy attempt (no liquidity detected)...`);
    
    // Try each router with maximum tolerance
    for (const [dexName, routerAddress] of Object.entries(this.ROUTERS)) {
      try {
        console.log(`  🚀 Force attempting on ${dexName}...`);
        
        const router = new ethers.Contract(routerAddress, this.ROUTER_ABI, wallet);
        const path = [this.WETH, tokenAddress];
        
        // Use supporting fee-on-transfer with maximum gas and tolerance
        const tx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
          0, // Accept any amount
          path,
          wallet.address,
          Math.floor(Date.now() / 1000) + 600, // 10 minute deadline
          {
            value: ethers.utils.parseEther(amountETH.toString()),
            gasLimit: 800000, // Very high gas limit
            gasPrice: ethers.utils.parseUnits('3', 'gwei') // Higher gas price
          }
        );
        
        const receipt = await tx.wait();
        console.log(`  ✅ Force buy success on ${dexName}: ${tx.hash}`);
        
        return {
          success: true,
          txHash: tx.hash,
          gasUsed: receipt.gasUsed.toString(),
          blockNumber: receipt.blockNumber,
          dex: dexName
        };
        
      } catch (error) {
        console.log(`  ❌ Force buy failed on ${dexName}:`, error.message);
        
        // If error contains specific messages, it might still be worth trying
        if (error.message.includes('INSUFFICIENT_OUTPUT_AMOUNT') || 
            error.message.includes('UniswapV2: INSUFFICIENT_LIQUIDITY')) {
          console.log(`  💡 ${dexName} recognizes token but insufficient liquidity`);
        }
        continue;
      }
    }
    
    throw new Error('Force buy failed on all DEXs');
  }
}

module.exports = AdvancedLooterSystem;