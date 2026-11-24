# Current State: Capital Bridge HRM — Implementation Plan

This document tracks implementation progress across engineering phases for **Capital Bridge HRM (CB HRM)**. It serves as the primary context restoration document for future development sessions.

All phase execution adheres to the **TDD Phase Format** specified in [TDD_INSTRUCTION_GUIDE.md](./TDD_INSTRUCTION_GUIDE.md) and references test cases from [test_scenarios.md](./test_scenarios.md).

---

## 1. Implementation Progress Summary

| Phase | Description | Status | Target Files |
|---|---|:---:|---|
| **Phase 0** | Repository Setup, Toolchain, Docker & Test Harness | **[x] COMPLETED** | `package.json`, `tsconfig.json`, `docker-compose.yml`, `vitest.config.ts`, `prisma/schema.prisma`, `src/app/api/health/route.ts` |
| **Phase 1** | Database Schema, HRM Migrations & Seed Harness | **[x] COMPLETED** | `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.ts`, `src/tests/db_connection.test.ts` |
| **Phase 2** | Authentication & Shared Session Management | **[x] COMPLETED** | `src/lib/auth.ts`, `src/service/auth.service.ts`, `src/app/api/auth/`, `src/components/auth/LoginForm.tsx` |
| **Phase 3** | IST Night-Shift Engine & Punch-In/Out Core | **[x] COMPLETED** | `src/repository/attendance.repository.ts`, `src/service/attendance.service.ts`, `src/app/api/attendance/` |
| **Phase 4** | Unlimited Break Engine & State Machine | **[x] COMPLETED** | `src/repository/break.repository.ts`, `src/service/break.service.ts`, `src/app/api/attendance/break/` |
| **Phase 5** | Employee Self-Service Dashboard & Calendar Grid | **[x] COMPLETED** | `src/components/attendance/LiveClock.tsx`, `src/components/attendance/PunchCard.tsx`, `src/components/attendance/AttendanceCalendar.tsx`, `src/app/(portal)/dashboard/page.tsx` |
| **Phase 6** | Single Sign-On (SSO) Bridge to CRM *(Execute CRM Phase 30 first)* | **[x] COMPLETED** | `src/service/sso.service.ts`, `src/app/api/auth/sso/token/route.ts`, `src/components/layout/Navbar.tsx` |
| **Phase 7** | Leave Management & Admin Approval Workflow | **[ ] PENDING** | `src/repository/leave.repository.ts`, `src/service/leave.service.ts`, `src/app/api/leaves/`, `src/components/leaves/` |
| **Phase 8** | Admin Attendance Command Center & Regularization | **[ ] PENDING** | `src/repository/adminAttendance.repository.ts`, `src/service/adminAttendance.service.ts`, `src/app/(admin)/admin/attendance/page.tsx` |
| **Phase 9** | Shift Master & Employee Shift Assignment | **[ ] PENDING** | `src/repository/shift.repository.ts`, `src/service/shift.service.ts`, `src/app/(admin)/admin/shifts/page.tsx` |
| **Phase 10** | Production Deployment (Railway) & CI/CD Pipeline | **[ ] PENDING** | `.github/workflows/deploy-railway.yml`, Railway configuration, health check monitoring |

---

## 2. Phase 0: Repository Setup, Toolchain, Docker & Test Harness (Full TDD Format)

#### Root Cause
Capital Bridge HRM requires a fresh, fully configured Next.js 16 development environment with TypeScript, Tailwind CSS, shadcn/ui components, Prisma ORM targeting the shared database, a Docker Compose setup for local development, and an automated Vitest testing framework before feature code is authored.

#### Target Files
- `package.json` — Core scripts (`dev`, `build`, `test`, `test:run`, `typecheck`, `lint`) and pinned dependencies
- `tsconfig.json` — Strict TypeScript path mapping (`@/*`)
- `next.config.ts` — Standalone build configuration
- `docker-compose.yml` — Local PostgreSQL container on port 5432
- `.env.example` & `.env.test.example` — Environment variable contracts
- `vitest.config.ts` & `src/tests/setup.ts` — Testing harness with mock environment
- `prisma/schema.prisma` — Authoritative schema matching [database_schema.md](./database_schema.md)
- `src/app/api/health/route.ts` & `src/tests/health.test.ts` — System health check route

---

### Phase 0 Checklist

#### Step 0.1: Package Configuration & Dependency Installation
- [x] Initialize `package.json` with scripts:
  - `"dev": "next dev -p 3001"` (Isolated port)
  - `"build": "next build"`
  - `"start": "next start -p 3001"`
  - `"test": "vitest"`
  - `"test:run": "vitest run"`
  - `"typecheck": "tsc --noEmit"`
  - `"lint": "next lint"`
  - `"db:generate": "prisma generate"`
  - `"db:migrate": "prisma migrate dev"`
  - `"db:seed": "tsx prisma/seed.ts"`
- [x] Install core dependencies: `next@16`, `react@19`, `react-dom@19`, `typescript`, `@prisma/client`, `prisma`, `next-auth@5`, `bcryptjs`, `date-fns`, `date-fns-tz`, `zod`, `lucide-react`, `tailwind-merge`, `clsx`.
- [x] Install dev dependencies: `vitest`, `@testing-library/react`, `jsdom`, `@vitejs/plugin-react`, `tsx`, `@types/bcryptjs`, `@types/node`, `@types/react`.

#### Step 0.2: Local Docker & Environment Configuration
- [x] Create `docker-compose.yml` for local PostgreSQL 16 on port `5432` with shared database name `cb_crm`.
- [x] Create `.env.example` specifying `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL=http://localhost:3001`, and `SHARED_SSO_SECRET`.
- [x] Create `.env.test.example` with isolated test database configuration.

