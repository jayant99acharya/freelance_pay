import { BrowserProvider, Contract, formatUnits, parseUnits, ContractFactory, getAddress } from 'ethers';
import { ESCROW_ABI, ESCROW_BYTECODE } from '../contracts/escrow-abi';
import { TEST_ABI, TEST_BYTECODE } from '../contracts/test-abi';

declare global {
  interface Window {
    ethereum?: any;
  }
}

export const QIE_CHAIN_CONFIG = {
  chainId: '0x7BF',
  chainName: 'QIE testnet',
  nativeCurrency: {
    name: 'QIE',
    symbol: 'QIE',
    decimals: 18,
  },
  rpcUrls: ['https://rpc1testnet.qie.digital'],
  blockExplorerUrls: ['https://testnet.qie.digital'],
};

export async function connectWallet(): Promise<string> {
  if (!window.ethereum) {
    throw new Error('No wallet found. Please install MetaMask or Core Wallet');
  }

  try {
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts',
    });

    // Don't auto-switch network to avoid RPC rate limits
    // User can manually switch in wallet when needed

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
    throw new Error('No wallet found. Please install MetaMask or Core Wallet');
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
    throw new Error('No wallet found. Please install MetaMask or Core Wallet');
  }

  // Create provider lazily to avoid immediate RPC calls
  const provider = new BrowserProvider(window.ethereum, 'any');

  return provider;
}

