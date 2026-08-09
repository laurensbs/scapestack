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

  it("backfills last_synced_at, or every pre-existing claim becomes seizable", () => {
    // The release-an-unused-claim rule reads NULL as "never synced, may be
    // taken". The column shipped empty, so on deploy every claim ever made
    // read NULL and was older than the window — a bigger hole than the land
    // grab it was meant to close. Verified against the live database at the
    // time: 4 of 6 claims seizable, all with real synced data.
    expect(SCHEMA_SQL).toMatch(/UPDATE player_claim claim\s+SET last_synced_at = sync\.synced_at/);
    // The backfill has to come after the column exists.
    const addColumn = SCHEMA_SQL.indexOf("ADD COLUMN IF NOT EXISTS last_synced_at");
    const backfill = SCHEMA_SQL.indexOf("SET last_synced_at = sync.synced_at");
    expect(addColumn).toBeGreaterThan(-1);
    expect(backfill).toBeGreaterThan(addColumn);
  });

  it("creates immutable, private-first affordability share snapshots", () => {
    const tableStart = SCHEMA_SQL.indexOf("CREATE TABLE IF NOT EXISTS bank_affordability_share");
    const tableEnd = SCHEMA_SQL.indexOf(";", tableStart);
    const shareTable = SCHEMA_SQL.slice(tableStart, tableEnd);

    expect(SCHEMA_SQL).toContain("CREATE TABLE IF NOT EXISTS bank_affordability_share");
    expect(shareTable).toContain("share_id TEXT PRIMARY KEY");
    expect(shareTable).toContain("CHECK (share_id ~ '^[A-Za-z0-9_-]{24}$')");
    expect(shareTable).toContain("snapshot JSONB NOT NULL");
    expect(shareTable).toContain("published_at TIMESTAMPTZ,");
    expect(shareTable).not.toMatch(/published_at\s+TIMESTAMPTZ\s+(?:NOT NULL|DEFAULT)/);
    expect(shareTable).toContain("revoked_at TIMESTAMPTZ");
    expect(shareTable).not.toMatch(/bank_items|item_ids|quantit(?:y|ies)/i);
    expect(SCHEMA_SQL).toContain("prevent_bank_share_snapshot_update");
    expect(SCHEMA_SQL).toContain("NEW.snapshot IS DISTINCT FROM OLD.snapshot");
    expect(SCHEMA_SQL).toContain("WHERE published_at IS NOT NULL AND revoked_at IS NULL");
  });

  it("stores pinned goals as private account-owned rows", () => {
    const tableStart = SCHEMA_SQL.indexOf("CREATE TABLE IF NOT EXISTS account_pinned_goal");
    const tableEnd = SCHEMA_SQL.indexOf(";", tableStart);
    const goalTable = SCHEMA_SQL.slice(tableStart, tableEnd);

    expect(goalTable).toContain("account_id UUID NOT NULL REFERENCES account_identity(account_id) ON DELETE CASCADE");
    expect(goalTable).toContain("goal JSONB NOT NULL");
    expect(goalTable).toContain("pinned_at TIMESTAMPTZ NOT NULL");
    expect(goalTable).toContain("PRIMARY KEY (account_id, goal_key)");
    expect(goalTable).not.toMatch(/public|published|rsn/i);
  });
});

