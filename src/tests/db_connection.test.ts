import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';

describe('Database Connection & Relational Schema Integration', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('can query master shifts and returns exactly 6 seeded shifts', async () => {
    const shifts = await prisma.shift.findMany({
      orderBy: { startTime: 'asc' },
    });

    expect(shifts).toHaveLength(6);
    const shiftCodes = shifts.map((s) => s.code);
    expect(shiftCodes).toEqual([
      'SHIFT_1700',
      'SHIFT_1730',
      'SHIFT_1800',
      'SHIFT_1830',
      'SHIFT_1900',
      'SHIFT_1930',
    ]);
  });

  it('can query users joined with role and designations without systemRole column', async () => {
    const users = await prisma.user.findMany({
      take: 1,
      include: {
        role: true,
        designation: true,
        employeeShifts: true,
        attendanceRecords: true,
      },
    });

    expect(Array.isArray(users)).toBe(true);
    if (users.length > 0) {
      const user = users[0];
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('role');
      expect(user.role).toHaveProperty('code');
      // Must NOT have systemRole property on user table
      expect((user as any).systemRole).toBeUndefined();
    }
  });

  it('can query read-only CRM permissions table', async () => {
    const permissions = await prisma.permission.findMany();
    expect(Array.isArray(permissions)).toBe(true);
  });
});

