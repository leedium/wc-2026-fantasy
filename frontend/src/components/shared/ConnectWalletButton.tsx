'use client';

import { useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import type { WalletName } from '@solana/wallet-adapter-base';
import { WalletReadyState } from '@solana/wallet-adapter-base';
import { Wallet, ExternalLink, Copy, Check, LogOut } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useSolBalance } from '@/hooks/useSolBalance';

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
  const { wallets, select, connecting, connected, publicKey, disconnect } = useWallet();
  const { balance, isLoading: isBalanceLoading, error: balanceError } = useSolBalance();
  const [isOpen, setIsOpen] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSelectWallet = useCallback(
    async (walletName: WalletName) => {
      select(walletName);
      setIsOpen(false);
    },
    [select]
  );

  const handleCopyAddress = useCallback(async () => {
    if (!publicKey) return;
    try {
      await navigator.clipboard.writeText(publicKey.toBase58());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  }, [publicKey]);

  const handleDisconnect = useCallback(async () => {
    await disconnect();
    setIsPopoverOpen(false);
  }, [disconnect]);

  /**
   * Format SOL balance to 4 decimal places
   */
  const formatBalance = (bal: number | null): string => {
    if (bal === null) return '—';
    return bal.toFixed(4);
  };

  // Separate wallets into installed and not installed
  const installedWallets = wallets.filter(
    (wallet) =>
      wallet.readyState === WalletReadyState.Installed ||
      wallet.readyState === WalletReadyState.Loadable
  );

  const notInstalledWallets = wallets.filter(
    (wallet) => wallet.readyState === WalletReadyState.NotDetected
  );

  // Render connected state button with truncated address and popover
  if (connected && publicKey) {
    const truncatedAddress = truncateAddress(publicKey.toBase58());
    const fullAddress = publicKey.toBase58();

    return (
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'gap-2 border-green-500/50 bg-green-500/10 hover:bg-green-500/20',
              className
            )}
          >
            <div className="h-2 w-2 rounded-full bg-green-500" />
            {truncatedAddress}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80">
          <div className="flex flex-col gap-4">
            {/* Wallet Address */}
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium">Wallet Address</p>
              <div className="flex items-center gap-2">
                <code className="bg-muted flex-1 truncate rounded px-2 py-1 text-sm">
                  {fullAddress}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={handleCopyAddress}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* SOL Balance */}
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium">Balance</p>
              <p className="text-lg font-semibold">
                {isBalanceLoading ? (
                  <span className="text-muted-foreground">Loading...</span>
                ) : balanceError ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  `${formatBalance(balance)} SOL`
                )}
              </p>
            </div>

            {/* Disconnect Button */}
            <Button variant="destructive" className="w-full gap-2" onClick={handleDisconnect}>
              <LogOut className="h-4 w-4" />
              Disconnect
            </Button>
          </div>
        </PopoverContent>
      </Popover>
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
