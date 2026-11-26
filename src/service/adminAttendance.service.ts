import { AttendanceStatus, BreakRecord, Prisma, Shift } from '@prisma/client';
import {
  evaluateAttendanceStatus,
  evaluateShiftTimeliness,
  getISTDateString,
  parseShiftStartInIST,
} from '@/lib/dateUtils';
import {
  findAssignedShiftForUserDate,
  findAttendanceForRegularizationById,
  findAttendanceForRegularizationByUserDate,
  findAuditLogsByAttendanceId,
  findRosterSnapshotForDate,
  findStaleInProgressRecords,
  findUserSummaryById,
  markRecordsAsStale,
  regularizeAttendanceInTransaction,
} from '@/repository/adminAttendance.repository';

const STALE_THRESHOLD_MS = 16 * 60 * 60 * 1000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type LiveRosterState =
  | 'WORKING'
  | 'ON_BREAK'
  | 'ANOMALY_STALE'
  | 'ON_LEAVE'
  | 'COMPLETED'
  | 'WEEK_OFF'
  | 'OFFLINE';

export interface LiveRosterEntry {
  user: {
    id: string;
    name: string;
    email: string;
    empId: string | null;
    alias: string | null;
    role: { id: string; code: string; name: string };
    designation: { id: string; code: string; name: string } | null;
  };
  assignedShift: Shift | null;
  attendance: {
    id: string;
    workDate: string;
    firstPunchIn: Date;
    lastPunchOut: Date | null;
    grossMinutes: number;
    totalBreakMinutes: number;
    netWorkMinutes: number;
    isLate: boolean;
    lateMinutes: number;
    status: AttendanceStatus;
    isRegularized: boolean;
    shift: Shift | null;
  } | null;
  breaks: BreakRecord[];
  activeBreak: BreakRecord | null;
  auditLogCount: number;
  liveState: LiveRosterState;
}

export interface LiveRosterKpis {
  totalEmployees: number;
  onShiftCount: number;
  onBreakCount: number;
  lateCount: number;
  onLeaveCount: number;
  staleCount: number;
  completedCount: number;
  offlineCount: number;
}

export interface LiveRosterFilters {
  date?: string;
  shiftId?: string;
  roleCode?: string;
  designationCode?: string;
  status?: string;
  search?: string;
  referenceTime?: Date;
}

/**
 * Transitions any IN_PROGRESS attendance record older than 16 continuous hours to ANOMALY_STALE (BR-IST-004).
 */
export async function markStaleShifts(referenceTime: Date = new Date()) {
  const cutoffUtc = new Date(referenceTime.getTime() - STALE_THRESHOLD_MS);
  const staleRecords = await findStaleInProgressRecords(cutoffUtc);
  const markedIds = staleRecords.map((r) => r.id);

  if (markedIds.length > 0) {
    await markRecordsAsStale(markedIds);
  }

  return {
    markedCount: markedIds.length,
    markedIds,
  };
}

/**
 * Builds the company-wide attendance roster, KPI counts, and filter metadata for a given IST date.
 */
