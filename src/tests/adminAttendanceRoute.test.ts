import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { GET as getAdminAttendanceHandler } from '@/app/api/admin/attendance/route';
import { POST as regularizeHandler } from '@/app/api/admin/attendance/regularize/route';
import { GET as getAuditLogsHandler } from '@/app/api/admin/attendance/[id]/audit-logs/route';
import { POST as staleCheckHandler } from '@/app/api/admin/attendance/stale-check/route';
import { prisma } from '@/lib/prisma';

let mockUser: { id: string; email: string; role: { code: string; name: string } } | null = null;

vi.mock('@/lib/auth', () => ({
  auth: () => Promise.resolve(mockUser ? { user: mockUser } : null),
}));

describe('Admin Attendance Command Center API Routes Integration', () => {
  let brokerId: string;
  let brokerEmail: string;
  let adminId: string;
  let adminEmail: string;

  function createRequest(url: string, method: string = 'GET', body?: unknown): Request {
    return new Request(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  async function cleanup() {
    if (brokerId) {
      await prisma.attendanceAuditLog.deleteMany({
        where: { attendanceRecord: { userId: brokerId } },
      });
      await prisma.breakRecord.deleteMany({
        where: { attendanceRecord: { userId: brokerId } },
      });
      await prisma.attendanceRecord.deleteMany({
        where: { userId: brokerId },
      });
    }
  }

  beforeEach(async () => {
    const broker = await prisma.user.findFirst({
      where: { email: 'broker@capitalbridgelogistics.com' },
    });
    const admin = await prisma.user.findFirst({
      where: { email: 'admin@capitalbridgelogistics.com' },
    });
    if (!broker || !admin) throw new Error('Seeded broker/admin not found');

    brokerId = broker.id;
    brokerEmail = broker.email;
    adminId = admin.id;
    adminEmail = admin.email;

    mockUser = {
      id: adminId,
      email: adminEmail,
      role: { code: 'ADMIN', name: 'Admin' },
    };

    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('rejects unauthenticated requests with 401 across all admin attendance routes', async () => {
    mockUser = null;

    expect(
      (await getAdminAttendanceHandler(createRequest('http://localhost:3001/api/admin/attendance')))
        .status
    ).toBe(401);
    expect(
      (
        await regularizeHandler(
          createRequest('http://localhost:3001/api/admin/attendance/regularize', 'POST', {
            userId: brokerId,
            workDate: '2026-11-26',
            reason: 'Test',
          })
        )
      ).status
    ).toBe(401);
    expect(
      (
        await getAuditLogsHandler(
          createRequest('http://localhost:3001/api/admin/attendance/fake/audit-logs'),
          { params: Promise.resolve({ id: 'fake' }) }
        )
      ).status
    ).toBe(401);
    expect(
      (
        await staleCheckHandler(
          createRequest('http://localhost:3001/api/admin/attendance/stale-check', 'POST', {})
        )
      ).status
    ).toBe(401);
  });

  it('rejects non-ADMIN user (BROKER) with 403 AUTH_FORBIDDEN', async () => {
    mockUser = { id: brokerId, email: brokerEmail, role: { code: 'BROKER', name: 'Broker' } };

    expect(
      (await getAdminAttendanceHandler(createRequest('http://localhost:3001/api/admin/attendance')))
        .status
    ).toBe(403);
    expect(
      (
        await regularizeHandler(
          createRequest('http://localhost:3001/api/admin/attendance/regularize', 'POST', {
            userId: brokerId,
            workDate: '2026-11-26',
            reason: 'Test',
          })
        )
      ).status
    ).toBe(403);
    expect(
      (
        await getAuditLogsHandler(
          createRequest('http://localhost:3001/api/admin/attendance/fake/audit-logs'),
          { params: Promise.resolve({ id: 'fake' }) }
        )
      ).status
    ).toBe(403);
    expect(
      (
        await staleCheckHandler(
          createRequest('http://localhost:3001/api/admin/attendance/stale-check', 'POST', {})
        )
      ).status
    ).toBe(403);
  });

  it('GET /api/admin/attendance returns live roster & KPIs and validates date param', async () => {
    const badRes = await getAdminAttendanceHandler(
      createRequest('http://localhost:3001/api/admin/attendance?date=invalid')
    );
    expect(badRes.status).toBe(400);

    const res = await getAdminAttendanceHandler(
      createRequest('http://localhost:3001/api/admin/attendance?date=2026-11-26')
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.workDate).toBe('2026-11-26');
    expect(json.data.kpis).toBeDefined();
    expect(Array.isArray(json.data.roster)).toBe(true);
  });

  it('TS-REG-001 & TS-REG-002: POST /api/admin/attendance/regularize enforces reason and records audit logs', async () => {
    const rec = await prisma.attendanceRecord.create({
      data: {
        userId: brokerId,
        workDate: '2026-11-24',
        firstPunchIn: new Date('2026-11-24T13:30:00.000Z'),
        status: 'A',
      },
    });

    // Empty reason -> 400 ADM_REGULARIZATION_REASON_REQUIRED
    const emptyReasonRes = await regularizeHandler(
      createRequest('http://localhost:3001/api/admin/attendance/regularize', 'POST', {
        attendanceRecordId: rec.id,
        status: 'P',
        reason: '   ',
      })
    );
    expect(emptyReasonRes.status).toBe(400);
    expect((await emptyReasonRes.json()).error.code).toBe('ADM_REGULARIZATION_REASON_REQUIRED');

    // Valid regularization
    const okRes = await regularizeHandler(
      createRequest('http://localhost:3001/api/admin/attendance/regularize', 'POST', {
        attendanceRecordId: rec.id,
        firstPunchIn: '2026-11-24T13:30:00.000Z',
        lastPunchOut: '2026-11-24T22:00:00.000Z',
        reason: 'Verified power outage',
      })
    );
    expect(okRes.status).toBe(200);
    const okJson = await okRes.json();
    expect(okJson.success).toBe(true);
    expect(okJson.record.isRegularized).toBe(true);
    expect(okJson.record.status).toBe('P');

    // Audit log endpoint
    const logsRes = await getAuditLogsHandler(
      createRequest(`http://localhost:3001/api/admin/attendance/${rec.id}/audit-logs`),
      { params: Promise.resolve({ id: rec.id }) }
    );
    expect(logsRes.status).toBe(200);
    const logsJson = await logsRes.json();
    expect(logsJson.logs).toHaveLength(1);
    expect(logsJson.logs[0].reason).toBe('Verified power outage');
  });

  it('POST /api/admin/attendance/stale-check marks stale >16h shifts', async () => {
    const oldStart = new Date(Date.now() - 18 * 60 * 60 * 1000);
    const rec = await prisma.attendanceRecord.create({
      data: {
        userId: brokerId,
        workDate: '2026-11-25',
        firstPunchIn: oldStart,
        status: 'IN_PROGRESS',
      },
    });

    const res = await staleCheckHandler(
      createRequest('http://localhost:3001/api/admin/attendance/stale-check', 'POST', {})
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.markedCount).toBeGreaterThanOrEqual(1);

    const updated = await prisma.attendanceRecord.findUnique({ where: { id: rec.id } });
    expect(updated?.status).toBe('ANOMALY_STALE');
  });
});

