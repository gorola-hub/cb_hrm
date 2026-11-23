# Database Schema Specification: Capital Bridge HRM

This document provides the authoritative database schema definition for **Capital Bridge HRM (CB HRM)** in plain English and Prisma notation. It explicitly defines table ownership boundaries between CB CRM and CB HRM.

---

## 1. Architectural Boundary & Data Ownership

Both CB CRM and CB HRM connect to the **same PostgreSQL database instance** (`cb_crm`). Data ownership is strictly partitioned:

```
+-----------------------------------------------------------------------------------------+
|                                SHARED POSTGRESQL DATABASE                               |
+--------------------------------------------+--------------------------------------------+
|         CRM-OWNED TABLES (Read-Only in HRM)|          HRM-OWNED TABLES (Managed by HRM) |
+--------------------------------------------+--------------------------------------------+
| * users                                    | * hrm_shifts                               |
| * roles                                    | * hrm_employee_shifts                      |
| * designations                             | * hrm_attendance_records                   |
| * permissions                              | * hrm_break_records                        |
| * role_permissions                         | * hrm_leave_requests                       |
| * allowed_ips                              | * hrm_holidays                             |
| * customers, carriers, shipments, ...      | * hrm_attendance_audit_logs                |
+--------------------------------------------+--------------------------------------------+
```

### Critical Rules on Ownership:
1. **Zero HRM Migrations on CRM Tables:** HRM's Prisma migrations manage ONLY tables with the `hrm_` prefix. CRM tables (`users`, `roles`, etc.) are declared in HRM's `schema.prisma` strictly for type-checking and relational joins.
2. **Single User Master:** All user onboarding, credentials, email updates, role assignments, and deactivations occur in CRM. HRM never executes `INSERT`, `UPDATE`, or `DELETE` on the `users` table.
3. **No Direct `systemRole` Column:** The `users` table uses `roleId` referencing `roles.id`. The role code (`ADMIN`, `BROKER`, etc.) lives in `roles.code`. HRM reads `role.code` and does NOT declare a direct `systemRole` column on `model User`.

---

## 2. Entity Relationship Diagram (Plain English Overview)

```
[ CRM: users ] ─── (1:N) ───> [ hrm_employee_shifts ] <─── (N:1) ─── [ hrm_shifts ]
      │                                                                      │
      ├─── (1:N) ───> [ hrm_attendance_records ] <──────────── (N:1) ────────┘
      │                       │
      │                       └─── (1:N) ───> [ hrm_break_records ]
      │                       │
      │                       └─── (1:N) ───> [ hrm_attendance_audit_logs ]
      │
      ├─── (1:N) ───> [ hrm_leave_requests ] (Employee)
      │
      └─── (1:N) ───> [ hrm_leave_requests ] (Reviewer / Admin)
```

---

## 3. CRM-Owned Tables (Read-Only in HRM)

### 3.1 `users`
The central identity and employee profile table managed solely by CRM.
- `id` (String, Primary Key, CUID): Unique user identifier.
- `email` (String, Unique): Corporate email address used for login.
- `name` (String): Full legal / display name.
- `passwordHash` (String): Bcrypt hashed password (used in HRM auth verification).
- `roleId` (String, Foreign Key $\rightarrow$ `roles.id`): Assigned system role.
- `designationId` (String, Nullable, Foreign Key $\rightarrow$ `designations.id`): Assigned company designation.
- `empId` (String, Nullable, Unique): Company employee ID badge number.
- `alias` (String, Nullable): Operating broker alias / floor name.
- `isActive` (Boolean, Default: `true`): Active status. When `false`, HRM immediately denies login.
- `createdAt` / `updatedAt` (DateTime): Audit timestamps.

### 3.2 `roles`
Master catalog of security roles.
- `id` (String, Primary Key, CUID): Unique role identifier.
- `name` (String, Unique): Display name (e.g., `"Admin"`, `"Broker"`, `"Accountant"`).
- `code` (String, Unique): Normalized identifier (`"ADMIN"`, `"BROKER"`, `"ACCOUNTANT"`, `"DISPATCHER"`, `"OPERATIONS"`).
- `isSystem` (Boolean, Default: `false`): System protection flag.

