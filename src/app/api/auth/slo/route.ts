import { NextResponse } from 'next/server';

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
];

export function getSafeRedirectUrl(targetUrl: string | null, defaultPath: string, requestOrigin: string): URL {
  if (!targetUrl) return new URL(defaultPath, requestOrigin);

  try {
    // Relative path (e.g., '/login')
    if (targetUrl.startsWith('/') && !targetUrl.startsWith('//')) {
      return new URL(targetUrl, requestOrigin);
    }

    const parsed = new URL(targetUrl);
    if (ALLOWED_ORIGINS.includes(parsed.origin)) {
      return parsed;
    }
  } catch {
    // Fall back to default path on error
  }

  return new URL(defaultPath, requestOrigin);
}

export async function GET(request: Request) {
  const reqUrl = new URL(request.url);
  const targetCallback = reqUrl.searchParams.get('callbackUrl');
  const redirectUrl = getSafeRedirectUrl(targetCallback, '/login', reqUrl.origin);

  const response = NextResponse.redirect(redirectUrl);

  const cookiesToClear = [
    'cb_hrm.session-token',
    '__Secure-cb_hrm.session-token',
    'cb_hrm.csrf-token',
    '__Host-cb_hrm.csrf-token',
    'cb_hrm.callback-url',
    'authjs.session-token',
    '__Secure-authjs.session-token',
  ];

  for (const name of cookiesToClear) {
    response.cookies.set({
      name,
      value: '',
      path: '/',
      maxAge: 0,
      expires: new Date(0),
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  }

  return response;
}

