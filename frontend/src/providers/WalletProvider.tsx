'use client';

import {
  WalletAdapterNetwork,
  WalletError,
  WalletNotReadyError,
  WalletConnectionError,
  WalletWindowClosedError,
} from '@solana/wallet-adapter-base';
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  CoinbaseWalletAdapter,
  LedgerWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import { useMemo, useCallback, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useSelectedNetwork } from '@/stores/useAppStore';
import type { SolanaNetwork } from '@/config/env';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

interface WalletProviderProps {
  children: ReactNode;
}

/**
 * Convert our SolanaNetwork type to WalletAdapterNetwork
 */
function toWalletAdapterNetwork(network: SolanaNetwork): WalletAdapterNetwork {
  switch (network) {
    case 'mainnet-beta':
      return WalletAdapterNetwork.Mainnet;
    case 'testnet':
      return WalletAdapterNetwork.Testnet;
    case 'devnet':
    default:
      return WalletAdapterNetwork.Devnet;
  }
}

/**
 * Get the RPC endpoint for the given network
 */
function getEndpoint(network: WalletAdapterNetwork): string {
  return clusterApiUrl(network);
}

export function WalletProvider({ children }: WalletProviderProps) {
  const selectedNetwork = useSelectedNetwork();
  const network = useMemo(() => toWalletAdapterNetwork(selectedNetwork), [selectedNetwork]);
  const endpoint = useMemo(() => getEndpoint(network), [network]);

  // Configure wallet adapters
  // Note: Backpack and other wallets that implement Wallet Standard
  // are auto-detected and don't need explicit adapters
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network }),
      new CoinbaseWalletAdapter(),
      new LedgerWalletAdapter(),
    ],
    [network]
  );

  // Handle wallet errors with toast notifications
  const onError = useCallback((error: WalletError) => {
    // User cancelled connection (closed wallet popup)
    if (error instanceof WalletWindowClosedError) {
      toast.error('Connection cancelled', { duration: 5000 });
      return;
    }

    // Wallet not installed or not ready
    if (error instanceof WalletNotReadyError) {
      const walletName = error.message.includes('wallet')
        ? error.message.split(' ')[0]
        : 'Wallet';
      toast.error(`Wallet not found. Please install ${walletName}`, { duration: 5000 });
      return;
    }

    // Connection failed (network error, wallet rejected, etc.)
    if (error instanceof WalletConnectionError) {
      toast.error('Failed to connect. Please try again', { duration: 5000 });
      return;
    }

    // Generic wallet error fallback
    toast.error(error.message || 'An error occurred', { duration: 5000 });
  }, []);

  // Use network as key to force re-mount when network changes
  // This triggers wallet reconnection with the new network
  return (
    <ConnectionProvider endpoint={endpoint} key={`connection-${selectedNetwork}`}>
      <SolanaWalletProvider
        wallets={wallets}
        autoConnect
        onError={onError}
        key={`wallet-${selectedNetwork}`}
      >
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
