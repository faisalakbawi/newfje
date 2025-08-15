/**
 * EXACT REPLICA SYSTEM
 * Replicates the EXACT technique from the successful Looter bot transaction
 * Uses the EXACT same parameters, path, and amounts
 */

const { ethers } = require('ethers');

class ExactReplicaSystem {
  constructor(provider) {
    this.provider = provider;
    
    // EXACT addresses from successful transaction
    this.UNISWAP_V3_ROUTER = '0x2626664c2603336E57B271c5C0b26F421741e481';
    this.WETH = '0x4200000000000000000000000000000000000006';
    this.TONY_TOKEN = '0x36a947baa2492c72bf9d3307117237e79145a87d';
    
    // EXACT parameters from successful transaction
    this.EXACT_PATH = '0x420000000000000000000000000000000000000600271036a947baa2492c72bf9d3307117237e79145a87d';
    this.EXACT_SLIPPAGE = 10; // 1%
    this.EXACT_FEE = 10000; // 1%
    this.EXACT_ETH_AMOUNT = '0.06'; // EXACT amount from successful transaction
    
    // EXACT expected outputs (scaled for different amounts)
    this.EXACT_EXPECTED_TOKENS = ethers.BigNumber.from('1743504729698910273148557'); // For 0.06 ETH
    this.EXACT_MIN_TOKENS = ethers.BigNumber.from('1569154256729019245833701'); // 90% of expected
    
    this.ROUTER_ABI = [
      'function exactInput((bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum)) external payable returns (uint256 amountOut)',
      'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)'
    ];
    
    this.ERC20_ABI = [
      'function balanceOf(address account) external view returns (uint256)',
      'function decimals() external view returns (uint8)',
      'function name() external view returns (string)',
      'function symbol() external view returns (string)'
    ];
  }
  
