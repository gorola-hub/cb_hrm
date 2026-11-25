import { NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse, requireAdminUser } from '@/lib/apiHelpers';
import { deleteLeaveType, updateLeaveType } from '@/service/leaveType.service';

const updateLeaveTypeSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  defaultAnnualDays: z.number().optional(),
  allowCarryForward: z.boolean().optional(),
  maxCarryForwardDays: z.number().optional(),
  isPaid: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { response } = await requireAdminUser();
    if (response) return response;

    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = updateLeaveTypeSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid leave type update payload.', 400);
    }

    const result = await updateLeaveType(id, parsed.data);
    if (!result.success) {
      return errorResponse(result.error.code, result.error.message, result.error.status ?? 400);
    }

    return NextResponse.json({ success: true, leaveType: result.leaveType }, { status: 200 });
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to update leave type.', 500);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { response } = await requireAdminUser();
    if (response) return response;

    const { id } = await context.params;
    const result = await deleteLeaveType(id);
    if (!result.success) {
      return errorResponse(result.error.code, result.error.message, result.error.status ?? 400);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to delete leave type.', 500);
  }
}

