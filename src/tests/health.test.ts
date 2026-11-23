import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/health/route';

describe('GET /api/health', () => {
  it('returns status 200 and healthy payload envelope', async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toMatchObject({
      status: 'healthy',
      service: 'cb_hrm',
      timestamp: expect.any(String),
    });
  });
});

