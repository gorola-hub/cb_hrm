import { LeaveStatus } from '@prisma/client';
import {
  approveLeaveInTransaction,
  cancelLeaveRequest,
  countPendingLeaves,
  createLeaveRequest,
  findAllLeaves,
  findLeaveById,
  findLeavesByUserId,
  findOverlappingLeaves,
  rejectLeaveRequest as repoRejectLeaveRequest,
} from '@/repository/leave.repository';
import { findLeaveTypeByCode, findLeaveTypeById } from '@/repository/leaveType.repository';
import {
  enumerateWeekdaysByYear,
  getEmployeeLeaveBalances,
} from '@/service/leaveBalance.service';
import { getISTDateString } from '@/lib/dateUtils';

export type LeaveRecordWithUsers = Awaited<ReturnType<typeof findLeavesByUserId>>[number];

export type LeaveServiceResult =
  | { success: true; leave: LeaveRecordWithUsers }
  | { success: false; error: { code: string; message: string; status?: number } };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidYYYYMMDD(dateStr: string): boolean {
  if (!DATE_PATTERN.test(dateStr)) return false;
  const parsed = new Date(`${dateStr}T12:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === dateStr;
}

/**
 * Enumerates all weekday (Monday-Friday) YYYY-MM-DD strings in the inclusive range.
 */
export function enumerateWeekdays(startDate: string, endDate: string): string[] {
  if (!isValidYYYYMMDD(startDate) || !isValidYYYYMMDD(endDate) || endDate < startDate) {
    return [];
  }

  const weekdays: string[] = [];
  const cursor = new Date(`${startDate}T12:00:00.000Z`);
  const end = new Date(`${endDate}T12:00:00.000Z`);

  while (cursor.getTime() <= end.getTime()) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      weekdays.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return weekdays;
}

/**
 * Calculates total working days (excluding Saturday and Sunday) in the inclusive date range.
 */
export function calculateWorkingDays(startDate: string, endDate: string): number {
  return enumerateWeekdays(startDate, endDate).length;
}

/**
 * Submits a new leave application for an employee after validating dates, reason, type, overlaps, and balances.
 */
export async function submitLeaveRequest(
  userId: string,
  input: {
    leaveTypeId?: string;
    leaveTypeCode?: string;
    startDate: string;
    endDate: string;
    reason: string;
  }
): Promise<LeaveServiceResult> {
  const trimmedReason = (input.reason ?? '').trim();
  if (!trimmedReason) {
    return {
      success: false,
      error: {
        code: 'LV_EMPTY_REASON',
        message: 'A valid reason is required when submitting a leave request.',
        status: 400,
      },
    };
  }

  if (!isValidYYYYMMDD(input.startDate) || !isValidYYYYMMDD(input.endDate)) {
    return {
      success: false,
      error: {
        code: 'LV_INVALID_DATE_RANGE',
        message: 'Please provide valid start and end dates in YYYY-MM-DD format.',
        status: 400,
      },
    };
  }

  if (input.endDate < input.startDate) {
    return {
      success: false,
      error: {
        code: 'LV_INVALID_DATE_RANGE',
        message: 'End date cannot be earlier than start date.',
        status: 400,
      },
    };
  }

  const leaveType = input.leaveTypeId
    ? await findLeaveTypeById(input.leaveTypeId)
    : input.leaveTypeCode
      ? await findLeaveTypeByCode(input.leaveTypeCode)
      : null;

  if (!leaveType || !leaveType.isActive) {
    return {
      success: false,
      error: {
        code: 'LV_TYPE_INACTIVE',
        message: 'Selected leave type is inactive or unavailable.',
        status: 400,
      },
    };
  }

  const totalDays = calculateWorkingDays(input.startDate, input.endDate);
  if (totalDays <= 0) {
    return {
      success: false,
      error: {
        code: 'LV_NO_WORKING_DAYS',
        message: 'Selected date range contains only weekend days (Saturday/Sunday).',
        status: 400,
      },
    };
  }

  const overlapping = await findOverlappingLeaves(userId, input.startDate, input.endDate);
  if (overlapping.length > 0) {
    return {
      success: false,
      error: {
        code: 'LV_OVERLAPPING_REQUEST',
        message: 'You already have an active or pending leave request covering these dates.',
        status: 409,
      },
    };
  }

  // Enforce balance per calendar year for paid leave types (unpaid types bypass balance cap)
  if (leaveType.isPaid) {
    const daysByYear = enumerateWeekdaysByYear(input.startDate, input.endDate);
    for (const [year, daysNeeded] of daysByYear.entries()) {
      const balances = await getEmployeeLeaveBalances(userId, year);
      const bucket = balances.find((b) => b.leaveType.id === leaveType.id);
      const available = bucket?.availableDays ?? 0;
      if (daysNeeded > available) {
        return {
          success: false,
          error: {
            code: 'LV_INSUFFICIENT_BALANCE',
            message: 'Insufficient leave balance for the requested dates.',
            status: 400,
          },
        };
      }
    }
  }

  const leave = await createLeaveRequest({
    userId,
    leaveTypeId: leaveType.id,
    startDate: input.startDate,
    endDate: input.endDate,
    totalDays,
    reason: trimmedReason,
  });

  return { success: true, leave };
}

/**
 * Returns an employee's leave request history and per-type balance summary for the requested IST year.
 */
export async function getMyLeaves(
  userId: string,
  year: number = parseInt(getISTDateString().slice(0, 4), 10)
) {
  const [requests, balances] = await Promise.all([
    findLeavesByUserId(userId),
    getEmployeeLeaveBalances(userId, year),
  ]);

  return {
    year,
    requests,
    balances,
  };
}

/**
 * Cancels an employee's own PENDING leave request.
 */
export async function cancelMyLeave(userId: string, leaveId: string): Promise<LeaveServiceResult> {
  const existing = await findLeaveById(leaveId);
  if (!existing || existing.userId !== userId) {
    return {
      success: false,
      error: {
        code: 'LV_NOT_FOUND',
        message: 'Leave request not found.',
        status: 404,
      },
    };
  }

  if (existing.status !== 'PENDING') {
    return {
      success: false,
      error: {
        code: 'LV_INVALID_STATUS',
        message: 'Only pending leave requests can be cancelled.',
        status: 400,
      },
    };
  }

  const leave = await cancelLeaveRequest(leaveId);
  return { success: true, leave };
}

/**
 * Lists leave requests across the company for administrators, optionally filtered by status.
 */
export async function listAdminLeaves(status?: LeaveStatus) {
  const [requests, pendingCount] = await Promise.all([
    findAllLeaves(status),
    countPendingLeaves(),
  ]);
  return { requests, pendingCount };
}

export async function getPendingLeaveCount() {
  return countPendingLeaves();
}

/**
 * Approves a PENDING leave request (re-validating balance) and marks weekday attendance as LV inside a transaction.
 */
export async function approveLeaveRequest(
  leaveId: string,
  adminId: string,
  adminNotes?: string
): Promise<LeaveServiceResult> {
  const existing = await findLeaveById(leaveId);
  if (!existing) {
    return {
      success: false,
      error: {
        code: 'LV_NOT_FOUND',
        message: 'Leave request not found.',
        status: 404,
      },
    };
  }

  if (existing.status !== 'PENDING') {
    return {
      success: false,
      error: {
        code: 'LV_INVALID_STATUS',
        message: 'Only pending leave requests can be approved.',
        status: 400,
      },
    };
  }

  if (existing.leaveType.isPaid) {
    const daysByYear = enumerateWeekdaysByYear(existing.startDate, existing.endDate);
    for (const [year, daysNeeded] of daysByYear.entries()) {
      const balances = await getEmployeeLeaveBalances(existing.userId, year);
      const bucket = balances.find((b) => b.leaveType.id === existing.leaveTypeId);
      const remaining = bucket?.remainingDays ?? 0;
      if (daysNeeded > remaining) {
        return {
          success: false,
          error: {
            code: 'LV_INSUFFICIENT_BALANCE',
            message: 'Insufficient leave balance for the requested dates.',
            status: 400,
          },
        };
      }
    }
  }

  const workDates = enumerateWeekdays(existing.startDate, existing.endDate);
  const leave = await approveLeaveInTransaction(
    leaveId,
    adminId,
    workDates,
    adminNotes?.trim() || undefined
  );

  return { success: true, leave };
}

/**
 * Rejects a PENDING leave request with mandatory administrative explanation.
 */
export async function rejectLeaveRequest(
  leaveId: string,
  adminId: string,
  adminNotes: string
): Promise<LeaveServiceResult> {
  const trimmedNotes = (adminNotes ?? '').trim();
  if (!trimmedNotes) {
    return {
      success: false,
      error: {
        code: 'LV_EMPTY_REASON',
        message: 'A valid reason is required when rejecting a leave request.',
        status: 400,
      },
    };
  }

  const existing = await findLeaveById(leaveId);
  if (!existing) {
    return {
      success: false,
      error: {
        code: 'LV_NOT_FOUND',
        message: 'Leave request not found.',
        status: 404,
      },
    };
  }

  if (existing.status !== 'PENDING') {
    return {
      success: false,
      error: {
        code: 'LV_INVALID_STATUS',
        message: 'Only pending leave requests can be rejected.',
        status: 400,
      },
    };
  }

  const leave = await repoRejectLeaveRequest(leaveId, adminId, trimmedNotes);
  return { success: true, leave };
}
