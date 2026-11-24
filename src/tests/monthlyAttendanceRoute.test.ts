import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { GET as monthlyHandler } from '@/app/api/attendance/monthly/route';
import { prisma } from '@/lib/prisma';

let mockUser: { id: string; email: string } | null = null;

vi.mock('@/lib/auth', () => ({
  auth: () => Promise.resolve(mockUser ? { user: mockUser } : null),
}));

describe('Monthly Attendance API Route Integration', () => {
  let brokerId: string;

  function createRequest(url: string): Request {
    return new Request(url, {
      method: 'GET',
    });
  }

  beforeEach(async () => {
    const broker = await prisma.user.findFirst({
      where: { email: 'broker@capitalbridgelogistics.com' },
    });
    if (!broker) throw new Error('Broker not found');
    brokerId = broker.id;
    mockUser = { id: brokerId, email: broker.email };
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects unauthenticated request with 401', async () => {
    mockUser = null;
    const req = createRequest('http://localhost:3001/api/attendance/monthly?month=2026-11');
    const res = await monthlyHandler(req);
    expect(res.status).toBe(401);
  });

  it('rejects invalid month format with 400', async () => {
    const req = createRequest('http://localhost:3001/api/attendance/monthly?month=invalid-date');
    const res = await monthlyHandler(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns monthly attendance with 200 OK for valid month', async () => {
    const req = createRequest('http://localhost:3001/api/attendance/monthly?month=2026-11');
    const res = await monthlyHandler(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.yearMonth).toBe('2026-11');
    expect(data.data.days).toBeInstanceOf(Array);
    expect(data.data.summary).toBeDefined();
  });
});

