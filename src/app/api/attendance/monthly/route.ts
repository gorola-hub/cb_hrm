import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getMonthlyAttendance } from '@/service/attendance.service';
import { getISTDateString } from '@/lib/dateUtils';

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AUTH_UNAUTHORIZED',
            message: 'You must be signed in to view attendance records.',
          },
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month') || getISTDateString().slice(0, 7);

    if (!MONTH_REGEX.test(monthParam)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid month format. Expected YYYY-MM.',
          },
        },
        { status: 400 }
      );
    }

    const data = await getMonthlyAttendance(session.user.id, monthParam);

    return NextResponse.json(
      {
        success: true,
        data,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while fetching monthly attendance.',
        },
      },
      { status: 500 }
    );
  }
}

