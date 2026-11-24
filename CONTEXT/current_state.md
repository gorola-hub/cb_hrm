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
| **Phase 5** | Employee Self-Service Dashboard & Calendar Grid | **[ ] PENDING** | `src/components/attendance/LiveClock.tsx`, `src/components/attendance/PunchCard.tsx`, `src/components/attendance/AttendanceCalendar.tsx`, `src/app/(portal)/dashboard/page.tsx` |
| **Phase 6** | Single Sign-On (SSO) Bridge to CRM *(Execute CRM Phase 30 first)* | **[ ] PENDING** | `src/service/sso.service.ts`, `src/app/api/auth/sso/token/route.ts`, `src/components/layout/Navbar.tsx` |
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

## 7. High-Level Phase Specifications (Phases 5 through 10)

### Phase 5: Employee Self-Service Dashboard & Calendar Grid
- **Goal:** The primary employee landing portal featuring the synchronized Live IST Digital Clock, interactive punch card, shift statistics, and monthly color-coded attendance calendar.
- **Target Files:** `src/components/attendance/LiveClock.tsx`, `src/components/attendance/PunchCard.tsx`, `src/components/attendance/AttendanceCalendar.tsx`, `src/components/attendance/DayDetailModal.tsx`, `src/app/(portal)/dashboard/page.tsx`.
- **Key Milestones:**
  - Real-time client clock with zero drift and tabular numeric display.
  - Optimistic UI transitions on punch-in, take break, resume, and punch-out.
  - Interactive monthly calendar grid displaying badges (`P`, `HD`, `A`, `LV`, `WO`, `L`).
  - Day Detail Modal revealing itemized break timeline.

### Phase 6: Single Sign-On (SSO) Bridge to CRM

> [!IMPORTANT]
> **CROSS-REPOSITORY PREREQUISITE (JUST-IN-TIME EXECUTION):**  
> Before implementing Phase 6 in HRM, switch to the `cb_crm` repository and execute **Phase 30 in `cb_crm`** first!  
> Phase 30 in CRM implements the receiving route `GET /api/auth/sso?token=...` and seeds the attendance permissions in the shared database.  
> Implementing CRM's Phase 30 right before HRM's Phase 6 ensures the receiving endpoint is live, tested, and ready so the complete end-to-end handshake (*click `[Open CRM]` in HRM $\rightarrow$ validated in CRM $\rightarrow$ land on CRM `/dashboard`*) can be tested and verified immediately.

- **Goal:** One-click seamless bridge from HRM to CRM using HMAC-SHA256 signed JWT tokens.
- **Target Files:** `src/service/sso.service.ts`, `src/app/api/auth/sso/token/route.ts`, `src/components/layout/Navbar.tsx`, companion guide for CRM receiver route `/api/auth/sso`.
- **Key Milestones:**
  - HRM token issuer generating 60-second valid JWT containing user identity.
  - Header `[Open CRM]` button with loading state and external tab redirect.
  - Comprehensive unit test asserting signature validity and expiration enforcement.

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

