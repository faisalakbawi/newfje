// Multi-Chain Configuration
// Supports all major chains like Looter.ai

const CHAINS = {
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum',
    symbol: 'ETH',
    emoji: '🟣',
    rpcUrl: 'https://cloudflare-eth.com',
    chainId: 1,
    wethAddress: '0xC02aaA39b223FE8dD0e5C4F27eAD9083C756Cc2',
    routers: {
      uniswapV2: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
      uniswapV3: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      sushiswap: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F'
    },
    defaultRouter: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    explorerUrl: 'https://etherscan.io',
    explorerTx: 'https://etherscan.io/tx/',
    explorerAddress: 'https://etherscan.io/address/',
    dexScreenerUrl: 'https://dexscreener.com/ethereum/',
    dexToolsUrl: 'https://www.dextools.io/app/en/ether/pair-explorer/',
    gasLimit: 300000,
    priorityFee: 2.0 // gwei
  },
  
  base: {
    id: 'base',
    name: 'Base',
    symbol: 'ETH',
    emoji: '🔵',
    rpcUrl: 'https://mainnet.base.org',
    chainId: 8453,
    wethAddress: '0x4200000000000000000000000000000000000006',
    routers: {
      baseswap: '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24',
      uniswapV3: '0x2626664c2603336E57B271c5C0b26F421741e481',
      aerodrome: '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43',
      pancakeswap: '0x8cFe327CEc66d1C090Dd72bd0FF11d690C33a2Eb'
    },
    defaultRouter: '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24',
    explorerUrl: 'https://basescan.org',
    explorerTx: 'https://basescan.org/tx/',
    explorerAddress: 'https://basescan.org/address/',
    dexScreenerUrl: 'https://dexscreener.com/base/',
    dexToolsUrl: 'https://www.dextools.io/app/en/base/pair-explorer/',
    gasLimit: 200000,
    priorityFee: 0.01 // gwei
  },
  
  bsc: {
    id: 'bsc',
    name: 'BSC',
    symbol: 'BNB',
    emoji: '🟡',
    rpcUrl: 'https://bsc-dataseed.binance.org/',
    chainId: 56,
    wethAddress: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
    routers: {
      pancakeswapV2: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
      pancakeswapV3: '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4',
      biswap: '0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8'
    },
    defaultRouter: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
    explorerUrl: 'https://bscscan.com',
    explorerTx: 'https://bscscan.com/tx/',
    explorerAddress: 'https://bscscan.com/address/',
    dexScreenerUrl: 'https://dexscreener.com/bsc/',
    dexToolsUrl: 'https://www.dextools.io/app/en/bnb/pair-explorer/',
    gasLimit: 300000,
    priorityFee: 5.0 // gwei
  },
  
  arbitrum: {
    id: 'arbitrum',
    name: 'Arbitrum',
    symbol: 'ETH',
    emoji: '🔷',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    chainId: 42161,
    wethAddress: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    routers: {
      uniswapV3: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      sushiswap: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
      camelot: '0xc873fEcbd354f5A56E00E710B90EF4201db2448d'
    },
    defaultRouter: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
    explorerUrl: 'https://arbiscan.io',
    explorerTx: 'https://arbiscan.io/tx/',
    explorerAddress: 'https://arbiscan.io/address/',
    dexScreenerUrl: 'https://dexscreener.com/arbitrum/',
    dexToolsUrl: 'https://www.dextools.io/app/en/arbitrum/pair-explorer/',
    gasLimit: 500000,
    priorityFee: 0.1 // gwei
  },
  
  avalanche: {
    id: 'avalanche',
    name: 'Avalanche',
    symbol: 'AVAX',
    emoji: '🔴',
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    chainId: 43114,
    wethAddress: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7', // WAVAX
    routers: {
      pangolin: '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106',
      traderjoe: '0x60aE616a2155Ee3d9A68541Ba4544862310933d4',
      sushiswap: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506'
    },
    defaultRouter: '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106',
    explorerUrl: 'https://snowtrace.io',
    explorerTx: 'https://snowtrace.io/tx/',
    explorerAddress: 'https://snowtrace.io/address/',
    dexScreenerUrl: 'https://dexscreener.com/avalanche/',
    dexToolsUrl: 'https://www.dextools.io/app/en/avalanche/pair-explorer/',
    gasLimit: 300000,
    priorityFee: 25.0 // gwei
  },
  
  polygon: {
    id: 'polygon',
    name: 'Polygon',
    symbol: 'MATIC',
    emoji: '🟣',
    rpcUrl: 'https://polygon-rpc.com',
    chainId: 137,
    wethAddress: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
    routers: {
      quickswap: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',
      sushiswap: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
      uniswapV3: '0xE592427A0AEce92De3Edee1F18E0157C05861564'
    },
    defaultRouter: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',
    explorerUrl: 'https://polygonscan.com',
    explorerTx: 'https://polygonscan.com/tx/',
    explorerAddress: 'https://polygonscan.com/address/',
    dexScreenerUrl: 'https://dexscreener.com/polygon/',
    dexToolsUrl: 'https://www.dextools.io/app/en/polygon/pair-explorer/',
    gasLimit: 300000,
    priorityFee: 30.0 // gwei
  },
  
  solana: {
    id: 'solana',
    name: 'Solana',
    symbol: 'SOL',
    emoji: '🟢',
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    chainId: 101,
    wethAddress: 'So11111111111111111111111111111111111111112', // WSOL
    routers: {
      jupiter: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
      raydium: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
      orca: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc'
    },
    defaultRouter: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
    explorerUrl: 'https://solscan.io',
    explorerTx: 'https://solscan.io/tx/',
    explorerAddress: 'https://solscan.io/account/',
    dexScreenerUrl: 'https://dexscreener.com/solana/',
    dexToolsUrl: 'https://www.dextools.io/app/en/solana/pair-explorer/',
    gasLimit: 1400000, // compute units
    priorityFee: 0.001 // SOL
  }
};

