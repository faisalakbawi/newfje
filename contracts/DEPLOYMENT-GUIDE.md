# 🚀 EXACT LOOTER BOT CONTRACT DEPLOYMENT GUIDE

## **QUICK DEPLOYMENT USING REMIX IDE**

### **STEP 1: Open Remix IDE**
1. Go to: https://remix.ethereum.org/
2. Create new file: `ExactLooterBot.sol`
3. Copy the contract code from `ExactLooterBot.sol`

### **STEP 2: Compile Contract**
1. Go to "Solidity Compiler" tab
2. Select compiler version: `0.8.19` or higher
3. Click "Compile ExactLooterBot.sol"
4. Ensure no errors

### **STEP 3: Deploy to Base Network**
1. Go to "Deploy & Run Transactions" tab
2. Select Environment: "Injected Provider - MetaMask"
3. Make sure MetaMask is connected to **Base Network**
4. Select contract: `ExactLooterBot`
5. Click "Deploy"
6. Confirm transaction in MetaMask

### **STEP 4: Get Contract Address**
1. After deployment, copy the contract address
2. Verify on BaseScan: https://basescan.org/
3. Update the bot configuration

### **STEP 5: Update Bot Configuration**
Replace the mock address in `base-trading.js`:

```javascript
// Replace this line:
const DEPLOYED_LOOTER_CONTRACT = '0x1234567890123456789012345678901234567890'; // Mock address

// With your real deployed address:
const DEPLOYED_LOOTER_CONTRACT = '0xYOUR_REAL_CONTRACT_ADDRESS_HERE';
```

## **BASE NETWORK CONFIGURATION**

### **MetaMask Base Network Settings:**
- **Network Name**: Base
- **RPC URL**: https://base.llamarpc.com
- **Chain ID**: 8453
- **Currency Symbol**: ETH
- **Block Explorer**: https://basescan.org/

### **Required ETH for Deployment:**
- **Gas Cost**: ~0.005-0.01 ETH
- **Recommended Balance**: 0.02 ETH minimum

## **CONTRACT VERIFICATION (Optional)**

After deployment, verify on BaseScan:
1. Go to your contract on BaseScan
2. Click "Contract" tab
3. Click "Verify and Publish"
4. Upload the source code
5. Set compiler version to match Remix

## **TESTING THE DEPLOYED CONTRACT**

Once deployed, test with:

```bash
node test-exact-looter-contract.js
```

## **CONTRACT FUNCTIONS**

### **Main Function (Like Professional Looters):**
```solidity
function execBuy(address token) external payable onlyOwner
```

### **View Functions:**
```solidity
function hasLiquidity(address token) external view returns (bool)
function getLiquidityInfo(address token) external view returns (address, uint256, uint256, bool)
```

### **Emergency Functions:**
```solidity
function emergencyWithdrawETH() external onlyOwner
function emergencyWithdrawToken(address token) external onlyOwner
```

## **SECURITY NOTES**

- ✅ Only contract owner can call `execBuy()`
- ✅ Built-in liquidity checking
- ✅ Honeypot protection via balance verification
- ✅ Emergency withdrawal functions
- ✅ Exact same logic as professional Looter bots

## **NEXT STEPS AFTER DEPLOYMENT**

1. ✅ Deploy contract to Base network
2. ✅ Update bot configuration with real address
3. ✅ Test with small amounts first
4. ✅ Verify contract on BaseScan
5. ✅ Monitor transactions and gas usage

**The contract will then execute the exact same `execBuy()` function as professional Looter bots!**