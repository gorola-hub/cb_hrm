import { NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse, requireAdminUser } from '@/lib/apiHelpers';
import {
  assignEmployeeShift,
  getShiftManagementSnapshot,
} from '@/service/shift.service';

const assignSchema = z.object({
  userId: z.string().min(1),
  shiftId: z.string().min(1),
  effectiveFrom: z.string().min(1),
  effectiveTo: z.string().nullable().optional(),
  autoClosePrevious: z.boolean().optional().default(true),
});

export async function GET(request: Request) {
  try {
    const { response } = await requireAdminUser();
    if (response) return response;

    const { searchParams } = new URL(request.url);
    const data = await getShiftManagementSnapshot({
      userId: searchParams.get('userId') || undefined,
      shiftId: searchParams.get('shiftId') || undefined,
    });

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to load shift assignments.', 500);
  }
}

export async function POST(request: Request) {
  try {
    const { response } = await requireAdminUser();
    if (response) return response;

    const body = await request.json().catch(() => null);
    const parsed = assignSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid shift assignment payload.', 400);
    }

    const result = await assignEmployeeShift(parsed.data);
    if (!result.success) {
      return errorResponse(result.error.code, result.error.message, result.error.status ?? 400);
    }

    return NextResponse.json({ success: true, assignment: result.assignment }, { status: 201 });
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to assign employee shift.', 500);
  }
}

