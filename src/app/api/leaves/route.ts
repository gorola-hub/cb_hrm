import { NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse, requireAuthenticatedUser } from '@/lib/apiHelpers';
import { getISTDateString } from '@/lib/dateUtils';
import { getMyLeaves, submitLeaveRequest } from '@/service/leave.service';

const submitLeaveSchema = z
  .object({
    leaveTypeId: z.string().min(1).optional(),
    leaveTypeCode: z.string().min(1).optional(),
    startDate: z.string(),
    endDate: z.string(),
    reason: z.string().optional().default(''),
  })
  .refine((data) => Boolean(data.leaveTypeId || data.leaveTypeCode), {
    message: 'Please select a valid leave type.',
  });

export async function GET(request?: Request) {
  try {
    const { user, response } = await requireAuthenticatedUser();
    if (response || !user) return response!;

    const defaultYear = parseInt(getISTDateString().slice(0, 4), 10);
    let year = defaultYear;
    if (request) {
      const { searchParams } = new URL(request.url);
      const yearParam = searchParams.get('year');
      if (yearParam) {
        const parsedYear = parseInt(yearParam, 10);
        if (Number.isInteger(parsedYear) && parsedYear >= 2020 && parsedYear <= 2100) {
          year = parsedYear;
        }
      }
    }

    const data = await getMyLeaves(user.id, year);
    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to load leave requests.', 500);
  }
}

export async function POST(request: Request) {
  try {
    const { user, response } = await requireAuthenticatedUser();
    if (response || !user) return response!;

    const body = await request.json().catch(() => null);
    const parsed = submitLeaveSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        'Please select a valid leave type, start date, and end date.',
        400
      );
    }

    const result = await submitLeaveRequest(user.id, parsed.data);
    if (!result.success) {
      return errorResponse(result.error.code, result.error.message, result.error.status ?? 400);
    }

    return NextResponse.json({ success: true, leave: result.leave }, { status: 201 });
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to submit leave request.', 500);
  }
}
