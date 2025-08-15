/**
 * FEE TRANSFER MANAGER
 * Handles actual transfer of collected fees to treasury wallet
 * This is where the money actually goes to your wallet!
 */

const { ethers } = require('ethers');
const rpcManager = require('./rpc-manager');

class FeeTransferManager {
  constructor() {
    this.treasuryWallet = process.env.TREASURY_WALLET;
    this.feeCollectionEnabled = process.env.FEE_COLLECTION_ENABLED === 'true';
    this.autoTransfer = process.env.AUTO_FEE_TRANSFER === 'true';
    this.minTransferAmount = parseFloat(process.env.MIN_FEE_TRANSFER || '0.001');
    
    console.log('💰 Fee Transfer Manager initialized');
    console.log(`💳 Treasury wallet: ${this.treasuryWallet}`);
    console.log(`🔄 Auto transfer: ${this.autoTransfer ? 'enabled' : 'disabled'}`);
    console.log(`💵 Min transfer: ${this.minTransferAmount} ETH`);
    
    if (!this.treasuryWallet || this.treasuryWallet === '0x742d35Cc4Bd4E1C3a29c7c2F7b2C7A8D7E2C8E2F') {
      console.warn('⚠️ IMPORTANT: Update TREASURY_WALLET in .env to your actual wallet address!');
    }
  }

  // =====================================================
  // MAIN FEE TRANSFER METHOD
  // =====================================================
  
  async transferFeeToTreasury(fromWallet, feeAmount, metadata = {}) {
    if (!this.feeCollectionEnabled) {
      console.log('💰 Fee collection disabled, skipping transfer');
      return { success: true, skipped: true, reason: 'disabled' };
    }

    if (feeAmount < this.minTransferAmount) {
      console.log(`💰 Fee amount ${feeAmount} ETH below minimum ${this.minTransferAmount} ETH, skipping transfer`);
      return { success: true, skipped: true, reason: 'below_minimum', feeAmount, minAmount: this.minTransferAmount };
    }

    try {
      console.log(`💸 TRANSFERRING FEE TO TREASURY`);
      console.log(`  📤 From: ${fromWallet.address}`);
      console.log(`  📥 To: ${this.treasuryWallet}`);
      console.log(`  💰 Amount: ${feeAmount} ETH`);
      console.log(`  🏷️ User Tier: ${metadata.userTier || 'unknown'}`);

      // Check balance before transfer
      const balance = await fromWallet.getBalance();
      const feeAmountWei = ethers.utils.parseEther(feeAmount.toString());
      
      if (balance.lt(feeAmountWei)) {
        throw new Error(`Insufficient balance for fee transfer: ${ethers.utils.formatEther(balance)} ETH available, ${feeAmount} ETH required`);
      }

      // Get current gas price
      const gasPrice = await fromWallet.provider.getGasPrice();
      const gasLimit = ethers.BigNumber.from('21000'); // Standard ETH transfer
      const gasFee = gasPrice.mul(gasLimit);
      
      console.log(`⛽ Gas fee for transfer: ${ethers.utils.formatEther(gasFee)} ETH`);

      // Check if we have enough for fee + gas
      const totalRequired = feeAmountWei.add(gasFee);
      if (balance.lt(totalRequired)) {
        console.log(`⚠️ Insufficient balance for fee + gas, adjusting fee amount`);
        const adjustedFee = balance.sub(gasFee);
        if (adjustedFee.gt(0)) {
          feeAmountWei = adjustedFee;
          feeAmount = parseFloat(ethers.utils.formatEther(adjustedFee));
          console.log(`💰 Adjusted fee amount: ${feeAmount} ETH`);
        } else {
          throw new Error('Insufficient balance to cover gas fee');
        }
      }

      // Execute fee transfer
      const tx = await fromWallet.sendTransaction({
        to: this.treasuryWallet,
        value: feeAmountWei,
        gasLimit: gasLimit,
        gasPrice: gasPrice
      });

      console.log(`📤 Fee transfer transaction sent: ${tx.hash}`);
      console.log(`⏳ Waiting for confirmation...`);

      // Wait for confirmation
      const receipt = await tx.wait();
      
      console.log(`✅ FEE TRANSFER SUCCESSFUL!`);
      console.log(`💳 Treasury received: ${feeAmount} ETH`);
      console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`);
      console.log(`🔗 Transaction: https://basescan.org/tx/${tx.hash}`);

      return {
        success: true,
        skipped: false,
        txHash: tx.hash,
        feeAmount: feeAmount,
        treasuryWallet: this.treasuryWallet,
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber,
        explorerUrl: `https://basescan.org/tx/${tx.hash}`
      };

    } catch (error) {
      console.error(`❌ Fee transfer failed:`, error.message);
      
      return {
        success: false,
        error: error.message,
        feeAmount: feeAmount,
        treasuryWallet: this.treasuryWallet
      };
    }
  }