### 3.3 `designations`
Company organizational designations.
- `id` (String, Primary Key, CUID): Unique designation identifier.
- `name` (String, Unique): Title (e.g., `"Senior Freight Broker"`, `"Logistics Coordinator"`).
- `code` (String, Unique): Short code.

### 3.4 `permissions` & `role_permissions`
Granular authorization matrix.
- `permissions.code` (String, Primary Key / Unique): Permission codes (`ATTENDANCE_MARK`, `ATTENDANCE_VIEW_ALL`, etc.).
- `role_permissions`: Junction table mapping `roleId` to `permissionCode` with `isGranted` boolean flag.

---

## 4. HRM-Owned Tables (Managed by HRM)

### 4.1 `hrm_shifts`
Master definitions of company shifts in Indian Standard Time (IST).

| Column Name | Type | Constraints | Description |
|---|---|---|---|
| `id` | String | Primary Key, `@default(cuid())` | Unique shift record ID |
| `code` | Enum (`ShiftCode`) | Unique | `SHIFT_1700`, `SHIFT_1730`, `SHIFT_1800`, `SHIFT_1830`, `SHIFT_1900`, `SHIFT_1930` |
| `displayName` | String | Non-null | User-facing shift label, e.g. `"19:00 - 03:30 IST"` |
| `startTime` | String | Non-null | 24-hr scheduled start time in IST (`"19:00"`) |
| `durationMins` | Integer | Non-null, Default: `510` | Standard shift window in minutes (8.5 hours) |
| `graceMinutes` | Integer | Non-null, Default: `15` | Minutes past start time before marked Late (`L`) |
| `isActive` | Boolean | Non-null, Default: `true` | Whether this shift is currently available for assignment |
| `createdAt` | DateTime | Default: `now()` | Record creation timestamp |
| `updatedAt` | DateTime | Non-null, `@updatedAt` | Record update timestamp |

---

### 4.2 `hrm_employee_shifts`
Maps an employee to their assigned shift schedule across effective time periods.

| Column Name | Type | Constraints | Description |
|---|---|---|---|
| `id` | String | Primary Key, `@default(cuid())` | Unique assignment ID |
| `userId` | String | Foreign Key $\rightarrow$ `users.id`, `onDelete: Cascade` | Employee user ID |
| `shiftId` | String | Foreign Key $\rightarrow$ `hrm_shifts.id` | Assigned shift ID |
| `effectiveFrom` | DateTime | Non-null, Default: `now()` | Start date/time of this assignment |
| `effectiveTo` | DateTime | Nullable | End date/time (null if currently active assignment) |
| `createdAt` | DateTime | Default: `now()` | Timestamp |
| `updatedAt` | DateTime | Non-null, `@updatedAt` | Timestamp |

- **Indexes:** `@@index([userId, effectiveFrom])`

---

### 4.3 `hrm_attendance_records`
Core daily attendance record capturing punch events, hours worked, and status strictly anchored to IST calendar date.

| Column Name | Type | Constraints | Description |
|---|---|---|---|
| `id` | String | Primary Key, `@default(cuid())` | Unique attendance record ID |
| `userId` | String | Foreign Key $\rightarrow$ `users.id`, `onDelete: Cascade` | Employee user ID |
| `shiftId` | String | Nullable, Foreign Key $\rightarrow$ `hrm_shifts.id` | Shift assigned at time of punch-in |
| `workDate` | String | Non-null | Format `"YYYY-MM-DD"`. Locked permanently to IST date of first punch-in. |
| `firstPunchIn` | DateTime | Non-null | UTC timestamp of shift start (rendered in IST) |
| `lastPunchOut` | DateTime | Nullable | UTC timestamp of shift completion (null while in progress) |
| `grossMinutes` | Integer | Non-null, Default: `0` | Total duration between `firstPunchIn` and `lastPunchOut` |
| `totalBreakMinutes`| Integer | Non-null, Default: `0` | Cumulative minutes of all completed breaks |
| `netWorkMinutes` | Integer | Non-null, Default: `0` | `grossMinutes - totalBreakMinutes` |
| `isLate` | Boolean | Non-null, Default: `false` | True if punched in $> 15$ mins after shift start |
| `lateMinutes` | Integer | Non-null, Default: `0` | Minutes late beyond scheduled shift start |
| `status` | Enum (`AttendanceStatus`)| Non-null, Default: `IN_PROGRESS` | `IN_PROGRESS`, `P` (Present), `HD` (Half Day), `A` (Absent), `WO` (Week Off), `LV` (Leave) |
| `isRegularized` | Boolean | Non-null, Default: `false` | True if edited manually by an Administrator |
| `createdAt` | DateTime | Default: `now()` | Timestamp |
| `updatedAt` | DateTime | Non-null, `@updatedAt` | Timestamp |

