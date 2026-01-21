import React from 'react';

// Default mock wallet state
export const mockWalletState = {
  publicKey: null as { toBase58: () => string; toString: () => string } | null,
  connected: false,
  connecting: false,
  disconnecting: false,
  wallet: null,
  wallets: [],
  select: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  sendTransaction: jest.fn(),
  signTransaction: jest.fn(),
  signAllTransactions: jest.fn(),
  signMessage: jest.fn(),
};

// Factory to create a connected wallet state
export const createConnectedWallet = (publicKeyBase58: string = 'TestWa11etPubkey111111111111111111111111111') => ({
  ...mockWalletState,
  publicKey: {
    toBase58: () => publicKeyBase58,
    toString: () => publicKeyBase58,
  },
  connected: true,
  wallet: {
    adapter: {
      name: 'Mock Wallet',
      publicKey: {
        toBase58: () => publicKeyBase58,
        toString: () => publicKeyBase58,
      },
    },
  },
});

// Factory to create a disconnected wallet state
export const createDisconnectedWallet = () => ({
  ...mockWalletState,
  publicKey: null,
  connected: false,
});

// Mock useWallet hook
export const useWallet = jest.fn(() => mockWalletState);

// Mock useConnection hook
export const useConnection = jest.fn(() => ({
  connection: {
    getBalance: jest.fn().mockResolvedValue(1000000000), // 1 SOL in lamports
    getLatestBlockhash: jest.fn().mockResolvedValue({
      blockhash: 'mock-blockhash',
      lastValidBlockHeight: 1000,
    }),
    confirmTransaction: jest.fn().mockResolvedValue({ value: { err: null } }),
    sendRawTransaction: jest.fn().mockResolvedValue('mock-signature'),
  },
}));

// Mock useAnchorWallet hook
export const useAnchorWallet = jest.fn(() => null);

// Mock WalletProvider component
export const WalletProvider = ({ children }: { children: React.ReactNode }) => {
  return React.createElement(React.Fragment, null, children);
};

// Mock ConnectionProvider component
export const ConnectionProvider = ({ children }: { children: React.ReactNode }) => {
  return React.createElement(React.Fragment, null, children);
};

// Helper to reset all mocks
export const resetWalletMocks = () => {
  useWallet.mockReturnValue(mockWalletState);
  useConnection.mockReturnValue({
    connection: {
      getBalance: jest.fn().mockResolvedValue(1000000000),
      getLatestBlockhash: jest.fn().mockResolvedValue({
        blockhash: 'mock-blockhash',
        lastValidBlockHeight: 1000,
      }),
      confirmTransaction: jest.fn().mockResolvedValue({ value: { err: null } }),
      sendRawTransaction: jest.fn().mockResolvedValue('mock-signature'),
    },
  });
  useAnchorWallet.mockReturnValue(null);
};

// Helper to set wallet as connected
export const setWalletConnected = (publicKeyBase58?: string) => {
  useWallet.mockReturnValue(createConnectedWallet(publicKeyBase58));
};

// Helper to set wallet as disconnected
export const setWalletDisconnected = () => {
  useWallet.mockReturnValue(createDisconnectedWallet());
};
