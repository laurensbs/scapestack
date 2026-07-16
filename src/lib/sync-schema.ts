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

CREATE TABLE IF NOT EXISTS account_pairing (
  pairing_id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES account_identity(account_id) ON DELETE CASCADE,
  rsn TEXT NOT NULL,
  code_hash CHAR(64) NOT NULL,
  browser_secret_hash CHAR(64) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'consumed', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  approved_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS account_pairing_lookup_idx ON account_pairing(pairing_id, expires_at);
CREATE INDEX IF NOT EXISTS account_pairing_code_idx ON account_pairing(code_hash, status, expires_at);

CREATE TABLE IF NOT EXISTS account_browser_session (
  session_id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES account_identity(account_id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS account_browser_session_account_idx ON account_browser_session(account_id, last_used_at DESC);
CREATE INDEX IF NOT EXISTS account_browser_session_token_idx ON account_browser_session(token_hash) WHERE revoked_at IS NULL;

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
CREATE OR REPLACE FUNCTION prevent_immutable_history_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'immutable history rows cannot be updated'; RETURN OLD; END; $$;
DROP RULE IF EXISTS sync_snapshot_no_update ON sync_snapshot;
DROP TRIGGER IF EXISTS sync_snapshot_no_update ON sync_snapshot;
CREATE TRIGGER sync_snapshot_no_update BEFORE UPDATE ON sync_snapshot FOR EACH ROW EXECUTE FUNCTION prevent_immutable_history_update();

CREATE TABLE IF NOT EXISTS recommendation_decision (
  decision_id BIGSERIAL PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES account_identity(account_id) ON DELETE CASCADE,
  snapshot_id BIGINT REFERENCES sync_snapshot(snapshot_id) ON DELETE SET NULL,
  recommendation_id TEXT NOT NULL,
  decision_key TEXT,
  contract_version INTEGER NOT NULL DEFAULT 1,
  decision JSONB NOT NULL DEFAULT '{}'::jsonb,
  action TEXT NOT NULL,
  reason TEXT NOT NULL,
  route_family TEXT,
  mood TEXT,
  timebox_minutes INTEGER,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE recommendation_decision ADD COLUMN IF NOT EXISTS decision_key TEXT;
ALTER TABLE recommendation_decision ADD COLUMN IF NOT EXISTS contract_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE recommendation_decision ADD COLUMN IF NOT EXISTS decision JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS recommendation_decision_account_idx ON recommendation_decision(account_id, decided_at DESC);
CREATE INDEX IF NOT EXISTS recommendation_decision_key_idx ON recommendation_decision(account_id, decision_key, decided_at DESC) WHERE decision_key IS NOT NULL;
DROP RULE IF EXISTS recommendation_decision_no_update ON recommendation_decision;
DROP TRIGGER IF EXISTS recommendation_decision_no_update ON recommendation_decision;
CREATE TRIGGER recommendation_decision_no_update BEFORE UPDATE ON recommendation_decision FOR EACH ROW EXECUTE FUNCTION prevent_immutable_history_update();

CREATE TABLE IF NOT EXISTS trip_lifecycle_event (
  event_id BIGSERIAL PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES account_identity(account_id) ON DELETE CASCADE,
  snapshot_id BIGINT REFERENCES sync_snapshot(snapshot_id) ON DELETE SET NULL,
  recommendation_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  route_family TEXT,
  mood TEXT,
  stop_point TEXT,
  title TEXT,
  legacy_event_id CHAR(64),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE trip_lifecycle_event ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE trip_lifecycle_event ADD COLUMN IF NOT EXISTS legacy_event_id CHAR(64);
ALTER TABLE trip_lifecycle_event ADD COLUMN IF NOT EXISTS decision_id BIGINT REFERENCES recommendation_decision(decision_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS trip_lifecycle_event_account_idx ON trip_lifecycle_event(account_id, occurred_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS trip_lifecycle_event_legacy_idx ON trip_lifecycle_event(account_id, legacy_event_id) WHERE legacy_event_id IS NOT NULL;
DROP INDEX IF EXISTS trip_lifecycle_event_decision_type_idx;
CREATE INDEX IF NOT EXISTS trip_lifecycle_event_decision_type_idx ON trip_lifecycle_event(account_id, decision_id, event_type, occurred_at DESC) WHERE decision_id IS NOT NULL;
DROP RULE IF EXISTS trip_lifecycle_event_no_update ON trip_lifecycle_event;
DROP TRIGGER IF EXISTS trip_lifecycle_event_no_update ON trip_lifecycle_event;
CREATE TRIGGER trip_lifecycle_event_no_update BEFORE UPDATE ON trip_lifecycle_event FOR EACH ROW EXECUTE FUNCTION prevent_immutable_history_update();

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
ALTER TABLE outcome_match ADD COLUMN IF NOT EXISTS decision_id BIGINT REFERENCES recommendation_decision(decision_id) ON DELETE SET NULL;
ALTER TABLE outcome_match ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE outcome_match ADD COLUMN IF NOT EXISTS outcome_key TEXT;
CREATE INDEX IF NOT EXISTS outcome_match_account_idx ON outcome_match(account_id, matched_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS outcome_match_snapshot_decision_idx ON outcome_match(snapshot_id, decision_id) WHERE decision_id IS NOT NULL;
DROP RULE IF EXISTS outcome_match_no_update ON outcome_match;
DROP TRIGGER IF EXISTS outcome_match_no_update ON outcome_match;
CREATE TRIGGER outcome_match_no_update BEFORE UPDATE ON outcome_match FOR EACH ROW EXECUTE FUNCTION prevent_immutable_history_update();

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
DROP RULE IF EXISTS account_preference_event_no_update ON account_preference_event;
DROP TRIGGER IF EXISTS account_preference_event_no_update ON account_preference_event;
CREATE TRIGGER account_preference_event_no_update BEFORE UPDATE ON account_preference_event FOR EACH ROW EXECUTE FUNCTION prevent_immutable_history_update();

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
