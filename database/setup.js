/**
 * LOOTER.AI CLONE - Database Setup Script
 * Sets up PostgreSQL database with all required tables and data
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

class DatabaseSetup {
  constructor() {
    this.pool = null;
  }

  async initialize() {
    try {
      // Connect to PostgreSQL (without specific database)
      this.pool = new Pool({
        user: process.env.DB_USER || process.env.USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: 'postgres', // Connect to default postgres database first
        password: process.env.DB_PASSWORD || '',
        port: process.env.DB_PORT || 5432,
      });

      console.log('🔌 Connected to PostgreSQL server');
      
      // Create database if it doesn't exist
      await this.createDatabase();
      
      // Connect to the specific database
      await this.pool.end();
      this.pool = new Pool({
        user: process.env.DB_USER || process.env.USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'looter_ai_clone',
        password: process.env.DB_PASSWORD || '',
        port: process.env.DB_PORT || 5432,
      });

      console.log('🗄️ Connected to looter_ai_clone database');
      
      // Run schema setup
      await this.runSchema();
      
      console.log('✅ Database setup completed successfully!');
      
    } catch (error) {
      console.error('❌ Database setup failed:', error.message);
      throw error;
    } finally {
      if (this.pool) {
        await this.pool.end();
      }
    }
  }

  async createDatabase() {
    try {
      const dbName = process.env.DB_NAME || 'looter_ai_clone';
      
      // Check if database exists
      const result = await this.pool.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [dbName]
      );

      if (result.rows.length === 0) {
        console.log(`🏗️ Creating database: ${dbName}`);
        await this.pool.query(`CREATE DATABASE "${dbName}"`);
        console.log(`✅ Database ${dbName} created successfully`);
      } else {
        console.log(`📋 Database ${dbName} already exists`);
      }
    } catch (error) {
      console.error('❌ Error creating database:', error.message);
      throw error;
    }
  }

  // Split SQL statements more carefully
  splitSQLStatements(schema) {
    const statements = [];
    let current = '';
    let inFunction = false;
    let dollarQuoteTag = null;
    
    const lines = schema.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip comments and empty lines
      if (trimmedLine.startsWith('--') || trimmedLine === '') {
        continue;
      }
      
      // Check for dollar-quoted strings (functions)
      const dollarMatch = trimmedLine.match(/\$([^$]*)\$/);
      if (dollarMatch) {
        if (!inFunction) {
          dollarQuoteTag = dollarMatch[1];
          inFunction = true;
        } else if (dollarMatch[1] === dollarQuoteTag) {
          inFunction = false;
          dollarQuoteTag = null;
        }
      }
      
      current += line + '\n';
      
      // If we're not in a function and line ends with semicolon, it's a statement end
      if (!inFunction && trimmedLine.endsWith(';')) {
        statements.push(current.trim());
        current = '';
      }
    }
    
    // Add any remaining content
    if (current.trim()) {
      statements.push(current.trim());
    }
    
    return statements;
  }

  async runSchema() {
    try {
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      console.log('📋 Running database schema...');
      
      // Execute the entire schema as one statement
      try {
        await this.pool.query(schema);
        console.log('✅ Database schema applied successfully');
      } catch (error) {
        // If that fails, try to execute it in parts
        console.log('⚠️ Full schema failed, trying individual statements...');
        
        // Split more carefully, preserving function definitions
        const statements = this.splitSQLStatements(schema);
        
        for (const statement of statements) {
          try {
            if (statement.trim().length > 0) {
              await this.pool.query(statement);
            }
          } catch (error) {
            // Ignore errors for statements that might already exist
            if (!error.message.includes('already exists') && 
                !error.message.includes('duplicate key') &&
                !error.message.includes('does not exist')) {
              console.error('❌ Schema error:', error.message);
              console.error('Statement:', statement.substring(0, 100) + '...');
            }
          }
        }
      }
      
      console.log('✅ Database schema applied successfully');
      
    } catch (error) {
      console.error('❌ Error running schema:', error.message);
      throw error;
    }
  }

  // Test database connection and basic operations
  async testDatabase() {
    try {
      const Database = require('./database');
      const db = new Database();
      
      await db.initialize();
      
      console.log('🧪 Testing database operations...');
      
      // Test chains
      const chains = await db.getAllChains();
      console.log(`✅ Found ${chains.length} chains`);
      
      // Test user creation
      const testUser = await db.createUser(123456789, {
        username: 'test_user',
        first_name: 'Test',
        last_name: 'User'
      });
      console.log(`✅ Test user created: ${testUser.id}`);
      
      // Test wallet creation
      const testWallet = await db.createWallet(
        testUser.id,
        'ethereum',
        'W1',
        '0x1234567890123456789012345678901234567890',
        'test_private_key_here',
        null,
        false
      );
      console.log(`✅ Test wallet created: ${testWallet.id}`);
      
      // Test activity logging
      await db.logActivity(testUser.id, 'test_activity', 'test', testUser.id, {
        description: 'Database test completed'
      });
      console.log('✅ Activity logging works');
      
      // Clean up test data
      await db.query('DELETE FROM users WHERE telegram_id = $1', [123456789]);
      console.log('✅ Test data cleaned up');
      
      await db.close();
      console.log('🎉 Database test completed successfully!');
      
    } catch (error) {
      console.error('❌ Database test failed:', error.message);
      throw error;
    }
  }
}

// Run setup if called directly
if (require.main === module) {
  const setup = new DatabaseSetup();
  
  setup.initialize()
    .then(() => setup.testDatabase())
    .then(() => {
      console.log('🎉 Database setup and test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Setup failed:', error.message);
      process.exit(1);
    });
}

module.exports = DatabaseSetup;