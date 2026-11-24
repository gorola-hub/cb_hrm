import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { startBreak } from '@/service/break.service';

export async function POST(req?: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AUTH_UNAUTHORIZED',
            message: 'You must be signed in to take a break.',
          },
        },
        { status: 401 }
      );
    }

    let breakTime: Date | undefined;
    if (req && process.env.NODE_ENV !== 'production') {
      try {
        const body = await req.json();
        if (body?.timestamp) {
          breakTime = new Date(body.timestamp);
        }
      } catch {
        // No body
      }
    }

    const result = await startBreak(session.user.id, breakTime);
    if (!result.success) {
      const status = result.error.code === 'BRK_ALREADY_ON_BREAK' ? 409 : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while starting break.',
        },
      },
      { status: 500 }
    );
  }
}

