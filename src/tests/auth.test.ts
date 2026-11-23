import { describe, it, expect, afterAll } from 'vitest';
import { authenticateUser } from '@/service/auth.service';
import { prisma } from '@/lib/prisma';

describe('Authentication & User Synchronization (TS-AUTH)', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('TS-AUTH-001: Successfully authenticates active employee with correct password', async () => {
    const result = await authenticateUser({
      email: 'broker@capitalbridgelogistics.com',
      password: 'Broker123!',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('broker@capitalbridgelogistics.com');
      expect(result.user.role.code).toBe('BROKER');
      expect((result.user as any).passwordHash).toBeUndefined();
    }
  });

  it('TS-AUTH-002: Blocks login for deactivated account with AUTH_ACCOUNT_INACTIVE', async () => {
    // roy@capitalbridgelogistics.com is an existing deactivated user in CRM (isActive = false)
    // Ensure test user with isActive = false exists
    const inactiveEmail = 'inactive_test@capitalbridgelogistics.com';
    let inactiveUser = await prisma.user.findUnique({ where: { email: inactiveEmail } });
    if (!inactiveUser) {
      const brokerRole = await prisma.role.findFirst({ where: { code: 'BROKER' } });
      await prisma.$executeRaw`
        INSERT INTO "users" ("id", "name", "email", "passwordHash", "roleId", "isActive", "createdAt", "updatedAt")
        VALUES ('user_inactive_test', 'Inactive Test', ${inactiveEmail}, '$2a$10$D2B9j5l8Z41Vf9iTjFj9ueP.X4mGZ49j9Qz75Q.zX6Q/Vv.Yp6XmK', ${brokerRole?.id || 'role_broker_default'}, false, NOW(), NOW())
        ON CONFLICT ("email") DO UPDATE SET "isActive" = false
      `;
    }

    const result = await authenticateUser({
      email: inactiveEmail,
      password: 'AnyPassword123!',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('AUTH_ACCOUNT_INACTIVE');
      expect(result.error.message).toBe(
        'Your account is deactivated in the CRM. Please contact your administrator.'
      );
    }
  });

  it('TS-AUTH-003: Rejects invalid password with AUTH_INVALID_CREDENTIALS', async () => {
    const result = await authenticateUser({
      email: 'broker@capitalbridgelogistics.com',
      password: 'WrongPassword!',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('AUTH_INVALID_CREDENTIALS');
      expect(result.error.message).toBe(
        'Invalid email or password. Please verify your company credentials.'
      );
    }
  });

  it('TS-AUTH-003b: Rejects non-existent email with AUTH_INVALID_CREDENTIALS', async () => {
    const result = await authenticateUser({
      email: 'does_not_exist@capitalbridgelogistics.com',
      password: 'Password123!',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('AUTH_INVALID_CREDENTIALS');
    }
  });

  it('TS-AUTH-004: Resolves role via role.code and designation without systemRole property', async () => {
    const result = await authenticateUser({
      email: 'admin@capitalbridgelogistics.com',
      password: 'Admin123!',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.user.role).toBeDefined();
      expect(result.user.role.code).toBe('ADMIN');
      expect((result.user as any).systemRole).toBeUndefined();
    }
  });
});

