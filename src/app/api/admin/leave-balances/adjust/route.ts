import { NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse, requireAdminUser } from '@/lib/apiHelpers';
import { adjustEmployeeLeaveBalance } from '@/service/leaveBalance.service';

const adjustSchema = z.object({
  userId: z.string().min(1),
  leaveTypeId: z.string().min(1),
  year: z.number().int().min(2020).max(2100),
  entitledDays: z.number().optional(),
  adjustedDays: z.number().optional(),
  notes: z.string().optional().nullable(),
});

export async function PUT(request: Request) {
  try {
    const { response } = await requireAdminUser();
    if (response) return response;

    const body = await request.json().catch(() => null);
    const parsed = adjustSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid leave balance adjustment payload.', 400);
    }

    const result = await adjustEmployeeLeaveBalance(parsed.data);
    if (!result.success) {
      return errorResponse(result.error.code, result.error.message, result.error.status ?? 400);
    }

    return NextResponse.json({ success: true, balance: result.balance }, { status: 200 });
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to adjust employee leave balance.', 500);
  }
}

