#!/bin/bash

# LOOTER.AI CLONE - Complete Database Setup Script
# This script will set up PostgreSQL database on your Mac Mini

echo "🚀 Setting up PostgreSQL Database for Looter.ai Clone Bot..."
echo ""

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed. Installing via Homebrew..."
    
    # Check if Homebrew is installed
    if ! command -v brew &> /dev/null; then
        echo "📦 Installing Homebrew first..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    
    # Install PostgreSQL
    echo "📦 Installing PostgreSQL..."
    brew install postgresql@15
    brew services start postgresql@15
    
    echo "✅ PostgreSQL installed and started"
else
    echo "✅ PostgreSQL is already installed"
fi

# Check if PostgreSQL is running
if ! pg_isready -q; then
    echo "🔄 Starting PostgreSQL service..."
    brew services start postgresql@15
fi

echo "✅ PostgreSQL is running"

# Create database
echo "🏗️ Creating database..."
createdb looter_ai_clone 2>/dev/null || echo "📋 Database already exists"

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Set up database schema
echo "📋 Setting up database schema..."
npm run db:setup

# Test database
echo "🧪 Testing database..."
npm run db:test

echo ""
echo "🎉 Database setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Update your .env file with your Telegram bot token"
echo "2. Run 'npm start' to start the bot with database support"
echo ""
echo "🔒 Your database is ready with:"
echo "   - Encrypted wallet storage"
echo "   - Complete activity logging"
echo "   - Multi-chain support"
echo "   - Trading history tracking"
echo ""
echo "📊 Database info:"
echo "   - Database name: looter_ai_clone"
echo "   - User: $USER"
echo "   - Host: localhost"
echo "   - Port: 5432"
echo ""
echo "✅ Setup complete! Your bot is ready to use PostgreSQL! 🚀"