export async function getLiveRoster(filters: LiveRosterFilters = {}) {
  const referenceTime = filters.referenceTime ?? new Date();
  const workDate =
    filters.date && DATE_PATTERN.test(filters.date) ? filters.date : getISTDateString(referenceTime);

  // Enforce 16-hour stale safeguard before computing roster
  await markStaleShifts(referenceTime);

  const snapshot = await findRosterSnapshotForDate(workDate);

  const dayOfWeek = new Date(`${workDate}T12:00:00.000Z`).getUTCDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  const recordByUserId = new Map(snapshot.records.map((r) => [r.userId, r]));
  const shiftByUserId = new Map<string, Shift>();
  for (const assignment of snapshot.shiftAssignments) {
    if (!shiftByUserId.has(assignment.userId)) {
      shiftByUserId.set(assignment.userId, assignment.shift);
    }
  }

  const kpis: LiveRosterKpis = {
    totalEmployees: snapshot.users.length,
    onShiftCount: 0,
    onBreakCount: 0,
    lateCount: 0,
    onLeaveCount: 0,
    staleCount: 0,
    completedCount: 0,
    offlineCount: 0,
  };

  const fullRoster: LiveRosterEntry[] = snapshot.users.map((user) => {
    const rec = recordByUserId.get(user.id) ?? null;
    const assignedShift = rec?.shift ?? shiftByUserId.get(user.id) ?? null;
    const breaks = rec?.breaks ?? [];
    const activeBreak = breaks.find((b) => b.breakEnd === null) ?? null;

    let liveState: LiveRosterState = isWeekend ? 'WEEK_OFF' : 'OFFLINE';

    if (rec) {
      if (rec.status === 'ANOMALY_STALE') {
        liveState = 'ANOMALY_STALE';
        kpis.staleCount++;
      } else if (rec.status === 'IN_PROGRESS') {
        if (activeBreak) {
          liveState = 'ON_BREAK';
          kpis.onBreakCount++;
        } else {
          liveState = 'WORKING';
        }
        kpis.onShiftCount++;
      } else if (rec.status === 'LV') {
        liveState = 'ON_LEAVE';
        kpis.onLeaveCount++;
      } else if (rec.status === 'WO') {
        liveState = 'WEEK_OFF';
      } else {
        liveState = 'COMPLETED';
        kpis.completedCount++;
      }

      if (rec.isLate) {
        kpis.lateCount++;
      }
    } else if (!isWeekend) {
      kpis.offlineCount++;
    }

    return {
      user,
      assignedShift,
      attendance: rec
        ? {
            id: rec.id,
            workDate: rec.workDate,
            firstPunchIn: rec.firstPunchIn,
            lastPunchOut: rec.lastPunchOut,
            grossMinutes: rec.grossMinutes,
            totalBreakMinutes: rec.totalBreakMinutes,
            netWorkMinutes: rec.netWorkMinutes,
            isLate: rec.isLate,
            lateMinutes: rec.lateMinutes,
            status: rec.status,
            isRegularized: rec.isRegularized,
            shift: rec.shift,
          }
        : null,
      breaks,
      activeBreak,
      auditLogCount: rec?._count.auditLogs ?? 0,
      liveState,
    };
  });

  const searchLower = filters.search?.trim().toLowerCase() ?? '';
  const filteredRoster = fullRoster.filter((entry) => {
    if (filters.shiftId && entry.assignedShift?.id !== filters.shiftId) {
      return false;
    }
    if (filters.roleCode && entry.user.role.code !== filters.roleCode) {
      return false;
    }
    if (filters.designationCode && entry.user.designation?.code !== filters.designationCode) {
      return false;
    }
    if (filters.status && filters.status !== 'ALL') {
      const s = filters.status;
      if (s === 'LATE') {
        if (!entry.attendance?.isLate) return false;
      } else if (s === 'REGULARIZED') {
        if (!entry.attendance?.isRegularized) return false;
      } else if (['P', 'HD', 'A', 'LV', 'WO', 'IN_PROGRESS', 'ANOMALY_STALE'].includes(s)) {
        if (entry.attendance?.status !== s && !(s === 'WO' && entry.liveState === 'WEEK_OFF')) {
          return false;
        }
      } else if (entry.liveState !== s) {
        return false;
      }
    }
    if (searchLower) {
      const haystack = [
        entry.user.name,
        entry.user.email,
        entry.user.empId ?? '',
        entry.user.alias ?? '',
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(searchLower)) {
        return false;
      }
    }
    return true;
  });

  return {
    workDate,
    isWeekend,
    kpis,
    roster: filteredRoster,
    filtersMeta: {
      shifts: snapshot.shifts,
      roles: snapshot.roles,
      designations: snapshot.designations,
    },
  };
}

export interface RegularizeAttendanceInput {
  attendanceRecordId?: string;
  userId?: string;
  workDate?: string;
  firstPunchIn?: string | Date | null;
  lastPunchOut?: string | Date | null;
  totalBreakMinutesOverride?: number;
  status?: AttendanceStatus;
  reason: string;
}

function parseDateInput(value?: string | Date | null): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Edits or creates a daily attendance record with mandatory explanation and immutable audit trail (BR-REG-001).
 */