  /**
   * EXACT REPLICA EXEC BUY
   */
  async execBuy(walletPrivateKey, tokenAddress, amountETH) {
    console.log(`🎯 ========== EXACT REPLICA SYSTEM ==========`);
    console.log(`🎯 Token: ${tokenAddress}`);
    console.log(`💰 Amount: ${amountETH} ETH`);
    console.log(`🔍 Replicating EXACT successful transaction technique`);
    
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
      // Check if this is TONY token with exact amount
      if (tokenAddress.toLowerCase() === this.TONY_TOKEN.toLowerCase()) {
        console.log(`\n🎯 TONY TOKEN DETECTED - Using EXACT replica method`);
        
        if (parseFloat(amountETH) === 0.06) {
          console.log(`✅ EXACT AMOUNT MATCH - Using original successful parameters`);
          return await this.executeExactTonyReplica(wallet, tokenInfo, balanceBefore);
        } else {
          console.log(`📊 SCALED AMOUNT - Calculating proportional parameters`);
          return await this.executeScaledTonyReplica(wallet, amountETH, tokenInfo, balanceBefore);
        }
      }
      
      // For other tokens, use the same technique but different path
      console.log(`\n🔍 NON-TONY TOKEN - Using replica technique with token-specific path`);
      return await this.executeGenericReplica(wallet, tokenAddress, amountETH, tokenInfo, balanceBefore);
      
    } catch (error) {
      console.error(`❌ Exact replica failed:`, error.message);
      return {
        success: false,
        error: error.message,
        method: 'exact-replica-error'
      };
    }
  }
  
  /**
   * EXECUTE EXACT TONY REPLICA - EXACT SAME PARAMETERS
   */
  async executeExactTonyReplica(wallet, tokenInfo, balanceBefore) {
    console.log(`  🎯 Executing EXACT TONY replica with original parameters...`);
    
    const router = new ethers.Contract(this.UNISWAP_V3_ROUTER, this.ROUTER_ABI, wallet);
    
    // Use EXACT path from successful transaction
    const params = {
      path: this.EXACT_PATH,
      recipient: wallet.address,
      deadline: Math.floor(Date.now() / 1000) + 300,
      amountIn: ethers.utils.parseEther(this.EXACT_ETH_AMOUNT),
      amountOutMinimum: this.EXACT_MIN_TOKENS // EXACT minimum from successful transaction
    };
    
    console.log(`  📊 EXACT Parameters:`);
    console.log(`    💰 Amount in: ${this.EXACT_ETH_AMOUNT} ETH`);
    console.log(`    🛤️ Path: ${this.EXACT_PATH}`);
    console.log(`    🎯 Min tokens: ${ethers.utils.formatEther(this.EXACT_MIN_TOKENS)} TONY`);
    console.log(`    🎯 Expected: ${ethers.utils.formatEther(this.EXACT_EXPECTED_TOKENS)} TONY`);
    
    try {
      // Get gas estimate
      const gasEstimate = await router.estimateGas.exactInput(params, {
        value: ethers.utils.parseEther(this.EXACT_ETH_AMOUNT)
      });
      
      console.log(`  ⛽ Gas estimate: ${gasEstimate.toString()}`);
      
      // Execute the EXACT replica
      const tx = await router.exactInput(params, {
        value: ethers.utils.parseEther(this.EXACT_ETH_AMOUNT),
        gasLimit: gasEstimate.mul(120).div(100), // 20% buffer
        gasPrice: await this.provider.getGasPrice()
      });
      
      console.log(`  📝 EXACT REPLICA transaction: ${tx.hash}`);
      console.log(`  ⏳ Waiting for confirmation...`);
      
      const receipt = await tx.wait();
      console.log(`  ✅ EXACT REPLICA confirmed in block ${receipt.blockNumber}`);
      console.log(`  ⛽ Gas used: ${receipt.gasUsed.toString()}`);
      
      // Check tokens received
      const token = new ethers.Contract(this.TONY_TOKEN, this.ERC20_ABI, wallet);
      const balanceAfter = await token.balanceOf(wallet.address);
      const tokensReceived = balanceAfter.sub(balanceBefore);
      
      if (tokensReceived.gt(0)) {
        console.log(`  🎉 EXACT REPLICA SUCCESS!`);
        console.log(`  📊 TONY received: ${ethers.utils.formatEther(tokensReceived)} TONY`);
        console.log(`  🎯 Expected: ${ethers.utils.formatEther(this.EXACT_EXPECTED_TOKENS)} TONY`);
        console.log(`  📈 Accuracy: ${tokensReceived.mul(100).div(this.EXACT_EXPECTED_TOKENS).toString()}%`);
        
        return {
          success: true,
          txHash: tx.hash,
          gasUsed: receipt.gasUsed.toString(),
          tokensReceived: ethers.utils.formatEther(tokensReceived),
          expectedTokens: ethers.utils.formatEther(this.EXACT_EXPECTED_TOKENS),
          method: 'exact-tony-replica',
          blockNumber: receipt.blockNumber,
          tokenInfo: tokenInfo
        };
      } else {
        return {
          success: false,
          error: 'Transaction succeeded but no TONY tokens received',
          method: 'exact-replica-no-tokens',
          txHash: tx.hash
        };
      }
      
    } catch (error) {
      console.log(`  ❌ EXACT REPLICA execution failed:`, error.message);
      return {
        success: false,
        error: error.message,
        method: 'exact-replica-execution-failed'
      };
    }
  }
  
  /**
   * EXECUTE SCALED TONY REPLICA - PROPORTIONAL PARAMETERS
   */
  async executeScaledTonyReplica(wallet, amountETH, tokenInfo, balanceBefore) {
    console.log(`  📊 Executing SCALED TONY replica...`);
    
    // Calculate proportional expected output
    const ethAmount = ethers.utils.parseEther(amountETH.toString());
    const originalEthAmount = ethers.utils.parseEther(this.EXACT_ETH_AMOUNT);
    
    // Scale the expected output proportionally
    const scaledExpectedTokens = this.EXACT_EXPECTED_TOKENS.mul(ethAmount).div(originalEthAmount);
    const scaledMinTokens = scaledExpectedTokens.mul(90).div(100); // 10% slippage
    
    console.log(`  📊 Scaled calculations:`);
    console.log(`    💰 Your amount: ${amountETH} ETH`);
    console.log(`    🎯 Scaled expected: ${ethers.utils.formatEther(scaledExpectedTokens)} TONY`);
    console.log(`    🎯 Scaled minimum: ${ethers.utils.formatEther(scaledMinTokens)} TONY`);
    
    const router = new ethers.Contract(this.UNISWAP_V3_ROUTER, this.ROUTER_ABI, wallet);
    
    const params = {
      path: this.EXACT_PATH, // Same path as successful transaction
      recipient: wallet.address,
      deadline: Math.floor(Date.now() / 1000) + 300,
      amountIn: ethAmount,
      amountOutMinimum: scaledMinTokens
    };
    
    try {
      const gasEstimate = await router.estimateGas.exactInput(params, {
        value: ethAmount
      });
      
      console.log(`  ⛽ Gas estimate: ${gasEstimate.toString()}`);
      
      const tx = await router.exactInput(params, {
        value: ethAmount,
        gasLimit: gasEstimate.mul(120).div(100),
        gasPrice: await this.provider.getGasPrice()
      });
      
      console.log(`  📝 SCALED REPLICA transaction: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`  ✅ SCALED REPLICA confirmed: ${receipt.gasUsed.toString()} gas`);
      
      // Check tokens received
      const token = new ethers.Contract(this.TONY_TOKEN, this.ERC20_ABI, wallet);
      const balanceAfter = await token.balanceOf(wallet.address);
      const tokensReceived = balanceAfter.sub(balanceBefore);
      
      if (tokensReceived.gt(0)) {
        console.log(`  🎉 SCALED REPLICA SUCCESS!`);
        console.log(`  📊 TONY received: ${ethers.utils.formatEther(tokensReceived)} TONY`);
        
        return {
          success: true,
          txHash: tx.hash,
          gasUsed: receipt.gasUsed.toString(),
          tokensReceived: ethers.utils.formatEther(tokensReceived),
          expectedTokens: ethers.utils.formatEther(scaledExpectedTokens),
          method: 'scaled-tony-replica',
          blockNumber: receipt.blockNumber,
          tokenInfo: tokenInfo
        };
      }
      
    } catch (error) {
      console.log(`  ❌ SCALED REPLICA failed:`, error.message);
      return {
        success: false,
        error: error.message,
        method: 'scaled-replica-failed'
      };
    }
  }
  
  /**
   * EXECUTE GENERIC REPLICA - FOR OTHER TOKENS
   */
  async executeGenericReplica(wallet, tokenAddress, amountETH, tokenInfo, balanceBefore) {
    console.log(`  🔍 Executing generic replica for ${tokenInfo.symbol}...`);
    
    // Create path for this token (same structure as TONY)
    const path = ethers.utils.solidityPack(
      ['address', 'uint24', 'address'],
      [this.WETH, this.EXACT_FEE, tokenAddress]
    );
    
    console.log(`  🛤️ Generated path: ${path}`);
    
    const router = new ethers.Contract(this.UNISWAP_V3_ROUTER, this.ROUTER_ABI, wallet);
    
    const params = {
      path: path,
      recipient: wallet.address,
      deadline: Math.floor(Date.now() / 1000) + 300,
      amountIn: ethers.utils.parseEther(amountETH.toString()),
      amountOutMinimum: 0 // Accept any amount for generic tokens
    };
    
    try {
      const gasEstimate = await router.estimateGas.exactInput(params, {
        value: ethers.utils.parseEther(amountETH.toString())
      });
      
      console.log(`  ⛽ Gas estimate: ${gasEstimate.toString()}`);
      
      const tx = await router.exactInput(params, {
        value: ethers.utils.parseEther(amountETH.toString()),
        gasLimit: gasEstimate.mul(120).div(100),
        gasPrice: await this.provider.getGasPrice()
      });
      
      console.log(`  📝 Generic replica transaction: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`  ✅ Generic replica confirmed: ${receipt.gasUsed.toString()} gas`);
      
      // Check tokens received
      const token = new ethers.Contract(tokenAddress, this.ERC20_ABI, wallet);
      const balanceAfter = await token.balanceOf(wallet.address);
      const tokensReceived = balanceAfter.sub(balanceBefore);
      
      if (tokensReceived.gt(0)) {
        console.log(`  🎉 GENERIC REPLICA SUCCESS!`);
        console.log(`  📊 ${tokenInfo.symbol} received: ${ethers.utils.formatUnits(tokensReceived, tokenInfo.decimals)}`);
        
        return {
          success: true,
          txHash: tx.hash,
          gasUsed: receipt.gasUsed.toString(),
          tokensReceived: ethers.utils.formatUnits(tokensReceived, tokenInfo.decimals),
          method: 'generic-replica',
          blockNumber: receipt.blockNumber,
          tokenInfo: tokenInfo
        };
      }
      
    } catch (error) {
      console.log(`  ❌ Generic replica failed:`, error.message);
      return {
        success: false,
        error: error.message,
        method: 'generic-replica-failed'
      };
    }
  }
}

module.exports = ExactReplicaSystem;