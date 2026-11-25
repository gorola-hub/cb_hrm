import { NextResponse } from 'next/server';
import { errorResponse, requireAdminUser } from '@/lib/apiHelpers';
import { approveLeaveRequest } from '@/service/leave.service';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAdminUser();
    if (response || !user) return response!;

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const adminNotes = typeof body?.adminNotes === 'string' ? body.adminNotes : undefined;

    const result = await approveLeaveRequest(id, user.id, adminNotes);
    if (!result.success) {
      return errorResponse(result.error.code, result.error.message, result.error.status ?? 400);
    }

    return NextResponse.json({ success: true, leave: result.leave }, { status: 200 });
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to approve leave request.', 500);
  }
}

