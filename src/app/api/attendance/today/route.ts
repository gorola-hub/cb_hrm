import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTodayShiftState } from '@/service/attendance.service';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AUTH_UNAUTHORIZED',
            message: 'You must be signed in to view shift status.',
          },
        },
        { status: 401 }
      );
    }

    const state = await getTodayShiftState(session.user.id);
    return NextResponse.json({ success: true, ...state }, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while fetching shift status.',
        },
      },
      { status: 500 }
    );
  }
}

