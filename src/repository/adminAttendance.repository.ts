import { prisma } from '@/lib/prisma';
import { AttendanceStatus, Prisma } from '@prisma/client';

const attendanceWithRelations = {
  shift: true,
  breaks: {
    orderBy: { breakStart: 'asc' as const },
  },
  _count: {
    select: { auditLogs: true },
  },
};

export async function findStaleInProgressRecords(cutoffUtc: Date) {
  return prisma.attendanceRecord.findMany({
    where: {
      status: 'IN_PROGRESS',
      lastPunchOut: null,
      firstPunchIn: {
        lt: cutoffUtc,
      },
    },
    select: {
      id: true,
    },
  });
}

export async function markRecordsAsStale(ids: string[]) {
  if (ids.length === 0) return { count: 0 };
  return prisma.attendanceRecord.updateMany({
    where: {
      id: { in: ids },
      status: 'IN_PROGRESS',
      lastPunchOut: null,
    },
    data: {
      status: 'ANOMALY_STALE',
    },
  });
}

export async function findRosterSnapshotForDate(workDate: string) {
  const workDateStartUtc = new Date(`${workDate}T00:00:00+05:30`);
  const workDateEndUtc = new Date(`${workDate}T23:59:59+05:30`);

  const [users, records, shiftAssignments, shifts, roles, designations] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        empId: true,
        alias: true,
        role: {
          select: { id: true, code: true, name: true },
        },
        designation: {
          select: { id: true, code: true, name: true },
        },
      },
      orderBy: [{ empId: 'asc' }, { name: 'asc' }],
    }),
    prisma.attendanceRecord.findMany({
      where: { workDate },
      include: attendanceWithRelations,
    }),
    prisma.employeeShift.findMany({
      where: {
        effectiveFrom: { lte: workDateEndUtc },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: workDateStartUtc } }],
      },
      include: { shift: true },
      orderBy: { effectiveFrom: 'desc' },
    }),
    prisma.shift.findMany({
      where: { isActive: true },
      orderBy: { startTime: 'asc' },
    }),
    prisma.role.findMany({
      select: { code: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.designation.findMany({
      select: { code: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return { users, records, shiftAssignments, shifts, roles, designations };
}

export async function findAttendanceForRegularizationById(id: string) {
  return prisma.attendanceRecord.findUnique({
    where: { id },
    include: attendanceWithRelations,
  });
}

export async function findAttendanceForRegularizationByUserDate(userId: string, workDate: string) {
  return prisma.attendanceRecord.findUnique({
    where: {
      userId_workDate: { userId, workDate },
    },
    include: attendanceWithRelations,
  });
}

export async function findAssignedShiftForUserDate(userId: string, workDate: string) {
  const workDateEndUtc = new Date(`${workDate}T23:59:59+05:30`);
  const workDateStartUtc = new Date(`${workDate}T00:00:00+05:30`);

  const assignment = await prisma.employeeShift.findFirst({
    where: {
      userId,
      effectiveFrom: { lte: workDateEndUtc },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: workDateStartUtc } }],
    },
    orderBy: { effectiveFrom: 'desc' },
    include: { shift: true },
  });

  return assignment?.shift ?? null;
}

export async function findUserSummaryById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
}

export async function regularizeAttendanceInTransaction(params: {
  existingRecordId?: string;
  userId: string;
  shiftId: string | null;
  workDate: string;
  firstPunchIn: Date;
  lastPunchOut: Date | null;
  grossMinutes: number;
  totalBreakMinutes: number;
  netWorkMinutes: number;
  isLate: boolean;
  lateMinutes: number;
  status: AttendanceStatus;
  adminId: string;
  previousValues: Prisma.InputJsonValue;
  reason: string;
  closeOpenBreaksAt?: Date | null;
}) {
  return prisma.$transaction(async (tx) => {
    const finalBreakMinutes = params.totalBreakMinutes;

    if (params.existingRecordId && params.closeOpenBreaksAt) {
      const openBreaks = await tx.breakRecord.findMany({
        where: {
          attendanceRecordId: params.existingRecordId,
          breakEnd: null,
        },
      });

      for (const brk of openBreaks) {
        const duration = Math.max(
          0,
          Math.round((params.closeOpenBreaksAt.getTime() - brk.breakStart.getTime()) / 60000)
        );
        await tx.breakRecord.update({
          where: { id: brk.id },
          data: {
            breakEnd: params.closeOpenBreaksAt,
            durationMinutes: duration,
          },
        });
      }
    }

    const finalNetMinutes =
      params.lastPunchOut !== null
        ? Math.max(0, params.grossMinutes - finalBreakMinutes)
        : 0;

    const record = params.existingRecordId
      ? await tx.attendanceRecord.update({
          where: { id: params.existingRecordId },
          data: {
            shiftId: params.shiftId,
            firstPunchIn: params.firstPunchIn,
            lastPunchOut: params.lastPunchOut,
            grossMinutes: params.grossMinutes,
            totalBreakMinutes: finalBreakMinutes,
            netWorkMinutes: finalNetMinutes,
            isLate: params.isLate,
            lateMinutes: params.lateMinutes,
            status: params.status,
            isRegularized: true,
          },
          include: attendanceWithRelations,
        })
      : await tx.attendanceRecord.create({
          data: {
            userId: params.userId,
            shiftId: params.shiftId,
            workDate: params.workDate,
            firstPunchIn: params.firstPunchIn,
            lastPunchOut: params.lastPunchOut,
            grossMinutes: params.grossMinutes,
            totalBreakMinutes: finalBreakMinutes,
            netWorkMinutes: finalNetMinutes,
            isLate: params.isLate,
            lateMinutes: params.lateMinutes,
            status: params.status,
            isRegularized: true,
          },
          include: attendanceWithRelations,
        });

    const newValues: Prisma.InputJsonValue = {
      id: record.id,
      workDate: record.workDate,
      firstPunchIn: record.firstPunchIn.toISOString(),
      lastPunchOut: record.lastPunchOut ? record.lastPunchOut.toISOString() : null,
      grossMinutes: record.grossMinutes,
      totalBreakMinutes: record.totalBreakMinutes,
      netWorkMinutes: record.netWorkMinutes,
      isLate: record.isLate,
      lateMinutes: record.lateMinutes,
      status: record.status,
      isRegularized: record.isRegularized,
    };

    const auditLog = await tx.attendanceAuditLog.create({
      data: {
        attendanceRecordId: record.id,
        adminId: params.adminId,
        previousValues: params.previousValues,
        newValues,
        reason: params.reason,
      },
      include: {
        admin: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return { record, auditLog };
  });
}

export async function findAuditLogsByAttendanceId(attendanceRecordId: string) {
  return prisma.attendanceAuditLog.findMany({
    where: { attendanceRecordId },
    include: {
      admin: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}