#### Step 0.3: Vitest Harness Configuration (RED State)
- [x] Create `vitest.config.ts` with React plugin, `jsdom` environment, and alias resolution for `@/*`.
- [x] Create test setup file `src/tests/setup.ts`.
- [x] **RED Test:** Create `src/tests/health.test.ts` asserting:
  - `GET /api/health` returns status `200 OK`
  - Response body contains `{ status: "healthy", service: "cb_hrm", timestamp: expect.any(String) }`
- [x] Run `npm run test:run src/tests/health.test.ts` $\rightarrow$ **CONFIRM RED (File / route does not exist)**.

#### Step 0.4: Health Check Endpoint Implementation (GREEN State)
- [x] Implement `src/app/api/health/route.ts` returning the standard health JSON envelope.
- [x] Re-run `npm run test:run src/tests/health.test.ts` $\rightarrow$ **CONFIRM GREEN**.

#### Step 0.5: Authoritative Prisma Schema Setup
- [x] Write `prisma/schema.prisma` with read-only CRM models (`User`, `Role`, `Designation`, `Permission`, `RolePermission`) and native `hrm_*` models.
- [x] Run `npx prisma generate` and verify Prisma client generation succeeds with 0 TypeScript errors.
- [x] Run full verification command: `npm run typecheck && npm run test:run` $\rightarrow$ All pass.

#### Phase 0 Verification Chain
Developer clones `cb_hrm` $\rightarrow$ Runs `npm install` $\rightarrow$ Copies `.env.example` to `.env` $\rightarrow$ Runs `docker compose up -d` $\rightarrow$ Runs `npx prisma generate` $\rightarrow$ Runs `npm run test:run` $\rightarrow$ Health test passes 100% $\rightarrow$ Runs `npm run dev` $\rightarrow$ Accesses `http://localhost:3001/api/health` in browser $\rightarrow$ Receives `{"status":"healthy","service":"cb_hrm"}` $\rightarrow$ ✅ Phase 0 Complete.

---

## 3. Phase 1: Database Schema, HRM Migrations & Seed Harness (Full TDD Format)

#### Root Cause
HRM needs to deploy its native database models (`hrm_shifts`, `hrm_employee_shifts`, `hrm_attendance_records`, `hrm_break_records`, `hrm_leave_requests`, `hrm_holidays`, `hrm_attendance_audit_logs`) to the shared PostgreSQL instance without altering or dropping existing CRM tables (`users`, `roles`, etc.). Additionally, master data (the 6 standard IST shifts) must be seeded idempotently, and relational queries between CRM's `users` and HRM's `hrm_*` models must be verified via automated integration tests.

#### Target Files
- `src/lib/prisma.ts` — Singleton PrismaClient instance
- `src/tests/db_connection.test.ts` — Database integration test verifying table existence, foreign key relations, and user-to-shift queries
- `prisma/migrations/` — Generated Prisma migration SQL strictly limited to `CREATE TABLE "hrm_*"` and associated indexes/enums
- `prisma/seed.ts` — Idempotent seeding script for master shifts (`SHIFT_1700` through `SHIFT_1930`) and fallback test users

---

### Phase 1 Checklist

#### Step 1.1: Singleton Prisma Client (`src/lib/prisma.ts`)
- [x] Create `src/lib/prisma.ts` exporting a global singleton instance of `PrismaClient` to prevent connection pool exhaustion during development.

#### Step 1.2: RED State Integration Test (`src/tests/db_connection.test.ts`)
- [x] Write integration test `src/tests/db_connection.test.ts`:
  - Test 1: Query `prisma.shift.findMany()` returning all 6 master shifts (`SHIFT_1700` through `SHIFT_1930`).
  - Test 2: Relational query verifying `prisma.user.findFirst({ include: { employeeShifts: true, attendanceRecords: true, role: true } })` executes cleanly without column mismatch.
  - Test 3: Verify CRM tables (`users`, `roles`, `permissions`) are readable without `systemRole` column errors.
- [x] Run `npm run test:run src/tests/db_connection.test.ts` $\rightarrow$ **CONFIRM RED** (Tables/shifts do not exist yet in database).

#### Step 1.3: Prisma Migration Generation & Deployment
- [x] Generate and deploy migration for HRM tables ensuring 100% adherence to the Prisma Migration Isolation Rule:
  - Generates ONLY `CREATE TABLE "hrm_*"` and enums (`ShiftCode`, `AttendanceStatus`, `LeaveType`, `LeaveStatus`).
  - Contains zero alterations or drops targeting CRM tables (`users`, `roles`, etc.).
- [x] Deploy migration to the shared database: `npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/20261124000000_init_hrm_tables/migration.sql` and record in `_prisma_migrations`.

#### Step 1.4: Resilient & Idempotent Seed Harness (`prisma/seed.ts`)
- [x] Implement `prisma/seed.ts`:
  - Upsert the 6 master shifts from `CONTEXT/project_data.md`:
    - `SHIFT_1700` (17:00 IST, duration 510m, grace 15m, label "17:00 - 01:30 IST")
    - `SHIFT_1730` (17:30 IST, duration 510m, grace 15m, label "17:30 - 02:00 IST")
    - `SHIFT_1800` (18:00 IST, duration 510m, grace 15m, label "18:00 - 02:30 IST")
    - `SHIFT_1830` (18:30 IST, duration 510m, grace 15m, label "18:30 - 03:00 IST")
    - `SHIFT_1900` (19:00 IST, duration 510m, grace 15m, label "19:00 - 03:30 IST")
    - `SHIFT_1930` (19:30 IST, duration 510m, grace 15m, label "19:30 - 04:00 IST")
  - If CRM `roles` or `users` don't exist (blank DB scenario), seed default roles (`ADMIN`, `BROKER`) and baseline test users (`admin@capitalbridgelogistics.com`, `broker@capitalbridgelogistics.com`). If they already exist, leave them untouched.
