import {
  findActiveAttendanceByUserId,
  findAttendanceByUserIdAndWorkDate,
  getUserActiveShift,
  createAttendanceRecord,
  overrideLeaveAttendanceOnPunchIn,
  closeAttendanceRecord,
  findMonthlyAttendanceByUserId,
} from '@/repository/attendance.repository';
import { findActiveBreakForAttendance } from '@/repository/break.repository';
import { prisma } from '@/lib/prisma';
import {
  getISTDateString,
  parseShiftStartInIST,
  evaluateShiftTimeliness,
  evaluateAttendanceStatus,
} from '@/lib/dateUtils';
import { AttendanceRecord, Shift, BreakRecord, AttendanceStatus } from '@prisma/client';

export type AttendanceResult =
  | {
      success: true;
      record: AttendanceRecord & { shift?: Shift | null };
    }
  | {
      success: false;
      error: {
        code: string;
        message: string;
      };
    };

/**
 * Records punch-in for an employee anchored strictly to IST workDate.
 */
export async function punchIn(userId: string, punchTime: Date = new Date()): Promise<AttendanceResult> {
  // 1. Check if user already has an active shift
  const activeRecord = await findActiveAttendanceByUserId(userId);
  if (activeRecord) {
    return {
      success: false,
      error: {
        code: 'ATT_ALREADY_PUNCHED_IN',
        message: 'You already have an active shift in progress for today.',
      },
    };
  }

  // 2. Anchor workDate to the IST calendar date of first punch-in (Rule BR-IST-001)
  const workDate = getISTDateString(punchTime);

  // 3. Prevent duplicate attendance for the same workDate (Rule BR-LV-002: LV records may be overridden by punch-in)
  const existingRecordForDate = await findAttendanceByUserIdAndWorkDate(userId, workDate);
  if (existingRecordForDate && existingRecordForDate.status !== 'LV') {
    return {
      success: false,
      error: {
        code: 'ATT_ALREADY_PUNCHED_IN',
        message: 'You already have an active shift in progress for today.',
      },
    };
  }

  // 4. Retrieve user's assigned shift schedule
  const assignedShift = await getUserActiveShift(userId);

  let isLate = false;
  let lateMinutes = 0;

  if (assignedShift) {
    const scheduledStartUtc = parseShiftStartInIST(workDate, assignedShift.startTime);
    const evaluation = evaluateShiftTimeliness(
      punchTime,
      scheduledStartUtc,
      assignedShift.graceMinutes,
      120 // Rule BR-IST-002: 120-minute early arrival window
    );

    if (!evaluation.allowed && evaluation.reason === 'TOO_EARLY') {
      return {
        success: false,
        error: {
          code: 'ATT_TOO_EARLY',
          message: 'Punches are only allowed up to 120 minutes before scheduled shift start.',
        },
      };
    }

    isLate = evaluation.isLate;
    lateMinutes = evaluation.lateMinutes;
  }

  // 5. Override approved leave record or create new attendance record
  const record =
    existingRecordForDate?.status === 'LV'
      ? await overrideLeaveAttendanceOnPunchIn(existingRecordForDate.id, {
          shiftId: assignedShift?.id || null,
          firstPunchIn: punchTime,
          isLate,
          lateMinutes,
        })
      : await createAttendanceRecord({
          userId,
          shiftId: assignedShift?.id || null,
          workDate,
          firstPunchIn: punchTime,
          isLate,
          lateMinutes,
          status: 'IN_PROGRESS',
        });

  return {
    success: true,
    record,
  };
}

/**
 * Seals the active shift, calculates gross and net working minutes, and evaluates final status.
 * Includes Rule BR-BRK-002 auto-close: if punch-out occurs while on break, active break is ended atomically in a transaction.
 */
export async function punchOut(userId: string, punchTime: Date = new Date()): Promise<AttendanceResult> {
  // 1. Find active attendance record
  const activeRecord = await findActiveAttendanceByUserId(userId);
  if (!activeRecord) {
    return {
      success: false,
      error: {
        code: 'ATT_NO_ACTIVE_SHIFT',
        message: 'No active shift found to punch out or record a break.',
      },
    };
  }

  // 2. Check if employee is actively on break (Rule BR-BRK-002 auto-close)
  const openBreak = await findActiveBreakForAttendance(activeRecord.id);

  if (openBreak) {
    // Transactional auto-close (NFR-REL-002)
    const result = await prisma.$transaction(async (tx) => {
      const breakDuration = Math.max(
        0,
        Math.round((punchTime.getTime() - openBreak.breakStart.getTime()) / 60000)
      );

      // Close the open break record
      await tx.breakRecord.update({
        where: { id: openBreak.id },
        data: {
          breakEnd: punchTime,
          durationMinutes: breakDuration,
        },
      });

      const totalBreakMinutes = (activeRecord.totalBreakMinutes || 0) + breakDuration;
      const grossMinutes = Math.max(
        0,
        Math.round((punchTime.getTime() - activeRecord.firstPunchIn.getTime()) / 60000)
      );
      const netWorkMinutes = Math.max(0, grossMinutes - totalBreakMinutes);
      const finalStatus = evaluateAttendanceStatus(netWorkMinutes);

      const updatedRecord = await tx.attendanceRecord.update({
        where: { id: activeRecord.id },
        data: {
          lastPunchOut: punchTime,
          grossMinutes,
          totalBreakMinutes,
          netWorkMinutes,
          status: finalStatus,
        },
        include: {
          shift: true,
          breaks: true,
        },
      });

      return updatedRecord;
    });

    return {
      success: true,
      record: result,
    };
  }

  // Standard punch-out (not on break)
  const grossMinutes = Math.max(
    0,
    Math.round((punchTime.getTime() - activeRecord.firstPunchIn.getTime()) / 60000)
  );
  const totalBreakMinutes = activeRecord.totalBreakMinutes || 0;
  const netWorkMinutes = Math.max(0, grossMinutes - totalBreakMinutes);
  const finalStatus = evaluateAttendanceStatus(netWorkMinutes);

  const updatedRecord = await closeAttendanceRecord(activeRecord.id, {
    lastPunchOut: punchTime,
    grossMinutes,
    totalBreakMinutes,
    netWorkMinutes,
    status: finalStatus,
  });

  return {
    success: true,
    record: updatedRecord,
  };
}

