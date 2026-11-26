import { NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse, requireAdminUser } from '@/lib/apiHelpers';
import { updateShift } from '@/service/shift.service';

const updateShiftSchema = z.object({
  displayName: z.string().min(1).optional(),
  startTime: z.string().min(1).optional(),
  durationMins: z.number().int().optional(),
  graceMinutes: z.number().int().optional(),
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
    const parsed = updateShiftSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid shift update payload.', 400);
    }

    const result = await updateShift(id, parsed.data);
    if (!result.success) {
      return errorResponse(result.error.code, result.error.message, result.error.status ?? 400);
    }

    return NextResponse.json({ success: true, shift: result.shift }, { status: 200 });
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to update shift.', 500);
  }
}

