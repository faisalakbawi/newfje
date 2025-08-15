/**
 * LOOTER.AI CLONE - AUTHENTICATION
 * Simple and secure user authorization
 */

class Auth {
  constructor() {
    this.allowedUsers = this.loadAllowedUsers();
    console.log(`🔐 Auth initialized with ${this.allowedUsers.size} allowed users`);
  }

  loadAllowedUsers() {
    const allowedChatIds = process.env.ALLOWED_CHAT_IDS || '';
    const users = new Set();
    
    if (allowedChatIds) {
      allowedChatIds.split(',').forEach(id => {
        const trimmedId = id.trim();
        if (trimmedId) {
          users.add(trimmedId);
        }
      });
    }
    
    return users;
  }

  isAuthorized(chatId) {
    const chatIdStr = chatId.toString();
    
    // If no users configured, allow everyone (for testing)
    if (this.allowedUsers.size === 0) {
      return true;
    }
    
    return this.allowedUsers.has(chatIdStr);
  }

  addUser(chatId) {
    this.allowedUsers.add(chatId.toString());
    console.log(`✅ Added authorized user: ${chatId}`);
  }

  removeUser(chatId) {
    const removed = this.allowedUsers.delete(chatId.toString());
    if (removed) {
      console.log(`❌ Removed authorized user: ${chatId}`);
    }
    return removed;
  }

  getAllowedUsers() {
    return Array.from(this.allowedUsers);
  }
}

module.exports = Auth;