- **Unique Constraints:** `@@unique([userId, workDate])` — strictly prevents duplicate attendance records for the same employee on the same IST business date.
- **Indexes:** `@@index([workDate, status])`, `@@index([userId, status])`

---

### 4.4 `hrm_break_records`
Tracks individual break intervals for an attendance shift. Enables unlimited breaks.

| Column Name | Type | Constraints | Description |
|---|---|---|---|
| `id` | String | Primary Key, `@default(cuid())` | Unique break record ID |
| `attendanceRecordId`| String | Foreign Key $\rightarrow$ `hrm_attendance_records.id`, `onDelete: Cascade` | Parent shift attendance ID |
| `breakStart` | DateTime | Non-null | UTC timestamp when break began |
| `breakEnd` | DateTime | Nullable | UTC timestamp when break ended (null while actively on break) |
| `durationMinutes` | Integer | Non-null, Default: `0` | Calculated duration of this break in minutes |
| `createdAt` | DateTime | Default: `now()` | Timestamp |
| `updatedAt` | DateTime | Non-null, `@updatedAt` | Timestamp |

- **Indexes:** `@@index([attendanceRecordId])`

---

### 4.5 `hrm_leave_requests`
Employee leave applications and administrative approval lifecycle.

| Column Name | Type | Constraints | Description |
|---|---|---|---|
| `id` | String | Primary Key, `@default(cuid())` | Unique leave request ID |
| `userId` | String | Foreign Key $\rightarrow$ `users.id`, `onDelete: Cascade` | Applicant employee ID |
| `leaveType` | Enum (`LeaveType`)| Non-null | `CASUAL`, `SICK`, `PRIVILEGED` |
| `startDate` | String | Non-null | Format `"YYYY-MM-DD"` (inclusive start in IST) |
| `endDate` | String | Non-null | Format `"YYYY-MM-DD"` (inclusive end in IST) |
| `totalDays` | Integer | Non-null | Total working days covered (excluding weekends) |
| `reason` | String | Non-null | Employee's stated justification |
| `status` | Enum (`LeaveStatus`)| Non-null, Default: `PENDING` | `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED` |
| `reviewedBy` | String | Nullable, Foreign Key $\rightarrow$ `users.id` | Administrator who reviewed the request |
| `reviewedAt` | DateTime | Nullable | Review timestamp |
| `adminNotes` | String | Nullable | Administrative notes or rejection explanation |
| `createdAt` | DateTime | Default: `now()` | Submission timestamp |
| `updatedAt` | DateTime | Non-null, `@updatedAt` | Timestamp |

- **Indexes:** `@@index([userId, status])`, `@@index([status])`

---

### 4.6 `hrm_holidays`
Official corporate public holidays recognized by Capital Bridge.

| Column Name | Type | Constraints | Description |
|---|---|---|---|
| `id` | String | Primary Key, `@default(cuid())` | Unique holiday ID |
| `date` | String | Unique, Non-null | Format `"YYYY-MM-DD"` |
| `name` | String | Non-null | Holiday name (e.g., `"Republic Day"`, `"Diwali"`) |
| `description` | String | Nullable | Additional context |
| `createdAt` | DateTime | Default: `now()` | Timestamp |
| `updatedAt` | DateTime | Non-null, `@updatedAt` | Timestamp |

---

### 4.7 `hrm_attendance_audit_logs`
Immutable audit history recording all manual administrative edits and regularizations.

| Column Name | Type | Constraints | Description |
|---|---|---|---|
| `id` | String | Primary Key, `@default(cuid())` | Unique audit record ID |
| `attendanceRecordId`| String | Foreign Key $\rightarrow$ `hrm_attendance_records.id`, `onDelete: Cascade` | Target attendance record ID |
| `adminId` | String | Foreign Key $\rightarrow$ `users.id` | Administrator performing the edit |
| `previousValues` | Json | Non-null | JSON snapshot of record state before edit |
| `newValues` | Json | Non-null | JSON snapshot of record state after edit |
| `reason` | String | Non-null | Mandatory administrative explanation |
| `createdAt` | DateTime | Default: `now()` | Timestamp of modification |