- [x] Execute `npm run db:seed`.

#### Step 1.5: GREEN State & Regression Verification
- [x] Run `npm run test:run src/tests/db_connection.test.ts` $\rightarrow$ **CONFIRM GREEN**.
- [x] Run full regression suite: `npm run typecheck && npm run test:run` $\rightarrow$ All pass.

#### Phase 1 Verification Chain
Developer runs `npm run db:migrate` $\rightarrow$ PostgreSQL creates `hrm_*` tables while preserving `users` $\rightarrow$ Developer runs `npm run db:seed` $\rightarrow$ 6 master shifts upserted $\rightarrow$ Developer runs `npm run test:run` $\rightarrow$ `src/tests/db_connection.test.ts` passes $\rightarrow$ Database contains active shifts and valid relational constraints between `users` and `hrm_*` $\rightarrow$ ✅ Phase 1 Complete.

---

## 4. Phase 2: Authentication & Shared Session Management (Full TDD Format)

#### Root Cause
Employees must authenticate in HRM using their CRM credentials verified via bcrypt against the shared PostgreSQL `users` table. Access must immediately be denied if an account is inactive (`isActive = false`) or password is invalid. User sessions must resolve their role via `user.role.code` and designation without querying a non-existent `systemRole` column.

#### Target Files
- `src/repository/auth.repository.ts` — User fetching with credentials, role, and designation
- `src/service/auth.service.ts` — Bcrypt verification, status check, and user normalization
- `src/lib/auth.ts` — NextAuth v5 session configuration and callbacks
- `src/app/api/auth/[...nextauth]/route.ts` — NextAuth route handler
- `src/app/api/auth/login/route.ts` — Dedicated authentication route returning standard error envelopes (`AUTH_INVALID_CREDENTIALS`, `AUTH_ACCOUNT_INACTIVE`)
- `src/components/auth/LoginForm.tsx` & `src/app/login/page.tsx` — Styled login form matching CB CRM aesthetic
- `src/tests/auth.test.ts` — Unit/integration tests covering `TS-AUTH-001`, `TS-AUTH-002`, `TS-AUTH-003`, `TS-AUTH-004`

---

### Phase 2 Checklist

#### Step 2.1: RED State Test Creation (`src/tests/auth.test.ts`)
- [x] Create `src/tests/auth.test.ts` implementing test cases:
  - `TS-AUTH-001`: Valid credentials for active user return success and populated profile with `role.code`.
  - `TS-AUTH-002`: Active credentials for inactive user (`isActive = false`) reject with `AUTH_ACCOUNT_INACTIVE`.
  - `TS-AUTH-003`: Invalid password rejects with `AUTH_INVALID_CREDENTIALS`.
  - `TS-AUTH-004`: Role and designation resolution succeeds with zero reference to `systemRole`.
- [x] Run `npm run test:run src/tests/auth.test.ts` $\rightarrow$ **CONFIRM RED** (Modules do not exist).

#### Step 2.2: Repository Layer Implementation (`src/repository/auth.repository.ts`)
- [x] Implement `findUserWithCredentials(email: string)` querying `users` table including `role` and `designation`.
- [x] Implement `findUserById(id: string)` for session verification.

#### Step 2.3: Service Layer Implementation (`src/service/auth.service.ts`) & GREEN State
- [x] Implement `verifyCredentials({ email, password })` in `src/service/auth.service.ts`:
  - Case-insensitive email normalization.
  - Verification of bcrypt password hash.
  - Rejection if `isActive === false` with code `AUTH_ACCOUNT_INACTIVE`.
  - Strip password hash before returning authenticated user payload.
- [x] Re-run `npm run test:run src/tests/auth.test.ts` $\rightarrow$ **CONFIRM GREEN**.

#### Step 2.4: NextAuth & API Route Handlers
- [x] Configure `src/lib/auth.ts` with NextAuth v5 Credentials provider, jwt callback, and session callback populating `role` and `designation`.
- [x] Implement `src/app/api/auth/[...nextauth]/route.ts`.
- [x] Implement `src/app/api/auth/login/route.ts` accepting POST body, validating via Zod, and returning standard JSON response envelope.

#### Step 2.5: Login Page & UI Components (`src/components/auth/LoginForm.tsx`, `src/app/login/page.tsx`)
- [x] Build `LoginForm` component with email and password inputs, error alert display, and loading indicator.
- [x] Build `/login` page with CB CRM slate visual styling and Capital Bridge branding.

#### Step 2.6: Full Regression Run
- [x] Run `npm run typecheck && npm run test:run` $\rightarrow$ All pass.

#### Phase 2 Verification Chain
Broker navigates to `/login` $\rightarrow$ Enters `broker@capitalbridgelogistics.com` and `Broker123!` $\rightarrow$ Submits form $\rightarrow$ API verifies credentials and active status $\rightarrow$ Session established with `role: { code: "BROKER" }` $\rightarrow$ User redirected to `/dashboard` $\rightarrow$ Attempting login with deactivated user returns 403 with `"Your account is deactivated in the CRM. Please contact your administrator."` $\rightarrow$ ✅ Phase 2 Complete.

---

## 5. Phase 3: IST Night-Shift Engine & Punch-In/Out Core (Full TDD Format)

