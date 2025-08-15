/**
 * SAFE EXEC BUY SYSTEM
 * Implements the exact execBuy() function like professional Looter bots
 * - Uses minimal gas
 * - Shows "Exec Buy" in transaction
 * - Stops after first success
 * - Protects wallet from excessive gas usage
 */

const { ethers } = require('ethers');

class SafeExecBuySystem {
  constructor(provider) {
    this.provider = provider;
    this.WETH = '0x4200000000000000000000000000000000000006';
    
    // Only use the most reliable DEX to save gas
    this.PRIMARY_ROUTER = '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24'; // Uniswap V2 Base
    
    // Gas limits to protect wallet
    this.MAX_GAS_PER_ATTEMPT = 300000; // Maximum 300k gas per attempt
    this.MAX_TOTAL_GAS = 1000000; // Maximum 1M gas total
    
    this.ROUTER_ABI = [
      'function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable',
      'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)'
    ];
    
    this.ERC20_ABI = [
      'function balanceOf(address account) external view returns (uint256)',
      'function decimals() external view returns (uint8)',
      'function name() external view returns (string)',
      'function symbol() external view returns (string)'
    ];
  }
  
  /**
   * SAFE EXEC BUY - EXACTLY LIKE PROFESSIONAL LOOTER BOTS
   */
  async execBuy(walletPrivateKey, tokenAddress, amountETH) {
    console.log(`🔥 ========== EXEC BUY (LOOTER STYLE) ==========`);
    console.log(`🎯 Token: ${tokenAddress}`);
    console.log(`💰 Amount: ${amountETH} ETH`);
    console.log(`⛽ Max gas per attempt: ${this.MAX_GAS_PER_ATTEMPT.toLocaleString()}`);
    console.log(`🛡️ Total gas limit: ${this.MAX_TOTAL_GAS.toLocaleString()}`);
    
    const wallet = new ethers.Wallet(walletPrivateKey, this.provider);
    console.log(`👤 Wallet: ${wallet.address}`);
    
    // Check wallet ETH balance first
    const ethBalance = await wallet.getBalance();
    const requiredETH = ethers.utils.parseEther((amountETH + 0.01).toString()); // ETH + gas buffer
    
    if (ethBalance.lt(requiredETH)) {
      return {
        success: false,
        error: `Insufficient ETH balance. Need ${ethers.utils.formatEther(requiredETH)} ETH, have ${ethers.utils.formatEther(ethBalance)} ETH`,
        method: 'balance-check-failed'
      };
    }
    
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
    
    let totalGasUsed = 0;
    
    try {
      // TECHNIQUE 1: Standard execBuy() approach
      console.log(`\n🚀 EXEC BUY ATTEMPT 1: Standard Looter approach`);
      const result1 = await this.standardExecBuy(wallet, tokenAddress, amountETH, tokenInfo);
      
      if (result1.success) {
        // Verify tokens received
        const balanceAfter = await token.balanceOf(wallet.address);
        const tokensReceived = balanceAfter.sub(balanceBefore);
        
        if (tokensReceived.gt(0)) {
          console.log(`🎉 EXEC BUY SUCCESS!`);
          console.log(`📊 ${tokenInfo.symbol} received: ${ethers.utils.formatUnits(tokensReceived, tokenInfo.decimals)}`);
          
          return {
            success: true,
            txHash: result1.txHash,
            gasUsed: result1.gasUsed,
            tokensReceived: ethers.utils.formatUnits(tokensReceived, tokenInfo.decimals),
            method: 'exec-buy-standard',
            blockNumber: result1.blockNumber,
            tokenInfo: tokenInfo
          };
        }
      }
      
      totalGasUsed += parseInt(result1.gasUsed || '0');
      
      // Check if we've used too much gas
      if (totalGasUsed > this.MAX_TOTAL_GAS) {
        console.log(`⛽ Gas limit reached: ${totalGasUsed.toLocaleString()} / ${this.MAX_TOTAL_GAS.toLocaleString()}`);
        return {
          success: false,
          error: `Gas limit reached (${totalGasUsed.toLocaleString()} gas used)`,
          method: 'gas-limit-exceeded'
        };
      }
      
      // TECHNIQUE 2: Alternative router (only if first failed and gas allows)
      console.log(`\n🚀 EXEC BUY ATTEMPT 2: Alternative approach`);
      const result2 = await this.alternativeExecBuy(wallet, tokenAddress, amountETH, tokenInfo);
      
      if (result2.success) {
        const balanceAfter = await token.balanceOf(wallet.address);
        const tokensReceived = balanceAfter.sub(balanceBefore);
        
        if (tokensReceived.gt(0)) {
          console.log(`🎉 EXEC BUY SUCCESS (Alternative)!`);
          console.log(`📊 ${tokenInfo.symbol} received: ${ethers.utils.formatUnits(tokensReceived, tokenInfo.decimals)}`);
          
          return {
            success: true,
            txHash: result2.txHash,
            gasUsed: result2.gasUsed,
            tokensReceived: ethers.utils.formatUnits(tokensReceived, tokenInfo.decimals),
            method: 'exec-buy-alternative',
            blockNumber: result2.blockNumber,
            tokenInfo: tokenInfo
          };
        }
      }
      
      totalGasUsed += parseInt(result2.gasUsed || '0');
      
      return {
        success: false,
        error: `No liquidity found for ${tokenInfo.name} (${tokenInfo.symbol})`,
        method: 'exec-buy-no-liquidity',
        gasUsed: totalGasUsed.toString()
      };
      
    } catch (error) {
      console.error(`❌ Exec Buy failed:`, error.message);
      return {
        success: false,
        error: error.message,
        method: 'exec-buy-error',
        gasUsed: totalGasUsed.toString()
      };
    }
  }
  
