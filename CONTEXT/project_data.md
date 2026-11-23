# Project Data: Capital Bridge HRM

This document serves as the authoritative metadata repository, business rules dictionary, permission catalog, and functional/non-functional requirements specification for **Capital Bridge HRM (CB HRM)** — the employee self-service and attendance management platform of Capital Bridge Logistics LLC.

---

## 1. Core Metadata

- **Project Name:** Capital Bridge HRM (CB HRM)
- **Company:** Capital Bridge Logistics LLC
- **Primary Domain:** Employee Self-Service, Attendance Engine, Break Tracking & Leave Management
- **Primary Timezone:** Indian Standard Time (`Asia/Kolkata` / UTC+05:30) — all punch clocks, shift schedules, work date calculations, and attendance statuses strictly evaluate against IST.
- **Architecture:** Next.js 16 App Router monolith, TypeScript, Prisma ORM, PostgreSQL (shared instance with CB CRM), NextAuth.js v5 / JWT session engine, Tailwind CSS, shadcn/ui.
- **Local Development URL:** `http://localhost:3001` (coexists with CB CRM on port `3000`)
- **Production URL:** `https://hrm.capitalbridgelogistics.com`
- **Companion Application:** Capital Bridge CRM (`https://crm.capitalbridgelogistics.com`)
- **Database Name:** `cb_crm` (Shared PostgreSQL instance)
- **Repository Location:** `cb_hrm`

---

## 2. Technical Stack & Architectural Layers

### Core Technologies
- **Next.js 16 (App Router):** Server components, server actions, and route handlers under `src/app/api/`.
- **TypeScript:** Strict type-safety enabled across all layers.
- **Prisma ORM:** Manages `hrm_*` native models and provides typed read-only models for CRM user entities.
- **NextAuth.js v5 / Session Management:** Authenticates against CRM `users` credentials with bcrypt password verification.
- **shadcn/ui + Tailwind CSS:** Clean visual system matching CB CRM's slate/zinc aesthetic.
- **Vitest + React Testing Library:** Unit and integration testing harness.
- **Lucide React:** Iconography suite.
- **date-fns & date-fns-tz:** Timezone-precise date calculations for Indian Standard Time.

### Three-Layer Architecture
All application code is strictly partitioned into three layers:
1. **Repository Layer (`src/repository/`):** Pure Prisma database interactions. Handles atomic queries, transactions, and composite relational fetching. No HTTP logic or business calculations.
2. **Service Layer (`src/service/`):** Pure business logic (e.g., IST shift date calculation, net working hours evaluation, grace period calculation, leave deduction, SSO token generation). No direct HTTP request/response dependencies.
3. **Controller / Route Handler Layer (`src/app/api/`):** HTTP request parsing, Zod schema validation, session validation, service delegation, error status formatting, and JSON responses.

---

## 3. Business Rules & Operational Logic

### 3.1 The Indian Standard Time (IST) Night-Shift Engine
Capital Bridge operations run night shifts aligned with US freight brokerage trading hours. Shifts begin in the Indian evening and conclude the following morning.

#### Master Shift Catalog
| Shift Code | Display Name | Scheduled Start (IST) | Scheduled End (IST) | Standard Duration |
|---|---|---|---|---|
| `SHIFT_1700` | 17:00 - 01:30 IST | 17:00 | 01:30 (+1 day) | 8.5 hours (510 mins) |
| `SHIFT_1730` | 17:30 - 02:00 IST | 17:30 | 02:00 (+1 day) | 8.5 hours (510 mins) |
| `SHIFT_1800` | 18:00 - 02:30 IST | 18:00 | 02:30 (+1 day) | 8.5 hours (510 mins) |
| `SHIFT_1830` | 18:30 - 03:00 IST | 18:30 | 03:00 (+1 day) | 8.5 hours (510 mins) |
| `SHIFT_1900` | 19:00 - 03:30 IST | 19:00 | 03:30 (+1 day) | 8.5 hours (510 mins) |
| `SHIFT_1930` | 19:30 - 04:00 IST | 19:30 | 04:00 (+1 day) | 8.5 hours (510 mins) |

