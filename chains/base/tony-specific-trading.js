const { ethers } = require('ethers');

/**
 * TONY Token Specific Trading Module
 * 
 * TONY token requires a specific trading bot contract to work properly.
 * Standard DEX routers fail due to token restrictions.
 * 
 * Based on successful transaction: 0x9385e1b7bc28be3ee3bfee9e8722b4373ebe7e96ee64830c7636ba51cbc5345b
 * Uses custom contract: 0xe111b0C3605aDc45CFb0CD75E5543F63CC3ec425
 */

// TONY token specific constants
const TONY_TOKEN = '0x36A947Baa2492C72Bf9D3307117237E79145A87d';
const TONY_TRADING_CONTRACT = '0xe111b0C3605aDc45CFb0CD75E5543F63CC3ec425';
const WETH = '0x4200000000000000000000000000000000000006';

// TONY trading contract ABI (based on successful transaction)
const TONY_TRADING_ABI = [
  // Exec Buy function - the one used in successful transaction
  'function execBuy(uint256 param1, bytes calldata param2, uint256 param3, uint256 param4, uint256 param5) external payable returns (uint256)',
  
  // Alternative functions that might exist
  'function buy(address token, uint256 amount) external payable returns (uint256)',
  'function swapETHForTokens(address token, uint256 minTokens) external payable returns (uint256)',
  
  // View functions
  'function getPrice(address token) external view returns (uint256)',
  'function getAmountOut(uint256 amountIn, address tokenOut) external view returns (uint256)'
];

class TonySpecificTrading {
  constructor(provider, wallet) {
    this.provider = provider;
    this.wallet = wallet;
    this.tonyContract = new ethers.Contract(TONY_TRADING_CONTRACT, TONY_TRADING_ABI, wallet);
  }

  /**
   * Check if token is TONY
   */
  isTonyToken(tokenAddress) {
    return tokenAddress.toLowerCase() === TONY_TOKEN.toLowerCase();
  }

