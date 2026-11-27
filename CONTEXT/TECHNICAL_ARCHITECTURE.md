# Capital Bridge HRM — Complete Technical Architecture & System Specification

> **Target Audience:** Engineering Team, System Architects & AI Coding Agents  
> **Status:** Authoritative Architectural Blueprint  
> **Companion Document:** CLIENT_OPERATIONAL_GUIDE.md  
> **Date:** October 2026

---

## 1. System Topology & Infrastructure Architecture

Capital Bridge operates two decoupled, specialized web applications powered by a single unified PostgreSQL database:

+----------------------------------------------------------------------------------------+
|                              CAPITAL BRIDGE ECOSYSTEM                                  |
+----------------------------------------+-----------------------------------------------+
|          CAPITAL BRIDGE CRM            |               CAPITAL BRIDGE HRM              |
|       (Freight Brokerage Core)         |        (Employee Self-Service Portal)         |
+----------------------------------------+-----------------------------------------------+
| * Production URL:                      | * Production URL:                             |
|   crm.capitalbridgelogistics.com       |   hrm.capitalbridgelogistics.com              |
| * Local Dev: http://localhost:3000     | * Local Dev: http://localhost:3001            |
| * Framework: Next.js 16 App Router     | * Framework: Next.js 16 App Router            |
| * Language: TypeScript                 | * Language: TypeScript                        |
| * Domain: Freight Brokerage Core       | * Domain: Employee Self-Service & Attendance  |
|   - Shipments, Customers, Carriers     |   - Indian Standard Time (IST) Clock Engine   |
|   - Factoring Companies & AR/AP        |   - Night Shifts (17:00 to 19:30 start times) |
|   - Banking & Accounting Exports       |   - Unlimited Break Tracking (Break / Back)   |
| * Role in Auth:                        |   - Leave Requests & Admin Approval Queue     |
|   - Identity Provider & User Master    |   - Admin Regularization & Audit Trail        |
|   - Centralized RBAC & Permissions     | * Role in Auth:                               |
|                                        |   - Employee Front-Door (Login & Punch-In)    |
|                                        |   - One-Click SSO Token Issuer for CRM        |
+----------------------------------------+-----------------------------------------------+
                                         |
                                         v
+----------------------------------------------------------------------------------------+
|                         SHARED POSTGRESQL DATABASE INSTANCE                            |
|                 (Hosted on Railway / Neon / Local Docker PostgreSQL)                   |
+----------------------------------------------------------------------------------------+
| CRM-Owned Tables:                                                                      |
|   users, roles, designations, permissions, role_permissions, allowed_ips,              |
|   customers, carriers, factoring_companies, shipments, shipment_locations, ...        |
|                                                                                        |
| HRM-Owned Tables:                                                                      |
|   hrm_shifts, hrm_employee_shifts, hrm_attendance_records, hrm_break_records,          |
|   hrm_leave_requests, hrm_holidays, hrm_attendance_audit_logs                          |
+----------------------------------------------------------------------------------------+

### Why Standalone Repositories Instead of a Monorepo?
1. Zero Production Risk to CRM: The CRM is a mature production application with 29 completed engineering phases and strict CI/CD pipelines. Converting to a monorepo would require moving files, rewriting imports, reconfiguring Railway builds, and risking existing regression tests for no business benefit.
2. Independent Deployment Lifecycles: HRM features, UI enhancements, and attendance updates can be deployed rapidly without triggering CRM builds or risking freight brokerage uptime.
3. Clean Domain Separation: US freight brokerage logic (US timezones, USD financials, factoring rules) is kept completely decoupled from Indian HR operations (IST timezone, punch-in/out, night-shift rules).

---

## 2. Shared Database Boundary & Data Ownership

Both applications connect via their respective DATABASE_URL environment variables to the same single PostgreSQL database instance. Data ownership is partitioned with crystal clarity:

### 2.1 Central User Master (CRM-Owned)
- The CRM manages employee onboarding, profile updates, password hashing (bcrypt), role assignments, and deactivation.
- HRM has read-only access to users, roles, and designations.
- When an employee is deactivated in CRM (isActive = false), their access is instantaneously revoked in HRM.

### 2.2 Table Inventory & Authority Matrix

| Table Name | Managed By | Foreign Key Relations | Description / Purpose |
|---|:---:|---|---|
| users | CRM | roleId -> roles.id, designationId -> designations.id | Single source of truth for credentials and employee identity. |
| roles | CRM | Referenced by role_permissions and users | Master roles (Admin, Broker, Accountant, Dispatcher). |
| designations | CRM | Referenced by users | Dynamic company designations. |
| permissions | CRM | Referenced by role_permissions | Master catalog of granular system permissions. |
| role_permissions | CRM | roleId -> roles.id, permissionCode -> permissions.code | Role-permission assignment matrix. |
| hrm_shifts | HRM | None | Master shift definitions (17:00, 17:30, 18:00, 18:30, 19:00, 19:30). |
| hrm_employee_shifts | HRM | userId -> users.id, shiftId -> hrm_shifts.id | Assignment of an employee to a scheduled shift. |
| hrm_attendance_records | HRM | userId -> users.id, shiftId -> hrm_shifts.id | Daily shift attendance, workDate, punches, net duration, status. |
| hrm_break_records | HRM | attendanceRecordId -> hrm_attendance_records.id | Individual break intervals (breakStart, breakEnd, durationMinutes). |
| hrm_leave_requests | HRM | userId -> users.id, reviewedBy -> users.id | Employee leave applications, date ranges, and approval status. |
| hrm_holidays | HRM | None | Company official public holidays. |
| hrm_attendance_audit_logs | HRM | attendanceRecordId -> hrm_attendance_records.id, adminId -> users.id | Audit log for any admin edits/regularizations. |

