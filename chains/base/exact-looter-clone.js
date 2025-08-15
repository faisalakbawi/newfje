/**
 * EXACT LOOTER BOT CLONE
 * Replicates the EXACT technique used by professional Looter bots
 * Based on transaction: 0x1a48e98e1293308ef5e5715de033db093a0b64c7c9b162486d08e6d504ffc736
 */

const { ethers } = require('ethers');

class ExactLooterClone {
  constructor(provider) {
    this.provider = provider;
    
    // EXACT addresses from the successful transaction
    this.UNISWAP_V3_ROUTER = '0x2626664c2603336E57B271c5C0b26F421741e481'; // Base Uniswap V3
    this.WETH = '0x4200000000000000000000000000000000000006'; // WETH Base
    
    // Function signature from successful transaction
    this.EXEC_BUY_SIGNATURE = '0xc981cc3c'; // execBuy function
    
    // Router ABI for Uniswap V3
    this.ROUTER_ABI = [
      'function exactInput((bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum)) external payable returns (uint256 amountOut)',
      'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)'
    ];
    
    this.WETH_ABI = [
      'function deposit() external payable',
      'function withdraw(uint256) external',
      'function balanceOf(address) external view returns (uint256)',
      'function transfer(address, uint256) external returns (bool)',
      'function approve(address, uint256) external returns (bool)'
    ];
    
    this.ERC20_ABI = [
      'function balanceOf(address account) external view returns (uint256)',
      'function decimals() external view returns (uint8)',
      'function name() external view returns (string)',
      'function symbol() external view returns (string)'
    ];
  }
  
