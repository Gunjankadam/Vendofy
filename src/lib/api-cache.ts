// Simple in-memory cache for API responses with ETag support
const responseCache = new Map<string, { etag: string; data: any; timestamp: number }>();
const CACHE_TTL = 60 * 1000; // 60 seconds

export const getCachedEtag = (url: string): string | null => {
  const cached = responseCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.etag;
  }
  return null;
};

export const setCachedResponse = (url: string, etag: string, data: any): void => {
  responseCache.set(url, { etag, data, timestamp: Date.now() });
};

export const getCachedResponse = (url: string): any | null => {
  const cached = responseCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
};

export const clearCache = (): void => {
  responseCache.clear();
};




