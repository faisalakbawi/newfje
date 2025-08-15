/**
 * CHAIN MANAGER - Multi-chain Integration
 * Manages all supported chains exactly like Looter.ai
 */

const EthereumTrading = require('./ethereum/ethereum-trading');
const UniswapUniversalRouter = require('./base/uniswap-universal-router'); // OFFICIAL UNISWAP SOLUTION
const BSCTrading = require('./bsc/bsc-trading');
const SolanaTrading = require('./solana/solana-trading');

class ChainManager {
  constructor() {
    this.chains = new Map();
    this.initializeChains();
    console.log('🌐 Chain Manager initialized with all supported chains');
  }

  initializeChains() {
    // Initialize all supported chains
    this.chains.set('ethereum', new EthereumTrading());
    this.chains.set('base', new UniswapUniversalRouter()); // OFFICIAL UNISWAP UNIVERSAL ROUTER
    this.chains.set('bsc', new BSCTrading());
    this.chains.set('solana', new SolanaTrading());
    
    // Layer 2 Chains (Ethereum L2s)
    this.chains.set('arbitrum', this.createPlaceholderChain('Arbitrum One', 42161, 'ETH', '🔷'));
    this.chains.set('optimism', this.createPlaceholderChain('Optimism', 10, 'ETH', '🔴'));
    this.chains.set('polygon', this.createPlaceholderChain('Polygon', 137, 'MATIC', '🟣'));
    this.chains.set('blast', this.createPlaceholderChain('Blast', 81457, 'ETH', '💥'));
    this.chains.set('linea', this.createPlaceholderChain('Linea', 59144, 'ETH', '⚫'));
    this.chains.set('scroll', this.createPlaceholderChain('Scroll', 534352, 'ETH', '📜'));
    this.chains.set('zksync', this.createPlaceholderChain('zkSync Era', 324, 'ETH', '⚡'));
    this.chains.set('starknet', this.createPlaceholderChain('Starknet', 'SN_MAIN', 'ETH', '🌟'));
    
    // Layer 1 Alternative Chains
    this.chains.set('avalanche', this.createPlaceholderChain('Avalanche C-Chain', 43114, 'AVAX', '🔴'));
    this.chains.set('fantom', this.createPlaceholderChain('Fantom', 250, 'FTM', '👻'));
    this.chains.set('cronos', this.createPlaceholderChain('Cronos', 25, 'CRO', '🔷'));
    this.chains.set('moonbeam', this.createPlaceholderChain('Moonbeam', 1284, 'GLMR', '🌙'));
    this.chains.set('celo', this.createPlaceholderChain('Celo', 42220, 'CELO', '💚'));
    
    // Layer 3 and App-Specific Chains
    this.chains.set('immutable', this.createPlaceholderChain('Immutable X', 13371, 'IMX', '🎮'));
    this.chains.set('dydx', this.createPlaceholderChain('dYdX Chain', 'dydx-mainnet-1', 'DYDX', '📈'));
    this.chains.set('xai', this.createPlaceholderChain('Xai', 660279, 'XAI', '🎯'));
    
    // Cosmos Ecosystem
    this.chains.set('cosmos', this.createPlaceholderChain('Cosmos Hub', 'cosmoshub-4', 'ATOM', '⚛️'));
    this.chains.set('osmosis', this.createPlaceholderChain('Osmosis', 'osmosis-1', 'OSMO', '🧪'));
    
    // Other Major L1s
    this.chains.set('cardano', this.createPlaceholderChain('Cardano', 'mainnet', 'ADA', '🔵'));
    this.chains.set('polkadot', this.createPlaceholderChain('Polkadot', 'polkadot', 'DOT', '🔴'));
    this.chains.set('near', this.createPlaceholderChain('NEAR Protocol', 'mainnet', 'NEAR', '🌈'));
    this.chains.set('aptos', this.createPlaceholderChain('Aptos', 1, 'APT', '🅰️'));
    this.chains.set('sui', this.createPlaceholderChain('Sui', 'mainnet', 'SUI', '💧'));
  }

