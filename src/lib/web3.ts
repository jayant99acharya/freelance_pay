import { BrowserProvider, Contract, formatUnits, parseUnits, ContractFactory, getAddress } from 'ethers';
import { ESCROW_ABI, ESCROW_BYTECODE } from '../contracts/escrow-abi';
import { TEST_ABI, TEST_BYTECODE } from '../contracts/test-abi';

declare global {
  interface Window {
    ethereum?: any;
  }
}

export const QIE_CHAIN_CONFIG = {
  chainId: '0x1A16',
  chainName: 'QIE Testnet',
  nativeCurrency: {
    name: 'QIE',
    symbol: 'QIE',
    decimals: 18,
  },
  rpcUrls: ['https://rpc-testnet.qie.digital'],
  blockExplorerUrls: ['https://testnet.qie.digital'],
};

export async function connectWallet(): Promise<string> {
  if (!window.ethereum) {
    throw new Error('MetaMask not installed');
  }

  try {
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts',
    });

    // Don't auto-switch network to avoid RPC rate limits
    // User can manually switch in MetaMask when needed

    return accounts[0];
  } catch (error) {
    console.error('Error connecting wallet:', error);
    throw error;
  }
}

export async function getCurrentWalletAddress(): Promise<string | null> {
  if (!window.ethereum) {
    return null;
  }

  try {
    const accounts = await window.ethereum.request({
      method: 'eth_accounts',
    });
    return accounts[0] || null;
  } catch (error) {
    console.error('Error getting current wallet:', error);
    return null;
  }
}

export async function switchToQIENetwork(): Promise<void> {
  if (!window.ethereum) {
    throw new Error('MetaMask not installed');
  }

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: QIE_CHAIN_CONFIG.chainId }],
    });
  } catch (switchError: any) {
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [QIE_CHAIN_CONFIG],
        });
      } catch (addError) {
        throw addError;
      }
    } else {
      throw switchError;
    }
  }
}

export async function getProvider() {
  if (!window.ethereum) {
    throw new Error('MetaMask not installed');
  }

  // Create provider lazily to avoid immediate RPC calls
  const provider = new BrowserProvider(window.ethereum, 'any');

  return provider;
}

export async function getSigner() {
  if (!window.ethereum) {
    throw new Error('MetaMask not installed');
  }

  // Get account directly from MetaMask first (no RPC needed)
  const accounts = await window.ethereum.request({ method: 'eth_accounts' });
  if (!accounts || accounts.length === 0) {
    throw new Error('No wallet connected');
  }

  // Wrap the ethereum provider to intercept and suppress eth_blockNumber calls
  const wrappedProvider = {
    ...window.ethereum,
    request: async (args: any) => {
      // Suppress eth_blockNumber calls during initialization
      if (args.method === 'eth_blockNumber') {
        console.log('Suppressing eth_blockNumber call during init');
        return '0x1'; // Return dummy block number
      }
      return window.ethereum.request(args);
    }
  };

  // Create provider with wrapped ethereum object
  const provider = new BrowserProvider(wrappedProvider, 'any');

  // Pass the account address to avoid RPC lookup
  return provider.getSigner(accounts[0]);
}

