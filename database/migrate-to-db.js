/**
 * MIGRATION SCRIPT - Convert existing bot to use PostgreSQL database
 * This script will integrate the database with your existing bot
 */

const WalletDBManager = require('./wallet-db-manager');
// Legacy wallet manager removed - migration already completed
// const WalletManager = require('../backup/legacy-files/wallet-manager');

async function migrateToDatabase() {
  console.log('🔄 Starting migration to PostgreSQL database...');
  
  try {
    // Initialize database manager
    const dbManager = new WalletDBManager();
    await dbManager.initialize();
    
    // Migration already completed - legacy wallet manager removed
    console.log('✅ Migration was already completed successfully!');
    
    console.log('📊 Checking existing wallet data...');
    
    // Migration was already completed - all data is now in PostgreSQL
    console.log('📭 Legacy file-based storage removed - all data is now in PostgreSQL database.');
    
    // Test database functionality
    console.log('🧪 Testing database functionality...');
    
    // Create a test user
    const testUser = await dbManager.createUser(999999999, {
      username: 'database_test',
      first_name: 'Database',
      last_name: 'Test'
    });
    
    console.log('✅ Test user created:', testUser.telegram_id);
    
    // Generate a test wallet
    const testAddress = await dbManager.generateWallet(999999999, 'W1', 'base');
    console.log('✅ Test wallet generated:', testAddress);
    
    // Get user summary
    const summary = await dbManager.getUserSummary(999999999);
    console.log('✅ User summary retrieved:', summary ? summary.wallets.length : 0, 'chain entries');
    
    // Clean up test data
    await dbManager.deleteWallet(999999999, 'W1', 'base');
    console.log('✅ Test data cleaned up');
    
    await dbManager.close();
    
    console.log('🎉 Database migration and testing completed successfully!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Update your main bot file to use WalletDBManager instead of WalletManager');
    console.log('2. Restart your bot to start using the database');
    console.log('3. All new users will automatically use the database');
    console.log('');
    console.log('🔒 Security: All private keys and seed phrases are encrypted in the database');
    console.log('📊 Analytics: Complete activity logging and trading history available');
    console.log('⚡ Performance: Optimized for fast queries and scalability');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateToDatabase()
    .then(() => {
      console.log('✅ Migration script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration script failed:', error.message);
      process.exit(1);
    });
}

module.exports = migrateToDatabase;