#### Rule BR-IST-001: Calendar Date Anchoring (`workDate`)
- A shift's `workDate` is permanently bound to the **calendar date in IST** when the employee first punches in.
- *Example:* An employee on `SHIFT_1900` punches in at 18:50 IST on October 31 and punches out at 03:40 IST on November 1.
  - The record's `workDate` is strictly `"2026-10-31"`.
  - All gross hours, break minutes, net work minutes, and attendance statuses belong exclusively to October 31.
  - November 1 remains completely clean and available for that evening's scheduled shift.

#### Rule BR-IST-002: Early Arrival Grace Window
- Employees are permitted to punch in up to **120 minutes (2 hours)** before their scheduled shift start time.
- Early punches accrue gross time without penalty and without altering the scheduled shift window.

#### Rule BR-IST-003: Late Threshold (`isLate` Flag)
- A 15-minute grace period is provided beyond the scheduled start time.
- If `firstPunchIn` occurs $\le (\text{shiftStartTime} + 15\text{ minutes})$, the shift is on time (`isLate = false`, `lateMinutes = 0`).
- If `firstPunchIn` occurs $> (\text{shiftStartTime} + 15\text{ minutes})$, the record is tagged `isLate = true`, and `lateMinutes` records the exact tardiness beyond scheduled start.

#### Rule BR-IST-004: Stale Shift Safeguard (Forgotten Punch-Out)
- If an attendance record remains in `IN_PROGRESS` or `ON_BREAK` for greater than **16 continuous hours** from `firstPunchIn`, the system automatically marks it as `ANOMALY_STALE` and flags it for Admin Regularization. The live timer stops accumulating automatically to avoid corrupting payroll records.

---

### 3.2 Working Hours & Attendance Status Rules

#### Rule BR-ATT-001: Net Working Time Formula
$$\text{Net Work Minutes} = (\text{lastPunchOut} - \text{firstPunchIn}) - \text{Total Break Minutes}$$

#### Rule BR-ATT-002: Status Evaluation Matrix
Upon shift completion (`PUNCH_OUT`), the record's final status is calculated:

| Condition | Status Code | Label | UI Badge Color | Description |
|---|:---:|---|---|---|
| Shift active / punch-out pending | `IN_PROGRESS` | In Progress | Blue / Animated Pulse | Active live work shift |
| $\text{Net Work} \ge 450\text{ mins}$ ($\ge 7.5\text{ hrs}$) | `P` | Present (Full Day) | Emerald Green | Completed full shift |
| $300 \le \text{Net Work} < 450\text{ mins}$ ($5.0\text{–}7.5\text{ hrs}$) | `HD` | Half Day | Amber / Orange | Completed partial shift |
| $\text{Net Work} < 300\text{ mins}$ ($< 5.0\text{ hrs}$) | `A` | Absent | Rose / Red | Insufficient hours worked |
| Approved leave record covers `workDate` | `LV` | Approved Leave | Indigo Blue | Excused planned absence |
| Saturday or Sunday without scheduled punch | `WO` | Week Off | Muted Slate | Standard company weekend |

---

### 3.3 Unlimited Break State Machine

#### Rule BR-BRK-001: Unlimited Break Frequency
- There are no arbitrary limits on the number of breaks an employee may take (e.g., no rigid 15-15-30 restrictions).
- Every break is modeled as an individual `BreakRecord` with `breakStart`, `breakEnd`, and `durationMinutes`.

#### Rule BR-BRK-002: Finite State Machine (FSM) Transitions
- `IDLE` $\xrightarrow{\text{PUNCH\_IN}}$ `WORKING` (Work timer starts)
- `WORKING` $\xrightarrow{\text{TAKE\_BREAK}}$ `ON_BREAK` (Work timer pauses, break timer starts)
- `ON_BREAK` $\xrightarrow{\text{RESUME\_WORK}}$ `WORKING` (Break timer closes, work timer resumes)
- `WORKING` $\xrightarrow{\text{PUNCH\_OUT}}$ `COMPLETED` (Shift sealed, hours calculated)
- `ON_BREAK` $\xrightarrow{\text{PUNCH\_OUT}}$ `COMPLETED` (**Auto-close rule:** Current break is automatically ended at the punch-out timestamp, its duration finalized, and the shift is completed).

---

### 3.4 Leave Management & Admin Regularization

