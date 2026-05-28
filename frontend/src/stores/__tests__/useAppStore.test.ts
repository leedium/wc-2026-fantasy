import { act } from '@testing-library/react';
import { useAppStore } from '../useAppStore';

describe('useAppStore', () => {
  beforeEach(() => {
    act(() => {
      useAppStore.setState({
        isLoading: false,
        activeModal: null,
        isMobileMenuOpen: false,
        hasSeenOnboarding: false,
      });
    });
  });

  it('toggles mobile menu', () => {
    act(() => useAppStore.getState().toggleMobileMenu());
    expect(useAppStore.getState().isMobileMenuOpen).toBe(true);
    act(() => useAppStore.getState().closeMobileMenu());
    expect(useAppStore.getState().isMobileMenuOpen).toBe(false);
  });

  it('opens and closes modals', () => {
    act(() => useAppStore.getState().openModal('prediction'));
    expect(useAppStore.getState().activeModal).toBe('prediction');
    act(() => useAppStore.getState().closeModal());
    expect(useAppStore.getState().activeModal).toBeNull();
  });

  it('marks onboarding as seen', () => {
    act(() => useAppStore.getState().setHasSeenOnboarding(true));
    expect(useAppStore.getState().hasSeenOnboarding).toBe(true);
  });
});
