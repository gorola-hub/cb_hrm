import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { calculateMonthlyAccruedPaidLeaves } from '@/lib/dateUtils';
import { getEmployeeLeaveBalances, adjustEmployeeLeaveBalance, runCarryForwardRollover } from '@/service/leaveBalance.service';
import { submitLeaveRequest, approveLeaveRequest, cancelMyLeave, getMyLeaves } from '@/service/leave.service';
import { prisma } from '@/lib/prisma';

describe('Phase 9.5: Monthly Paid Leave Accrual & 3-Month Probation Cutoff', () => {
  let brokerId: string;
  let adminId: string;
  let originalBrokerDoj: Date | null = null;
  let paidLeaveId: string;

  beforeEach(async () => {
    const broker = await prisma.user.findFirst({
      where: { email: 'broker@capitalbridgelogistics.com' },
    });
    const admin = await prisma.user.findFirst({
      where: { email: 'admin@capitalbridgelogistics.com' },
    });
    if (!broker || !admin) {
      throw new Error('Seeded broker/admin not found');
    }

    brokerId = broker.id;
    adminId = admin.id;
    originalBrokerDoj = broker.dateOfJoining ?? null;

    // Ensure PAID leave type exists for integration scenarios
    const paid = await prisma.leaveTypeConfig.upsert({
      where: { code: 'PAID' },
      update: { isPaid: true, isActive: true, allowCarryForward: false, maxCarryForwardDays: 0 },
      create: {
        code: 'PAID',
        name: 'Paid Leave',
        description: 'Monthly accrued paid leave (+1/month after 3-month probation)',
        defaultAnnualDays: 12,
        allowCarryForward: false,
        maxCarryForwardDays: 0,
        isPaid: true,
        isActive: true,
      },
    });
    paidLeaveId = paid.id;

    await prisma.leaveRequest.deleteMany({ where: { userId: brokerId } });
    await prisma.leaveBalance.deleteMany({ where: { userId: brokerId } });
    await prisma.breakRecord.deleteMany({ where: { attendanceRecord: { userId: brokerId } } });
    await prisma.attendanceRecord.deleteMany({ where: { userId: brokerId } });
  });

  afterAll(async () => {
    if (brokerId) {
      await prisma.leaveRequest.deleteMany({ where: { userId: brokerId } });
      await prisma.leaveBalance.deleteMany({ where: { userId: brokerId } });
      await prisma.user.update({
        where: { id: brokerId },
        data: { dateOfJoining: originalBrokerDoj },
      });
    }
    await prisma.leaveTypeConfig.updateMany({
      where: { code: 'PAID' },
      data: { isActive: true, allowCarryForward: false, maxCarryForwardDays: 0 },
    });
    await prisma.$disconnect();
  });

  describe('calculateMonthlyAccruedPaidLeaves() (TS-LV-006)', () => {
    it('joined on/before 15th (Nov 15): 3-month wait Nov/Dec/Jan -> starts Feb 1 (+1/month)', () => {
      const doj = new Date('2026-11-15');
      expect(calculateMonthlyAccruedPaidLeaves(doj, 2026, 11)).toBe(0);
      expect(calculateMonthlyAccruedPaidLeaves(doj, 2026, 12)).toBe(0);
      expect(calculateMonthlyAccruedPaidLeaves(doj, 2027, 1)).toBe(0);
      expect(calculateMonthlyAccruedPaidLeaves(doj, 2027, 2)).toBe(1);
      expect(calculateMonthlyAccruedPaidLeaves(doj, 2027, 3)).toBe(2);
      expect(calculateMonthlyAccruedPaidLeaves(doj, 2027, 12)).toBe(11);
    });

    it('joined after 15th (Nov 16): Nov excluded, 3-month wait Dec/Jan/Feb -> starts Mar 1 (+1/month)', () => {
      const doj = new Date('2026-11-16');
      expect(calculateMonthlyAccruedPaidLeaves(doj, 2026, 12)).toBe(0);
      expect(calculateMonthlyAccruedPaidLeaves(doj, 2027, 1)).toBe(0);
      expect(calculateMonthlyAccruedPaidLeaves(doj, 2027, 2)).toBe(0);
      expect(calculateMonthlyAccruedPaidLeaves(doj, 2027, 3)).toBe(1);
      expect(calculateMonthlyAccruedPaidLeaves(doj, 2027, 4)).toBe(2);
      expect(calculateMonthlyAccruedPaidLeaves(doj, 2027, 12)).toBe(10);
    });

    it('returns 0 when dateOfJoining is null (TS-LV-008)', () => {
      expect(calculateMonthlyAccruedPaidLeaves(null, 2026, 11)).toBe(0);
    });
  });

  describe('Leave Service & Balance Integration (TS-LV-007, TS-LV-008, TS-BAL-002)', () => {
    it('returns 0 accrued and hasJoiningDate=false when user dateOfJoining is null', async () => {
      await prisma.user.update({ where: { id: brokerId }, data: { dateOfJoining: null } });

      const my = await getMyLeaves(brokerId, 2026);
      expect(my.hasJoiningDate).toBe(false);
      const paidBal = my.balances.find((b) => b.leaveType.code === 'PAID');
      expect(paidBal?.entitledDays).toBe(0);
      expect(paidBal?.remainingDays).toBe(0);

      const attempt = await submitLeaveRequest(brokerId, {
        leaveTypeCode: 'PAID',
        startDate: '2026-12-07',
        endDate: '2026-12-07',
        reason: 'No joining date',
      });
      expect(attempt.success).toBe(false);
      if (!attempt.success) {
        expect(attempt.error.code).toBe('LV_INSUFFICIENT_BALANCE');
      }
    });

    it('allows Nov 30 - Dec 2 (3 weekdays) when Oct 1 + Nov 1 = 2 and Dec 1 gives 3rd leave, blocks Nov-only 3 days, deducts & restores cleanly', async () => {
      // Joined 2026-07-10 (<= 15th): wait Jul, Aug, Sep -> accrual begins Oct 1 (Oct=1, Nov=2, Dec=3)
      await prisma.user.update({
        where: { id: brokerId },
        data: { dateOfJoining: new Date('2026-07-10') },
      });

      const asOfNov = await getEmployeeLeaveBalances(brokerId, 2026, { asOfMonth: 11 });
      const novPaid = asOfNov.find((b) => b.leaveType.code === 'PAID');
      expect(novPaid?.entitledDays).toBe(2);
      expect(novPaid?.remainingDays).toBe(2);

      // 3 weekdays strictly inside November (Nov 25, 26, 27) -> blocked (only 2 accrued in Nov)
      const novOnlyFail = await submitLeaveRequest(brokerId, {
        leaveTypeCode: 'PAID',
        startDate: '2026-11-25',
        endDate: '2026-11-27',
        reason: '3 days in Nov only',
      });
      expect(novOnlyFail.success).toBe(false);
      if (!novOnlyFail.success) {
        expect(novOnlyFail.error.code).toBe('LV_INSUFFICIENT_BALANCE');
      }

      // 3 weekdays spanning Nov 30, Dec 1, Dec 2 -> maxMonth is 12 -> 3 accrued -> succeeds!
      const crossMonthOk = await submitLeaveRequest(brokerId, {
        leaveTypeCode: 'PAID',
        startDate: '2026-11-30',
        endDate: '2026-12-02',
        reason: 'Month boundary 3-day leave',
      });
      expect(crossMonthOk.success).toBe(true);
      if (!crossMonthOk.success) return;
      expect(crossMonthOk.leave.totalDays).toBe(3);

      // Attempting another Dec leave immediately fails because pending 3 days consumed December's credit
      const doubleSpend = await submitLeaveRequest(brokerId, {
        leaveTypeCode: 'PAID',
        startDate: '2026-12-07',
        endDate: '2026-12-07',
        reason: 'Should fail after pending deduction',
      });
      expect(doubleSpend.success).toBe(false);

      // Cancel restores credit -> can re-apply or approve
      const cancelled = await cancelMyLeave(brokerId, crossMonthOk.leave.id);
      expect(cancelled.success).toBe(true);

      const reapplied = await submitLeaveRequest(brokerId, {
        leaveTypeCode: 'PAID',
        startDate: '2026-11-30',
        endDate: '2026-12-02',
        reason: 'Re-submitted for approval',
      });
      expect(reapplied.success).toBe(true);
      if (!reapplied.success) return;

      const approved = await approveLeaveRequest(reapplied.leave.id, adminId, 'Approved');
      expect(approved.success).toBe(true);
    });

    it('carries forward unused monthly accrued + admin adjusted days into next year when allowCarryForward=true', async () => {
      // Joined 2025-11-16 -> starts Mar 2026 (Mar..Dec 2026 = 10 earned)
      await prisma.user.update({
        where: { id: brokerId },
        data: { dateOfJoining: new Date('2025-11-16') },
      });

      await prisma.leaveTypeConfig.update({
        where: { id: paidLeaveId },
        data: { allowCarryForward: true, maxCarryForwardDays: 6 },
      });

      // Grant +2 adjustment (total 2026 = 12) and approve 3 days (9 unused, capped at 6)
      await adjustEmployeeLeaveBalance({
        userId: brokerId,
        leaveTypeId: paidLeaveId,
        year: 2026,
        adjustedDays: 2,
        notes: 'Comp-off',
      });

      const req = await submitLeaveRequest(brokerId, {
        leaveTypeId: paidLeaveId,
        startDate: '2026-12-07',
        endDate: '2026-12-09',
        reason: 'Year-end trip',
      });
      expect(req.success).toBe(true);
      if (req.success) {
        await approveLeaveRequest(req.leave.id, adminId);
      }

      const roll1 = await runCarryForwardRollover(2026, 2027, brokerId);
      expect(roll1.success).toBe(true);
      const roll2 = await runCarryForwardRollover(2026, 2027, brokerId);
      expect(roll2.success).toBe(true);

      const jan2027 = await getEmployeeLeaveBalances(brokerId, 2027, { asOfMonth: 1 });
      const paid2027 = jan2027.find((b) => b.leaveType.code === 'PAID');
      expect(paid2027?.entitledDays).toBe(1); // +1 for Jan 2027
      expect(paid2027?.carriedForwardDays).toBe(6); // capped from 9 unused
      expect(paid2027?.remainingDays).toBe(7); // 1 + 6
    });
  });
});