// Testnet configurations
const TESTNETS = {
  'base-sepolia': {
    id: 'base-sepolia',
    name: 'Base Sepolia',
    symbol: 'ETH',
    emoji: '🔵',
    rpcUrl: 'https://sepolia.base.org',
    chainId: 84532,
    wethAddress: '0x4200000000000000000000000000000000000006',
    routers: {
      uniswapV3: '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4'
    },
    defaultRouter: '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4',
    explorerUrl: 'https://sepolia.basescan.org',
    explorerTx: 'https://sepolia.basescan.org/tx/',
    explorerAddress: 'https://sepolia.basescan.org/address/',
    dexScreenerUrl: 'https://dexscreener.com/base-sepolia/',
    dexToolsUrl: 'https://www.dextools.io/app/en/base-sepolia/pair-explorer/',
    gasLimit: 200000,
    priorityFee: 0.01
  }
};

// Helper functions
function getChain(chainId) {
  if (typeof chainId === 'string') {
    return CHAINS[chainId] || TESTNETS[chainId] || null;
  }
  
  // Find by numeric chain ID
  for (const chain of Object.values(CHAINS)) {
    if (chain.chainId === chainId) return chain;
  }
  
  for (const chain of Object.values(TESTNETS)) {
    if (chain.chainId === chainId) return chain;
  }
  
  return null;
}

function getAllChains() {
  return { ...CHAINS, ...TESTNETS };
}

function getMainnetChains() {
  return CHAINS;
}

function getTestnetChains() {
  return TESTNETS;
}

function isValidChain(chainId) {
  return getChain(chainId) !== null;
}

function getChainEmoji(chainId) {
  const chain = getChain(chainId);
  return chain ? chain.emoji : '⚪';
}

function getChainName(chainId) {
  const chain = getChain(chainId);
  return chain ? chain.name : 'Unknown';
}

module.exports = {
  CHAINS,
  TESTNETS,
  getChain,
  getAllChains,
  getMainnetChains,
  getTestnetChains,
  isValidChain,
  getChainEmoji,
  getChainName
};