export async function regularizeAttendance(adminId: string, input: RegularizeAttendanceInput) {
  const trimmedReason = (input.reason ?? '').trim();
  if (!trimmedReason) {
    return {
      success: false as const,
      error: {
        code: 'ADM_REGULARIZATION_REASON_REQUIRED',
        message: 'A mandatory explanation is required to edit or regularize an attendance record.',
        status: 400,
      },
    };
  }

  let existing = input.attendanceRecordId
    ? await findAttendanceForRegularizationById(input.attendanceRecordId)
    : null;

  if (!existing && input.userId && input.workDate) {
    if (!DATE_PATTERN.test(input.workDate)) {
      return {
        success: false as const,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid workDate format. Expected YYYY-MM-DD.',
          status: 400,
        },
      };
    }
    existing = await findAttendanceForRegularizationByUserDate(input.userId, input.workDate);
  }

  if (input.attendanceRecordId && !existing) {
    return {
      success: false as const,
      error: {
        code: 'ATT_RECORD_NOT_FOUND',
        message: 'Attendance record not found.',
        status: 404,
      },
    };
  }

  const targetUserId = existing?.userId ?? input.userId;
  const targetWorkDate = existing?.workDate ?? input.workDate;

  if (!targetUserId || !targetWorkDate) {
    return {
      success: false as const,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Either attendanceRecordId or userId + workDate is required.',
        status: 400,
      },
    };
  }

  if (!existing) {
    const userExists = await findUserSummaryById(targetUserId);
    if (!userExists) {
      return {
        success: false as const,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Employee not found.',
          status: 404,
        },
      };
    }
  }

  const assignedShift =
    existing?.shift ?? (await findAssignedShiftForUserDate(targetUserId, targetWorkDate));

  const parsedFirstIn = parseDateInput(input.firstPunchIn);
  const firstPunchIn =
    parsedFirstIn ??
    existing?.firstPunchIn ??
    new Date(`${targetWorkDate}T00:00:00+05:30`);

  const hasExplicitLastOut = input.lastPunchOut !== undefined;
  const lastPunchOut = hasExplicitLastOut
    ? parseDateInput(input.lastPunchOut)
    : existing?.lastPunchOut ?? null;

  if (hasExplicitLastOut && input.lastPunchOut !== null && input.lastPunchOut !== '' && !lastPunchOut) {
    return {
      success: false as const,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid punch-out timestamp.',
        status: 400,
      },
    };
  }

  if (input.firstPunchIn !== undefined && input.firstPunchIn !== null && input.firstPunchIn !== '' && !parsedFirstIn) {
    return {
      success: false as const,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid punch-in timestamp.',
        status: 400,
      },
    };
  }

  if (lastPunchOut && lastPunchOut.getTime() < firstPunchIn.getTime()) {
    return {
      success: false as const,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Punch-out time cannot be earlier than punch-in time.',
        status: 400,
      },
    };
  }

  if (input.totalBreakMinutesOverride !== undefined && input.totalBreakMinutesOverride < 0) {
    return {
      success: false as const,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Break minutes cannot be negative.',
        status: 400,
      },
    };
  }

  const existingBreaksTotal = existing?.totalBreakMinutes ?? 0;
  let openBreakEstimatedMinutes = 0;
  if (existing && lastPunchOut) {
    for (const brk of existing.breaks) {
      if (!brk.breakEnd) {
        openBreakEstimatedMinutes += Math.max(
          0,
          Math.round((lastPunchOut.getTime() - brk.breakStart.getTime()) / 60000)
        );
      }
    }
  }

  const totalBreakMinutes =
    input.totalBreakMinutesOverride !== undefined
      ? input.totalBreakMinutesOverride
      : existingBreaksTotal + openBreakEstimatedMinutes;

  const grossMinutes = lastPunchOut
    ? Math.max(0, Math.round((lastPunchOut.getTime() - firstPunchIn.getTime()) / 60000))
    : 0;
  const netWorkMinutes = lastPunchOut ? Math.max(0, grossMinutes - totalBreakMinutes) : 0;

  let finalStatus: AttendanceStatus;
  if (input.status) {
    finalStatus = input.status;
  } else if (lastPunchOut) {
    finalStatus = evaluateAttendanceStatus(netWorkMinutes);
  } else {
    finalStatus = existing?.status ?? 'A';
  }

  let isLate = existing?.isLate ?? false;
  let lateMinutes = existing?.lateMinutes ?? 0;

  if (finalStatus === 'LV' || finalStatus === 'WO') {
    isLate = false;
    lateMinutes = 0;
  } else if (assignedShift && (parsedFirstIn !== null || !existing)) {
    const scheduledStartUtc = parseShiftStartInIST(targetWorkDate, assignedShift.startTime);
    const evalResult = evaluateShiftTimeliness(
      firstPunchIn,
      scheduledStartUtc,
      assignedShift.graceMinutes,
      720 // Allow flexible admin backdated/early regularization
    );
    isLate = evalResult.isLate;
    lateMinutes = evalResult.lateMinutes;
  }

  const previousValues: Prisma.InputJsonValue = existing
    ? {
        existed: true,
        workDate: existing.workDate,
        firstPunchIn: existing.firstPunchIn.toISOString(),
        lastPunchOut: existing.lastPunchOut ? existing.lastPunchOut.toISOString() : null,
        grossMinutes: existing.grossMinutes,
        totalBreakMinutes: existing.totalBreakMinutes,
        netWorkMinutes: existing.netWorkMinutes,
        isLate: existing.isLate,
        lateMinutes: existing.lateMinutes,
        status: existing.status,
        isRegularized: existing.isRegularized,
      }
    : {
        existed: false,
        workDate: targetWorkDate,
        status: 'OFFLINE',
      };

  const { record, auditLog } = await regularizeAttendanceInTransaction({
    existingRecordId: existing?.id,
    userId: targetUserId,
    shiftId: assignedShift?.id ?? null,
    workDate: targetWorkDate,
    firstPunchIn,
    lastPunchOut,
    grossMinutes,
    totalBreakMinutes,
    netWorkMinutes,
    isLate,
    lateMinutes,
    status: finalStatus,
    adminId,
    previousValues,
    reason: trimmedReason,
    closeOpenBreaksAt: lastPunchOut,
  });

  return {
    success: true as const,
    record,
    auditLog,
  };
}

/**
 * Retrieves immutable audit logs for a given attendance record.
 */
export async function getAttendanceAuditLogs(attendanceRecordId: string) {
  const existing = await findAttendanceForRegularizationById(attendanceRecordId);
  if (!existing) {
    return {
      success: false as const,
      error: {
        code: 'ATT_RECORD_NOT_FOUND',
        message: 'Attendance record not found.',
        status: 404,
      },
    };
  }

  const logs = await findAuditLogsByAttendanceId(attendanceRecordId);
  return {
    success: true as const,
    logs,
  };
}