---

## 3. Database Schema Specifications (Prisma)

### 3.1 HRM Prisma Schema (cb_hrm/prisma/schema.prisma)

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// =============================================================
// READ-ONLY CRM REFERENCES (Unmanaged by HRM migrations)
// =============================================================

model User {
  id             String          @id
  name           String
  email          String          @unique
  empId          String?         @unique
  alias          String?
  systemRole     String
  isActive       Boolean         @default(true)
  roleId         String
  role           Role            @relation(fields: [roleId], references: [id])
  designationId  String?
  designation    Designation?    @relation(fields: [designationId], references: [id])

  // HRM Native Relations
  employeeShifts       EmployeeShift[]
  attendanceRecords    AttendanceRecord[]
  leaveRequests        LeaveRequest[]         @relation("EmployeeLeaves")
  reviewedLeaves       LeaveRequest[]         @relation("ReviewedLeaves")
  attendanceAuditLogs  AttendanceAuditLog[]   @relation("AdminAuditLogs")

  @@map("users")
}

model Role {
  id              String           @id
  name            String           @unique
  code            String           @unique
  rolePermissions RolePermission[]
  users           User[]

  @@map("roles")
}

model Designation {
  id    String @id
  name  String @unique
  code  String @unique
  users User[]

  @@map("designations")
}

model Permission {
  id              String           @id
  code            String           @unique
  description     String
  category        String
  rolePermissions RolePermission[]

  @@map("permissions")
}

model RolePermission {
  id             String     @id
  roleId         String
  permissionCode String
  isGranted      Boolean    @default(false)

  role           Role       @relation(fields: [roleId], references: [id])
  permission     Permission @relation(fields: [permissionCode], references: [code])

  @@unique([roleId, permissionCode])
  @@map("role_permissions")
}

// =============================================================
// HRM NATIVE MODELS (Managed by HRM migrations)
// =============================================================

enum ShiftCode {
  SHIFT_1700
  SHIFT_1730
  SHIFT_1800
  SHIFT_1830
  SHIFT_1900
  SHIFT_1930
}

enum AttendanceStatus {
  IN_PROGRESS   // Active shift, punch-out pending
  P             // Present (> 7.5 hrs net work)
  HD            // Half Day (5.0 to 7.5 hrs net work)
  A             // Absent (< 5.0 hrs net work or missed shift)
  WO            // Week Off (Saturday / Sunday)
  LV            // Approved Leave
  ANOMALY_STALE // Forgotten punch-out (> 16 hours)
}

// Note: Dynamic leave types (`PAID` seeded by default; Admin-managed in `hrm_leave_types`)
// and shift schedules (`Shift.code` string in `hrm_shifts`) are stored in master tables
// rather than fixed Postgres enums (Decisions 10 & 11).

enum LeaveStatus {
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}

model Shift {
  id           String          @id @default(cuid())
  code         ShiftCode       @unique
  displayName  String          // e.g. "19:00 - 03:30 IST"
  startTime    String          // "19:00" (HH:mm format in IST)
  durationMins Int             @default(510) // 8.5 hours standard window
  graceMinutes Int             @default(15)  // 15 mins grace period before "L"
  isActive     Boolean         @default(true)

  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  employeeShifts    EmployeeShift[]
  attendanceRecords AttendanceRecord[]

  @@map("hrm_shifts")
}

model EmployeeShift {
  id            String    @id @default(cuid())
  userId        String
  shiftId       String
  effectiveFrom DateTime  @default(now())
  effectiveTo   DateTime?

  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  shift         Shift     @relation(fields: [shiftId], references: [id])

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([userId, effectiveFrom])
  @@map("hrm_employee_shifts")
}

model AttendanceRecord {
  id                String           @id @default(cuid())
  userId            String
  shiftId           String?
  workDate          String           // "YYYY-MM-DD" strictly anchored in IST
  firstPunchIn      DateTime         // UTC timestamp (displayed in IST)
  lastPunchOut      DateTime?        // UTC timestamp (displayed in IST)
  grossMinutes      Int              @default(0)
  totalBreakMinutes Int              @default(0)
  netWorkMinutes    Int              @default(0)
  isLate            Boolean          @default(false)
  lateMinutes       Int              @default(0)
  status            AttendanceStatus @default(IN_PROGRESS)
  isRegularized     Boolean          @default(false)

  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt

  user              User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  shift             Shift?           @relation(fields: [shiftId], references: [id])
  breaks            BreakRecord[]
  auditLogs         AttendanceAuditLog[]

  @@unique([userId, workDate])
  @@index([workDate, status])
  @@index([userId, status])
  @@map("hrm_attendance_records")
}

