import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { endBreak } from '@/service/break.service';

export async function POST(req?: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AUTH_UNAUTHORIZED',
            message: 'You must be signed in to end a break.',
          },
        },
        { status: 401 }
      );
    }

    let resumeTime: Date | undefined;
    if (req && process.env.NODE_ENV !== 'production') {
      try {
        const body = await req.json();
        if (body?.timestamp) {
          resumeTime = new Date(body.timestamp);
        }
      } catch {
        // No body
      }
    }

    const result = await endBreak(session.user.id, resumeTime);
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while ending break.',
        },
      },
      { status: 500 }
    );
  }
}

