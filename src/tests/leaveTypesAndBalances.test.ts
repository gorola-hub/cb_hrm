import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  createLeaveType,
  updateLeaveType,
  deleteLeaveType,
  listLeaveTypes,
} from '@/service/leaveType.service';
import {
  getEmployeeLeaveBalances,
  adjustEmployeeLeaveBalance,
  runCarryForwardRollover,
} from '@/service/leaveBalance.service';
import {
  submitLeaveRequest,
  approveLeaveRequest,
  getMyLeaves,
} from '@/service/leave.service';
import { getMonthlyAttendance, punchIn } from '@/service/attendance.service';
import { prisma } from '@/lib/prisma';

describe('Phase 7.5: Dynamic Leave Types, Per-Employee Balances & Edge Cases', () => {
  let brokerId: string;
  let adminId: string;
  const createdTypeCodes: string[] = [];

  async function cleanupTestData() {
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
    // Restore default SICK/CASUAL/PRIVILEGED active flags in case a test toggled them
    await prisma.leaveTypeConfig.updateMany({
      where: { code: { in: ['CASUAL', 'SICK', 'PRIVILEGED'] } },
      data: { isActive: true },
    });
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
    adminId = admin.id;
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  describe('Dynamic Leave Types CRUD & Lifecycle', () => {
    it('TS-LV-004: Creates custom leave type (normalized uppercase), rejects duplicates, and enforces soft-deactivation vs delete-in-use', async () => {
      createdTypeCodes.push('BEREAVEMENT', 'TEMP_UNUSED');

      const created = await createLeaveType({
        code: 'bereavement',
        name: 'Bereavement Leave',
        description: 'Family bereavement',
        defaultAnnualDays: 5,
        allowCarryForward: false,
        maxCarryForwardDays: 0,
        isPaid: true,
      });
      expect(created.success).toBe(true);
      if (!created.success) return;
      expect(created.leaveType.code).toBe('BEREAVEMENT');
      expect(created.leaveType.defaultAnnualDays).toBe(5);

      // Duplicate case-insensitive code
      const dup = await createLeaveType({
        code: 'Bereavement',
        name: 'Duplicate',
        defaultAnnualDays: 3,
      });
      expect(dup.success).toBe(false);
      if (!dup.success) {
        expect(dup.error.code).toBe('LV_TYPE_DUPLICATE');
      }

      // Reject negative days
      const neg = await createLeaveType({
        code: 'NEG_TEST',
        name: 'Negative',
        defaultAnnualDays: -2,
      });
      expect(neg.success).toBe(false);

      // Employee submits leave on custom type
      const reqRes = await submitLeaveRequest(brokerId, {
        leaveTypeCode: 'BEREAVEMENT',
        startDate: '2026-12-07',
        endDate: '2026-12-08',
        reason: 'Family emergency',
      });
      expect(reqRes.success).toBe(true);

      // Cannot delete a leave type referenced by a request
      const delInUse = await deleteLeaveType(created.leaveType.id);
      expect(delInUse.success).toBe(false);
      if (!delInUse.success) {
        expect(delInUse.error.code).toBe('LV_TYPE_IN_USE');
      }

      // Soft-deactivate blocks new submissions while preserving history
      const deactivated = await updateLeaveType(created.leaveType.id, { isActive: false });
      expect(deactivated.success).toBe(true);

      const blockedReq = await submitLeaveRequest(brokerId, {
        leaveTypeCode: 'BEREAVEMENT',
        startDate: '2026-12-14',
        endDate: '2026-12-14',
        reason: 'Should fail',
      });
      expect(blockedReq.success).toBe(false);
      if (!blockedReq.success) {
        expect(blockedReq.error.code).toBe('LV_TYPE_INACTIVE');
      }

      const activeOnly = await listLeaveTypes(true);
      expect(activeOnly.some((t) => t.code === 'BEREAVEMENT')).toBe(false);

      // Unused leave type can be deleted cleanly
      const unused = await createLeaveType({
        code: 'TEMP_UNUSED',
        name: 'Temp Unused',
        defaultAnnualDays: 2,
      });
      expect(unused.success).toBe(true);
      if (unused.success) {
        const deleted = await deleteLeaveType(unused.leaveType.id);
        expect(deleted.success).toBe(true);
      }
    });
  });

  describe('Per-Employee Custom Balances, Fractional Adjustments & Carry-Forward', () => {
    it('auto-provisions balances, supports custom quotas, fractional adjustments, and blocks negative total entitlement', async () => {
      const casualType = await prisma.leaveTypeConfig.findUniqueOrThrow({
        where: { code: 'CASUAL' },
      });

      // Auto-provisions 2026 balances from defaultAnnualDays
      const initial = await getEmployeeLeaveBalances(brokerId, 2026);
      const casualInitial = initial.find((b) => b.leaveType.code === 'CASUAL');
      expect(casualInitial?.entitledDays).toBe(12);
      expect(casualInitial?.remainingDays).toBe(12);

      // Admin sets prorated custom quota (6.5) + bonus adjustment (1.5) -> 8.0 total
      const adjusted = await adjustEmployeeLeaveBalance({
        userId: brokerId,
        leaveTypeId: casualType.id,
        year: 2026,
        entitledDays: 6.5,
        adjustedDays: 1.5,
        notes: 'Mid-year prorated quota + comp-off bonus',
      });
      expect(adjusted.success).toBe(true);
      if (adjusted.success) {
        expect(adjusted.balance.entitledDays).toBe(6.5);
        expect(adjusted.balance.adjustedDays).toBe(1.5);
      }

      const after = await getEmployeeLeaveBalances(brokerId, 2026);
      const casualAfter = after.find((b) => b.leaveType.code === 'CASUAL');
      expect(casualAfter?.remainingDays).toBe(8);

      // Reject negative total entitlement
      const invalidAdj = await adjustEmployeeLeaveBalance({
        userId: brokerId,
        leaveTypeId: casualType.id,
        year: 2026,
        entitledDays: 2,
        adjustedDays: -5,
        notes: 'Invalid',
      });
      expect(invalidAdj.success).toBe(false);
      if (!invalidAdj.success) {
        expect(invalidAdj.error.code).toBe('LV_INVALID_ADJUSTMENT');
      }
    });

    it('TS-BAL-001: Carry-forward rollover caps at maxCarryForwardDays, ignores non-carry-forward types & pending leaves, and is idempotent', async () => {
      const privileged = await prisma.leaveTypeConfig.findUniqueOrThrow({
        where: { code: 'PRIVILEGED' },
      });
      const casual = await prisma.leaveTypeConfig.findUniqueOrThrow({
        where: { code: 'CASUAL' },
      });

      // Setup 2026 PRIVILEGED: entitled 15 + adjusted 2 = 17; approve 3 days -> 14 unused (cap is 10)
      await adjustEmployeeLeaveBalance({
        userId: brokerId,
        leaveTypeId: privileged.id,
        year: 2026,
        entitledDays: 15,
        adjustedDays: 2,
        notes: '2026 bonus',
      });

      const approvedReq = await submitLeaveRequest(brokerId, {
        leaveTypeId: privileged.id,
        startDate: '2026-12-07',
        endDate: '2026-12-09',
        reason: '3-day vacation',
      });
      expect(approvedReq.success).toBe(true);
      if (approvedReq.success) {
        await approveLeaveRequest(approvedReq.leave.id, adminId);
      }

      // Also create a PENDING request in 2026 (should NOT reduce carry-forward since not approved)
      await submitLeaveRequest(brokerId, {
        leaveTypeId: privileged.id,
        startDate: '2026-12-14',
        endDate: '2026-12-15',
        reason: 'Pending 2 days',
      });

      // Setup 2026 CASUAL (allowCarryForward = false) with 12 unused
      await adjustEmployeeLeaveBalance({
        userId: brokerId,
        leaveTypeId: casual.id,
        year: 2026,
        entitledDays: 12,
        adjustedDays: 0,
      });

      // Run rollover 2026 -> 2027 twice to verify idempotency
      const roll1 = await runCarryForwardRollover(2026, 2027, brokerId);
      expect(roll1.success).toBe(true);
      const roll2 = await runCarryForwardRollover(2026, 2027, brokerId);
      expect(roll2.success).toBe(true);

      const balances2027 = await getEmployeeLeaveBalances(brokerId, 2027);
      const priv2027 = balances2027.find((b) => b.leaveType.code === 'PRIVILEGED');
      const cas2027 = balances2027.find((b) => b.leaveType.code === 'CASUAL');

      expect(priv2027?.carriedForwardDays).toBe(10); // Capped at maxCarryForwardDays = 10, not 20
      expect(priv2027?.remainingDays).toBe(25); // 15 entitled + 10 carried
      expect(cas2027?.carriedForwardDays).toBe(0); // allowCarryForward = false
    });
  });

  describe('Balance Enforcement, Unpaid Leave, Cross-Year & ANOMALY_STALE Edge Cases', () => {
    it('TS-LV-005: Blocks paid leave exceeding available balance (including pending reservation), allows unpaid LWP', async () => {
      createdTypeCodes.push('LWP');
      const casual = await prisma.leaveTypeConfig.findUniqueOrThrow({ where: { code: 'CASUAL' } });

      // Restrict CASUAL balance to 2 days
      await adjustEmployeeLeaveBalance({
        userId: brokerId,
        leaveTypeId: casual.id,
        year: 2026,
        entitledDays: 2,
        adjustedDays: 0,
      });

      // Requesting 3 days fails with LV_INSUFFICIENT_BALANCE
      const over = await submitLeaveRequest(brokerId, {
        leaveTypeCode: 'CASUAL',
        startDate: '2026-12-07',
        endDate: '2026-12-09',
        reason: '3 days > 2 remaining',
      });
      expect(over.success).toBe(false);
      if (!over.success) {
        expect(over.error.code).toBe('LV_INSUFFICIENT_BALANCE');
      }

      // Requesting 2 days succeeds and reserves pendingDays = 2
      const first = await submitLeaveRequest(brokerId, {
        leaveTypeCode: 'CASUAL',
        startDate: '2026-12-07',
        endDate: '2026-12-08',
        reason: '2 days within balance',
      });
      expect(first.success).toBe(true);

      // Second concurrent PENDING request for 1 day fails because 2 pending already consumes available balance
      const second = await submitLeaveRequest(brokerId, {
        leaveTypeCode: 'CASUAL',
        startDate: '2026-12-10',
        endDate: '2026-12-10',
        reason: 'Exceeds available after pending',
      });
      expect(second.success).toBe(false);
      if (!second.success) {
        expect(second.error.code).toBe('LV_INSUFFICIENT_BALANCE');
      }

      // Unpaid LWP (isPaid = false, defaultAnnualDays = 0) succeeds even with 0 balance
      await createLeaveType({
        code: 'LWP',
        name: 'Leave Without Pay',
        defaultAnnualDays: 0,
        isPaid: false,
      });
      const unpaid = await submitLeaveRequest(brokerId, {
        leaveTypeCode: 'LWP',
        startDate: '2026-12-14',
        endDate: '2026-12-18',
        reason: 'Extended unpaid leave',
      });
      expect(unpaid.success).toBe(true);
    });

    it('handles cross-year leave requests (2026-12-30 to 2027-01-04) accurately per calendar year', async () => {
      const casual = await prisma.leaveTypeConfig.findUniqueOrThrow({ where: { code: 'CASUAL' } });
      // Give 2 days in 2026 and 1 day in 2027 -> cross-year needs 2 in 2026 and 2 in 2027 -> should reject!
      await adjustEmployeeLeaveBalance({
        userId: brokerId,
        leaveTypeId: casual.id,
        year: 2026,
        entitledDays: 2,
        adjustedDays: 0,
      });
      await adjustEmployeeLeaveBalance({
        userId: brokerId,
        leaveTypeId: casual.id,
        year: 2027,
        entitledDays: 1,
        adjustedDays: 0,
      });

      const insufficientNextYear = await submitLeaveRequest(brokerId, {
        leaveTypeCode: 'CASUAL',
        startDate: '2026-12-30',
        endDate: '2027-01-04',
        reason: 'New Year trip',
      });
      expect(insufficientNextYear.success).toBe(false);
      if (!insufficientNextYear.success) {
        expect(insufficientNextYear.error.code).toBe('LV_INSUFFICIENT_BALANCE');
      }

      // Increase 2027 to 2 days -> succeeds and deducts 2 from 2026 + 2 from 2027 after approval
      await adjustEmployeeLeaveBalance({
        userId: brokerId,
        leaveTypeId: casual.id,
        year: 2027,
        entitledDays: 2,
        adjustedDays: 0,
      });

      const okCrossYear = await submitLeaveRequest(brokerId, {
        leaveTypeCode: 'CASUAL',
        startDate: '2026-12-30',
        endDate: '2027-01-04',
        reason: 'New Year trip',
      });
      expect(okCrossYear.success).toBe(true);
      if (!okCrossYear.success) return;
      expect(okCrossYear.leave.totalDays).toBe(4); // Dec 30, Dec 31, Jan 1, Jan 4 (Jan 2-3 weekend)

      await approveLeaveRequest(okCrossYear.leave.id, adminId);

      const bal2026 = (await getMyLeaves(brokerId, 2026)).balances.find(
        (b) => b.leaveType.code === 'CASUAL'
      );
      const bal2027 = (await getMyLeaves(brokerId, 2027)).balances.find(
        (b) => b.leaveType.code === 'CASUAL'
      );
      expect(bal2026?.usedDays).toBe(2);
      expect(bal2026?.remainingDays).toBe(0);
      expect(bal2027?.usedDays).toBe(2);
      expect(bal2027?.remainingDays).toBe(0);
    });

    it('prevents approving a pending paid leave if admin reduced balance below required days', async () => {
      const sick = await prisma.leaveTypeConfig.findUniqueOrThrow({ where: { code: 'SICK' } });
      await adjustEmployeeLeaveBalance({
        userId: brokerId,
        leaveTypeId: sick.id,
        year: 2026,
        entitledDays: 5,
        adjustedDays: 0,
      });

      const req = await submitLeaveRequest(brokerId, {
        leaveTypeCode: 'SICK',
        startDate: '2026-12-07',
        endDate: '2026-12-09',
        reason: '3 days sick',
      });
      expect(req.success).toBe(true);
      if (!req.success) return;

      // Admin lowers quota to 1 day before reviewing
      await adjustEmployeeLeaveBalance({
        userId: brokerId,
        leaveTypeId: sick.id,
        year: 2026,
        entitledDays: 1,
        adjustedDays: 0,
      });

      const approve = await approveLeaveRequest(req.leave.id, adminId);
      expect(approve.success).toBe(false);
      if (!approve.success) {
        expect(approve.error.code).toBe('LV_INSUFFICIENT_BALANCE');
      }
    });

    it('supports ANOMALY_STALE AttendanceStatus in DB, monthly calendar, and subsequent punchIn', async () => {
      await prisma.attendanceRecord.create({
        data: {
          userId: brokerId,
          workDate: '2026-11-10',
          firstPunchIn: new Date('2026-11-10T13:30:00.000Z'),
          status: 'ANOMALY_STALE',
        },
      });

      const monthly = await getMonthlyAttendance(brokerId, '2026-11');
      const staleDay = monthly.days.find((d) => d.date === '2026-11-10');
      expect(staleDay?.status).toBe('ANOMALY_STALE');

      // Prior ANOMALY_STALE does NOT block punching in on a new shift date
      const nextPunch = await punchIn(brokerId, new Date('2026-11-24T13:25:00.000Z'));
      expect(nextPunch.success).toBe(true);
    });
  });
});

