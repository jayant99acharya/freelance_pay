// Direct transaction helper to bypass RPC limitations
import { BrowserProvider, Contract, parseUnits, formatUnits } from 'ethers';
import { ESCROW_ABI } from '../contracts/escrow-abi';

// Function to send raw transaction directly
export async function sendRawMilestoneVerification(
  escrowAddress: string,
  milestoneIndex: number,
  verificationHash: string
) {
  try {
    if (!window.ethereum) {
      throw new Error('MetaMask not installed');
    }

    console.log('=== Direct Transaction Approach ===');
    console.log('Contract:', escrowAddress);
    console.log('Milestone:', milestoneIndex);
    console.log('Hash:', verificationHash);

    // Get the current account
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (!accounts || accounts.length === 0) {
      throw new Error('No wallet connected');
    }

    const from = accounts[0];
    console.log('From address:', from);

    // Create contract interface
    const contract = new Contract(escrowAddress, ESCROW_ABI);
    
    // Encode the function call
    const data = contract.interface.encodeFunctionData('verifyMilestone', [
      milestoneIndex,
      verificationHash
    ]);

    console.log('Encoded data:', data);

    // Send transaction directly through MetaMask
    const txHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        from: from,
        to: escrowAddress,
        data: data,
        gas: '0x493E0', // 300000 in hex
        gasPrice: '0x1A13B8600', // 7 Gwei in hex
        type: '0x0' // Legacy transaction
      }]
    });

    console.log('✅ Transaction sent! Hash:', txHash);
    console.log('Check status at: https://testnet.qie.digital/tx/' + txHash);
    
    return txHash;
  } catch (error: any) {
    console.error('Error sending raw transaction:', error);
    throw error;
  }
}

// Function to release payment directly
export async function sendRawPaymentRelease(
  escrowAddress: string,
  milestoneIndex: number
) {
  try {
    if (!window.ethereum) {
      throw new Error('MetaMask not installed');
    }

    console.log('=== Direct Payment Release ===');
    console.log('Contract:', escrowAddress);
    console.log('Milestone:', milestoneIndex);

    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (!accounts || accounts.length === 0) {
      throw new Error('No wallet connected');
    }

    const from = accounts[0];
    console.log('From address:', from);

    // Create contract interface
    const contract = new Contract(escrowAddress, ESCROW_ABI);
    
    // Encode the function call
    const data = contract.interface.encodeFunctionData('releaseMilestonePayment', [
      milestoneIndex
    ]);

    console.log('Encoded data:', data);

    // Send transaction directly
    const txHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        from: from,
        to: escrowAddress,
        data: data,
        gas: '0x493E0', // 300000 in hex
        gasPrice: '0x1A13B8600', // 7 Gwei in hex
        type: '0x0'
      }]
    });

    console.log('✅ Payment release transaction sent! Hash:', txHash);
    console.log('Check status at: https://testnet.qie.digital/tx/' + txHash);
    
    return txHash;
  } catch (error: any) {
    console.error('Error releasing payment:', error);
    throw error;
  }
}

// Combined function to verify and pay in sequence
export async function directVerifyAndPay(
  escrowAddress: string,
  milestoneIndex: number,
  verificationHash: string
) {
  try {
    console.log('=== Direct Verify and Pay ===');
    
    // Step 1: Verify milestone
    console.log('Step 1: Verifying milestone...');
    const verifyTx = await sendRawMilestoneVerification(
      escrowAddress,
      milestoneIndex,
      verificationHash
    );
    
    console.log('Verification transaction sent:', verifyTx);
    console.log('⏳ Please wait for confirmation in MetaMask...');
    console.log('   Once confirmed, run: directPayMilestone("' + escrowAddress + '", ' + milestoneIndex + ')');
    
    return {
      verifyTx,
      nextStep: `directPayMilestone("${escrowAddress}", ${milestoneIndex})`
    };
  } catch (error: any) {
    console.error('Error in direct verify and pay:', error);
    throw error;
  }
}

// Separate payment function
export async function directPayMilestone(
  escrowAddress: string,
  milestoneIndex: number
) {
  try {
    console.log('=== Direct Payment Release ===');
    const payTx = await sendRawPaymentRelease(escrowAddress, milestoneIndex);
    console.log('✅ Payment transaction sent:', payTx);
    return payTx;
  } catch (error: any) {
    console.error('Error releasing payment:', error);
    throw error;
  }
}

// Export to window for console access
if (typeof window !== 'undefined') {
  (window as any).directVerifyAndPay = directVerifyAndPay;
  (window as any).directPayMilestone = directPayMilestone;
  (window as any).sendRawMilestoneVerification = sendRawMilestoneVerification;
  (window as any).sendRawPaymentRelease = sendRawPaymentRelease;
  
  console.log('Direct transaction functions loaded:');
  console.log('- directVerifyAndPay(contractAddress, milestoneIndex, verificationHash)');
  console.log('- directPayMilestone(contractAddress, milestoneIndex)');
  console.log('Example for your contract:');
  console.log('  directVerifyAndPay("0x24e44B70C91394d2A3FEC621C5d8bBa1A0aCE38D", 0, "0x76657269666965642d38653864626264332d326665312d346233352d39303730")');
}

export default {
  sendRawMilestoneVerification,
  sendRawPaymentRelease,
  directVerifyAndPay,
  directPayMilestone
};