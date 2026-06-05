import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SCHEMA_SQL } from "@/lib/sync-repo";

const REQUIRED_PLAYER_SYNC_ALTERS = [
  "display_name",
  "quests_completed",
  "diaries_completed",
  "collection_log_item_ids",
  "slayer",
  "plugin_version",
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
});
