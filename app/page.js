'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const AUTH_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
  'https://www.googleapis.com/auth/directory.readonly',
  'email',
  'profile',
].join(' ');

function buildAuthUrl() {
  const clientId   = process.env.NEXT_PUBLIC_CLIENT_ID || '';
  const appUrl     = process.env.NEXT_PUBLIC_APP_URL || '';
  const redirectUri = `${appUrl}/api/auth/callback`;

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         AUTH_SCOPES,
    access_type:   'offline',
    prompt:        'consent',
    hd:            'isb.nu.edu.pk',   // hint Google to show only uni accounts
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

function LandingInner() {
  const params   = useSearchParams();
  const authErr  = params.get('auth_error');

  const errorMessages = {
    unauthorized_domain: 'Only @isb.nu.edu.pk accounts are allowed. Please sign in with your university email.',
    userinfo_failed:     'Could not retrieve your account information. Please try again.',
    no_code:             'Google did not return an authorization code. Please try again.',
  };

  const errorText = authErr
    ? (errorMessages[authErr] || `Authentication failed: ${authErr.replace(/_/g, ' ')}`)
    : null;

  const authUrl = buildAuthUrl();

  return (
    <main className="landing">
      <div className="landing-badge">
        <span>🏫</span> NU FAST Islamabad
      </div>

      <h1>
        Find your <span>instructors&apos; emails</span><br />in seconds
      </h1>

      <p className="landing-sub">
        GCR Contacts scans your active Google Classroom courses and automatically
        resolves the email addresses of every instructor, TA, and Lab Demonstrator —
        so you can reach them without hunting through the university website.
      </p>

      <div className="landing-steps">
        <div className="landing-step">
          <span className="step-num">1</span>
          Sign in with your NU email
        </div>
        <div className="landing-step">
          <span className="step-num">2</span>
          We scan your current semester GCRs
        </div>
        <div className="landing-step">
          <span className="step-num">3</span>
          Copy any email with one click
        </div>
      </div>

      {errorText && (
        <div className="auth-error" role="alert">
          ⚠ {errorText}
        </div>
      )}

      <a href={authUrl} className="btn-google" id="sign-in-btn">
        <GoogleIcon />
        Sign in with Google
      </a>

      <p className="landing-note">
        Only accessible to @isb.nu.edu.pk accounts &nbsp;·&nbsp; No data is stored on our servers
      </p>
    </main>
  );
}

export default function LandingPage() {
  return (
    <Suspense fallback={<main className="landing"><p style={{color:'var(--text-secondary)'}}>Loading…</p></main>}>
      <LandingInner />
    </Suspense>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
