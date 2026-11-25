import { NextResponse } from 'next/server';
import { errorResponse, requireAuthenticatedUser } from '@/lib/apiHelpers';
import { listLeaveTypes } from '@/service/leaveType.service';

export async function GET() {
  try {
    const { response } = await requireAuthenticatedUser();
    if (response) return response;

    const leaveTypes = await listLeaveTypes(true);
    return NextResponse.json({ success: true, leaveTypes }, { status: 200 });
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to load leave types.', 500);
  }
}

