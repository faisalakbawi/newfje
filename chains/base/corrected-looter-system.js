/**
 * CORRECTED LOOTER SYSTEM
 * Fixed the token order issue discovered in comprehensive test
 * Token0: TONY, Token1: WETH (not WETH/TONY as we assumed!)
 */

const { ethers } = require('ethers');

class CorrectedLooterSystem {
  constructor(provider) {
    this.provider = provider;
    
    // Addresses
    this.UNISWAP_V3_ROUTER = '0x2626664c2603336E57B271c5C0b26F421741e481';
    this.WETH = '0x4200000000000000000000000000000000000006';
    this.TONY_TOKEN = '0x36a947baa2492c72bf9d3307117237e79145a87d';
    this.TONY_POOL = '0x89649AF832915FF8F24100a58b6A6FBc498de911';
    
    // CORRECTED: Token0 = TONY, Token1 = WETH
    this.TOKEN_ORDER = {
      token0: this.TONY_TOKEN,
      token1: this.WETH,
      isWETHToken0: false // WETH is Token1, not Token0!
    };
    
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
   * CORRECTED EXEC BUY - WITH PROPER TOKEN ORDER
   */
  async execBuy(walletPrivateKey, tokenAddress, amountETH) {
    console.log(`🔧 ========== CORRECTED LOOTER SYSTEM ==========`);
    console.log(`🎯 Token: ${tokenAddress}`);
    console.log(`💰 Amount: ${amountETH} ETH`);
    console.log(`🔧 CORRECTION: Token0=TONY, Token1=WETH (reversed!)`);
    
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
      // Check if this is TONY token
      if (tokenAddress.toLowerCase() === this.TONY_TOKEN.toLowerCase()) {
        console.log(`\n🎯 TONY TOKEN - Using corrected method`);
        return await this.executeCorrectedTonySwap(wallet, amountETH, tokenInfo, balanceBefore);
      }
      
      // For other tokens, use generic method
      console.log(`\n🔍 OTHER TOKEN - Using generic corrected method`);
      return await this.executeCorrectedGenericSwap(wallet, tokenAddress, amountETH, tokenInfo, balanceBefore);
      
    } catch (error) {
      console.error(`❌ Corrected exec buy failed:`, error.message);
      return {
        success: false,
        error: error.message,
        method: 'corrected-error'
      };
    }
  }
  
