'use client';

import * as React from 'react';

export const DRAFT_VERSION = 1;
export const DRAFT_DEBOUNCE_MS = 300;
const KEY_PREFIX = 'wc2026:draft:';
export const NEW_PREDICTION_SENTINEL = 'new';

export interface DraftPayload<T> {
  v: number;
  savedAt: string;
  data: T;
}

function getKey(userId: string, tournamentId: string, predictionId: string) {
  return `${KEY_PREFIX}${userId}:${tournamentId}:${predictionId}`;
}

function legacyKey(userId: string, tournamentId: string) {
  return `${KEY_PREFIX}${userId}:${tournamentId}`;
}

interface UseDraftPersistenceOptions<T> {
  onExternalUpdate?: (payload: DraftPayload<T>) => void;
}

export function useDraftPersistence<T>(
  userId: string | null | undefined,
  tournamentId: string | null | undefined,
  predictionId: string | null | undefined,
  options: UseDraftPersistenceOptions<T> = {}
) {
  const key =
    userId && tournamentId && predictionId
      ? getKey(userId, tournamentId, predictionId)
      : null;
  const [lastSavedAt, setLastSavedAt] = React.useState<Date | null>(null);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const { onExternalUpdate } = options;

  // One-time legacy migration: if a 2-arg key (wc2026:draft:{u}:{t}) exists,
  // copy it under the {u}:{t}:new slot, then delete the legacy entry.
  React.useEffect(() => {
    if (
      !userId ||
      !tournamentId ||
      predictionId !== NEW_PREDICTION_SENTINEL ||
      typeof window === 'undefined'
    )
      return;
    const legacy = legacyKey(userId, tournamentId);
    const target = getKey(userId, tournamentId, NEW_PREDICTION_SENTINEL);
    try {
      const raw = window.localStorage.getItem(legacy);
      if (raw && !window.localStorage.getItem(target)) {
        window.localStorage.setItem(target, raw);
      }
      if (raw) window.localStorage.removeItem(legacy);
    } catch {
      // best-effort
    }
  }, [userId, tournamentId, predictionId]);

  const loadDraft = React.useCallback((): DraftPayload<T> | null => {
    if (!key || typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as DraftPayload<T>;
      if (!parsed || parsed.v !== DRAFT_VERSION) {
        window.localStorage.removeItem(key);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }, [key]);

  const writeDraft = React.useCallback(
    (data: T) => {
      if (!key || typeof window === 'undefined') return;
      const savedAt = new Date();
      const payload: DraftPayload<T> = {
        v: DRAFT_VERSION,
        savedAt: savedAt.toISOString(),
        data,
      };
      try {
        window.localStorage.setItem(key, JSON.stringify(payload));
        setLastSavedAt(savedAt);
      } catch {
        // quota exceeded or storage disabled — drafts are best-effort.
      }
    },
    [key]
  );

  const saveDraft = React.useCallback(
    (data: T) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        writeDraft(data);
        timeoutRef.current = null;
      }, DRAFT_DEBOUNCE_MS);
    },
    [writeDraft]
  );

  const clearDraft = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (!key || typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
    setLastSavedAt(null);
  }, [key]);

  React.useEffect(() => {
    if (!key || typeof window === 'undefined' || !onExternalUpdate) return;
    const handler = (event: StorageEvent) => {
      if (event.key !== key || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as DraftPayload<T>;
        if (parsed?.v === DRAFT_VERSION) onExternalUpdate(parsed);
      } catch {
        // ignore malformed cross-tab payloads
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [key, onExternalUpdate]);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { loadDraft, saveDraft, clearDraft, lastSavedAt };
}

export function clearAllDrafts(userId?: string | null) {
  if (typeof window === 'undefined') return;
  const prefix = userId ? `${KEY_PREFIX}${userId}:` : KEY_PREFIX;
  for (let i = window.localStorage.length - 1; i >= 0; i--) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith(prefix)) window.localStorage.removeItem(k);
  }
}

export function clearDraftForPrediction(
  userId: string,
  tournamentId: string,
  predictionId: string
) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getKey(userId, tournamentId, predictionId));
  } catch {
    // best-effort
  }
}
