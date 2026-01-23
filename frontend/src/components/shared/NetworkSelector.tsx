'use client';

import { useAppStore, useSelectedNetwork } from '@/stores/useAppStore';
import { useMounted } from '@/hooks/useMounted';
import type { SolanaNetwork } from '@/config/env';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const NETWORK_OPTIONS: { value: SolanaNetwork; label: string }[] = [
  { value: 'mainnet-beta', label: 'Mainnet' },
  { value: 'devnet', label: 'Devnet' },
  { value: 'testnet', label: 'Testnet' },
];

export interface NetworkSelectorProps {
  className?: string;
}

export function NetworkSelector({ className }: NetworkSelectorProps) {
  const mounted = useMounted();
  const selectedNetwork = useSelectedNetwork();
  const setSelectedNetwork = useAppStore((state) => state.setSelectedNetwork);

  const handleNetworkChange = (value: string) => {
    setSelectedNetwork(value as SolanaNetwork);
  };

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted) {
    return (
      <Select disabled>
        <SelectTrigger className={className}>
          <SelectValue placeholder="Network" />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={selectedNetwork} onValueChange={handleNetworkChange}>
      <SelectTrigger className={className} aria-label="Select Solana network">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {NETWORK_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
