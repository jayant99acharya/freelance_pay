// Escrow Helper Functions
import { depositToEscrow, checkEscrowStatus, formatTokenAmount } from './web3';

/**
 * Helper to deposit funds to escrow contract
 * @param escrowAddress - The escrow contract address
 * @param amount - Amount in QIE tokens to deposit
 */
export async function fundEscrow(escrowAddress: string, amount: string) {
  try {
    console.log('=== Funding Escrow Contract ===');
    console.log('Escrow Address:', escrowAddress);
    console.log('Amount to deposit:', amount, 'QIE');
    
    // Check status before deposit
    const statusBefore = await checkEscrowStatus(escrowAddress);
    console.log('Status before deposit:', statusBefore);
    
    if (statusBefore.isActive) {
      console.log('⚠️ Escrow is already active with funds');
      return;
    }
    
    // Native QIE token address (0x000...)
    const nativeTokenAddress = '0x0000000000000000000000000000000000000000';
    
    console.log('Depositing funds...');
    const txHash = await depositToEscrow(escrowAddress, nativeTokenAddress, amount);
    
    console.log('✅ Deposit successful!');
    console.log('Transaction hash:', txHash);
    
    // Check status after deposit
    setTimeout(async () => {
      const statusAfter = await checkEscrowStatus(escrowAddress);
      console.log('Status after deposit:', statusAfter);
    }, 5000);
    
    return txHash;
  } catch (error) {
    console.error('❌ Error funding escrow:', error);
    throw error;
  }
}

// Export to window for console access
if (typeof window !== 'undefined') {
  (window as any).fundEscrow = fundEscrow;
}

// Instructions for the user
export function showFundingInstructions() {
  console.log(`
=== HOW TO FIX "Escrow is not active" ERROR ===

The escrow contract needs to be funded before milestones can be paid.

STEP 1: Check escrow status
  Run: checkEscrowStatus('0xe2eda59271793B5b052094CCD382c1ba2a193966')

STEP 2: Fund the escrow (as client)
  Run: fundEscrow('0xe2eda59271793B5b052094CCD382c1ba2a193966', '0.01')
  
  Replace '0.01' with the total project amount in QIE tokens.
  Make sure you have enough QIE in your wallet!

STEP 3: After funding, you can verify and release milestones
  The "Release Payment" button should work after the escrow is funded.

CURRENT CONTRACT: 0xe2eda59271793B5b052094CCD382c1ba2a193966
CLIENT WALLET: 0xCa315E6B41e32523d591d0f2F24011308218608B
  `);
}

if (typeof window !== 'undefined') {
  (window as any).showFundingInstructions = showFundingInstructions;
}