  /**
   * Buy TONY tokens using the specific trading contract
   */
  async buyTonyTokens(amountETH, slippage = 25) {
    try {
      console.log('🎯 ========== TONY SPECIFIC TRADING ==========');
      console.log(`💰 Amount: ${amountETH} ETH`);
      console.log(`🛡️ Slippage: ${slippage}%`);
      console.log(`📍 TONY Contract: ${TONY_TRADING_CONTRACT}`);
      console.log(`🪙 TONY Token: ${TONY_TOKEN}`);

      const amountWei = ethers.utils.parseEther(amountETH.toString());
      
      // Check wallet balance
      const balance = await this.wallet.getBalance();
      console.log(`💰 Wallet balance: ${ethers.utils.formatEther(balance)} ETH`);
      
      if (balance.lt(amountWei)) {
        throw new Error(`Insufficient balance. Need ${amountETH} ETH, have ${ethers.utils.formatEther(balance)} ETH`);
      }

      // Method 1: Try to get price/amount out if function exists
      let expectedTokens = null;
      try {
        expectedTokens = await this.tonyContract.getAmountOut(amountWei, TONY_TOKEN);
        console.log(`📊 Expected TONY tokens: ${ethers.utils.formatEther(expectedTokens)}`);
      } catch (error) {
        console.log('📊 Could not get expected amount, proceeding with trade...');
      }

      // Method 2: Try simple buy function first
      console.log('🔄 Trying simple buy function...');
      try {
        const gasEstimate = await this.tonyContract.estimateGas.buy(TONY_TOKEN, 0, {
          value: amountWei
        });
        
        const tx = await this.tonyContract.buy(TONY_TOKEN, 0, {
          value: amountWei,
          gasLimit: gasEstimate.mul(120).div(100) // 20% buffer
        });
        
        console.log(`📍 TONY transaction sent: ${tx.hash}`);
        const receipt = await tx.wait();
        
        return {
          success: true,
          txHash: tx.hash,
          method: 'TONY Specific Contract - Simple Buy',
          gasUsed: receipt.gasUsed.toString(),
          explorerUrl: `https://basescan.org/tx/${tx.hash}`
        };
        
      } catch (error) {
        console.log(`❌ Simple buy failed: ${error.message}`);
      }

      // Method 3: Try swapETHForTokens function
      console.log('🔄 Trying swapETHForTokens function...');
      try {
        const minTokens = expectedTokens ? expectedTokens.mul(100 - slippage).div(100) : 0;
        
        const gasEstimate = await this.tonyContract.estimateGas.swapETHForTokens(TONY_TOKEN, minTokens, {
          value: amountWei
        });
        
        const tx = await this.tonyContract.swapETHForTokens(TONY_TOKEN, minTokens, {
          value: amountWei,
          gasLimit: gasEstimate.mul(120).div(100) // 20% buffer
        });
        
        console.log(`📍 TONY transaction sent: ${tx.hash}`);
        const receipt = await tx.wait();
        
        return {
          success: true,
          txHash: tx.hash,
          method: 'TONY Specific Contract - SwapETHForTokens',
          gasUsed: receipt.gasUsed.toString(),
          explorerUrl: `https://basescan.org/tx/${tx.hash}`
        };
        
      } catch (error) {
        console.log(`❌ SwapETHForTokens failed: ${error.message}`);
      }

      // Method 4: Try to reverse engineer the execBuy function
      console.log('🔄 Trying to reverse engineer execBuy function...');
      try {
        // Based on successful transaction input data:
        // 0xc981cc3c000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000bead0d9bdc94a4b3615f00000000000000000000000000000000000000000000d3dcb9c99fc19a8e6c31000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000064000000000000000000000000000000000000000000000000000000174876e818000000000000000000000000000000000000000000000000000000000000002b420000000000000000000000000000000000000600271036a947baa2492c72bf9d3307117237e79145a87d000000000000000000000000000000000000000000
        
        // Try to construct similar parameters
        const param1 = 10; // From successful tx
        const param2 = '0x000000000000000000000000000000000000000000000000000000174876e818000000000000000000000000000000000000000000000000000000000000002b420000000000000000000000000000000000000600271036a947baa2492c72bf9d3307117237e79145a87d000000000000000000000000000000000000000000';
        const param3 = ethers.BigNumber.from('0xbead0d9bdc94a4b3615f'); // From successful tx
        const param4 = ethers.BigNumber.from('0xd3dcb9c99fc19a8e6c31'); // From successful tx  
        const param5 = 0;
        
        const gasEstimate = await this.tonyContract.estimateGas.execBuy(param1, param2, param3, param4, param5, {
          value: amountWei
        });
        
        const tx = await this.tonyContract.execBuy(param1, param2, param3, param4, param5, {
          value: amountWei,
          gasLimit: gasEstimate.mul(120).div(100) // 20% buffer
        });
        
        console.log(`📍 TONY transaction sent: ${tx.hash}`);
        const receipt = await tx.wait();
        
        return {
          success: true,
          txHash: tx.hash,
          method: 'TONY Specific Contract - ExecBuy (Reverse Engineered)',
          gasUsed: receipt.gasUsed.toString(),
          explorerUrl: `https://basescan.org/tx/${tx.hash}`
        };
        
      } catch (error) {
        console.log(`❌ ExecBuy failed: ${error.message}`);
      }

      // If all methods fail
      throw new Error('All TONY-specific trading methods failed');

    } catch (error) {
      console.error(`❌ TONY trading failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        method: 'TONY Specific Contract'
      };
    }
  }

  /**
   * Get TONY token balance
   */
  async getTonyBalance(walletAddress) {
    try {
      const tokenContract = new ethers.Contract(TONY_TOKEN, [
        'function balanceOf(address) view returns (uint256)',
        'function decimals() view returns (uint8)'
      ], this.provider);
      
      const balance = await tokenContract.balanceOf(walletAddress);
      const decimals = await tokenContract.decimals();
      
      return {
        raw: balance,
        formatted: ethers.utils.formatUnits(balance, decimals),
        decimals: decimals
      };
    } catch (error) {
      console.error(`❌ Failed to get TONY balance: ${error.message}`);
      return null;
    }
  }

  /**
   * Check if TONY trading contract is accessible
   */
  async checkTonyContract() {
    try {
      const code = await this.provider.getCode(TONY_TRADING_CONTRACT);
      const isContract = code !== '0x';
      
      console.log(`🔍 TONY trading contract exists: ${isContract}`);
      
      if (isContract) {
        // Try to call a view function to test accessibility
        try {
          const balance = await this.provider.getBalance(TONY_TRADING_CONTRACT);
          console.log(`💰 TONY contract balance: ${ethers.utils.formatEther(balance)} ETH`);
        } catch (error) {
          console.log(`⚠️ Could not get contract balance: ${error.message}`);
        }
      }
      
      return isContract;
    } catch (error) {
      console.error(`❌ Failed to check TONY contract: ${error.message}`);
      return false;
    }
  }
}

module.exports = TonySpecificTrading;