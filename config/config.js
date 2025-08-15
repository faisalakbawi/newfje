/**
 * LOOTER.AI CLONE - CONFIGURATION
 * All supported chains exactly like Looter.ai
 */

class Config {
  constructor() {
    this.chains = this.getSupportedChains();
    this.settings = this.getDefaultSettings();
  }

  // All chains supported by Looter.ai
  getSupportedChains() {
    return {
      ethereum: {
        id: 1,
        name: 'Ethereum',
        symbol: 'ETH',
        icon: '🟣',
        rpc: 'https://eth.llamarpc.com',
        explorer: 'https://etherscan.io',
        dex: 'Uniswap V3',
        gasPrice: 'high'
      },
      base: {
        id: 8453,
        name: 'Base',
        symbol: 'ETH',
        icon: '🔵',
        rpc: 'https://mainnet.base.org',
        explorer: 'https://basescan.org',
        dex: 'Uniswap V3',
        gasPrice: 'low'
      },
      bsc: {
        id: 56,
        name: 'BNB Smart Chain',
        symbol: 'BNB',
        icon: '🟡',
        rpc: 'https://bsc-dataseed1.binance.org',
        explorer: 'https://bscscan.com',
        dex: 'PancakeSwap V3',
        gasPrice: 'low'
      },
      arbitrum: {
        id: 42161,
        name: 'Arbitrum One',
        symbol: 'ETH',
        icon: '🔷',
        rpc: 'https://arb1.arbitrum.io/rpc',
        explorer: 'https://arbiscan.io',
        dex: 'Uniswap V3',
        gasPrice: 'low'
      },
      polygon: {
        id: 137,
        name: 'Polygon',
        symbol: 'MATIC',
        icon: '🟣',
        rpc: 'https://polygon-rpc.com',
        explorer: 'https://polygonscan.com',
        dex: 'Uniswap V3',
        gasPrice: 'low'
      },
      avalanche: {
        id: 43114,
        name: 'Avalanche',
        symbol: 'AVAX',
        icon: '🔴',
        rpc: 'https://api.avax.network/ext/bc/C/rpc',
        explorer: 'https://snowtrace.io',
        dex: 'Trader Joe',
        gasPrice: 'medium'
      },
      solana: {
        id: 'solana',
        name: 'Solana',
        symbol: 'SOL',
        icon: '🟢',
        rpc: 'https://api.mainnet-beta.solana.com',
        explorer: 'https://solscan.io',
        dex: 'Jupiter',
        gasPrice: 'low'
      },
      blast: {
        id: 81457,
        name: 'Blast',
        symbol: 'ETH',
        icon: '💥',
        rpc: 'https://rpc.blast.io',
        explorer: 'https://blastscan.io',
        dex: 'Uniswap V3',
        gasPrice: 'medium'
      },
      optimism: {
        id: 10,
        name: 'Optimism',
        symbol: 'ETH',
        icon: '🔴',
        rpc: 'https://mainnet.optimism.io',
        explorer: 'https://optimistic.etherscan.io',
        dex: 'Uniswap V3',
        gasPrice: 'low'
      }
    };
  }

  getDefaultSettings() {
    return {
      defaultChain: 'base',
      defaultSlippage: 1.0,
      defaultGasLimit: 500000,
      maxWallets: 5,
      autoRefresh: true,
      refreshInterval: 12000, // 12 seconds like Looter.ai
      expertMode: true,
      mevProtection: true
    };
  }

  getChain(chainId) {
    return this.chains[chainId] || this.chains.base;
  }

  getAllChains() {
    return Object.keys(this.chains);
  }

  isValidChain(chainId) {
    return chainId in this.chains;
  }
}

module.exports = Config;