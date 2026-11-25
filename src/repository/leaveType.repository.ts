import { prisma } from '@/lib/prisma';

export async function findAllLeaveTypes(activeOnly: boolean = false) {
  return prisma.leaveTypeConfig.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: [{ isPaid: 'desc' }, { code: 'asc' }],
  });
}

export async function findLeaveTypeById(id: string) {
  return prisma.leaveTypeConfig.findUnique({
    where: { id },
  });
}

export async function findLeaveTypeByCode(code: string) {
  return prisma.leaveTypeConfig.findUnique({
    where: { code: code.trim().toUpperCase() },
  });
}

export async function createLeaveTypeRecord(data: {
  code: string;
  name: string;
  description?: string | null;
  defaultAnnualDays: number;
  allowCarryForward: boolean;
  maxCarryForwardDays: number;
  isPaid: boolean;
  isActive: boolean;
}) {
  return prisma.leaveTypeConfig.create({ data });
}

export async function updateLeaveTypeRecord(
  id: string,
  data: {
    name?: string;
    description?: string | null;
    defaultAnnualDays?: number;
    allowCarryForward?: boolean;
    maxCarryForwardDays?: number;
    isPaid?: boolean;
    isActive?: boolean;
  }
) {
  return prisma.leaveTypeConfig.update({
    where: { id },
    data,
  });
}

export async function countLeaveTypeReferences(id: string) {
  const [requestCount, balanceCount] = await Promise.all([
    prisma.leaveRequest.count({ where: { leaveTypeId: id } }),
    prisma.leaveBalance.count({ where: { leaveTypeId: id } }),
  ]);
  return { requestCount, balanceCount };
}

export async function deleteLeaveTypeRecord(id: string) {
  return prisma.leaveTypeConfig.delete({
    where: { id },
  });
}

