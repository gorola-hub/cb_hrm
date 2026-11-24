import crypto from 'crypto';

export interface SsoUserPayload {
  id: string;
  email: string;
}

/**
 * Generates an HMAC-SHA256 signed JWT valid for 60 seconds.
 * Strictly adheres to Rule BR-SSO-001 and TS-SSO-001.
 */
export function generateSsoToken(user: SsoUserPayload): string {
  if (!user || !user.id || !user.email) {
    throw new Error('User ID and email are required to issue an SSO token');
  }

  const secret =
    process.env.SHARED_SSO_SECRET ||
    'capital-bridge-shared-sso-secret-dev-environment-key-32chars';

  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    userId: user.id,
    email: user.email,
    exp: now + 60,
    iss: 'capital-bridge-hrm',
  };

  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');

  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${b64Header}.${b64Payload}`)
    .digest('base64url');

  return `${b64Header}.${b64Payload}.${signature}`;
}

/**
 * Builds the complete redirect URL targeting the CRM inbound SSO endpoint.
 */
export function getSsoBridgeUrl(user: SsoUserPayload): string {
  const token = generateSsoToken(user);
  const baseUrl = process.env.CRM_BASE_URL || 'http://localhost:3000';
  const cleanBase = baseUrl.replace(/\/+$/, '');

  return `${cleanBase}/api/auth/sso?token=${encodeURIComponent(token)}`;
}

