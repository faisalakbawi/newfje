/**
 * LOOTER-STYLE BUY SYSTEM
 * Implements the exact same buying mechanism as professional looter bots
 */

const { ethers } = require('ethers');

class LooterBuySystem {
  constructor(provider, contractAddress) {
    this.provider = provider;
    this.contractAddress = contractAddress;
    
    // Base network addresses
    this.ROUTER_ADDRESS = '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24'; // Base Uniswap V2 Router
    this.WETH_ADDRESS = '0x4200000000000000000000000000000000000006'; // Base WETH
    this.FACTORY_ADDRESS = '0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6'; // Base Uniswap V2 Factory
    
    // Router ABI (minimal)
    this.ROUTER_ABI = [
      'function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable',
      'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)'
    ];
    
    // ERC20 ABI (minimal)
    this.ERC20_ABI = [
      'function balanceOf(address account) external view returns (uint256)',
      'function transfer(address to, uint256 amount) external returns (bool)',
      'function approve(address spender, uint256 amount) external returns (bool)'
    ];
    
    // Pair ABI (minimal)
    this.PAIR_ABI = [
      'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
      'function token0() external view returns (address)',
      'function token1() external view returns (address)'
    ];
    
    // Factory ABI (minimal)
    this.FACTORY_ABI = [
      'function getPair(address tokenA, address tokenB) external view returns (address pair)'
    ];
  }
  
  /**
   * LOOTER-STYLE BUY EXECUTION
   * Mimics exactly what professional looter bots do
   */
  async executeLooterBuy(walletPrivateKey, tokenAddress, amountETH, options = {}) {
    console.log(`🔥 ========== LOOTER-STYLE BUY EXECUTION ==========`);
    console.log(`🎯 Token: ${tokenAddress}`);
    console.log(`💰 Amount: ${amountETH} ETH`);
    
    try {
      // Setup wallet
      const wallet = new ethers.Wallet(walletPrivateKey, this.provider);
      console.log(`👤 Buying from wallet: ${wallet.address}`);
      
      // 1. PRE-BUY LIQUIDITY CHECK (like Looter)
      const liquidityInfo = await this.checkLiquidity(tokenAddress);
      console.log(`💧 Liquidity check:`, liquidityInfo);
      
      if (!liquidityInfo.hasLiquidity) {
        throw new Error('No liquidity found for token');
      }
      
      if (parseFloat(liquidityInfo.ethReserve) < 0.1) {
        console.log('⚠️  WARNING: Very low liquidity detected');
      }
      
      // 2. GET EXPECTED TOKENS (for logging)
      const expectedTokens = await this.getExpectedTokens(tokenAddress, ethers.utils.parseEther(amountETH.toString()));
      console.log(`📊 Expected tokens: ${ethers.utils.formatUnits(expectedTokens, 18)}`);
      
      // 3. EXECUTE THE EXACT SAME BUY AS LOOTER
      const result = await this.executeLooterStyleSwap(wallet, tokenAddress, amountETH, options);
      
      console.log(`✅ Looter-style buy completed!`);
      return result;
      
    } catch (error) {
      console.error(`❌ Looter-style buy failed:`, error.message);
      throw error;
    }
  }
  
  /**
   * EXECUTE LOOTER-STYLE SWAP
   * Uses the exact same method as professional looter bots
   */
  async executeLooterStyleSwap(wallet, tokenAddress, amountETH, options = {}) {
    console.log(`🚀 Executing Looter-style swap...`);
    
    // Setup router contract
    const router = new ethers.Contract(this.ROUTER_ADDRESS, this.ROUTER_ABI, wallet);
    const token = new ethers.Contract(tokenAddress, this.ERC20_ABI, wallet);
    
    // Get token balance before buy (for verification)
    const tokenBalanceBefore = await token.balanceOf(wallet.address);
    console.log(`📊 Token balance before: ${ethers.utils.formatUnits(tokenBalanceBefore, 18)}`);
    
    // Setup path (WETH -> Token)
    const path = [this.WETH_ADDRESS, tokenAddress];
    
    // Calculate deadline (5 minutes from now, like Looter)
    const deadline = Math.floor(Date.now() / 1000) + 300;
    
    // CRITICAL: Use the exact same parameters as Looter
    const swapParams = {
      amountOutMin: 0, // EXACTLY like Looter - maximum slippage tolerance
      path: path,
      to: wallet.address, // For direct wallet buy (not contract)
      deadline: deadline
    };
    
    console.log(`🔧 Swap parameters:`, {
      amountETH: amountETH,
      amountOutMin: swapParams.amountOutMin,
      path: swapParams.path,
      to: swapParams.to,
      deadline: new Date(deadline * 1000).toISOString()
    });
    
    // Execute the swap with the exact same function as Looter
    console.log(`🎯 Calling swapExactETHForTokensSupportingFeeOnTransferTokens...`);
    
    const tx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
      swapParams.amountOutMin,
      swapParams.path,
      swapParams.to,
      swapParams.deadline,
      {
        value: ethers.utils.parseEther(amountETH.toString()),
        gasLimit: options.gasLimit || 300000,
        gasPrice: options.gasPrice || undefined
      }
    );
    