#### Rule BR-LV-001: Leave Balance & Application
- Employees submit leave requests specifying `LeaveType` (`CASUAL`, `SICK`, `PRIVILEGED`), start date, end date, and mandatory reason.
- Overlapping active leave applications for the same date range are rejected.

#### Rule BR-LV-002: Automatic Attendance Updating on Approval
- When an Administrator approves a leave request (`status = APPROVED`), the system automatically ensures attendance records for all dates within the inclusive `[startDate, endDate]` range (excluding Saturdays/Sundays) are set to status `LV`.
- If an employee later punches in on an approved leave date, the punch overrides `LV` to `IN_PROGRESS` and subsequently evaluates based on hours worked.

#### Rule BR-REG-001: Admin Regularization Audit Trail
- An Administrator can manually edit an attendance record (punch times, status, breaks).
- Every administrative change requires a non-empty `reason` string.
- An immutable `AttendanceAuditLog` entry is generated recording:
  - `adminId`
  - `previousValues` (full JSON snapshot)
  - `newValues` (full JSON snapshot)
  - `reason`
  - `createdAt` timestamp
- The attendance record is flagged with `isRegularized = true`.

---

### 3.5 Single Sign-On (SSO) Bridge to CRM

#### Rule BR-SSO-001: One-Click Authentication Bridge
- From the HRM top navigation, an authenticated employee clicks `[Open CRM]`.
- HRM creates an HMAC-SHA256 signed JWT containing:
  - `userId`: CRM User ID
  - `email`: Employee corporate email
  - `exp`: Current time $+ 60$ seconds
  - `iss`: `"capital-bridge-hrm"`
- The browser opens `https://crm.capitalbridgelogistics.com/api/auth/sso?token=<jwt>` in a new tab.
- CRM validates the token against `SHARED_SSO_SECRET`, verifies the user is active, sets the NextAuth session cookie, and redirects immediately to CRM `/dashboard`.

---

## 4. Roles & Permissions Catalog

### 4.1 Master System Roles (Managed by CRM)
1. `ADMIN`: Full company-wide operational visibility, leave approval, attendance regularization, shift scheduling, and reporting.
2. `BROKER`: Standard employee portal access (personal attendance, breaks, leave requests, open CRM).
3. `ACCOUNTANT`: Standard employee portal access with accounting CRM access.
4. `DISPATCHER`: Standard employee portal access with dispatch CRM access.
5. `OPERATIONS`: Operational oversight and live team monitoring.

### 4.2 HRM Permissions Catalog
Permissions are stored in the shared CRM `permissions` table under categories `ATTENDANCE` and `LEAVE`:

| Permission Code | Category | Description | Granted to Admin | Granted to Employee Roles |
|---|---|---|:---:|:---:|
| `ATTENDANCE_MARK` | ATTENDANCE | Can punch in/out, take breaks, and view personal attendance. | Yes | Yes (All) |
| `ATTENDANCE_VIEW_ALL` | ATTENDANCE | Can view company-wide live rosters, team attendance, and historical calendars. | Yes | No |
| `ATTENDANCE_EDIT` | ATTENDANCE | Can edit punch times, adjust statuses, and regularize records. | Yes | No |
| `LEAVE_REQUEST` | LEAVE | Can submit personal leave applications and view leave balance. | Yes | Yes (All) |
| `LEAVE_APPROVE` | LEAVE | Can approve or reject employee leave applications across the company. | Yes | No |

---

## 5. Functional Requirements (FR)

### Authentication & User Sync
- **FR-AUTH-001:** Users must log in using their CRM email and password verified via bcrypt.
- **FR-AUTH-002:** Inactive users (`isActive = false` in CRM) must be rejected with code `AUTH_ACCOUNT_INACTIVE`.
- **FR-AUTH-003:** Deactivating a user in CRM must immediately prevent further logins or active token usage in HRM.
- **FR-AUTH-004:** The system must verify IP restrictions if configured on the user in the shared database.

