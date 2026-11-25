import { NextResponse } from 'next/server';
import { LeaveStatus } from '@prisma/client';
import { errorResponse, requireAdminUser } from '@/lib/apiHelpers';
import { listAdminLeaves } from '@/service/leave.service';

const VALID_STATUSES: LeaveStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];

export async function GET(request: Request) {
  try {
    const { response } = await requireAdminUser();
    if (response) return response;

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');

    let statusFilter: LeaveStatus | undefined;
    if (statusParam && statusParam !== 'ALL') {
      if (!VALID_STATUSES.includes(statusParam as LeaveStatus)) {
        return errorResponse('VALIDATION_ERROR', 'Invalid leave status filter.', 400);
      }
      statusFilter = statusParam as LeaveStatus;
    }

    const data = await listAdminLeaves(statusFilter);
    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to load company leave requests.', 500);
  }
}

