import { prisma } from '@/lib/prisma';

export async function findBalancesForUserYear(userId: string, year: number) {
  return prisma.leaveBalance.findMany({
    where: { userId, year },
    include: { leaveType: true },
    orderBy: { leaveType: { code: 'asc' } },
  });
}

export async function findBalance(userId: string, leaveTypeId: string, year: number) {
  return prisma.leaveBalance.findUnique({
    where: {
      userId_leaveTypeId_year: {
        userId,
        leaveTypeId,
        year,
      },
    },
    include: { leaveType: true },
  });
}

export async function upsertLeaveBalance(data: {
  userId: string;
  leaveTypeId: string;
  year: number;
  entitledDays: number;
  carriedForwardDays?: number;
  adjustedDays?: number;
  notes?: string | null;
}) {
  return prisma.leaveBalance.upsert({
    where: {
      userId_leaveTypeId_year: {
        userId: data.userId,
        leaveTypeId: data.leaveTypeId,
        year: data.year,
      },
    },
    update: {
      entitledDays: data.entitledDays,
      ...(data.carriedForwardDays !== undefined
        ? { carriedForwardDays: data.carriedForwardDays }
        : {}),
      ...(data.adjustedDays !== undefined ? { adjustedDays: data.adjustedDays } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
    },
    create: {
      userId: data.userId,
      leaveTypeId: data.leaveTypeId,
      year: data.year,
      entitledDays: data.entitledDays,
      carriedForwardDays: data.carriedForwardDays ?? 0,
      adjustedDays: data.adjustedDays ?? 0,
      notes: data.notes ?? null,
    },
    include: { leaveType: true },
  });
}

export async function upsertCarriedForward(data: {
  userId: string;
  leaveTypeId: string;
  year: number;
  defaultEntitledDays: number;
  carriedForwardDays: number;
}) {
  return prisma.leaveBalance.upsert({
    where: {
      userId_leaveTypeId_year: {
        userId: data.userId,
        leaveTypeId: data.leaveTypeId,
        year: data.year,
      },
    },
    update: {
      carriedForwardDays: data.carriedForwardDays,
    },
    create: {
      userId: data.userId,
      leaveTypeId: data.leaveTypeId,
      year: data.year,
      entitledDays: data.defaultEntitledDays,
      carriedForwardDays: data.carriedForwardDays,
      adjustedDays: 0,
    },
    include: { leaveType: true },
  });
}

export async function findActiveUsersForBalances(userId?: string) {
  return prisma.user.findMany({
    where: {
      isActive: true,
      ...(userId ? { id: userId } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      empId: true,
      alias: true,
      role: {
        select: {
          code: true,
          name: true,
        },
      },
    },
    orderBy: [{ empId: 'asc' }, { name: 'asc' }],
  });
}