export async function deployEscrowContract(
  clientAddress: string,
  freelancerAddress: string,
  tokenAddress: string,
  milestoneAmounts: string[]
): Promise<string> {
  try {
    const normalizedClientAddress = getAddress(clientAddress);
    const normalizedFreelancerAddress = getAddress(freelancerAddress);
    const normalizedTokenAddress = getAddress(tokenAddress);

    console.log('Deploying contract with params:', {
      clientAddress: normalizedClientAddress,
      freelancerAddress: normalizedFreelancerAddress,
      tokenAddress: normalizedTokenAddress,
      milestoneAmounts
    });

    const signer = await getSigner();

    const milestoneAmountsWei = milestoneAmounts.map(amount => parseUnits(amount, 18));

    // Check wallet balance before deployment
    const balance = await signer.provider.getBalance(await signer.getAddress());
    console.log('Wallet balance:', formatUnits(balance, 18), 'QIE');

    if (balance === 0n) {
      throw new Error('Insufficient funds: Your wallet has 0 QIE. Please add QIE tokens to deploy the contract.');
    }

    console.log('Creating contract factory...');
    const factory = new ContractFactory(ESCROW_ABI, ESCROW_BYTECODE, signer);

    console.log('Deploying contract...');
    console.log('Constructor params:', {
      client: normalizedClientAddress,
      freelancer: normalizedFreelancerAddress,
      token: normalizedTokenAddress,
      milestones: milestoneAmountsWei.map(m => formatUnits(m, 18))
    });

    // Try with explicit gas settings
    const contract = await factory.deploy(
      normalizedClientAddress,
      normalizedFreelancerAddress,
      normalizedTokenAddress,
      milestoneAmountsWei,
      {
        gasLimit: 5000000 // 5M gas should be more than enough
      }
    );

    console.log('Waiting for deployment...');
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    console.log('Contract deployed at:', address);

    return address;
  } catch (error) {
    console.error('Contract deployment error:', error);
    throw error;
  }
}

export async function getEscrowContract(address: string) {
  const signer = await getSigner();
  return new Contract(address, ESCROW_ABI, signer);
}

export async function depositToEscrow(escrowAddress: string, tokenAddress: string, amount: string) {
  const signer = await getSigner();
  const amountWei = parseUnits(amount, 18);
  const escrowContract = await getEscrowContract(escrowAddress);

  let depositTx;

  if (tokenAddress === '0x0000000000000000000000000000000000000000') {
    // Native QIE token - send with value
    depositTx = await escrowContract.depositFunds({ value: amountWei });
  } else {
    // ERC20 token - approve first then deposit
    const ERC20_ABI = [
      'function approve(address spender, uint256 amount) public returns (bool)',
    ];
    const tokenContract = new Contract(tokenAddress, ERC20_ABI, signer);

    const approveTx = await tokenContract.approve(escrowAddress, amountWei);
    await approveTx.wait();

    depositTx = await escrowContract.depositFunds();
  }

  await depositTx.wait();
  return depositTx.hash;
}

export async function verifyAndPayMilestone(
  escrowAddress: string,
  milestoneIndex: number,
  verificationHash: string
) {
  const signer = await getSigner();
  const connectedAddress = await signer.getAddress();

  console.log('Connected wallet address:', connectedAddress);
  console.log('Escrow contract address:', escrowAddress);
  console.log('Milestone index:', milestoneIndex);

  const contract = await getEscrowContract(escrowAddress);

  const clientAddress = await contract.client();
  console.log('Contract client address:', clientAddress);
  console.log('Addresses match?', connectedAddress.toLowerCase() === clientAddress.toLowerCase());

  const verifyTx = await contract.verifyMilestone(milestoneIndex, verificationHash);
  await verifyTx.wait();

  const payTx = await contract.releaseMilestonePayment(milestoneIndex);
  await payTx.wait();

  return payTx.hash;
}

// Test function to deploy a simple contract
export async function deployTestContract() {
  try {
    const signer = await getSigner();
    const balance = await signer.provider.getBalance(await signer.getAddress());
    console.log('Wallet balance:', formatUnits(balance, 18), 'QIE');

    console.log('Deploying simple test contract...');
    const factory = new ContractFactory(TEST_ABI, TEST_BYTECODE, signer);

    const contract = await factory.deploy({
      gasLimit: 1000000
    });

    console.log('Waiting for deployment...');
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    console.log('Test contract deployed at:', address);

    return address;
  } catch (error) {
    console.error('Test contract deployment error:', error);
    throw error;
  }
}

export function formatTokenAmount(amount: string, decimals: number = 18): string {
  return formatUnits(amount, decimals);
}

export function parseTokenAmount(amount: string, decimals: number = 18): bigint {
  return parseUnits(amount, decimals);
}
