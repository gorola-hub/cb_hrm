import { NextResponse } from 'next/server';
import { errorResponse, requireAdminUser } from '@/lib/apiHelpers';
import { markStaleShifts } from '@/service/adminAttendance.service';

export async function POST(request: Request) {
  try {
    const { response } = await requireAdminUser();
    if (response) return response;

    const body = await request.json().catch(() => ({}));
    const refTime =
      typeof body?.referenceTime === 'string' && !Number.isNaN(new Date(body.referenceTime).getTime())
        ? new Date(body.referenceTime)
        : new Date();

    const result = await markStaleShifts(refTime);
    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to run stale shift check.', 500);
  }
}

