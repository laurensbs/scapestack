import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SCHEMA_SQL } from "@/lib/sync-repo";

const REQUIRED_PLAYER_SYNC_ALTERS = [
  "display_name",
  "account_type",
  "skills",
  "quests_completed",
  "diaries_completed",
  "collection_log_item_ids",
  "bank_items",
  "bank_status",
  "slayer",
  "plugin_version",
  "sync_summary",
  "synced_at"
];

const REQUIRED_PLAYER_CLAIM_ALTERS = [
  "token_hash",
  "claimed_at",
  "last_used_at"
];

describe("sync schema migrations", () => {
  it("keeps player_sync columns idempotent for existing databases", () => {
    for (const column of REQUIRED_PLAYER_SYNC_ALTERS) {
      expect(SCHEMA_SQL).toContain(`ALTER TABLE player_sync ADD COLUMN IF NOT EXISTS ${column}`);
    }
  });

  it("keeps player_claim columns idempotent for existing databases", () => {
    for (const column of REQUIRED_PLAYER_CLAIM_ALTERS) {
      expect(SCHEMA_SQL).toContain(`ALTER TABLE player_claim ADD COLUMN IF NOT EXISTS ${column}`);
    }
  });

  it("keeps db-init script schema in sync with runtime schema", () => {
    const script = readFileSync("scripts/db-init.mjs", "utf8");

    for (const column of [...REQUIRED_PLAYER_SYNC_ALTERS, ...REQUIRED_PLAYER_CLAIM_ALTERS]) {
      expect(script).toContain(`ADD COLUMN IF NOT EXISTS ${column}`);
    }
  });

  it("runs schema repair before synced player reads and writes", () => {
    const source = readFileSync("src/lib/sync-repo.ts", "utf8");

    expect(source).toContain("export async function ensureSyncSchema()");
    expect(source).toContain("await ensureSyncSchema();");
    expect(source).toContain("SELECT rsn, display_name, skills");
    expect(source).toContain("INSERT INTO player_sync (rsn, display_name, account_type, skills");
  });
});
