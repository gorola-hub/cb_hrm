import { NextResponse } from 'next/server';
import { errorResponse, requireAdminUser } from '@/lib/apiHelpers';
import { getISTDateString } from '@/lib/dateUtils';
import { listCompanyLeaveBalances } from '@/service/leaveBalance.service';

export async function GET(request: Request) {
  try {
    const { response } = await requireAdminUser();
    if (response) return response;

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const userId = searchParams.get('userId') || undefined;
    const defaultYear = parseInt(getISTDateString().slice(0, 4), 10);
    const year = yearParam ? parseInt(yearParam, 10) : defaultYear;

    if (!Number.isInteger(year) || year < 2020 || year > 2100) {
      return errorResponse('VALIDATION_ERROR', 'Invalid year parameter.', 400);
    }

    const data = await listCompanyLeaveBalances(year, userId);
    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to load company leave balances.', 500);
  }
}

