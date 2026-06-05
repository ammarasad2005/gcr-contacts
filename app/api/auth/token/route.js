/**
 * POST /api/auth/token
 * Exchanges an authorization code or refresh token for Google OAuth tokens.
 * CLIENT_SECRET never leaves the server.
 */

'use strict';

const CLIENT_ID     = process.env.GCR_CONTACTS_CLIENT_ID;
const CLIENT_SECRET = process.env.GCR_CONTACTS_CLIENT_SECRET;
const APP_URL       = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const REDIRECT_URI  = `${APP_URL}/api/auth/callback`;
const TOKEN_URL     = 'https://oauth2.googleapis.com/token';

export async function POST(request) {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return Response.json({ error: 'Server misconfiguration.' }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { grantType, code, refreshToken } = body || {};

  if (grantType === 'authorization_code') {
    if (!code || typeof code !== 'string' || code.length > 512) {
      return Response.json({ error: 'Invalid code.' }, { status: 400 });
    }

    const params = new URLSearchParams({
      code,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri:  REDIRECT_URI,
      grant_type:    'authorization_code',
    });

    return forwardToGoogle(params);
  }

  if (grantType === 'refresh_token') {
    if (!refreshToken || typeof refreshToken !== 'string' || refreshToken.length > 512) {
      return Response.json({ error: 'Invalid refresh token.' }, { status: 400 });
    }

    const params = new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type:    'refresh_token',
    });

    return forwardToGoogle(params);
  }

  return Response.json({ error: 'Invalid grantType.' }, { status: 400 });
}

async function forwardToGoogle(params) {
  try {
    const res  = await fetch(TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    params.toString(),
    });
    const data = await res.json();

    if (!res.ok) {
      return Response.json(
        { error: data.error_description || 'Token exchange failed.' },
        { status: 400 }
      );
    }

    return Response.json({
      access_token:  data.access_token,
      refresh_token: data.refresh_token,
      expires_in:    data.expires_in,
    });
  } catch {
    return Response.json({ error: 'Failed to reach Google.' }, { status: 502 });
  }
}
