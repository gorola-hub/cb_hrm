import { NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse, requireAdminUser } from '@/lib/apiHelpers';
import {
  deleteEmployeeShiftAssignment,
  updateEmployeeShiftAssignment,
} from '@/service/shift.service';

const updateAssignmentSchema = z.object({
  shiftId: z.string().min(1).optional(),
  effectiveFrom: z.string().min(1).optional(),
  effectiveTo: z.string().nullable().optional(),
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
    const parsed = updateAssignmentSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid shift assignment update payload.', 400);
    }

    const result = await updateEmployeeShiftAssignment(id, parsed.data);
    if (!result.success) {
      return errorResponse(result.error.code, result.error.message, result.error.status ?? 400);
    }

    return NextResponse.json({ success: true, assignment: result.assignment }, { status: 200 });
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to update shift assignment.', 500);
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
    const result = await deleteEmployeeShiftAssignment(id);
    if (!result.success) {
      return errorResponse(result.error.code, result.error.message, result.error.status ?? 400);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to delete shift assignment.', 500);
  }
}

