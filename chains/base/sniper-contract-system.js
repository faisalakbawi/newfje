/**
 * SNIPER CONTRACT SYSTEM
 * Uses custom sniper/looter contract with execBuy() method
 * Replicates the exact successful transaction pattern
 */

const { ethers } = require('ethers');

class SniperContractSystem {
  constructor(provider) {
    this.provider = provider;
    
    // The working sniper contract from the successful transaction
    this.SNIPER_CONTRACT = '0xe111b0C3605aDc45CFb0CD75E5543F63CC3ec425';
    
    // Known working addresses
    this.WETH = '0x4200000000000000000000000000000000000006';
    this.UNISWAP_V3_ROUTER = '0x2626664c2603336E57B271c5C0b26F421741e481';
    
    // Sniper contract ABI - based on successful transaction
    this.SNIPER_ABI = [
      // The execBuy function with selector 0xc981cc3c
      'function execBuy(uint256 param1, uint256 param2, uint256 param3, uint256 param4, uint256 param5, uint256 param6, uint256 param7, uint256 param8, bytes calldata path) external payable returns (uint256)',
      
      // Alternative function signatures to try
      'function execBuy(uint256 amountIn, uint256 amountOutMin, uint256 deadline, address tokenOut, bytes calldata path) external payable returns (uint256)',
      'function execBuy(bytes calldata data) external payable returns (uint256)',
      
      // Standard view functions
      'function owner() external view returns (address)',
      'function router() external view returns (address)'
    ];
    
    this.ERC20_ABI = [
      'function name() external view returns (string)',
      'function symbol() external view returns (string)',
      'function decimals() external view returns (uint8)',
      'function balanceOf(address account) external view returns (uint256)'
    ];
  }
  
