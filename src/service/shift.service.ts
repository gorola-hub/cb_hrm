import {
  assignShiftInTransaction,
  createShiftRecord,
  deleteEmployeeShiftRecord,
  findActiveEmployeesForShifts,
  findAllShiftsWithCounts,
  findEmployeeShiftAssignments,
  findEmployeeShiftById,
  findOverlappingEmployeeShifts,
  findShiftByCode,
  findShiftById,
  findShiftUserById,
  updateEmployeeShiftRecord,
  updateShiftRecord,
} from '@/repository/shift.repository';

const TIME_HHMM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_YYYYMMDD_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseEffectiveDate(value: string | Date, boundary: 'start' | 'end'): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const trimmed = value.trim();
  if (DATE_YYYYMMDD_REGEX.test(trimmed)) {
    const timeSuffix = boundary === 'start' ? '00:00:00+05:30' : '23:59:59+05:30';
    const d = new Date(`${trimmed}T${timeSuffix}`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function listShifts() {
  return findAllShiftsWithCounts();
}

export async function createShift(input: {
  code: string;
  displayName: string;
  startTime: string;
  durationMins: number;
  graceMinutes: number;
  isActive?: boolean;
}) {
  const normalizedCode = (input.code ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  const trimmedName = (input.displayName ?? '').trim();

  if (!normalizedCode || !/^[A-Z0-9_]+$/.test(normalizedCode)) {
    return {
      success: false as const,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Shift code must contain only letters, numbers, or underscores.',
        status: 400,
      },
    };
  }

  if (!trimmedName) {
    return {
      success: false as const,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Shift display name is required.',
        status: 400,
      },
    };
  }

  if (!TIME_HHMM_REGEX.test(input.startTime)) {
    return {
      success: false as const,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Start time must be in 24-hour HH:mm IST format (e.g. 19:00).',
        status: 400,
      },
    };
  }

  if (!Number.isInteger(input.durationMins) || input.durationMins <= 0 || input.durationMins > 1440) {
    return {
      success: false as const,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Shift duration must be between 1 and 1440 minutes.',
        status: 400,
      },
    };
  }

  if (!Number.isInteger(input.graceMinutes) || input.graceMinutes < 0 || input.graceMinutes > 180) {
    return {
      success: false as const,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Grace period must be between 0 and 180 minutes.',
        status: 400,
      },
    };
  }

  const existing = await findShiftByCode(normalizedCode);
  if (existing) {
    return {
      success: false as const,
      error: {
        code: 'SHIFT_DUPLICATE',
        message: 'A shift with this code already exists.',
        status: 409,
      },
    };
  }

  const shift = await createShiftRecord({
    code: normalizedCode,
    displayName: trimmedName,
    startTime: input.startTime,
    durationMins: input.durationMins,
    graceMinutes: input.graceMinutes,
    isActive: input.isActive ?? true,
  });

  return { success: true as const, shift };
}

export async function updateShift(
  id: string,
  input: {
    displayName?: string;
    startTime?: string;
    durationMins?: number;
    graceMinutes?: number;
    isActive?: boolean;
  }
) {
  const existing = await findShiftById(id);
  if (!existing) {
    return {
      success: false as const,
      error: {
        code: 'SHIFT_NOT_FOUND',
        message: 'Shift not found.',
        status: 404,
      },
    };
  }

  if (input.startTime !== undefined && !TIME_HHMM_REGEX.test(input.startTime)) {
    return {
      success: false as const,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Start time must be in 24-hour HH:mm IST format (e.g. 19:00).',
        status: 400,
      },
    };
  }

  if (
    input.durationMins !== undefined &&
    (!Number.isInteger(input.durationMins) || input.durationMins <= 0 || input.durationMins > 1440)
  ) {
    return {
      success: false as const,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Shift duration must be between 1 and 1440 minutes.',
        status: 400,
      },
    };
  }

  if (
    input.graceMinutes !== undefined &&
    (!Number.isInteger(input.graceMinutes) || input.graceMinutes < 0 || input.graceMinutes > 180)
  ) {
    return {
      success: false as const,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Grace period must be between 0 and 180 minutes.',
        status: 400,
      },
    };
  }

  const shift = await updateShiftRecord(id, {
    ...(input.displayName !== undefined ? { displayName: input.displayName.trim() } : {}),
    ...(input.startTime !== undefined ? { startTime: input.startTime } : {}),
    ...(input.durationMins !== undefined ? { durationMins: input.durationMins } : {}),
    ...(input.graceMinutes !== undefined ? { graceMinutes: input.graceMinutes } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
  });

  return { success: true as const, shift };
}

export async function listEmployeeShiftAssignments(filters?: {
  userId?: string;
  shiftId?: string;
}) {
  return findEmployeeShiftAssignments(filters);
}

export async function getShiftManagementSnapshot(filters?: {
  userId?: string;
  shiftId?: string;
}) {
  const [shifts, assignments, employees] = await Promise.all([
    findAllShiftsWithCounts(),
    findEmployeeShiftAssignments(filters),
    findActiveEmployeesForShifts(),
  ]);
  return { shifts, assignments, employees };
}

