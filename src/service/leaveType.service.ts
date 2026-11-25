import {
  countLeaveTypeReferences,
  createLeaveTypeRecord,
  deleteLeaveTypeRecord,
  findAllLeaveTypes,
  findLeaveTypeByCode,
  findLeaveTypeById,
  updateLeaveTypeRecord,
} from '@/repository/leaveType.repository';
import { LeaveTypeConfig } from '@prisma/client';

export type LeaveTypeServiceResult =
  | { success: true; leaveType: LeaveTypeConfig }
  | { success: false; error: { code: string; message: string; status?: number } };

export async function listLeaveTypes(activeOnly: boolean = false) {
  return findAllLeaveTypes(activeOnly);
}

export async function createLeaveType(input: {
  code: string;
  name: string;
  description?: string | null;
  defaultAnnualDays: number;
  allowCarryForward?: boolean;
  maxCarryForwardDays?: number;
  isPaid?: boolean;
  isActive?: boolean;
}): Promise<LeaveTypeServiceResult> {
  const normalizedCode = (input.code ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  const trimmedName = (input.name ?? '').trim();

  if (!normalizedCode || !/^[A-Z0-9_]+$/.test(normalizedCode)) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Leave type code must contain only letters, numbers, or underscores.',
        status: 400,
      },
    };
  }

  if (!trimmedName) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Leave type display name is required.',
        status: 400,
      },
    };
  }

  const maxCarry = input.maxCarryForwardDays ?? 0;
  if (input.defaultAnnualDays < 0 || maxCarry < 0) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Annual days and carry-forward cap cannot be negative.',
        status: 400,
      },
    };
  }

  const existing = await findLeaveTypeByCode(normalizedCode);
  if (existing) {
    return {
      success: false,
      error: {
        code: 'LV_TYPE_DUPLICATE',
        message: 'A leave type with this code already exists.',
        status: 409,
      },
    };
  }

  const leaveType = await createLeaveTypeRecord({
    code: normalizedCode,
    name: trimmedName,
    description: input.description?.trim() || null,
    defaultAnnualDays: input.defaultAnnualDays,
    allowCarryForward: input.allowCarryForward ?? false,
    maxCarryForwardDays: input.allowCarryForward ? maxCarry : 0,
    isPaid: input.isPaid ?? true,
    isActive: input.isActive ?? true,
  });

  return { success: true, leaveType };
}

export async function updateLeaveType(
  id: string,
  input: {
    name?: string;
    description?: string | null;
    defaultAnnualDays?: number;
    allowCarryForward?: boolean;
    maxCarryForwardDays?: number;
    isPaid?: boolean;
    isActive?: boolean;
  }
): Promise<LeaveTypeServiceResult> {
  const existing = await findLeaveTypeById(id);
  if (!existing) {
    return {
      success: false,
      error: {
        code: 'LV_NOT_FOUND',
        message: 'Leave type not found.',
        status: 404,
      },
    };
  }

  if (
    (input.defaultAnnualDays !== undefined && input.defaultAnnualDays < 0) ||
    (input.maxCarryForwardDays !== undefined && input.maxCarryForwardDays < 0)
  ) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Annual days and carry-forward cap cannot be negative.',
        status: 400,
      },
    };
  }

  const allowCarry = input.allowCarryForward ?? existing.allowCarryForward;
  const maxCarry = allowCarry ? (input.maxCarryForwardDays ?? existing.maxCarryForwardDays) : 0;

  const leaveType = await updateLeaveTypeRecord(id, {
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
    ...(input.defaultAnnualDays !== undefined ? { defaultAnnualDays: input.defaultAnnualDays } : {}),
    ...(input.allowCarryForward !== undefined ? { allowCarryForward: input.allowCarryForward } : {}),
    maxCarryForwardDays: maxCarry,
    ...(input.isPaid !== undefined ? { isPaid: input.isPaid } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
  });

  return { success: true, leaveType };
}

export async function deleteLeaveType(
  id: string
): Promise<{ success: true } | { success: false; error: { code: string; message: string; status?: number } }> {
  const existing = await findLeaveTypeById(id);
  if (!existing) {
    return {
      success: false,
      error: {
        code: 'LV_NOT_FOUND',
        message: 'Leave type not found.',
        status: 404,
      },
    };
  }

  const refs = await countLeaveTypeReferences(id);
  if (refs.requestCount > 0 || refs.balanceCount > 0) {
    return {
      success: false,
      error: {
        code: 'LV_TYPE_IN_USE',
        message:
          'Cannot delete a leave type that has existing requests or balances. Deactivate it instead.',
        status: 409,
      },
    };
  }

  await deleteLeaveTypeRecord(id);
  return { success: true };
}

