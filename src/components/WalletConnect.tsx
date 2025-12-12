import { useState, useEffect } from 'react';
import { Wallet, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { connectWallet, getCurrentAccount, onAccountsChanged } from '../lib/wallet';

export function WalletConnect() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [currentWalletAddress, setCurrentWalletAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadWalletAddress();
      checkCurrentWalletAccount();
    }

    // Listen for account changes
    const cleanup = onAccountsChanged((accounts) => {
      handleAccountsChanged(accounts);
    });

    return cleanup;
  }, [user]);

  const handleAccountsChanged = async (accounts: string[]) => {
    const newAddress = accounts[0] || null;
    setCurrentWalletAddress(newAddress);

    // Auto-update the database when wallet account changes
    if (newAddress && user) {
      await supabase
        .from('profiles')
        .update({ wallet_address: newAddress })
        .eq('id', user.id);
      setWalletAddress(newAddress);
    }
  };

  const checkCurrentWalletAccount = async () => {
    try {
      const account = await getCurrentAccount();
      setCurrentWalletAddress(account);
    } catch (error) {
      console.error('Error getting current wallet:', error);
    }
  };

  const loadWalletAddress = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('wallet_address')
      .eq('id', user.id)
      .maybeSingle();

    if (data?.wallet_address) {
      setWalletAddress(data.wallet_address);
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    try {
      console.log('Requesting wallet connection...');

      // Show account selector
      const address = await connectWallet();
      console.log('Got address from wallet:', address);

      setWalletAddress(address);
      setCurrentWalletAddress(address);

      if (user) {
        console.log('Updating database for user:', user.id);
        const { data, error } = await supabase
          .from('profiles')
          .update({ wallet_address: address })
          .eq('id', user.id)
          .select();

        if (error) {
          console.error('Database update error:', error);
          alert('Failed to save wallet address: ' + error.message);
        } else {
          console.log('Database updated successfully:', data);
          alert('Wallet connected successfully!');
        }
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      alert('Failed to connect wallet: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ wallet_address: null })
        .eq('id', user.id);

      if (error) throw error;

      setWalletAddress(null);
      alert('Wallet disconnected. You can now connect a different account.');
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
      alert('Failed to disconnect wallet: ' + (error as Error).message);
    }
  };

  const addressMismatch = walletAddress && currentWalletAddress &&
    walletAddress.toLowerCase() !== currentWalletAddress.toLowerCase();

  // Always show the connect button, but display current status
  return (
    <div className="flex flex-col gap-2 items-end">
      <div className="flex items-center gap-2">
        {addressMismatch && (
          <div className="flex items-center gap-1 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
            <AlertCircle className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-yellow-400">
              Different wallet account detected
            </span>
          </div>
        )}

        {walletAddress && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-mono text-emerald-400">
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </span>
          </div>
        )}

        {walletAddress ? (
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 hover:text-red-300 hover:border-red-400 transition-all"
          >
            <Wallet className="w-4 h-4" />
            <span className="text-sm font-medium">Disconnect</span>
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-300 hover:text-white hover:border-slate-600 transition-all disabled:opacity-50"
          >
            <Wallet className="w-4 h-4" />
            <span className="text-sm font-medium">
              {loading ? 'Connecting...' : 'Connect Wallet'}
            </span>
          </button>
        )}
      </div>

      {walletAddress && (
        <div className="text-xs text-slate-400 text-right">
          Click "Disconnect" to connect a different wallet
        </div>
      )}
    </div>
  );
}
