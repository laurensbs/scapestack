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
  "boss_kc",
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
  "last_used_at",
  "account_id"
];

const HISTORY_TABLES = [
  "account_identity",
  "sync_snapshot",
  "recommendation_decision",
  "trip_lifecycle_event",
  "outcome_match",
  "account_preference_event",
  "account_retention",
  "account_pairing",
  "account_browser_session"
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

    expect(script).toContain('readFile("src/lib/sync-schema.ts"');
    expect(script).toContain("export const SCHEMA_SQL");
    expect(script).not.toContain("Keep in sync manually");
  });

  it("creates the immutable account-history ledger and latest-read indexes", () => {
    for (const table of HISTORY_TABLES) {
      expect(SCHEMA_SQL).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    expect(SCHEMA_SQL).toContain("UNIQUE(account_id, checksum)");
    expect(SCHEMA_SQL).toContain("sync_snapshot_latest_idx");
    expect(SCHEMA_SQL).toContain("CREATE OR REPLACE FUNCTION prevent_immutable_history_update()");
    expect(SCHEMA_SQL).toContain("DROP RULE IF EXISTS sync_snapshot_no_update ON sync_snapshot");
    expect(SCHEMA_SQL).toContain("CREATE TRIGGER sync_snapshot_no_update BEFORE UPDATE ON sync_snapshot");
    expect(SCHEMA_SQL).toContain("ALTER TABLE trip_lifecycle_event ADD COLUMN IF NOT EXISTS title");
    expect(SCHEMA_SQL).toContain("trip_lifecycle_event_legacy_idx");
    expect(SCHEMA_SQL).not.toContain("CREATE OR REPLACE RULE");
    expect(SCHEMA_SQL).toContain("ALTER TABLE sync_snapshot ADD COLUMN IF NOT EXISTS boss_kc");
    expect(SCHEMA_SQL).toContain("ALTER TABLE sync_snapshot ADD COLUMN IF NOT EXISTS availability");
    expect(SCHEMA_SQL).toContain("ALTER TABLE sync_snapshot ADD COLUMN IF NOT EXISTS delta");
    expect(SCHEMA_SQL).toContain("ALTER TABLE recommendation_decision ADD COLUMN IF NOT EXISTS decision_key");
    expect(SCHEMA_SQL).toContain("ALTER TABLE recommendation_decision ADD COLUMN IF NOT EXISTS contract_version");
    expect(SCHEMA_SQL).toContain("ALTER TABLE recommendation_decision ADD COLUMN IF NOT EXISTS decision");
    expect(SCHEMA_SQL).toContain("recommendation_decision_key_idx");
    expect(SCHEMA_SQL).toContain("trip_lifecycle_event_decision_type_idx");
    expect(SCHEMA_SQL).toContain("outcome_match_snapshot_decision_idx");
    expect(SCHEMA_SQL).toContain("ALTER TABLE outcome_match ADD COLUMN IF NOT EXISTS status");
    expect(SCHEMA_SQL).not.toContain("sync_snapshot (\n  snapshot_id BIGSERIAL PRIMARY KEY,\n  bank_items");
  });

  it("runs schema repair before synced player reads and writes", () => {
    const source = readFileSync("src/lib/sync-repo.ts", "utf8");

    expect(source).toContain("export async function ensureSyncSchema()");
    expect(source).toContain("await ensureSyncSchema();");
    expect(source).toContain("SELECT rsn, display_name, skills");
    expect(source).toContain("persistSyncAndSnapshot({");
    const repositorySource = readFileSync("src/lib/account-history-repo.ts", "utf8");
    expect(repositorySource).toContain("INSERT INTO player_sync (");
    expect(repositorySource).toContain("INSERT INTO sync_snapshot (");
    expect(repositorySource).toContain("export async function getLatestAccountDelta");
  });
});
