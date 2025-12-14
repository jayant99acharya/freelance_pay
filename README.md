# 🚀 Freelance Payment System

A decentralized escrow-based payment platform for freelancers and clients, built on the QIE blockchain testnet. Smart contracts ensure secure milestone-based payments with automated verification and release mechanisms.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Solidity](https://img.shields.io/badge/Solidity-0.8.19-363636?logo=solidity)
![React](https://img.shields.io/badge/React-18.2-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)

## ✨ Features

### 🔐 Smart Contract Escrow
- **Milestone-based payments**: Break projects into verifiable milestones
- **Automated fund release**: Smart contracts handle payment distribution
- **Native QIE token support**: Built for the QIE blockchain
- **Dispute protection**: Funds locked until milestones are verified

### 👥 User Management
- **Dual role system**: Support for both clients and freelancers
- **Wallet integration**: MetaMask connection for blockchain interactions
- **Profile management**: GitHub integration for developer verification

### 📊 Project Management
- **Create projects**: Define scope, budget, and milestones
- **Track progress**: Real-time milestone status updates
- **Transaction history**: Complete audit trail on blockchain
- **Automated verification**: GitHub commit-based milestone verification

### 🛡️ Security Features
- **Non-custodial**: Users maintain control of their funds
- **Immutable records**: All transactions recorded on blockchain
- **Smart contract auditing**: Secure escrow implementation
- **RLS policies**: Row-level security for database operations

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                 │     │                  │     │                 │
│   React App     │────▶│  Smart Contract  │────▶│  QIE Blockchain │
│   (Frontend)    │     │    (Escrow)      │     │    (Testnet)    │
│                 │     │                  │     │                 │
└────────┬────────┘     └──────────────────┘     └─────────────────┘
         │
         │
    ┌────▼────────┐
    │             │
    │  Supabase   │
    │  (Backend)  │
    │             │
    └─────────────┘
```

## 🚀 Quick Start

### Deployed project link
```bash
https://smart-payment-automa-ng55.bolt.host
```

### Prerequisites

- Node.js 18+ and npm
- MetaMask browser extension
- QIE testnet tokens (for gas fees)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/jayant99acharya/freelance_pay
cd freelance-payment-system
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. **Run the development server**
```bash
npm run dev
```

5. **Open your browser**
Navigate to `http://localhost:5173`

## 🔧 Configuration

### MetaMask Setup

Add QIE Testnet to MetaMask:
- **Network Name**: QIE Testnet
- **RPC URL**: `https://rpc1testnet.qie.digital`
- **Chain ID**: `1983` (0x7BF)
- **Currency Symbol**: QIE
- **Block Explorer**: `https://testnet.qie.digital`

### Smart Contract Deployment

1. **Compile the contract**
```bash
npm run compile
```

2. **Deploy through the UI**
- Connect your wallet
- Create a new project
- The contract deploys automatically

## 📝 Smart Contract Details

### FreelanceEscrow.sol

The main escrow contract handles:
- Milestone management
- Fund deposits and releases
- Verification mechanisms
- Payment distribution

**Key Functions:**
- `depositFunds()` - Client deposits project funds
- `verifyMilestone()` - Verify milestone completion
- `releaseMilestonePayment()` - Release funds to freelancer
- `requestRefund()` - Handle disputes and refunds

## 🛠️ Troubleshooting

### Common Issues

#### "Internal JSON-RPC error" on QIE Testnet

The QIE testnet has RPC limitations. Use the console helpers:

```javascript
// Direct milestone payment
payMilestoneDirectly("CONTRACT_ADDRESS", 0)

// Or step-by-step
verifyMilestoneOnly("CONTRACT_ADDRESS", 0)
releaseMilestonePayment("CONTRACT_ADDRESS", 0)
```

#### Contract Not Active

Ensure funds are deposited through `depositFunds()`:
```javascript
// Check contract status
checkEscrowStatus("CONTRACT_ADDRESS")
```

#### Transaction Not Found on Explorer

QIE testnet explorer may have indexing delays. Check:
- Transaction status in MetaMask
- Contract balance on-chain
- Wait 1-2 minutes for indexing

## 📚 API Reference

### Web3 Functions

```typescript
// Deploy escrow contract
deployEscrowContract(
  clientAddress: string,
  freelancerAddress: string,
  tokenAddress: string,
  milestoneAmounts: string[]
): Promise<string>

// Deposit funds to escrow
depositToEscrow(
  escrowAddress: string,
  tokenAddress: string,
  amount: string
): Promise<string>

// Verify and pay milestone
verifyAndPayMilestone(
  escrowAddress: string,
  milestoneIndex: number,
  verificationHash: string
): Promise<string>
```

### Database Schema

- **users**: Authentication and wallet addresses
- **profiles**: User profile information
- **projects**: Project details and escrow addresses
- **milestones**: Project milestones and payment amounts
- **transactions**: Blockchain transaction records

## 🧪 Testing

```bash
# Run tests
npm test

# Deploy test contract
npm run deploy:test

# Check contract on explorer
https://testnet.qie.digital/address/YOUR_CONTRACT_ADDRESS
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- QIE Blockchain team for testnet infrastructure
- OpenZeppelin for smart contract libraries
- Supabase for backend services
- MetaMask for wallet integration



## For any issues 
- Contact jayant99acharya@gmail.com, bhanutejamakkineni@gmail.com, umadevi.cheruku6@gmail.com

## 🗺️ Roadmap

- [x] Basic escrow functionality
- [x] Milestone-based payments
- [x] MetaMask integration
- [x] QIE testnet deployment
- [ ] Multi-token support
- [ ] Dispute resolution system
- [ ] IPFS integration for deliverables
- [ ] Mainnet deployment
- [ ] Mobile app
- [ ] DAO governance

---

Built with ❤️ for the freelance community
