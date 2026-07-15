#!/usr/bin/env node
// One-shot schema creator. Reads DATABASE_URL from .env.local (or env)
// and executes the canonical schema from src/lib/sync-schema.ts.
//
// Idempotent — CREATE TABLE IF NOT EXISTS, so safe to re-run.
//
// Usage:
//   1. Create a Neon project at neon.tech, copy the connection string.
//   2. Add to .env.local: DATABASE_URL=postgresql://...
//   3. npm run db:init

import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

// Load .env.local manually — Next.js does this for us at runtime, but
// this script runs via `node` directly.
async function loadEnv() {
  try {
    const text = await readFile(".env.local", "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch { /* no .env.local, fall back to OS env */ }
}

await loadEnv();
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set. Add it to .env.local or export it.");
  process.exit(1);
}

const schemaSource = await readFile("src/lib/sync-schema.ts", "utf8");
const schemaMatch = schemaSource.match(/export const SCHEMA_SQL = `([\s\S]*?)`;\s*\n/);
if (!schemaMatch) {
  console.error("Could not read SCHEMA_SQL from src/lib/sync-schema.ts");
  process.exit(1);
}
const SCHEMA_SQL = schemaMatch[1];

const sql = neon(url);
// Neon's serverless driver requires either the tagged-template form
// sql`...` or sql.query("..."). The latter is what we want for raw
// DDL strings split out of SCHEMA_SQL.
const statements = SCHEMA_SQL.split(/;\s*$/m).map((s) => s.trim()).filter(Boolean);
for (const stmt of statements) {
  console.log("Running:", stmt.slice(0, 60).replace(/\s+/g, " ") + "...");
  await sql.query(stmt);
}
console.log("\n✓ Schema ready.");
