/**
 * auth.js
 * Client-side auth helpers: token storage, retrieval, refresh, sign-out.
 * All tokens are stored in localStorage keyed by a namespace.
 */

'use strict';

const KEY_ACCESS  = 'gcrc_access_token';
const KEY_REFRESH = 'gcrc_refresh_token';
const KEY_EXPIRY  = 'gcrc_token_expiry';
const KEY_USER    = 'gcrc_user';
const KEY_CACHE   = 'gcrc_courses_cache';

// Refresh 2 minutes before expiry
const BUFFER_MS = 2 * 60 * 1000;

export function saveTokens({ access_token, refresh_token, expires_in }) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY_ACCESS, access_token);
  localStorage.setItem(KEY_EXPIRY, String(Date.now() + expires_in * 1000));
  if (refresh_token) localStorage.setItem(KEY_REFRESH, refresh_token);
}

export function saveUser(user) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY_USER, JSON.stringify(user));
}

export function getUser() {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(KEY_USER)); } catch { return null; }
}

export function getAccessToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(KEY_ACCESS);
}

export function isTokenExpired() {
  if (typeof window === 'undefined') return true;
  const expiry = Number(localStorage.getItem(KEY_EXPIRY) || 0);
  return Date.now() >= expiry - BUFFER_MS;
}

export function isSignedIn() {
  return !!getAccessToken() && !!getUser();
}

export function signOut() {
  if (typeof window === 'undefined') return;
  [KEY_ACCESS, KEY_REFRESH, KEY_EXPIRY, KEY_USER, KEY_CACHE].forEach((k) =>
    localStorage.removeItem(k)
  );
}

/**
 * Returns a valid access token, refreshing if needed.
 * Throws if refresh fails.
 */
export async function getValidToken() {
  if (!isTokenExpired()) return getAccessToken();

  const refreshToken = localStorage.getItem(KEY_REFRESH);
  if (!refreshToken) throw new Error('No refresh token — please sign in again.');

  const res = await fetch('/api/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grantType: 'refresh_token', refreshToken }),
  });

  if (!res.ok) {
    signOut();
    throw new Error('Session expired — please sign in again.');
  }

  const tokens = await res.json();
  saveTokens(tokens);
  return tokens.access_token;
}

// ── Course result cache (localStorage) ──────────────────────────────

export function getCachedCourses() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY_CACHE);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function setCachedCourses(data) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY_CACHE, JSON.stringify(data));
}

export function clearCoursesCache() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY_CACHE);
}
