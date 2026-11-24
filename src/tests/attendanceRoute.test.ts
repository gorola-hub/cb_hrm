import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { POST as punchInHandler } from '@/app/api/attendance/punch-in/route';
import { POST as punchOutHandler } from '@/app/api/attendance/punch-out/route';
import { GET as todayHandler } from '@/app/api/attendance/today/route';
import { prisma } from '@/lib/prisma';

let mockUser: { id: string; email: string } | null = null;

vi.mock('@/lib/auth', () => ({
  auth: () => Promise.resolve(mockUser ? { user: mockUser } : null),
}));

describe('Attendance API Routes Integration', () => {
  let brokerId: string;
  // 18:55 IST on 2026-11-24 -> 13:25 UTC
  const validPunchInTimestamp = '2026-11-24T13:25:00.000Z';
  // 03:30 IST next day -> 22:00 UTC
  const validPunchOutTimestamp = '2026-11-24T22:00:00.000Z';

  function createRequest(body?: any): Request {
    return new Request('http://localhost:3001/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  beforeEach(async () => {
    const broker = await prisma.user.findFirst({
      where: { email: 'broker@capitalbridgelogistics.com' },
    });
    if (!broker) throw new Error('Broker not found');
    brokerId = broker.id;
    mockUser = { id: brokerId, email: broker.email };

    await prisma.breakRecord.deleteMany({
      where: { attendanceRecord: { userId: brokerId } },
    });
    await prisma.attendanceRecord.deleteMany({
      where: { userId: brokerId },
    });
  });

  afterAll(async () => {
    await prisma.breakRecord.deleteMany({
      where: { attendanceRecord: { userId: brokerId } },
    });
    await prisma.attendanceRecord.deleteMany({
      where: { userId: brokerId },
    });
    await prisma.$disconnect();
  });

  it('rejects punch-in when unauthenticated (401)', async () => {
    mockUser = null;
    const res = await punchInHandler(createRequest({ timestamp: validPunchInTimestamp }));
    expect(res.status).toBe(401);
  });

  it('punch-in returns 200 and records shift', async () => {
    const req = createRequest({ timestamp: validPunchInTimestamp });
    const res = await punchInHandler(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.record.status).toBe('IN_PROGRESS');

    // Second punch-in returns 409 Conflict
    const dupRes = await punchInHandler(createRequest({ timestamp: validPunchInTimestamp }));
    expect(dupRes.status).toBe(409);
  });

  it('punch-out returns 200 and updates status', async () => {
    await punchInHandler(createRequest({ timestamp: validPunchInTimestamp }));
    const res = await punchOutHandler(createRequest({ timestamp: validPunchOutTimestamp }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(['P', 'HD', 'A']).toContain(data.record.status);
  });

  it('today route returns current state', async () => {
    const idleRes = await todayHandler();
    const idleData = await idleRes.json();
    expect(idleData.state).toBe('IDLE');

    await punchInHandler(createRequest({ timestamp: validPunchInTimestamp }));
    const activeRes = await todayHandler();
    const activeData = await activeRes.json();
    expect(activeData.state).toBe('ACTIVE');
    expect(activeData.record).toBeDefined();
  });
});
