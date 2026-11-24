# Production Deployment & CI/CD Guide: Capital Bridge HRM

This document provides step-by-step instructions for deploying **Capital Bridge HRM (CB HRM)** to **Railway** using an automated **GitHub Actions CI/CD pipeline**.

---

## 1. Architectural Overview & Railway Topology

Capital Bridge runs both web applications inside a **single unified Railway Project**:

```
+-----------------------------------------------------------------------------------------+
|                          RAILWAY PROJECT: "Capital Bridge"                              |
|                                                                                         |
|  +-----------------------------------------------------------------------------------+  |
|  |                 Shared Managed PostgreSQL Database Service                        |  |
|  |                           Service Name: cb_crm_db                                 |  |
|  +-----------------------------------------------------------------------------------+  |
|          ^                                                   ^                          |
|          | (Railway Private Network)                         | (Railway Private Network)|
|          | postgres.railway.internal:5432                    | postgres.railway.internal|
|          v                                                   v                          |
|  +----------------------------------+  +---------------------------------------------+  |
|  |        Web Service: cb_crm       |  |             Web Service: cb_hrm             |  |
|  |  Domain:                         |  |  Domain:                                    |  |
|  |  crm.capitalbridgelogistics.com  |  |  hrm.capitalbridgelogistics.com             |  |
|  +----------------------------------+  +---------------------------------------------+  |
+-----------------------------------------------------------------------------------------+
```

### Key Architectural Advantages:
1. **Private Network Database Access:** Both `cb_crm` and `cb_hrm` query PostgreSQL over Railway's internal network (`.railway.internal`), meaning sub-millisecond query execution and **$0 public egress bandwidth costs**.
2. **Targeted Deployments via CLI:** Pushing code to `cb_hrm` deploys **strictly** the `cb_hrm` service via `--service "cb_hrm"`. It does not trigger builds, restarts, or downtime for `cb_crm`.
3. **Unified Environment Configuration:** Both services share the same `SHARED_SSO_SECRET` for the HMAC-SHA256 Single Sign-On bridge.

---

## 2. Platform Setup in Railway (From Scratch)