  /**
   * EXECUTE CORRECTED TONY SWAP
   */
  async executeCorrectedTonySwap(wallet, amountETH, tokenInfo, balanceBefore) {
    console.log(`  🔧 Executing CORRECTED TONY swap...`);
    console.log(`  📊 Correction: WETH (Token1) → TONY (Token0)`);
    
    const router = new ethers.Contract(this.UNISWAP_V3_ROUTER, this.ROUTER_ABI, wallet);
    
    // Method 1: exactInputSingle with CORRECTED token order
    console.log(`  🎯 Method 1: exactInputSingle (corrected)`);
    
    const params1 = {
      tokenIn: this.WETH,        // Input: WETH (Token1)
      tokenOut: this.TONY_TOKEN, // Output: TONY (Token0)
      fee: 10000,                // 1% fee
      recipient: wallet.address,
      deadline: Math.floor(Date.now() / 1000) + 300,
      amountIn: ethers.utils.parseEther(amountETH.toString()),
      amountOutMinimum: 0,       // Accept any amount
      sqrtPriceLimitX96: 0
    };
    
    try {
      const gasEstimate1 = await router.estimateGas.exactInputSingle(params1, {
        value: ethers.utils.parseEther(amountETH.toString())
      });
      
      console.log(`    ✅ Method 1 gas estimate: ${gasEstimate1.toString()}`);
      
      const tx = await router.exactInputSingle(params1, {
        value: ethers.utils.parseEther(amountETH.toString()),
        gasLimit: gasEstimate1.mul(120).div(100),
        gasPrice: await this.provider.getGasPrice()
      });
      
      console.log(`    📝 Transaction: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`    ✅ Confirmed: ${receipt.gasUsed.toString()} gas`);
      
      return await this.checkTokensReceived(wallet, balanceBefore, tokenInfo, tx.hash, receipt);
      
    } catch (error1) {
      console.log(`    ❌ Method 1 failed: ${error1.message}`);
      
      // Method 2: exactInput with CORRECTED path
      console.log(`  🎯 Method 2: exactInput with corrected path`);
      
      // CORRECTED path: WETH (Token1) → fee → TONY (Token0)
      const correctedPath = ethers.utils.solidityPack(
        ['address', 'uint24', 'address'],
        [this.WETH, 10000, this.TONY_TOKEN]
      );
      
      console.log(`    🛤️ Corrected path: ${correctedPath}`);
      
      const params2 = {
        path: correctedPath,
        recipient: wallet.address,
        deadline: Math.floor(Date.now() / 1000) + 300,
        amountIn: ethers.utils.parseEther(amountETH.toString()),
        amountOutMinimum: 0
      };
      
      try {
        const gasEstimate2 = await router.estimateGas.exactInput(params2, {
          value: ethers.utils.parseEther(amountETH.toString())
        });
        
        console.log(`    ✅ Method 2 gas estimate: ${gasEstimate2.toString()}`);
        
        const tx2 = await router.exactInput(params2, {
          value: ethers.utils.parseEther(amountETH.toString()),
          gasLimit: gasEstimate2.mul(120).div(100),
          gasPrice: await this.provider.getGasPrice()
        });
        
        console.log(`    📝 Transaction: ${tx2.hash}`);
        const receipt2 = await tx2.wait();
        console.log(`    ✅ Confirmed: ${receipt2.gasUsed.toString()} gas`);
        
        return await this.checkTokensReceived(wallet, balanceBefore, tokenInfo, tx2.hash, receipt2);
        
      } catch (error2) {
        console.log(`    ❌ Method 2 failed: ${error2.message}`);
        
        // Method 3: Try with manual gas limit
        console.log(`  🎯 Method 3: Manual gas limit`);
        
        try {
          const tx3 = await router.exactInputSingle(params1, {
            value: ethers.utils.parseEther(amountETH.toString()),
            gasLimit: 300000, // Manual gas limit
            gasPrice: await this.provider.getGasPrice()
          });
          
          console.log(`    📝 Manual gas transaction: ${tx3.hash}`);
          const receipt3 = await tx3.wait();
          console.log(`    ✅ Manual gas confirmed: ${receipt3.gasUsed.toString()} gas`);
          
          return await this.checkTokensReceived(wallet, balanceBefore, tokenInfo, tx3.hash, receipt3);
          
        } catch (error3) {
          console.log(`    ❌ Method 3 failed: ${error3.message}`);
          
          return {
            success: false,
            error: `All methods failed. Last error: ${error3.message}`,
            method: 'corrected-tony-all-methods-failed'
          };
        }
      }
    }
  }
  
  /**
   * EXECUTE CORRECTED GENERIC SWAP
   */
  async executeCorrectedGenericSwap(wallet, tokenAddress, amountETH, tokenInfo, balanceBefore) {
    console.log(`  🔍 Executing corrected generic swap for ${tokenInfo.symbol}...`);
    
    const router = new ethers.Contract(this.UNISWAP_V3_ROUTER, this.ROUTER_ABI, wallet);
    
    // Try different fee tiers
    const feeTiers = [10000, 3000, 500, 100]; // Start with 1% like TONY
    
    for (const fee of feeTiers) {
      try {
        console.log(`    🎯 Trying ${fee / 10000}% fee...`);
        
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
        
        console.log(`    ✅ ${fee / 10000}% fee works! Gas: ${gasEstimate.toString()}`);
        
        const tx = await router.exactInputSingle(params, {
          value: ethers.utils.parseEther(amountETH.toString()),
          gasLimit: gasEstimate.mul(120).div(100),
          gasPrice: await this.provider.getGasPrice()
        });
        
        console.log(`    📝 Transaction: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`    ✅ Confirmed: ${receipt.gasUsed.toString()} gas`);
        
        return await this.checkTokensReceived(wallet, balanceBefore, tokenInfo, tx.hash, receipt, tokenAddress);
        
      } catch (error) {
        console.log(`    ❌ ${fee / 10000}% fee failed: ${error.message}`);
        continue;
      }
    }
    
    return {
      success: false,
      error: `No working fee tiers found for ${tokenInfo.symbol}`,
      method: 'corrected-generic-no-pools'
    };
  }
  
  /**
   * CHECK TOKENS RECEIVED
   */
  async checkTokensReceived(wallet, balanceBefore, tokenInfo, txHash, receipt, tokenAddress = null) {
    const tokenAddr = tokenAddress || this.TONY_TOKEN;
    const token = new ethers.Contract(tokenAddr, this.ERC20_ABI, wallet);
    
    const balanceAfter = await token.balanceOf(wallet.address);
    const tokensReceived = balanceAfter.sub(balanceBefore);
    
    if (tokensReceived.gt(0)) {
      console.log(`    🎉 SUCCESS! Tokens received!`);
      console.log(`    📊 Amount: ${ethers.utils.formatUnits(tokensReceived, tokenInfo.decimals)} ${tokenInfo.symbol}`);
      
      return {
        success: true,
        txHash: txHash,
        gasUsed: receipt.gasUsed.toString(),
        tokensReceived: ethers.utils.formatUnits(tokensReceived, tokenInfo.decimals),
        method: 'corrected-success',
        blockNumber: receipt.blockNumber,
        tokenInfo: tokenInfo
      };
    } else {
      return {
        success: false,
        error: 'Transaction succeeded but no tokens received',
        method: 'corrected-no-tokens',
        txHash: txHash
      };
    }
  }
}

module.exports = CorrectedLooterSystem;