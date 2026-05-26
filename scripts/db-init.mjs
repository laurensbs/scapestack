#!/usr/bin/env node
// One-shot schema creator. Reads DATABASE_URL from .env.local (or env)
// and runs the SCHEMA_SQL block from src/lib/sync-repo.ts.
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

// Same schema as src/lib/sync-repo.ts SCHEMA_SQL — duplicated here so
// this script has zero TypeScript dep. Keep in sync manually.
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS player_sync (
  rsn TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  quests_completed JSONB NOT NULL DEFAULT '[]'::jsonb,
  diaries_completed JSONB NOT NULL DEFAULT '[]'::jsonb,
  collection_log_item_ids INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  slayer JSONB,
  plugin_version TEXT NOT NULL DEFAULT 'unknown',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE player_sync ADD COLUMN IF NOT EXISTS slayer JSONB;
CREATE INDEX IF NOT EXISTS player_sync_synced_at_idx ON player_sync(synced_at DESC);

CREATE TABLE IF NOT EXISTS player_claim (
  rsn TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

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
