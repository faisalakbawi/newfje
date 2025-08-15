/**
 * DIRECT TRADE DEBUG TEST
 * Tests tieredExecBuy without Telegram interface
 */

require('dotenv').config();
const BaseTrading = require('./src/services/base-trading');

async function testTrade() {
  console.log('🧪 Starting direct trade test...');
  
  try {
    // Initialize BaseTrading
    const baseTrading = new BaseTrading();
    console.log('✅ BaseTrading initialized');
    
    // Test parameters (same as your Telegram test)
    const privateKey = process.env.PRIVATE_KEY;
    const tokenAddress = '0x36A947Baa2492C72Bf9D3307117237E79145A87d'; // TONY
    const amount = '0.001'; // 0.001 ETH
    const slippage = 25; // 25%
    const userId = 6537510183; // Your Telegram ID
    const speedTier = 'fast'; // 0.5% fee
    
    console.log('🎯 Test Parameters:');
    console.log(`  Token: ${tokenAddress}`);
    console.log(`  Amount: ${amount} ETH`);
    console.log(`  Speed: ${speedTier} (0.5% fee)`);
    console.log(`  User ID: ${userId}`);
    
    console.log('🚀 Calling execBuyWithFee...');
    
    // Calculate fee info (0.5% fee for fast tier)
    const feePercent = speedTier === 'fast' ? 0.5 : speedTier === 'instant' ? 1.0 : 0.3;
    const grossAmount = parseFloat(amount);
    const feeAmount = grossAmount * (feePercent / 100);
    const netAmount = grossAmount - feeAmount;
    
    console.log(`💰 Fee calculation: ${grossAmount} ETH - ${feeAmount} ETH = ${netAmount} ETH`);
    
    // Add 10-second timeout for quick test
    const result = await Promise.race([
      baseTrading.execBuyWithFee({
        privateKey: privateKey,
        tokenOut: tokenAddress,
        amountEth: grossAmount,
        slippageBps: slippage * 100, // 25% = 2500 basis points
        feeTier: 3000, // 0.3% pool fee
        userTier: speedTier.toUpperCase() + '_TIER',
        feeInfo: {
          feeAmount: feeAmount,
          netAmount: netAmount,
          feePercent: feePercent
        },
        gasSettings: {
          gasPrice: 1000000000, // 1 gwei
          gasLimit: 300000
        }
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT: 10 seconds')), 10000)
      )
    ]);
    
    console.log('✅ Trade completed!');
    console.log('📊 Result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ Trade failed:', error.message);
    console.error('📍 Error stack:', error.stack);
  }
  
  console.log('🏁 Test complete');
  process.exit(0);
}

testTrade();