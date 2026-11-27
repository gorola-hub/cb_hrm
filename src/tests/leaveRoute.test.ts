import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { GET as getLeaveTypesHandler } from '@/app/api/leave-types/route';
import { GET as getMyLeavesHandler, POST as submitLeaveHandler } from '@/app/api/leaves/route';
import { POST as cancelLeaveHandler } from '@/app/api/leaves/[id]/cancel/route';
import { GET as getAdminLeavesHandler } from '@/app/api/admin/leaves/route';
import { POST as approveLeaveHandler } from '@/app/api/admin/leaves/[id]/approve/route';
import { POST as rejectLeaveHandler } from '@/app/api/admin/leaves/[id]/reject/route';
import {
  GET as getAdminLeaveTypesHandler,
  POST as createAdminLeaveTypeHandler,
} from '@/app/api/admin/leave-types/route';
import {
  PATCH as updateAdminLeaveTypeHandler,
  DELETE as deleteAdminLeaveTypeHandler,
} from '@/app/api/admin/leave-types/[id]/route';
import { GET as getAdminBalancesHandler } from '@/app/api/admin/leave-balances/route';
import { PUT as adjustAdminBalanceHandler } from '@/app/api/admin/leave-balances/adjust/route';
import { POST as carryForwardHandler } from '@/app/api/admin/leave-balances/carry-forward/route';
import { prisma } from '@/lib/prisma';

let mockUser: { id: string; email: string; role: { code: string; name: string } } | null = null;

vi.mock('@/lib/auth', () => ({
  auth: () => Promise.resolve(mockUser ? { user: mockUser } : null),
}));

