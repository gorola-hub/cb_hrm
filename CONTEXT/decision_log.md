# Architecture & Design Decisions Log: Capital Bridge HRM

This document records all authoritative architectural, infrastructural, and design decisions for **Capital Bridge HRM (CB HRM)**. Every technical decision includes context, rationale, trade-offs, and consequences.

---

### Decision 1: Standalone Next.js 16 Repository vs Monorepo Refactor

**Date:** 2026-10-20  
**Status:** Accepted  

#### Context
Capital Bridge CRM is a mature production application with 29 completed engineering phases, active freight brokerage operations, and rigorous CI/CD pipelines. We evaluated whether to convert `cb_crm` into a Turborepo/Nx monorepo encompassing both CRM and HRM, or maintain `cb_hrm` as an independent standalone Next.js 16 repository.

#### Decision
Deploy **`cb_hrm` as a standalone Next.js 16 repository** completely decoupled from `cb_crm`'s codebase.

#### Rationale
1. **Zero Production Risk to Freight Core:** Monorepo migrations require moving files, refactoring import paths, restructuring root configurations, and risking subtle regressions in CRM's mission-critical load dispatch and invoicing engines.
2. **Independent Deployment Lifecycles:** HRM UI polish, shift updates, or attendance bugfixes can be deployed independently without triggering CRM builds or risking freight brokerage downtime.
3. **Clean Domain Separation:** US freight brokerage logic (USD financials, factoring, US Central Time) is kept physically separated from Indian HR operations (IST timezone, punch-in/out, night-shift rules).

#### Consequences
- Code sharing across apps is managed via shared schema definitions and common architectural conventions rather than internal workspace npm packages.
- Both repositories must maintain their own CI/CD workflows and dependencies.

---

### Decision 2: Single Shared PostgreSQL Instance with Central User Master

**Date:** 2026-10-20  
**Status:** Accepted  

#### Context
Employees working in CRM need to punch in and manage attendance in HRM. We had to decide whether HRM should maintain its own independent database and sync users via webhooks/ETL, or connect directly to CRM's PostgreSQL instance.

#### Decision
Both applications connect to the **same single PostgreSQL database instance** (`cb_crm`), with CRM acting as the **sole authority and master for user identity**.

#### Rationale
1. **Instant Access & Zero Double-Onboarding:** As soon as an employee is created in CRM, they can immediately log in to HRM.
2. **Instant Deactivation:** If an employee is marked inactive (`isActive = false`) in CRM, their access to both CRM and HRM is revoked instantaneously with zero sync lag.
3. **Foreign Key Integrity:** `hrm_attendance_records`, `hrm_employee_shifts`, and `hrm_leave_requests` have real database foreign keys pointing directly to `users.id`.

#### Consequences
- HRM must treat CRM-owned tables (`users`, `roles`, `designations`, `permissions`) as strictly **read-only**.
- HRM's Prisma migrations must be strictly isolated to `hrm_*` tables to avoid interfering with CRM tables.

---

### Decision 3: Indian Standard Time (IST) Calendar-Date Anchoring for Night Shifts

**Date:** 2026-10-21  
**Status:** Accepted  

#### Context
Capital Bridge operates US freight brokerage hours from India. Standard shifts start between 17:00 and 19:30 IST and end between 01:30 and 04:00 IST the following morning. Traditional systems that record attendance by clock-out timestamp mistakenly record hours on the next day, creating confusing reporting splits and erroneous absence records.

#### Decision
The business date (`workDate`) of any shift is **permanently anchored to the IST calendar date on which the first punch-in occurs**.

#### Rationale
- An employee punching in at 18:50 IST on October 31 and punching out at 03:30 IST on November 1 has their entire shift recorded under `workDate = "2026-10-31"`.
- November 1 remains completely clean, ready for their next scheduled shift that evening.
- Eliminates midnight timezone split bugs and produces accurate monthly payroll metrics.

#### Consequences
- All daily roster queries, calendar grids, and attendance filters must query by `workDate` string rather than UTC timestamp intervals.

---

### Decision 4: Unlimited Break Engine via Dedicated Break Records

**Date:** 2026-10-22  
**Status:** Accepted  

#### Context
Rigid attendance systems enforce fixed break schedules (e.g., exactly two 15-minute breaks and one 30-minute lunch). Freight brokers often face unpredictable logistics emergencies, customer calls, or carrier issues requiring flexible, spontaneous breaks.

#### Decision
Implement an **unlimited break tracking model** where every break is stored as a distinct `BreakRecord` associated with the daily `AttendanceRecord`.

