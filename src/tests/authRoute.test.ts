import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/auth/login/route';

describe('POST /api/auth/login', () => {
  it('returns 200 for valid active broker credentials', async () => {
    const req = new Request('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'broker@capitalbridgelogistics.com',
        password: 'Broker123!',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.user.email).toBe('broker@capitalbridgelogistics.com');
  });

  it('returns 401 with AUTH_INVALID_CREDENTIALS on bad password', async () => {
    const req = new Request('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'broker@capitalbridgelogistics.com',
        password: 'WrongPassword!',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('returns 400 when missing fields', async () => {
    const req = new Request('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'not-an-email',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

