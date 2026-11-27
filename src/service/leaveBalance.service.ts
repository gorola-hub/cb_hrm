import { LeaveTypeConfig, LeaveBalance } from '@prisma/client';
import { calculateMonthlyAccruedPaidLeaves, getISTDateString } from '@/lib/dateUtils';
import { findAllLeaveTypes, findLeaveTypeById } from '@/repository/leaveType.repository';
import {
  findActiveUsersForBalances,
  findBalance,
  findBalancesForUserYear,
  findUserJoiningDate,
  upsertCarriedForward,
  upsertLeaveBalance,
} from '@/repository/leaveBalance.repository';
import { findActiveUserLeaveRequestsForYear } from '@/repository/leave.repository';

export interface EmployeeLeaveBalanceView {
  leaveType: LeaveTypeConfig;
  year: number;
  entitledDays: number;
  carriedForwardDays: number;
  adjustedDays: number;
  totalEntitlement: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
  availableDays: number;
  notes: string | null;
}

export interface EmployeeLeaveBalanceSnapshot {
  hasJoiningDate: boolean;
  balances: EmployeeLeaveBalanceView[];
}

export interface YearWeekdaySummary {
  count: number;
  maxMonth: number;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateStr(dateStr: string): boolean {
  if (!DATE_PATTERN.test(dateStr)) return false;
  const parsed = new Date(`${dateStr}T12:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === dateStr;
}

/**
 * Enumerates weekday counts and highest covered month (1-12) per calendar year across [startDate, endDate].
 */
export function enumerateWeekdayDetailsByYear(
  startDate: string,
  endDate: string
): Map<number, YearWeekdaySummary> {
  const details = new Map<number, YearWeekdaySummary>();
  if (!isValidDateStr(startDate) || !isValidDateStr(endDate) || endDate < startDate) {
    return details;
  }

  const cursor = new Date(`${startDate}T12:00:00.000Z`);
  const end = new Date(`${endDate}T12:00:00.000Z`);
  while (cursor.getTime() <= end.getTime()) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      const yr = cursor.getUTCFullYear();
      const month = cursor.getUTCMonth() + 1;
      const prev = details.get(yr);
      if (prev) {
        prev.count += 1;
        prev.maxMonth = Math.max(prev.maxMonth, month);
      } else {
        details.set(yr, { count: 1, maxMonth: month });
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return details;
}

/**
 * Counts weekdays (Mon-Fri) per calendar year across an inclusive [startDate, endDate] range.
 */
export function enumerateWeekdaysByYear(startDate: string, endDate: string): Map<number, number> {
  const counts = new Map<number, number>();
  for (const [year, info] of enumerateWeekdayDetailsByYear(startDate, endDate).entries()) {
    counts.set(year, info.count);
  }
  return counts;
}

/**
 * Returns per-leave-type balances plus joining-date status for an employee in the given IST calendar year.
 * Paid leave entitlement is calculated dynamically from users.dateOfJoining (+1/month after 3-month cutoff).
 */
export async function getEmployeeLeaveBalancesWithMeta(
  userId: string,
  year: number = parseInt(getISTDateString().slice(0, 4), 10),
  options?: { asOfMonth?: number; dateOfJoining?: Date | null }
): Promise<EmployeeLeaveBalanceSnapshot> {
  const [userRecord, allTypes, existingBalances, activeRequests] = await Promise.all([
    options?.dateOfJoining !== undefined
      ? Promise.resolve({ id: userId, dateOfJoining: options.dateOfJoining })
      : findUserJoiningDate(userId),
    findAllLeaveTypes(false),
    findBalancesForUserYear(userId, year),
    findActiveUserLeaveRequestsForYear(userId, year),
  ]);

  const dateOfJoining = userRecord?.dateOfJoining ?? null;
  const hasJoiningDate = Boolean(dateOfJoining);
  const balanceMap = new Map(existingBalances.map((b) => [b.leaveTypeId, b]));
  const usedByType = new Map<string, number>();
  const pendingByType = new Map<string, number>();

  for (const req of activeRequests) {
    const yearDays = enumerateWeekdaysByYear(req.startDate, req.endDate).get(year) ?? 0;
    if (yearDays <= 0) continue;
    if (req.status === 'APPROVED') {
      usedByType.set(req.leaveTypeId, (usedByType.get(req.leaveTypeId) ?? 0) + yearDays);
    } else if (req.status === 'PENDING') {
      pendingByType.set(req.leaveTypeId, (pendingByType.get(req.leaveTypeId) ?? 0) + yearDays);
    }
  }

  const balances: EmployeeLeaveBalanceView[] = [];

  for (const lt of allTypes) {
    let row = balanceMap.get(lt.id);
    const usedDays = usedByType.get(lt.id) ?? 0;
    const pendingDays = pendingByType.get(lt.id) ?? 0;

    if (!row && lt.isActive) {
      row = await upsertLeaveBalance({
        userId,
        leaveTypeId: lt.id,
        year,
        entitledDays: 0,
        carriedForwardDays: 0,
        adjustedDays: 0,
      });
    }

    // Skip inactive types that have no balance record and no requests in this year
    if (!row && usedDays === 0 && pendingDays === 0) {
      continue;
    }

    const entitledDays = lt.isPaid
      ? calculateMonthlyAccruedPaidLeaves(dateOfJoining, year, options?.asOfMonth)
      : 0;
    const carriedForwardDays = row?.carriedForwardDays ?? 0;
    const adjustedDays = row?.adjustedDays ?? 0;
    const totalEntitlement = entitledDays + carriedForwardDays + adjustedDays;
    const remainingDays = Math.max(0, totalEntitlement - usedDays);
    const availableDays = Math.max(0, totalEntitlement - usedDays - pendingDays);

    balances.push({
      leaveType: lt,
      year,
      entitledDays,
      carriedForwardDays,
      adjustedDays,
      totalEntitlement,
      usedDays,
      pendingDays,
      remainingDays,
      availableDays,
      notes: row?.notes ?? null,
    });
  }

  return { hasJoiningDate, balances };
}

/**
 * Returns per-leave-type balances for an employee in the given IST calendar year.
 */
export async function getEmployeeLeaveBalances(
  userId: string,
  year: number = parseInt(getISTDateString().slice(0, 4), 10),
  options?: { asOfMonth?: number; dateOfJoining?: Date | null }
): Promise<EmployeeLeaveBalanceView[]> {
  const snapshot = await getEmployeeLeaveBalancesWithMeta(userId, year, options);
  return snapshot.balances;
}

/**
 * Allows an Administrator to apply manual balance adjustments (+/- days) and notes.
 */
export async function adjustEmployeeLeaveBalance(input: {
  userId: string;
  leaveTypeId: string;
  year: number;
  entitledDays?: number;
  adjustedDays?: number;
  notes?: string | null;
}): Promise<
  | { success: true; balance: LeaveBalance & { leaveType: LeaveTypeConfig } }
  | { success: false; error: { code: string; message: string; status?: number } }
> {
  const leaveType = await findLeaveTypeById(input.leaveTypeId);
  if (!leaveType) {
    return {
      success: false,
      error: {
        code: 'LV_NOT_FOUND',
        message: 'Leave type not found.',
        status: 404,
      },
    };
  }

  const [userRecord, existing] = await Promise.all([
    findUserJoiningDate(input.userId),
    findBalance(input.userId, input.leaveTypeId, input.year),
  ]);

  const accruedDays = leaveType.isPaid
    ? calculateMonthlyAccruedPaidLeaves(userRecord?.dateOfJoining, input.year)
    : 0;
  const nextStoredEntitled = input.entitledDays ?? existing?.entitledDays ?? 0;
  const currentCarried = existing?.carriedForwardDays ?? 0;
  const nextAdjusted = input.adjustedDays ?? existing?.adjustedDays ?? 0;

  if (nextStoredEntitled < 0 || accruedDays + currentCarried + nextAdjusted < 0) {
    return {
      success: false,
      error: {
        code: 'LV_INVALID_ADJUSTMENT',
        message: 'Adjustment would result in a negative total leave entitlement.',
        status: 400,
      },
    };
  }

  const balance = await upsertLeaveBalance({
    userId: input.userId,
    leaveTypeId: input.leaveTypeId,
    year: input.year,
    entitledDays: nextStoredEntitled,
    carriedForwardDays: currentCarried,
    adjustedDays: nextAdjusted,
    notes: input.notes !== undefined ? input.notes : existing?.notes ?? null,
  });

  return { success: true, balance };
}

/**
 * Idempotently rolls unused leave balances from fromYear (full 12-month accrued total) into toYear.carriedForwardDays,
 * capped by each leave type's maxCarryForwardDays when allowCarryForward is enabled.
 */
export async function runCarryForwardRollover(
  fromYear: number,
  toYear: number,
  targetUserId?: string
): Promise<
  | { success: true; fromYear: number; toYear: number; processedUsers: number }
  | { success: false; error: { code: string; message: string; status?: number } }
> {
  if (!Number.isInteger(fromYear) || !Number.isInteger(toYear) || toYear <= fromYear) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Target rollover year must be greater than source year.',
        status: 400,
      },
    };
  }

  const users = await findActiveUsersForBalances(targetUserId);

  for (const user of users) {
    const fromBalances = await getEmployeeLeaveBalances(user.id, fromYear, {
      asOfMonth: 12,
      dateOfJoining: user.dateOfJoining,
    });
    for (const item of fromBalances) {
      const unused = Math.max(0, item.totalEntitlement - item.usedDays);
      const carried = item.leaveType.allowCarryForward
        ? Math.min(unused, Math.max(0, item.leaveType.maxCarryForwardDays))
        : 0;

      await upsertCarriedForward({
        userId: user.id,
        leaveTypeId: item.leaveType.id,
        year: toYear,
        defaultEntitledDays: 0,
        carriedForwardDays: carried,
      });
    }
  }

  return {
    success: true,
    fromYear,
    toYear,
    processedUsers: users.length,
  };
}

/**
 * Returns company-wide employee balances for Admin inspection and editing.
 */
export async function listCompanyLeaveBalances(
  year: number = parseInt(getISTDateString().slice(0, 4), 10),
  userId?: string
) {
  const [users, leaveTypes] = await Promise.all([
    findActiveUsersForBalances(userId),
    findAllLeaveTypes(false),
  ]);

  const employees = await Promise.all(
    users.map(async (user) => ({
      user,
      balances: await getEmployeeLeaveBalances(user.id, year, {
        dateOfJoining: user.dateOfJoining,
      }),
    }))
  );

  return {
    year,
    leaveTypes,
    employees,
  };
}

