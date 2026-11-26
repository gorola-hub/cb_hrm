import { NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse, requireAdminUser } from '@/lib/apiHelpers';
import { createShift, listShifts } from '@/service/shift.service';

const createShiftSchema = z.object({
  code: z.string().min(1),
  displayName: z.string().min(1),
  startTime: z.string().min(1),
  durationMins: z.number().int(),
  graceMinutes: z.number().int(),
  isActive: z.boolean().optional().default(true),
});

export async function GET() {
  try {
    const { response } = await requireAdminUser();
    if (response) return response;

    const shifts = await listShifts();
    return NextResponse.json({ success: true, shifts }, { status: 200 });
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to load shifts.', 500);
  }
}

export async function POST(request: Request) {
  try {
    const { response } = await requireAdminUser();
    if (response) return response;

    const body = await request.json().catch(() => null);
    const parsed = createShiftSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid shift payload.', 400);
    }

    const result = await createShift(parsed.data);
    if (!result.success) {
      return errorResponse(result.error.code, result.error.message, result.error.status ?? 400);
    }

    return NextResponse.json({ success: true, shift: result.shift }, { status: 201 });
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to create shift.', 500);
  }
}

