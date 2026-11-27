import { formatInTimeZone } from 'date-fns-tz';

export const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Returns the current or provided date formatted as YYYY-MM-DD in Indian Standard Time (IST).
 * Rule BR-IST-001: workDate is strictly anchored to this value.
 */
export function getISTDateString(date: Date = new Date()): string {
  return formatInTimeZone(date, IST_TIMEZONE, 'yyyy-MM-dd');
}

/**
 * Returns the 24-hr time formatted as HH:mm in IST.
 */
export function getISTTimeString(date: Date = new Date()): string {
  return formatInTimeZone(date, IST_TIMEZONE, 'HH:mm');
}

/**
 * Converts a workDate (YYYY-MM-DD) and a 24-hr IST time string (e.g. "19:00") into a JavaScript Date object (in UTC).
 */
export function parseShiftStartInIST(workDate: string, startTimeStr: string): Date {
  return new Date(`${workDate}T${startTimeStr}:00+05:30`);
}

export interface ShiftTimelinessEvaluation {
  allowed: boolean;
  reason?: 'TOO_EARLY';
  isLate: boolean;
  lateMinutes: number;
}

/**
 * Evaluates punch-in time against scheduled start in IST.
 * Rule BR-IST-002: Up to 120 minutes early allowed without penalty.
 * Rule BR-IST-003: Grace period (default 15 minutes). Beyond grace -> isLate = true, lateMinutes calculated from scheduled start.
 */
export function evaluateShiftTimeliness(
  punchInUtc: Date,
  scheduledStartUtc: Date,
  graceMinutes: number = 15,
  earlyLimitMinutes: number = 120
): ShiftTimelinessEvaluation {
  const diffMinutes = Math.round((punchInUtc.getTime() - scheduledStartUtc.getTime()) / 60000);

  // If earlier than earlyLimitMinutes (e.g. 130 mins early -> diffMinutes = -130 < -120)
  if (diffMinutes < -earlyLimitMinutes) {
    return {
      allowed: false,
      reason: 'TOO_EARLY',
      isLate: false,
      lateMinutes: 0,
    };
  }

  // If on-time or early or within grace window (e.g. diffMinutes <= 15)
  if (diffMinutes <= graceMinutes) {
    return {
      allowed: true,
      isLate: false,
      lateMinutes: 0,
    };
  }

  // Late beyond grace
  return {
    allowed: true,
    isLate: true,
    lateMinutes: diffMinutes,
  };
}

/**
 * Evaluates net working minutes on punch-out.
 * Rule BR-ATT-002:
 * Net >= 450 mins (7.5 hrs) -> P (Present)
 * 300 <= Net < 450 mins (5.0 - 7.5 hrs) -> HD (Half Day)
 * Net < 300 mins (< 5.0 hrs) -> A (Absent)
 */
export function evaluateAttendanceStatus(netWorkMinutes: number): 'P' | 'HD' | 'A' {
  if (netWorkMinutes >= 450) {
    return 'P';
  }
  if (netWorkMinutes >= 300) {
    return 'HD';
  }
  return 'A';
}

/**
 * Calculates monthly accrued Paid Leaves (+1 on the 1st of each eligible month in IST)
 * after a 3-month post-joining waiting period (Decision 11):
 * - Joined on/before 15th (day <= 15): waiting period includes joining month -> starts joiningMonth + 3
 * - Joined after 15th (day > 15): joining month excluded -> starts joiningMonth + 4
 * - Missing joining date (null/undefined): returns 0
 */
export function calculateMonthlyAccruedPaidLeaves(
  dateOfJoining: Date | null | undefined,
  targetYear: number,
  asOfMonth?: number
): number {
  if (!dateOfJoining || !Number.isInteger(targetYear)) {
    return 0;
  }

  const joinDateStr = getISTDateString(dateOfJoining);
  const [joinYearStr, joinMonthStr, joinDayStr] = joinDateStr.split('-');
  const joinYear = parseInt(joinYearStr, 10);
  const joinMonth = parseInt(joinMonthStr, 10);
  const joinDay = parseInt(joinDayStr, 10);

  if (!Number.isInteger(joinYear) || !Number.isInteger(joinMonth) || !Number.isInteger(joinDay)) {
    return 0;
  }

  const joinMonthIndex = joinYear * 12 + (joinMonth - 1);
  const probationMonthsOffset = joinDay <= 15 ? 3 : 4;
  const eligibleStartMonthIndex = joinMonthIndex + probationMonthsOffset;

  let defaultLimitMonth: number;
  if (asOfMonth !== undefined) {
    defaultLimitMonth = asOfMonth;
  } else {
    const todayIST = getISTDateString();
    const curYear = parseInt(todayIST.slice(0, 4), 10);
    const curMonth = parseInt(todayIST.slice(5, 7), 10);
    if (targetYear < curYear) {
      defaultLimitMonth = 12;
    } else if (targetYear === curYear) {
      defaultLimitMonth = curMonth;
    } else {
      defaultLimitMonth = 0;
    }
  }

  const limitMonth = Math.max(0, Math.min(12, Math.trunc(defaultLimitMonth)));
  let accrued = 0;
  for (let m = 1; m <= limitMonth; m++) {
    const monthIndex = targetYear * 12 + (m - 1);
    if (monthIndex >= eligibleStartMonthIndex) {
      accrued++;
    }
  }

  return accrued;
}

