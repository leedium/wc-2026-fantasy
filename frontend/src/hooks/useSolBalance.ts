'use client';

import { useEffect, useState, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

interface UseSolBalanceResult {
  /** SOL balance in SOL units (not lamports), or null if not available */
  balance: number | null;
  /** Whether the balance is currently being fetched */
  isLoading: boolean;
  /** Error message if balance fetch failed, or null if no error */
  error: string | null;
  /** Manually refetch the balance */
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch the connected wallet's SOL balance
 *
 * - Fetches balance when wallet connects
 * - Updates balance when network changes (via connection change)
 * - Handles errors gracefully
 * - Returns balance in SOL (not lamports)
 */
export function useSolBalance(): UseSolBalanceResult {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();

  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!publicKey || !connected) {
      setBalance(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const lamports = await connection.getBalance(publicKey);
      const solBalance = lamports / LAMPORTS_PER_SOL;
      setBalance(solBalance);
    } catch (err) {
      console.error('Failed to fetch SOL balance:', err);
      setError('Failed to fetch balance');
      setBalance(null);
    } finally {
      setIsLoading(false);
    }
  }, [connection, publicKey, connected]);

  // Fetch balance when wallet connects or network changes
  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return {
    balance,
    isLoading,
    error,
    refetch: fetchBalance,
  };
}
