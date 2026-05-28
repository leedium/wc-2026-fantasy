/**
 * Fetch JSON from an internal API route, surfacing the route's `error` field
 * (set by our handlers via `safeMessage`) as the thrown Error message so
 * React Query / callers get a useful message instead of a generic one.
 */
export async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error((await res.json())?.error ?? res.statusText);
  return res.json();
}
