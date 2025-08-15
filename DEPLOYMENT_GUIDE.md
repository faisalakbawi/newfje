# BaseV3Swapper Single-Transaction Deployment Guide

## 🚀 Overview

You've successfully retrofitted your Looter trading bot with the **BaseV3Swapper** single-transaction pattern! This update combines swap execution and fee collection into a single atomic transaction, improving efficiency and reducing gas costs.

## 📋 What Changed

### 1. **Contract Layer**
- **New**: `contracts/BaseV3Swapper.sol` - Single-transaction swap + fee collection
- **Features**: Multicall, emergency functions, fee collection

### 2. **Service Layer Updates**
- **Updated**: `src/services/base-trading.js` - Uses BaseV3Swapper for single-tx execution
- **Updated**: `src/services/fee-transfer-manager.js` - Added `getTreasuryAddress()` method
- **Updated**: `src/config.js` - Added BaseV3Swapper contract address

### 3. **UI Layer Updates**
- **Updated**: `callbacks/callbacks.js` - Uses new single-tx execution flow
- **Maintained**: All existing UI flows (wallet selection, amounts, speed tiers)

## 🛠️ Deployment Steps

### Step 1: Deploy BaseV3Swapper Contract

```bash
# 1. Navigate to contracts directory
cd contracts/

# 2. Install dependencies (if using Hardhat/Truffle)
npm install @openzeppelin/contracts

# 3. Deploy contract to Base mainnet
# Replace with your preferred deployment method:

# Using Remix IDE:
# - Copy BaseV3Swapper.sol to Remix
# - Compile with Solidity 0.8.0+
# - Deploy to Base mainnet
# - Copy deployed contract address

# Using Hardhat:
npx hardhat run scripts/deploy-basev3swapper.js --network base

# Using Foundry:
forge create BaseV3Swapper --rpc-url https://mainnet.base.org --private-key YOUR_DEPLOYER_KEY
```

### Step 2: Update Environment Configuration

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Update the new configuration variables
nano .env
```

**Key Environment Variables to Update:**

```bash
# Replace with your deployed contract address
BASE_V3_SWAPPER_ADDRESS=0x4b7cA3F2BFA2c4E9f123456789abcdef12345678

# CRITICAL: Update to YOUR treasury wallet address
TREASURY_WALLET=0xYourActualTreasuryWalletAddress

# Fee collection settings
FEE_COLLECTION_ENABLED=true
AUTO_FEE_TRANSFER=true
MIN_FEE_TRANSFER=0.001
```

### Step 3: Test the Integration

```bash
# 1. Start the bot
npm start

# 2. Test the buy flow:
# - Send any Base token contract address
# - Go through the normal buy flow
# - Click CONFIRM
# - Check that you see "BaseV3Swapper single-tx" in logs

# 3. Verify on BaseScan:
# - One transaction should show both:
#   - Swap event (WETH → Token)
#   - Transfer event (Fee → Treasury)
```

## 🧪 Testing Checklist

### ✅ Pre-Deployment Tests
- [ ] Contract compiles without errors
- [ ] All existing bot functionality works
- [ ] Environment variables are set correctly
- [ ] Treasury wallet address is YOUR wallet

### ✅ Post-Deployment Tests
- [ ] Bot starts without errors
- [ ] Buy token flow works end-to-end
- [ ] Single transaction includes both swap and fee transfer
- [ ] Fees appear in your treasury wallet
- [ ] No errors in bot logs

### ✅ Production Verification
- [ ] Monitor first few trades closely
- [ ] Verify fee collection is working
- [ ] Check treasury wallet balance increases
- [ ] Test with different speed tiers (Standard/Fast/Instant)

## 🔍 How It Works

### Before (2 Transactions)
```
User clicks CONFIRM →
1. Transaction 1: Swap WETH → Token
2. Transaction 2: Transfer fee to treasury
```

### After (1 Transaction)
```
User clicks CONFIRM →
1. Transaction: Multicall[Swap WETH → Token, Transfer fee to treasury]
```

### Fee Flow
```
User sends 0.1 ETH →
- Fee deducted: 0.001 ETH (1% instant tier)
- Net traded: 0.099 ETH
- Fee automatically goes to treasury in same TX
```

## 🛡️ Security Considerations

### Contract Security
- ✅ ReentrancyGuard protection
- ✅ Ownable for emergency functions
- ✅ Input validation on all functions
- ✅ Emergency withdrawal capabilities

### Operational Security
- 🔒 Keep treasury wallet private key secure
- 🔒 Monitor fee collection regularly
- 🔒 Set reasonable MIN_FEE_TRANSFER limits
- 🔒 Test on small amounts first

## 🚨 Rollback Plan

If anything goes wrong, you can quickly rollback:

```bash
# 1. Stop the bot
ctrl+c

# 2. Revert the base-trading.js changes
git checkout HEAD~1 -- src/services/base-trading.js

# 3. Restart with old system
npm start
```

The old 2-transaction system will work as before.

## 💰 Revenue Benefits

### Improved Efficiency
- **Reduced Gas Costs**: Users pay less gas (1 tx vs 2 tx)
- **Better UX**: Faster execution, single confirmation
- **Atomic Operations**: Fee collection can't fail separately

### Revenue Tracking
- All fees are collected in single transactions
- Easier to track and audit revenue
- Immediate fee settlement (no pending transfers)

## 📊 Monitoring

### Key Metrics to Monitor
```bash
# Check treasury wallet balance
# Monitor bot logs for "BaseV3Swapper single-tx completed"
# Verify BaseScan shows multicall transactions
# Track fee collection rates by speed tier
```

### Log Messages to Watch For
```bash
✅ "BaseV3Swapper single-tx completed successfully!"
✅ "Fee collected in same transaction: X ETH → Treasury"
❌ "BaseV3Swapper exec buy failed:" (investigate)
```

## 🎯 Next Steps

1. **Deploy**: Deploy BaseV3Swapper contract
2. **Configure**: Update environment variables
3. **Test**: Run thorough testing on small amounts
4. **Monitor**: Watch first few trades closely
5. **Scale**: Gradually increase trading volumes
6. **Optimize**: Monitor and optimize gas settings

## 🆘 Support

If you encounter issues:

1. **Check Logs**: Look for specific error messages
2. **Verify Config**: Ensure all environment variables are correct
3. **Test Contract**: Make sure BaseV3Swapper is deployed correctly
4. **Rollback**: Use the rollback plan if needed

## 🎉 Success!

You now have a **professional-grade single-transaction trading bot** with integrated fee collection! Your users get better UX, and you get more efficient revenue collection.

**Key Benefits Achieved:**
- ✅ Single transaction execution
- ✅ Automatic fee collection
- ✅ Reduced gas costs for users
- ✅ Better revenue tracking
- ✅ Atomic operations (no partial failures)
- ✅ Professional-grade architecture