    console.log(`📝 Transaction sent: ${tx.hash}`);
    console.log(`⏳ Waiting for confirmation...`);
    
    // Wait for transaction confirmation
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed in block: ${receipt.blockNumber}`);
    console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`);
    
    // Verify tokens were received (Looter's honeypot protection)
    const tokenBalanceAfter = await token.balanceOf(wallet.address);
    const tokensReceived = tokenBalanceAfter - tokenBalanceBefore;
    
    console.log(`📊 Token balance after: ${ethers.utils.formatUnits(tokenBalanceAfter, 18)}`);
    console.log(`🎉 Tokens received: ${ethers.utils.formatUnits(tokensReceived, 18)}`);
    
    if (tokensReceived <= 0) {
      throw new Error('No tokens received - possible honeypot or failed swap');
    }
    
    return {
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      tokensReceived: ethers.utils.formatUnits(tokensReceived, 18),
      ethSpent: amountETH
    };
  }
  
  /**
   * CHECK LIQUIDITY (like professional bots)
   */
  async checkLiquidity(tokenAddress) {
    try {
      const factory = new ethers.Contract(this.FACTORY_ADDRESS, this.FACTORY_ABI, this.provider);
      
      // Get pair address
      const pairAddress = await factory.getPair(this.WETH_ADDRESS, tokenAddress);
      
      if (pairAddress === ethers.constants.AddressZero) {
        return {
          hasLiquidity: false,
          pairAddress: null,
          ethReserve: 0,
          tokenReserve: 0
        };
      }
      
      // Get reserves
      const pair = new ethers.Contract(pairAddress, this.PAIR_ABI, this.provider);
      const [reserve0, reserve1] = await pair.getReserves();
      const token0 = await pair.token0();
      
      let ethReserve, tokenReserve;
      if (token0.toLowerCase() === this.WETH_ADDRESS.toLowerCase()) {
        ethReserve = reserve0;
        tokenReserve = reserve1;
      } else {
        ethReserve = reserve1;
        tokenReserve = reserve0;
      }
      
      return {
        hasLiquidity: ethReserve > 0 && tokenReserve > 0,
        pairAddress: pairAddress,
        ethReserve: ethers.utils.formatEther(ethReserve),
        tokenReserve: ethers.utils.formatUnits(tokenReserve, 18)
      };
      
    } catch (error) {
      console.error('❌ Liquidity check failed:', error.message);
      return {
        hasLiquidity: false,
        error: error.message
      };
    }
  }
  
  /**
   * GET EXPECTED TOKENS (for price calculation)
   */
  async getExpectedTokens(tokenAddress, amountETH) {
    try {
      const router = new ethers.Contract(this.ROUTER_ADDRESS, this.ROUTER_ABI, this.provider);
      const path = [this.WETH_ADDRESS, tokenAddress];
      
      const amounts = await router.getAmountsOut(amountETH, path);
      return amounts[1]; // Return expected token amount
      
    } catch (error) {
      console.error('❌ Failed to get expected tokens:', error.message);
      return ethers.utils.parseUnits('0', 18);
    }
  }
  
  /**
   * SIMULATE BUY (for testing without spending ETH)
   */
  async simulateBuy(tokenAddress, amountETH) {
    console.log(`🧪 Simulating Looter-style buy...`);
    
    try {
      // Check liquidity
      const liquidityInfo = await this.checkLiquidity(tokenAddress);
      console.log(`💧 Liquidity:`, liquidityInfo);
      
      if (!liquidityInfo.hasLiquidity) {
        return { success: false, error: 'No liquidity' };
      }
      
      // Get expected tokens
      const expectedTokens = await this.getExpectedTokens(tokenAddress, ethers.utils.parseEther(amountETH.toString()));
      console.log(`📊 Expected tokens: ${ethers.utils.formatUnits(expectedTokens, 18)}`);
      
      return {
        success: true,
        simulation: true,
        liquidityInfo: liquidityInfo,
        expectedTokens: ethers.utils.formatUnits(expectedTokens, 18),
        ethAmount: amountETH
      };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = LooterBuySystem;