#### Root Cause
Capital Bridge operations run night shifts aligned with US freight brokerage trading hours (e.g., 19:00 to 03:30 IST). The system must anchor the shift's `workDate` permanently to the IST calendar date of first punch-in, allow punches up to 120 minutes early, tag tardiness beyond the 15-minute grace threshold, prevent duplicate punches for the same workDate, and evaluate net hours on punch-out against the status matrix ($\ge 7.5\text{h} \rightarrow \text{P}$, $5.0\text{–}7.5\text{h} \rightarrow \text{HD}$, $< 5.0\text{h} \rightarrow \text{A}$).

#### Target Files
- `src/lib/dateUtils.ts` — IST timezone conversion and shift threshold calculations
- `src/repository/attendance.repository.ts` — Attendance database operations
- `src/service/attendance.service.ts` — Punch-in/out business logic and status evaluation
- `src/app/api/attendance/punch-in/route.ts` — Route handler for punch-in
- `src/app/api/attendance/punch-out/route.ts` — Route handler for punch-out
- `src/app/api/attendance/today/route.ts` — Route handler for fetching current active shift state
- `src/tests/attendance.test.ts` — Service logic tests (`TS-ATT-001` .. `TS-ATT-004`, `TS-DATE-001`, `TS-CALC-001` .. `TS-CALC-003`)
- `src/tests/attendanceRoute.test.ts` — Route handler tests

---

### Phase 3 Checklist

#### Step 3.1: RED State Test Creation (`src/tests/attendance.test.ts`)
- [x] Create `src/tests/attendance.test.ts` asserting:
  - `TS-ATT-001`: On-time punch-in anchors `workDate` to current IST date, sets `isLate = false`, `lateMinutes = 0`, and `status = IN_PROGRESS`.
  - `TS-ATT-002`: Early punch-in up to 120 minutes before shift succeeds with `isLate = false`.
  - `TS-ATT-003`: Late punch-in beyond 15-minute grace marks `isLate = true` and records correct `lateMinutes`.
  - `TS-ATT-004`: Duplicate punch-in for user with active shift returns `ATT_ALREADY_PUNCHED_IN`.
  - `TS-DATE-001`: Cross-midnight shift retains original first punch-in IST date as `workDate`.
  - `TS-CALC-001`: Punch-out with $\ge 450$ net minutes evaluates to status `P`.
  - `TS-CALC-002`: Punch-out with $300\text{–}449$ net minutes evaluates to status `HD`.
  - `TS-CALC-003`: Punch-out with $< 300$ net minutes evaluates to status `A`.
- [x] Run `npm run test:run src/tests/attendance.test.ts` $\rightarrow$ **CONFIRM RED** (Modules do not exist).

#### Step 3.2: IST Time & Date Utility (`src/lib/dateUtils.ts`)
- [x] Implement `src/lib/dateUtils.ts`:
  - `getISTDate(date?: Date): Date` (Converts UTC to `Asia/Kolkata` time)
  - `getISTDateString(date?: Date): string` (Returns `"YYYY-MM-DD"` in IST)
  - `parseShiftTimeToIST(workDate: string, timeStr: string): Date`
  - `evaluateShiftTimeliness(punchInTime: Date, shiftStartTime: Date, graceMinutes: number, earlyLimitMinutes: number)`
  - `evaluateAttendanceStatus(netWorkMinutes: number): AttendanceStatus`

#### Step 3.3: Attendance Repository Layer (`src/repository/attendance.repository.ts`)
- [x] Implement pure database queries:
  - `findActiveAttendanceByUserId(userId: string)`
  - `findAttendanceByUserIdAndWorkDate(userId: string, workDate: string)`
  - `createAttendanceRecord(data: ...)`
  - `closeAttendanceRecord(recordId: string, punchOutTime: Date, grossMinutes: number, netWorkMinutes: number, status: AttendanceStatus)`
  - `getAssignedShiftForUser(userId: string)`

#### Step 3.4: Attendance Service Layer (`src/service/attendance.service.ts`) & GREEN State
- [x] Implement `punchIn(userId: string, punchTime?: Date)`
- [x] Implement `punchOut(userId: string, punchTime?: Date)`
- [x] Implement `getTodayShiftState(userId: string)`
- [x] Re-run `npm run test:run src/tests/attendance.test.ts` $\rightarrow$ **CONFIRM GREEN**.

#### Step 3.5: API Route Handlers (`src/app/api/attendance/`)
- [x] Implement `POST /api/attendance/punch-in` with session verification.
- [x] Implement `POST /api/attendance/punch-out` with session verification.
- [x] Implement `GET /api/attendance/today` returning current attendance record or idle state.
- [x] Implement `src/tests/attendanceRoute.test.ts` verifying HTTP status codes and error payloads.

#### Step 3.6: Full Regression Run
- [x] Run `npm run typecheck && npm run test:run` $\rightarrow$ All pass.

#### Phase 3 Verification Chain
Broker punches in at 18:55 IST on assigned 19:00 shift $\rightarrow$ System inserts `hrm_attendance_records` with `workDate = "2026-11-24"`, `isLate = false` $\rightarrow$ Shift crosses midnight to 03:30 IST next day $\rightarrow$ Broker punches out $\rightarrow$ Gross minutes = 515, Break = 0, Net = 515 $\rightarrow$ Status evaluates to `P` $\rightarrow$ `workDate` remains `"2026-11-24"` with no record on 2026-11-25 $\rightarrow$ ✅ Phase 3 Complete.

---

## 6. Phase 4: Unlimited Break Engine & State Machine (Full TDD Format)

#### Root Cause
Freight brokerage night shifts require a flexible, unconstrained break model (BR-BRK-001) rather than rigid schedules. Employees must be able to start and stop unlimited breaks throughout their active shift. When resuming work, the individual break duration must be finalized and added to the parent shift's `totalBreakMinutes`. If an employee punches out while actively on break, the system must atomically auto-close the open break at the punch-out timestamp inside a database transaction to prevent orphaned open records (BR-BRK-002, TS-BRK-004).

