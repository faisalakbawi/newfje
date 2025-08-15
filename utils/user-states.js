/**
 * USER STATE MANAGEMENT
 * Tracks user states for wallet import operations
 */

class UserStates {
  constructor() {
    this.states = new Map();
  }

  // Set user state for wallet import
  setImportState(chatId, type, chain) {
    this.states.set(chatId, {
      action: 'import',
      type: type, // 'privatekey' or 'seedphrase'
      chain: chain,
      timestamp: Date.now()
    });
  }

  // Set user state for wallet replacement
  setReplaceState(chatId, type, walletSlot, chain) {
    this.states.set(chatId, {
      action: 'replace',
      type: type, // 'privatekey' or 'seedphrase'
      walletSlot: walletSlot,
      chain: chain,
      timestamp: Date.now()
    });
  }

  // Get user state
  getState(chatId) {
    return this.states.get(chatId);
  }

  // Clear user state
  clearState(chatId) {
    this.states.delete(chatId);
  }

  // Check if user is in import state
  isImporting(chatId) {
    const state = this.states.get(chatId);
    return state && (state.action === 'import' || state.action === 'replace');
  }

  // Check if user is in transfer state
  isTransferring(chatId) {
    const state = this.states.get(chatId);
    return state && (state.action === 'waiting_transfer_address' || state.action === 'waiting_transfer_amount' || state.action === 'transfer_confirmed');
  }

  // Set user state for custom amount input
  setCustomAmountState(chatId, stateData) {
    this.states.set(chatId, {
      ...stateData,
      timestamp: Date.now()
    });
  }

  // Check if user is in custom amount input state
  isWaitingForCustomAmount(chatId) {
    const state = this.states.get(chatId);
    return state && state.action === 'waiting_for_custom_amount';
  }

  // Set user state (generic method)
  set(chatId, stateData) {
    this.states.set(chatId, {
      ...stateData,
      timestamp: Date.now()
    });
  }

  // Check if user is awaiting custom slippage input
  isAwaitingCustomSlippage(chatId) {
    const state = this.states.get(chatId);
    return state && state.state === 'awaiting_custom_slippage';
  }

  // Get user state
  get(chatId) {
    return this.states.get(chatId);
  }

  // Delete user state
  delete(chatId) {
    return this.states.delete(chatId);
  }

  // Set user state for custom amount input
  setCustomAmountState(chatId, data) {
    this.states.set(chatId, {
      action: 'waiting_for_custom_amount',
      sessionId: data.sessionId,
      tokenData: data.tokenData,
      messageId: data.messageId,
      timestamp: Date.now()
    });
  }

  // Check if user is waiting for custom amount input
  isWaitingForCustomAmount(chatId) {
    const state = this.states.get(chatId);
    return state && state.action === 'waiting_for_custom_amount';
  }

  // Clean old states (older than 10 minutes)
  cleanOldStates() {
    const now = Date.now();
    const tenMinutes = 10 * 60 * 1000;
    
    for (const [chatId, state] of this.states.entries()) {
      if (now - state.timestamp > tenMinutes) {
        this.states.delete(chatId);
      }
    }
  }
}

module.exports = UserStates;