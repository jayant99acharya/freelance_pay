// Contract Fix Utility
// Fixes contracts that have funds but aren't active

import { getEscrowContract, getSigner, formatTokenAmount, parseTokenAmount, getProvider } from './web3';
import { formatUnits, parseUnits } from 'ethers';

/**
 * Activates a contract that has funds but isn't active
 * This happens when funds were sent directly instead of through depositFunds()
 */
export async function activateEscrowContract(escrowAddress: string) {
  try {
    console.log('=== Activating Escrow Contract ===');
    console.log('Contract address:', escrowAddress);
    
    const contract = await getEscrowContract(escrowAddress);
    const signer = await getSigner();
    
    // Check current status
    const isActive = await contract.isActive();
    console.log('Current isActive status:', isActive);
    
    if (isActive) {
      console.log('✅ Contract is already active!');
      return true;
    }
    
    // Get contract details
    const totalAmount = await contract.totalAmount();
    const provider = await signer.provider;
    const balance = await provider.getBalance(escrowAddress);
    
    console.log('Total amount required:', formatUnits(totalAmount, 18), 'QIE');
    console.log('Current contract balance:', formatUnits(balance, 18), 'QIE');
    
    if (balance >= totalAmount) {
      console.log('✅ Contract already has sufficient funds');
      console.log('⚠️ But isActive is false - funds were sent directly');
      console.log('Unfortunately, the contract cannot be activated retroactively');
      console.log('You may need to:');
      console.log('1. Cancel the escrow and get refund');
      console.log('2. Create a new project with proper funding');
      return false;
    }
    
    // If contract doesn't have enough funds, deposit the remaining
    const remaining = totalAmount - balance;
    console.log('Depositing remaining amount:', formatUnits(remaining, 18), 'QIE');
    
    const tx = await contract.depositFunds({
      value: totalAmount, // Must send exact total amount
      gasLimit: 300000,
      type: 0,
      gasPrice: parseUnits('0.000000007', 'gwei')
    });
    
    console.log('Transaction sent:', tx.hash);
    console.log('Waiting for confirmation...');
    await tx.wait();
    
    // Verify activation
    const newIsActive = await contract.isActive();
    console.log('New isActive status:', newIsActive);
    
    if (newIsActive) {
      console.log('✅ Contract successfully activated!');
      return true;
    } else {
      console.log('❌ Contract activation failed');
      return false;
    }
  } catch (error: any) {
    console.error('Error activating contract:', error);
    
    if (error.message?.includes('Escrow already funded')) {
      console.log('Contract reports it is already funded');
      console.log('This means funds were sent directly and contract cannot be activated');
    }
    
    throw error;
  }
}

/**
 * Attempts to fix a contract by withdrawing and re-depositing funds properly
 */
export async function fixInactiveContract(escrowAddress: string) {
  try {
    console.log('=== Attempting to Fix Inactive Contract ===');
    
    const contract = await getEscrowContract(escrowAddress);
    const signer = await getSigner();
    const signerAddress = await signer.getAddress();
    
    // Check if we're the client
    const clientAddress = await contract.client();
    if (signerAddress.toLowerCase() !== clientAddress.toLowerCase()) {
      throw new Error('Only the client can fix the contract');
    }
    
    // Check current status
    const isActive = await contract.isActive();
    const totalAmount = await contract.totalAmount();
    const provider = await signer.provider;
    const balance = await provider.getBalance(escrowAddress);
    
    console.log('Contract status:');
    console.log('- isActive:', isActive);
    console.log('- Total amount:', formatUnits(totalAmount, 18), 'QIE');
    console.log('- Current balance:', formatUnits(balance, 18), 'QIE');
    
    if (isActive) {
      console.log('✅ Contract is already active!');
      return true;
    }
    
    if (balance === 0n) {
      console.log('Contract has no funds, depositing...');
      const tx = await contract.depositFunds({
        value: totalAmount,
        gasLimit: 300000,
        type: 0,
        gasPrice: parseUnits('0.000000007', 'gwei')
      });
      await tx.wait();
      console.log('✅ Contract funded and activated!');
      return true;
    }
    
    // If contract has funds but isn't active, it's stuck
    console.log('❌ Contract has funds but is not active');
    console.log('This happens when funds were sent directly to the contract address');
    console.log('Unfortunately, these funds cannot activate the contract');
    console.log('');
    console.log('Recommended solution:');
    console.log('1. Create a new project (it will auto-fund correctly)');
    console.log('2. The stuck funds may be recoverable by the contract owner');
    
    return false;
  } catch (error) {
    console.error('Error fixing contract:', error);
    throw error;
  }
}

// Export to window for console access
if (typeof window !== 'undefined') {
  (window as any).activateEscrowContract = activateEscrowContract;
  (window as any).fixInactiveContract = fixInactiveContract;
}