import { describe, it, expect, vi } from 'vitest';
import { GET } from '@/app/api/auth/sso/token/route';

let mockUser: { id: string; email: string } | null = null;

vi.mock('@/lib/auth', () => ({
  auth: () => Promise.resolve(mockUser ? { user: mockUser } : null),
}));

describe('GET /api/auth/sso/token Route Integration', () => {
  it('rejects unauthenticated request with 401 Unauthorized', async () => {
    mockUser = null;
    const req = new Request('http://localhost:3001/api/auth/sso/token', { method: 'GET' });
    const res = await GET(req);

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('AUTH_UNAUTHORIZED');
  });

  it('returns 200 OK with valid ssoUrl and token for authenticated user', async () => {
    mockUser = {
      id: 'usr_test_broker_456',
      email: 'broker@capitalbridgelogistics.com',
    };

    const req = new Request('http://localhost:3001/api/auth/sso/token', { method: 'GET' });
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(typeof data.ssoUrl).toBe('string');
    expect(typeof data.token).toBe('string');

    // Verify token structure
    const parts = data.token.split('.');
    expect(parts.length).toBe(3);

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    expect(payload.userId).toBe(mockUser.id);
    expect(payload.email).toBe(mockUser.email);
    expect(payload.iss).toBe('capital-bridge-hrm');

    // Verify ssoUrl format
    const url = new URL(data.ssoUrl);
    expect(url.pathname).toBe('/api/auth/sso');
    expect(url.searchParams.get('token')).toBe(data.token);
  });
});