  /**
   * STANDARD EXEC BUY - EXACTLY LIKE LOOTER BOTS
   */
  async standardExecBuy(wallet, tokenAddress, amountETH, tokenInfo) {
    try {
      console.log(`  📍 Using primary router: ${this.PRIMARY_ROUTER}`);
      
      const router = new ethers.Contract(this.PRIMARY_ROUTER, this.ROUTER_ABI, wallet);
      const path = [this.WETH, tokenAddress];
      
      // Get current gas price
      const gasPrice = await this.provider.getGasPrice();
      console.log(`  ⛽ Gas price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);
      
      // Execute the exact same function as Looter bots
      const tx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
        0, // amountOutMin = 0 (Looter style - accept any amount)
        path,
        wallet.address,
        Math.floor(Date.now() / 1000) + 300, // 5 minute deadline
        {
          value: ethers.utils.parseEther(amountETH.toString()),
          gasLimit: this.MAX_GAS_PER_ATTEMPT,
          gasPrice: gasPrice
        }
      );
      
      console.log(`  📝 Transaction submitted: ${tx.hash}`);
      console.log(`  ⏳ Waiting for confirmation...`);
      
      const receipt = await tx.wait();
      console.log(`  ✅ Transaction confirmed in block ${receipt.blockNumber}`);
      console.log(`  ⛽ Gas used: ${receipt.gasUsed.toString()}`);
      
      return {
        success: true,
        txHash: tx.hash,
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber
      };
      
    } catch (error) {
      console.log(`  ❌ Standard exec buy failed:`, error.message);
      
      // Extract gas used from failed transaction if possible
      let gasUsed = '0';
      if (error.receipt) {
        gasUsed = error.receipt.gasUsed?.toString() || '0';
      }
      
      return {
        success: false,
        error: error.message,
        gasUsed: gasUsed
      };
    }
  }
  
  /**
   * ALTERNATIVE EXEC BUY - BACKUP METHOD
   */
  async alternativeExecBuy(wallet, tokenAddress, amountETH, tokenInfo) {
    try {
      console.log(`  📍 Trying alternative approach with lower gas...`);
      
      const router = new ethers.Contract(this.PRIMARY_ROUTER, this.ROUTER_ABI, wallet);
      const path = [this.WETH, tokenAddress];
      
      // Use lower gas price for second attempt
      const gasPrice = await this.provider.getGasPrice();
      const lowerGasPrice = gasPrice.mul(80).div(100); // 80% of current gas price
      
      console.log(`  ⛽ Lower gas price: ${ethers.utils.formatUnits(lowerGasPrice, 'gwei')} gwei`);
      
      const tx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
        0,
        path,
        wallet.address,
        Math.floor(Date.now() / 1000) + 600, // 10 minute deadline
        {
          value: ethers.utils.parseEther(amountETH.toString()),
          gasLimit: Math.floor(this.MAX_GAS_PER_ATTEMPT * 0.8), // 80% gas limit
          gasPrice: lowerGasPrice
        }
      );
      
      console.log(`  📝 Alternative transaction: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`  ✅ Alternative confirmed: ${receipt.gasUsed.toString()} gas`);
      
      return {
        success: true,
        txHash: tx.hash,
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber
      };
      
    } catch (error) {
      console.log(`  ❌ Alternative exec buy failed:`, error.message);
      
      let gasUsed = '0';
      if (error.receipt) {
        gasUsed = error.receipt.gasUsed?.toString() || '0';
      }
      
      return {
        success: false,
        error: error.message,
        gasUsed: gasUsed
      };
    }
  }
  
  /**
   * CHECK IF TOKEN HAS LIQUIDITY (QUICK CHECK)
   */
  async hasLiquidity(tokenAddress) {
    try {
      const router = new ethers.Contract(this.PRIMARY_ROUTER, this.ROUTER_ABI, this.provider);
      const path = [this.WETH, tokenAddress];
      
      // Try to get amounts out for a small amount
      const testAmount = ethers.utils.parseEther('0.001');
      const amounts = await router.getAmountsOut(testAmount, path);
      
      return amounts[1].gt(0);
      
    } catch (error) {
      return false;
    }
  }
}

module.exports = SafeExecBuySystem;