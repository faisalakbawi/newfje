/**
 * Configuration for Base Trading Bot
 * Simplified approach with RPC rotation support
 */

require('dotenv').config();

const config = {
  // Telegram Bot Configuration
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  
  // Private Key (with 0x prefix handling)
  pk: (() => {
    const key = process.env.PRIVATE_KEY || '';
    return key.startsWith('0x') ? key : `0x${key}`;
  })(),
  
  // RPC List with rotation support
  rpcList: (process.env.RPC_LIST || 'https://mainnet.base.org')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
  
  // Trading Configuration
  defaultSlippageBps: Number(process.env.DEFAULT_SLIPPAGE_BPS || '100'), // 1%
  defaultFeeTier: Number(process.env.DEFAULT_FEE_TIER || '3000'), // 0.3%
  
  // Admin Configuration
  adminId: Number(process.env.ADMIN_TELEGRAM_ID || '0'),
  
  // Network Configuration
  timeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || '15000'),
  retryAttempts: Number(process.env.RETRY_ATTEMPTS || '3'),
  
  // Base Network Constants
  base: {
    chainId: 8453,
    name: 'Base',
    symbol: 'ETH',
    explorer: 'https://basescan.org',
    
    // Uniswap V3 Contracts on Base
    contracts: {
      swapRouter: '0x2626664c2603336E57B271c5C0b26F421741e481',
      quoterV2: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
      factory: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
      weth: '0x4200000000000000000000000000000000000006'
    }
  }
};

// Validation
if (!config.botToken) {
  throw new Error('TELEGRAM_BOT_TOKEN missing in .env file');
}

if (!config.pk || config.pk.length < 10) {
  throw new Error('PRIVATE_KEY missing in .env file');
}

console.log('🔧 Configuration loaded:');
console.log(`  📱 Bot Token: ${config.botToken ? 'Set' : 'Missing'}`);
console.log(`  🔑 Private Key: ${config.pk ? 'Set' : 'Missing'}`);
console.log(`  🌐 RPC Endpoints: ${config.rpcList.length}`);
console.log(`  📊 Default Slippage: ${config.defaultSlippageBps / 100}%`);
console.log(`  🏊 Default Fee Tier: ${config.defaultFeeTier / 10000}%`);

module.exports = config;