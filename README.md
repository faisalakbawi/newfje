# Looter Trading Bot

A sophisticated multi-chain cryptocurrency trading bot with Telegram interface, designed as a Looter.ai clone. The bot supports trading on multiple blockchains including Base, Ethereum, BSC, Solana, and others.

## 🚀 Features

- **Multi-chain Support**: Trade on Base, Ethereum, BSC, Solana, and more
- **Telegram Bot Interface**: User-friendly chat interface with inline keyboards
- **Wallet Management**: Secure wallet creation and management with encrypted storage
- **Advanced Trading**: 
  - Token trading with customizable slippage control
  - Transaction monitoring and history
  - Liquidity analysis and sniping capabilities
- **User Authentication**: Secure user management and permission system
- **Database Integration**: PostgreSQL-backed persistent storage
- **Smart Contracts**: Custom trading contracts for optimized execution

## 🏗️ Architecture

```
├── auth/                   # Authentication and user management
├── chains/                 # Chain-specific trading implementations
│   ├── base/              # Base chain trading systems
│   ├── bsc/               # BSC trading implementation
│   ├── ethereum/          # Ethereum trading implementation
│   └── solana/            # Solana trading implementation
├── callbacks/             # Telegram bot callback handlers
├── commands/              # Telegram bot command handlers
├── config/                # Configuration files and settings
├── contracts/             # Smart contract implementations
├── database/              # Database schema and management
├── src/                   # Core services and functionality
├── trading/               # Trading logic and token analysis
└── utils/                 # Utility functions and helpers
```

## 📋 Requirements

- **Node.js**: >= 16.0.0
- **PostgreSQL**: Database for persistent storage
- **Telegram Bot Token**: For bot interface
- **RPC Endpoints**: For blockchain interactions

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd base-volume-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up the database**
   ```bash
   npm run db:setup
   # or manually:
   psql looter_ai_clone < database/schema.sql
   ```

5. **Start the bot**
   ```bash
   # Production
   npm start
   
   # Development with auto-reload
   npm run dev
   ```

## 🔧 Configuration

The bot requires several environment variables to be configured in your `.env` file:

- `TELEGRAM_BOT_TOKEN`: Your Telegram bot token
- `DATABASE_URL`: PostgreSQL connection string
- `PRIVATE_KEY`: Wallet private key for transactions
- `RPC_URLS`: RPC endpoints for different chains
- Additional chain-specific configurations

## 📦 Dependencies

### Main Dependencies
- `node-telegram-bot-api`: Telegram bot API integration
- `ethers`: Ethereum blockchain interaction
- `@solana/web3.js`: Solana blockchain interaction
- `pg`: PostgreSQL database client
- `dotenv`: Environment variable management
- `axios`: HTTP client for API requests

### Development Dependencies
- `nodemon`: Development server with auto-reload

## 🚀 Usage

Once configured and running, users can interact with the bot through Telegram to:

- Create and manage wallets across multiple chains
- Trade tokens with customizable parameters
- Monitor transaction history
- Analyze token information and liquidity
- Set trading preferences and slippage tolerance

## 🔒 Security

- Private keys are encrypted and stored securely
- User authentication system prevents unauthorized access
- Transaction validation and security checks
- Secure database schema with proper permissions

## 📈 Trading Features

- **Multi-DEX Support**: Integration with various DEXs on each chain
- **Liquidity Sniping**: Advanced liquidity detection and sniping
- **Slippage Control**: Customizable slippage tolerance
- **Gas Optimization**: Smart gas price calculation
- **Transaction Monitoring**: Real-time transaction tracking

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## ⚠️ Disclaimer

This bot is for educational and research purposes. Trading cryptocurrencies involves substantial risk of loss. Use at your own risk and never trade with funds you cannot afford to lose.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.