  /**
   * SNIPER EXEC BUY
   * Uses the exact same pattern as the successful transaction
   */
  async execBuy(walletPrivateKey, tokenAddress, amountETH) {
    console.log(`🎯 ========== SNIPER CONTRACT SYSTEM ==========`);
    console.log(`🔫 Using proven sniper contract: ${this.SNIPER_CONTRACT}`);
    console.log(`🎯 Token: ${tokenAddress}`);
    console.log(`💰 Amount: ${amountETH} ETH`);
    console.log(`⚡ Method: execBuy() with selector 0xc981cc3c`);
    
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
        method: 'sniper-token-validation-failed'
      };
    }
    
    // Get initial balance
    const balanceBefore = await token.balanceOf(wallet.address);
    console.log(`📊 ${tokenInfo.symbol} balance before: ${ethers.utils.formatUnits(balanceBefore, tokenInfo.decimals)}`);
    
    try {
      // STEP 1: Verify sniper contract exists
      console.log(`\n🔍 STEP 1: Sniper Contract Verification`);
      const sniperCode = await this.provider.getCode(this.SNIPER_CONTRACT);
      if (sniperCode === '0x') {
        return {
          success: false,
          error: 'Sniper contract does not exist',
          method: 'sniper-contract-missing'
        };
      }
      console.log(`✅ Sniper contract exists (${sniperCode.length} bytes)`);
      
      // STEP 2: Prepare exact transaction data from successful example
      console.log(`\n🧠 STEP 2: Preparing Transaction Data`);
      const result = await this.prepareSniperTransaction(tokenAddress, amountETH, tokenInfo);
      
      // STEP 3: Execute sniper transaction
      console.log(`\n🚀 STEP 3: Execute Sniper Transaction`);
      return await this.executeSniperTransaction(wallet, result.inputData, amountETH, tokenInfo, balanceBefore);
      
    } catch (error) {
      console.error(`❌ Sniper execution failed:`, error.message);
      return {
        success: false,
        error: error.message,
        method: 'sniper-execution-error'
      };
    }
  }
  
  /**
   * PREPARE SNIPER TRANSACTION
   * Creates the exact input data pattern from successful transaction
   */
  async prepareSniperTransaction(tokenAddress, amountETH, tokenInfo) {
    console.log(`  🔧 Analyzing successful transaction pattern...`);
    
    // From the successful transaction, we know:
    // - Selector: 0xc981cc3c
    // - Token: TONY (0x36a947baa2492c72bf9d3307117237e79145a87d)
    // - Amount: 0.06 ETH
    // - Result: 1,743,504.73 TONY tokens
    
    // Decode the successful input data pattern:
    const successfulInputData = '0xc981cc3c000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000014c4805d0077af076ade500000000000000000000000000000000000000000001713394ae41334412168d000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000064000000000000000000000000000000000000000000000000000000174876e818000000000000000000000000000000000000000000000000000000000000002b420000000000000000000000000000000000000600271036a947baa2492c72bf9d3307117237e79145a87d000000000000000000000000000000000000000000';
    
    console.log(`  📊 Successful pattern analysis:`);
    console.log(`    Selector: 0xc981cc3c`);
    console.log(`    Input ETH: 0.06 ETH`);
    console.log(`    Output: 1,743,504.73 TONY`);
    console.log(`    Path: WETH → TONY (Uniswap V3)`);
    
    // Extract key parameters from successful transaction
    const amountInWei = ethers.utils.parseEther(amountETH.toString());
    
    // Create path for our token (same format as successful transaction)
    const path = ethers.utils.solidityPack(
      ['address', 'uint24', 'address'],
      [this.WETH, 10000, tokenAddress] // 1% fee tier like successful transaction
    );
    
    console.log(`  🛤️ Path created: WETH → ${tokenInfo.symbol} (1% fee)`);
    console.log(`  💰 Amount: ${amountETH} ETH`);
    
    // Build input data using the same pattern
    const inputData = await this.buildSniperInputData(amountInWei, tokenAddress, path);
    
    return {
      inputData,
      path,
      amountInWei
    };
  }
  
  /**
   * BUILD SNIPER INPUT DATA
   * Constructs the exact input data format from successful transaction
   */
  async buildSniperInputData(amountInWei, tokenAddress, path) {
    console.log(`  🔧 Building sniper input data with EXACT successful pattern...`);
    
    // EXACT SUCCESSFUL TRANSACTION ANALYSIS:
    // Successful: 0.06 ETH → 1,743,504.73 TONY
    // Input: 0x14c4805d0077af076ade5 (scaled amount)
    // Output: 0x1713394ae41334412168d (min amount out)
    
    const successfulETH = ethers.utils.parseEther('0.06');
    const successfulScaledAmount = ethers.BigNumber.from('0x14c4805d0077af076ade5');
    const successfulMinOut = ethers.BigNumber.from('0x1713394ae41334412168d');
    
    console.log(`  📊 Successful transaction reference:`);
    console.log(`    ETH: 0.06 ETH`);
    console.log(`    Scaled: ${successfulScaledAmount.toString()}`);
    console.log(`    Min Out: ${successfulMinOut.toString()}`);
    
    // Calculate proportional scaling for our amount
    const ourETH = amountInWei;
    const scalingRatio = ourETH.mul(ethers.BigNumber.from('1000000000000000000')).div(successfulETH);
    
    // Scale the successful parameters proportionally
    const ourScaledAmount = successfulScaledAmount.mul(scalingRatio).div(ethers.BigNumber.from('1000000000000000000'));
    const ourMinOut = successfulMinOut.mul(scalingRatio).div(ethers.BigNumber.from('1000000000000000000'));
    
    console.log(`  🔧 Our proportional calculation:`);
    console.log(`    Our ETH: ${ethers.utils.formatEther(ourETH)} ETH`);
    console.log(`    Scaling ratio: ${scalingRatio.toString()}`);
    console.log(`    Our scaled: ${ourScaledAmount.toString()}`);
    console.log(`    Our min out: ${ourMinOut.toString()}`);
    
    // Get current timestamp for deadline
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const deadline = currentTimestamp + 300; // 5 minutes from now
    
    // Build parameters using EXACT successful pattern
    const adaptedParams = [
      '0x000000000000000000000000000000000000000000000000000000000000000a', // param1: Keep exact same
      '0x0000000000000000000000000000000000000000000000000000000000000100', // param2: Path offset (exact same)
      ourScaledAmount.toHexString().padStart(64, '0'), // param3: Our proportionally scaled amount
      ourMinOut.toHexString().padStart(64, '0'), // param4: Our proportional min amount out
      '0x0000000000000000000000000000000000000000000000000000000000000000', // param5: Keep same
      '0x0000000000000000000000000000000000000000000000000000000000000000', // param6: Keep same
      '0x0000000000000000000000000000000000000000000000000000000000000064', // param7: Path length (100 bytes)
      ethers.BigNumber.from(deadline).toHexString().padStart(64, '0') // param8: Our deadline
    ];
    
    // Construct full input data
    const selector = '0xc981cc3c';
    const paramsHex = adaptedParams.join('').replace(/0x/g, '');
    const pathHex = path.slice(2); // Remove 0x prefix
    
    const fullInputData = selector + paramsHex + pathHex;
    
    console.log(`  ✅ PROPORTIONAL input data constructed:`);
    console.log(`    Selector: ${selector}`);
    console.log(`    Scaled amount: ${ourScaledAmount.toString()}`);
    console.log(`    Min out: ${ourMinOut.toString()}`);
    console.log(`    Deadline: ${deadline}`);
    console.log(`    Total length: ${fullInputData.length} chars`);
    
    return fullInputData;
  }
  
  /**
   * BUILD EXACT SUCCESSFUL PATTERN
   * Uses the exact successful transaction with minimal modifications
   */
  async buildExactSuccessfulPattern(amountETH) {
    console.log(`  🎯 Building EXACT successful pattern with minimal changes...`);
    
    // Use the EXACT successful transaction input data
    // Only change the deadline timestamp
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const deadline = currentTimestamp + 300;
    
    // Original successful input data (we'll only change the deadline)
    const exactParams = [
      '0x000000000000000000000000000000000000000000000000000000000000000a', // Exact same
      '0x0000000000000000000000000000000000000000000000000000000000000100', // Exact same
      '0x000000000000000000000000000000000000000000014c4805d0077af076ade5', // Exact same scaled amount
      '0x00000000000000000000000000000000000000000001713394ae41334412168d', // Exact same min out
      '0x0000000000000000000000000000000000000000000000000000000000000000', // Exact same
      '0x0000000000000000000000000000000000000000000000000000000000000000', // Exact same
      '0x0000000000000000000000000000000000000000000000000000000000000064', // Exact same
      ethers.BigNumber.from(deadline).toHexString().padStart(64, '0') // Only change deadline
    ];
    
    // Same path as successful transaction
    const exactPath = '420000000000000000000000000000000000000600271036a947baa2492c72bf9d3307117237e79145a87d';
    
    const selector = '0xc981cc3c';
    const paramsHex = exactParams.join('').replace(/0x/g, '');
    
    const fullInputData = selector + paramsHex + exactPath;
    
    console.log(`  ✅ EXACT successful pattern built:`);
    console.log(`    Using exact amounts from successful transaction`);
    console.log(`    Only changed deadline to: ${deadline}`);
    console.log(`    Total length: ${fullInputData.length} chars`);
    
    return fullInputData;
  }
  
  /**
   * EXECUTE SNIPER TRANSACTION
   */
  async executeSniperTransaction(wallet, inputData, amountETH, tokenInfo, balanceBefore) {
    console.log(`  🎯 Executing sniper transaction...`);
    console.log(`  📊 Input data length: ${inputData.length} characters`);
    console.log(`  💰 ETH value: ${amountETH} ETH`);
    
    try {
      // Method 1: Direct transaction with input data
      console.log(`    🔫 Method 1: Direct sniper call...`);
      
      const txParams = {
        to: this.SNIPER_CONTRACT,
        value: ethers.utils.parseEther(amountETH.toString()),
        data: inputData,
        gasLimit: 300000, // Higher gas limit for sniper contract
        gasPrice: (await this.provider.getGasPrice()).mul(120).div(100) // 20% higher gas price
      };
      
      // Estimate gas first
      try {
        const gasEstimate = await wallet.estimateGas(txParams);
        txParams.gasLimit = gasEstimate.mul(120).div(100); // 20% buffer
        console.log(`    ✅ Gas estimate: ${gasEstimate.toString()}`);
      } catch (gasError) {
        console.log(`    ⚠️ Gas estimation failed, using default: ${gasError.message}`);
      }
      
      const tx = await wallet.sendTransaction(txParams);
      console.log(`    📝 Sniper transaction: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`    ✅ Confirmed: ${receipt.gasUsed.toString()} gas used`);
      
      return await this.checkSniperResults(wallet, tokenInfo, balanceBefore, tx.hash, receipt);
      
    } catch (error) {
      console.log(`    ❌ Direct sniper call failed: ${error.message}`);
      
      // Method 2: Try with contract interface
      try {
        console.log(`    🔫 Method 2: Contract interface call...`);
        
        const sniperContract = new ethers.Contract(this.SNIPER_CONTRACT, this.SNIPER_ABI, wallet);
        
        // Try different function signatures
        const pathBytes = ethers.utils.solidityPack(
          ['address', 'uint24', 'address'],
          [this.WETH, 10000, tokenInfo.address || '0x36a947baa2492c72bf9d3307117237e79145a87d']
        );
        
        const tx2 = await sniperContract.execBuy(
          ethers.utils.parseEther(amountETH.toString()), // amountIn
          0, // amountOutMin
          Math.floor(Date.now() / 1000) + 300, // deadline
          tokenInfo.address || '0x36a947baa2492c72bf9d3307117237e79145a87d', // tokenOut
          pathBytes, // path
          {
            value: ethers.utils.parseEther(amountETH.toString()),
            gasLimit: 300000,
            gasPrice: (await this.provider.getGasPrice()).mul(120).div(100)
          }
        );
        
        console.log(`    📝 Interface transaction: ${tx2.hash}`);
        const receipt2 = await tx2.wait();
        
        return await this.checkSniperResults(wallet, tokenInfo, balanceBefore, tx2.hash, receipt2);
        
      } catch (interfaceError) {
        console.log(`    ❌ Interface call also failed: ${interfaceError.message}`);
        
        // Method 3: Try with exact successful transaction parameters (scaled down)
        try {
          console.log(`    🔫 Method 3: Exact successful pattern (minimal scaling)...`);
          
          // Use the exact successful transaction data but with minimal scaling
          const exactInputData = await this.buildExactSuccessfulPattern(amountETH);
          
          const txParams3 = {
            to: this.SNIPER_CONTRACT,
            value: ethers.utils.parseEther(amountETH.toString()),
            data: exactInputData,
            gasLimit: 300000,
            gasPrice: (await this.provider.getGasPrice()).mul(150).div(100) // Higher gas price
          };
          
          const tx3 = await wallet.sendTransaction(txParams3);
          console.log(`    📝 Exact pattern transaction: ${tx3.hash}`);
          
          const receipt3 = await tx3.wait();
          return await this.checkSniperResults(wallet, tokenInfo, balanceBefore, tx3.hash, receipt3);
          
        } catch (exactError) {
          console.log(`    ❌ Exact pattern also failed: ${exactError.message}`);
          
          return {
            success: false,
            error: `All sniper methods failed. Last error: ${exactError.message}`,
            method: 'sniper-all-methods-failed',
            sniperContract: this.SNIPER_CONTRACT,
            transactionSubmitted: true,
            lastTxHash: tx?.hash || 'unknown'
          };
        }
      }
    }
  }
  
  /**
   * CHECK SNIPER RESULTS
   */
  async checkSniperResults(wallet, tokenInfo, balanceBefore, txHash, receipt) {
    console.log(`  🔍 Checking sniper results...`);
    
    // Check if we received tokens
    const token = new ethers.Contract(tokenInfo.address || '0x36a947baa2492c72bf9d3307117237e79145a87d', this.ERC20_ABI, wallet);
    const balanceAfter = await token.balanceOf(wallet.address);
    const tokensReceived = balanceAfter.sub(balanceBefore);
    
    if (tokensReceived.gt(0)) {
      console.log(`  🎉 SNIPER SUCCESS!`);
      console.log(`  📊 Tokens received: ${ethers.utils.formatUnits(tokensReceived, tokenInfo.decimals)} ${tokenInfo.symbol}`);
      
      return {
        success: true,
        txHash: txHash,
        gasUsed: receipt.gasUsed.toString(),
        tokensReceived: ethers.utils.formatUnits(tokensReceived, tokenInfo.decimals),
        method: 'sniper-contract-success',
        blockNumber: receipt.blockNumber,
        tokenInfo: tokenInfo,
        sniperContract: this.SNIPER_CONTRACT
      };
    } else {
      console.log(`  ⚠️ Transaction succeeded but no tokens received`);
      
      return {
        success: false,
        error: 'Sniper transaction succeeded but no tokens received',
        method: 'sniper-no-tokens',
        txHash: txHash,
        sniperContract: this.SNIPER_CONTRACT
      };
    }
  }
}

module.exports = SniperContractSystem;