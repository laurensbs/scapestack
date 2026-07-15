// Neon Postgres client.
//
// Single lazy Neon client for server-side repositories. UI modules never issue
// SQL directly. `npm run db:init` and the sync repository both apply the same
// idempotent schema before sync reads or writes.
//
// Required env: DATABASE_URL — Neon connection string from neon.tech.
// In dev: put it in .env.local. In Vercel: project settings.
//
// First-time setup: run `npm run db:init` to create the schema.

import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;

// We export a function that creates the client lazily. Some code paths
// (build-time prerender) import this module without needing the DB; we
// don't want them to throw on missing DATABASE_URL.
let cached: ReturnType<typeof neon> | null = null;

export function sql() {
  if (!url) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local or your Vercel project.");
  }
  if (!cached) cached = neon(url);
  return cached;
}

/** Returns true when DATABASE_URL is present. Callers use this to
 *  decide between 'try the DB' and 'silently no-op.' */
export function hasDatabase(): boolean {
  return Boolean(url);
}
