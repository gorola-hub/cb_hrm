import { describe, it, expect } from 'vitest';
import { GET, getSafeRedirectUrl } from '@/app/api/auth/slo/route';

describe('HRM Single Sign-Out (SLO) Route Handler & Edge Cases', () => {
  const origin = 'http://localhost:3001';

  it('clears all session cookies and redirects to /login by default', async () => {
    const req = new Request(`${origin}/api/auth/slo`);
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`${origin}/login`);

    const setCookieHeaders = res.headers.getSetCookie();
    expect(setCookieHeaders.length).toBeGreaterThan(0);

    const clearedNames = setCookieHeaders.map((header) => header.split('=')[0]);
    expect(clearedNames).toContain('cb_hrm.session-token');
    expect(clearedNames).toContain('__Secure-cb_hrm.session-token');
    expect(clearedNames).toContain('authjs.session-token');

    // Confirm maxAge 0 / expired date on cookies
    expect(setCookieHeaders.some((h) => h.includes('Max-Age=0'))).toBe(true);
  });

  it('supports relative callbackUrl safely (e.g. /login?logged_out=true)', async () => {
    const req = new Request(`${origin}/api/auth/slo?callbackUrl=%2Flogin%3Flogged_out%3Dtrue`);
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`${origin}/login?logged_out=true`);
  });

  it('allows trusted cross-origin callbackUrl to CRM (e.g. http://localhost:3000/api/auth/slo)', async () => {
    const crmTarget = 'http://localhost:3000/api/auth/slo';
    const req = new Request(`${origin}/api/auth/slo?callbackUrl=${encodeURIComponent(crmTarget)}`);
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(crmTarget);
  });

  it('blocks open redirect attacks and falls back to /login', async () => {
    const maliciousTarget = 'https://evil-phishing-site.com/steal-token';
    const req = new Request(`${origin}/api/auth/slo?callbackUrl=${encodeURIComponent(maliciousTarget)}`);
    const res = await GET(req);

    expect(res.status).toBe(307);
    // Malicious URL must NOT be in location header
    expect(res.headers.get('location')).toBe(`${origin}/login`);
  });

  it('handles malformed or garbage callbackUrl gracefully without crashing', () => {
    const safeUrl = getSafeRedirectUrl(':::not-a-valid-url:::', '/login', origin);
    expect(safeUrl.href).toBe(`${origin}/login`);
  });

  it('blocks protocol-relative URLs (e.g. //evil.com)', () => {
    const safeUrl = getSafeRedirectUrl('//evil.com/phish', '/login', origin);
    expect(safeUrl.href).toBe(`${origin}/login`);
  });
});

