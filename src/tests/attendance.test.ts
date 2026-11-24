import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { punchIn, punchOut, getTodayShiftState } from '@/service/attendance.service';
import { prisma } from '@/lib/prisma';
import { toZonedTime } from 'date-fns-tz';

const IST_TIMEZONE = 'Asia/Kolkata';

describe('IST Night-Shift Engine & Attendance Punch-In/Out Core', () => {
  let testUserId: string;

  beforeEach(async () => {
    // Find or ensure test broker exists with assigned SHIFT_1900
    const broker = await prisma.user.findFirst({
      where: { email: 'broker@capitalbridgelogistics.com' },
      include: { employeeShifts: { include: { shift: true } } },
    });

    if (!broker) {
      throw new Error('Test broker does not exist. Please run seed.');
    }

    testUserId = broker.id;

    // Clean up any test attendance records for this user
    await prisma.breakRecord.deleteMany({
      where: { attendanceRecord: { userId: testUserId } },
    });
    await prisma.attendanceRecord.deleteMany({
      where: { userId: testUserId },
    });
  });

  afterAll(async () => {
    await prisma.breakRecord.deleteMany({
      where: { attendanceRecord: { userId: testUserId } },
    });
    await prisma.attendanceRecord.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.$disconnect();
  });

  it('TS-ATT-001: On-time punch-in within grace window anchors workDate to IST date', async () => {
    // 2026-11-24 18:55 IST (13:25 UTC)
    const punchTime = new Date('2026-11-24T13:25:00.000Z');

    const result = await punchIn(testUserId, punchTime);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.record.workDate).toBe('2026-11-24');
      expect(result.record.status).toBe('IN_PROGRESS');
      expect(result.record.isLate).toBe(false);
      expect(result.record.lateMinutes).toBe(0);
      expect(result.record.grossMinutes).toBe(0);
    }
  });

  it('TS-ATT-002: Early arrival up to 120 minutes before shift succeeds with isLate = false', async () => {
    // 2026-11-24 17:15 IST (105 minutes before 19:00 IST start) -> 11:45 UTC
    const earlyPunch = new Date('2026-11-24T11:45:00.000Z');

    const result = await punchIn(testUserId, earlyPunch);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.record.workDate).toBe('2026-11-24');
      expect(result.record.isLate).toBe(false);
      expect(result.record.lateMinutes).toBe(0);
    }
  });

  it('TS-ATT-002b: Rejects punch-in earlier than 120 minutes before shift', async () => {
    // 2026-11-24 16:45 IST (135 mins before 19:00 IST) -> 11:15 UTC
    const tooEarlyPunch = new Date('2026-11-24T11:15:00.000Z');

    const result = await punchIn(testUserId, tooEarlyPunch);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('ATT_TOO_EARLY');
    }
  });

  it('TS-ATT-003: Late punch-in beyond 15-minute grace records isLate = true and lateMinutes', async () => {
    // 2026-11-24 19:35 IST (35 mins after 19:00 IST, past 19:15 grace) -> 14:05 UTC
    const latePunch = new Date('2026-11-24T14:05:00.000Z');

    const result = await punchIn(testUserId, latePunch);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.record.isLate).toBe(true);
      expect(result.record.lateMinutes).toBe(35);
    }
  });

  it('TS-ATT-004: Rejects duplicate punch-in when shift is already active', async () => {
    const punchTime = new Date('2026-11-24T13:25:00.000Z');
    await punchIn(testUserId, punchTime);

    const duplicatePunch = await punchIn(testUserId, new Date('2026-11-24T13:30:00.000Z'));
    expect(duplicatePunch.success).toBe(false);
    if (!duplicatePunch.success) {
      expect(duplicatePunch.error.code).toBe('ATT_ALREADY_PUNCHED_IN');
    }
  });

  it('TS-DATE-001: Shift crossing midnight permanently preserves first punch-in workDate', async () => {
    // In: 2026-10-31 18:50 IST (13:20 UTC)
    const inTime = new Date('2026-10-31T13:20:00.000Z');
    const inResult = await punchIn(testUserId, inTime);
    expect(inResult.success).toBe(true);
    if (!inResult.success) return;

    expect(inResult.record.workDate).toBe('2026-10-31');

    // Out: 2026-11-01 03:35 IST (2026-10-31 22:05 UTC)
    const outTime = new Date('2026-10-31T22:05:00.000Z');
    const outResult = await punchOut(testUserId, outTime);
    expect(outResult.success).toBe(true);
    if (outResult.success) {
      expect(outResult.record.workDate).toBe('2026-10-31');
      expect(outResult.record.grossMinutes).toBe(525);
      expect(outResult.record.netWorkMinutes).toBe(525);
      expect(outResult.record.status).toBe('P');
    }

    // Verify database row for 2026-11-01 does NOT exist
    const nov1Record = await prisma.attendanceRecord.findUnique({
      where: {
        userId_workDate: {
          userId: testUserId,
          workDate: '2026-11-01',
        },
      },
    });
    expect(nov1Record).toBeNull();
  });

  it('TS-CALC-001: Punch-out with >= 450 net minutes evaluates to Present (P)', async () => {
    // 8 hours shift (480 mins)
    const inTime = new Date('2026-11-24T13:30:00.000Z'); // 19:00 IST
    const outTime = new Date('2026-11-24T21:30:00.000Z'); // 03:00 IST next day
    await punchIn(testUserId, inTime);

    const outResult = await punchOut(testUserId, outTime);
    expect(outResult.success).toBe(true);
    if (outResult.success) {
      expect(outResult.record.status).toBe('P');
      expect(outResult.record.netWorkMinutes).toBe(480);
    }
  });

  it('TS-CALC-002: Punch-out with 300 to 449 net minutes evaluates to Half Day (HD)', async () => {
    // 6 hours shift (360 mins)
    const inTime = new Date('2026-11-24T13:30:00.000Z');
    const outTime = new Date('2026-11-24T19:30:00.000Z');
    await punchIn(testUserId, inTime);

    const outResult = await punchOut(testUserId, outTime);
    expect(outResult.success).toBe(true);
    if (outResult.success) {
      expect(outResult.record.status).toBe('HD');
      expect(outResult.record.netWorkMinutes).toBe(360);
    }
  });

  it('TS-CALC-003: Punch-out with < 300 net minutes evaluates to Absent (A)', async () => {
    // 4 hours shift (240 mins)
    const inTime = new Date('2026-11-24T13:30:00.000Z');
    const outTime = new Date('2026-11-24T17:30:00.000Z');
    await punchIn(testUserId, inTime);

    const outResult = await punchOut(testUserId, outTime);
    expect(outResult.success).toBe(true);
    if (outResult.success) {
      expect(outResult.record.status).toBe('A');
      expect(outResult.record.netWorkMinutes).toBe(240);
    }
  });
});