Follow these steps in the Railway Console ([https://railway.app](https://railway.app)):

### Step 1: Open the Existing Railway Project
1. Log into Railway.
2. Select the existing **Capital Bridge** project (which already houses `cb_crm` and `cb_crm_db`).

### Step 2: Create a New Empty Service for HRM
1. Click **+ New** button $\rightarrow$ Select **Empty Service**.
2. In the service settings, rename the service to: `cb_hrm`.

### Step 3: Disable Railway Git Autodeploy
To ensure Railway **only** deploys code after GitHub Actions CI checks (linting, typechecks, and unit tests) pass 100%:
1. In `cb_hrm` service $\rightarrow$ Navigate to **Settings**.
2. Scroll to **Source / Git** $\rightarrow$ Ensure automatic deployment on push is **Disabled** (or disconnect the GitHub repo from direct autodeploy). Deployment will be handled exclusively by the GitHub Actions CLI step.

### Step 4: Configure Service Environment Variables
In the `cb_hrm` service $\rightarrow$ Navigate to **Variables** $\rightarrow$ Add:

| Variable Name | Value / Source | Synchronization Requirement | Description |
|---|---|---|---|
| `DATABASE_URL` | `${{cb_crm_db.DATABASE_URL}}` (or private connection string) | **MUST BE IDENTICAL** to `cb_crm` | Internal Railway private connection to shared DB |
| `SHARED_SSO_SECRET`| 32+ character HMAC-SHA256 secret string | **MUST BE IDENTICAL** to `cb_crm` | Shared secret for HMAC-SHA256 SSO bridge |
| `CRM_BASE_URL` | `https://crm.capitalbridgelogistics.com` | Points to `cb_crm` | CRM service URL for SSO tokens and SLO redirects |
| `NEXT_PUBLIC_CRM_URL` | `https://crm.capitalbridgelogistics.com` | Points to `cb_crm` | Public client URL for Open CRM navbar button & logout |
| `NEXTAUTH_URL` | `https://hrm.capitalbridgelogistics.com` | Independent to HRM | Production canonical URL for NextAuth |
| `NEXTAUTH_SECRET` | 32+ character random secret string | Independent to HRM | Encryption key for HRM session cookies |
| `NODE_ENV` | `production` | Standard | Production environment flag |
| `PORT` | `3001` (or Railway default `$PORT`) | Standard | Web server port |

---

### Cross-Service Shared Variables Contract

1. **`DATABASE_URL` (Exact Match Required):**
   - Both `cb_crm` and `cb_hrm` connect to the exact same PostgreSQL database instance (`cb_crm_db`).
   - HRM authenticates users against the `users` table created and seeded by CRM. If the database strings do not point to the exact same database, users will not be found.

2. **`SHARED_SSO_SECRET` (Exact Match Required):**
   - HRM cryptographically signs a 60-second inbound SSO token with HMAC-SHA256 when an employee clicks "Open CRM".
   - CRM verifies this signature using the same secret. Both environments must have the exact same character sequence.

#### Token & Secret Generation Commands
To generate a secure 32-byte secret for `SHARED_SSO_SECRET` or `NEXTAUTH_SECRET`:

```bash
# Using OpenSSL (macOS / Linux):
openssl rand -hex 32

# Using Node.js (Universal):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### Step 5: Configure Build & Deploy Settings (Railway Dashboard)

In the `cb_hrm` service $\rightarrow$ **Settings** tab, configure:
- **Builder**: `Railpack`
- **Build Command**: `npx prisma generate && npm run build`
- **Start Command**: `npm run start`
- **Healthcheck Path**: `/api/health`
- **Restart Policy**: `On Failure` (Max Retries: `10`)

### Step 6: Configure Custom Domain
1. In `cb_hrm` service $\rightarrow$ **Settings** $\rightarrow$ **Networking** $\rightarrow$ **Custom Domain**.
2. Enter: `hrm.capitalbridgelogistics.com`.
3. Railway provides a CNAME record (e.g., `xxx.up.railway.app`).
4. In your DNS provider (Cloudflare / GoDaddy), add the CNAME record for `hrm` pointing to the Railway target.

---

## 3. GitHub Secrets Configuration

In the `cb_hrm` GitHub repository:
1. Navigate to **Settings** $\rightarrow$ **Secrets and variables** $\rightarrow$ **Actions**.
2. Click **New repository secret**.
3. Add:
   - **`RAILWAY_TOKEN`**: A Railway Project Token or Account API Token generated from Railway (Settings $\rightarrow$ Tokens).

---

## 4. GitHub Actions CI/CD Pipeline Workflow

Create `.github/workflows/deploy-railway.yml` in the `cb_hrm` repository:

```yaml
name: Capital Bridge HRM CI/CD Pipeline

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  ci-check:
    name: Continuous Integration (Lint, Typecheck, Test, Build)
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: cb_user
          POSTGRES_PASSWORD: cb_password
          POSTGRES_DB: cb_crm_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup Node.js 24
        uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Run ESLint Static Analysis
        run: npm run lint

      - name: Run TypeScript Type Checker
        run: npm run typecheck

      - name: Generate Prisma Client & Run Test Migrations
        env:
          DATABASE_URL: "postgresql://cb_user:cb_password@localhost:5432/cb_crm_test"
        run: |
          npx prisma generate
          npx prisma migrate deploy
          npm run db:seed

      - name: Run Vitest Test Suite
        env:
          DATABASE_URL: "postgresql://cb_user:cb_password@localhost:5432/cb_crm_test"
          NEXTAUTH_SECRET: "test-secret-key-at-least-32-characters-long"
          NEXTAUTH_URL: "http://localhost:3001"
          SHARED_SSO_SECRET: "test-sso-secret-at-least-32-characters-long"
        run: npm run test:run

      - name: Verify Next.js Production Build
        env:
          DATABASE_URL: "postgresql://cb_user:cb_password@localhost:5432/cb_crm_test"
          NEXTAUTH_SECRET: "test-secret-key-at-least-32-characters-long"
          NEXTAUTH_URL: "http://localhost:3001"
          SHARED_SSO_SECRET: "test-sso-secret-at-least-32-characters-long"
        run: npm run build

  deploy-to-railway:
    name: Continuous Deployment to Railway
    needs: ci-check
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup Node.js 24
        uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Deploy to Railway via CLI
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
        run: |
          if [ -z "$RAILWAY_TOKEN" ]; then
            echo "RAILWAY_TOKEN is not set. Skipping deployment."
            exit 0
          fi
          echo "Deploying CB HRM to Railway..."
          npx @railway/cli@latest up --ci --service "cb_hrm"
```

---

## 5. Post-Deployment Verification

Once GitHub Actions reports green:
1. Verify the health check endpoint:
   ```bash
   curl -i https://hrm.capitalbridgelogistics.com/api/health
   ```
   Expected response:
   ```json
   HTTP/2 200
   content-type: application/json

   {
     "status": "healthy",
     "service": "cb_hrm",
     "timestamp": "2026-11-24T..."
   }
   ```
2. Log into the portal with Admin credentials.
3. Test the **[Open CRM]** button to ensure the HMAC-SHA256 JWT handshake redirects seamlessly to `https://crm.capitalbridgelogistics.com/dashboard`.
4. Test **Federated Single Sign-Out (SLO)**:
   - Click the user avatar in HRM $\rightarrow$ **Sign Out**.
   - Assert redirected through `${CRM_BASE_URL}/api/auth/slo` which evicts CRM session cookies and redirects back to `https://hrm.capitalbridgelogistics.com/login`.
   - In any previously open CRM or HRM tabs, switching window focus automatically triggers `SessionSyncProvider` check and immediately redirects to `/login`.