- **Indexes:** `@@index([attendanceRecordId])`

---

## 5. HRM Complete Prisma Schema (`cb_hrm/prisma/schema.prisma`)

```prisma
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
  id            String       @id
  name          String
  email         String       @unique
  empId         String?      @unique
  alias         String?
  isActive      Boolean      @default(true)
  roleId        String
  role          Role         @relation(fields: [roleId], references: [id])
  designationId String?
  designation   Designation? @relation(fields: [designationId], references: [id])

  // HRM Native Relations
  employeeShifts      EmployeeShift[]
  attendanceRecords   AttendanceRecord[]
  leaveRequests       LeaveRequest[]       @relation("EmployeeLeaves")
  reviewedLeaves      LeaveRequest[]       @relation("ReviewedLeaves")
  attendanceAuditLogs AttendanceAuditLog[] @relation("AdminAuditLogs")

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

  role       Role       @relation(fields: [roleId], references: [id])
  permission Permission @relation(fields: [permissionCode], references: [code])

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
  IN_PROGRESS
  P
  HD
  A
  WO
  LV
}

enum LeaveType {
  CASUAL
  SICK
  PRIVILEGED
}

enum LeaveStatus {
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}

model Shift {
  id           String    @id @default(cuid())
  code         ShiftCode @unique
  displayName  String
  startTime    String
  durationMins Int       @default(510)
  graceMinutes Int       @default(15)
  isActive     Boolean   @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

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

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  shift Shift @relation(fields: [shiftId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId, effectiveFrom])
  @@map("hrm_employee_shifts")
}

model AttendanceRecord {
  id                String           @id @default(cuid())
  userId            String
  shiftId           String?
  workDate          String
  firstPunchIn      DateTime
  lastPunchOut      DateTime?
  grossMinutes      Int              @default(0)
  totalBreakMinutes Int              @default(0)
  netWorkMinutes    Int              @default(0)
  isLate            Boolean          @default(false)
  lateMinutes       Int              @default(0)
  status            AttendanceStatus @default(IN_PROGRESS)
  isRegularized     Boolean          @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user      User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  shift     Shift?               @relation(fields: [shiftId], references: [id])
  breaks    BreakRecord[]
  auditLogs AttendanceAuditLog[]

  @@unique([userId, workDate])
  @@index([workDate, status])
  @@index([userId, status])
  @@map("hrm_attendance_records")
}

model BreakRecord {
  id                 String    @id @default(cuid())
  attendanceRecordId String
  breakStart         DateTime
  breakEnd           DateTime?
  durationMinutes    Int       @default(0)

  attendanceRecord AttendanceRecord @relation(fields: [attendanceRecordId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([attendanceRecordId])
  @@map("hrm_break_records")
}

model LeaveRequest {
  id         String      @id @default(cuid())
  userId     String
  leaveType  LeaveType
  startDate  String
  endDate    String
  totalDays  Int
  reason     String
  status     LeaveStatus @default(PENDING)
  reviewedBy String?
  reviewedAt DateTime?
  adminNotes String?

  user     User  @relation("EmployeeLeaves", fields: [userId], references: [id], onDelete: Cascade)
  reviewer User? @relation("ReviewedLeaves", fields: [reviewedBy], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId, status])
  @@index([status])
  @@map("hrm_leave_requests")
}

model Holiday {
  id          String   @id @default(cuid())
  date        String   @unique
  name        String
  description String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("hrm_holidays")
}

model AttendanceAuditLog {
  id                 String   @id @default(cuid())
  attendanceRecordId String
  adminId            String
  previousValues     Json
  newValues          Json
  reason             String
  createdAt          DateTime @default(now())

  attendanceRecord AttendanceRecord @relation(fields: [attendanceRecordId], references: [id], onDelete: Cascade)
  admin            User             @relation("AdminAuditLogs", fields: [adminId], references: [id])

  @@index([attendanceRecordId])
  @@map("hrm_attendance_audit_logs")
}
```