#### Target Files
- `src/repository/break.repository.ts` — Break database operations and transactions
- `src/service/break.service.ts` — Break state machine and validation
- `src/service/attendance.service.ts` — Updated `punchOut` integrating atomic break auto-close
- `src/app/api/attendance/break/start/route.ts` — Route handler for `POST /api/attendance/break/start`
- `src/app/api/attendance/break/end/route.ts` — Route handler for `POST /api/attendance/break/end`
- `src/tests/break.test.ts` — Service layer and transactional tests (`TS-BRK-001` .. `TS-BRK-004`)
- `src/tests/breakRoute.test.ts` — API route handler tests

---

### Phase 4 Checklist

#### Step 4.1: RED State Test Creation (`src/tests/break.test.ts`)
- [x] Create `src/tests/break.test.ts` asserting:
  - `TS-BRK-001`: Starting break on active shift creates `BreakRecord` with `breakEnd = null` and state `ON_BREAK`.
  - `TS-BRK-001b`: Reject starting break if already on break (`BRK_ALREADY_ON_BREAK`).
  - `TS-BRK-001c`: Reject starting break if no active shift (`ATT_NO_ACTIVE_SHIFT`).
  - `TS-BRK-002`: Resuming work ends active break, computes `durationMinutes`, and increments parent `totalBreakMinutes`.
  - `TS-BRK-002b`: Reject resuming work if not on break (`BRK_NOT_ON_BREAK`).
  - `TS-BRK-003`: Unlimited consecutive breaks: taking 4 distinct breaks records 4 rows and cumulative `totalBreakMinutes`.
  - `TS-BRK-004`: Punch-out while on break auto-closes active break at punch-out timestamp in a transaction and finalizes net hours.
- [x] Run `npm run test:run src/tests/break.test.ts` $\rightarrow$ **CONFIRM RED** (Modules do not exist).

#### Step 4.2: Break Repository Layer (`src/repository/break.repository.ts`)
- [x] Implement Prisma operations:
  - `findActiveBreak(attendanceRecordId: string)`
  - `createBreak(attendanceRecordId: string, breakStart: Date)`
  - `closeBreakInTransaction(breakId: string, attendanceRecordId: string, breakEnd: Date, durationMinutes: number)`
  - `getBreaksForAttendance(attendanceRecordId: string)`

#### Step 4.3: Break Service Layer (`src/service/break.service.ts`) & GREEN State
- [x] Implement `startBreak(userId: string, breakTime?: Date)`
- [x] Implement `endBreak(userId: string, resumeTime?: Date)`
- [x] Implement `getCurrentBreakState(userId: string)`
- [x] Update `punchOut` in `src/service/attendance.service.ts` to detect and atomically auto-close any open break inside `prisma.$transaction`.
- [x] Re-run `npm run test:run src/tests/break.test.ts` $\rightarrow$ **CONFIRM GREEN**.

#### Step 4.4: API Route Handlers (`src/app/api/attendance/break/`)
- [x] Implement `POST /api/attendance/break/start` with session guard.
- [x] Implement `POST /api/attendance/break/end` with session guard.
- [x] Implement `src/tests/breakRoute.test.ts` testing route error envelopes and success responses.

#### Step 4.5: Full Regression Run
- [x] Run `npm run typecheck && npm run test:run` $\rightarrow$ All pass.

#### Phase 4 Verification Chain
Broker punches in $\rightarrow$ State transitions to `WORKING` $\rightarrow$ Broker clicks [TAKE BREAK] $\rightarrow$ System creates open `BreakRecord` and state becomes `ON_BREAK` $\rightarrow$ Broker clicks [BACK FROM BREAK] after 20 mins $\rightarrow$ Break sealed with 20 mins duration, `totalBreakMinutes = 20` $\rightarrow$ Broker takes 2nd break and directly punches out $\rightarrow$ System executes Prisma transaction auto-closing 2nd break and calculating net shift hours $\rightarrow$ ✅ Phase 4 Complete.

---

## 7. Phase 5: Employee Self-Service Dashboard & Calendar Grid (Full TDD Format)

#### Root Cause
Employees require a centralized, real-time self-service portal to monitor their live IST shift timers, perform one-click shift actions (punch in, unlimited breaks, resume work, punch out) with instant optimistic UI feedback (NFR-UX-001, NFR-UX-002), and inspect their monthly attendance calendar with color-coded daily badges (`P`, `HD`, `A`, `LV`, `WO`, `L`) and itemized break audit trails (FR-ATT-001, FR-ATT-006, Rule BR-ATT-002).

#### Target Files
- `src/repository/attendance.repository.ts` — Query user monthly attendance records with associated shift and break details
- `src/service/attendance.service.ts` — Compute complete monthly calendar matrix, map weekends to `WO` (when no punch exists), evaluate monthly KPI aggregates (present, half-day, absent, leave, week-off, late count)
- `src/app/api/attendance/monthly/route.ts` — API endpoint `GET /api/attendance/monthly?month=YYYY-MM` with session verification and Zod validation
- `src/tests/monthlyAttendance.test.ts` — Service logic tests for monthly history generation and weekend status mapping
- `src/tests/monthlyAttendanceRoute.test.ts` — Route handler tests for `GET /api/attendance/monthly`
- `src/components/layout/Navbar.tsx` — Navigation header with user identity, role badge, live clock sync, and logout action
- `src/components/attendance/LiveClock.tsx` — Synchronized IST digital clock with drift compensation (<500ms) and tabular monospace font
- `src/components/attendance/PunchCard.tsx` — Dynamic interactive punch card handling FSM states (`IDLE`, `WORKING`, `ON_BREAK`, `COMPLETED`), action buttons, live timers, and optimistic transitions
- `src/components/attendance/DayDetailModal.tsx` — Modal displaying comprehensive day shift metrics, IST timestamps, gross/net working minutes, tardiness, and itemized break timeline
- `src/components/attendance/AttendanceCalendar.tsx` — Interactive monthly calendar grid with month navigation, status badges (`P`, `HD`, `A`, `LV`, `WO`, `L`), summary KPI statistics, and day click inspection
- `src/app/(portal)/layout.tsx` — Portal shell enforcing authentication and providing shared layout
- `src/app/(portal)/dashboard/page.tsx` — Unified self-service dashboard page assembling LiveClock, PunchCard, and AttendanceCalendar

