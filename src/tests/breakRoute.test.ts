import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { POST as punchInHandler } from '@/app/api/attendance/punch-in/route';
import { POST as startBreakHandler } from '@/app/api/attendance/break/start/route';
import { POST as endBreakHandler } from '@/app/api/attendance/break/end/route';
import { prisma } from '@/lib/prisma';

let mockUser: { id: string; email: string } | null = null;

vi.mock('@/lib/auth', () => ({
  auth: () => Promise.resolve(mockUser ? { user: mockUser } : null),
}));

describe('Break API Routes Integration', () => {
  let brokerId: string;
  const punchInTime = '2026-11-24T13:30:00.000Z';
  const breakStartTime = '2026-11-24T15:00:00.000Z';
  const breakEndTime = '2026-11-24T15:20:00.000Z';

  function createRequest(body?: any): Request {
    return new Request('http://localhost:3001/api/attendance/break', {
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

  it('rejects start break when unauthenticated (401)', async () => {
    mockUser = null;
    const res = await startBreakHandler(createRequest({ timestamp: breakStartTime }));
    expect(res.status).toBe(401);
  });

  it('starts break and returns 200 with open break record', async () => {
    await punchInHandler(createRequest({ timestamp: punchInTime }));
    const res = await startBreakHandler(createRequest({ timestamp: breakStartTime }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.breakRecord.breakEnd).toBeNull();

    // Duplicate break while on break returns 409
    const dupRes = await startBreakHandler(createRequest({ timestamp: breakStartTime }));
    expect(dupRes.status).toBe(409);
  });

  it('ends break and returns 200 with duration', async () => {
    await punchInHandler(createRequest({ timestamp: punchInTime }));
    await startBreakHandler(createRequest({ timestamp: breakStartTime }));

    const res = await endBreakHandler(createRequest({ timestamp: breakEndTime }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.breakRecord.durationMinutes).toBe(20);
    expect(data.totalBreakMinutes).toBe(20);
  });

  it('rejects end break if not currently on break (400)', async () => {
    await punchInHandler(createRequest({ timestamp: punchInTime }));
    const res = await endBreakHandler(createRequest({ timestamp: breakEndTime }));
    expect(res.status).toBe(400);
  });
});

