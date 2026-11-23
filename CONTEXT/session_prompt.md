# Session Prompt: Capital Bridge HRM

Use this prompt at the start of every new development session to orient the AI assistant before writing any code.

---

## Prompt

I am building **Capital Bridge HRM (CB HRM)** — the employee self-service and attendance management platform for Capital Bridge Logistics LLC. The system provides real-time Indian Standard Time (IST) shift tracking for freight brokerage night shifts, unlimited break recording, monthly attendance calendars, leave request workflows, admin regularizations with audit logging, and a one-click Single Sign-On (SSO) bridge into Capital Bridge CRM.

All planning and architecture is complete. Before you do anything, read these files in this exact order:

1. **`CONTEXT/project_data.md`**  
   → Core metadata, business rules (`BR-IST-*`, `BR-ATT-*`, `BR-BRK-*`, `BR-LV-*`, `BR-SSO-*`), roles, permissions catalog, and coded Functional/Non-Functional Requirements (`FR-*`, `NFR-*`).

2. **`CONTEXT/database_schema.md`**  
   → The authoritative database schema for all `hrm_*` tables and read-only CRM user entities (`users`, `roles`, `designations`, `permissions`). Contains the Prisma migration isolation rules and relational definitions.

3. **`CONTEXT/local_setup.md`**  
   → Local Docker Compose setup on port `5432`, port isolation (HRM on `3001`, CRM on `3000`), shared database guidelines, and migration/seed commands.

4. **`CONTEXT/decision_log.md`**  
   → Architectural decisions (ADRs 1–9). Read these before proposing any design change — if your proposal contradicts a logged decision, you must flag it and ask.

5. **`CONTEXT/current_state.md`**  
   → The phase-by-phase implementation tracker. This is your source of truth for what is done and what is next. Always check this FIRST before writing any code.

6. **`CONTEXT/TDD_INSTRUCTION_GUIDE.md`**  
   → The checklist format that ALL implementation work must follow (Root Cause $\rightarrow$ Confirmed RED test $\rightarrow$ GREEN implementation $\rightarrow$ Verification Chain).

7. **`CONTEXT/test_scenarios.md`**  
   → Plain-English test scenarios with unique codes (`TS-AUTH-*`, `TS-ATT-*`, `TS-DATE-*`, `TS-CALC-*`, `TS-BRK-*`, `TS-LV-*`, `TS-REG-*`, `TS-SSO-*`, `TS-STALE-*`) and user-facing error message catalog.

---

### Instructions for AI Assistant After Reading the Files:

1. **Confirm Understanding of Core Principles:**
   - Confirm you understand the three-layer architecture (`repository` $\rightarrow$ `service` $\rightarrow$ `app/api`).
   - Confirm you understand the Shared Database boundary & Prisma Migration Isolation Rule (CRM owns `users`/`roles`, HRM owns `hrm_*`, zero mutation of CRM tables).
   - Confirm you understand the IST night-shift date anchoring (`workDate` permanently locked to first punch-in date) and the unlimited break state machine.

2. **Identify Next Execution Target:**
   - Inspect `CONTEXT/current_state.md` to identify the first `PENDING` phase.

3. **Dynamic Phase Plan Generation Rule:**
   - If the pending phase only has a high-level summary and its detailed TDD checklist has not yet been authored in `CONTEXT/current_state.md`:
     - **DO NOT jump into writing code immediately.**
     - First, author the detailed phase checklist using the template from `CONTEXT/TDD_INSTRUCTION_GUIDE.md`, pulling requirements from `CONTEXT/project_data.md` and test scenarios from `CONTEXT/test_scenarios.md`.
     - Write the detailed checklist into `CONTEXT/current_state.md` with explicit Root Cause, Target Files, Step-by-Step RED $\rightarrow$ GREEN items, and Verification Chain.

4. **Phase 6 Prerequisite Rule (CRM Phase 30):**
   - If the pending phase is **Phase 6 (Single Sign-On Bridge to CRM)**:
     - Stop and alert the user to execute **Phase 30 in `cb_crm` first** (or switch to `cb_crm` to complete Phase 30) before building HRM's token issuer.
     - This guarantees CRM's receiving route `/api/auth/sso` and permissions are deployed, allowing live end-to-end verification.

5. **Execute Strictly in TDD:**
   - Execute the active checklist item by item: write the test first, confirm it fails (RED), implement minimal code to pass (GREEN), and refactor.
   - Run the full test suite (`npm run test:run`) and typecheck (`npm run typecheck`) before marking any item `[x]` in `CONTEXT/current_state.md`.
   - Never skip ahead to a later phase until all items in the current phase are verified and checked off.

---

### Key Constraints to Always Keep in Mind:
- **IST Timezone (`Asia/Kolkata` / UTC+05:30):** All punch clocks, shift schedules, grace periods, and business date calculations must evaluate strictly against IST.
- **`workDate` Integrity:** The shift's `workDate` belongs exclusively to the calendar date of the first punch-in. Even if punch-out occurs the next morning (e.g. 03:30 AM), it must NEVER create or modify the next day's attendance record.
- **Unlimited Breaks:** Employees can take as many breaks as needed. If an employee punches out while on break, the system must auto-close the active break record at the punch-out timestamp inside a transaction.
- **User Model Schema:** The `users` table does NOT have a `systemRole` column. Always query the user's role via relation `user.role.code`.
- **Local Dev Port:** Always run on `http://localhost:3001` (to coexist with CRM on `3000`).