export async function getSigner() {
  if (!window.ethereum) {
    throw new Error('No wallet found. Please install MetaMask or Core Wallet');
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

export async function checkContractDeployed(address: string): Promise<boolean> {
  try {
    const provider = await getProvider();
    const code = await provider.getCode(address);
    return code !== '0x' && code !== '0x0';
  } catch (error) {
    console.error('Error checking contract deployment:', error);
    return false;
  }
}

export async function deployEscrowContract(
  clientAddress: string,
  freelancerAddress: string,
  tokenAddress: string,
  milestoneAmounts: string[]
): Promise<string> {
  try {
    console.log('=== Starting Contract Deployment ===');

    // Validate inputs
    if (!clientAddress || !freelancerAddress || !tokenAddress) {
      throw new Error('Missing required addresses');
    }

    if (!milestoneAmounts || milestoneAmounts.length === 0) {
      throw new Error('At least one milestone is required');
    }

    const normalizedClientAddress = getAddress(clientAddress);
    const normalizedFreelancerAddress = getAddress(freelancerAddress);
    const normalizedTokenAddress = getAddress(tokenAddress);

    console.log('Deploying contract with params:', {
      clientAddress: normalizedClientAddress,
      freelancerAddress: normalizedFreelancerAddress,
      tokenAddress: normalizedTokenAddress,
      milestoneAmounts,
      milestoneCount: milestoneAmounts.length
    });

    console.log('Getting signer...');
    const signer = await getSigner();
    const signerAddress = await signer.getAddress();
    console.log('Signer address:', signerAddress);

    const milestoneAmountsWei = milestoneAmounts.map(amount => {
      const wei = parseUnits(amount, 18);
      console.log(`Converting ${amount} QIE to ${wei} wei`);
      return wei;
    });

    // Check network
    try {
      const network = await signer.provider.getNetwork();
      console.log('Connected to network:', {
        chainId: network.chainId.toString(),
        name: network.name
      });

      if (network.chainId !== 1983n) {
        throw new Error(`Wrong network! Please switch to QIE Testnet (Chain ID: 1983) in your wallet. Currently on chain ${network.chainId}`);
      }
    } catch (networkError: any) {
      console.error('Network check failed:', networkError);
      throw new Error(`Network error: ${networkError.message}`);
    }

    // Check balance
    try {
      const balance = await signer.provider.getBalance(signerAddress);
      console.log('Wallet balance:', formatUnits(balance, 18), 'QIE');

      if (balance === 0n) {
        throw new Error('Insufficient funds: Your wallet has 0 QIE. Please add QIE tokens to deploy the contract.');
      }

      // Estimate gas cost
      const gasPrice = await signer.provider.getFeeData();
      const estimatedCost = gasPrice.gasPrice ? (gasPrice.gasPrice * 5000000n) : 0n;
      console.log('Estimated deployment cost:', formatUnits(estimatedCost, 18), 'QIE');

      if (balance < estimatedCost) {
        console.warn('Balance may be insufficient for deployment');
      }
    } catch (balanceError: any) {
      console.warn('Could not check balance:', balanceError.message);
    }

    console.log('Creating contract factory...');
    console.log('Bytecode length:', ESCROW_BYTECODE.length);
    const factory = new ContractFactory(ESCROW_ABI, ESCROW_BYTECODE, signer);

    console.log('Deploying contract to blockchain...');
    console.log('Constructor params:', {
      client: normalizedClientAddress,
      freelancer: normalizedFreelancerAddress,
      token: normalizedTokenAddress,
      milestones: milestoneAmountsWei.map(m => formatUnits(m, 18)),
      milestonesWei: milestoneAmountsWei.map(m => m.toString())
    });

    let contract;
    try {
      contract = await factory.deploy(
        normalizedClientAddress,
        normalizedFreelancerAddress,
        normalizedTokenAddress,
        milestoneAmountsWei,
        {
          gasLimit: 5000000,
          type: 0,  // Use legacy transaction (not EIP-1559)
          // Add manual gas price to avoid eth_maxPriorityFeePerGas calls
          gasPrice: parseUnits('0.000000007', 'gwei')
        }
      );
    } catch (deployError: any) {
      console.error('Error sending deployment transaction:', deployError);
      
      // Check if it's the RPC error we're seeing
      if (deployError.message?.includes('eth_maxPriorityFeePerGas')) {
        console.log('Retrying with manual gas configuration...');
        // Retry with even more explicit gas settings
        contract = await factory.deploy(
          normalizedClientAddress,
          normalizedFreelancerAddress,
          normalizedTokenAddress,
          milestoneAmountsWei,
          {
            gasLimit: 5000000,
            type: 0,
            gasPrice: 7000000000 // 7 Gwei in wei
          }
        );
      } else {
        throw deployError;
      }
    }

    console.log('Contract deployment transaction sent!');
    const deployTx = contract.deploymentTransaction();
    console.log('Transaction hash:', deployTx?.hash);

    console.log('Waiting for deployment confirmation...');
    
    // Add timeout for deployment confirmation
    const deploymentPromise = contract.waitForDeployment();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Deployment confirmation timeout')), 60000); // 60 second timeout
    });

    try {
      await Promise.race([deploymentPromise, timeoutPromise]);
      const address = await contract.getAddress();
      console.log('✅ Contract deployed successfully at:', address);
      return address;
    } catch (timeoutError) {
      // If timeout, try to get the contract address from the transaction receipt
      console.log('Deployment confirmation timed out, checking transaction receipt...');
      
      if (deployTx?.hash) {
        // Try multiple times to get the receipt
        for (let attempt = 1; attempt <= 5; attempt++) {
          console.log(`Attempt ${attempt} to get transaction receipt...`);
          
          try {
            const receipt = await signer.provider.getTransactionReceipt(deployTx.hash);
            
            if (receipt) {
              if (receipt.contractAddress) {
                console.log('✅ Contract deployed successfully at:', receipt.contractAddress);
                return receipt.contractAddress;
              } else if (receipt.status === 1) {
                // Transaction succeeded, try to get address from contract object
                try {
                  const address = await contract.getAddress();
                  if (address) {
                    console.log('✅ Contract deployed successfully at:', address);
                    return address;
                  }
                } catch (e) {
                  console.log('Could not get address from contract object');
                }
              } else if (receipt.status === 0) {
                throw new Error('Transaction failed - deployment reverted');
              }
            }
          } catch (receiptError) {
            console.log(`Attempt ${attempt} failed:`, receiptError);
          }
          
          // Wait before next attempt
          if (attempt < 5) {
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
        
        // If we still don't have a receipt, provide manual recovery instructions
        console.log('=== Manual Recovery Instructions ===');
        console.log('Transaction hash:', deployTx.hash);
        console.log('1. Check transaction status at: https://testnet.qie.digital/tx/' + deployTx.hash);
        console.log('2. Once confirmed, get the contract address from the transaction');
        console.log('3. Run in console: getContractAddressFromTxHash("' + deployTx.hash + '")');
        
        // Return a placeholder that indicates pending
        throw new Error(`Deployment pending. Transaction: ${deployTx.hash}. Check blockchain explorer for status.`);
      }
      
      throw new Error('Could not get deployment transaction hash');
    }
  } catch (error: any) {
    console.error('❌ Contract deployment error:', error);

    // Provide more helpful error messages
    if (error.code === 'INSUFFICIENT_FUNDS') {
      throw new Error('Insufficient funds in wallet to deploy contract');
    } else if (error.code === 'NETWORK_ERROR') {
      throw new Error('Network connection error. Please check your internet connection and try again.');
    } else if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
      throw new Error('Contract deployment simulation failed. Please check your wallet balance and network connection.');
    } else if (error.message?.includes('user rejected')) {
      throw new Error('Transaction was rejected by user');
    } else if (error.message?.includes('nonce')) {
      throw new Error('Transaction nonce error. Please try again.');
    }

    throw error;
  }
}

export async function getEscrowContract(address: string) {
  const signer = await getSigner();
  return new Contract(address, ESCROW_ABI, signer);
}

export async function depositToEscrow(escrowAddress: string, tokenAddress: string, amount: string) {
  try {
    const signer = await getSigner();
    const amountWei = parseUnits(amount, 18);
    const escrowContract = await getEscrowContract(escrowAddress);
    
    console.log('Depositing to escrow:', {
      escrowAddress,
      tokenAddress,
      amount,
      amountWei: amountWei.toString()
    });

    let depositTx;

    if (tokenAddress === '0x0000000000000000000000000000000000000000') {
      // Native QIE token - send with value
      console.log('Depositing native QIE tokens through depositFunds()...');
      
      // IMPORTANT: Must use depositFunds() to set isActive = true
      // Direct transfers won't activate the escrow!
      depositTx = await escrowContract.depositFunds({
        value: amountWei,
        gasLimit: 300000,
        type: 0,  // Use legacy transaction
        gasPrice: parseUnits('0.000000007', 'gwei')
      });
    } else {
      // ERC20 token - approve first then deposit
      console.log('Depositing ERC20 tokens...');
      const ERC20_ABI = [
        'function approve(address spender, uint256 amount) public returns (bool)',
      ];
      const tokenContract = new Contract(tokenAddress, ERC20_ABI, signer);

      console.log('Approving token transfer...');
      const approveTx = await tokenContract.approve(escrowAddress, amountWei);
      await approveTx.wait();
      console.log('Token transfer approved');

      console.log('Calling depositFunds...');
      depositTx = await escrowContract.depositFunds({ gasLimit: 300000 });
    }

    console.log('Waiting for deposit confirmation...');
    await depositTx.wait();
    console.log('✅ Deposit confirmed!');
    
    return depositTx.hash;
  } catch (error: any) {
    console.error('❌ Error depositing to escrow:', error);
    
    // Provide more specific error messages
    if (error.message?.includes('insufficient funds')) {
      throw new Error('Insufficient QIE balance in your wallet');
    } else if (error.message?.includes('user rejected')) {
      throw new Error('Transaction was rejected in wallet');
    }
    
    throw error;
  }
}

export async function verifyAndPayMilestone(
  escrowAddress: string,
  milestoneIndex: number,
  verificationHash: string
) {
  const signer = await getSigner();
  const connectedAddress = await signer.getAddress();

  console.log('=== Payment Release Debug Info ===');
  console.log('Connected wallet address:', connectedAddress);
  console.log('Connected wallet (lowercase):', connectedAddress.toLowerCase());
  console.log('Escrow contract address:', escrowAddress);
  console.log('Milestone index:', milestoneIndex);

  const contract = await getEscrowContract(escrowAddress);

  const clientAddress = await contract.client();
  console.log('Contract client address:', clientAddress);
  console.log('Contract client (lowercase):', clientAddress.toLowerCase());
  console.log('Addresses match?', connectedAddress.toLowerCase() === clientAddress.toLowerCase());
  
  // Check if addresses match (case-insensitive)
  if (connectedAddress.toLowerCase() !== clientAddress.toLowerCase()) {
    const error = new Error(`Wallet mismatch! Contract requires client wallet: ${clientAddress}, but connected wallet is: ${connectedAddress}. Please switch to the correct wallet in your wallet extension.`);
    console.error(error.message);
    throw error;
  }

  console.log('✅ Wallet verification passed, proceeding with milestone verification...');
  
  // Quick sanity check
  try {
    const provider = await getProvider();
    const balance = await provider.getBalance(escrowAddress);
    console.log('Contract balance:', formatUnits(balance, 18), 'QIE');

    if (balance === 0n) {
      throw new Error('Escrow contract has no funds. Please deposit funds first.');
    }
  } catch (e: any) {
    if (e.message.includes('no funds')) {
      throw e;
    }
    console.log('Could not check balance:', e.message);
  }
  
  try {
    console.log('Calling verifyMilestone with index:', milestoneIndex, 'hash:', verificationHash);
    const verifyTx = await contract.verifyMilestone(milestoneIndex, verificationHash);
    await verifyTx.wait();
    console.log('✅ Milestone verified successfully');

    console.log('Releasing milestone payment...');
    const payTx = await contract.releaseMilestonePayment(milestoneIndex);
    await payTx.wait();
    console.log('✅ Payment released successfully');

    return payTx.hash;
  } catch (error: any) {
    console.error('Contract call error:', error);

    if (error.message.includes('missing revert data') || error.code === 'CALL_EXCEPTION') {
      throw new Error(`Contract error: The contract at ${escrowAddress} may not be properly initialized. Try deploying a fresh contract.`);
    }

    throw new Error(`Transaction failed: ${error.reason || error.message}`);
  }
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

// Helper function to get contract address from transaction hash
export async function getContractAddressFromTxHash(txHash: string): Promise<string | null> {
  try {
    const provider = await getProvider();
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (receipt && receipt.contractAddress) {
      console.log('Found contract address from transaction:', receipt.contractAddress);
      return receipt.contractAddress;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting contract address from tx hash:', error);
    return null;
  }
}

// Helper function to manually check deployment status
export async function checkDeploymentStatus(txHash: string): Promise<{
  deployed: boolean;
  address?: string;
  blockNumber?: number;
  status?: number;
}> {
  try {
    const provider = await getProvider();
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!receipt) {
      return { deployed: false };
    }
    
    return {
      deployed: receipt.status === 1,
      address: receipt.contractAddress || undefined,
      blockNumber: receipt.blockNumber,
      status: receipt.status
    };
  } catch (error) {
    console.error('Error checking deployment status:', error);
    return { deployed: false };
  }
}

// Debug function to check contract details
export async function debugContractDetails(escrowAddress: string) {
  try {
    console.log('=== Contract Debug Information ===');
    
    // Get current wallet
    const currentWallet = await getCurrentWalletAddress();
    console.log('Current MetaMask wallet:', currentWallet);
    
    // Get contract details
    const contract = await getEscrowContract(escrowAddress);
    
    const clientAddress = await contract.client();
    const freelancerAddress = await contract.freelancer();
    const tokenAddress = await contract.paymentToken();
    
    console.log('Contract Details:');
    console.log('- Client address:', clientAddress);
    console.log('- Freelancer address:', freelancerAddress);
    console.log('- Token address:', tokenAddress);
    console.log('- Contract address:', escrowAddress);
    
    // Check role of current wallet
    if (currentWallet) {
      const isClient = currentWallet.toLowerCase() === clientAddress.toLowerCase();
      const isFreelancer = currentWallet.toLowerCase() === freelancerAddress.toLowerCase();
      
      console.log('\nYour Role:');
      if (isClient) {
        console.log('✅ You are the CLIENT');
      } else if (isFreelancer) {
        console.log('✅ You are the FREELANCER');
      } else {
        console.log('❌ You are neither client nor freelancer');
        console.log('   Required client wallet:', clientAddress);
        console.log('   Required freelancer wallet:', freelancerAddress);
      }
    }
    
    return {
      client: clientAddress,
      freelancer: freelancerAddress,
      token: tokenAddress,
      currentWallet,
      isClient: currentWallet ? currentWallet.toLowerCase() === clientAddress.toLowerCase() : false,
      isFreelancer: currentWallet ? currentWallet.toLowerCase() === freelancerAddress.toLowerCase() : false
    };
  } catch (error) {
    console.error('Error debugging contract:', error);
    throw error;
  }
}

// Function to check escrow status and balance
export async function checkEscrowStatus(escrowAddress: string) {
  try {
    console.log('=== Escrow Status Check ===');
    const contract = await getEscrowContract(escrowAddress);
    
    // Get basic contract info
    const clientAddress = await contract.client();
    const freelancerAddress = await contract.freelancer();
    const tokenAddress = await contract.paymentToken();
    
    console.log('Contract:', escrowAddress);
    console.log('Client:', clientAddress);
    console.log('Freelancer:', freelancerAddress);
    console.log('Payment Token:', tokenAddress);
    
    // Check if escrow is active
    let isActive = false;
    let totalAmount = 0n;
    
    try {
      // Check the isActive flag
      isActive = await contract.isActive();
      console.log('Escrow Active (isActive flag):', isActive);
      
      // Get total amount
      totalAmount = await contract.totalAmount();
      console.log('Total Amount:', formatUnits(totalAmount, 18), 'tokens');
    } catch (e) {
      console.log('Could not check escrow active status');
    }
    
    // Check milestone statuses
    try {
      const milestoneCount = await contract.milestoneCount();
      console.log('Total Milestones:', milestoneCount.toString());
      
      for (let i = 0; i < milestoneCount; i++) {
        const milestone = await contract.milestones(i);
        console.log(`Milestone ${i}:`, {
          amount: formatUnits(milestone.amount, 18),
          verified: milestone.verified,
          paid: milestone.paid
        });
      }
    } catch (e) {
      console.log('Could not check milestone details');
    }
    
    // Check contract balance if native token
    if (tokenAddress === '0x0000000000000000000000000000000000000000') {
      const provider = await getProvider();
      const balance = await provider.getBalance(escrowAddress);
      console.log('Contract QIE Balance:', formatUnits(balance, 18), 'QIE');
      
      if (balance === 0n) {
        console.log('❌ ESCROW NOT FUNDED: The client needs to deposit QIE tokens first!');
        console.log('   The client should call depositFunds() with the total project amount');
      } else if (balance > 0n && !isActive) {
        console.log('⚠️ WARNING: Contract has funds but is NOT ACTIVE!');
        console.log('   Funds were likely sent directly instead of through depositFunds()');
        console.log('   The contract needs proper activation through depositFunds()');
      } else if (balance > 0n && isActive) {
        console.log('✅ Contract is funded and active, ready for milestone operations');
      }
    }
    
    return {
      isActive,
      totalAmount: formatUnits(totalAmount, 18),
      client: clientAddress,
      freelancer: freelancerAddress,
      token: tokenAddress,
      balance: tokenAddress === '0x0000000000000000000000000000000000000000'
        ? formatUnits(await (await getProvider()).getBalance(escrowAddress), 18)
        : '0'
    };
  } catch (error) {
    console.error('Error checking escrow status:', error);
    throw error;
  }
}

// Export debug functions to window for console access
if (typeof window !== 'undefined') {
  (window as any).debugContractDetails = debugContractDetails;
  (window as any).checkEscrowStatus = checkEscrowStatus;
}
