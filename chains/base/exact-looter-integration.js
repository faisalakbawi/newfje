/**
 * EXACT LOOTER BOT INTEGRATION
 * Integrates with the deployed Looter bot smart contract
 * Uses the exact same execBuy() function as professional Looter bots
 */

const { ethers } = require('ethers');

class ExactLooterIntegration {
  constructor(provider, contractAddress) {
    this.provider = provider;
    this.contractAddress = contractAddress;
    
    // Exact Looter Bot ABI (minimal)
    this.LOOTER_ABI = [
      'function execBuy(address token) external payable',
      'function hasLiquidity(address token) external view returns (bool)',
      'function getLiquidityInfo(address token) external view returns (address pair, uint256 ethReserve, uint256 tokenReserve, bool hasLiq)',
      'function emergencyWithdrawETH() external',
      'function emergencyWithdrawToken(address token) external',
      'event TokenPurchased(address indexed token, uint256 ethSpent, uint256 tokensReceived, address indexed recipient)'
    ];
    
    // ERC20 ABI for balance checking
    this.ERC20_ABI = [
      'function balanceOf(address account) external view returns (uint256)',
      'function transfer(address to, uint256 amount) external returns (bool)'
    ];
  }
  
  /**
   * EXECUTE EXACT LOOTER BUY
   * Uses the exact same execBuy() function as professional Looter bots
   */
  async executeExactLooterBuy(walletPrivateKey, tokenAddress, amountETH, options = {}) {
    console.log(`🔥 ========== EXACT LOOTER BOT EXECUTION ==========`);
    console.log(`🎯 Token: ${tokenAddress}`);
    console.log(`💰 Amount: ${amountETH} ETH`);
    console.log(`🏭 Contract: ${this.contractAddress}`);
    
    try {
      // Setup wallet
      const wallet = new ethers.Wallet(walletPrivateKey, this.provider);
      console.log(`👤 Executing from wallet: ${wallet.address}`);
      
      // Setup contract
      const looterContract = new ethers.Contract(this.contractAddress, this.LOOTER_ABI, wallet);
      
      // 1. PRE-BUY LIQUIDITY CHECK (like professional Looters)
      console.log(`🔍 Checking liquidity...`);
      const liquidityInfo = await this.checkContractLiquidity(tokenAddress);
      console.log(`💧 Liquidity info:`, liquidityInfo);
      
      if (!liquidityInfo.hasLiq) {
        throw new Error('No liquidity found for token');
      }
      
      // 2. GET TOKEN BALANCE BEFORE (for verification)
      const token = new ethers.Contract(tokenAddress, this.ERC20_ABI, wallet);
      const balanceBefore = await token.balanceOf(wallet.address);
      console.log(`📊 Token balance before: ${ethers.utils.formatUnits(balanceBefore, 18)}`);
      
      // 3. EXECUTE THE EXACT SAME FUNCTION AS LOOTER BOTS
      console.log(`🚀 Calling execBuy() function...`);
      
      const tx = await looterContract.execBuy(tokenAddress, {
        value: ethers.utils.parseEther(amountETH.toString()),
        gasLimit: options.gasLimit || 300000,
        gasPrice: options.gasPrice || undefined
      });
      
      console.log(`📝 Transaction sent: ${tx.hash}`);
      console.log(`⏳ Waiting for confirmation...`);
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      console.log(`✅ Transaction confirmed in block: ${receipt.blockNumber}`);
      console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`);
      
      // 4. VERIFY TOKENS RECEIVED (like Looter bots)
      const balanceAfter = await token.balanceOf(wallet.address);
      const tokensReceived = balanceAfter.sub(balanceBefore);
      
      console.log(`📊 Token balance after: ${ethers.utils.formatUnits(balanceAfter, 18)}`);
      console.log(`🎉 Tokens received: ${ethers.utils.formatUnits(tokensReceived, 18)}`);
      
      if (tokensReceived.lte(0)) {
        throw new Error('No tokens received - contract execution failed');
      }
      
      // 5. PARSE EVENTS (like professional bots)
      const tokenPurchasedEvent = receipt.events?.find(e => e.event === 'TokenPurchased');
      if (tokenPurchasedEvent) {
        console.log(`📋 Event data:`, {
          token: tokenPurchasedEvent.args.token,
          ethSpent: ethers.utils.formatEther(tokenPurchasedEvent.args.ethSpent),
          tokensReceived: ethers.utils.formatUnits(tokenPurchasedEvent.args.tokensReceived, 18),
          recipient: tokenPurchasedEvent.args.recipient
        });
      }
      
      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        tokensReceived: ethers.utils.formatUnits(tokensReceived, 18),
        ethSpent: amountETH,
        method: 'exact-looter-contract',
        contractAddress: this.contractAddress
      };
      
    } catch (error) {
      console.error(`❌ Exact Looter buy failed:`, error.message);
      
      // Parse specific error messages
      if (error.message.includes('No liquidity found')) {
        return {
          success: false,
          error: 'No liquidity found for token',
          method: 'exact-looter-contract'
        };
      } else if (error.message.includes('Buy failed or honeypot')) {
        return {
          success: false,
          error: 'Token appears to be a honeypot or buy failed',
          method: 'exact-looter-contract'
        };
      } else {
        return {
          success: false,
          error: error.message,
          method: 'exact-looter-contract'
        };
      }
    }
  }
  
  /**
   * CHECK LIQUIDITY USING CONTRACT
   */
  async checkContractLiquidity(tokenAddress) {
    try {
      const looterContract = new ethers.Contract(this.contractAddress, this.LOOTER_ABI, this.provider);
      
      const [pair, ethReserve, tokenReserve, hasLiq] = await looterContract.getLiquidityInfo(tokenAddress);
      
      return {
        pairAddress: pair,
        ethReserve: ethers.utils.formatEther(ethReserve),
        tokenReserve: ethers.utils.formatUnits(tokenReserve, 18),
        hasLiq: hasLiq
      };
      
    } catch (error) {
      console.error('❌ Contract liquidity check failed:', error.message);
      return {
        hasLiq: false,
        error: error.message
      };
    }
  }
  
  /**
   * SIMULATE EXACT LOOTER BUY
   */
  async simulateExactLooterBuy(tokenAddress, amountETH) {
    console.log(`🧪 Simulating Exact Looter buy...`);
    
    try {
      // Check liquidity using contract
      const liquidityInfo = await this.checkContractLiquidity(tokenAddress);
      console.log(`💧 Contract liquidity:`, liquidityInfo);
      
      if (!liquidityInfo.hasLiq) {
        return { 
          success: false, 
          error: 'No liquidity found',
          method: 'exact-looter-simulation'
        };
      }
      
      return {
        success: true,
        simulation: true,
        liquidityInfo: liquidityInfo,
        ethAmount: amountETH,
        method: 'exact-looter-simulation',
        contractAddress: this.contractAddress
      };
      
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        method: 'exact-looter-simulation'
      };
    }
  }
  
  /**
   * EMERGENCY FUNCTIONS
   */
  async emergencyWithdrawETH(walletPrivateKey) {
    const wallet = new ethers.Wallet(walletPrivateKey, this.provider);
    const looterContract = new ethers.Contract(this.contractAddress, this.LOOTER_ABI, wallet);
    
    const tx = await looterContract.emergencyWithdrawETH();
    return await tx.wait();
  }
  
  async emergencyWithdrawToken(walletPrivateKey, tokenAddress) {
    const wallet = new ethers.Wallet(walletPrivateKey, this.provider);
    const looterContract = new ethers.Contract(this.contractAddress, this.LOOTER_ABI, wallet);
    
    const tx = await looterContract.emergencyWithdrawToken(tokenAddress);
    return await tx.wait();
  }
}

module.exports = ExactLooterIntegration;