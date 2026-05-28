import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export type ModalType = 'prediction' | 'confirmation' | null;

interface UIState {
  isLoading: boolean;
  activeModal: ModalType;
  isMobileMenuOpen: boolean;
}

interface PreferencesState {
  hasSeenOnboarding: boolean;
}

interface AppActions {
  setLoading: (isLoading: boolean) => void;
  openModal: (modal: ModalType) => void;
  closeModal: () => void;
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;
  setHasSeenOnboarding: (hasSeen: boolean) => void;
  resetUIState: () => void;
}

export interface AppState extends UIState, PreferencesState, AppActions {}

const initialUIState: UIState = {
  isLoading: false,
  activeModal: null,
  isMobileMenuOpen: false,
};

const initialPreferencesState: PreferencesState = {
  hasSeenOnboarding: false,
};

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        ...initialUIState,
        ...initialPreferencesState,

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
        setHasSeenOnboarding: (hasSeen) =>
          set({ hasSeenOnboarding: hasSeen }, false, 'setHasSeenOnboarding'),
        resetUIState: () => set({ ...initialUIState }, false, 'resetUIState'),
      }),
      {
        name: 'wc2026-app-store',
        partialize: (state) => ({
          hasSeenOnboarding: state.hasSeenOnboarding,
        }),
      }
    ),
    {
      name: 'WC2026 App Store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

export const useIsLoading = () => useAppStore((state) => state.isLoading);
export const useActiveModal = () => useAppStore((state) => state.activeModal);
export const useIsMobileMenuOpen = () => useAppStore((state) => state.isMobileMenuOpen);
export const useHasSeenOnboarding = () => useAppStore((state) => state.hasSeenOnboarding);
