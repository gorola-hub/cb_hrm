import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const HRM_OWNED_ENUMS = new Set([
  'shiftcode',
  'attendancestatus',
  'leavetype',
  'leavestatus',
]);

function stripSqlCommentsAndLiterals(sql) {
  let out = '';
  let i = 0;
  while (i < sql.length) {
    // Line comment: -- ...
    if (sql[i] === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i++;
      continue;
    }
    // Block comment: /* ... */
    if (sql[i] === '/' && sql[i + 1] === '*') {
      i += 2;
      while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i++;
      i += 2;
      out += ' ';
      continue;
    }
    // Single-quoted string literal
    if (sql[i] === "'") {
      i++;
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          i += 2;
          continue;
        }
        if (sql[i] === "'") {
          i++;
          break;
        }
        i++;
      }
      out += "''";
      continue;
    }
    out += sql[i];
    i++;
  }
  return out;
}

function normalizeIdentifier(raw) {
  if (!raw) return '';
  const parts = raw.split('.');
  const last = parts[parts.length - 1];
  return last.replace(/^"+|"+$/g, '').toLowerCase();
}

export function validateHrmMigrationSql(sql, filePath = 'migration.sql') {
  const cleaned = stripSqlCommentsAndLiterals(sql);
  const statements = cleaned
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  const violations = [];

  for (const stmt of statements) {
    const tableTargetMatch = stmt.match(
      /^(?:CREATE\s+(?:TEMP(?:ORARY)?\s+|UNLOGGED\s+)?TABLE(?:\s+IF\s+NOT\s+EXISTS)?|ALTER\s+TABLE(?:\s+IF\s+EXISTS)?|DROP\s+TABLE(?:\s+IF\s+EXISTS)?|TRUNCATE(?:\s+TABLE)?)\s+((?:"[^"]+"|[a-zA-Z_][\w$]*)(?:\.(?:"[^"]+"|[a-zA-Z_][\w$]*))?)/i
    );
    if (tableTargetMatch) {
      const target = normalizeIdentifier(tableTargetMatch[1]);
      if (!target.startsWith('hrm_')) {
        violations.push(
          `${filePath}: Forbidden DDL on non-HRM table "${target}" -> ${stmt.slice(0, 100)}`
        );
      }
    }

    const dmlTargetMatch = stmt.match(
      /^(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+((?:"[^"]+"|[a-zA-Z_][\w$]*)(?:\.(?:"[^"]+"|[a-zA-Z_][\w$]*))?)/i
    );
    if (dmlTargetMatch) {
      const target = normalizeIdentifier(dmlTargetMatch[1]);
      if (!target.startsWith('hrm_')) {
        violations.push(
          `${filePath}: Forbidden DML on non-HRM table "${target}" -> ${stmt.slice(0, 100)}`
        );
      }
    }

    const indexOnMatch = stmt.match(
      /^CREATE\s+(?:UNIQUE\s+)?INDEX(?:\s+CONCURRENTLY)?(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:"[^"]+"|[a-zA-Z_][\w$]*)\s+ON\s+((?:"[^"]+"|[a-zA-Z_][\w$]*)(?:\.(?:"[^"]+"|[a-zA-Z_][\w$]*))?)/i
    );
    if (indexOnMatch) {
      const target = normalizeIdentifier(indexOnMatch[1]);
      if (!target.startsWith('hrm_')) {
        violations.push(
          `${filePath}: Forbidden INDEX on non-HRM table "${target}" -> ${stmt.slice(0, 100)}`
        );
      }
    }

    const indexAlterDropMatch = stmt.match(
      /^(?:ALTER\s+INDEX(?:\s+IF\s+EXISTS)?|DROP\s+INDEX(?:\s+CONCURRENTLY)?(?:\s+IF\s+EXISTS)?)\s+((?:"[^"]+"|[a-zA-Z_][\w$]*)(?:\.(?:"[^"]+"|[a-zA-Z_][\w$]*))?)/i
    );
    if (indexAlterDropMatch) {
      const idxName = normalizeIdentifier(indexAlterDropMatch[1]);
      if (!idxName.startsWith('hrm_')) {
        violations.push(
          `${filePath}: Forbidden INDEX mutation "${idxName}" -> ${stmt.slice(0, 100)}`
        );
      }
    }

    const typeMatch = stmt.match(
      /^(?:CREATE\s+TYPE|ALTER\s+TYPE|DROP\s+TYPE(?:\s+IF\s+EXISTS)?)\s+((?:"[^"]+"|[a-zA-Z_][\w$]*)(?:\.(?:"[^"]+"|[a-zA-Z_][\w$]*))?)/i
    );
    if (typeMatch) {
      const typeName = normalizeIdentifier(typeMatch[1]);
      if (!HRM_OWNED_ENUMS.has(typeName) && !typeName.startsWith('hrm_')) {
        violations.push(
          `${filePath}: Forbidden DDL on non-HRM enum/type "${typeName}" -> ${stmt.slice(0, 100)}`
        );
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

export function verifyAllHrmMigrations(
  migrationsDir = path.resolve(process.cwd(), 'prisma/migrations')
) {
  if (!fs.existsSync(migrationsDir)) {
    return { valid: true, checkedFiles: [], violations: [] };
  }

  const entries = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const checkedFiles = [];
  const violations = [];

  for (const dirName of entries) {
    const sqlPath = path.join(migrationsDir, dirName, 'migration.sql');
    if (!fs.existsSync(sqlPath)) continue;
    checkedFiles.push(sqlPath);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const result = validateHrmMigrationSql(sql, path.relative(process.cwd(), sqlPath));
    violations.push(...result.violations);
  }

  return {
    valid: violations.length === 0,
    checkedFiles,
    violations,
  };
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  const result = verifyAllHrmMigrations();
  if (!result.valid) {
    console.error('❌ HRM migration isolation check failed:');
    for (const v of result.violations) {
      console.error(`  - ${v}`);
    }
    process.exit(1);
  }
  console.log(
    `✅ Verified ${result.checkedFiles.length} HRM migration file(s) — strictly hrm_* scoped.`
  );
}

