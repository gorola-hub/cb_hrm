import { findActiveAttendanceByUserId } from '@/repository/attendance.repository';
import {
  findActiveBreakForAttendance,
  createBreakRecord,
  closeBreakRecordInTransaction,
} from '@/repository/break.repository';
import { BreakRecord } from '@prisma/client';

export type StartBreakResult =
  | {
      success: true;
      breakRecord: BreakRecord;
    }
  | {
      success: false;
      error: {
        code: string;
        message: string;
      };
    };

export type EndBreakResult =
  | {
      success: true;
      breakRecord: BreakRecord;
      totalBreakMinutes: number;
    }
  | {
      success: false;
      error: {
        code: string;
        message: string;
      };
    };

/**
 * Initiates an unconstrained break during an active shift (Rule BR-BRK-001/002).
 */
export async function startBreak(userId: string, breakTime: Date = new Date()): Promise<StartBreakResult> {
  const activeShift = await findActiveAttendanceByUserId(userId);
  if (!activeShift) {
    return {
      success: false,
      error: {
        code: 'ATT_NO_ACTIVE_SHIFT',
        message: 'No active shift found to punch out or record a break.',
      },
    };
  }

  const existingBreak = await findActiveBreakForAttendance(activeShift.id);
  if (existingBreak) {
    return {
      success: false,
      error: {
        code: 'BRK_ALREADY_ON_BREAK',
        message: 'You are already on an active break. Please resume work before starting a new break.',
      },
    };
  }

  const breakRecord = await createBreakRecord(activeShift.id, breakTime);
  return {
    success: true,
    breakRecord,
  };
}

/**
 * Resumes work from an active break, computing duration and updating cumulative break minutes.
 */
export async function endBreak(userId: string, resumeTime: Date = new Date()): Promise<EndBreakResult> {
  const activeShift = await findActiveAttendanceByUserId(userId);
  if (!activeShift) {
    return {
      success: false,
      error: {
        code: 'ATT_NO_ACTIVE_SHIFT',
        message: 'No active shift found to punch out or record a break.',
      },
    };
  }

  const activeBreak = await findActiveBreakForAttendance(activeShift.id);
  if (!activeBreak) {
    return {
      success: false,
      error: {
        code: 'BRK_NOT_ON_BREAK',
        message: 'You are not currently on break.',
      },
    };
  }

  const durationMinutes = Math.max(
    0,
    Math.round((resumeTime.getTime() - activeBreak.breakStart.getTime()) / 60000)
  );

  const { breakRecord, attendanceRecord } = await closeBreakRecordInTransaction(
    activeBreak.id,
    activeShift.id,
    resumeTime,
    durationMinutes
  );

  return {
    success: true,
    breakRecord,
    totalBreakMinutes: attendanceRecord.totalBreakMinutes,
  };
}

export async function getCurrentBreakState(userId: string) {
  const activeShift = await findActiveAttendanceByUserId(userId);
  if (!activeShift) {
    return {
      isOnBreak: false,
      activeBreak: null,
    };
  }

  const activeBreak = await findActiveBreakForAttendance(activeShift.id);
  return {
    isOnBreak: !!activeBreak,
    activeBreak,
  };
}

