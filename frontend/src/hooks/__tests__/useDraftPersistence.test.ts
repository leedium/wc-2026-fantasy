import { act, renderHook } from '@testing-library/react';

import {
  clearAllDrafts,
  clearDraftForPrediction,
  DRAFT_DEBOUNCE_MS,
  DRAFT_VERSION,
  NEW_PREDICTION_SENTINEL,
  useDraftPersistence,
} from '../useDraftPersistence';

interface SamplePayload {
  picks: number[];
}

const KEY = `wc2026:draft:user-1:tournament-1:p-1`;

beforeEach(() => {
  window.localStorage.clear();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useDraftPersistence', () => {
  it('writes a versioned, debounced payload to localStorage', () => {
    const { result } = renderHook(() =>
      useDraftPersistence<SamplePayload>('user-1', 'tournament-1', 'p-1')
    );

    act(() => {
      result.current.saveDraft({ picks: [1, 2, 3] });
    });

    expect(window.localStorage.getItem(KEY)).toBeNull();

    act(() => {
      jest.advanceTimersByTime(DRAFT_DEBOUNCE_MS);
    });

    const raw = window.localStorage.getItem(KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.v).toBe(DRAFT_VERSION);
    expect(parsed.data).toEqual({ picks: [1, 2, 3] });
    expect(typeof parsed.savedAt).toBe('string');
    expect(result.current.lastSavedAt).toBeInstanceOf(Date);
  });

  it('coalesces multiple rapid saves into a single write', () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() =>
      useDraftPersistence<SamplePayload>('user-1', 'tournament-1', 'p-1')
    );

    act(() => {
      result.current.saveDraft({ picks: [1] });
      result.current.saveDraft({ picks: [1, 2] });
      result.current.saveDraft({ picks: [1, 2, 3] });
    });
    act(() => {
      jest.advanceTimersByTime(DRAFT_DEBOUNCE_MS);
    });

    const writes = setItemSpy.mock.calls.filter(([k]) => k === KEY);
    expect(writes).toHaveLength(1);
    const finalPayload = JSON.parse(writes[0][1] as string);
    expect(finalPayload.data).toEqual({ picks: [1, 2, 3] });
  });

  it('returns null and clears storage when the version does not match', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ v: 999, savedAt: new Date().toISOString(), data: { picks: [9] } })
    );
    const { result } = renderHook(() =>
      useDraftPersistence<SamplePayload>('user-1', 'tournament-1', 'p-1')
    );

    expect(result.current.loadDraft()).toBeNull();
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('returns null when stored payload is malformed', () => {
    window.localStorage.setItem(KEY, '{not json');
    const { result } = renderHook(() =>
      useDraftPersistence<SamplePayload>('user-1', 'tournament-1', 'p-1')
    );
    expect(result.current.loadDraft()).toBeNull();
  });

  it('clearDraft removes the entry and cancels pending writes', () => {
    const { result } = renderHook(() =>
      useDraftPersistence<SamplePayload>('user-1', 'tournament-1', 'p-1')
    );

    act(() => {
      result.current.saveDraft({ picks: [1] });
      result.current.clearDraft();
      jest.advanceTimersByTime(DRAFT_DEBOUNCE_MS);
    });

    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(result.current.lastSavedAt).toBeNull();
  });

  it('invokes onExternalUpdate when another tab writes a valid payload', () => {
    const onExternalUpdate = jest.fn();
    renderHook(() =>
      useDraftPersistence<SamplePayload>('user-1', 'tournament-1', 'p-1', { onExternalUpdate })
    );

    const newValue = JSON.stringify({
      v: DRAFT_VERSION,
      savedAt: new Date().toISOString(),
      data: { picks: [42] },
    });

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue }));
    });

    expect(onExternalUpdate).toHaveBeenCalledTimes(1);
    expect(onExternalUpdate.mock.calls[0][0].data).toEqual({ picks: [42] });
  });

  it('ignores cross-tab updates with mismatched versions', () => {
    const onExternalUpdate = jest.fn();
    renderHook(() =>
      useDraftPersistence<SamplePayload>('user-1', 'tournament-1', 'p-1', { onExternalUpdate })
    );

    const newValue = JSON.stringify({
      v: 999,
      savedAt: new Date().toISOString(),
      data: { picks: [42] },
    });

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue }));
    });

    expect(onExternalUpdate).not.toHaveBeenCalled();
  });

  it('does not write when userId or tournamentId is missing', () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() =>
      useDraftPersistence<SamplePayload>(null, 'tournament-1', 'p-1')
    );

    act(() => {
      result.current.saveDraft({ picks: [1] });
      jest.advanceTimersByTime(DRAFT_DEBOUNCE_MS);
    });

    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it('migrates a legacy 2-arg key into the new sentinel slot on mount', () => {
    const legacy = `wc2026:draft:user-1:tournament-1`;
    const target = `wc2026:draft:user-1:tournament-1:${NEW_PREDICTION_SENTINEL}`;
    window.localStorage.setItem(
      legacy,
      JSON.stringify({ v: DRAFT_VERSION, savedAt: '2026-01-01T00:00:00Z', data: { picks: [7] } })
    );

    renderHook(() =>
      useDraftPersistence<SamplePayload>('user-1', 'tournament-1', NEW_PREDICTION_SENTINEL)
    );

    expect(window.localStorage.getItem(legacy)).toBeNull();
    const moved = window.localStorage.getItem(target);
    expect(moved).not.toBeNull();
    expect(JSON.parse(moved!).data).toEqual({ picks: [7] });
  });
});

describe('clearAllDrafts', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('wc2026:draft:user-1:t-1:p-1', '{}');
    window.localStorage.setItem('wc2026:draft:user-1:t-2:p-1', '{}');
    window.localStorage.setItem('wc2026:draft:user-2:t-1:p-1', '{}');
    window.localStorage.setItem('unrelated:key', '{}');
  });

  it('removes only drafts for the given user', () => {
    clearAllDrafts('user-1');
    expect(window.localStorage.getItem('wc2026:draft:user-1:t-1:p-1')).toBeNull();
    expect(window.localStorage.getItem('wc2026:draft:user-1:t-2:p-1')).toBeNull();
    expect(window.localStorage.getItem('wc2026:draft:user-2:t-1:p-1')).not.toBeNull();
    expect(window.localStorage.getItem('unrelated:key')).not.toBeNull();
  });

  it('removes every draft when no user is provided', () => {
    clearAllDrafts();
    expect(window.localStorage.getItem('wc2026:draft:user-1:t-1:p-1')).toBeNull();
    expect(window.localStorage.getItem('wc2026:draft:user-2:t-1:p-1')).toBeNull();
    expect(window.localStorage.getItem('unrelated:key')).not.toBeNull();
  });
});

describe('clearDraftForPrediction', () => {
  it('removes only the matching prediction key', () => {
    const a = 'wc2026:draft:user-1:t-1:p-1';
    const b = 'wc2026:draft:user-1:t-1:p-2';
    window.localStorage.setItem(a, '{}');
    window.localStorage.setItem(b, '{}');

    clearDraftForPrediction('user-1', 't-1', 'p-1');

    expect(window.localStorage.getItem(a)).toBeNull();
    expect(window.localStorage.getItem(b)).not.toBeNull();
  });
});
