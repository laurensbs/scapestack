/**
 * Runtime-safe, idempotent sync schema.
 *
 * `player_sync` remains the fast latest-state projection. The history tables
 * are append-only ledgers; only explicit account deletion may remove rows.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS player_sync (
  rsn TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'normal',
  skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  quests_completed JSONB NOT NULL DEFAULT '[]'::jsonb,
  diaries_completed JSONB NOT NULL DEFAULT '[]'::jsonb,
  collection_log_item_ids INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  boss_kc JSONB,
  bank_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  bank_status JSONB NOT NULL DEFAULT '{"enabled":false,"itemCount":0,"capturedAt":null,"unavailableReason":"opt-in-off"}'::jsonb,
  slayer JSONB,
  plugin_version TEXT NOT NULL DEFAULT 'unknown',
  sync_summary JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE player_sync ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '';
ALTER TABLE player_sync ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE player_sync ADD COLUMN IF NOT EXISTS skills JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE player_sync ADD COLUMN IF NOT EXISTS quests_completed JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE player_sync ADD COLUMN IF NOT EXISTS diaries_completed JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE player_sync ADD COLUMN IF NOT EXISTS collection_log_item_ids INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE player_sync ADD COLUMN IF NOT EXISTS boss_kc JSONB;
ALTER TABLE player_sync ADD COLUMN IF NOT EXISTS bank_items JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE player_sync ADD COLUMN IF NOT EXISTS bank_status JSONB NOT NULL DEFAULT '{"enabled":false,"itemCount":0,"capturedAt":null,"unavailableReason":"opt-in-off"}'::jsonb;
ALTER TABLE player_sync ADD COLUMN IF NOT EXISTS slayer JSONB;
ALTER TABLE player_sync ADD COLUMN IF NOT EXISTS plugin_version TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE player_sync ADD COLUMN IF NOT EXISTS sync_summary JSONB;
ALTER TABLE player_sync ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS player_sync_synced_at_idx ON player_sync(synced_at DESC);

CREATE TABLE IF NOT EXISTS player_claim (
  rsn TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  account_id UUID,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE player_claim ADD COLUMN IF NOT EXISTS token_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE player_claim ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE player_claim ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS account_identity (
  account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rsn TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deletion_requested_at TIMESTAMPTZ,
  delete_after TIMESTAMPTZ
);
ALTER TABLE account_identity ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '';
ALTER TABLE account_identity ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE account_identity ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE account_identity ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;
ALTER TABLE account_identity ADD COLUMN IF NOT EXISTS delete_after TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS account_identity_rsn_idx ON account_identity(rsn);

INSERT INTO account_identity (rsn, display_name, created_at, last_seen_at)
SELECT rsn, COALESCE(NULLIF(display_name, ''), rsn), synced_at, synced_at
FROM player_sync
ON CONFLICT (rsn) DO NOTHING;
INSERT INTO account_identity (rsn, display_name, created_at, last_seen_at)
SELECT rsn, rsn, claimed_at, last_used_at
FROM player_claim
ON CONFLICT (rsn) DO NOTHING;
ALTER TABLE player_claim ADD COLUMN IF NOT EXISTS account_id UUID;
UPDATE player_claim claim
SET account_id = identity.account_id
FROM account_identity identity
WHERE claim.rsn = identity.rsn AND claim.account_id IS NULL;
CREATE INDEX IF NOT EXISTS player_claim_account_id_idx ON player_claim(account_id);

CREATE TABLE IF NOT EXISTS sync_snapshot (
  snapshot_id BIGSERIAL PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES account_identity(account_id) ON DELETE CASCADE,
  checksum CHAR(64) NOT NULL,
  summary JSONB NOT NULL,
  account_type TEXT NOT NULL,
  skills JSONB NOT NULL,
  quests_completed JSONB NOT NULL,
  diaries_completed JSONB NOT NULL,
  collection_log_item_ids INTEGER[] NOT NULL,
  boss_kc JSONB,
  bank_summary JSONB NOT NULL,
  availability JSONB NOT NULL DEFAULT '{}'::jsonb,
  delta JSONB NOT NULL DEFAULT '{}'::jsonb,
  slayer JSONB,
  plugin_version TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, checksum)
);
ALTER TABLE sync_snapshot ADD COLUMN IF NOT EXISTS boss_kc JSONB;
ALTER TABLE sync_snapshot ADD COLUMN IF NOT EXISTS availability JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE sync_snapshot ADD COLUMN IF NOT EXISTS delta JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS sync_snapshot_latest_idx ON sync_snapshot(account_id, captured_at DESC, snapshot_id DESC);
CREATE OR REPLACE RULE sync_snapshot_no_update AS ON UPDATE TO sync_snapshot DO INSTEAD NOTHING;

CREATE TABLE IF NOT EXISTS recommendation_decision (
  decision_id BIGSERIAL PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES account_identity(account_id) ON DELETE CASCADE,
  snapshot_id BIGINT REFERENCES sync_snapshot(snapshot_id) ON DELETE SET NULL,
  recommendation_id TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT NOT NULL,
  route_family TEXT,
  mood TEXT,
  timebox_minutes INTEGER,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS recommendation_decision_account_idx ON recommendation_decision(account_id, decided_at DESC);
CREATE OR REPLACE RULE recommendation_decision_no_update AS ON UPDATE TO recommendation_decision DO INSTEAD NOTHING;

CREATE TABLE IF NOT EXISTS trip_lifecycle_event (
  event_id BIGSERIAL PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES account_identity(account_id) ON DELETE CASCADE,
  snapshot_id BIGINT REFERENCES sync_snapshot(snapshot_id) ON DELETE SET NULL,
  recommendation_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  route_family TEXT,
  mood TEXT,
  stop_point TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS trip_lifecycle_event_account_idx ON trip_lifecycle_event(account_id, occurred_at DESC);
CREATE OR REPLACE RULE trip_lifecycle_event_no_update AS ON UPDATE TO trip_lifecycle_event DO INSTEAD NOTHING;

CREATE TABLE IF NOT EXISTS outcome_match (
  outcome_id BIGSERIAL PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES account_identity(account_id) ON DELETE CASCADE,
  snapshot_id BIGINT NOT NULL REFERENCES sync_snapshot(snapshot_id) ON DELETE CASCADE,
  recommendation_id TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  evidence JSONB NOT NULL,
  matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(snapshot_id, recommendation_id, evidence_type)
);
CREATE INDEX IF NOT EXISTS outcome_match_account_idx ON outcome_match(account_id, matched_at DESC);
CREATE OR REPLACE RULE outcome_match_no_update AS ON UPDATE TO outcome_match DO INSTEAD NOTHING;

CREATE TABLE IF NOT EXISTS account_preference_event (
  preference_event_id BIGSERIAL PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES account_identity(account_id) ON DELETE CASCADE,
  mood TEXT,
  timebox_minutes INTEGER,
  route_family TEXT,
  source TEXT NOT NULL DEFAULT 'player',
  chosen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS account_preference_event_account_idx ON account_preference_event(account_id, chosen_at DESC);
CREATE OR REPLACE RULE account_preference_event_no_update AS ON UPDATE TO account_preference_event DO INSTEAD NOTHING;

CREATE TABLE IF NOT EXISTS account_retention (
  account_id UUID PRIMARY KEY REFERENCES account_identity(account_id) ON DELETE CASCADE,
  snapshot_retention_days INTEGER NOT NULL DEFAULT 365,
  bank_payload_retention_hours INTEGER NOT NULL DEFAULT 24,
  deletion_requested_at TIMESTAMPTZ,
  delete_after TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export function syncSchemaStatements(): string[] {
  return SCHEMA_SQL
    .split(/;\s*$/m)
    .map((statement) => statement.trim())
    .filter(Boolean);
}
