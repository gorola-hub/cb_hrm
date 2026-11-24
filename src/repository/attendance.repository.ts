import { prisma } from '@/lib/prisma';
import { AttendanceStatus } from '@prisma/client';

export async function findActiveAttendanceByUserId(userId: string) {
  return prisma.attendanceRecord.findFirst({
    where: {
      userId,
      status: 'IN_PROGRESS',
    },
    include: {
      shift: true,
      breaks: {
        orderBy: { breakStart: 'asc' },
      },
    },
  });
}

export async function findAttendanceByUserIdAndWorkDate(userId: string, workDate: string) {
  return prisma.attendanceRecord.findUnique({
    where: {
      userId_workDate: {
        userId,
        workDate,
      },
    },
    include: {
      shift: true,
      breaks: {
        orderBy: { breakStart: 'asc' },
      },
    },
  });
}

export async function getUserActiveShift(userId: string) {
  const assignment = await prisma.employeeShift.findFirst({
    where: {
      userId,
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
    },
    orderBy: { effectiveFrom: 'desc' },
    include: {
      shift: true,
    },
  });

  return assignment?.shift ?? null;
}

export async function createAttendanceRecord(data: {
  userId: string;
  shiftId?: string | null;
  workDate: string;
  firstPunchIn: Date;
  isLate: boolean;
  lateMinutes: number;
  status: AttendanceStatus;
}) {
  return prisma.attendanceRecord.create({
    data: {
      userId: data.userId,
      shiftId: data.shiftId,
      workDate: data.workDate,
      firstPunchIn: data.firstPunchIn,
      isLate: data.isLate,
      lateMinutes: data.lateMinutes,
      status: data.status,
    },
    include: {
      shift: true,
      breaks: true,
    },
  });
}

export async function closeAttendanceRecord(
  id: string,
  data: {
    lastPunchOut: Date;
    grossMinutes: number;
    totalBreakMinutes: number;
    netWorkMinutes: number;
    status: AttendanceStatus;
  }
) {
  return prisma.attendanceRecord.update({
    where: { id },
    data: {
      lastPunchOut: data.lastPunchOut,
      grossMinutes: data.grossMinutes,
      totalBreakMinutes: data.totalBreakMinutes,
      netWorkMinutes: data.netWorkMinutes,
      status: data.status,
    },
    include: {
      shift: true,
      breaks: true,
    },
  });
}

