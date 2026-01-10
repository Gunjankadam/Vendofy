// API configuration utility
// Get API base URL from environment variable or use default
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Helper function to build full API endpoint URL
export const getApiUrl = (endpoint: string): string => {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
  return `${baseUrl}/${cleanEndpoint}`;
};

