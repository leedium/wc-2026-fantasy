'use client';

import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  CoinbaseWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import { useMemo, type ReactNode } from 'react';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

interface WalletProviderProps {
  children: ReactNode;
}

/**
 * Get the wallet adapter network from environment variable
 * Defaults to devnet if not configured
 */
function getNetwork(): WalletAdapterNetwork {
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK;
  if (network === 'mainnet-beta') {
    return WalletAdapterNetwork.Mainnet;
  }
  return WalletAdapterNetwork.Devnet;
}

/**
 * Get the RPC endpoint from environment variable or use default cluster URL
 */
function getEndpoint(network: WalletAdapterNetwork): string {
  const customRpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (customRpcUrl) {
    return customRpcUrl;
  }
  return clusterApiUrl(network);
}

export function WalletProvider({ children }: WalletProviderProps) {
  const network = useMemo(() => getNetwork(), []);
  const endpoint = useMemo(() => getEndpoint(network), [network]);

  // Configure wallet adapters
  // Note: Backpack and other wallets that implement Wallet Standard
  // are auto-detected and don't need explicit adapters
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network }),
      new CoinbaseWalletAdapter(),
    ],
    [network]
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
