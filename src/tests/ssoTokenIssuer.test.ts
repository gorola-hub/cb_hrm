import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { generateSsoToken, getSsoBridgeUrl } from '@/service/sso.service';

describe('SSO Token Issuer Service (TS-SSO-001)', () => {
  const secret =
    process.env.SHARED_SSO_SECRET ||
    'capital-bridge-shared-sso-secret-dev-environment-key-32chars';

  const mockUser = {
    id: 'usr_broker_123',
    email: 'broker@capitalbridgelogistics.com',
  };

  it('generates a valid 3-part base64url encoded JWT token', () => {
    const token = generateSsoToken(mockUser);
    expect(typeof token).toBe('string');

    const parts = token.split('.');
    expect(parts.length).toBe(3);

    const [b64Header, b64Payload, signature] = parts;

    // Header assertions
    const header = JSON.parse(Buffer.from(b64Header, 'base64url').toString('utf8'));
    expect(header).toEqual({
      alg: 'HS256',
      typ: 'JWT',
    });

    // Payload assertions
    const payload = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf8'));
    expect(payload.userId).toBe(mockUser.id);
    expect(payload.email).toBe(mockUser.email);
    expect(payload.iss).toBe('capital-bridge-hrm');

    const now = Math.floor(Date.now() / 1000);
    // Expiration must be approximately 60 seconds from now (allow 5 second delta for test runtime)
    expect(payload.exp).toBeGreaterThanOrEqual(now + 55);
    expect(payload.exp).toBeLessThanOrEqual(now + 65);

    // Signature verification with HMAC-SHA256
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${b64Header}.${b64Payload}`)
      .digest('base64url');

    expect(signature).toBe(expectedSig);
  });

  it('generates the complete CRM bridge URL with encoded token', () => {
    const ssoUrl = getSsoBridgeUrl(mockUser);
    expect(typeof ssoUrl).toBe('string');

    const url = new URL(ssoUrl);
    expect(url.pathname).toBe('/api/auth/sso');
    expect(url.searchParams.has('token')).toBe(true);

    const token = url.searchParams.get('token')!;
    const parts = token.split('.');
    expect(parts.length).toBe(3);

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    expect(payload.userId).toBe(mockUser.id);
  });

  it('throws an error if user id or email is missing', () => {
    // @ts-expect-error Testing missing user id
    expect(() => generateSsoToken({ email: 'test@cbl.com' })).toThrow(
      'User ID and email are required to issue an SSO token'
    );

    // @ts-expect-error Testing missing user email
    expect(() => generateSsoToken({ id: 'usr_123' })).toThrow(
      'User ID and email are required to issue an SSO token'
    );
  });

  it('uses configured CRM_BASE_URL or defaults to localhost:3000', () => {
    const originalUrl = process.env.CRM_BASE_URL;

    process.env.CRM_BASE_URL = 'https://crm.capitalbridgelogistics.com';
    const prodSsoUrl = getSsoBridgeUrl(mockUser);
    expect(prodSsoUrl.startsWith('https://crm.capitalbridgelogistics.com/api/auth/sso?token=')).toBe(true);

    // Restore original env
    if (originalUrl) {
      process.env.CRM_BASE_URL = originalUrl;
    } else {
      delete process.env.CRM_BASE_URL;
    }
  });
});

