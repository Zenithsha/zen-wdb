import axios, { AxiosInstance } from 'axios';
import qs from 'qs';
import { getToken } from './auth';

/**
 * Build a Strapi v5 compatible query string.
 * Handles populate, filters, sort, pagination correctly (array/object syntax).
 * Example: strapiQuery({ populate: ['role', 'profilePicture'] })
 *   → "populate[0]=role&populate[1]=profilePicture"
 */
export function strapiQuery(params: Record<string, unknown>): string {
  return qs.stringify(params, { encodeValuesOnly: true });
}

const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337';

// Main API instance (prefixed with /api)
export const api: AxiosInstance = axios.create({
  baseURL: `${STRAPI_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const reqUrl: string = error.config?.url || '';
      const path = window.location.pathname;
      // Don't clobber user flow for:
      //  - the bootstrap /auth/me call (AuthContext handles unauth itself)
      //  - admin routes (admin has its own login screen inside /admin layout)
      //  - the login page itself (avoid redirect loops on bad-credentials 401)
      const isMeCheck = reqUrl.includes('/auth/me') || reqUrl.includes('/users/me');
      const isAdminArea = path.startsWith('/admin');
      const isLoginPage = path.startsWith('/login');
      if (!isMeCheck && !isAdminArea && !isLoginPage) {
        localStorage.removeItem('jwt');
        document.cookie = 'jwt=; Max-Age=0; path=/';
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Upload instance (no Content-Type override — browser sets multipart boundary)
export const uploadApi: AxiosInstance = axios.create({
  baseURL: STRAPI_URL,
});

uploadApi.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function getStrapiMediaUrl(url?: string): string {
  if (!url) return '/placeholder-cover.jpg';
  if (url.startsWith('http')) return url;
  return `${STRAPI_URL}${url}`;
}
