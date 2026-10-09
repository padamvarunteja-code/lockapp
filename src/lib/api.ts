// API client for OnlyUs Private Communication App

const TOKEN_KEY = 'onlyus_session_token';
const LEGACY_TOKEN_KEY = 'aegis_session_token';
const AUTH_EXPIRED_EVENT = 'onlyus:auth_expired';

export function getStoredToken(): string | null {
  const current = localStorage.getItem(TOKEN_KEY);
  if (current) return current;
  // One-time migration from the legacy key.
  const legacy = localStorage.getItem(LEGACY_TOKEN_KEY);
  if (legacy) {
    localStorage.setItem(TOKEN_KEY, legacy);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    return legacy;
  }
  return null;
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // If not on login or register, token might be invalid
    if (!endpoint.includes('/api/auth/login') && !endpoint.includes('/api/auth/register')) {
      clearStoredToken();
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
    }
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/octet-stream')) {
    // Return blob or raw response
    return response as any;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data;
}