---

### Phase 5 Checklist

#### Step 5.1: RED State Test Creation for Monthly Attendance Service (`src/tests/monthlyAttendance.test.ts`)
- [x] Create `src/tests/monthlyAttendance.test.ts`:
  - Test 1: Given a user with attendance records in a month, `getMonthlyAttendance(userId, '2026-11')` returns all days of the month with populated attendance data for punched days.
  - Test 2: Unworked Saturday and Sunday dates default to status `WO` (Week Off) per Rule BR-ATT-002.
  - Test 3: Past unworked weekdays without punch or approved leave default to `A` (Absent).
  - Test 4: Accurate aggregation of monthly KPI counters: total working days, `presentCount`, `halfDayCount`, `absentCount`, `leaveCount`, `weekOffCount`, `lateCount`, `totalNetHours`.
- [x] Run `npm run test:run src/tests/monthlyAttendance.test.ts` $\rightarrow$ **CONFIRM RED** (Function does not exist).

#### Step 5.2: Repository & Service Implementation for Monthly Attendance (`src/repository/attendance.repository.ts`, `src/service/attendance.service.ts`) & GREEN State
- [x] In `src/repository/attendance.repository.ts`, implement `findMonthlyAttendanceByUserId(userId: string, startWorkDate: string, endWorkDate: string)` fetching records with shifts and breaks ordered by `workDate`.
- [x] In `src/service/attendance.service.ts`, implement `getMonthlyAttendance(userId: string, yearMonth: string)`:
  - Generate full calendar day sequence for the requested month.
  - Match existing attendance records.
  - Assign `WO` for unworked weekends (Saturday/Sunday).
  - Calculate summary metrics (`presentCount`, `halfDayCount`, `absentCount`, `leaveCount`, `weekOffCount`, `lateCount`, `totalNetMinutes`).
- [x] Re-run `npm run test:run src/tests/monthlyAttendance.test.ts` $\rightarrow$ **CONFIRM GREEN**.

#### Step 5.3: Monthly Attendance API Route Handler (`src/app/api/attendance/monthly/route.ts`)
- [x] Create `src/tests/monthlyAttendanceRoute.test.ts`:
  - Test 1: Unauthenticated request returns 401 Unauthorized.
  - Test 2: Invalid month format (e.g. `month=invalid`) returns 400 Bad Request.
  - Test 3: Authenticated request returns 200 OK with month records and summary metrics.
- [x] Run `npm run test:run src/tests/monthlyAttendanceRoute.test.ts` $\rightarrow$ **CONFIRM RED**.
- [x] Implement `GET /api/attendance/monthly` route handler with NextAuth session validation and query parameter validation (`yearMonth` regex `^\d{4}-\d{2}$`).
- [x] Re-run `npm run test:run src/tests/monthlyAttendanceRoute.test.ts` $\rightarrow$ **CONFIRM GREEN**.

#### Step 5.4: LiveClock Component (`src/components/attendance/LiveClock.tsx`)
- [x] Build `LiveClock` component:
  - Synchronizes with server timestamp on mount to prevent client OS clock tampering (NFR-PERF-001, drift <500ms).
  - Displays IST time in 24-hour format with seconds (`HH:mm:ss IST`).
  - Displays IST day, date, and month (e.g., `Tuesday, 24 November 2026`).
  - Monospace tabular numeric styling (`tabular-nums font-mono`) to prevent layout jitter.

#### Step 5.5: Interactive PunchCard Component (`src/components/attendance/PunchCard.tsx`)
- [x] Build `PunchCard` component handling FSM states with optimistic updates (NFR-UX-001):
  - `IDLE`: Displays shift schedule, [PUNCH IN] primary button.
  - `WORKING`: Displays live shift elapsed timer, [TAKE BREAK] button, and [PUNCH OUT] button.
  - `ON_BREAK`: Displays active break timer, [BACK FROM BREAK] button, and [PUNCH OUT] button.
  - `COMPLETED`: Displays shift recap (Punch In, Punch Out, Total Break, Net Hours, Status Badge).
  - Integrates with `/api/attendance/today`, `/api/attendance/punch-in`, `/api/attendance/punch-out`, `/api/attendance/break/start`, `/api/attendance/break/end`.
  - Color-coded badges per Rule BR-ATT-002 (Emerald `P`, Amber `HD`, Rose `A`, Blue animated `IN_PROGRESS`).

