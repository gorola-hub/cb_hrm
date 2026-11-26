import { NextResponse } from 'next/server';
import { errorResponse, requireAdminUser } from '@/lib/apiHelpers';
import { getAttendanceAuditLogs } from '@/service/adminAttendance.service';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { response } = await requireAdminUser();
    if (response) return response;

    const { id } = await context.params;
    const result = await getAttendanceAuditLogs(id);

    if (!result.success) {
      return errorResponse(result.error.code, result.error.message, result.error.status ?? 404);
    }

    return NextResponse.json({ success: true, logs: result.logs }, { status: 200 });
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to load attendance audit logs.', 500);
  }
}

