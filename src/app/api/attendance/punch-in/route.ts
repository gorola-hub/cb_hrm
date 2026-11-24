import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { punchIn } from '@/service/attendance.service';

export async function POST(req?: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AUTH_UNAUTHORIZED',
            message: 'You must be signed in to record attendance.',
          },
        },
        { status: 401 }
      );
    }

    let punchTime: Date | undefined;
    if (req && process.env.NODE_ENV !== 'production') {
      try {
        const body = await req.json();
        if (body?.timestamp) {
          punchTime = new Date(body.timestamp);
        }
      } catch {
        // No body
      }
    }

    const result = await punchIn(session.user.id, punchTime);
    if (!result.success) {
      const status = result.error.code === 'ATT_ALREADY_PUNCHED_IN' ? 409 : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while processing punch-in.',
        },
      },
      { status: 500 }
    );
  }
}
