/**
 * Simple in-memory data cache for tab screens.
 * Data is cached by key and returned immediately on subsequent visits,
 * while fresh data is fetched in the background.
 */

const _cache: Map<string, { data: any; ts: number }> = new Map();
const MAX_AGE = 5 * 60 * 1000; // 5 minutes

export function getCached(key: string): any | null {
  const entry = _cache.get(key);
  if (!entry) return null;
  // Return cached data even if stale (we'll refresh in background)
  return entry.data;
}

export function setCache(key: string, data: any): void {
  _cache.set(key, { data, ts: Date.now() });
}

export function isCacheStale(key: string): boolean {
  const entry = _cache.get(key);
  if (!entry) return true;
  return Date.now() - entry.ts > MAX_AGE;
}

export function clearCache(key?: string): void {
  if (key) {
    _cache.delete(key);
  } else {
    _cache.clear();
  }
}