  /**
   * EXEC BUY - EXACT REPLICA OF PROFESSIONAL LOOTER BOTS
   */
  async execBuy(walletPrivateKey, tokenAddress, amountETH) {
    console.log(`🔥 ========== EXACT LOOTER BOT CLONE ==========`);
    console.log(`🎯 Token: ${tokenAddress}`);
    console.log(`💰 Amount: ${amountETH} ETH`);
    console.log(`🤖 Using EXACT professional Looter bot technique`);
    console.log(`📝 Function: execBuy() signature ${this.EXEC_BUY_SIGNATURE}`);
    
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
      // Method 1: Try Uniswap V3 direct swap (like the successful transaction)
      console.log(`\n🚀 EXEC BUY METHOD 1: Uniswap V3 Direct Swap`);
      const result1 = await this.uniswapV3DirectSwap(wallet, tokenAddress, amountETH, tokenInfo);
      
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
            method: 'exec-buy-uniswap-v3',
            blockNumber: result1.blockNumber,
            tokenInfo: tokenInfo
          };
        }
      }
      
      // Method 2: Try with path encoding (exact replica)
      console.log(`\n🚀 EXEC BUY METHOD 2: Path-Encoded Swap`);
      const result2 = await this.pathEncodedSwap(wallet, tokenAddress, amountETH, tokenInfo);
      
      if (result2.success) {
        const balanceAfter = await token.balanceOf(wallet.address);
        const tokensReceived = balanceAfter.sub(balanceBefore);
        
        if (tokensReceived.gt(0)) {
          console.log(`🎉 EXEC BUY SUCCESS (Path-Encoded)!`);
          console.log(`📊 ${tokenInfo.symbol} received: ${ethers.utils.formatUnits(tokensReceived, tokenInfo.decimals)}`);
          
          return {
            success: true,
            txHash: result2.txHash,
            gasUsed: result2.gasUsed,
            tokensReceived: ethers.utils.formatUnits(tokensReceived, tokenInfo.decimals),
            method: 'exec-buy-path-encoded',
            blockNumber: result2.blockNumber,
            tokenInfo: tokenInfo
          };
        }
      }
      
      return {
        success: false,
        error: `No liquidity found for ${tokenInfo.name} (${tokenInfo.symbol}) on Uniswap V3`,
        method: 'exec-buy-no-liquidity'
      };
      
    } catch (error) {
      console.error(`❌ Exec Buy failed:`, error.message);
      return {
        success: false,
        error: error.message,
        method: 'exec-buy-error'
      };
    }
  }
  
  /**
   * UNISWAP V3 DIRECT SWAP - EXACT METHOD FROM SUCCESSFUL TRANSACTION
   */
  async uniswapV3DirectSwap(wallet, tokenAddress, amountETH, tokenInfo) {
    try {
      console.log(`  📍 Using Uniswap V3 Router: ${this.UNISWAP_V3_ROUTER}`);
      
      const router = new ethers.Contract(this.UNISWAP_V3_ROUTER, this.ROUTER_ABI, wallet);
      
      // Try common fee tiers for Uniswap V3
      const feeTiers = [3000, 500, 10000]; // 0.3%, 0.05%, 1%
      
      for (const fee of feeTiers) {
        try {
          console.log(`    🎯 Trying fee tier: ${fee / 10000}%`);
          
          const params = {
            tokenIn: this.WETH,
            tokenOut: tokenAddress,
            fee: fee,
            recipient: wallet.address,
            deadline: Math.floor(Date.now() / 1000) + 300,
            amountIn: ethers.utils.parseEther(amountETH.toString()),
            amountOutMinimum: 0, // Looter style - accept any amount
            sqrtPriceLimitX96: 0
          };
          
          // Get gas estimate
          const gasEstimate = await router.estimateGas.exactInputSingle(params, {
            value: ethers.utils.parseEther(amountETH.toString())
          });
          
          console.log(`    ⛽ Gas estimate: ${gasEstimate.toString()}`);
          
          // Execute the swap
          const tx = await router.exactInputSingle(params, {
            value: ethers.utils.parseEther(amountETH.toString()),
            gasLimit: gasEstimate.mul(120).div(100), // 20% buffer
            gasPrice: await this.provider.getGasPrice()
          });
          
          console.log(`    📝 Transaction submitted: ${tx.hash}`);
          console.log(`    ⏳ Waiting for confirmation...`);
          
          const receipt = await tx.wait();
          console.log(`    ✅ Transaction confirmed in block ${receipt.blockNumber}`);
          console.log(`    ⛽ Gas used: ${receipt.gasUsed.toString()}`);
          
          return {
            success: true,
            txHash: tx.hash,
            gasUsed: receipt.gasUsed.toString(),
            blockNumber: receipt.blockNumber,
            fee: fee
          };
          
        } catch (error) {
          console.log(`    ❌ Fee tier ${fee / 10000}% failed:`, error.message);
          continue;
        }
      }
      
      throw new Error('All fee tiers failed');
      
    } catch (error) {
      console.log(`  ❌ Uniswap V3 direct swap failed:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * PATH-ENCODED SWAP - EXACT REPLICA OF PROFESSIONAL METHOD
   */
  async pathEncodedSwap(wallet, tokenAddress, amountETH, tokenInfo) {
    try {
      console.log(`  📍 Using path-encoded swap (professional method)`);
      
      const router = new ethers.Contract(this.UNISWAP_V3_ROUTER, this.ROUTER_ABI, wallet);
      
      // Create path: WETH -> (fee) -> Token
      // This is exactly how the professional Looter bot does it
      const fees = [3000, 500, 10000]; // Try different fee tiers
      
      for (const fee of fees) {
        try {
          console.log(`    🛤️ Creating path with fee: ${fee / 10000}%`);
          
          // Encode path: token0 (20 bytes) + fee (3 bytes) + token1 (20 bytes)
          const path = ethers.utils.solidityPack(
            ['address', 'uint24', 'address'],
            [this.WETH, fee, tokenAddress]
          );
          
          console.log(`    📝 Encoded path: ${path}`);
          
          const params = {
            path: path,
            recipient: wallet.address,
            deadline: Math.floor(Date.now() / 1000) + 300,
            amountIn: ethers.utils.parseEther(amountETH.toString()),
            amountOutMinimum: 0 // Looter style
          };
          
          // Get gas estimate
          const gasEstimate = await router.estimateGas.exactInput(params, {
            value: ethers.utils.parseEther(amountETH.toString())
          });
          
          console.log(`    ⛽ Gas estimate: ${gasEstimate.toString()}`);
          
          // Execute the swap
          const tx = await router.exactInput(params, {
            value: ethers.utils.parseEther(amountETH.toString()),
            gasLimit: gasEstimate.mul(120).div(100), // 20% buffer
            gasPrice: await this.provider.getGasPrice()
          });
          
          console.log(`    📝 Path-encoded transaction: ${tx.hash}`);
          const receipt = await tx.wait();
          console.log(`    ✅ Path-encoded confirmed: ${receipt.gasUsed.toString()} gas`);
          
          return {
            success: true,
            txHash: tx.hash,
            gasUsed: receipt.gasUsed.toString(),
            blockNumber: receipt.blockNumber,
            fee: fee,
            path: path
          };
          
        } catch (error) {
          console.log(`    ❌ Path with fee ${fee / 10000}% failed:`, error.message);
          continue;
        }
      }
      
      throw new Error('All path encodings failed');
      
    } catch (error) {
      console.log(`  ❌ Path-encoded swap failed:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * CHECK IF TOKEN HAS UNISWAP V3 LIQUIDITY
   */
  async hasUniswapV3Liquidity(tokenAddress) {
    try {
      const router = new ethers.Contract(this.UNISWAP_V3_ROUTER, this.ROUTER_ABI, this.provider);
      const fees = [3000, 500, 10000];
      
      for (const fee of fees) {
        try {
          const params = {
            tokenIn: this.WETH,
            tokenOut: tokenAddress,
            fee: fee,
            recipient: ethers.constants.AddressZero,
            deadline: Math.floor(Date.now() / 1000) + 300,
            amountIn: ethers.utils.parseEther('0.001'),
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
          };
          
          // Try to estimate gas - if it works, liquidity exists
          await router.estimateGas.exactInputSingle(params, {
            value: ethers.utils.parseEther('0.001')
          });
          
          return { hasLiquidity: true, fee: fee };
          
        } catch (error) {
          continue;
        }
      }
      
      return { hasLiquidity: false };
      
    } catch (error) {
      return { hasLiquidity: false };
    }
  }
}

module.exports = ExactLooterClone;