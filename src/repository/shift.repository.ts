import { prisma } from '@/lib/prisma';

const assignmentInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      empId: true,
      alias: true,
      role: {
        select: { code: true, name: true },
      },
      designation: {
        select: { name: true },
      },
    },
  },
  shift: true,
};

export async function findAllShiftsWithCounts() {
  const now = new Date();
  const shifts = await prisma.shift.findMany({
    orderBy: [{ isActive: 'desc' }, { startTime: 'asc' }],
    include: {
      _count: {
        select: {
          employeeShifts: {
            where: {
              effectiveFrom: { lte: now },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
            },
          },
        },
      },
    },
  });
  return shifts;
}

export async function findShiftById(id: string) {
  return prisma.shift.findUnique({ where: { id } });
}

export async function findShiftByCode(code: string) {
  return prisma.shift.findUnique({ where: { code: code.trim().toUpperCase() } });
}

export async function createShiftRecord(data: {
  code: string;
  displayName: string;
  startTime: string;
  durationMins: number;
  graceMinutes: number;
  isActive: boolean;
}) {
  return prisma.shift.create({ data });
}

export async function updateShiftRecord(
  id: string,
  data: {
    displayName?: string;
    startTime?: string;
    durationMins?: number;
    graceMinutes?: number;
    isActive?: boolean;
  }
) {
  return prisma.shift.update({
    where: { id },
    data,
  });
}

export async function findEmployeeShiftAssignments(filters?: {
  userId?: string;
  shiftId?: string;
}) {
  return prisma.employeeShift.findMany({
    where: {
      ...(filters?.userId ? { userId: filters.userId } : {}),
      ...(filters?.shiftId ? { shiftId: filters.shiftId } : {}),
    },
    include: assignmentInclude,
    orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function findActiveEmployeesForShifts() {
  return prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      empId: true,
      alias: true,
      role: { select: { code: true, name: true } },
    },
    orderBy: [{ empId: 'asc' }, { name: 'asc' }],
  });
}

export async function findEmployeeShiftById(id: string) {
  return prisma.employeeShift.findUnique({
    where: { id },
    include: assignmentInclude,
  });
}

export async function findShiftUserById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true },
  });
}

export async function findOverlappingEmployeeShifts(
  userId: string,
  effectiveFrom: Date,
  effectiveTo: Date | null,
  excludeId?: string
) {
  return prisma.employeeShift.findMany({
    where: {
      userId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      ...(effectiveTo ? { effectiveFrom: { lte: effectiveTo } } : {}),
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }],
    },
    include: { shift: true },
  });
}

export async function assignShiftInTransaction(data: {
  userId: string;
  shiftId: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  autoClosePrevious: boolean;
}) {
  return prisma.$transaction(async (tx) => {
    if (data.autoClosePrevious) {
      const closeBoundary = new Date(data.effectiveFrom.getTime() - 1000);
      await tx.employeeShift.updateMany({
        where: {
          userId: data.userId,
          effectiveTo: null,
          effectiveFrom: { lt: data.effectiveFrom },
        },
        data: {
          effectiveTo: closeBoundary,
        },
      });
    }

    return tx.employeeShift.create({
      data: {
        userId: data.userId,
        shiftId: data.shiftId,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo,
      },
      include: assignmentInclude,
    });
  });
}

export async function updateEmployeeShiftRecord(
  id: string,
  data: {
    shiftId?: string;
    effectiveFrom?: Date;
    effectiveTo?: Date | null;
  }
) {
  return prisma.employeeShift.update({
    where: { id },
    data,
    include: assignmentInclude,
  });
}

export async function deleteEmployeeShiftRecord(id: string) {
  return prisma.employeeShift.delete({
    where: { id },
  });
}

