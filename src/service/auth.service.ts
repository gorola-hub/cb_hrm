import bcrypt from 'bcryptjs';
import { findUserWithCredentialsByEmail } from '@/repository/auth.repository';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  empId: string | null;
  alias: string | null;
  isActive: boolean;
  role: {
    id: string;
    code: string;
    name: string;
  };
  designation: {
    id: string;
    code: string;
    name: string;
  } | null;
}

export type AuthResult =
  | {
      success: true;
      user: AuthenticatedUser;
    }
  | {
      success: false;
      error: {
        code: string;
        message: string;
      };
    };

export async function authenticateUser(credentials: {
  email?: string | null;
  password?: string | null;
}): Promise<AuthResult> {
  const email = credentials.email?.trim().toLowerCase();
  const password = credentials.password;

  if (!email || !password) {
    return {
      success: false,
      error: {
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Invalid email or password. Please verify your company credentials.',
      },
    };
  }

  const user = await findUserWithCredentialsByEmail(email);
  if (!user) {
    return {
      success: false,
      error: {
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Invalid email or password. Please verify your company credentials.',
      },
    };
  }

  // Deactivated user check (FR-AUTH-002, TS-AUTH-002)
  if (!user.isActive) {
    return {
      success: false,
      error: {
        code: 'AUTH_ACCOUNT_INACTIVE',
        message: 'Your account is deactivated in the CRM. Please contact your administrator.',
      },
    };
  }

  // Bcrypt password verification (FR-AUTH-001, TS-AUTH-003)
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    return {
      success: false,
      error: {
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Invalid email or password. Please verify your company credentials.',
      },
    };
  }

  // Safe user profile without passwordHash
  const safeUser: AuthenticatedUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    empId: user.empId,
    alias: user.alias,
    isActive: user.isActive,
    role: {
      id: user.role.id,
      code: user.role.code,
      name: user.role.name,
    },
    designation: user.designation
      ? {
          id: user.designation.id,
          code: user.designation.code,
          name: user.designation.name,
        }
      : null,
  };

  return {
    success: true,
    user: safeUser,
  };
}

