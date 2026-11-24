import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

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

