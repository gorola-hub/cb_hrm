import { prisma } from '@/lib/prisma';
import { LeaveStatus, LeaveType } from '@prisma/client';

const leaveInclude = {
  user: {
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
      designation: {
        select: {
          name: true,
        },
      },
    },
  },
  reviewer: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
};

export async function findOverlappingLeaves(userId: string, startDate: string, endDate: string) {
  return prisma.leaveRequest.findMany({
    where: {
      userId,
      status: {
        in: ['PENDING', 'APPROVED'],
      },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
  });
}

export async function createLeaveRequest(data: {
  userId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
}) {
  return prisma.leaveRequest.create({
    data: {
      userId: data.userId,
      leaveType: data.leaveType,
      startDate: data.startDate,
      endDate: data.endDate,
      totalDays: data.totalDays,
      reason: data.reason,
      status: 'PENDING',
    },
    include: leaveInclude,
  });
}

export async function findLeavesByUserId(userId: string) {
  return prisma.leaveRequest.findMany({
    where: { userId },
    include: leaveInclude,
    orderBy: { createdAt: 'desc' },
  });
}

export async function findLeaveById(id: string) {
  return prisma.leaveRequest.findUnique({
    where: { id },
    include: leaveInclude,
  });
}

export async function findAllLeaves(status?: LeaveStatus) {
  return prisma.leaveRequest.findMany({
    where: status ? { status } : undefined,
    include: leaveInclude,
    orderBy: [{ createdAt: 'desc' }],
  });
}

export async function countPendingLeaves() {
  return prisma.leaveRequest.count({
    where: { status: 'PENDING' },
  });
}

export async function cancelLeaveRequest(id: string) {
  return prisma.leaveRequest.update({
    where: { id },
    data: { status: 'CANCELLED' },
    include: leaveInclude,
  });
}

export async function approveLeaveInTransaction(
  id: string,
  adminId: string,
  workDates: string[],
  adminNotes?: string
) {
  return prisma.$transaction(async (tx) => {
    const updatedLeave = await tx.leaveRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedBy: adminId,
        reviewedAt: new Date(),
        adminNotes: adminNotes ?? null,
      },
      include: leaveInclude,
    });

    for (const workDate of workDates) {
      const existing = await tx.attendanceRecord.findUnique({
        where: {
          userId_workDate: {
            userId: updatedLeave.userId,
            workDate,
          },
        },
      });

      if (!existing) {
        await tx.attendanceRecord.create({
          data: {
            userId: updatedLeave.userId,
            workDate,
            firstPunchIn: new Date(`${workDate}T00:00:00+05:30`),
            status: 'LV',
            grossMinutes: 0,
            totalBreakMinutes: 0,
            netWorkMinutes: 0,
            isLate: false,
            lateMinutes: 0,
          },
        });
      } else if (existing.status === 'A' || existing.status === 'WO' || existing.status === 'LV') {
        await tx.attendanceRecord.update({
          where: { id: existing.id },
          data: { status: 'LV' },
        });
      }
    }

    return updatedLeave;
  });
}

export async function rejectLeaveRequest(id: string, adminId: string, adminNotes: string) {
  return prisma.leaveRequest.update({
    where: { id },
    data: {
      status: 'REJECTED',
      reviewedBy: adminId,
      reviewedAt: new Date(),
      adminNotes,
    },
    include: leaveInclude,
  });
}

