# Test Scenarios & Error Messages Catalog: Capital Bridge HRM

This document catalogs all functional test scenarios, expected database assertions, and user-facing error messages for **Capital Bridge HRM (CB HRM)**. AI agents and developers must reference these coded test scenarios when authoring TDD phase checklists.

---

## 1. User-Facing Error Messages & Status Codes Catalog

All API endpoints and form validations must return standardized JSON error envelopes:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "User-friendly plain English explanation."
  }
}
```

| Error Code | HTTP Status | User-Facing Message | Triggering Condition |
|---|:---:|---|---|
| `AUTH_INVALID_CREDENTIALS` | 401 | `"Invalid email or password. Please verify your company credentials."` | Password mismatch or email not found |
| `AUTH_ACCOUNT_INACTIVE` | 403 | `"Your account is deactivated in the CRM. Please contact your administrator."` | `user.isActive == false` |
| `AUTH_UNAUTHORIZED_IP` | 403 | `"Access denied: Your IP address is not authorized for company login."` | IP check fails against `allowed_ips` |
| `ATT_ALREADY_PUNCHED_IN` | 409 | `"You already have an active shift in progress for today."` | Punch-in attempted when `IN_PROGRESS` or `ON_BREAK` |
| `ATT_NO_ACTIVE_SHIFT` | 400 | `"No active shift found to punch out or record a break."` | Punch-out or break attempted when `IDLE` |
| `ATT_TOO_EARLY` | 400 | `"Punches are only allowed up to 120 minutes before scheduled shift start."` | Punch-in $> 120$ mins before shift |
| `BRK_ALREADY_ON_BREAK` | 409 | `"You are already on an active break. Please resume work before starting a new break."` | Take break attempted when state is `ON_BREAK` |
| `BRK_NOT_ON_BREAK` | 400 | `"You are not currently on break."` | Resume work attempted when state is `WORKING` |
| `LV_INVALID_DATE_RANGE` | 400 | `"End date cannot be earlier than start date."` | Leave request with `endDate < startDate` |
| `LV_OVERLAPPING_REQUEST` | 409 | `"You already have an active or pending leave request covering these dates."` | Overlapping leave application |
| `LV_EMPTY_REASON` | 400 | `"A valid reason is required when submitting a leave request."` | Blank or whitespace-only reason |
| `ADM_REGULARIZATION_REASON_REQUIRED` | 400 | `"A mandatory explanation is required to edit or regularize an attendance record."` | Admin edit submitted without explanation |
| `SSO_TOKEN_EXPIRED` | 401 | `"The CRM access token has expired. Please launch CRM again from the portal."` | SSO JWT age $> 60$ seconds |
| `SSO_TOKEN_INVALID` | 401 | `"Invalid authentication token signature."` | HMAC validation fails |

---

## 2. Test Scenarios (Plain English & Coded)

### 2.1 Authentication & User Synchronization (`TS-AUTH`)

#### `TS-AUTH-001`: Successful Employee Login
- **Given:** A user exists in CRM `users` table with `isActive = true` and bcrypt password hash for `"ValidPass123"`.
- **When:** User submits email and `"ValidPass123"` to HRM `/api/auth/login`.
- **Then:** Returns `200 OK`, sets secure session cookie, and returns user profile with assigned role (`user.role.code`).

#### `TS-AUTH-002`: Inactive Employee Login Block
- **Given:** An employee account has `isActive = false` in the CRM `users` table.
- **When:** User submits correct credentials to HRM login.
- **Then:** Returns `403 Forbidden` with error code `AUTH_ACCOUNT_INACTIVE`. No session cookie is issued.

#### `TS-AUTH-003`: Invalid Password
- **Given:** An active user exists in the database.
- **When:** User submits incorrect password.
- **Then:** Returns `401 Unauthorized` with error code `AUTH_INVALID_CREDENTIALS`.

#### `TS-AUTH-004`: Role & Designation Resolution
- **Given:** User is linked to `roleId` (`"ADMIN"`) and `designationId` (`"Senior Freight Broker"`).
- **When:** User session is verified via `/api/auth/session`.
- **Then:** Session payload contains `role: { code: "ADMIN" }` and `designation: { name: "Senior Freight Broker" }` without referencing any nonexistent `systemRole` column.

---

### 2.2 IST Night-Shift & Punch-In Engine (`TS-ATT`)

#### `TS-ATT-001`: On-Time Punch-In within Grace Period
- **Given:** Employee is assigned `SHIFT_1900` (19:00 IST start).
- **When:** Employee punches in at 18:55 IST on `2026-11-24`.
- **Then:**
  - `hrm_attendance_records` row created with `workDate = "2026-11-24"`.
  - `firstPunchIn` matches current UTC timestamp.
  - `isLate` is `false`, and `lateMinutes` is `0`.
  - `status` is `IN_PROGRESS`.

#### `TS-ATT-002`: Early Arrival Punch-In (Up to 120 Minutes)
- **Given:** Employee assigned `SHIFT_1900`.
- **When:** Employee punches in at 17:15 IST (105 minutes early).
- **Then:**
  - Punch-in succeeds (`200 OK`).
  - `workDate = "2026-11-24"`, `isLate = false`, `lateMinutes = 0`.

#### `TS-ATT-003`: Late Punch-In Beyond Grace Threshold
- **Given:** Employee assigned `SHIFT_1900` (grace ends at 19:15 IST).
- **When:** Employee punches in at 19:35 IST.
- **Then:**
  - Punch-in succeeds (`200 OK`).
  - `isLate` is `true`.
  - `lateMinutes` is recorded as `35` (minutes elapsed beyond 19:00 start).

#### `TS-ATT-004`: Rejection of Duplicate Punch-In
- **Given:** Employee already has an `IN_PROGRESS` attendance record for `workDate = "2026-11-24"`.
- **When:** Employee calls `/api/attendance/punch-in` again.
- **Then:** Returns `409 Conflict` with error code `ATT_ALREADY_PUNCHED_IN`.

---

### 2.3 Cross-Midnight Date Integrity (`TS-DATE`)

#### `TS-DATE-001`: Graveyard Shift Date Anchoring
- **Given:** Employee punches in on `SHIFT_1900` at 18:50 IST on `2026-10-31`.
- **When:** Shift ends and employee punches out at 03:35 IST on `2026-11-01`.
- **Then:**
  - Attendance record `workDate` remains strictly `"2026-10-31"`.
  - `grossMinutes` reflects full $\sim 525$ minutes.
  - No attendance record is created for `"2026-11-01"`, leaving the new calendar date clean for the next evening's shift.

---

### 2.4 Hours Calculation & Final Status Evaluation (`TS-CALC`)

#### `TS-CALC-001`: Present Status ($\ge 7.5\text{ Hours Net}$)
- **Given:** Shift duration with gross elapsed time of 510 minutes and total breaks of 40 minutes (Net = 470 mins $\ge 450$ mins).
- **When:** Employee punches out.
- **Then:** Status is updated from `IN_PROGRESS` to `P` (Present).

#### `TS-CALC-002`: Half-Day Status ($5.0\text{ to } 7.5\text{ Hours Net}$)
- **Given:** Shift with gross elapsed time of 400 minutes and breaks of 30 minutes (Net = 370 mins).
- **When:** Employee punches out.
- **Then:** Status is updated to `HD` (Half Day).

#### `TS-CALC-003`: Absent Status ($< 5.0\text{ Hours Net}$)
- **Given:** Shift with gross elapsed time of 260 minutes and breaks of 20 minutes (Net = 240 mins).
- **When:** Employee punches out.
- **Then:** Status is updated to `A` (Absent).

---

### 2.5 Unlimited Break Engine (`TS-BRK`)

#### `TS-BRK-001`: Start Break
- **Given:** Shift is in `WORKING` state.
- **When:** Employee clicks `[TAKE BREAK]`.
- **Then:**
  - New `hrm_break_records` row created with `breakStart = UTC timestamp` and `breakEnd = null`.
  - State transitions to `ON_BREAK`.

#### `TS-BRK-002`: Resume Work from Break
- **Given:** Break record started 22 minutes ago (`breakEnd = null`).
- **When:** Employee clicks `[BACK FROM BREAK]`.
- **Then:**
  - `breakEnd` is updated to current UTC timestamp.
  - `durationMinutes` is recorded as `22`.
  - Parent `hrm_attendance_records.totalBreakMinutes` increments by 22.
  - State returns to `WORKING`.

#### `TS-BRK-003`: Unlimited Consecutive Breaks
- **Given:** Employee takes 4 separate breaks during the shift (15m, 10m, 25m, 12m).
- **When:** Each break starts and ends properly.
- **Then:** 4 separate `BreakRecord` rows exist for the `attendanceRecordId`, and `totalBreakMinutes` evaluates to `62`.

#### `TS-BRK-004`: Auto-Close Break on Punch-Out
- **Given:** Employee is currently on break (`breakEnd = null`).
- **When:** Employee clicks `[PUNCH OUT]`.
- **Then:**
  - System executes a database transaction ending the active break at the current timestamp, computes its duration, updates `totalBreakMinutes`, and seals the shift with `lastPunchOut`.
  - Status evaluates correctly without leaving an orphaned open break.

---

### 2.6 Leave Management (`TS-LV`)

#### `TS-LV-001`: Submit Leave Application
- **Given:** Employee has no existing leave requests for `"2026-12-05"` to `"2026-12-07"`.
- **When:** Employee submits a `CASUAL` leave request for those dates with reason `"Family wedding"`.
- **Then:** `hrm_leave_requests` row created with `status = PENDING`.

#### `TS-LV-002`: Reject Overlapping Leave Application
- **Given:** A pending or approved leave request already exists for dates `"2026-12-05"` to `"2026-12-07"`.
- **When:** Employee submits another leave request covering `"2026-12-06"`.
- **Then:** Returns `409 Conflict` with `LV_OVERLAPPING_REQUEST`.

#### `TS-LV-003`: Admin Approval Auto-Marks Attendance
- **Given:** Leave request for `"2026-12-05"` to `"2026-12-05"` is `PENDING`.
- **When:** Admin approves the leave via `/api/admin/leaves/[id]/approve`.
- **Then:**
  - Leave status changes to `APPROVED`.
  - Attendance record for `"2026-12-05"` is automatically created/updated with `status = LV`.

---

### 2.7 Admin Regularization & Audit Trail (`TS-REG`)

#### `TS-REG-001`: Admin Attendance Modification with Audit Log
- **Given:** Employee's record shows `status = A` (punch-out was missed).
- **When:** Admin edits punch-out time to 03:30 IST, sets status `P`, and enters explanation `"Home power cut verified with team lead"`.
- **Then:**
  - Record is updated: `isRegularized = true`.
  - `hrm_attendance_audit_logs` record is created containing `adminId`, `previousValues`, `newValues`, and `reason`.

#### `TS-REG-002`: Rejection of Regularization Without Reason
- **When:** Admin attempts to edit attendance with an empty or whitespace reason.
- **Then:** Returns `400 Bad Request` with `ADM_REGULARIZATION_REASON_REQUIRED`.

---

### 2.8 Single Sign-On (SSO) Bridge (`TS-SSO`)

#### `TS-SSO-001`: Generate Valid SSO Token
- **Given:** Employee is authenticated in HRM.
- **When:** Employee requests SSO bridge URL via `/api/auth/sso/token`.
- **Then:** Returns signed JWT containing `userId`, `email`, `exp = now + 60s`, and `iss = "capital-bridge-hrm"`.

#### `TS-SSO-002`: CRM Token Verification & Session Creation
- **Given:** Valid 60-second token generated by HRM with `SHARED_SSO_SECRET`.
- **When:** CRM `/api/auth/sso?token=<jwt>` is called.
- **Then:** Token signature is verified, user active status is confirmed, NextAuth session cookie is issued, and client is redirected to `/dashboard`.

#### `TS-SSO-003`: Rejection of Expired or Tampered Token
- **When:** CRM receives an SSO token older than 60 seconds or signed with an incorrect secret.
- **Then:** Returns `401 Unauthorized` and does not issue a session cookie.

---

### 2.9 Stale Shift Protection (`TS-STALE`)

#### `TS-STALE-001`: 16-Hour Forgotten Punch-Out Anomaly
- **Given:** Attendance record has `firstPunchIn` 17 hours ago and `lastPunchOut = null`.
- **When:** Scheduled maintenance check or daily cron evaluates active records.
- **Then:**
  - Record status transitions to `ANOMALY_STALE`.
  - Record is highlighted on Admin Live Roster for immediate regularization.

