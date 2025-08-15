/**
 * RPC Manager with Rotation Support
 * Handles multiple RPC endpoints with automatic failover
 */

const { ethers } = require('ethers');
const config = require('../config');

class RPCManager {
  constructor() {
    this.currentIndex = 0;
    this.providers = [];
    this.healthStatus = new Map();
    this.initializeProviders();
    
    console.log(`🌐 RPC Manager initialized with ${this.providers.length} endpoints`);
  }

  initializeProviders() {
    this.providers = config.rpcList.map((url, index) => {
      const provider = new ethers.providers.JsonRpcProvider({
        url,
        timeout: config.timeoutMs
      });
      
      this.healthStatus.set(index, { healthy: true, lastError: null, errorCount: 0 });
      
      console.log(`  📡 RPC ${index + 1}: ${url}`);
      return provider;
    });
  }

  getCurrentProvider() {
    return this.providers[this.currentIndex];
  }

  async getHealthyProvider() {
    // Try current provider first
    if (await this.isProviderHealthy(this.currentIndex)) {
      return this.providers[this.currentIndex];
    }

    // Find next healthy provider
    for (let i = 0; i < this.providers.length; i++) {
      const nextIndex = (this.currentIndex + i + 1) % this.providers.length;
      if (await this.isProviderHealthy(nextIndex)) {
        this.currentIndex = nextIndex;
        console.log(`🔄 Switched to RPC ${nextIndex + 1}: ${config.rpcList[nextIndex]}`);
        return this.providers[nextIndex];
      }
    }

    // All providers unhealthy, return current anyway
    console.warn('⚠️ All RPC providers appear unhealthy, using current');
    return this.providers[this.currentIndex];
  }

  async isProviderHealthy(index) {
    try {
      const provider = this.providers[index];
      const blockNumber = await provider.getBlockNumber();
      
      // Update health status
      this.healthStatus.set(index, {
        healthy: true,
        lastError: null,
        errorCount: 0,
        lastCheck: Date.now(),
        blockNumber
      });
      
      return true;
    } catch (error) {
      const status = this.healthStatus.get(index);
      this.healthStatus.set(index, {
        healthy: false,
        lastError: error.message,
        errorCount: (status?.errorCount || 0) + 1,
        lastCheck: Date.now()
      });
      
      return false;
    }
  }

  async executeWithRetry(operation, maxRetries = config.retryAttempts) {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const provider = await this.getHealthyProvider();
        return await operation(provider);
      } catch (error) {
        lastError = error;
        console.warn(`⚠️ RPC attempt ${attempt + 1} failed: ${error.message}`);
        
        // Mark current provider as unhealthy
        const status = this.healthStatus.get(this.currentIndex);
        this.healthStatus.set(this.currentIndex, {
          ...status,
          healthy: false,
          lastError: error.message,
          errorCount: (status?.errorCount || 0) + 1
        });
        
        // Try next provider
        this.currentIndex = (this.currentIndex + 1) % this.providers.length;
        
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }
    
    throw lastError;
  }

  getHealthStatus() {
    const status = [];
    for (let i = 0; i < this.providers.length; i++) {
      const health = this.healthStatus.get(i);
      status.push({
        index: i,
        url: config.rpcList[i],
        healthy: health?.healthy || false,
        errorCount: health?.errorCount || 0,
        lastError: health?.lastError,
        lastCheck: health?.lastCheck,
        blockNumber: health?.blockNumber
      });
    }
    return status;
  }

  async healthCheck() {
    console.log('🏥 Running RPC health check...');
    
    const results = await Promise.allSettled(
      this.providers.map((_, index) => this.isProviderHealthy(index))
    );
    
    const healthyCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
    
    console.log(`📊 Health check complete: ${healthyCount}/${this.providers.length} healthy`);
    
    return {
      totalProviders: this.providers.length,
      healthyProviders: healthyCount,
      currentProvider: this.currentIndex,
      status: this.getHealthStatus()
    };
  }
}

// Export singleton instance
const rpcManager = new RPCManager();
module.exports = rpcManager;