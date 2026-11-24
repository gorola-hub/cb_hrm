import {
  findActiveAttendanceByUserId,
  findAttendanceByUserIdAndWorkDate,
  getUserActiveShift,
  createAttendanceRecord,
  closeAttendanceRecord,
} from '@/repository/attendance.repository';
import { findActiveBreakForAttendance } from '@/repository/break.repository';
import { prisma } from '@/lib/prisma';
import {
  getISTDateString,
  parseShiftStartInIST,
  evaluateShiftTimeliness,
  evaluateAttendanceStatus,
} from '@/lib/dateUtils';
import { AttendanceRecord, Shift } from '@prisma/client';

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

  // 3. Prevent duplicate attendance for the same workDate
  const existingRecordForDate = await findAttendanceByUserIdAndWorkDate(userId, workDate);
  if (existingRecordForDate) {
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

  // 5. Create new attendance record
  const record = await createAttendanceRecord({
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
  if (todayRecord) {
    return {
      state: 'COMPLETED',
      record: todayRecord,
    };
  }

  return {
    state: 'IDLE',
    record: null,
  };
}
