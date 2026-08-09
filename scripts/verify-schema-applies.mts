/**
 * Applies every schema statement to a real database and reports the ones that
 * fail.
 *
 * This exists because 1,797 unit tests and a green ci:check did not notice that
 * `CREATE UNIQUE INDEX ... (taken_at::date)` is rejected by Postgres — a
 * timestamptz cast to date is STABLE, not IMMUTABLE, and is not allowed in an
 * index expression. ensureSyncSchema runs the statements in order and caches
 * the promise, so that one line stopped every statement after it from ever
 * running and made every later call reject from the cache. The entire Phase 1
 * schema was behind it.
 *
 * Every test the repo had asserted on the schema as TEXT. Text cannot tell you
 * whether Postgres will accept it. This runs it.
 *
 * Exits non-zero on the first failing statement, and prints it.
 */

import { neon } from "@neondatabase/serverless";
import { syncSchemaStatements } from "../src/lib/sync-schema";

const url = process.env.DATABASE_URL;
if (!url) {
  // Loud, and non-zero. A verification that silently passes when it verified
  // nothing is the failure mode this repo has already paid for twice.
  console.error("verify-schema: DATABASE_URL is not set, so nothing was verified.");
  console.error("Set it (see .env.local) and re-run. Not treating an unrun check as a pass.");
  process.exit(2);
}

const sql = neon(url);
const statements = syncSchemaStatements();
const failures: Array<{ index: number; message: string; statement: string }> = [];

for (const [index, statement] of statements.entries()) {
  try {
    await sql.query(statement);
  } catch (error) {
    failures.push({
      index,
      message: error instanceof Error ? error.message : String(error),
      statement
    });
  }
}

if (failures.length === 0) {
  console.log(`verify-schema: ${statements.length} statements applied cleanly.`);
  process.exit(0);
}

console.error(`verify-schema: ${failures.length} of ${statements.length} statements failed.\n`);
for (const failure of failures) {
  const body = failure.statement
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .trim();
  console.error(`--- statement #${failure.index}: ${failure.message}`);
  console.error(`${body.slice(0, 500)}\n`);
}
process.exit(1);