describe("Phase 1 retention schema (SPEC §2.2)", () => {
  it("hangs notification channels off the identity, so delete-my-data takes them", () => {
    // deleteAccountHistory deletes account_identity and everything that
    // CASCADEs off it. A second `players` table, or notify_* in a table of
    // their own, would have needed the delete path taught about it — and the
    // one thing a privacy posture cannot survive is a column the delete
    // forgot. §1.6.
    for (const column of [
      "notify_discord_webhook_url",
      "notify_email",
      "notify_email_verified_at",
      "notify_weekly_recap"
    ]) {
      expect(SCHEMA_SQL, `${column} must live on account_identity`)
        .toContain(`ALTER TABLE account_identity ADD COLUMN IF NOT EXISTS ${column}`);
    }
  });

  it("cascades every new table from account_identity", () => {
    // Same reason: this is what makes "Delete my data" true for the new
    // tables without a single line of delete code.
    for (const table of ["hiscore_snapshot", "weekly_progress", "milestone"]) {
      const start = SCHEMA_SQL.indexOf(`CREATE TABLE IF NOT EXISTS ${table} (`);
      expect(start, `${table} is missing`).toBeGreaterThan(-1);
      const body = SCHEMA_SQL.slice(start, SCHEMA_SQL.indexOf(");", start));
      expect(body, `${table} must cascade from account_identity`)
        .toContain("REFERENCES account_identity(account_id) ON DELETE CASCADE");
    }
  });

  it("makes a hollow badge unrepresentable (PRINCIPLE 1)", () => {
    // §1.1: every reward maps to a real in-game achievement. Enforced by the
    // database, not by whoever writes the next insert — the kinds a badge for
    // opening the site would need simply are not accepted values.
    const start = SCHEMA_SQL.indexOf("CREATE TABLE IF NOT EXISTS milestone (");
    const body = SCHEMA_SQL.slice(start, SCHEMA_SQL.indexOf("CREATE INDEX IF NOT EXISTS milestone_account_idx", start));
    expect(body).toMatch(/CHECK \(kind IN \(/);
    for (const real of ["level", "kc_threshold", "clog_slot", "ca_tier", "gear_tier_unlocked", "goal_completed"]) {
      expect(body, `${real} is a real in-game achievement and must be allowed`).toContain(`'${real}'`);
    }
    for (const hollow of ["login", "visit", "click", "referral", "signup", "streak_day"]) {
      expect(body, `${hollow} is not anchored to anything in the game`).not.toContain(`'${hollow}'`);
    }
  });

  it("allows exactly one primary goal, in the database", () => {
    expect(SCHEMA_SQL).toContain("CREATE UNIQUE INDEX IF NOT EXISTS account_pinned_goal_primary_idx");
    expect(SCHEMA_SQL).toMatch(/account_pinned_goal_primary_idx[\s\S]{0,120}WHERE is_primary/);
  });

  it("widens the goal-key CHECK without invalidating a single existing row", () => {
    const check = SCHEMA_SQL.slice(SCHEMA_SQL.indexOf("account_pinned_goal_key_shape\n  CHECK"));
    const pattern = check.match(/goal_key ~ '(\^[^']+\$)'/)?.[1];
    expect(pattern, "the widened CHECK pattern is missing").toBeTruthy();
    const re = new RegExp(pattern!);
    // The three types that already have rows in production must still pass...
    for (const existing of ["item:bandos-chestplate", "level:slayer:99", "unlock:barrows-gloves"]) {
      expect(re.test(existing), `${existing} would be rejected — existing rows would break`).toBe(true);
    }
    // ...and the spec's types must now be representable.
    for (const added of ["skill_xp:slayer:13m", "boss_kc:zulrah:500", "gear_tier:melee:dragon", "clog_slots:700", "ca_tier:hard", "custom:fire-cape"]) {
      expect(re.test(added), `${added} must be accepted`).toBe(true);
    }
    // The drop must precede the add, or a re-run fails on the existing name.
    expect(SCHEMA_SQL.indexOf("DROP CONSTRAINT IF EXISTS account_pinned_goal_key_shape"))
      .toBeLessThan(SCHEMA_SQL.indexOf("ADD CONSTRAINT account_pinned_goal_key_shape"));
  });

  it("backfills baseline and primary in the same commit that adds them", () => {
    // CLAUDE.md: a migration that reads a new column backfills it in the same
    // commit. Without a baseline every percentage measures from zero, so a
    // level-92 player who pins 99 reads as 92% done the moment they set it.
    expect(SCHEMA_SQL).toMatch(/UPDATE account_pinned_goal g\s*\nSET baseline =/);
    expect(SCHEMA_SQL).toContain("WHERE g.account_id = s.account_id AND g.baseline IS NULL");
    expect(SCHEMA_SQL).toMatch(/UPDATE account_pinned_goal g\s*\nSET is_primary = TRUE/);
  });

  it("keeps one cron hiscore row per account per day", () => {
    // Two rows on the same day make every delta read as zero.
    expect(SCHEMA_SQL).toMatch(/hiscore_snapshot_daily_idx[\s\S]{0,140}WHERE source = 'cron'/);
  });
});
