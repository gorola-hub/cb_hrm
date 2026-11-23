# TDD Instruction Guide: Capital Bridge HRM
## How to Write Implementation Checklists That Produce Rock-Solid, Fully Wired Features

> **Target Audience:** Any developer, system architect, or AI coding assistant working on Capital Bridge HRM.  
> **Origin:** Derived from the proven production TDD engineering standard of Capital Bridge CRM.  
> **Goal:** Eliminate "phantom features" — code that appears green in isolated unit tests but fails completely when wired into the live application.

---

## Part 1: The 5 Principles of a Great Checklist

### Principle 1: Bookend Every Checklist with "Root Cause" and "Verification Chain"

Every phase checklist must start with **Root Cause** and end with a **Verification Chain**.

- **Root Cause** answers: *Why are we building this or what bug are we solving?*  
  It prevents guessing. Without it, developers write tests for the wrong assumptions.
- **Verification Chain** answers: *What does success look like from the real user's perspective, end-to-end?*  
  It is never simply "tests pass". It is a human-readable sequence of actions:  
  *User does A $\rightarrow$ System computes B $\rightarrow$ Database records C $\rightarrow$ User sees D.*  
  If the feature does not fulfill this exact chain, the checklist item is NOT done.

> **Bad:** "Build punch-in API."  
> **Good:**  
> **Root Cause:** Employees arriving for their shift need to record their start time anchored strictly to today's IST calendar date.  
> **Verification Chain:** Broker logs into HRM at 18:50 IST $\rightarrow$ Clicks [PUNCH IN] $\rightarrow$ System creates `hrm_attendance_records` row with `workDate = "2026-11-24"`, `firstPunchIn = UTC timestamp`, `isLate = false` $\rightarrow$ UI switches to WORKING state with live timer running and [TAKE BREAK] button visible $\rightarrow$ Attempting a second punch-in returns 409 Conflict with message `"A shift is already in progress for today."` $\rightarrow$ ✅ Done.

---

### Principle 2: Demand a Confirmed RED State Before Writing Code

The most critical rule of TDD: **A test must be written first, executed, and confirmed FAILING (RED) before any production implementation code is written.**

1. Write the test stub or test case.
2. Run the test runner: `npm run test:run path/to/feature.test.ts`.
3. Confirm it fails for the expected reason (e.g., function not found, route returns 404, or assertion fails).
4. Write the minimal implementation code to turn the test **GREEN**.
5. Refactor with confidence.

---

### Principle 3: Every Checklist Item Must Have a Target File and a Concrete Assertion

Never write vague action items like *"Implement break calculation"*.

Every item must specify:
1. **Target File(s):** The exact path to be created or modified.
2. **Concrete Assertion:** The exact expected behavior, return value, or status code.

> **Bad:** `[ ] Add break end logic.`  
> **Good:** `[ ] In src/service/break.service.ts, endActiveBreak(attendanceId) updates hrm_break_records setting breakEnd to current UTC time, calculates durationMinutes = round((breakEnd - breakStart) / 60000), and recalculates parent attendanceRecord.totalBreakMinutes.`

---

### Principle 4: Full Suite Pass Before Marking Done (`npm run test:run`)

Never mark a task `[x]` after running only an isolated single test. A change in the service layer or database query can cause regressions in unrelated modules.
- Run the full test suite: `npm run test:run`
- Run type-checking: `npm run typecheck`
- Only when the entire suite passes may an item be checked off.

---

### Principle 5: The Verification Chain is Non-Negotiable

Passing automated unit tests with mocks is only half the battle. The checklist is not completed until the **Verification Chain** is proven against the live or integration environment:
- Database record actually exists in PostgreSQL.
- API route returns real serialized JSON with correct headers.
- UI component displays real formatted values without React hydration warnings.

---

## Part 2: Standard Phase Checklist Template

When writing a phase implementation plan for `current_state.md`, use this exact markdown structure:

```markdown
### Phase X.Y: [Feature Name]

#### Root Cause
[1-2 sentences explaining why this feature is being built and what business problem it solves]

#### Target Files
- `src/repository/[name].repository.ts` — [Repository responsibility]
- `src/service/[name].service.ts` — [Business logic responsibility]
- `src/app/api/[route]/route.ts` — [API route handler]
- `src/tests/[name].test.ts` — [Test suite]

#### Implementation Checklist
- [ ] **Step 1: RED State Test Creation**
  - Create test file `src/tests/[name].test.ts`
  - Assert [specific condition A]
  - Assert [specific condition B]
  - Run `npm run test:run src/tests/[name].test.ts` and confirm failure.
- [ ] **Step 2: Repository Layer Implementation**
  - In `src/repository/[name].repository.ts`, implement `[functionName]` using Prisma.
- [ ] **Step 3: Service Layer Logic & GREEN State**
  - In `src/service/[name].service.ts`, implement business rules and calculations.
  - Run `npm run test:run src/tests/[name].test.ts` and confirm GREEN.
- [ ] **Step 4: API Route Handler & Validation**
  - In `src/app/api/[route]/route.ts`, parse request with Zod schema and call service.
  - Return appropriate HTTP status codes and user-facing messages.
- [ ] **Step 5: Full Regression Run**
  - Run `npm run typecheck && npm run test:run` — 100% passing.

#### Verification Chain
[Step-by-step user journey from trigger to UI confirmation and database verification]
```

---

## Part 3: Concrete Example — Attendance Punch-In Checklist

```markdown
### Phase 3.1: IST Punch-In Core & Date Anchoring

#### Root Cause
Employees logging in at shift start need to record attendance with their work date permanently anchored to the IST calendar date of first punch-in, accounting for 120-minute early grace and 15-minute late thresholds.

#### Target Files
- `src/repository/attendance.repository.ts`
- `src/service/attendance.service.ts`
- `src/app/api/attendance/punch-in/route.ts`
- `src/tests/attendancePunchIn.test.ts`

#### Implementation Checklist
- [ ] **Step 1 (RED):** Write `src/tests/attendancePunchIn.test.ts`:
  - Test 1: Punch-in at 18:50 IST for 19:00 shift sets `workDate = "2026-11-24"`, `isLate = false`.
  - Test 2: Punch-in at 19:20 IST sets `isLate = true`, `lateMinutes = 20`.
  - Test 3: Duplicate punch-in for same user and workDate rejects with 409 Conflict.
  - Run `npm run test:run src/tests/attendancePunchIn.test.ts` $\rightarrow$ Confirm RED.
- [ ] **Step 2 (GREEN):** Implement `createPunchInRecord` in `src/repository/attendance.repository.ts`.
- [ ] **Step 3 (GREEN):** Implement IST date calculation and grace logic in `src/service/attendance.service.ts`.
  - Run test suite $\rightarrow$ Confirm GREEN.
- [ ] **Step 4:** Implement `POST /api/attendance/punch-in` route handler with session guard.
- [ ] **Step 5:** Run `npm run typecheck && npm run test:run` $\rightarrow$ All pass.

#### Verification Chain
Employee logs in $\rightarrow$ Calls `POST /api/attendance/punch-in` $\rightarrow$ DB row inserted with correct IST `workDate` $\rightarrow$ Returns `{ success: true, record: { id, workDate, status: "IN_PROGRESS" } }` $\rightarrow$ Dashboard displays active timer $\rightarrow$ Second call returns 409 with `"A shift is already active for this date."` $\rightarrow$ ✅ Done.
```

