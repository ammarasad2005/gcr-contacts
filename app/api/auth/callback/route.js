/**
 * GET /api/auth/callback
 * Receives the OAuth redirect from Google, exchanges the code for tokens,
 * fetches user info, then redirects to the dashboard with tokens in a
 * client-readable cookie (httpOnly=false so JS can read them).
 *
 * We encode the tokens in the query string to hand them to the client page
 * which immediately moves them to localStorage and strips the URL.
 */

'use strict';

import { NextResponse } from 'next/server';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code  = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(`${APP_URL}/?auth_error=${error || 'no_code'}`);
  }

  // Exchange code for tokens via our own token route
  let tokens;
  try {
    const res = await fetch(`${APP_URL}/api/auth/token`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ grantType: 'authorization_code', code }),
    });
    tokens = await res.json();
    if (!res.ok) throw new Error(tokens.error || 'Token exchange failed');
  } catch (err) {
    return NextResponse.redirect(
      `${APP_URL}/?auth_error=${encodeURIComponent(err.message)}`
    );
  }

  // Fetch user info to validate domain
  let userInfo;
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    userInfo = await res.json();
  } catch {
    return NextResponse.redirect(`${APP_URL}/?auth_error=userinfo_failed`);
  }

  // Domain restriction: @isb.nu.edu.pk only
  const email = userInfo.email || '';
  if (!email.endsWith('@isb.nu.edu.pk')) {
    return NextResponse.redirect(`${APP_URL}/?auth_error=unauthorized_domain`);
  }

  // Pass tokens + user to the dashboard via URL params (client strips them immediately)
  const dashUrl = new URL(`${APP_URL}/dashboard`);
  dashUrl.searchParams.set('access_token',  tokens.access_token);
  dashUrl.searchParams.set('refresh_token', tokens.refresh_token || '');
  dashUrl.searchParams.set('expires_in',    String(tokens.expires_in));
  dashUrl.searchParams.set('user',          JSON.stringify({
    email:   userInfo.email,
    name:    userInfo.name,
    picture: userInfo.picture,
  }));

  return NextResponse.redirect(dashUrl.toString());
}
