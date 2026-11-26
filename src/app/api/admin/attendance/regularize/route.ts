import { NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse, requireAdminUser } from '@/lib/apiHelpers';
import { regularizeAttendance } from '@/service/adminAttendance.service';

const regularizeSchema = z.object({
  attendanceRecordId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  workDate: z.string().optional(),
  firstPunchIn: z.string().nullable().optional(),
  lastPunchOut: z.string().nullable().optional(),
  totalBreakMinutesOverride: z.number().int().min(0).optional(),
  status: z.enum(['IN_PROGRESS', 'P', 'HD', 'A', 'WO', 'LV', 'ANOMALY_STALE']).optional(),
  reason: z.string().optional().default(''),
});

export async function POST(request: Request) {
  try {
    const { user, response } = await requireAdminUser();
    if (response || !user) return response!;

    const body = await request.json().catch(() => null);
    const parsed = regularizeSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid regularization payload.', 400);
    }

    const result = await regularizeAttendance(user.id, parsed.data);
    if (!result.success) {
      return errorResponse(result.error.code, result.error.message, result.error.status ?? 400);
    }

    return NextResponse.json(
      {
        success: true,
        record: result.record,
        auditLog: result.auditLog,
      },
      { status: 200 }
    );
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to regularize attendance record.', 500);
  }
}