describe('Leave Management & Dynamic Types/Balances API Routes Integration', () => {
  let brokerId: string;
  let brokerEmail: string;
  let adminId: string;
  let adminEmail: string;
  let originalBrokerDoj: Date | null = null;
  const createdTypeCodes: string[] = [];

  function createRequest(url: string, method: string = 'GET', body?: unknown): Request {
    return new Request(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  async function cleanup() {
    if (brokerId) {
      await prisma.leaveRequest.deleteMany({ where: { userId: brokerId } });
      await prisma.leaveBalance.deleteMany({ where: { userId: brokerId } });
      await prisma.breakRecord.deleteMany({ where: { attendanceRecord: { userId: brokerId } } });
      await prisma.attendanceRecord.deleteMany({ where: { userId: brokerId } });
    }
    if (createdTypeCodes.length > 0) {
      await prisma.leaveBalance.deleteMany({
        where: { leaveType: { code: { in: createdTypeCodes } } },
      });
      await prisma.leaveRequest.deleteMany({
        where: { leaveType: { code: { in: createdTypeCodes } } },
      });
      await prisma.leaveTypeConfig.deleteMany({
        where: { code: { in: createdTypeCodes } },
      });
    }
    await prisma.leaveTypeConfig.updateMany({
      where: { code: 'PAID' },
      data: { isActive: true, allowCarryForward: false, maxCarryForwardDays: 0 },
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
    originalBrokerDoj = broker.dateOfJoining ?? null;

    await prisma.user.update({
      where: { id: brokerId },
      data: { dateOfJoining: new Date('2025-01-01') },
    });

    mockUser = {
      id: brokerId,
      email: brokerEmail,
      role: { code: 'BROKER', name: 'Broker' },
    };

    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    if (brokerId) {
      await prisma.user.update({
        where: { id: brokerId },
        data: { dateOfJoining: originalBrokerDoj },
      });
    }
    await prisma.$disconnect();
  });

  it('rejects unauthenticated requests with 401 across employee and admin endpoints', async () => {
    mockUser = null;
    expect((await getLeaveTypesHandler()).status).toBe(401);
    expect((await getMyLeavesHandler(createRequest('http://localhost:3001/api/leaves'))).status).toBe(401);
    expect(
      (
        await submitLeaveHandler(
          createRequest('http://localhost:3001/api/leaves', 'POST', {
            leaveTypeCode: 'PAID',
            startDate: '2026-12-07',
            endDate: '2026-12-07',
            reason: 'Test',
          })
        )
      ).status
    ).toBe(401);
    expect(
      (await getAdminLeavesHandler(createRequest('http://localhost:3001/api/admin/leaves'))).status
    ).toBe(401);
    expect((await getAdminLeaveTypesHandler()).status).toBe(401);
    expect(
      (
        await getAdminBalancesHandler(
          createRequest('http://localhost:3001/api/admin/leave-balances')
        )
      ).status
    ).toBe(401);
  });

  it('rejects non-ADMIN user on all admin leave, type, and balance endpoints with 403', async () => {
    mockUser = { id: brokerId, email: brokerEmail, role: { code: 'BROKER', name: 'Broker' } };

    expect(
      (await getAdminLeavesHandler(createRequest('http://localhost:3001/api/admin/leaves'))).status
    ).toBe(403);
    expect(
      (
        await approveLeaveHandler(
          createRequest('http://localhost:3001/api/admin/leaves/fake/approve', 'POST', {}),
          { params: Promise.resolve({ id: 'fake' }) }
        )
      ).status
    ).toBe(403);
    expect(
      (
        await rejectLeaveHandler(
          createRequest('http://localhost:3001/api/admin/leaves/fake/reject', 'POST', {
            adminNotes: 'No',
          }),
          { params: Promise.resolve({ id: 'fake' }) }
        )
      ).status
    ).toBe(403);
    expect((await getAdminLeaveTypesHandler()).status).toBe(403);
    expect(
      (
        await createAdminLeaveTypeHandler(
          createRequest('http://localhost:3001/api/admin/leave-types', 'POST', {
            code: 'TEST',
            name: 'Test',
            defaultAnnualDays: 5,
          })
        )
      ).status
    ).toBe(403);
    expect(
      (
        await getAdminBalancesHandler(
          createRequest('http://localhost:3001/api/admin/leave-balances')
        )
      ).status
    ).toBe(403);
    expect(
      (
        await carryForwardHandler(
          createRequest('http://localhost:3001/api/admin/leave-balances/carry-forward', 'POST', {
            fromYear: 2026,
            toYear: 2027,
          })
        )
      ).status
    ).toBe(403);
  });

  it('POST /api/leaves creates leave (201), rejects invalid dates (400), and rejects overlaps (409)', async () => {
    const typesRes = await getLeaveTypesHandler();
    expect(typesRes.status).toBe(200);
    const typesJson = await typesRes.json();
    expect(typesJson.leaveTypes.some((t: { code: string }) => t.code === 'PAID')).toBe(true);

    const badRes = await submitLeaveHandler(
      createRequest('http://localhost:3001/api/leaves', 'POST', {
        leaveTypeCode: 'PAID',
        startDate: '2026-12-10',
        endDate: '2026-12-08',
        reason: 'Invalid',
      })
    );
    expect(badRes.status).toBe(400);
    expect((await badRes.json()).error.code).toBe('LV_INVALID_DATE_RANGE');

    const okRes = await submitLeaveHandler(
      createRequest('http://localhost:3001/api/leaves', 'POST', {
        leaveTypeCode: 'PAID',
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
    expect(okJson.leave.leaveType.code).toBe('PAID');

    const overlapRes = await submitLeaveHandler(
      createRequest('http://localhost:3001/api/leaves', 'POST', {
        leaveTypeCode: 'PAID',
        startDate: '2026-12-08',
        endDate: '2026-12-09',
        reason: 'Doctor visit',
      })
    );
    expect(overlapRes.status).toBe(409);
    expect((await overlapRes.json()).error.code).toBe('LV_OVERLAPPING_REQUEST');
  });

  it('GET /api/leaves and POST /api/leaves/[id]/cancel work with balance tracking', async () => {
    const createRes = await submitLeaveHandler(
      createRequest('http://localhost:3001/api/leaves', 'POST', {
        leaveTypeCode: 'PAID',
        startDate: '2026-12-14',
        endDate: '2026-12-14',
        reason: 'Dental',
      })
    );
    const { leave } = await createRes.json();

    const listRes = await getMyLeavesHandler(
      createRequest('http://localhost:3001/api/leaves?year=2026')
    );
    expect(listRes.status).toBe(200);
    const listJson = await listRes.json();
    expect(listJson.success).toBe(true);
    expect(listJson.data.hasJoiningDate).toBe(true);
    expect(listJson.data.requests).toHaveLength(1);
    const paidBal = listJson.data.balances.find(
      (b: { leaveType: { code: string } }) => b.leaveType.code === 'PAID'
    );
    expect(paidBal.pendingDays).toBe(1);

    const cancelRes = await cancelLeaveHandler(
      createRequest(`http://localhost:3001/api/leaves/${leave.id}/cancel`, 'POST'),
      { params: Promise.resolve({ id: leave.id }) }
    );
    expect(cancelRes.status).toBe(200);
    expect((await cancelRes.json()).leave.status).toBe('CANCELLED');
  });

  it('ADMIN manages dynamic leave types, adjusts balances, and runs carry-forward via API routes', async () => {
    createdTypeCodes.push('MATERNITY_TEST');
    mockUser = { id: adminId, email: adminEmail, role: { code: 'ADMIN', name: 'Admin' } };

    // Create new leave type
    const createTypeRes = await createAdminLeaveTypeHandler(
      createRequest('http://localhost:3001/api/admin/leave-types', 'POST', {
        code: 'maternity_test',
        name: 'Parental Leave',
        defaultAnnualDays: 30,
        allowCarryForward: true,
        maxCarryForwardDays: 5,
        isPaid: true,
      })
    );
    expect(createTypeRes.status).toBe(201);
    const { leaveType } = await createTypeRes.json();
    expect(leaveType.code).toBe('MATERNITY_TEST');

    // Duplicate returns 409
    const dupRes = await createAdminLeaveTypeHandler(
      createRequest('http://localhost:3001/api/admin/leave-types', 'POST', {
        code: 'MATERNITY_TEST',
        name: 'Dup',
        defaultAnnualDays: 10,
      })
    );
    expect(dupRes.status).toBe(409);

    // Adjust broker's balance for this new type
    const adjustRes = await adjustAdminBalanceHandler(
      createRequest('http://localhost:3001/api/admin/leave-balances/adjust', 'PUT', {
        userId: brokerId,
        leaveTypeId: leaveType.id,
        year: 2026,
        entitledDays: 10,
        adjustedDays: 2,
        notes: 'Custom prorated allocation',
      })
    );
    expect(adjustRes.status).toBe(200);
    const adjJson = await adjustRes.json();
    expect(adjJson.balance.entitledDays).toBe(10);
    expect(adjJson.balance.adjustedDays).toBe(2);

    // Run carry-forward rollover 2026 -> 2027
    const rollRes = await carryForwardHandler(
      createRequest('http://localhost:3001/api/admin/leave-balances/carry-forward', 'POST', {
        fromYear: 2026,
        toYear: 2027,
        userId: brokerId,
      })
    );
    expect(rollRes.status).toBe(200);

    // Verify 2027 balance via GET /api/admin/leave-balances
    const bal2027Res = await getAdminBalancesHandler(
      createRequest(`http://localhost:3001/api/admin/leave-balances?year=2027&userId=${brokerId}`)
    );
    expect(bal2027Res.status).toBe(200);
    const bal2027Json = await bal2027Res.json();
    const brokerEntry = bal2027Json.data.employees[0];
    const mat2027 = brokerEntry.balances.find(
      (b: { leaveType: { code: string } }) => b.leaveType.code === 'MATERNITY_TEST'
    );
    expect(mat2027.carriedForwardDays).toBe(5); // capped at maxCarryForwardDays = 5

    // Deactivate via PATCH
    const patchRes = await updateAdminLeaveTypeHandler(
      createRequest(`http://localhost:3001/api/admin/leave-types/${leaveType.id}`, 'PATCH', {
        isActive: false,
      }),
      { params: Promise.resolve({ id: leaveType.id }) }
    );
    expect(patchRes.status).toBe(200);
    expect((await patchRes.json()).leaveType.isActive).toBe(false);

    // Delete fails because balances exist (409 LV_TYPE_IN_USE)
    const delRes = await deleteAdminLeaveTypeHandler(
      createRequest(`http://localhost:3001/api/admin/leave-types/${leaveType.id}`, 'DELETE'),
      { params: Promise.resolve({ id: leaveType.id }) }
    );
    expect(delRes.status).toBe(409);
  });

  it('TS-LV-003: ADMIN approves leave and auto-marks LV attendance via route', async () => {
    const createRes = await submitLeaveHandler(
      createRequest('http://localhost:3001/api/leaves', 'POST', {
        leaveTypeCode: 'PAID',
        startDate: '2026-12-07',
        endDate: '2026-12-07',
        reason: 'Family function',
      })
    );
    const { leave } = await createRes.json();

    mockUser = { id: adminId, email: adminEmail, role: { code: 'ADMIN', name: 'Admin' } };

    const approveRes = await approveLeaveHandler(
      createRequest(`http://localhost:3001/api/admin/leaves/${leave.id}/approve`, 'POST', {
        adminNotes: 'Approved',
      }),
      { params: Promise.resolve({ id: leave.id }) }
    );
    expect(approveRes.status).toBe(200);
    expect((await approveRes.json()).leave.status).toBe('APPROVED');

    const att = await prisma.attendanceRecord.findUnique({
      where: { userId_workDate: { userId: brokerId, workDate: '2026-12-07' } },
    });
    expect(att?.status).toBe('LV');
  });

  it('ADMIN reject route requires adminNotes and sets REJECTED', async () => {
    const createRes = await submitLeaveHandler(
      createRequest('http://localhost:3001/api/leaves', 'POST', {
        leaveTypeCode: 'PAID',
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