export async function assignEmployeeShift(input: {
  userId: string;
  shiftId: string;
  effectiveFrom: string | Date;
  effectiveTo?: string | Date | null;
  autoClosePrevious?: boolean;
}) {
  const [user, shift] = await Promise.all([
    findShiftUserById(input.userId),
    findShiftById(input.shiftId),
  ]);

  if (!user || !user.isActive) {
    return {
      success: false as const,
      error: {
        code: 'USER_NOT_FOUND',
        message: 'Active employee not found.',
        status: 404,
      },
    };
  }

  if (!shift) {
    return {
      success: false as const,
      error: {
        code: 'SHIFT_NOT_FOUND',
        message: 'Shift not found.',
        status: 404,
      },
    };
  }

  if (!shift.isActive) {
    return {
      success: false as const,
      error: {
        code: 'SHIFT_INACTIVE',
        message: 'Cannot assign an inactive shift to an employee.',
        status: 400,
      },
    };
  }

  const effectiveFrom = parseEffectiveDate(input.effectiveFrom, 'start');
  const effectiveTo =
    input.effectiveTo !== undefined && input.effectiveTo !== null && input.effectiveTo !== ''
      ? parseEffectiveDate(input.effectiveTo, 'end')
      : null;

  if (!effectiveFrom) {
    return {
      success: false as const,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid effectiveFrom date.',
        status: 400,
      },
    };
  }

  if (input.effectiveTo && !effectiveTo) {
    return {
      success: false as const,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid effectiveTo date.',
        status: 400,
      },
    };
  }

  if (effectiveTo && effectiveTo.getTime() < effectiveFrom.getTime()) {
    return {
      success: false as const,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Effective end date cannot be earlier than effective start date.',
        status: 400,
      },
    };
  }

  const autoClosePrevious = input.autoClosePrevious ?? false;
  const overlapping = await findOverlappingEmployeeShifts(
    input.userId,
    effectiveFrom,
    effectiveTo
  );

  const nonAutoCloseableOverlaps = autoClosePrevious
    ? overlapping.filter(
        (item) => !(item.effectiveTo === null && item.effectiveFrom < effectiveFrom)
      )
    : overlapping;

  if (nonAutoCloseableOverlaps.length > 0) {
    return {
      success: false as const,
      error: {
        code: 'SHIFT_OVERLAPPING_ASSIGNMENT',
        message:
          'Employee already has an overlapping shift assignment for the selected date range.',
        status: 409,
      },
    };
  }

  const assignment = await assignShiftInTransaction({
    userId: input.userId,
    shiftId: input.shiftId,
    effectiveFrom,
    effectiveTo,
    autoClosePrevious,
  });

  return { success: true as const, assignment };
}

export async function updateEmployeeShiftAssignment(
  id: string,
  input: {
    shiftId?: string;
    effectiveFrom?: string | Date;
    effectiveTo?: string | Date | null;
  }
) {
  const existing = await findEmployeeShiftById(id);
  if (!existing) {
    return {
      success: false as const,
      error: {
        code: 'SHIFT_ASSIGNMENT_NOT_FOUND',
        message: 'Shift assignment not found.',
        status: 404,
      },
    };
  }

  if (input.shiftId) {
    const shift = await findShiftById(input.shiftId);
    if (!shift || !shift.isActive) {
      return {
        success: false as const,
        error: {
          code: 'SHIFT_INACTIVE',
          message: 'Target shift is inactive or does not exist.',
          status: 400,
        },
      };
    }
  }

  const nextFrom =
    input.effectiveFrom !== undefined
      ? parseEffectiveDate(input.effectiveFrom, 'start')
      : existing.effectiveFrom;
  const nextTo =
    input.effectiveTo === undefined
      ? existing.effectiveTo
      : input.effectiveTo === null || input.effectiveTo === ''
        ? null
        : parseEffectiveDate(input.effectiveTo, 'end');

  if (!nextFrom) {
    return {
      success: false as const,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid effectiveFrom date.',
        status: 400,
      },
    };
  }

  if (nextTo && nextTo.getTime() < nextFrom.getTime()) {
    return {
      success: false as const,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Effective end date cannot be earlier than effective start date.',
        status: 400,
      },
    };
  }

  const overlapping = await findOverlappingEmployeeShifts(
    existing.userId,
    nextFrom,
    nextTo,
    id
  );
  if (overlapping.length > 0) {
    return {
      success: false as const,
      error: {
        code: 'SHIFT_OVERLAPPING_ASSIGNMENT',
        message:
          'Updated range overlaps with another shift assignment for this employee.',
        status: 409,
      },
    };
  }

  const assignment = await updateEmployeeShiftRecord(id, {
    ...(input.shiftId ? { shiftId: input.shiftId } : {}),
    effectiveFrom: nextFrom,
    effectiveTo: nextTo,
  });

  return { success: true as const, assignment };
}

export async function deleteEmployeeShiftAssignment(id: string) {
  const existing = await findEmployeeShiftById(id);
  if (!existing) {
    return {
      success: false as const,
      error: {
        code: 'SHIFT_ASSIGNMENT_NOT_FOUND',
        message: 'Shift assignment not found.',
        status: 404,
      },
    };
  }

  await deleteEmployeeShiftRecord(id);
  return { success: true as const };
}