### IST Clock & Shift Attendance
- **FR-ATT-001:** The dashboard must display a real-time digital clock synchronized to Indian Standard Time (IST).
- **FR-ATT-002:** An employee can punch in if they do not have an active shift in progress.
- **FR-ATT-003:** Punch-in locks the `workDate` to the current IST calendar date.
- **FR-ATT-004:** If punch-in occurs $> 15$ minutes past assigned shift start, the record must be marked `isLate = true`.
- **FR-ATT-005:** Punch-out calculates net working minutes and assigns status `P`, `HD`, or `A` according to Rule BR-ATT-002.
- **FR-ATT-006:** Personal attendance history must render on a monthly calendar grid with daily detail cards.

### Break Engine
- **FR-BRK-001:** While in `WORKING` state, the employee can start a break, transitioning to `ON_BREAK`.
- **FR-BRK-002:** While in `ON_BREAK` state, the work timer stops and the break timer runs.
- **FR-BRK-003:** The employee can resume work from a break, finalizing the `durationMinutes` of that break record.
- **FR-BRK-004:** Punching out while on break automatically ends the active break record and records punch-out time.

### Leave Management
- **FR-LV-001:** Employees can submit leave applications with type, start date, end date, and reason.
- **FR-LV-002:** Administrators see pending leave requests with notification badges in the navigation header.
- **FR-LV-003:** Approving a leave marks attendance dates as `LV` and records `reviewedBy` and `reviewedAt`.
- **FR-LV-004:** Rejecting a leave records the admin's decision and keeps the employee informed.

### Admin Command Center & Regularization
- **FR-ADM-001:** Administrators can view the live roster showing who is currently working, on break, late, or absent.
- **FR-ADM-002:** Administrators can filter rosters by date, shift, department, and status.
- **FR-ADM-003:** Administrators can edit any employee's attendance record with a mandatory explanation.
- **FR-ADM-004:** Every edit generates an immutable `AttendanceAuditLog` entry.
- **FR-ADM-005:** Administrators can manage shift definitions and assign employees to shifts with effective date ranges.

### SSO Bridge
- **FR-SSO-001:** Authenticated users can click `[Open CRM]` to generate an HMAC-SHA256 JWT.
- **FR-SSO-002:** The JWT must expire after 60 seconds and be non-reusable.
- **FR-SSO-003:** CRM validates the token and sets a valid NextAuth session cookie for the user.

---

## 6. Non-Functional Requirements (NFR)

### Performance & Time Integrity
- **NFR-PERF-001 (Clock Drift):** Client-side IST clock must synchronize with server time on page load to prevent local OS clock manipulation; drift must remain $< 500\text{ms}$.
- **NFR-PERF-002 (API Latency):** Punch-in, break toggling, and punch-out APIs must respond in $p95 < 150\text{ms}$.
- **NFR-PERF-003 (Roster Query):** The company-wide live roster query for up to 500 concurrent employees must execute in $< 200\text{ms}$.

### Security & Data Protection
- **NFR-SEC-001 (Credential Isolation):** HRM reads `passwordHash` strictly for bcrypt comparison; passwords are never logged, echoed, or stored in plaintext.
- **NFR-SEC-002 (SSO Secret):** `SHARED_SSO_SECRET` must be at least 256 bits (32 characters) and stored securely in environment variables.
- **NFR-SEC-003 (Tamper Resistance):** All attendance timestamps are generated server-side using UTC timestamps; client-provided punch timestamps are discarded.

### Reliability & Database Safety
- **NFR-REL-001 (Zero CRM Mutation):** HRM migrations must NEVER create, modify, or drop CRM-owned tables (`users`, `roles`, `shipments`, `customers`, etc.).
- **NFR-REL-002 (Transactional Integrity):** Ending a break and punching out simultaneously must execute inside a Prisma interactive transaction (`prisma.$transaction`).
- **NFR-REL-003 (Audit Immutability):** `AttendanceAuditLog` records cannot be updated or deleted by any API route or user role.

### User Experience
- **NFR-UX-001 (Zero Page Reload):** Punch-in, break start, resume work, and punch-out actions must update the UI optimistically without full page reloads.
- **NFR-UX-002 (Responsive Design):** The attendance dashboard must function seamlessly on desktop, tablet, and mobile displays.
- **NFR-UX-003 (Visual Clarity):** Shift statuses (`P`, `HD`, `A`, `LV`, `WO`, `L`) must be color-coded and distinct for rapid visual scanning.

