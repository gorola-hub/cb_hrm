import { NextResponse } from 'next/server';
import { errorResponse, requireAdminUser } from '@/lib/apiHelpers';
import { getISTDateString } from '@/lib/dateUtils';
import { getLiveRoster } from '@/service/adminAttendance.service';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  try {
    const { response } = await requireAdminUser();
    if (response) return response;

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date') || getISTDateString();

    if (!DATE_REGEX.test(dateParam)) {
      return errorResponse('VALIDATION_ERROR', 'Invalid date format. Expected YYYY-MM-DD.', 400);
    }

    const data = await getLiveRoster({
      date: dateParam,
      shiftId: searchParams.get('shiftId') || undefined,
      roleCode: searchParams.get('roleCode') || undefined,
      designationCode: searchParams.get('designationCode') || undefined,
      status: searchParams.get('status') || undefined,
      search: searchParams.get('search') || undefined,
    });

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to load live attendance roster.', 500);
  }
}

