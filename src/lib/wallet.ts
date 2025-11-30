// Pure wallet connection without ethers.js
// This file should NEVER import ethers to avoid conflicts

declare global {
  interface Window {
    ethereum?: any;
  }
}

export async function getAllAccounts(): Promise<string[]> {
  if (!window.ethereum) {
    return [];
  }

  try {
    let provider = window.ethereum;

    if (window.ethereum.providers && Array.isArray(window.ethereum.providers)) {
      const metaMaskProvider = window.ethereum.providers.find((p: any) => p.isMetaMask);
      if (metaMaskProvider) {
        provider = metaMaskProvider;
      }
    }

    // Request permission and get all accounts
    const accounts = await provider.request({
      method: 'wallet_requestPermissions',
      params: [{ eth_accounts: {} }],
    });

    // After permissions, get the accounts
    const accountsList = await provider.request({
      method: 'eth_accounts',
    });

    return accountsList || [];
  } catch (error) {
    console.error('Error getting all accounts:', error);
    return [];
  }
}

export async function connectWallet(): Promise<string> {
  if (!window.ethereum) {
    throw new Error('MetaMask is not installed');
  }

  let provider = window.ethereum;

  if (window.ethereum.providers && Array.isArray(window.ethereum.providers)) {
    const metaMaskProvider = window.ethereum.providers.find((p: any) => p.isMetaMask);
    if (metaMaskProvider) {
      provider = metaMaskProvider;
    }
  }

  try {
    // Force MetaMask to show account selector by requesting permissions
    await provider.request({
      method: 'wallet_requestPermissions',
      params: [{ eth_accounts: {} }],
    });

    // Now get the selected account
    const accounts = await provider.request({
      method: 'eth_requestAccounts',
    });

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts returned from MetaMask');
    }

    return accounts[0];
  } catch (error: any) {
    // If user rejected, throw friendly error
    if (error.code === 4001) {
      throw new Error('Connection request rejected');
    }
    throw error;
  }
}

export async function getCurrentAccount(): Promise<string | null> {
  if (!window.ethereum) {
    return null;
  }

  let provider = window.ethereum;

  if (window.ethereum.providers && Array.isArray(window.ethereum.providers)) {
    const metaMaskProvider = window.ethereum.providers.find((p: any) => p.isMetaMask);
    if (metaMaskProvider) {
      provider = metaMaskProvider;
    }
  }

  const accounts = await provider.request({
    method: 'eth_accounts',
  });

  return accounts[0] || null;
}

export function onAccountsChanged(callback: (accounts: string[]) => void): () => void {
  if (!window.ethereum) {
    return () => {};
  }

  let provider = window.ethereum;

  if (window.ethereum.providers && Array.isArray(window.ethereum.providers)) {
    const metaMaskProvider = window.ethereum.providers.find((p: any) => p.isMetaMask);
    if (metaMaskProvider) {
      provider = metaMaskProvider;
    }
  }

  const handler = (accounts: string[]) => {
    callback(accounts);
  };

  try {
    if (typeof provider.on === 'function') {
      provider.on('accountsChanged', handler);
    }
  } catch (e) {
    console.warn('Could not add accounts changed listener:', e);
  }

  // Return cleanup function
  return () => {
    try {
      if (typeof provider.removeListener === 'function') {
        provider.removeListener('accountsChanged', handler);
      }
    } catch (e) {
      console.warn('Could not remove accounts changed listener:', e);
    }
  };
}