  // Create placeholder for chains not yet implemented
  createPlaceholderChain(name, chainId, symbol, icon) {
    return {
      chainId,
      name,
      symbol,
      icon,
      async getTokenPrice(tokenAddress) {
        return {
          price: '0.00001000',
          priceUSD: '$0.001000',
          marketCap: '$1,000,000',
          liquidity: '$100,000',
          change24h: '+1.00%'
        };
      },
      async executeBuy(walletPrivateKey, tokenAddress, amount, slippage) {
        console.log(`${icon} ${name} buy coming soon!`);
        throw new Error(`${name} trading coming soon!`);
      },
      async executeSell(walletPrivateKey, tokenAddress, percentage) {
        console.log(`${icon} ${name} sell coming soon!`);
        throw new Error(`${name} trading coming soon!`);
      },
      async getWalletBalance(address) {
        return "0.0";
      },
      async transferNative(privateKey, toAddress, amount) {
        console.log(`${icon} ${name} transfer coming soon!`);
        console.log(`Would transfer ${amount} ${symbol} to ${toAddress}`);
        throw new Error(`${name} transfers coming soon! This chain is not fully implemented yet.`);
      }
    };
  }

  // Get chain instance
  getChain(chainId) {
    return this.chains.get(chainId);
  }

  // Get all supported chains
  getAllChains() {
    const chainList = [];
    for (const [chainId, chain] of this.chains.entries()) {
      chainList.push({
        id: chainId,
        name: chain.name,
        symbol: chain.symbol,
        icon: chain.icon || this.getChainIcon(chainId),
        chainId: chain.chainId
      });
    }
    return chainList;
  }

  // Get chain icon
  getChainIcon(chainId) {
    const icons = {
      ethereum: '🟣',
      base: '🔵',
      bsc: '🟡',
      arbitrum: '🔷',
      polygon: '🟣',
      avalanche: '🔴',
      solana: '🟢',
      blast: '💥',
      optimism: '🔴'
    };
    return icons[chainId] || '⚪';
  }

  // Check if chain is supported
  isChainSupported(chainId) {
    return this.chains.has(chainId);
  }

  // Get token price across chains
  async getTokenPrice(chainId, tokenAddress) {
    try {
      const chain = this.getChain(chainId);
      if (!chain) {
        throw new Error(`Chain ${chainId} not supported`);
      }
      
      return await chain.getTokenPrice(tokenAddress);
    } catch (error) {
      console.error(`❌ Error getting price on ${chainId}:`, error.message);
      throw error;
    }
  }

  // Execute buy across chains
  async executeBuy(chainId, walletPrivateKey, tokenAddress, amount, slippage = 1.0) {
    try {
      const chain = this.getChain(chainId);
      if (!chain) {
        throw new Error(`Chain ${chainId} not supported`);
      }
      
      return await chain.executeBuy(walletPrivateKey, tokenAddress, amount, slippage);
    } catch (error) {
      console.error(`❌ Error executing buy on ${chainId}:`, error.message);
      throw error;
    }
  }

  // Execute sell across chains
  async executeSell(chainId, walletPrivateKey, tokenAddress, percentage) {
    try {
      const chain = this.getChain(chainId);
      if (!chain) {
        throw new Error(`Chain ${chainId} not supported`);
      }
      
      return await chain.executeSell(walletPrivateKey, tokenAddress, percentage);
    } catch (error) {
      console.error(`❌ Error executing sell on ${chainId}:`, error.message);
      throw error;
    }
  }

  // Get wallet balance across chains
  async getWalletBalance(chainId, address) {
    try {
      const chain = this.getChain(chainId);
      if (!chain) {
        return "0.0";
      }
      
      return await chain.getWalletBalance(address);
    } catch (error) {
      console.error(`❌ Error getting balance on ${chainId}:`, error.message);
      return "0.0";
    }
  }

  // Transfer native token across chains
  async transferNative(chainId, privateKey, toAddress, amount) {
    try {
      const chain = this.getChain(chainId);
      if (!chain) {
        throw new Error(`Chain ${chainId} not supported`);
      }
      
      if (!chain.transferNative) {
        throw new Error(`Transfer not implemented for ${chainId}`);
      }
      
      return await chain.transferNative(privateKey, toAddress, amount);
    } catch (error) {
      console.error(`❌ Error transferring on ${chainId}:`, error.message);
      throw error;
    }
  }

  // Get chain statistics
  getChainStats() {
    const stats = {
      totalChains: this.chains.size,
      activeChains: 0,
      supportedChains: []
    };

    for (const [chainId, chain] of this.chains.entries()) {
      stats.supportedChains.push({
        id: chainId,
        name: chain.name,
        symbol: chain.symbol,
        active: chainId === 'ethereum' || chainId === 'base' || chainId === 'bsc' || chainId === 'solana'
      });
      
      if (chainId === 'ethereum' || chainId === 'base' || chainId === 'bsc' || chainId === 'solana') {
        stats.activeChains++;
      }
    }

    return stats;
  }
}

module.exports = ChainManager;