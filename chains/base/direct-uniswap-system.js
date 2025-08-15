/**
 * DIRECT UNISWAP V3 ROUTER SYSTEM
 * Bypasses sniper contracts and uses official Uniswap V3 Router directly
 * More reliable for micro-cap tokens with proper slippage handling
 */

const { ethers } = require('ethers');

class DirectUniswapSystem {
  constructor(provider) {
    this.provider = provider;
    
    // Base network addresses
    this.WETH = '0x4200000000000000000000000000000000000006';
    this.UNISWAP_V3_ROUTER = '0x2626664c2603336E57B271c5C0b26F421741e481'; // Official Uniswap V3 Router on Base
    
    // Router ABI for exactInputSingle
    this.ROUTER_ABI = [
      {
        "inputs": [
          {
            "components": [
              {"internalType": "address", "name": "tokenIn", "type": "address"},
              {"internalType": "address", "name": "tokenOut", "type": "address"},
              {"internalType": "uint24", "name": "fee", "type": "uint24"},
              {"internalType": "address", "name": "recipient", "type": "address"},
              {"internalType": "uint256", "name": "deadline", "type": "uint256"},
              {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
              {"internalType": "uint256", "name": "amountOutMinimum", "type": "uint256"},
              {"internalType": "uint160", "name": "sqrtPriceLimitX96", "type": "uint160"}
            ],
            "internalType": "struct ISwapRouter.ExactInputSingleParams",
            "name": "params",
            "type": "tuple"
          }
        ],
        "name": "exactInputSingle",
        "outputs": [{"internalType": "uint256", "name": "amountOut", "type": "uint256"}],
        "stateMutability": "payable",
        "type": "function"
      }
    ];
    
    this.routerContract = new ethers.Contract(this.UNISWAP_V3_ROUTER, this.ROUTER_ABI, this.provider);
  }

  /**
   * EXECUTE DIRECT UNISWAP V3 SWAP
   * Uses official Uniswap V3 Router with exactInputSingle
   */
  async executeDirectSwap(wallet, tokenAddress, amountETH, tokenInfo) {
    console.log(`🌊 ========== DIRECT UNISWAP V3 SYSTEM ==========`);
    console.log(`🎯 Token: ${tokenAddress}`);
    console.log(`💰 Amount: ${amountETH} ETH`);
    console.log(`⚡ Method: Official Uniswap V3 Router exactInputSingle`);
    console.log(`🏦 Router: ${this.UNISWAP_V3_ROUTER}`);
    
    try {
      // Step 1: Calculate parameters
      const ethAmountWei = ethers.utils.parseEther(amountETH.toString());
      const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes
      
      // Step 2: Calculate expected output and minOut with 20% slippage
      const expectedTokens = ethers.utils.parseUnits('34.11', 18); // Known TONY rate
      const slippageBps = 2000; // 20% slippage
      const minOut = expectedTokens.mul(10000 - slippageBps).div(10000);
      
      console.log(`📊 Expected tokens: ${ethers.utils.formatUnits(expectedTokens, 18)} TONY`);
      console.log(`🛡️ Minimum output: ${ethers.utils.formatUnits(minOut, 18)} TONY (20% slippage)`);
      console.log(`⏰ Deadline: ${new Date(deadline * 1000).toISOString()}`);
      
      // Step 3: Build exactInputSingle parameters
      const swapParams = {
        tokenIn: this.WETH,                    // WETH address
        tokenOut: tokenAddress,               // TONY address
        fee: 10000,                          // 1% fee tier (from pool analysis)
        recipient: wallet.address,            // Receive tokens to wallet
        deadline: deadline,                   // 5-minute deadline
        amountIn: ethAmountWei,              // 0.001 ETH
        amountOutMinimum: minOut,            // Minimum TONY with 20% slippage
        sqrtPriceLimitX96: 0                 // No price limit
      };
      
      console.log(`🔧 Swap Parameters:`);
      console.log(`  📥 Token In: ${swapParams.tokenIn} (WETH)`);
      console.log(`  📤 Token Out: ${swapParams.tokenOut} (TONY)`);
      console.log(`  💰 Amount In: ${ethers.utils.formatEther(swapParams.amountIn)} ETH`);
      console.log(`  🛡️ Min Out: ${ethers.utils.formatUnits(swapParams.amountOutMinimum, 18)} TONY`);
      console.log(`  💸 Fee: ${swapParams.fee / 10000}%`);
      
      // Step 4: Execute the swap
      console.log(`🚀 Executing direct Uniswap V3 swap...`);
      
      const tx = await this.routerContract.connect(wallet).exactInputSingle(swapParams, {
        value: ethAmountWei,
        gasLimit: 800000,
        gasPrice: (await this.provider.getGasPrice()).mul(150).div(100) // 50% higher gas price
      });
      
      console.log(`📝 Transaction hash: ${tx.hash}`);
      console.log(`⏳ Waiting for confirmation...`);
      
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        console.log(`✅ Direct Uniswap V3 swap successful!`);
        console.log(`🎉 Transaction confirmed in block ${receipt.blockNumber}`);
        console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`);
        
        return {
          success: true,
          hash: tx.hash,
          receipt: receipt,
          method: 'Direct Uniswap V3 Router'
        };
      } else {
        console.log(`❌ Transaction failed`);
        return {
          success: false,
          hash: tx.hash,
          receipt: receipt,
          error: 'Transaction reverted'
        };
      }
      
    } catch (error) {
      console.log(`❌ Direct Uniswap V3 swap failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = DirectUniswapSystem;