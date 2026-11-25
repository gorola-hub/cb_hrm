import { describe, it, expect } from 'vitest';
import path from 'path';
import {
  validateHrmMigrationSql,
  verifyAllHrmMigrations,
} from '../../scripts/verify-hrm-migrations.mjs';

describe('HRM Shared-Database Migration Isolation Guard (Phase 7.5)', () => {
  it('passes all existing HRM migration files in prisma/migrations', () => {
    const migrationsDir = path.resolve(process.cwd(), 'prisma/migrations');
    const result = verifyAllHrmMigrations(migrationsDir);
    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.checkedFiles.length).toBeGreaterThan(0);
  });

  it('allows valid hrm_* DDL and foreign keys referencing CRM users/roles', () => {
    const validSql = `
      -- Add ANOMALY_STALE
      ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'ANOMALY_STALE';
      CREATE TABLE "hrm_leave_balances" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        CONSTRAINT "hrm_leave_balances_pkey" PRIMARY KEY ("id")
      );
      ALTER TABLE "hrm_leave_balances" ADD CONSTRAINT "hrm_leave_balances_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      CREATE UNIQUE INDEX "hrm_leave_balances_userId_key" ON "hrm_leave_balances"("userId");
      ALTER TABLE "hrm_shifts" ALTER COLUMN "code" TYPE TEXT USING "code"::TEXT;
      DROP TYPE "ShiftCode";
    `;
    const result = validateHrmMigrationSql(validSql, 'valid_hrm.sql');
    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('rejects DDL mutating CRM-owned tables or unknown non-hrm_* tables', () => {
    const forbiddenCases = [
      'ALTER TABLE "users" ADD COLUMN "leaveDays" INTEGER;',
      'DROP TABLE "shipments";',
      'CREATE TABLE "invoices" ("id" TEXT NOT NULL);',
      'TRUNCATE TABLE "roles";',
      'ALTER TABLE "public"."customers" DROP COLUMN "name";',
      'CREATE INDEX "users_email_custom_idx" ON "users"("email");',
      'DROP INDEX "users_email_key";',
    ];

    for (const sql of forbiddenCases) {
      const result = validateHrmMigrationSql(sql, 'forbidden.sql');
      expect(result.valid, `Expected violation for: ${sql}`).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    }
  });

  it('rejects DDL mutating CRM-owned enums or unknown enums', () => {
    const enumCases = [
      'ALTER TYPE "PaymentStatus" ADD VALUE \'DISPUTED\';',
      'DROP TYPE "UserRole";',
      'CREATE TYPE "CustomCrmType" AS ENUM (\'A\');',
    ];

    for (const sql of enumCases) {
      const result = validateHrmMigrationSql(sql, 'forbidden_enum.sql');
      expect(result.valid, `Expected enum violation for: ${sql}`).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    }
  });

  it('ignores SQL comments and string literals', () => {
    const commentSql = `
      -- Never run ALTER TABLE "users" here
      /* DROP TABLE "shipments" inside comment */
      INSERT INTO "hrm_leave_types" ("id", "code", "name") VALUES ('lt_1', 'CASUAL', 'ALTER TABLE "users"');
    `;
    const result = validateHrmMigrationSql(commentSql, 'comments.sql');
    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);
  });
});

