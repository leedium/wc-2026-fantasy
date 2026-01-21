import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { SolanaNetwork } from '@/config/env';

/**
 * Modal types that can be opened in the app
 */
export type ModalType = 'wallet' | 'prediction' | 'confirmation' | null;

/**
 * UI state slice
 */
interface UIState {
  isLoading: boolean;
  activeModal: ModalType;
  isMobileMenuOpen: boolean;
}

/**
 * Wallet state slice (client-side tracking, actual wallet state from adapter)
 */
interface WalletState {
  isConnected: boolean;
  walletAddress: string | null;
}

/**
 * Network state slice
 */
interface NetworkState {
  selectedNetwork: SolanaNetwork;
}

/**
 * Persisted user preferences
 */
interface PreferencesState {
  theme: 'light' | 'dark' | 'system';
  hasSeenOnboarding: boolean;
}

/**
 * Actions for modifying state
 */
interface AppActions {
  // UI actions
  setLoading: (isLoading: boolean) => void;
  openModal: (modal: ModalType) => void;
  closeModal: () => void;
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;

  // Wallet actions (synced from wallet adapter)
  setWalletConnected: (isConnected: boolean, address?: string | null) => void;

  // Network actions
  setSelectedNetwork: (network: SolanaNetwork) => void;

  // Preferences actions
  setTheme: (theme: PreferencesState['theme']) => void;
  setHasSeenOnboarding: (hasSeen: boolean) => void;

  // Reset actions
  resetUIState: () => void;
}

/**
 * Complete app store state
 */
export interface AppState
  extends UIState, WalletState, NetworkState, PreferencesState, AppActions {}

/**
 * Initial UI state
 */
const initialUIState: UIState = {
  isLoading: false,
  activeModal: null,
  isMobileMenuOpen: false,
};

/**
 * Initial wallet state
 */
const initialWalletState: WalletState = {
  isConnected: false,
  walletAddress: null,
};

/**
 * Initial network state
 */
const initialNetworkState: NetworkState = {
  selectedNetwork: 'devnet',
};

/**
 * Initial preferences state
 */
const initialPreferencesState: PreferencesState = {
  theme: 'system',
  hasSeenOnboarding: false,
};

/**
 * Main application store using Zustand
 *
 * Features:
 * - Devtools middleware for Redux DevTools integration (dev only)
 * - Persist middleware for localStorage persistence (preferences only)
 * - Typed state and actions
 */
export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        ...initialUIState,
        ...initialWalletState,
        ...initialNetworkState,
        ...initialPreferencesState,

        // UI actions
        setLoading: (isLoading) => set({ isLoading }, false, 'setLoading'),

        openModal: (modal) => set({ activeModal: modal }, false, 'openModal'),

        closeModal: () => set({ activeModal: null }, false, 'closeModal'),

        toggleMobileMenu: () =>
          set(
            (state) => ({ isMobileMenuOpen: !state.isMobileMenuOpen }),
            false,
            'toggleMobileMenu'
          ),

        closeMobileMenu: () => set({ isMobileMenuOpen: false }, false, 'closeMobileMenu'),

        // Wallet actions
        setWalletConnected: (isConnected, address = null) =>
          set(
            { isConnected, walletAddress: isConnected ? address : null },
            false,
            'setWalletConnected'
          ),

        // Network actions
        setSelectedNetwork: (network) =>
          set({ selectedNetwork: network }, false, 'setSelectedNetwork'),

        // Preferences actions
        setTheme: (theme) => set({ theme }, false, 'setTheme'),

        setHasSeenOnboarding: (hasSeen) =>
          set({ hasSeenOnboarding: hasSeen }, false, 'setHasSeenOnboarding'),

        // Reset actions
        resetUIState: () => set({ ...initialUIState }, false, 'resetUIState'),
      }),
      {
        name: 'wc2026-app-store',
        // Only persist user preferences, not transient UI state
        partialize: (state) => ({
          theme: state.theme,
          hasSeenOnboarding: state.hasSeenOnboarding,
          selectedNetwork: state.selectedNetwork,
        }),
      }
    ),
    {
      name: 'WC2026 App Store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

/**
 * Selector hooks for better performance (prevents unnecessary re-renders)
 */
export const useIsLoading = () => useAppStore((state) => state.isLoading);
export const useActiveModal = () => useAppStore((state) => state.activeModal);
export const useIsMobileMenuOpen = () => useAppStore((state) => state.isMobileMenuOpen);
export const useIsWalletConnected = () => useAppStore((state) => state.isConnected);
export const useWalletAddress = () => useAppStore((state) => state.walletAddress);
export const useSelectedNetwork = () => useAppStore((state) => state.selectedNetwork);
export const useTheme = () => useAppStore((state) => state.theme);
export const useHasSeenOnboarding = () => useAppStore((state) => state.hasSeenOnboarding);
