import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  markStaleShifts,
  getLiveRoster,
  regularizeAttendance,
  getAttendanceAuditLogs,
} from '@/service/adminAttendance.service';
import { prisma } from '@/lib/prisma';

describe('Admin Attendance Command Center & Regularization (Phase 8)', () => {
  let brokerId: string;
  let adminId: string;

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
    if (adminId) {
      await prisma.attendanceAuditLog.deleteMany({
        where: { attendanceRecord: { userId: adminId } },
      });
      await prisma.breakRecord.deleteMany({
        where: { attendanceRecord: { userId: adminId } },
      });
      await prisma.attendanceRecord.deleteMany({
        where: { userId: adminId },
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
    adminId = admin.id;
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('TS-STALE-001: Marks IN_PROGRESS shifts > 16 hours old as ANOMALY_STALE without inventing punch-out', async () => {
    // Shift 1: punched in 17 hours before referenceTime
    const referenceTime = new Date('2026-11-26T15:00:00.000Z');
    const seventeenHoursAgo = new Date(referenceTime.getTime() - 17 * 60 * 60 * 1000);
    const tenHoursAgo = new Date(referenceTime.getTime() - 10 * 60 * 60 * 1000);

    const staleRec = await prisma.attendanceRecord.create({
      data: {
        userId: brokerId,
        workDate: '2026-11-25',
        firstPunchIn: seventeenHoursAgo,
        status: 'IN_PROGRESS',
      },
    });

    const freshRec = await prisma.attendanceRecord.create({
      data: {
        userId: adminId,
        workDate: '2026-11-26',
        firstPunchIn: tenHoursAgo,
        status: 'IN_PROGRESS',
      },
    });

    const result = await markStaleShifts(referenceTime);
    expect(result.markedCount).toBe(1);
    expect(result.markedIds).toContain(staleRec.id);

    const updatedStale = await prisma.attendanceRecord.findUnique({ where: { id: staleRec.id } });
    const updatedFresh = await prisma.attendanceRecord.findUnique({ where: { id: freshRec.id } });

    expect(updatedStale?.status).toBe('ANOMALY_STALE');
    expect(updatedStale?.lastPunchOut).toBeNull();
    expect(updatedFresh?.status).toBe('IN_PROGRESS');
  });

  it('FR-ADM-001 & FR-ADM-002: Returns live roster KPIs, break states, and supports multi-filtering', async () => {
    const workDate = '2026-11-26';
    const shift = await prisma.shift.findUnique({ where: { code: 'SHIFT_1900' } });

    // Broker is ON_BREAK and Late
    const brokerAtt = await prisma.attendanceRecord.create({
      data: {
        userId: brokerId,
        shiftId: shift?.id ?? null,
        workDate,
        firstPunchIn: new Date('2026-11-26T14:00:00.000Z'), // 19:30 IST (late)
        isLate: true,
        lateMinutes: 30,
        status: 'IN_PROGRESS',
      },
    });
    await prisma.breakRecord.create({
      data: {
        attendanceRecordId: brokerAtt.id,
        breakStart: new Date('2026-11-26T14:30:00.000Z'),
      },
    });

    // Admin is on Approved Leave
    await prisma.attendanceRecord.create({
      data: {
        userId: adminId,
        workDate,
        firstPunchIn: new Date('2026-11-25T18:30:00.000Z'),
        status: 'LV',
      },
    });

    const allRoster = await getLiveRoster({
      date: workDate,
      referenceTime: new Date('2026-11-26T15:00:00.000Z'),
    });

    expect(allRoster.workDate).toBe(workDate);
    expect(allRoster.kpis.onShiftCount).toBeGreaterThanOrEqual(1);
    expect(allRoster.kpis.onBreakCount).toBeGreaterThanOrEqual(1);
    expect(allRoster.kpis.lateCount).toBeGreaterThanOrEqual(1);
    expect(allRoster.kpis.onLeaveCount).toBeGreaterThanOrEqual(1);

    const brokerEntry = allRoster.roster.find((r) => r.user.id === brokerId);
    expect(brokerEntry?.liveState).toBe('ON_BREAK');
    expect(brokerEntry?.activeBreak).not.toBeNull();

    // Filter by status = ON_BREAK
    const onBreakFiltered = await getLiveRoster({
      date: workDate,
      status: 'ON_BREAK',
      referenceTime: new Date('2026-11-26T15:00:00.000Z'),
    });
    expect(onBreakFiltered.roster.every((r) => r.liveState === 'ON_BREAK')).toBe(true);
    expect(onBreakFiltered.roster.some((r) => r.user.id === brokerId)).toBe(true);

    // Filter by search
    const searchFiltered = await getLiveRoster({
      date: workDate,
      search: 'broker@capitalbridgelogistics.com',
      referenceTime: new Date('2026-11-26T15:00:00.000Z'),
    });
    expect(searchFiltered.roster).toHaveLength(1);
    expect(searchFiltered.roster[0].user.id).toBe(brokerId);
  });

  it('TS-REG-001: Regularizes attendance, recalculates net hours, and records immutable audit log', async () => {
    const firstIn = new Date('2026-11-24T13:30:00.000Z'); // 19:00 IST
    const rec = await prisma.attendanceRecord.create({
      data: {
        userId: brokerId,
        workDate: '2026-11-24',
        firstPunchIn: firstIn,
        totalBreakMinutes: 30,
        status: 'A',
      },
    });

    const punchOutTime = new Date('2026-11-24T22:00:00.000Z'); // 03:30 IST next day (510 gross, 480 net -> P)
    const res = await regularizeAttendance(adminId, {
      attendanceRecordId: rec.id,
      firstPunchIn: firstIn.toISOString(),
      lastPunchOut: punchOutTime.toISOString(),
      reason: 'Home power cut verified with team lead',
    });

    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.record.isRegularized).toBe(true);
    expect(res.record.status).toBe('P');
    expect(res.record.grossMinutes).toBe(510);
    expect(res.record.netWorkMinutes).toBe(480);

    const auditResult = await getAttendanceAuditLogs(rec.id);
    expect(auditResult.success).toBe(true);
    if (auditResult.success) {
      expect(auditResult.logs).toHaveLength(1);
      expect(auditResult.logs[0].adminId).toBe(adminId);
      expect(auditResult.logs[0].reason).toBe('Home power cut verified with team lead');
      expect((auditResult.logs[0].previousValues as Record<string, unknown>).status).toBe('A');
      expect((auditResult.logs[0].newValues as Record<string, unknown>).status).toBe('P');
    }
  });

  it('TS-REG-002: Rejects regularization with empty or whitespace reason', async () => {
    const rec = await prisma.attendanceRecord.create({
      data: {
        userId: brokerId,
        workDate: '2026-11-24',
        firstPunchIn: new Date('2026-11-24T13:30:00.000Z'),
        status: 'A',
      },
    });

    const res = await regularizeAttendance(adminId, {
      attendanceRecordId: rec.id,
      status: 'P',
      reason: '   ',
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.code).toBe('ADM_REGULARIZATION_REASON_REQUIRED');
      expect(res.error.message).toBe(
        'A mandatory explanation is required to edit or regularize an attendance record.'
      );
    }
  });

  it('Edge cases: regularizes missing offline record, auto-closes open break, and rejects punchOut < punchIn', async () => {
    // 1. Missing record creation + regularization
    const created = await regularizeAttendance(adminId, {
      userId: brokerId,
      workDate: '2026-11-23',
      firstPunchIn: '2026-11-23T13:30:00.000Z',
      lastPunchOut: '2026-11-23T22:00:00.000Z',
      reason: 'Biometric outage manual entry',
    });
    expect(created.success).toBe(true);
    if (!created.success) return;
    expect(created.record.isRegularized).toBe(true);
    expect(created.record.status).toBe('P');

    // 2. Open break auto-close on stale shift regularization
    const staleWithBreak = await prisma.attendanceRecord.create({
      data: {
        userId: brokerId,
        workDate: '2026-11-25',
        firstPunchIn: new Date('2026-11-25T13:30:00.000Z'),
        totalBreakMinutes: 10,
        status: 'ANOMALY_STALE',
      },
    });
    const openBrk = await prisma.breakRecord.create({
      data: {
        attendanceRecordId: staleWithBreak.id,
        breakStart: new Date('2026-11-25T21:40:00.000Z'),
      },
    });

    const closedRes = await regularizeAttendance(adminId, {
      attendanceRecordId: staleWithBreak.id,
      firstPunchIn: '2026-11-25T13:30:00.000Z',
      lastPunchOut: '2026-11-25T22:00:00.000Z', // closes 20m open break -> 30m total, 510 gross, 480 net -> P
      reason: 'Forgot to end break and punch out',
    });
    expect(closedRes.success).toBe(true);
    if (closedRes.success) {
      expect(closedRes.record.totalBreakMinutes).toBe(30);
      expect(closedRes.record.netWorkMinutes).toBe(480);
      expect(closedRes.record.status).toBe('P');
    }
    const updatedBreak = await prisma.breakRecord.findUnique({ where: { id: openBrk.id } });
    expect(updatedBreak?.breakEnd).not.toBeNull();
    expect(updatedBreak?.durationMinutes).toBe(20);

    // 3. Invalid punchOut < punchIn
    const badTime = await regularizeAttendance(adminId, {
      attendanceRecordId: staleWithBreak.id,
      firstPunchIn: '2026-11-25T22:00:00.000Z',
      lastPunchOut: '2026-11-25T13:30:00.000Z',
      reason: 'Invalid timestamps test',
    });
    expect(badTime.success).toBe(false);
  });
});

