import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { GET as getMyLeavesHandler, POST as submitLeaveHandler } from '@/app/api/leaves/route';
import { POST as cancelLeaveHandler } from '@/app/api/leaves/[id]/cancel/route';
import { GET as getAdminLeavesHandler } from '@/app/api/admin/leaves/route';
import { POST as approveLeaveHandler } from '@/app/api/admin/leaves/[id]/approve/route';
import { POST as rejectLeaveHandler } from '@/app/api/admin/leaves/[id]/reject/route';
import { prisma } from '@/lib/prisma';

let mockUser: { id: string; email: string; role: { code: string; name: string } } | null = null;

vi.mock('@/lib/auth', () => ({
  auth: () => Promise.resolve(mockUser ? { user: mockUser } : null),
}));

describe('Leave Management API Routes Integration', () => {
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

  beforeEach(async () => {
    const broker = await prisma.user.findFirst({
      where: { email: 'broker@capitalbridgelogistics.com' },
    });
    const admin = await prisma.user.findFirst({
      where: { email: 'admin@capitalbridgelogistics.com' },
    });
    if (!broker || !admin) throw new Error('Seeded test users not found');

    brokerId = broker.id;
    brokerEmail = broker.email;
    adminId = admin.id;
    adminEmail = admin.email;

    mockUser = {
      id: brokerId,
      email: brokerEmail,
      role: { code: 'BROKER', name: 'Broker' },
    };

    await prisma.leaveRequest.deleteMany({ where: { userId: brokerId } });
    await prisma.breakRecord.deleteMany({ where: { attendanceRecord: { userId: brokerId } } });
    await prisma.attendanceRecord.deleteMany({ where: { userId: brokerId } });
  });

  afterAll(async () => {
    await prisma.leaveRequest.deleteMany({ where: { userId: brokerId } });
    await prisma.breakRecord.deleteMany({ where: { attendanceRecord: { userId: brokerId } } });
    await prisma.attendanceRecord.deleteMany({ where: { userId: brokerId } });
    await prisma.$disconnect();
  });

  it('rejects unauthenticated requests with 401', async () => {
    mockUser = null;
    const res1 = await getMyLeavesHandler();
    expect(res1.status).toBe(401);

    const res2 = await submitLeaveHandler(
      createRequest('http://localhost:3001/api/leaves', 'POST', {
        leaveType: 'CASUAL',
        startDate: '2026-12-07',
        endDate: '2026-12-07',
        reason: 'Test',
      })
    );
    expect(res2.status).toBe(401);

    const res3 = await getAdminLeavesHandler(
      createRequest('http://localhost:3001/api/admin/leaves')
    );
    expect(res3.status).toBe(401);
  });

  it('rejects non-ADMIN user on admin leave endpoints with 403', async () => {
    mockUser = { id: brokerId, email: brokerEmail, role: { code: 'BROKER', name: 'Broker' } };

    const listRes = await getAdminLeavesHandler(
      createRequest('http://localhost:3001/api/admin/leaves')
    );
    expect(listRes.status).toBe(403);

    const approveRes = await approveLeaveHandler(
      createRequest('http://localhost:3001/api/admin/leaves/fake/approve', 'POST', {}),
      { params: Promise.resolve({ id: 'fake' }) }
    );
    expect(approveRes.status).toBe(403);

    const rejectRes = await rejectLeaveHandler(
      createRequest('http://localhost:3001/api/admin/leaves/fake/reject', 'POST', {
        adminNotes: 'No',
      }),
      { params: Promise.resolve({ id: 'fake' }) }
    );
    expect(rejectRes.status).toBe(403);
  });

  it('POST /api/leaves creates leave (201), rejects invalid dates (400), and rejects overlaps (409)', async () => {
    // Invalid range
    const badRes = await submitLeaveHandler(
      createRequest('http://localhost:3001/api/leaves', 'POST', {
        leaveType: 'CASUAL',
        startDate: '2026-12-10',
        endDate: '2026-12-08',
        reason: 'Invalid',
      })
    );
    expect(badRes.status).toBe(400);
    const badJson = await badRes.json();
    expect(badJson.error.code).toBe('LV_INVALID_DATE_RANGE');

    // Valid submission
    const okRes = await submitLeaveHandler(
      createRequest('http://localhost:3001/api/leaves', 'POST', {
        leaveType: 'CASUAL',
        startDate: '2026-12-07',
        endDate: '2026-12-08',
        reason: 'Personal errand',
      })
    );
    expect(okRes.status).toBe(201);
    const okJson = await okRes.json();
    expect(okJson.success).toBe(true);
    expect(okJson.leave.status).toBe('PENDING');
    expect(okJson.leave.totalDays).toBe(2);

    // Overlap
    const overlapRes = await submitLeaveHandler(
      createRequest('http://localhost:3001/api/leaves', 'POST', {
        leaveType: 'SICK',
        startDate: '2026-12-08',
        endDate: '2026-12-09',
        reason: 'Doctor visit',
      })
    );
    expect(overlapRes.status).toBe(409);
    const overlapJson = await overlapRes.json();
    expect(overlapJson.error.code).toBe('LV_OVERLAPPING_REQUEST');
  });

  it('GET /api/leaves and POST /api/leaves/[id]/cancel work for owner', async () => {
    const createRes = await submitLeaveHandler(
      createRequest('http://localhost:3001/api/leaves', 'POST', {
        leaveType: 'SICK',
        startDate: '2026-12-14',
        endDate: '2026-12-14',
        reason: 'Dental',
      })
    );
    const { leave } = await createRes.json();

    const listRes = await getMyLeavesHandler();
    expect(listRes.status).toBe(200);
    const listJson = await listRes.json();
    expect(listJson.success).toBe(true);
    expect(listJson.data.requests).toHaveLength(1);
    expect(listJson.data.balances.SICK.pending).toBe(1);

    const cancelRes = await cancelLeaveHandler(
      createRequest(`http://localhost:3001/api/leaves/${leave.id}/cancel`, 'POST'),
      { params: Promise.resolve({ id: leave.id }) }
    );
    expect(cancelRes.status).toBe(200);
    const cancelJson = await cancelRes.json();
    expect(cancelJson.leave.status).toBe('CANCELLED');
  });

  it('TS-LV-003: ADMIN approves leave and auto-marks LV attendance via route', async () => {
    const createRes = await submitLeaveHandler(
      createRequest('http://localhost:3001/api/leaves', 'POST', {
        leaveType: 'CASUAL',
        startDate: '2026-12-07',
        endDate: '2026-12-07',
        reason: 'Family function',
      })
    );
    const { leave } = await createRes.json();

    // Switch to ADMIN session
    mockUser = { id: adminId, email: adminEmail, role: { code: 'ADMIN', name: 'Admin' } };

    const adminListRes = await getAdminLeavesHandler(
      createRequest('http://localhost:3001/api/admin/leaves?status=PENDING')
    );
    expect(adminListRes.status).toBe(200);
    const adminListJson = await adminListRes.json();
    expect(adminListJson.data.pendingCount).toBeGreaterThanOrEqual(1);

    const approveRes = await approveLeaveHandler(
      createRequest(`http://localhost:3001/api/admin/leaves/${leave.id}/approve`, 'POST', {
        adminNotes: 'Approved',
      }),
      { params: Promise.resolve({ id: leave.id }) }
    );
    expect(approveRes.status).toBe(200);
    const approveJson = await approveRes.json();
    expect(approveJson.leave.status).toBe('APPROVED');

    const att = await prisma.attendanceRecord.findUnique({
      where: { userId_workDate: { userId: brokerId, workDate: '2026-12-07' } },
    });
    expect(att?.status).toBe('LV');
  });

  it('ADMIN reject route requires adminNotes and sets REJECTED', async () => {
    const createRes = await submitLeaveHandler(
      createRequest('http://localhost:3001/api/leaves', 'POST', {
        leaveType: 'CASUAL',
        startDate: '2026-12-11',
        endDate: '2026-12-11',
        reason: 'Personal day',
      })
    );
    const { leave } = await createRes.json();

    mockUser = { id: adminId, email: adminEmail, role: { code: 'ADMIN', name: 'Admin' } };

    const emptyRes = await rejectLeaveHandler(
      createRequest(`http://localhost:3001/api/admin/leaves/${leave.id}/reject`, 'POST', {
        adminNotes: '',
      }),
      { params: Promise.resolve({ id: leave.id }) }
    );
    expect(emptyRes.status).toBe(400);

    const okRes = await rejectLeaveHandler(
      createRequest(`http://localhost:3001/api/admin/leaves/${leave.id}/reject`, 'POST', {
        adminNotes: 'Peak freight volume day',
      }),
      { params: Promise.resolve({ id: leave.id }) }
    );
    expect(okRes.status).toBe(200);
    const okJson = await okRes.json();
    expect(okJson.leave.status).toBe('REJECTED');
    expect(okJson.leave.adminNotes).toBe('Peak freight volume day');
  });
});