#### Rationale
- Allows employees to take as many breaks as needed throughout the night.
- Net working time is accurately computed on punch-out by subtracting the sum of all break durations from gross elapsed time.
- Gives operations managers full visibility into break patterns without imposing counterproductive software restrictions.

#### Consequences
- Requires an interactive Finite State Machine (FSM): `IDLE` $\rightarrow$ `WORKING` $\leftrightarrow$ `ON_BREAK` $\rightarrow$ `COMPLETED`.
- Punching out while actively on break must automatically close the open break record at the punch-out timestamp.

---

### Decision 5: HMAC-SHA256 Short-Lived JWT for HRM-to-CRM Single Sign-On (SSO)

**Date:** 2026-10-23  
**Status:** Accepted  

#### Context
HRM serves as the operational front-door where employees start their shift. Once punched in, brokers need to open the CRM without being forced to type their email and password a second time.

#### Decision
Implement a **60-second HMAC-SHA256 signed JWT handshake**:
1. Employee clicks `[Open CRM]` in HRM.
2. HRM signs a payload `{ userId, email, exp, iss: "capital-bridge-hrm" }` with `SHARED_SSO_SECRET`.
3. Opens CRM at `/api/auth/sso?token=<jwt>`.
4. CRM verifies token signature, checks expiration, confirms user is active, sets the NextAuth session cookie, and redirects to `/dashboard`.

#### Rationale
- Zero friction for freight brokers starting their work shift.
- 60-second validity window prevents replay attacks.
- Simple, cryptographically secure, and requires no external OAuth provider or complex federation infrastructure.

#### Consequences
- `SHARED_SSO_SECRET` must be synchronized in `.env` across both `cb_crm` and `cb_hrm`.
- CRM requires a lightweight `/api/auth/sso` route handler.

---

### Decision 6: Port Isolation for Local Development (Port 3001 for HRM, 3000 for CRM)

**Date:** 2026-10-24  
**Status:** Accepted  

#### Context
Developers will frequently run both CB CRM and CB HRM locally on the same development workstation. Next.js defaults to port `3000`, causing port conflicts if both apps are booted.

#### Decision
Pin **CB HRM to port 3001** via `package.json` scripts:
`"dev": "next dev -p 3001"`, `"start": "next start -p 3001"`.

#### Rationale
- Guarantees immediate zero-conflict local development side-by-side with CB CRM (`http://localhost:3000`).

---

### Decision 7: Railway Multi-Service Deployment (Same Project, Separate Web Service)

**Date:** 2026-10-25  
**Status:** Accepted  

#### Context
We considered deploying HRM to Vercel, a VPS, or an independent Railway project. 

#### Decision
Deploy `cb_hrm` as a **new Web Service inside the existing "Capital Bridge" Railway Project** that already hosts `cb_crm` and `cb_crm_db`.

#### Rationale
1. **Private Network Database Connection:** HRM connects to PostgreSQL via Railway's private DNS (`cb_crm_db.railway.internal:5432`), guaranteeing zero public network egress fees and sub-millisecond query latency.
2. **Targeted Deployments via CLI:** GitHub Actions uses `npx @railway/cli@latest up --ci --service "cb_hrm"`, ensuring deployments to HRM never touch or trigger builds in CRM.
3. **Consolidated Billing & Monitoring:** All Capital Bridge production infrastructure remains under one unified Railway dashboard.

---

### Decision 8: Automated Stale Shift Anomaly Marking after 16 Hours

**Date:** 2026-10-26  
**Status:** Accepted  

#### Context
If an employee forgets to punch out at the end of their shift, unconstrained timers would continue accumulating hours indefinitely, resulting in 40+ hour phantom shifts and corrupting attendance analytics.

#### Decision
Any attendance record remaining in `IN_PROGRESS` or `ON_BREAK` for greater than **16 continuous hours** from `firstPunchIn` is automatically marked with status `ANOMALY_STALE`, stops live timer accumulation, and flags the record for Administrator Regularization.

#### Rationale
- Protects payroll data integrity while preserving the original punch-in timestamp for administrative correction.

---

### Decision 9: Resolution of User Model Schema Discrepancy

**Date:** 2026-10-27  
**Status:** Accepted  

#### Context
Early drafts of HRM technical specifications included `systemRole String` directly on `model User`. Inspection of the live `cb_crm` database revealed that `users` has no `systemRole` column; roles are managed via `roleId` referencing `roles.id`.

#### Decision
Remove `systemRole` from HRM's `model User` in `schema.prisma`. Fetch the user's role code via relation join `user.role.code`.

#### Rationale
- Prevents PostgreSQL runtime errors (`column users.systemRole does not exist`) and maintains 100% schema consistency with CRM.

