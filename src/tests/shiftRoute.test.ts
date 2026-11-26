import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import {
  GET as getShiftsHandler,
  POST as createShiftHandler,
} from '@/app/api/admin/shifts/route';
import { PATCH as updateShiftHandler } from '@/app/api/admin/shifts/[id]/route';
import {
  GET as getAssignmentsHandler,
  POST as createAssignmentHandler,
} from '@/app/api/admin/shift-assignments/route';
import {
  PATCH as updateAssignmentHandler,
  DELETE as deleteAssignmentHandler,
} from '@/app/api/admin/shift-assignments/[id]/route';
import { prisma } from '@/lib/prisma';

let mockUser: { id: string; email: string; role: { code: string; name: string } } | null = null;

vi.mock('@/lib/auth', () => ({
  auth: () => Promise.resolve(mockUser ? { user: mockUser } : null),
}));

describe('Phase 9: Admin Shift Master & Assignment API Routes Integration', () => {
  let brokerId: string;
  let brokerEmail: string;
  let adminId: string;
  let adminEmail: string;
  let shift1900Id: string;
  const createdShiftCodes: string[] = [];

  function createRequest(url: string, method: string = 'GET', body?: unknown): Request {
    return new Request(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  async function cleanup() {
    if (createdShiftCodes.length > 0) {
      await prisma.employeeShift.deleteMany({
        where: { shift: { code: { in: createdShiftCodes } } },
      });
      await prisma.shift.deleteMany({
        where: { code: { in: createdShiftCodes } },
      });
    }
    if (brokerId) {
      await prisma.employeeShift.deleteMany({ where: { userId: brokerId } });
    }
  }

  beforeEach(async () => {
    const broker = await prisma.user.findFirst({
      where: { email: 'broker@capitalbridgelogistics.com' },
    });
    const admin = await prisma.user.findFirst({
      where: { email: 'admin@capitalbridgelogistics.com' },
    });
    const shift1900 = await prisma.shift.findUnique({ where: { code: 'SHIFT_1900' } });
    if (!broker || !admin || !shift1900) throw new Error('Seeded test entities not found');

    brokerId = broker.id;
    brokerEmail = broker.email;
    adminId = admin.id;
    adminEmail = admin.email;
    shift1900Id = shift1900.id;

    mockUser = { id: adminId, email: adminEmail, role: { code: 'ADMIN', name: 'Admin' } };
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    if (brokerId && shift1900Id) {
      await prisma.employeeShift.create({
        data: {
          userId: brokerId,
          shiftId: shift1900Id,
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        },
      });
    }
    await prisma.$disconnect();
  });

  it('rejects unauthenticated (401) and non-ADMIN BROKER (403) requests', async () => {
    mockUser = null;
    expect((await getShiftsHandler()).status).toBe(401);
    expect(
      (await getAssignmentsHandler(createRequest('http://localhost:3001/api/admin/shift-assignments')))
        .status
    ).toBe(401);

    mockUser = { id: brokerId, email: brokerEmail, role: { code: 'BROKER', name: 'Broker' } };
    expect((await getShiftsHandler()).status).toBe(403);
    expect(
      (
        await createShiftHandler(
          createRequest('http://localhost:3001/api/admin/shifts', 'POST', {
            code: 'SHIFT_2000',
            displayName: '20:00 - 04:30 IST',
            startTime: '20:00',
            durationMins: 510,
            graceMinutes: 15,
          })
        )
      ).status
    ).toBe(403);
    expect(
      (
        await createAssignmentHandler(
          createRequest('http://localhost:3001/api/admin/shift-assignments', 'POST', {
            userId: brokerId,
            shiftId: shift1900Id,
            effectiveFrom: '2026-11-01',
          })
        )
      ).status
    ).toBe(403);
  });

  it('ADMIN creates, lists, and updates custom shifts via /api/admin/shifts', async () => {
    createdShiftCodes.push('SHIFT_2100');

    const createRes = await createShiftHandler(
      createRequest('http://localhost:3001/api/admin/shifts', 'POST', {
        code: 'shift_2100',
        displayName: '21:00 - 05:30 IST',
        startTime: '21:00',
        durationMins: 510,
        graceMinutes: 15,
      })
    );
    expect(createRes.status).toBe(201);
    const { shift } = await createRes.json();
    expect(shift.code).toBe('SHIFT_2100');

    const listRes = await getShiftsHandler();
    expect(listRes.status).toBe(200);
    const listJson = await listRes.json();
    expect(listJson.shifts.some((s: { code: string }) => s.code === 'SHIFT_2100')).toBe(true);

    const patchRes = await updateShiftHandler(
      createRequest(`http://localhost:3001/api/admin/shifts/${shift.id}`, 'PATCH', {
        graceMinutes: 25,
      }),
      { params: Promise.resolve({ id: shift.id }) }
    );
    expect(patchRes.status).toBe(200);
    expect((await patchRes.json()).shift.graceMinutes).toBe(25);
  });

  it('ADMIN creates, checks conflict (409), reassigns with autoClosePrevious, updates, and deletes assignments', async () => {
    const shift1800 = await prisma.shift.findUniqueOrThrow({ where: { code: 'SHIFT_1800' } });

    const a1 = await createAssignmentHandler(
      createRequest('http://localhost:3001/api/admin/shift-assignments', 'POST', {
        userId: brokerId,
        shiftId: shift1900Id,
        effectiveFrom: '2026-10-01',
        autoClosePrevious: false,
      })
    );
    expect(a1.status).toBe(201);

    // Overlap without autoClosePrevious -> 409
    const conflict = await createAssignmentHandler(
      createRequest('http://localhost:3001/api/admin/shift-assignments', 'POST', {
        userId: brokerId,
        shiftId: shift1800.id,
        effectiveFrom: '2026-11-01',
        autoClosePrevious: false,
      })
    );
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).error.code).toBe('SHIFT_OVERLAPPING_ASSIGNMENT');

    // Reassign with autoClosePrevious -> 201
    const a2 = await createAssignmentHandler(
      createRequest('http://localhost:3001/api/admin/shift-assignments', 'POST', {
        userId: brokerId,
        shiftId: shift1800.id,
        effectiveFrom: '2026-11-01',
        autoClosePrevious: true,
      })
    );
    expect(a2.status).toBe(201);
    const { assignment } = await a2.json();

    const listRes = await getAssignmentsHandler(
      createRequest(`http://localhost:3001/api/admin/shift-assignments?userId=${brokerId}`)
    );
    expect(listRes.status).toBe(200);
    const listJson = await listRes.json();
    expect(listJson.data.assignments.length).toBe(2);

    const patchRes = await updateAssignmentHandler(
      createRequest(`http://localhost:3001/api/admin/shift-assignments/${assignment.id}`, 'PATCH', {
        effectiveTo: '2026-12-31',
      }),
      { params: Promise.resolve({ id: assignment.id }) }
    );
    expect(patchRes.status).toBe(200);

    const delRes = await deleteAssignmentHandler(
      createRequest(`http://localhost:3001/api/admin/shift-assignments/${assignment.id}`, 'DELETE'),
      { params: Promise.resolve({ id: assignment.id }) }
    );
    expect(delRes.status).toBe(200);
  });
});

