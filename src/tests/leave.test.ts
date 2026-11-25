import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  submitLeaveRequest,
  getMyLeaves,
  cancelMyLeave,
  approveLeaveRequest,
  rejectLeaveRequest,
  getPendingLeaveCount,
  calculateWorkingDays,
} from '@/service/leave.service';
import { punchIn } from '@/service/attendance.service';
import { prisma } from '@/lib/prisma';

describe('Leave Management & Admin Approval Workflow (TS-LV)', () => {
  let brokerId: string;
  let adminId: string;

  beforeEach(async () => {
    const broker = await prisma.user.findFirst({
      where: { email: 'broker@capitalbridgelogistics.com' },
    });
    const admin = await prisma.user.findFirst({
      where: { email: 'admin@capitalbridgelogistics.com' },
    });

    if (!broker || !admin) {
      throw new Error('Test broker or admin not found. Run db:seed.');
    }

    brokerId = broker.id;
    adminId = admin.id;

    await prisma.leaveRequest.deleteMany({
      where: { userId: brokerId },
    });
    await prisma.breakRecord.deleteMany({
      where: { attendanceRecord: { userId: brokerId } },
    });
    await prisma.attendanceRecord.deleteMany({
      where: { userId: brokerId },
    });
  });

  afterAll(async () => {
    await prisma.leaveRequest.deleteMany({
      where: { userId: brokerId },
    });
    await prisma.breakRecord.deleteMany({
      where: { attendanceRecord: { userId: brokerId } },
    });
    await prisma.attendanceRecord.deleteMany({
      where: { userId: brokerId },
    });
    await prisma.$disconnect();
  });

  it('calculates working days excluding Saturday and Sunday', () => {
    // 2026-12-05 (Sat), 2026-12-06 (Sun), 2026-12-07 (Mon) -> 1 working day
    expect(calculateWorkingDays('2026-12-05', '2026-12-07')).toBe(1);
    // 2026-12-07 (Mon) to 2026-12-11 (Fri) -> 5 working days
    expect(calculateWorkingDays('2026-12-07', '2026-12-11')).toBe(5);
    // Weekend only: 2026-12-05 (Sat) to 2026-12-06 (Sun) -> 0 working days
    expect(calculateWorkingDays('2026-12-05', '2026-12-06')).toBe(0);
  });

  it('TS-LV-001: Submits a valid leave application with status PENDING', async () => {
    const result = await submitLeaveRequest(brokerId, {
      leaveType: 'CASUAL',
      startDate: '2026-12-05',
      endDate: '2026-12-07',
      reason: 'Family wedding',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.leave.status).toBe('PENDING');
      expect(result.leave.leaveType).toBe('CASUAL');
      expect(result.leave.totalDays).toBe(1);
      expect(result.leave.reason).toBe('Family wedding');
    }

    const pendingCount = await getPendingLeaveCount();
    expect(pendingCount).toBeGreaterThanOrEqual(1);
  });

  it('LV_INVALID_DATE_RANGE: Rejects when endDate is earlier than startDate', async () => {
    const result = await submitLeaveRequest(brokerId, {
      leaveType: 'SICK',
      startDate: '2026-12-10',
      endDate: '2026-12-08',
      reason: 'Fever',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('LV_INVALID_DATE_RANGE');
      expect(result.error.message).toBe('End date cannot be earlier than start date.');
    }
  });

  it('LV_EMPTY_REASON: Rejects blank or whitespace-only reason', async () => {
    const result = await submitLeaveRequest(brokerId, {
      leaveType: 'CASUAL',
      startDate: '2026-12-08',
      endDate: '2026-12-09',
      reason: '   ',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('LV_EMPTY_REASON');
      expect(result.error.message).toBe('A valid reason is required when submitting a leave request.');
    }
  });

  it('TS-LV-002: Rejects overlapping PENDING or APPROVED leave requests', async () => {
    await submitLeaveRequest(brokerId, {
      leaveType: 'CASUAL',
      startDate: '2026-12-07',
      endDate: '2026-12-09',
      reason: 'Personal travel',
    });

    const overlap = await submitLeaveRequest(brokerId, {
      leaveType: 'SICK',
      startDate: '2026-12-08',
      endDate: '2026-12-10',
      reason: 'Medical checkup',
    });

    expect(overlap.success).toBe(false);
    if (!overlap.success) {
      expect(overlap.error.code).toBe('LV_OVERLAPPING_REQUEST');
      expect(overlap.error.message).toBe(
        'You already have an active or pending leave request covering these dates.'
      );
    }
  });

  it('Allows employee to cancel a PENDING leave and re-apply for those dates', async () => {
    const created = await submitLeaveRequest(brokerId, {
      leaveType: 'CASUAL',
      startDate: '2026-12-14',
      endDate: '2026-12-15',
      reason: 'Errand',
    });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const cancelled = await cancelMyLeave(brokerId, created.leave.id);
    expect(cancelled.success).toBe(true);
    if (cancelled.success) {
      expect(cancelled.leave.status).toBe('CANCELLED');
    }

    const reapplied = await submitLeaveRequest(brokerId, {
      leaveType: 'PRIVILEGED',
      startDate: '2026-12-14',
      endDate: '2026-12-15',
      reason: 'Planned trip',
    });
    expect(reapplied.success).toBe(true);
  });

  it('TS-LV-003: Admin approval updates status to APPROVED and auto-marks weekday attendance as LV', async () => {
    // Mon Dec 7 to Wed Dec 9 (3 weekdays) + Sat Dec 5 to Sun Dec 6 (weekends excluded)
    const created = await submitLeaveRequest(brokerId, {
      leaveType: 'PRIVILEGED',
      startDate: '2026-12-05',
      endDate: '2026-12-09',
      reason: 'Annual vacation',
    });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const approved = await approveLeaveRequest(created.leave.id, adminId, 'Approved by manager');
    expect(approved.success).toBe(true);
    if (approved.success) {
      expect(approved.leave.status).toBe('APPROVED');
      expect(approved.leave.reviewedBy).toBe(adminId);
      expect(approved.leave.reviewedAt).not.toBeNull();
    }

    // Weekdays Dec 7, 8, 9 should have status 'LV'; weekends Dec 5, 6 should NOT have LV rows
    const records = await prisma.attendanceRecord.findMany({
      where: { userId: brokerId },
      orderBy: { workDate: 'asc' },
    });
    expect(records.map((r) => r.workDate)).toEqual(['2026-12-07', '2026-12-08', '2026-12-09']);
    for (const r of records) {
      expect(r.status).toBe('LV');
    }

    // Balance summary reflects used days
    const myLeaves = await getMyLeaves(brokerId);
    expect(myLeaves.balances.PRIVILEGED.used).toBe(3);
  });

  it('Admin rejection requires adminNotes and does not mark attendance as LV', async () => {
    const created = await submitLeaveRequest(brokerId, {
      leaveType: 'CASUAL',
      startDate: '2026-12-10',
      endDate: '2026-12-10',
      reason: 'Day off',
    });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const missingReason = await rejectLeaveRequest(created.leave.id, adminId, '   ');
    expect(missingReason.success).toBe(false);
    if (!missingReason.success) {
      expect(missingReason.error.code).toBe('LV_EMPTY_REASON');
    }

    const rejected = await rejectLeaveRequest(
      created.leave.id,
      adminId,
      'Month-end dispatch coverage required'
    );
    expect(rejected.success).toBe(true);
    if (rejected.success) {
      expect(rejected.leave.status).toBe('REJECTED');
      expect(rejected.leave.adminNotes).toBe('Month-end dispatch coverage required');
      expect(rejected.leave.reviewedBy).toBe(adminId);
    }

    const attendance = await prisma.attendanceRecord.findUnique({
      where: { userId_workDate: { userId: brokerId, workDate: '2026-12-10' } },
    });
    expect(attendance).toBeNull();
  });

  it('Rule BR-LV-002: Punching in on an approved LV date overrides LV to IN_PROGRESS', async () => {
    const created = await submitLeaveRequest(brokerId, {
      leaveType: 'CASUAL',
      startDate: '2026-12-07',
      endDate: '2026-12-07',
      reason: 'Tentative appointment',
    });
    expect(created.success).toBe(true);
    if (!created.success) return;

    await approveLeaveRequest(created.leave.id, adminId);

    // Employee ends up working on Dec 7: 18:55 IST -> 13:25 UTC
    const punchTime = new Date('2026-12-07T13:25:00.000Z');
    const punchResult = await punchIn(brokerId, punchTime);

    expect(punchResult.success).toBe(true);
    if (punchResult.success) {
      expect(punchResult.record.workDate).toBe('2026-12-07');
      expect(punchResult.record.status).toBe('IN_PROGRESS');
      expect(punchResult.record.firstPunchIn.toISOString()).toBe(punchTime.toISOString());
    }
  });
});

