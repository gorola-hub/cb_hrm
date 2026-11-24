import { prisma } from '@/lib/prisma';

export async function findActiveBreakForAttendance(attendanceRecordId: string) {
  return prisma.breakRecord.findFirst({
    where: {
      attendanceRecordId,
      breakEnd: null,
    },
  });
}

export async function createBreakRecord(attendanceRecordId: string, breakStart: Date) {
  return prisma.breakRecord.create({
    data: {
      attendanceRecordId,
      breakStart,
    },
  });
}

export async function closeBreakRecordInTransaction(
  breakId: string,
  attendanceRecordId: string,
  breakEnd: Date,
  durationMinutes: number
) {
  return prisma.$transaction(async (tx) => {
    // 1. Finalize break record
    const updatedBreak = await tx.breakRecord.update({
      where: { id: breakId },
      data: {
        breakEnd,
        durationMinutes,
      },
    });

    // 2. Increment parent totalBreakMinutes
    const updatedAttendance = await tx.attendanceRecord.update({
      where: { id: attendanceRecordId },
      data: {
        totalBreakMinutes: {
          increment: durationMinutes,
        },
      },
      include: {
        breaks: true,
      },
    });

    return {
      breakRecord: updatedBreak,
      attendanceRecord: updatedAttendance,
    };
  });
}

export async function getBreaksForAttendance(attendanceRecordId: string) {
  return prisma.breakRecord.findMany({
    where: { attendanceRecordId },
    orderBy: { breakStart: 'asc' },
  });
}

