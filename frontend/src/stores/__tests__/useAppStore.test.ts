import { act, renderHook } from '@testing-library/react';
import {
  useAppStore,
  useIsLoading,
  useActiveModal,
  useIsMobileMenuOpen,
  useIsWalletConnected,
  useWalletAddress,
  useSelectedNetwork,
  useTheme,
  useHasSeenOnboarding,
} from '../useAppStore';

// Reset store before each test
beforeEach(() => {
  // Clear persisted state
  localStorage.clear();
  // Reset store to initial state
  useAppStore.setState({
    isLoading: false,
    activeModal: null,
    isMobileMenuOpen: false,
    isConnected: false,
    walletAddress: null,
    selectedNetwork: 'devnet',
    theme: 'system',
    hasSeenOnboarding: false,
  });
});

describe('useAppStore', () => {
  describe('initial state', () => {
    it('should have correct initial UI state', () => {
      const state = useAppStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.activeModal).toBeNull();
      expect(state.isMobileMenuOpen).toBe(false);
    });

    it('should have correct initial wallet state', () => {
      const state = useAppStore.getState();
      expect(state.isConnected).toBe(false);
      expect(state.walletAddress).toBeNull();
    });

    it('should have correct initial network state', () => {
      const state = useAppStore.getState();
      expect(state.selectedNetwork).toBe('devnet');
    });

    it('should have correct initial preferences state', () => {
      const state = useAppStore.getState();
      expect(state.theme).toBe('system');
      expect(state.hasSeenOnboarding).toBe(false);
    });
  });

  describe('UI actions', () => {
    it('should set loading state', () => {
      const { setLoading } = useAppStore.getState();

      act(() => {
        setLoading(true);
      });

      expect(useAppStore.getState().isLoading).toBe(true);

      act(() => {
        setLoading(false);
      });

      expect(useAppStore.getState().isLoading).toBe(false);
    });

    it('should open and close modals', () => {
      const { openModal, closeModal } = useAppStore.getState();

      act(() => {
        openModal('wallet');
      });

      expect(useAppStore.getState().activeModal).toBe('wallet');

      act(() => {
        openModal('prediction');
      });

      expect(useAppStore.getState().activeModal).toBe('prediction');

      act(() => {
        closeModal();
      });

      expect(useAppStore.getState().activeModal).toBeNull();
    });

    it('should toggle mobile menu', () => {
      const { toggleMobileMenu } = useAppStore.getState();

      expect(useAppStore.getState().isMobileMenuOpen).toBe(false);

      act(() => {
        toggleMobileMenu();
      });

      expect(useAppStore.getState().isMobileMenuOpen).toBe(true);

      act(() => {
        toggleMobileMenu();
      });

      expect(useAppStore.getState().isMobileMenuOpen).toBe(false);
    });

    it('should close mobile menu', () => {
      const { toggleMobileMenu, closeMobileMenu } = useAppStore.getState();

      act(() => {
        toggleMobileMenu(); // Open it first
      });

      expect(useAppStore.getState().isMobileMenuOpen).toBe(true);

      act(() => {
        closeMobileMenu();
      });

      expect(useAppStore.getState().isMobileMenuOpen).toBe(false);
    });

    it('should reset UI state', () => {
      const { setLoading, openModal, toggleMobileMenu, resetUIState } =
        useAppStore.getState();

      act(() => {
        setLoading(true);
        openModal('wallet');
        toggleMobileMenu();
      });

      expect(useAppStore.getState().isLoading).toBe(true);
      expect(useAppStore.getState().activeModal).toBe('wallet');
      expect(useAppStore.getState().isMobileMenuOpen).toBe(true);

      act(() => {
        resetUIState();
      });

      expect(useAppStore.getState().isLoading).toBe(false);
      expect(useAppStore.getState().activeModal).toBeNull();
      expect(useAppStore.getState().isMobileMenuOpen).toBe(false);
    });
  });

  describe('wallet actions', () => {
    it('should set wallet connected with address', () => {
      const { setWalletConnected } = useAppStore.getState();
      const testAddress = 'TestWa11etPubkey111111111111111111111111111';

      act(() => {
        setWalletConnected(true, testAddress);
      });

      expect(useAppStore.getState().isConnected).toBe(true);
      expect(useAppStore.getState().walletAddress).toBe(testAddress);
    });

    it('should clear wallet address when disconnected', () => {
      const { setWalletConnected } = useAppStore.getState();
      const testAddress = 'TestWa11etPubkey111111111111111111111111111';

      // Connect first
      act(() => {
        setWalletConnected(true, testAddress);
      });

      // Then disconnect
      act(() => {
        setWalletConnected(false);
      });

      expect(useAppStore.getState().isConnected).toBe(false);
      expect(useAppStore.getState().walletAddress).toBeNull();
    });

    it('should handle connection without address', () => {
      const { setWalletConnected } = useAppStore.getState();

      act(() => {
        setWalletConnected(true);
      });

      expect(useAppStore.getState().isConnected).toBe(true);
      expect(useAppStore.getState().walletAddress).toBeNull();
    });
  });

  describe('network actions', () => {
    it('should set selected network', () => {
      const { setSelectedNetwork } = useAppStore.getState();

      act(() => {
        setSelectedNetwork('mainnet-beta');
      });

      expect(useAppStore.getState().selectedNetwork).toBe('mainnet-beta');

      act(() => {
        setSelectedNetwork('devnet');
      });

      expect(useAppStore.getState().selectedNetwork).toBe('devnet');
    });
  });

  describe('preferences actions', () => {
    it('should set theme', () => {
      const { setTheme } = useAppStore.getState();

      act(() => {
        setTheme('dark');
      });

      expect(useAppStore.getState().theme).toBe('dark');

      act(() => {
        setTheme('light');
      });

      expect(useAppStore.getState().theme).toBe('light');

      act(() => {
        setTheme('system');
      });

      expect(useAppStore.getState().theme).toBe('system');
    });

    it('should set has seen onboarding', () => {
      const { setHasSeenOnboarding } = useAppStore.getState();

      act(() => {
        setHasSeenOnboarding(true);
      });

      expect(useAppStore.getState().hasSeenOnboarding).toBe(true);

      act(() => {
        setHasSeenOnboarding(false);
      });

      expect(useAppStore.getState().hasSeenOnboarding).toBe(false);
    });
  });
});

