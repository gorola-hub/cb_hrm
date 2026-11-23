-- CreateEnum
CREATE TYPE "ShiftCode" AS ENUM ('SHIFT_1700', 'SHIFT_1730', 'SHIFT_1800', 'SHIFT_1830', 'SHIFT_1900', 'SHIFT_1930');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('IN_PROGRESS', 'P', 'HD', 'A', 'WO', 'LV');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('CASUAL', 'SICK', 'PRIVILEGED');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "hrm_shifts" (
    "id" TEXT NOT NULL,
    "code" "ShiftCode" NOT NULL,
    "displayName" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "durationMins" INTEGER NOT NULL DEFAULT 510,
    "graceMinutes" INTEGER NOT NULL DEFAULT 15,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hrm_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_employee_shifts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hrm_employee_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_attendance_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shiftId" TEXT,
    "workDate" TEXT NOT NULL,
    "firstPunchIn" TIMESTAMP(3) NOT NULL,
    "lastPunchOut" TIMESTAMP(3),
    "grossMinutes" INTEGER NOT NULL DEFAULT 0,
    "totalBreakMinutes" INTEGER NOT NULL DEFAULT 0,
    "netWorkMinutes" INTEGER NOT NULL DEFAULT 0,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "isRegularized" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hrm_attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_break_records" (
    "id" TEXT NOT NULL,
    "attendanceRecordId" TEXT NOT NULL,
    "breakStart" TIMESTAMP(3) NOT NULL,
    "breakEnd" TIMESTAMP(3),
    "durationMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hrm_break_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_leave_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leaveType" "LeaveType" NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "totalDays" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hrm_leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_holidays" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hrm_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_attendance_audit_logs" (
    "id" TEXT NOT NULL,
    "attendanceRecordId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "previousValues" JSONB NOT NULL,
    "newValues" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hrm_attendance_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hrm_shifts_code_key" ON "hrm_shifts"("code");

-- CreateIndex
CREATE INDEX "hrm_employee_shifts_userId_effectiveFrom_idx" ON "hrm_employee_shifts"("userId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "hrm_attendance_records_workDate_status_idx" ON "hrm_attendance_records"("workDate", "status");

-- CreateIndex
CREATE INDEX "hrm_attendance_records_userId_status_idx" ON "hrm_attendance_records"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "hrm_attendance_records_userId_workDate_key" ON "hrm_attendance_records"("userId", "workDate");

-- CreateIndex
CREATE INDEX "hrm_break_records_attendanceRecordId_idx" ON "hrm_break_records"("attendanceRecordId");

-- CreateIndex
CREATE INDEX "hrm_leave_requests_userId_status_idx" ON "hrm_leave_requests"("userId", "status");

-- CreateIndex
CREATE INDEX "hrm_leave_requests_status_idx" ON "hrm_leave_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "hrm_holidays_date_key" ON "hrm_holidays"("date");

-- CreateIndex
CREATE INDEX "hrm_attendance_audit_logs_attendanceRecordId_idx" ON "hrm_attendance_audit_logs"("attendanceRecordId");

-- AddForeignKey
ALTER TABLE "hrm_employee_shifts" ADD CONSTRAINT "hrm_employee_shifts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_employee_shifts" ADD CONSTRAINT "hrm_employee_shifts_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "hrm_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_attendance_records" ADD CONSTRAINT "hrm_attendance_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_attendance_records" ADD CONSTRAINT "hrm_attendance_records_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "hrm_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_break_records" ADD CONSTRAINT "hrm_break_records_attendanceRecordId_fkey" FOREIGN KEY ("attendanceRecordId") REFERENCES "hrm_attendance_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_leave_requests" ADD CONSTRAINT "hrm_leave_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_leave_requests" ADD CONSTRAINT "hrm_leave_requests_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_attendance_audit_logs" ADD CONSTRAINT "hrm_attendance_audit_logs_attendanceRecordId_fkey" FOREIGN KEY ("attendanceRecordId") REFERENCES "hrm_attendance_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_attendance_audit_logs" ADD CONSTRAINT "hrm_attendance_audit_logs_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

