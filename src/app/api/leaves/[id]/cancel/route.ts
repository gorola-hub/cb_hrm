import { NextResponse } from 'next/server';
import { errorResponse, requireAuthenticatedUser } from '@/lib/apiHelpers';
import { cancelMyLeave } from '@/service/leave.service';

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAuthenticatedUser();
    if (response || !user) return response!;

    const { id } = await context.params;
    const result = await cancelMyLeave(user.id, id);

    if (!result.success) {
      return errorResponse(result.error.code, result.error.message, result.error.status ?? 400);
    }

    return NextResponse.json({ success: true, leave: result.leave }, { status: 200 });
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to cancel leave request.', 500);
  }
}

