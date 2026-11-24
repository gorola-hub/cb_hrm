import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { generateSsoToken, getSsoBridgeUrl } from '@/service/sso.service';

export async function GET(_request?: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AUTH_UNAUTHORIZED',
            message: 'You must be signed in to access the CRM bridge.',
          },
        },
        { status: 401 }
      );
    }

    const userPayload = {
      id: session.user.id,
      email: session.user.email,
    };

    const token = generateSsoToken(userPayload);
    const ssoUrl = getSsoBridgeUrl(userPayload);

    return NextResponse.json(
      {
        success: true,
        ssoUrl,
        token,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate SSO token';
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message,
        },
      },
      { status: 500 }
    );
  }
}
