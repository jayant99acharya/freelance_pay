// Simple milestone payment helper for QIE testnet
import { Contract } from 'ethers';
import { ESCROW_ABI } from '../contracts/escrow-abi';

// Simple function to verify and pay milestone using MetaMask directly
export async function payMilestoneDirectly(
  contractAddress: string,
  milestoneIndex: number
) {
  try {
    if (!window.ethereum) {
      throw new Error('MetaMask not installed');
    }

    console.log('=== Direct Milestone Payment ===');
    console.log('Contract:', contractAddress);
    console.log('Milestone Index:', milestoneIndex);

    // Get current account
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (!accounts || accounts.length === 0) {
      throw new Error('No wallet connected. Please connect your wallet first.');
    }

    const from = accounts[0];
    console.log('Your wallet:', from);

    // Create contract interface for encoding
    const contractInterface = new Contract(contractAddress, ESCROW_ABI).interface;

    // Step 1: Generate verification hash (simplified)
    const timestamp = Date.now().toString();
    // Convert string to hex without Buffer (browser-compatible)
    const str = `verified-${timestamp}`;
    let hex = '';
    for (let i = 0; i < str.length; i++) {
      hex += str.charCodeAt(i).toString(16);
    }
    const verificationHash = '0x' + hex.padEnd(64, '0');
    console.log('Verification hash:', verificationHash);

    // Step 2: Encode and send verification transaction
    console.log('\nStep 1: Sending verification transaction...');
    const verifyData = contractInterface.encodeFunctionData('verifyMilestone', [
      milestoneIndex,
      verificationHash
    ]);

    const verifyTxHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        from: from,
        to: contractAddress,
        data: verifyData,
        gas: '0x493E0', // 300000 in hex
        gasPrice: '0x1A13B8600' // 7 Gwei in hex
      }]
    });

    console.log('✅ Verification transaction sent:', verifyTxHash);
    console.log('Waiting 10 seconds for confirmation...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Step 3: Encode and send payment release transaction
    console.log('\nStep 2: Sending payment release transaction...');
    const payData = contractInterface.encodeFunctionData('releaseMilestonePayment', [
      milestoneIndex
    ]);

    const payTxHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        from: from,
        to: contractAddress,
        data: payData,
        gas: '0x493E0', // 300000 in hex
        gasPrice: '0x1A13B8600' // 7 Gwei in hex
      }]
    });

    console.log('✅ Payment release transaction sent:', payTxHash);
    console.log('\n=== Success! ===');
    console.log('Verification TX:', verifyTxHash);
    console.log('Payment TX:', payTxHash);
    console.log('Check status at:');
    console.log(`https://testnet.qie.digital/tx/${verifyTxHash}`);
    console.log(`https://testnet.qie.digital/tx/${payTxHash}`);

    return {
      verifyTx: verifyTxHash,
      payTx: payTxHash
    };
  } catch (error: any) {
    console.error('❌ Error:', error);
    if (error.code === 4001) {
      console.log('Transaction rejected by user');
    }
    throw error;
  }
}

// Simpler version - just verify milestone
export async function verifyMilestoneOnly(
  contractAddress: string,
  milestoneIndex: number,
  verificationHash?: string
) {
  try {
    if (!window.ethereum) {
      throw new Error('MetaMask not installed');
    }

    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (!accounts || accounts.length === 0) {
      throw new Error('No wallet connected');
    }

    const from = accounts[0];
    // Use provided hash or generate one
    if (!verificationHash) {
      const str = `verified-${Date.now()}`;
      let hex = '';
      for (let i = 0; i < str.length; i++) {
        hex += str.charCodeAt(i).toString(16);
      }
      verificationHash = '0x' + hex.padEnd(64, '0');
    }
    const hash = verificationHash;
    
    
    console.log('Verifying milestone:', milestoneIndex);
    console.log('Hash:', hash);

    const contractInterface = new Contract(contractAddress, ESCROW_ABI).interface;
    const data = contractInterface.encodeFunctionData('verifyMilestone', [milestoneIndex, hash]);

    const txHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        from: from,
        to: contractAddress,
        data: data,
        gas: '0x493E0',
        gasPrice: '0x1A13B8600'
      }]
    });

    console.log('✅ Verification TX sent:', txHash);
    return txHash;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Release payment only
export async function releaseMilestonePayment(
  contractAddress: string,
  milestoneIndex: number
) {
  try {
    if (!window.ethereum) {
      throw new Error('MetaMask not installed');
    }

    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (!accounts || accounts.length === 0) {
      throw new Error('No wallet connected');
    }

    const from = accounts[0];
    
    console.log('Releasing payment for milestone:', milestoneIndex);

    const contractInterface = new Contract(contractAddress, ESCROW_ABI).interface;
    const data = contractInterface.encodeFunctionData('releaseMilestonePayment', [milestoneIndex]);

    const txHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        from: from,
        to: contractAddress,
        data: data,
        gas: '0x493E0',
        gasPrice: '0x1A13B8600'
      }]
    });

    console.log('✅ Payment release TX sent:', txHash);
    return txHash;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Export to window for console access
if (typeof window !== 'undefined') {
  (window as any).payMilestoneDirectly = payMilestoneDirectly;
  (window as any).verifyMilestoneOnly = verifyMilestoneOnly;
  (window as any).releaseMilestonePayment = releaseMilestonePayment;
  
  console.log('💰 Simple milestone payment functions loaded!');
  console.log('Available functions:');
  console.log('- payMilestoneDirectly(contractAddress, milestoneIndex)');
  console.log('- verifyMilestoneOnly(contractAddress, milestoneIndex)');
  console.log('- releaseMilestonePayment(contractAddress, milestoneIndex)');
  console.log('\nExample for your contract:');
  console.log('payMilestoneDirectly("0x24e44B70C91394d2A3FEC621C5d8bBa1A0aCE38D", 0)');
}