import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const MASTER_LEAVE_TYPES = [
  {
    code: 'CASUAL',
    name: 'Casual Leave',
    description: 'Personal or urgent time off',
    defaultAnnualDays: 12,
    allowCarryForward: false,
    maxCarryForwardDays: 0,
    isPaid: true,
    isActive: true,
  },
  {
    code: 'SICK',
    name: 'Sick Leave',
    description: 'Medical and health recovery leave',
    defaultAnnualDays: 12,
    allowCarryForward: false,
    maxCarryForwardDays: 0,
    isPaid: true,
    isActive: true,
  },
  {
    code: 'PRIVILEGED',
    name: 'Privileged Leave',
    description: 'Planned annual vacation leave with carry-forward',
    defaultAnnualDays: 15,
    allowCarryForward: true,
    maxCarryForwardDays: 10,
    isPaid: true,
    isActive: true,
  },
];

const MASTER_SHIFTS: Array<{
  code: string;
  displayName: string;
  startTime: string;
  durationMins: number;
  graceMinutes: number;
}> = [
  {
    code: 'SHIFT_1700',
    displayName: '17:00 - 01:30 IST',
    startTime: '17:00',
    durationMins: 510,
    graceMinutes: 15,
  },
  {
    code: 'SHIFT_1730',
    displayName: '17:30 - 02:00 IST',
    startTime: '17:30',
    durationMins: 510,
    graceMinutes: 15,
  },
  {
    code: 'SHIFT_1800',
    displayName: '18:00 - 02:30 IST',
    startTime: '18:00',
    durationMins: 510,
    graceMinutes: 15,
  },
  {
    code: 'SHIFT_1830',
    displayName: '18:30 - 03:00 IST',
    startTime: '18:30',
    durationMins: 510,
    graceMinutes: 15,
  },
  {
    code: 'SHIFT_1900',
    displayName: '19:00 - 03:30 IST',
    startTime: '19:00',
    durationMins: 510,
    graceMinutes: 15,
  },
  {
    code: 'SHIFT_1930',
    displayName: '19:30 - 04:00 IST',
    startTime: '19:30',
    durationMins: 510,
    graceMinutes: 15,
  },
];

async function main() {
  console.log('🌱 Starting Capital Bridge HRM Database Seeding...');

  // 1. Seed or Upsert Master Shifts
  for (const shift of MASTER_SHIFTS) {
    const record = await prisma.shift.upsert({
      where: { code: shift.code },
      update: {
        displayName: shift.displayName,
        startTime: shift.startTime,
        durationMins: shift.durationMins,
        graceMinutes: shift.graceMinutes,
        isActive: true,
      },
      create: {
        code: shift.code,
        displayName: shift.displayName,
        startTime: shift.startTime,
        durationMins: shift.durationMins,
        graceMinutes: shift.graceMinutes,
        isActive: true,
      },
    });
    console.log(`  ✓ Shift seeded: ${record.code} (${record.displayName})`);
  }

  // 1b. Seed or Upsert Master Leave Types
  const seededLeaveTypes = [];
  for (const lt of MASTER_LEAVE_TYPES) {
    const leaveType = await prisma.leaveTypeConfig.upsert({
      where: { code: lt.code },
      update: {
        name: lt.name,
        description: lt.description,
      },
      create: lt,
    });
    seededLeaveTypes.push(leaveType);
    console.log(`  ✓ Leave type seeded: ${leaveType.code} (${leaveType.defaultAnnualDays}d)`);
  }

  // 2. Check Roles (Create default roles only if completely empty / fresh DB)
  let adminRole = await prisma.role.findFirst({ where: { code: 'ADMIN' } });
  if (!adminRole) {
    adminRole = await prisma.role.create({
      data: {
        id: 'role_admin_default',
        code: 'ADMIN',
        name: 'Admin',
      },
    });
    console.log('  ✓ Seeded fallback ADMIN role.');
  }

  let brokerRole = await prisma.role.findFirst({ where: { code: 'BROKER' } });
  if (!brokerRole) {
    brokerRole = await prisma.role.create({
      data: {
        id: 'role_broker_default',
        code: 'BROKER',
        name: 'Broker',
      },
    });
    console.log('  ✓ Seeded fallback BROKER role.');
  }

  // 3. Ensure Local Development Accounts exist for ease of login
  const adminEmail = 'admin@capitalbridgelogistics.com';
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('Admin123!', 10);
    await prisma.$executeRaw`
      INSERT INTO "users" ("id", "name", "email", "passwordHash", "roleId", "isActive", "createdAt", "updatedAt")
      VALUES ('user_admin_dev', 'System Administrator', ${adminEmail}, ${passwordHash}, ${adminRole.id}, true, NOW(), NOW())
      ON CONFLICT ("email") DO NOTHING
    `;
    console.log(`  ✓ Created development user: ${adminEmail}`);
  }

  const brokerEmail = 'broker@capitalbridgelogistics.com';
  const existingBroker = await prisma.user.findUnique({ where: { email: brokerEmail } });
  let brokerUserId = existingBroker?.id;
  if (!existingBroker) {
    const passwordHash = await bcrypt.hash('Broker123!', 10);
    brokerUserId = 'user_broker_dev';
    await prisma.$executeRaw`
      INSERT INTO "users" ("id", "name", "email", "passwordHash", "roleId", "isActive", "empId", "alias", "createdAt", "updatedAt")
      VALUES (${brokerUserId}, 'Test Broker', ${brokerEmail}, ${passwordHash}, ${brokerRole.id}, true, 'EMP001', 'BrokerOne', NOW(), NOW())
      ON CONFLICT ("email") DO NOTHING
    `;
    console.log(`  ✓ Created development user: ${brokerEmail}`);
  }

  // 4. Assign Default Shift (SHIFT_1900) to Test Broker if not already assigned
  const shift1900 = await prisma.shift.findUnique({ where: { code: 'SHIFT_1900' } });
  if (brokerUserId && shift1900) {
    const existingAssignment = await prisma.employeeShift.findFirst({
      where: { userId: brokerUserId },
    });
    if (!existingAssignment) {
      await prisma.employeeShift.create({
        data: {
          userId: brokerUserId,
          shiftId: shift1900.id,
          effectiveFrom: new Date('2026-01-01'),
        },
      });
      console.log(`  ✓ Assigned SHIFT_1900 to development broker (${brokerEmail})`);
    }
  }

  // 5. Ensure baseline current-year leave balances for active users without overwriting custom quotas
  const currentYear = new Date().getUTCFullYear();
  const activeUsers = await prisma.user.findMany({ where: { isActive: true }, select: { id: true } });
  for (const u of activeUsers) {
    for (const lt of seededLeaveTypes) {
      await prisma.leaveBalance.upsert({
        where: {
          userId_leaveTypeId_year: {
            userId: u.id,
            leaveTypeId: lt.id,
            year: currentYear,
          },
        },
        update: {},
        create: {
          userId: u.id,
          leaveTypeId: lt.id,
          year: currentYear,
          entitledDays: lt.defaultAnnualDays,
          carriedForwardDays: 0,
          adjustedDays: 0,
        },
      });
    }
  }
  console.log(`  ✓ Provisioned baseline ${currentYear} leave balances for ${activeUsers.length} active user(s).`);

  console.log('✅ HRM Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

