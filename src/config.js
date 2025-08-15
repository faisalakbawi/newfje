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
      weth: '0x4200000000000000000000000000000000000006',
      // NEW: BaseV3Swapper for single-tx swap + fee collection
      baseV3Swapper: process.env.BASE_V3_SWAPPER_ADDRESS || '0x4b7cA3F2BFA2c4E9f000000000000000000000000' // Replace with actual deployed address
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

// DEX Map for Base Network (used by DEX Aggregator)
config.dexMap = {
  uniswapV3: {
    name: 'Uniswap V3',
    factory: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
    quoter: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
    router: '0x2626664c2603336E57B271c5C0b26F421741e481',
    fees: [500, 3000, 10000]
  },
  aerodrome: {
    name: 'Aerodrome',
    factory: '0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A',
    quoter: '0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A',
    router: '0xcF77a3Ba9A5Ca399B7C97c74d54e6b744631f8cA',
    fees: [100, 500, 2500, 10000]
  },
  sushiswap: {
    name: 'SushiSwap V3',
    factory: '0x7169d38820dfd117C3FA1f22a7d5A3D26Ee16AD3',
    quoter: '0x64b5b0e5B77FbD1e7f1c6b3EA0B9f0B3Bc4B5d5C',
    router: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b4799756',
    fees: [500, 3000, 10000]
  },
  baseswap: {
    name: 'BaseSwap',
    factory: '0xFDa619b6d2095bE1B8a32124C59c6a7bF5b7E6D5',
    quoter: '0xFDa619b6d2095bE1B8a32124C59c6a7bF5b7E6D5',
    router: '0x327Df1E6de05895d2ab08513aaDD9313Fe505d86',
    fees: [500, 3000, 10000]
  },
  pancakeswap: {
    name: 'PancakeSwap V3',
    factory: '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865',
    quoter: '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997',
    router: '0x1b81D678ffb9C0263b24A97847620C99d213eB14',
    fees: [100, 500, 2500, 10000]
  }
};

module.exports = config;