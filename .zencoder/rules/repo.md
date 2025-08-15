---
description: Repository Information Overview
alwaysApply: true
---

# Looter Trading Bot Information

## Summary
A multi-chain cryptocurrency trading bot with Telegram interface, designed as a Looter.ai clone. The bot supports trading on multiple blockchains including Base, Ethereum, BSC, Solana, and others. It features wallet management, token trading, and transaction monitoring through a Telegram bot interface.

## Structure
- **auth/**: Authentication and user management
- **chains/**: Chain-specific trading implementations for different blockchains
- **callbacks/**: Telegram bot callback handlers
- **commands/**: Telegram bot command handlers
- **config/**: Configuration files and settings
- **contracts/**: Smart contract implementations for trading
- **database/**: Database schema and management
- **src/**: Core services and functionality
- **trading/**: Trading logic and token analysis
- **utils/**: Utility functions and helpers

## Language & Runtime
**Language**: JavaScript (Node.js)
**Version**: Node.js >=16.0.0
**Package Manager**: npm

## Dependencies
**Main Dependencies**:
- node-telegram-bot-api: ^0.61.0 (Telegram bot API)
- ethers: ^5.8.0 (Ethereum interaction)
- @solana/web3.js: ^1.87.0 (Solana blockchain interaction)
- pg: ^8.16.3 (PostgreSQL database)
- dotenv: ^16.5.0 (Environment configuration)
- axios: ^1.10.0 (HTTP requests)

**Development Dependencies**:
- nodemon: ^3.0.1 (Development server with auto-reload)

## Build & Installation
```bash
# Install dependencies
npm install

# Set up database
psql looter_ai_clone < database/schema.sql

# Configure environment variables
cp .env.example .env
# Edit .env with your configuration

# Start the bot
npm start

# Development mode with auto-reload
npm run dev
```

## Database
**Type**: PostgreSQL
**Schema**: Comprehensive database structure with tables for:
- Users and authentication
- Wallets for multiple chains
- Trading history and transactions
- Token information
- User settings and preferences

**Setup Command**:
```bash
npm run db:setup
```

## Main Entry Points
**Main File**: main-bot.js
**Bot Class**: LooterBot
**Trading Services**:
- Base trading: src/services/base-trading.js
- Chain-specific implementations in chains/ directory

## Features
- Multi-chain support (Base, Ethereum, BSC, Solana, etc.)
- Wallet management with encrypted storage
- Token trading with slippage control
- Transaction monitoring and history
- User authentication and permission management
- Telegram bot interface with inline keyboards
- Database-backed persistent storage