import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { punchIn, punchOut } from '@/service/attendance.service';
import { startBreak, endBreak, getCurrentBreakState } from '@/service/break.service';
import { prisma } from '@/lib/prisma';

describe('Unlimited Break Engine & State Machine (TS-BRK)', () => {
  let testUserId: string;
  // 19:00 IST on 2026-11-24 -> 13:30 UTC
  const shiftStartTime = new Date('2026-11-24T13:30:00.000Z');

  beforeEach(async () => {
    const broker = await prisma.user.findFirst({
      where: { email: 'broker@capitalbridgelogistics.com' },
    });
    if (!broker) throw new Error('Test broker not found');
    testUserId = broker.id;

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

  it('TS-BRK-001: Starts a break on an active shift', async () => {
    await punchIn(testUserId, shiftStartTime);

    // Start break at 20:00 IST (14:30 UTC)
    const breakStart = new Date('2026-11-24T14:30:00.000Z');
    const result = await startBreak(testUserId, breakStart);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.breakRecord.breakEnd).toBeNull();
      expect(result.breakRecord.durationMinutes).toBe(0);
    }

    const state = await getCurrentBreakState(testUserId);
    expect(state.isOnBreak).toBe(true);
    expect(state.activeBreak).toBeDefined();
  });

  it('TS-BRK-001b: Rejects starting break if already on break', async () => {
    await punchIn(testUserId, shiftStartTime);
    await startBreak(testUserId, new Date('2026-11-24T14:30:00.000Z'));

    const dupBreak = await startBreak(testUserId, new Date('2026-11-24T14:35:00.000Z'));
    expect(dupBreak.success).toBe(false);
    if (!dupBreak.success) {
      expect(dupBreak.error.code).toBe('BRK_ALREADY_ON_BREAK');
    }
  });

  it('TS-BRK-001c: Rejects starting break if no active shift', async () => {
    const result = await startBreak(testUserId, shiftStartTime);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('ATT_NO_ACTIVE_SHIFT');
    }
  });

  it('TS-BRK-002: Resumes work from break and increments totalBreakMinutes', async () => {
    await punchIn(testUserId, shiftStartTime);

    // Break: 14:30 UTC to 14:52 UTC (22 minutes)
    const breakStart = new Date('2026-11-24T14:30:00.000Z');
    const breakEnd = new Date('2026-11-24T14:52:00.000Z');

    await startBreak(testUserId, breakStart);
    const resumeResult = await endBreak(testUserId, breakEnd);

    expect(resumeResult.success).toBe(true);
    if (resumeResult.success) {
      expect(resumeResult.breakRecord.durationMinutes).toBe(22);
      expect(resumeResult.breakRecord.breakEnd).not.toBeNull();
      expect(resumeResult.totalBreakMinutes).toBe(22);
    }

    const state = await getCurrentBreakState(testUserId);
    expect(state.isOnBreak).toBe(false);
  });

  it('TS-BRK-002b: Rejects resuming work if not currently on break', async () => {
    await punchIn(testUserId, shiftStartTime);

    const result = await endBreak(testUserId, new Date('2026-11-24T14:30:00.000Z'));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BRK_NOT_ON_BREAK');
    }
  });

  it('TS-BRK-003: Allows unlimited consecutive breaks and accumulates total duration', async () => {
    await punchIn(testUserId, shiftStartTime);

    // Break 1: 15 mins (14:00 - 14:15 UTC)
    await startBreak(testUserId, new Date('2026-11-24T14:00:00.000Z'));
    await endBreak(testUserId, new Date('2026-11-24T14:15:00.000Z'));

    // Break 2: 10 mins (15:00 - 15:10 UTC)
    await startBreak(testUserId, new Date('2026-11-24T15:00:00.000Z'));
    await endBreak(testUserId, new Date('2026-11-24T15:10:00.000Z'));

    // Break 3: 25 mins (16:00 - 16:25 UTC)
    await startBreak(testUserId, new Date('2026-11-24T16:00:00.000Z'));
    await endBreak(testUserId, new Date('2026-11-24T16:25:00.000Z'));

    // Break 4: 12 mins (17:00 - 17:12 UTC)
    await startBreak(testUserId, new Date('2026-11-24T17:00:00.000Z'));
    const fourthBreak = await endBreak(testUserId, new Date('2026-11-24T17:12:00.000Z'));

    // Total = 15 + 10 + 25 + 12 = 62 mins
    expect(fourthBreak.success).toBe(true);
    if (fourthBreak.success) {
      expect(fourthBreak.totalBreakMinutes).toBe(62);
    }

    const attendance = await prisma.attendanceRecord.findFirst({
      where: { userId: testUserId, status: 'IN_PROGRESS' },
      include: { breaks: true },
    });
    expect(attendance?.breaks).toHaveLength(4);
    expect(attendance?.totalBreakMinutes).toBe(62);
  });

  it('TS-BRK-004: Auto-closes active break on punch-out inside a transaction', async () => {
    // Punch in at 19:00 IST (13:30 UTC)
    await punchIn(testUserId, shiftStartTime);

    // Start break at 02:45 IST (21:15 UTC)
    const breakStart = new Date('2026-11-24T21:15:00.000Z');
    await startBreak(testUserId, breakStart);

    // Punch out directly while on break at 03:30 IST (22:00 UTC) -> 45 mins break
    const punchOutTime = new Date('2026-11-24T22:00:00.000Z');
    const outResult = await punchOut(testUserId, punchOutTime);

    expect(outResult.success).toBe(true);
    if (outResult.success) {
      expect(outResult.record.totalBreakMinutes).toBe(45);
      // Gross: 13:30 to 22:00 = 510 mins. Net = 510 - 45 = 465 mins >= 450 -> Present (P)
      expect(outResult.record.grossMinutes).toBe(510);
      expect(outResult.record.netWorkMinutes).toBe(465);
      expect(outResult.record.status).toBe('P');
    }

    // Assert that the break record is closed and not orphaned
    const openBreaks = await prisma.breakRecord.findMany({
      where: { attendanceRecord: { userId: testUserId }, breakEnd: null },
    });
    expect(openBreaks).toHaveLength(0);

    const closedBreak = await prisma.breakRecord.findFirst({
      where: { attendanceRecord: { userId: testUserId } },
    });
    expect(closedBreak?.durationMinutes).toBe(45);
  });
});