#### Step 5.6: DayDetailModal & AttendanceCalendar Components (`src/components/attendance/DayDetailModal.tsx`, `src/components/attendance/AttendanceCalendar.tsx`)
- [x] Build `DayDetailModal` component:
  - Displays selected work date, assigned shift name, first punch in, last punch out in IST.
  - Displays gross duration, total break duration, net working duration.
  - Shows tardiness badge if `isLate = true` with `lateMinutes`.
  - Itemized timeline of all breaks taken (Break #, start, end, duration).
- [x] Build `AttendanceCalendar` component:
  - Header with month/year navigation (prev/next month).
  - KPI statistic cards (Present, Half Day, Absent, Leave, Week Off, Late).
  - 7-column calendar grid (Mon-Sun) displaying day numbers, status badges (`P`, `HD`, `A`, `LV`, `WO`, `L`).
  - Clickable day cards opening `DayDetailModal`.

#### Step 5.7: Portal Layout, Navbar & Dashboard Page (`src/components/layout/Navbar.tsx`, `src/app/(portal)/layout.tsx`, `src/app/(portal)/dashboard/page.tsx`)
- [x] Implement `src/components/layout/Navbar.tsx`:
  - Capital Bridge logo & branding.
  - User name, role badge (`user.role.code`), designation.
  - Sign Out button calling NextAuth `signOut()`.
- [x] Implement `src/app/(portal)/layout.tsx`:
  - Session verification; redirects unauthenticated users to `/login`.
  - Renders Navbar and responsive container.
- [x] Implement `src/app/(portal)/dashboard/page.tsx`:
  - Assembles `LiveClock`, `PunchCard`, and `AttendanceCalendar`.
- [x] Update root route `src/app/page.tsx` or redirects so authenticated users land on `/dashboard`.

#### Step 5.8: Full Regression Verification
- [x] Run `npm run typecheck && npm run test:run` ensuring 100% test pass rate across all suites.

#### Phase 5 Verification Chain
Employee logs in at `/login` $\rightarrow$ Redirected to `/dashboard` $\rightarrow$ Live IST clock updates every second with server-synced time $\rightarrow$ PunchCard displays assigned shift schedule $\rightarrow$ Clicks [PUNCH IN] $\rightarrow$ UI optimistically transitions to WORKING with live shift counter running $\rightarrow$ Clicks [TAKE BREAK] $\rightarrow$ UI transitions to ON_BREAK with break timer running $\rightarrow$ Clicks [BACK FROM BREAK] $\rightarrow$ UI transitions back to WORKING $\rightarrow$ Clicks [PUNCH OUT] $\rightarrow$ UI transitions to COMPLETED displaying status badge (`P`/`HD`/`A`) $\rightarrow$ Attendance calendar below updates to show today's status badge $\rightarrow$ Clicking the day cell opens `DayDetailModal` with the itemized break breakdown $\rightarrow$ ✅ Phase 5 Complete.

---

## 8. Phase 6: Single Sign-On (SSO) Bridge to CRM (Full TDD Format)

#### Root Cause
Employees and administrators need to navigate seamlessly from Capital Bridge HRM to Capital Bridge CRM without re-entering credentials (Rule BR-SSO-001, FR-SSO-001, TS-SSO-001). HRM must generate a short-lived (60-second), tamper-proof HMAC-SHA256 signed JWT containing the authenticated employee's identity (`userId`, `email`), issuer (`capital-bridge-hrm`), and expiration time, and provide a one-click UI action in the portal navigation bar that launches CRM's verified inbound SSO handler (`/api/auth/sso?token=...`) in a new tab.

> [!NOTE]
> **PREREQUISITE STATUS:** Phase 30 in `cb_crm` (Inbound SSO Token Handler & Permissions Seeding) is **100% complete and verified**. CRM endpoint `GET /api/auth/sso?token=...` is ready to accept and validate tokens generated by HRM.

#### Target Files
- `.env`, `.env.example`, `.env.test`, `.env.test.example` — `CRM_BASE_URL` and `SHARED_SSO_SECRET` configuration
- `src/service/sso.service.ts` — Token generation service generating HMAC-SHA256 signed JWT
- `src/app/api/auth/sso/token/route.ts` — Protected API route issuing the SSO bridge URL
- `src/components/layout/Navbar.tsx` — Header navigation `[Open CRM]` button with loading state
- `src/tests/ssoTokenIssuer.test.ts` — Service layer unit test suite (`TS-SSO-001`)
- `src/tests/ssoTokenRoute.test.ts` — API route integration test suite
- `src/tests/navbarCrmButton.test.tsx` — Navbar component test asserting button interaction and window.open

---

### Phase 6 Checklist

#### Step 6.1: Environment Configuration (`.env*`)
- [x] Add `CRM_BASE_URL="http://localhost:3000"` to `.env`, `.env.example`, `.env.test`, `.env.test.example`.

#### Step 6.2: RED State Test Creation for SSO Token Issuer (`src/tests/ssoTokenIssuer.test.ts`)
- [x] Create `src/tests/ssoTokenIssuer.test.ts` asserting:
  - Generates a 3-part base64url encoded JWT.
  - Header has `{ alg: "HS256", typ: "JWT" }`.
  - Payload contains `userId`, `email`, `iss: "capital-bridge-hrm"`, and `exp = Math.floor(Date.now() / 1000) + 60`.
  - Signature is valid HMAC-SHA256 using `SHARED_SSO_SECRET`.
  - Generates full redirect URL pointing to `${CRM_BASE_URL}/api/auth/sso?token=${token}`.
  - Rejects if user missing `id` or `email`.
- [x] Run `npm run test:run src/tests/ssoTokenIssuer.test.ts` $\rightarrow$ **CONFIRM RED** (Service does not exist).

#### Step 6.3: SSO Token Service Implementation (`src/service/sso.service.ts`) & GREEN State
- [x] Implement `src/service/sso.service.ts`:
  - `generateSsoToken(user: { id: string; email: string })`: creates HMAC-SHA256 JWT valid for 60 seconds.
  - `getSsoBridgeUrl(user: { id: string; email: string })`: generates full CRM SSO URL.
- [x] Re-run `npm run test:run src/tests/ssoTokenIssuer.test.ts` $\rightarrow$ **CONFIRM GREEN**.

#### Step 6.4: RED State Test Creation for SSO Token API Route (`src/tests/ssoTokenRoute.test.ts`)
- [x] Create `src/tests/ssoTokenRoute.test.ts` asserting:
  - Unauthenticated request returns 401 Unauthorized (`AUTH_UNAUTHORIZED`).
  - Authenticated session returns 200 OK with `{ success: true, ssoUrl: string }`.
- [x] Run `npm run test:run src/tests/ssoTokenRoute.test.ts` $\rightarrow$ **CONFIRM RED** (Route does not exist).

#### Step 6.5: SSO Route Handler Implementation (`src/app/api/auth/sso/token/route.ts`) & GREEN State
- [x] Implement `GET /api/auth/sso/token`:
  - Check NextAuth session via `auth()`.
  - Return 401 if unauthenticated.
  - Call `getSsoBridgeUrl({ id: session.user.id, email: session.user.email })`.
  - Return `{ success: true, ssoUrl }`.
- [x] Re-run `npm run test:run src/tests/ssoTokenRoute.test.ts` $\rightarrow$ **CONFIRM GREEN**.

#### Step 6.6: Navbar Component `[Open CRM]` Button & Verification (`src/components/layout/Navbar.tsx`, `src/tests/navbarCrmButton.test.tsx`)
- [x] Create `src/tests/navbarCrmButton.test.tsx` testing the `[Open CRM]` button.
- [x] Update `src/components/layout/Navbar.tsx`:
  - Add `[Open CRM]` button with `ExternalLink` icon.
  - Handle click: set loading state, call `/api/auth/sso/token`, open `ssoUrl` in new tab via `window.open(data.ssoUrl, '_blank', 'noopener,noreferrer')`.
  - Handle errors gracefully if request fails.
- [x] Re-run `npm run test:run src/tests/navbarCrmButton.test.tsx` $\rightarrow$ **CONFIRM GREEN**.

#### Step 6.7: Full Regression Verification
- [x] Run `npm run typecheck && npm run test:run && npm run build` ensuring 100% test pass rate across all suites.

#### Phase 6 Verification Chain
Authenticated user in HRM views Navbar $\rightarrow$ Clicks `[Open CRM]` $\rightarrow$ Button shows loading state $\rightarrow$ HRM calls `/api/auth/sso/token` $\rightarrow$ Service generates HMAC-SHA256 JWT with 60s TTL $\rightarrow$ Browser opens `http://localhost:3000/api/auth/sso?token=...` in new window $\rightarrow$ CRM validates signature and user status $\rightarrow$ CRM sets NextAuth session cookie and redirects to `/dashboard` $\rightarrow$ ✅ Phase 6 Complete.

---

## 9. High-Level Phase Specifications (Phases 7 through 10)

### Phase 7: Leave Management & Admin Approval Workflow
- **Goal:** Full leave application lifecycle: submission, balance display, admin notification bell, approval/rejection, and automatic attendance marking (`LV`).
- **Target Files:** `src/repository/leave.repository.ts`, `src/service/leave.service.ts`, `src/app/api/leaves/`, `src/components/leaves/LeaveRequestModal.tsx`, `src/app/(admin)/admin/leaves/page.tsx`.
- **Key Milestones:**
  - Employee leave submission with date range and reason validation.
  - Rejection of overlapping leave applications (`LV_OVERLAPPING_REQUEST`).
  - Admin approval flow automatically setting target date records to `status = LV`.
  - Admin rejection flow with mandatory explanation.

### Phase 8: Admin Attendance Command Center & Regularization
- **Goal:** Operational control room for leadership featuring real-time KPI counts, live company roster table with inline break drawers, and regularizations with mandatory audit logging.
- **Target Files:** `src/repository/adminAttendance.repository.ts`, `src/service/adminAttendance.service.ts`, `src/components/admin/LiveRosterTable.tsx`, `src/components/admin/AttendanceEditModal.tsx`, `src/app/(admin)/admin/attendance/page.tsx`.
- **Key Milestones:**
  - KPI metric cards: *On Shift Now*, *On Break*, *Late Today*, *On Leave*, *Offline*.
  - Live tabular roster with search, shift filtering, and department filtering.
  - Regularization dialog requiring non-empty justification.
  - Immutable audit logging to `hrm_attendance_audit_logs`.

### Phase 9: Shift Master & Employee Shift Assignment
- **Goal:** Shift management interface allowing administrators to define shift timings and assign employees with effective date ranges.
- **Target Files:** `src/repository/shift.repository.ts`, `src/service/shift.service.ts`, `src/components/admin/ShiftAssignmentModal.tsx`, `src/app/(admin)/admin/shifts/page.tsx`.
- **Key Milestones:**
  - Master shift catalog viewer with timing and grace period configuration.
  - Employee shift assignment with `effectiveFrom` and `effectiveTo` history.
  - Shift reassignment conflict validation.

### Phase 10: Production Deployment (Railway) & CI/CD Pipeline
- **Goal:** Provision HRM as a dedicated Web Service inside the Capital Bridge Railway project and configure GitHub Actions CI/CD.
- **Target Files:** `.github/workflows/deploy-railway.yml`, `README.md`, Railway service variables.
- **Key Milestones:**
  - Configure GitHub Actions pipeline: lint, typecheck, migrations, and test pass before deployment.
  - Target Railway CLI specifically to `--service "cb_hrm"`.
  - Configure Railway private network DNS for zero-latency database communication.
  - Map custom production domain `hrm.capitalbridgelogistics.com`.

