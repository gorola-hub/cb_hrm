-- Add ANOMALY_STALE to AttendanceStatus enum (Decision 8 / BR-IST-004)
ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'ANOMALY_STALE';

-- Convert hrm_shifts.code from rigid ShiftCode enum to dynamic TEXT
ALTER TABLE "hrm_shifts" ALTER COLUMN "code" TYPE TEXT USING "code"::TEXT;
DROP TYPE "ShiftCode";

-- CreateTable hrm_leave_types (Dynamic Leave Types Catalog)
CREATE TABLE "hrm_leave_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultAnnualDays" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "allowCarryForward" BOOLEAN NOT NULL DEFAULT false,
    "maxCarryForwardDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hrm_leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hrm_leave_types_code_key" ON "hrm_leave_types"("code");

-- Seed default leave types so existing hrm_leave_requests backfill safely
INSERT INTO "hrm_leave_types" (
    "id", "code", "name", "description", "defaultAnnualDays",
    "allowCarryForward", "maxCarryForwardDays", "isPaid", "isActive", "createdAt", "updatedAt"
)
VALUES
    ('lt_casual_default', 'CASUAL', 'Casual Leave', 'Personal or urgent time off', 12, false, 0, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('lt_sick_default', 'SICK', 'Sick Leave', 'Medical and health recovery leave', 12, false, 0, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('lt_privileged_default', 'PRIVILEGED', 'Privileged Leave', 'Planned annual vacation leave with carry-forward', 15, true, 10, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- CreateTable hrm_leave_balances (Per-Employee, Per-Year, Per-Type Ledger)
CREATE TABLE "hrm_leave_balances" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "entitledDays" DOUBLE PRECISION NOT NULL,
    "carriedForwardDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "adjustedDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hrm_leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hrm_leave_balances_userId_leaveTypeId_year_key" ON "hrm_leave_balances"("userId", "leaveTypeId", "year");

-- CreateIndex
CREATE INDEX "hrm_leave_balances_userId_year_idx" ON "hrm_leave_balances"("userId", "year");

-- AddForeignKey
ALTER TABLE "hrm_leave_balances" ADD CONSTRAINT "hrm_leave_balances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_leave_balances" ADD CONSTRAINT "hrm_leave_balances_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "hrm_leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Migrate hrm_leave_requests from LeaveType enum to leaveTypeId FK
ALTER TABLE "hrm_leave_requests" ADD COLUMN "leaveTypeId" TEXT;

UPDATE "hrm_leave_requests" lr
SET "leaveTypeId" = lt."id"
FROM "hrm_leave_types" lt
WHERE lt."code" = lr."leaveType"::TEXT;

ALTER TABLE "hrm_leave_requests" ALTER COLUMN "leaveTypeId" SET NOT NULL;

CREATE INDEX "hrm_leave_requests_leaveTypeId_idx" ON "hrm_leave_requests"("leaveTypeId");

ALTER TABLE "hrm_leave_requests" ADD CONSTRAINT "hrm_leave_requests_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "hrm_leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "hrm_leave_requests" DROP COLUMN "leaveType";

DROP TYPE "LeaveType";