export async function getTodayShiftState(userId: string) {
  const activeRecord = await findActiveAttendanceByUserId(userId);
  if (activeRecord) {
    return {
      state: 'ACTIVE',
      record: activeRecord,
    };
  }

  const todayIST = getISTDateString();
  const todayRecord = await findAttendanceByUserIdAndWorkDate(userId, todayIST);
  if (todayRecord && todayRecord.status !== 'LV') {
    return {
      state: 'COMPLETED',
      record: todayRecord,
    };
  }

  return {
    state: 'IDLE',
    record: todayRecord ?? null,
  };
}

export interface MonthDayAttendance {
  date: string; // YYYY-MM-DD
  dayNumber: number; // 1-31
  dayOfWeek: string; // Sunday, Monday, etc.
  isWeekend: boolean;
  status: AttendanceStatus | 'WO' | null;
  isLate: boolean;
  lateMinutes: number;
  grossMinutes: number;
  totalBreakMinutes: number;
  netWorkMinutes: number;
  firstPunchIn: Date | null;
  lastPunchOut: Date | null;
  isRegularized: boolean;
  shift?: Shift | null;
  breaks?: BreakRecord[];
}

export interface MonthlyAttendanceSummary {
  totalDays: number;
  presentCount: number;
  halfDayCount: number;
  absentCount: number;
  leaveCount: number;
  weekOffCount: number;
  lateCount: number;
  totalNetMinutes: number;
  totalGrossMinutes: number;
}

export interface MonthlyAttendanceResponse {
  yearMonth: string;
  days: MonthDayAttendance[];
  summary: MonthlyAttendanceSummary;
}

/**
 * Retrieves full monthly attendance calendar grid and KPI summary for an employee.
 */
export async function getMonthlyAttendance(
  userId: string,
  yearMonth: string
): Promise<MonthlyAttendanceResponse> {
  const [yearStr, monthStr] = yearMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const startWorkDate = `${yearStr}-${monthStr.padStart(2, '0')}-01`;
  const endWorkDate = `${yearStr}-${monthStr.padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

  const records = await findMonthlyAttendanceByUserId(userId, startWorkDate, endWorkDate);
  const recordMap = new Map<string, (typeof records)[0]>();
  for (const r of records) {
    recordMap.set(r.workDate, r);
  }

  const todayIST = getISTDateString();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const days: MonthDayAttendance[] = [];
  const summary: MonthlyAttendanceSummary = {
    totalDays: daysInMonth,
    presentCount: 0,
    halfDayCount: 0,
    absentCount: 0,
    leaveCount: 0,
    weekOffCount: 0,
    lateCount: 0,
    totalNetMinutes: 0,
    totalGrossMinutes: 0,
  };

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${yearStr}-${monthStr.padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayDate = new Date(`${dateStr}T12:00:00.000Z`);
    const dayOfWeekIndex = dayDate.getUTCDay();
    const dayOfWeek = dayNames[dayOfWeekIndex];
    const isWeekend = dayOfWeekIndex === 0 || dayOfWeekIndex === 6;

    const existing = recordMap.get(dateStr);

    if (existing) {
      days.push({
        date: dateStr,
        dayNumber: day,
        dayOfWeek,
        isWeekend,
        status: existing.status,
        isLate: existing.isLate,
        lateMinutes: existing.lateMinutes,
        grossMinutes: existing.grossMinutes,
        totalBreakMinutes: existing.totalBreakMinutes,
        netWorkMinutes: existing.netWorkMinutes,
        firstPunchIn: existing.firstPunchIn,
        lastPunchOut: existing.lastPunchOut,
        isRegularized: existing.isRegularized,
        shift: existing.shift,
        breaks: existing.breaks,
      });

      if (existing.status === 'P') summary.presentCount++;
      else if (existing.status === 'HD') summary.halfDayCount++;
      else if (existing.status === 'A') summary.absentCount++;
      else if (existing.status === 'LV') summary.leaveCount++;
      else if (existing.status === 'WO') summary.weekOffCount++;

      if (existing.isLate) summary.lateCount++;
      summary.totalNetMinutes += existing.netWorkMinutes;
      summary.totalGrossMinutes += existing.grossMinutes;
    } else {
      let status: AttendanceStatus | 'WO' | null = null;
      if (isWeekend) {
        status = 'WO';
        summary.weekOffCount++;
      } else if (dateStr < todayIST) {
        status = 'A';
        summary.absentCount++;
      }

      days.push({
        date: dateStr,
        dayNumber: day,
        dayOfWeek,
        isWeekend,
        status,
        isLate: false,
        lateMinutes: 0,
        grossMinutes: 0,
        totalBreakMinutes: 0,
        netWorkMinutes: 0,
        firstPunchIn: null,
        lastPunchOut: null,
        isRegularized: false,
      });
    }
  }

  return {
    yearMonth,
    days,
    summary,
  };
}