describe('selector hooks', () => {
  it('useIsLoading should return loading state', () => {
    const { result } = renderHook(() => useIsLoading());
    expect(result.current).toBe(false);

    act(() => {
      useAppStore.getState().setLoading(true);
    });

    expect(result.current).toBe(true);
  });

  it('useActiveModal should return active modal', () => {
    const { result } = renderHook(() => useActiveModal());
    expect(result.current).toBeNull();

    act(() => {
      useAppStore.getState().openModal('wallet');
    });

    expect(result.current).toBe('wallet');
  });

  it('useIsMobileMenuOpen should return mobile menu state', () => {
    const { result } = renderHook(() => useIsMobileMenuOpen());
    expect(result.current).toBe(false);

    act(() => {
      useAppStore.getState().toggleMobileMenu();
    });

    expect(result.current).toBe(true);
  });

  it('useIsWalletConnected should return connection state', () => {
    const { result } = renderHook(() => useIsWalletConnected());
    expect(result.current).toBe(false);

    act(() => {
      useAppStore.getState().setWalletConnected(true, 'test-address');
    });

    expect(result.current).toBe(true);
  });

  it('useWalletAddress should return wallet address', () => {
    const { result } = renderHook(() => useWalletAddress());
    expect(result.current).toBeNull();

    const testAddress = 'TestWa11etPubkey111111111111111111111111111';
    act(() => {
      useAppStore.getState().setWalletConnected(true, testAddress);
    });

    expect(result.current).toBe(testAddress);
  });

  it('useSelectedNetwork should return selected network', () => {
    const { result } = renderHook(() => useSelectedNetwork());
    expect(result.current).toBe('devnet');

    act(() => {
      useAppStore.getState().setSelectedNetwork('mainnet-beta');
    });

    expect(result.current).toBe('mainnet-beta');
  });

  it('useTheme should return theme', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current).toBe('system');

    act(() => {
      useAppStore.getState().setTheme('dark');
    });

    expect(result.current).toBe('dark');
  });

  it('useHasSeenOnboarding should return onboarding state', () => {
    const { result } = renderHook(() => useHasSeenOnboarding());
    expect(result.current).toBe(false);

    act(() => {
      useAppStore.getState().setHasSeenOnboarding(true);
    });

    expect(result.current).toBe(true);
  });
});
