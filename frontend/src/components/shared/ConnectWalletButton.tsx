'use client';

import { useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import type { WalletName } from '@solana/wallet-adapter-base';
import { WalletReadyState } from '@solana/wallet-adapter-base';
import { Wallet, ExternalLink } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface ConnectWalletButtonProps {
  className?: string;
}

/**
 * Truncates a wallet address to show first 4 and last 4 characters
 * e.g., "7xKpR9...3nFq"
 */
function truncateAddress(address: string): string {
  if (address.length <= 8) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function ConnectWalletButton({ className }: ConnectWalletButtonProps) {
  const { wallets, select, connecting, connected, publicKey } = useWallet();
  const [isOpen, setIsOpen] = useState(false);

  const handleSelectWallet = useCallback(
    async (walletName: WalletName) => {
      select(walletName);
      setIsOpen(false);
    },
    [select]
  );

  // Separate wallets into installed and not installed
  const installedWallets = wallets.filter(
    (wallet) =>
      wallet.readyState === WalletReadyState.Installed ||
      wallet.readyState === WalletReadyState.Loadable
  );

  const notInstalledWallets = wallets.filter(
    (wallet) => wallet.readyState === WalletReadyState.NotDetected
  );

  // Render connected state button with truncated address
  if (connected && publicKey) {
    const truncatedAddress = truncateAddress(publicKey.toBase58());

    return (
      <Button
        variant="outline"
        className={cn('gap-2 border-green-500/50 bg-green-500/10 hover:bg-green-500/20', className)}
      >
        <div className="h-2 w-2 rounded-full bg-green-500" />
        {truncatedAddress}
      </Button>
    );
  }

  // Render disconnected state button
  return (
    <>
      <Button
        variant="default"
        className={cn('gap-2', className)}
        onClick={() => setIsOpen(true)}
        disabled={connecting}
      >
        <Wallet className="h-4 w-4" />
        {connecting ? 'Connecting...' : 'Connect Wallet'}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect a Wallet</DialogTitle>
            <DialogDescription>Select a wallet to connect to WC2026.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 py-4">
            {installedWallets.length > 0 && (
              <>
                <p className="text-muted-foreground mb-2 text-sm font-medium">Detected Wallets</p>
                {installedWallets.map((wallet) => (
                  <button
                    key={wallet.adapter.name}
                    onClick={() => handleSelectWallet(wallet.adapter.name)}
                    className="hover:bg-accent flex w-full items-center gap-3 rounded-lg border p-3 transition-colors"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={wallet.adapter.icon}
                      alt={`${wallet.adapter.name} icon`}
                      className="h-8 w-8"
                    />
                    <span className="font-medium">{wallet.adapter.name}</span>
                  </button>
                ))}
              </>
            )}

            {notInstalledWallets.length > 0 && (
              <>
                <p className="text-muted-foreground mt-4 mb-2 text-sm font-medium">More Wallets</p>
                {notInstalledWallets.map((wallet) => (
                  <a
                    key={wallet.adapter.name}
                    href={wallet.adapter.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:bg-accent flex w-full items-center gap-3 rounded-lg border p-3 transition-colors"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={wallet.adapter.icon}
                      alt={`${wallet.adapter.name} icon`}
                      className="h-8 w-8"
                    />
                    <span className="flex-1 font-medium">{wallet.adapter.name}</span>
                    <span className="text-muted-foreground flex items-center gap-1 text-sm">
                      Install
                      <ExternalLink className="h-3 w-3" />
                    </span>
                  </a>
                ))}
              </>
            )}

            {wallets.length === 0 && (
              <p className="text-muted-foreground py-4 text-center text-sm">
                No wallets found. Please install a Solana wallet extension.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
