import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateUser } from '@/service/auth.service';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AUTH_INVALID_CREDENTIALS',
            message: 'Invalid email or password. Please verify your company credentials.',
          },
        },
        { status: 400 }
      );
    }

    const result = await authenticateUser(parsed.data);
    if (!result.success) {
      const status = result.error.code === 'AUTH_ACCOUNT_INACTIVE' ? 403 : 401;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'AUTH_INTERNAL_ERROR',
          message: 'An unexpected authentication error occurred.',
        },
      },
      { status: 500 }
    );
  }
}

