/**
 * Browser calls go through `/api/proxy/*` (server injects private APP_API_KEY).
 * Server components/actions call the FastAPI backend directly with APP_API_KEY.
 */

const BROWSER_API_PREFIX = '/api/proxy';

export function getApiBaseUrl(): string {
  return (
    process.env.API_BASE ||
    process.env.BACKEND_API_URL ||
    'http://localhost:5000'
  ).replace(/\/$/, '');
}

function resolveRequestUrl(path: string): string {
  if (path.startsWith('http')) return path;
  const p = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined') {
    return `${BROWSER_API_PREFIX}${p}`;
  }
  return `${getApiBaseUrl()}${p}`;
}

export async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const url = resolveRequestUrl(path);
  const headers = new Headers(opts.headers ?? {});
  let refreshIdToken: (() => Promise<string | null>) | null = null;
  const isForm = typeof FormData !== 'undefined' && opts.body instanceof FormData;
  if (!headers.has('Content-Type') && !isForm) {
    headers.set('Content-Type', 'application/json');
  }

  if (typeof window !== 'undefined') {
    try {
      const { getFirebaseAuth } = await import('@/lib/auth/SimpleAuthProvider');
      const auth = await getFirebaseAuth();
      refreshIdToken = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) return null;
        return currentUser.getIdToken(true);
      };
      const token = await auth.currentUser?.getIdToken();
      if (token) headers.set('Authorization', `Bearer ${token}`);
    } catch {
      // Firebase may be unconfigured during first paint.
    }
  } else {
    const appKey = process.env.APP_API_KEY?.trim();
    if (appKey) headers.set('X-API-Key', appKey);
  }

  let res = await fetch(url, { ...opts, headers, cache: 'no-store' });
  if (res.status === 401 && refreshIdToken) {
    try {
      const refreshedToken = await refreshIdToken();
      if (refreshedToken) {
        headers.set('Authorization', `Bearer ${refreshedToken}`);
        res = await fetch(url, { ...opts, headers, cache: 'no-store' });
      }
    } catch {
      // Preserve the original 401 response when Firebase cannot refresh the session.
    }
  }
  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      json = null;
    }
  }

  if (!res.ok) {
    const msg =
      json &&
      typeof json === 'object' &&
      'error' in json &&
      typeof (json as { error: unknown }).error === 'string'
        ? (json as { error: string }).error
        : `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return json as T;
}

export async function apiDownload(path: string, filename: string): Promise<void> {
  const headers = new Headers();
  if (typeof window !== 'undefined') {
    try {
      const { getFirebaseAuth } = await import('@/lib/auth/SimpleAuthProvider');
      const auth = await getFirebaseAuth();
      const token = await auth.currentUser?.getIdToken();
      if (token) headers.set('Authorization', `Bearer ${token}`);
    } catch {
      throw new Error('Authentication is unavailable');
    }
  }
  const res = await fetch(resolveRequestUrl(path), { headers, cache: 'no-store' });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}
