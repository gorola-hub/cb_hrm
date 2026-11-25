import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export function errorResponse(code: string, message: string, status: number = 400) {
  return NextResponse.json(
    {
      success: false,
      error: { code, message },
    },
    { status }
  );
}

export async function requireAuthenticatedUser() {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      user: null,
      response: errorResponse('AUTH_UNAUTHORIZED', 'You must be signed in to perform this action.', 401),
    };
  }
  return { user: session.user, response: null };
}

export async function requireAdminUser() {
  const { user, response } = await requireAuthenticatedUser();
  if (response || !user) {
    return { user: null, response };
  }
  if (user.role?.code !== 'ADMIN') {
    return {
      user: null,
      response: errorResponse(
        'AUTH_FORBIDDEN',
        'Administrator privileges are required to perform this action.',
        403
      ),
    };
  }
  return { user, response: null };
}

