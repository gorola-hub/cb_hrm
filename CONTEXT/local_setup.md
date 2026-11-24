# Local Environment Setup Guide: Capital Bridge HRM

This document provides step-by-step instructions for configuring and running **Capital Bridge HRM (CB HRM)** on your local development workstation.

---

## 1. Prerequisites

Ensure the following tools are installed before setting up the repository:

- **Node.js 20+ or 24 LTS:** Required for Next.js 16 and Prisma. Verify with `node --version`.
- **npm 10+:** Ships with Node.js. Verify with `npm --version`.
- **Docker Desktop / Docker Engine:** Required to run the local PostgreSQL database container. Verify with `docker --version`.
- **Git:** Version control.

---

## 2. Shared Database Architecture & Zero Collision Guarantees

> [!IMPORTANT]
> **UNDERSTANDING THE SHARED DATABASE SETUP:**  
> Both **CB CRM** and **CB HRM** share the **exact same PostgreSQL database instance** (`cb_crm`). There is NO separate HRM database.

### How Collisions Are Completely Prevented:

1. **Port Isolation:**
   - **CB CRM** runs its web server on `http://localhost:3000`.
   - **CB HRM** runs its web server on `http://localhost:3001` (pinned via `"dev": "next dev -p 3001"`).
   - You can run both applications simultaneously on the same machine without port conflicts.

2. **Table Prefixing & Data Ownership:**
   - **CRM-Owned Tables:** `users`, `roles`, `designations`, `permissions`, `role_permissions`, `allowed_ips`, `customers`, `shipments`, etc.
   - **HRM-Owned Tables:** All HRM tables begin strictly with the `hrm_` prefix:  
     `hrm_shifts`, `hrm_employee_shifts`, `hrm_attendance_records`, `hrm_break_records`, `hrm_leave_requests`, `hrm_holidays`, `hrm_attendance_audit_logs`.
   - Because of this strict naming demarcation, HRM queries and migrations will **never collide with, alter, or drop CRM data**.

3. **Running Docker Locally (Two Scenarios):**
   - **Scenario A (You already run CB CRM locally):**  
     Your local PostgreSQL container (`cb_crm_db`) is already running on port `5432`.  
     $\rightarrow$ **DO NOT** run `docker compose up` again in `cb_hrm`. HRM will simply connect directly to that existing database on `localhost:5432`.
   - **Scenario B (You are working on CB HRM in isolation):**  
     Run `docker compose up -d` inside `cb_hrm`. It will launch a PostgreSQL 16 container on port `5432` named `cb_shared_db` with database name `cb_crm`.

---

## 3. Step-by-Step Installation Sequence

Follow these steps in exact order:

### Step 1: Clone and Navigate to the Repository
```bash
cd /home/winter/Projects/capital_bridge/cb_hrm
```

### Step 2: Install Node Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables
Copy `.env.example` to create your local `.env` file:
```bash
cp .env.example .env
```

Generate secure random secrets using OpenSSL or Node.js:
```bash
# OpenSSL (macOS / Linux):
openssl rand -hex 32

# Node.js (Universal):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Verify your `.env` contains the correct values:
```ini
# PostgreSQL connection (Shared database — MUST MATCH CB CRM)
DATABASE_URL="postgresql://cb_user:cb_password@localhost:5432/cb_crm"

# NextAuth Configuration
NEXTAUTH_URL="http://localhost:3001"
NEXTAUTH_SECRET="development-secret-must-be-at-least-32-chars-long"

# Single Sign-On (SSO) Bridge Secret (MUST MATCH CB CRM IDENTICALLY)
SHARED_SSO_SECRET="capital-bridge-shared-sso-secret-dev-environment-key-32chars"

# Capital Bridge CRM URL (Points to CRM for SSO bridge and Single Sign-Out)
CRM_BASE_URL="http://localhost:3000"
NEXT_PUBLIC_CRM_URL="http://localhost:3000"
```

---

### Variable Synchronization Contract Between HRM and CRM

| Variable | Synchronization Requirement | Purpose |
|:---|:---|:---|
| `DATABASE_URL` | **MUST BE IDENTICAL** | Both apps connect to the exact same PostgreSQL database (`cb_crm`). User authentication and identities are shared. |
| `SHARED_SSO_SECRET` | **MUST BE IDENTICAL** | HMAC-SHA256 signature key for one-time SSO JWT tokens when bridging from HRM into CRM. |
| `CRM_BASE_URL` / `NEXT_PUBLIC_CRM_URL` | Points to CRM | In HRM `.env`, points to CRM (`http://localhost:3000`). In CRM `.env`, `HRM_BASE_URL` points to HRM (`http://localhost:3001`). |
| `NEXTAUTH_URL` | Local | Points to HRM canonical URL (`http://localhost:3001`). |
| `NEXTAUTH_SECRET` | Local | HRM-specific session cookie encryption secret. |

### Step 4: Start the Local Database (If Not Already Running)
Check if PostgreSQL is already active:
```bash
docker ps | grep 5432
```
- If a container is already running on port `5432` (e.g., from CRM), skip to Step 5.
- If no container is running, start the database:
```bash
docker compose up -d
```

### Step 5: Generate Prisma Client & Run Migrations
Run Prisma generation and deploy HRM migrations:
```bash
npx prisma generate
npx prisma migrate dev --name init_hrm_tables
```

### Step 6: Seed Master Data & Shifts
Run the idempotent seed script:
```bash
npm run db:seed
```
*Note:* The seed script is smart:
- If CRM user tables already exist, it seeds master shifts (`SHIFT_1700` through `SHIFT_1930`) and leave types.
- If the database is fresh, it also seeds baseline roles (`ADMIN`, `BROKER`, etc.) and default test users so you can log in immediately.

### Step 7: Run Automated Verification Tests
Verify that the test suite passes 100%:
```bash
npm run test:run
```

### Step 8: Start the Local Development Server
```bash
npm run dev
```

Open your browser and navigate to:
```
http://localhost:3001
```

---

## 4. Default Local Development Credentials

If running against a freshly seeded local database:

| Role | Email | Password | Access Capabilities |
|---|---|---|---|
| **Administrator** | `admin@capitalbridgelogistics.com` | `Admin123!` | Company-wide live roster, leave approvals, regularization |
| **Freight Broker** | `broker@capitalbridgelogistics.com` | `Broker123!` | Personal punch card, breaks, leave requests, Open CRM bridge |

---

## 5. Helpful Development Commands

```bash
# Run full local CI pipeline (Typecheck, Lint, Test, Build)
npm run ci:quality

# Run tests in watch mode
npm run test

# Run tests once (CI mode)
npm run test:run

# Check TypeScript types
npm run typecheck

# Check ESLint rules
npm run lint

# Open Prisma Studio to browse tables visually
npx prisma studio --port 5556
```

