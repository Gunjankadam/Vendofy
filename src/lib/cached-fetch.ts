import { getApiUrl } from './api';
import { getCachedEtag, setCachedResponse, getCachedResponse } from './api-cache';

interface CachedFetchOptions extends RequestInit {
  skipCache?: boolean; // Option to skip cache for this request
}

/**
 * Cached fetch wrapper that automatically handles ETag caching
 * @param endpoint - API endpoint (e.g., '/api/admin/users')
 * @param token - Auth token
 * @param options - Fetch options
 * @returns Promise with response data
 */
export const cachedFetch = async <T = any>(
  endpoint: string,
  token: string,
  options: CachedFetchOptions = {}
): Promise<T> => {
  const { skipCache = false, ...fetchOptions } = options;
  const url = getApiUrl(endpoint);
  
  // Check cache first if not skipped
  if (!skipCache) {
    const cachedData = getCachedResponse(url);
    if (cachedData) {
      return cachedData as T;
    }
  }

  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`,
    ...(fetchOptions.headers as HeadersInit),
  };

  // Add If-None-Match header if we have a cached ETag
  if (!skipCache) {
    const cachedEtag = getCachedEtag(url);
    if (cachedEtag) {
      headers['If-None-Match'] = cachedEtag;
    }
  }

  const res = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  // Handle 304 Not Modified
  if (res.status === 304 && !skipCache) {
    const cached = getCachedResponse(url);
    if (cached) {
      return cached as T;
    }
    // If no cached data but got 304, return empty result
    return {} as T;
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(errorData.message || `Request failed with status ${res.status}`);
  }

  const data = await res.json();
  
  // Cache the response if ETag is present
  if (!skipCache) {
    const etag = res.headers.get('ETag');
    if (etag) {
      setCachedResponse(url, etag, data);
    }
  }

  return data as T;
};




