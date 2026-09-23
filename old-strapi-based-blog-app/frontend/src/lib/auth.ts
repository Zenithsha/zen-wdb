import { jwtDecode } from 'jwt-decode';

interface JWTPayload {
  id: number;
  iat: number;
  exp: number;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('jwt');
}

// 30 days — long enough that a daily user effectively never gets logged out.
// (Strapi JWT itself is configured to match — see config/plugins.js.)
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export function setToken(token: string): void {
  localStorage.setItem('jwt', token);
  // Persistent cookie — survives browser restarts so the user isn't asked to log in again.
  // SameSite=Lax keeps it safe from CSRF on top-level GETs while still being sent on
  // same-origin navigations. Add Secure when served over HTTPS.
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const secure = isHttps ? '; Secure' : '';
  document.cookie = `jwt=${token}; path=/; max-age=${SESSION_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

/**
 * Re-write the JWT cookie with a fresh max-age but leave localStorage untouched.
 * Used to extend the cookie's lifetime on each app boot so an active user
 * effectively has a sliding session.
 */
export function refreshCookie(token: string): void {
  if (typeof document === 'undefined') return;
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const secure = isHttps ? '; Secure' : '';
  document.cookie = `jwt=${token}; path=/; max-age=${SESSION_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

export function removeToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('jwt');
  document.cookie = 'jwt=; Max-Age=0; path=/';
}

export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwtDecode<JWTPayload>(token);
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const decoded = decodeToken(token);
  if (!decoded) return true;
  return decoded.exp * 1000 < Date.now();
}
