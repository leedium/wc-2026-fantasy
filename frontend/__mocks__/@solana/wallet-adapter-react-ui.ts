import React from 'react';

// Mock WalletMultiButton component
export const WalletMultiButton = ({
  children,
  ...props
}: {
  children?: React.ReactNode;
  [key: string]: unknown;
}) => {
  return React.createElement(
    'button',
    { 'data-testid': 'wallet-multi-button', ...props },
    children || 'Select Wallet'
  );
};

// Mock WalletConnectButton component
export const WalletConnectButton = ({
  children,
  ...props
}: {
  children?: React.ReactNode;
  [key: string]: unknown;
}) => {
  return React.createElement(
    'button',
    { 'data-testid': 'wallet-connect-button', ...props },
    children || 'Connect'
  );
};

// Mock WalletDisconnectButton component
export const WalletDisconnectButton = ({
  children,
  ...props
}: {
  children?: React.ReactNode;
  [key: string]: unknown;
}) => {
  return React.createElement(
    'button',
    { 'data-testid': 'wallet-disconnect-button', ...props },
    children || 'Disconnect'
  );
};

// Mock WalletModalProvider component
export const WalletModalProvider = ({ children }: { children: React.ReactNode }) => {
  return React.createElement(React.Fragment, null, children);
};

// Mock WalletModal component
export const WalletModal = () => {
  return React.createElement('div', { 'data-testid': 'wallet-modal' });
};

// Mock useWalletModal hook
export const useWalletModal = jest.fn(() => ({
  visible: false,
  setVisible: jest.fn(),
}));