  // =====================================================
  // BATCH FEE COLLECTION (for accumulated fees)
  // =====================================================
  
  async collectAccumulatedFees(userWallet) {
    try {
      console.log(`🔄 Checking for accumulated fees to collect...`);
      
      // In a more advanced setup, you could track accumulated fees per wallet
      // and batch transfer them periodically to save on gas
      
      const balance = await userWallet.getBalance();
      console.log(`💰 Wallet balance: ${ethers.utils.formatEther(balance)} ETH`);
      
      // For now, this is a placeholder for batch collection logic
      // You could implement:
      // 1. Track accumulated fees in database per wallet
      // 2. Periodically sweep fees when they reach a threshold
      // 3. Batch multiple fee transfers to reduce gas costs
      
      return {
        success: true,
        message: 'Batch collection feature ready for implementation'
      };
      
    } catch (error) {
      console.error(`❌ Error collecting accumulated fees:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // =====================================================
  // TREASURY WALLET MANAGEMENT
  // =====================================================
  
  async getTreasuryBalance() {
    try {
      return await rpcManager.executeWithRetry(async (provider) => {
        const balance = await provider.getBalance(this.treasuryWallet);
        return {
          balance: parseFloat(ethers.utils.formatEther(balance)),
          balanceWei: balance.toString(),
          wallet: this.treasuryWallet
        };
      });
    } catch (error) {
      console.error(`❌ Error getting treasury balance:`, error.message);
      return {
        balance: 0,
        error: error.message
      };
    }
  }

  async validateTreasuryWallet() {
    try {
      // Check if treasury wallet is a valid address
      if (!ethers.utils.isAddress(this.treasuryWallet)) {
        return {
          valid: false,
          error: 'Treasury wallet is not a valid Ethereum address'
        };
      }

      // Check if treasury wallet can receive ETH (not a contract with restrictions)
      const balance = await this.getTreasuryBalance();
      
      return {
        valid: true,
        address: this.treasuryWallet,
        currentBalance: balance.balance,
        message: 'Treasury wallet is valid and ready to receive fees'
      };
      
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  // =====================================================
  // CONFIGURATION METHODS
  // =====================================================
  
  updateTreasuryWallet(newAddress) {
    if (!ethers.utils.isAddress(newAddress)) {
      throw new Error('Invalid treasury wallet address');
    }
    
    this.treasuryWallet = newAddress;
    console.log(`💳 Treasury wallet updated to: ${newAddress}`);
  }

  setAutoTransfer(enabled) {
    this.autoTransfer = enabled;
    console.log(`🔄 Auto transfer ${enabled ? 'enabled' : 'disabled'}`);
  }

  setMinTransferAmount(amount) {
    this.minTransferAmount = amount;
    console.log(`💵 Min transfer amount set to: ${amount} ETH`);
  }

  getConfig() {
    return {
      treasuryWallet: this.treasuryWallet,
      feeCollectionEnabled: this.feeCollectionEnabled,
      autoTransfer: this.autoTransfer,
      minTransferAmount: this.minTransferAmount
    };
  }

  // NEW: Get treasury address (for BaseV3Swapper)
  getTreasuryAddress() {
    return this.treasuryWallet || '0x8825268025Bf3680789c25Fc5a2453668757dc54';
  }
}

module.exports = FeeTransferManager;