model BreakRecord {
  id                 String           @id @default(cuid())
  attendanceRecordId String
  breakStart         DateTime         // UTC timestamp
  breakEnd           DateTime?        // UTC timestamp (null while actively on break)
  durationMinutes    Int              @default(0)

  attendanceRecord   AttendanceRecord @relation(fields: [attendanceRecordId], references: [id], onDelete: Cascade)

  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt

  @@index([attendanceRecordId])
  @@map("hrm_break_records")
}

model LeaveRequest {
  id          String      @id @default(cuid())
  userId      String
  leaveType   LeaveType
  startDate   String      // "YYYY-MM-DD" (inclusive, in IST)
  endDate     String      // "YYYY-MM-DD" (inclusive, in IST)
  totalDays   Int
  reason      String
  status      LeaveStatus @default(PENDING)
  reviewedBy  String?
  reviewedAt  DateTime?
  adminNotes  String?

  user        User        @relation("EmployeeLeaves", fields: [userId], references: [id], onDelete: Cascade)
  reviewer    User?       @relation("ReviewedLeaves", fields: [reviewedBy], references: [id])

  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  @@index([userId, status])
  @@index([status])
  @@map("hrm_leave_requests")
}

model Holiday {
  id          String   @id @default(cuid())
  date        String   @unique // "YYYY-MM-DD"
  name        String
  description String?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("hrm_holidays")
}

model AttendanceAuditLog {
  id                 String           @id @default(cuid())
  attendanceRecordId String
  adminId            String
  previousValues     Json
  newValues          Json
  reason             String
  createdAt          DateTime         @default(now())

  attendanceRecord   AttendanceRecord @relation(fields: [attendanceRecordId], references: [id], onDelete: Cascade)
  admin              User             @relation("AdminAuditLogs", fields: [adminId], references: [id])

  @@index([attendanceRecordId])
  @@map("hrm_attendance_audit_logs")
}

---

## 4. Permissions & RBAC Architecture

Permissions are registered in the existing permissions table in the shared database under categories ATTENDANCE and LEAVE:

- `ATTENDANCE_MARK`: Punch in/out and take breaks (Assigned to: All Employees, Admin)
- `ATTENDANCE_VIEW_ALL`: View company-wide attendance rosters (Assigned to: Admin)
- `ATTENDANCE_EDIT`: Edit and regularize any attendance record (Assigned to: Admin)
- `LEAVE_REQUEST`: Submit personal leave requests (Assigned to: All Employees, Admin)
- `LEAVE_APPROVE`: Approve or reject employee leave requests (Assigned to: Admin)

---

## 5. Night-Shift & Indian Standard Time (IST) Engine

1. Business Date Anchoring (workDate):
   A shift's workDate is permanently bound to the IST calendar date on which the first punch-in occurred. Even though punch-out occurs the following morning (e.g., 03:30 AM IST), all hours and the status belong to the shift start date. The next morning's date remains clean.
2. Shift Schedule & Grace Window:
   Shifts: 17:00, 17:30, 18:00, 18:30, 19:00, 19:30.
   - Early Arrival Grace: Employees can punch in up to 120 minutes prior to scheduled start with 0 penalty.
   - Late Threshold: Punch-in > 15 minutes after shift start marks the record with the 'L' flag.
3. Daily Status Calculation Logic on Punch Out:
   - netWorkMinutes = (lastPunchOut - firstPunchIn) - totalBreakMinutes
   - >= 7.5 hours (450 mins) -> P (Present)
   - 5.0 to 7.5 hours (300-449 mins) -> HD (Half Day)
   - < 5.0 hours (< 300 mins) -> A (Absent)
   - Saturday / Sunday without shift -> WO (Week Off)
   - Approved Leave -> LV (On Leave)

---

## 6. Attendance & Break Finite State Machine (FSM)

States:
- IDLE: No shift in progress. [Action: PUNCH_IN]
- WORKING: Shift active. Timer running. [Actions: TAKE_BREAK, PUNCH_OUT]
- ON_BREAK: Break active. Work timer paused. [Actions: RESUME_WORK ("Back"), PUNCH_OUT (auto-closes break)]
- COMPLETED: Shift ended. Record sealed.

---

## 7. Single Sign-On (SSO) Bridge to CRM

1. Employee clicks "[Open CRM]" button in HRM.
2. HRM generates an HMAC-SHA256 signed JWT (60-second validity) with user ID.
3. Browser redirects to: `crm.capitalbridgelogistics.com/api/auth/sso?token=...`
4. CRM validates the token against SHARED_SSO_SECRET and checks user is active.
5. CRM issues the user's session cookie and redirects to `/dashboard`.
6. User enters CRM with zero password prompts.
