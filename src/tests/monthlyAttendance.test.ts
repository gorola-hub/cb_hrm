import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { getMonthlyAttendance } from '@/service/attendance.service';
import { prisma } from '@/lib/prisma';

describe('Monthly Attendance Calendar & KPI Calculations', () => {
  let testUserId: string;

  beforeEach(async () => {
    const broker = await prisma.user.findFirst({
      where: { email: 'broker@capitalbridgelogistics.com' },
    });

    if (!broker) {
      throw new Error('Test broker does not exist. Please run seed.');
    }

    testUserId = broker.id;

    // Clean up test attendance records
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

  it('TS-CAL-001: Returns all days of the month with populated attendance and KPI summary', async () => {
    // Insert mock attendance records for November 2026
    // Nov 2, 2026 (Monday): Present (510 mins net)
    await prisma.attendanceRecord.create({
      data: {
        userId: testUserId,
        workDate: '2026-11-02',
        firstPunchIn: new Date('2026-11-02T13:30:00.000Z'),
        lastPunchOut: new Date('2026-11-02T22:00:00.000Z'),
        grossMinutes: 510,
        totalBreakMinutes: 0,
        netWorkMinutes: 510,
        status: 'P',
        isLate: false,
        lateMinutes: 0,
      },
    });

    // Nov 3, 2026 (Tuesday): Half Day (360 mins net), Late 25 mins
    await prisma.attendanceRecord.create({
      data: {
        userId: testUserId,
        workDate: '2026-11-03',
        firstPunchIn: new Date('2026-11-03T14:25:00.000Z'),
        lastPunchOut: new Date('2026-11-03T20:25:00.000Z'),
        grossMinutes: 360,
        totalBreakMinutes: 0,
        netWorkMinutes: 360,
        status: 'HD',
        isLate: true,
        lateMinutes: 25,
      },
    });

    // Nov 4, 2026 (Wednesday): Absent (180 mins net)
    await prisma.attendanceRecord.create({
      data: {
        userId: testUserId,
        workDate: '2026-11-04',
        firstPunchIn: new Date('2026-11-04T13:30:00.000Z'),
        lastPunchOut: new Date('2026-11-04T16:30:00.000Z'),
        grossMinutes: 180,
        totalBreakMinutes: 0,
        netWorkMinutes: 180,
        status: 'A',
        isLate: false,
        lateMinutes: 0,
      },
    });

    const result = await getMonthlyAttendance(testUserId, '2026-11');

    expect(result.yearMonth).toBe('2026-11');
    expect(result.days).toHaveLength(30); // November has 30 days

    // Check Day 2 (Present)
    const day2 = result.days.find((d) => d.date === '2026-11-02');
    expect(day2).toBeDefined();
    expect(day2?.status).toBe('P');
    expect(day2?.netWorkMinutes).toBe(510);
    expect(day2?.isLate).toBe(false);

    // Check Day 3 (Half Day, Late)
    const day3 = result.days.find((d) => d.date === '2026-11-03');
    expect(day3).toBeDefined();
    expect(day3?.status).toBe('HD');
    expect(day3?.netWorkMinutes).toBe(360);
    expect(day3?.isLate).toBe(true);
    expect(day3?.lateMinutes).toBe(25);

    // Check Day 4 (Absent)
    const day4 = result.days.find((d) => d.date === '2026-11-04');
    expect(day4).toBeDefined();
    expect(day4?.status).toBe('A');
    expect(day4?.netWorkMinutes).toBe(180);

    // Check Weekend days default to 'WO' (Week Off)
    // Nov 1, 2026 is Sunday
    const day1 = result.days.find((d) => d.date === '2026-11-01');
    expect(day1?.status).toBe('WO');
    expect(day1?.isWeekend).toBe(true);

    // Nov 7, 2026 is Saturday
    const day7 = result.days.find((d) => d.date === '2026-11-07');
    expect(day7?.status).toBe('WO');
    expect(day7?.isWeekend).toBe(true);

    // Check KPI summary counts
    expect(result.summary.presentCount).toBe(1);
    expect(result.summary.halfDayCount).toBe(1);
    expect(result.summary.lateCount).toBe(1);
    expect(result.summary.totalNetMinutes).toBe(1050);
  });
});

