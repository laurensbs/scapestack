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
  snapshot_coverage JSONB,
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
ALTER TABLE player_sync ADD COLUMN IF NOT EXISTS snapshot_coverage JSONB;
-- Contract v4 domains. Nullable on purpose and NOT backfilled on purpose:
-- NULL here means "no plugin has ever sent this", which is exactly what is
-- true for every pre-v4 row. A default of '[]' would instead claim we
-- observed an empty state we never observed.
ALTER TABLE player_sync ADD COLUMN IF NOT EXISTS equipment JSONB;
ALTER TABLE player_sync ADD COLUMN IF NOT EXISTS farming JSONB;
ALTER TABLE player_sync ADD COLUMN IF NOT EXISTS combat_achievements JSONB;
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
-- Notification channels (SPEC §2.2 players.notify_*). These live ON the
-- identity rather than in a second table, so the existing delete-my-data path
-- (deleteAccountHistory -> DELETE FROM account_identity) takes them with it.
-- Discord first per §2.4; the email columns exist but nothing writes them
-- until a transactional provider is chosen, and when it does it is
-- double-opt-in (notify_email_verified_at) with one-click unsubscribe.
ALTER TABLE account_identity ADD COLUMN IF NOT EXISTS notify_discord_webhook_url TEXT;
ALTER TABLE account_identity ADD COLUMN IF NOT EXISTS notify_email TEXT;
ALTER TABLE account_identity ADD COLUMN IF NOT EXISTS notify_email_verified_at TIMESTAMPTZ;
ALTER TABLE account_identity ADD COLUMN IF NOT EXISTS notify_weekly_recap BOOLEAN NOT NULL DEFAULT TRUE;
-- When the daily refresh last ATTEMPTED this account, which is not the same as
-- when it last succeeded. A name that is not on the hiscores never produces a
-- snapshot, so ordering the queue by last success sorts it first forever and it
-- occupies a slot in every batch until the end of time. On a roster with more
-- unranked names than the batch size, no ranked player is ever refreshed again.
-- Ordering by the attempt is what makes the queue drain.
ALTER TABLE account_identity ADD COLUMN IF NOT EXISTS hiscore_checked_at TIMESTAMPTZ;
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
-- RuneLite's account hash is stable per OSRS account and survives a name
-- change, which is the only way to tell "this player renamed" apart from
-- "this player logged into their other character on the same install".
-- Nullable: plugin builds before 0.4.0 do not send it.
ALTER TABLE player_claim ADD COLUMN IF NOT EXISTS account_hash TEXT;

-- Set only by verifyClaim, i.e. only by a sync the server actually accepted.
-- last_used_at cannot answer this: it is set at claim time and bumped by
-- bookkeeping too, so it cannot tell "claimed" apart from "actually used".
-- A claim that never synced is what a name-squatter leaves behind.
ALTER TABLE player_claim ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
-- Backfill, and it is not optional. The column arrived empty while the release
-- rule that reads it treats NULL as "never synced, may be taken". Every claim
-- made before that deploy therefore read NULL and was older than the window,
-- so the entire existing user base became takeover-eligible — a bigger hole
-- than the land grab this was meant to close.
--
-- player_sync.synced_at is the true "this account has synced" signal. A real
-- squatter has no player_sync row, so theirs stays NULL and still expires.
UPDATE player_claim claim
SET last_synced_at = sync.synced_at
FROM player_sync sync
WHERE sync.rsn = claim.rsn AND claim.last_synced_at IS NULL;

-- Claim attempts, successful or not. Exists to rate-limit; rows outside the
-- longest window are deleted on write, so this does not grow unbounded. The
-- IP is hashed — the threat model forbids storing one.
CREATE TABLE IF NOT EXISTS claim_attempt (
  attempt_id BIGSERIAL PRIMARY KEY,
  ip_hash TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS claim_attempt_ip_idx ON claim_attempt(ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS claim_attempt_token_idx ON claim_attempt(token_hash, created_at DESC);
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
  coverage JSONB,
  delta JSONB NOT NULL DEFAULT '{}'::jsonb,
  slayer JSONB,
  plugin_version TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, checksum)
);
ALTER TABLE sync_snapshot ADD COLUMN IF NOT EXISTS boss_kc JSONB;
ALTER TABLE sync_snapshot ADD COLUMN IF NOT EXISTS availability JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE sync_snapshot ADD COLUMN IF NOT EXISTS coverage JSONB;
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

-- One frozen, bank-derived answer. The raw bank never enters this table.
-- Creation is private; only an owner-scoped UPDATE may set published_at.
CREATE TABLE IF NOT EXISTS bank_affordability_share (
  share_id TEXT PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES account_identity(account_id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  source_synced_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  CHECK (share_id ~ '^[A-Za-z0-9_-]{24}$')
);
CREATE INDEX IF NOT EXISTS bank_affordability_share_owner_idx ON bank_affordability_share(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bank_affordability_share_public_idx ON bank_affordability_share(share_id) WHERE published_at IS NOT NULL AND revoked_at IS NULL;
CREATE OR REPLACE FUNCTION prevent_bank_share_snapshot_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.snapshot IS DISTINCT FROM OLD.snapshot OR NEW.account_id IS DISTINCT FROM OLD.account_id OR NEW.source_synced_at IS DISTINCT FROM OLD.source_synced_at THEN RAISE EXCEPTION 'bank share snapshot is immutable'; END IF; RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS bank_affordability_share_snapshot_no_update ON bank_affordability_share;
CREATE TRIGGER bank_affordability_share_snapshot_no_update BEFORE UPDATE ON bank_affordability_share FOR EACH ROW EXECUTE FUNCTION prevent_bank_share_snapshot_update();

-- Goals are private account state chosen by the player, not derived recommendations.
CREATE TABLE IF NOT EXISTS account_pinned_goal (
  account_id UUID NOT NULL REFERENCES account_identity(account_id) ON DELETE CASCADE,
  goal_key TEXT NOT NULL,
  goal JSONB NOT NULL,
  pinned_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (account_id, goal_key),
  CHECK (goal_key ~ '^(item|level|unlock):[a-z0-9:-]{1,90}$')
);
CREATE INDEX IF NOT EXISTS account_pinned_goal_account_idx ON account_pinned_goal(account_id, pinned_at ASC);
-- SPEC §3.1: percentage is measured from goal start, not from zero. Without a
-- baseline "82% to your Fire cape" cannot be computed at all — a level-92
-- player pinning 99 would read as 92% done on day one.
ALTER TABLE account_pinned_goal ADD COLUMN IF NOT EXISTS baseline JSONB;
ALTER TABLE account_pinned_goal ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE account_pinned_goal ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE account_pinned_goal ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
-- Exactly one primary goal per account (§3.1). A partial unique index states
-- that as a database fact rather than as a convention the app remembers.
CREATE UNIQUE INDEX IF NOT EXISTS account_pinned_goal_primary_idx
  ON account_pinned_goal(account_id) WHERE is_primary;
-- The original CHECK allowed only item|level|unlock. The spec's nine types
-- have to fit, and the old three keep working: every existing row stays valid
-- under the widened pattern, which is why this is a widening and not a
-- rewrite. Dropped and re-added as a pair so re-running the schema is still
-- idempotent.
ALTER TABLE account_pinned_goal DROP CONSTRAINT IF EXISTS account_pinned_goal_goal_key_check;
ALTER TABLE account_pinned_goal DROP CONSTRAINT IF EXISTS account_pinned_goal_key_shape;
ALTER TABLE account_pinned_goal ADD CONSTRAINT account_pinned_goal_key_shape
  CHECK (goal_key ~ '^(item|level|unlock|skill_level|skill_xp|boss_kc|gear_item|gear_tier|quest|diary|clog_slots|ca_tier|custom):[a-z0-9:_-]{1,90}$');

-- SPEC §2.2 hiscore_snapshots. Distinct from sync_snapshot on purpose:
-- sync_snapshot is plugin-sourced and only exists for players who installed
-- the plugin, while the daily cron backbone (§2.3 job 1) has to work for
-- RSN-only players too. This is the table that gives the product a clock.
CREATE TABLE IF NOT EXISTS hiscore_snapshot (
  hiscore_snapshot_id BIGSERIAL PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES account_identity(account_id) ON DELETE CASCADE,
  taken_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  skills JSONB NOT NULL,
  bosses JSONB,
  source TEXT NOT NULL DEFAULT 'cron',
  CHECK (source IN ('cron', 'manual', 'plugin'))
);
CREATE INDEX IF NOT EXISTS hiscore_snapshot_account_idx
  ON hiscore_snapshot(account_id, taken_at DESC);
-- One row per account per day from the cron: a second daily row would make
-- every delta read as zero.
--
-- AT TIME ZONE 'UTC' is load-bearing, not decoration. taken_at::date on a
-- timestamptz is STABLE, not IMMUTABLE — it depends on the session TimeZone —
-- and Postgres refuses it in an index expression outright. The statement
-- errored on every schema apply, and because ensureSyncSchema runs the
-- statements in order and caches the resulting promise, EVERY statement after
-- this one never ran and every later call rejected from the cache. The whole
-- of Phase 1's schema sat behind it.
--
-- Nothing in 1,797 unit tests noticed, because none of them apply the schema
-- to a database. npm run db:verify is the check that can produce a negative.
CREATE UNIQUE INDEX IF NOT EXISTS hiscore_snapshot_daily_idx
  ON hiscore_snapshot(account_id, ((taken_at AT TIME ZONE 'UTC')::date)) WHERE source = 'cron';

-- SPEC §2.2 weekly_progress. Materialised by the Sunday recap job; also the
-- delivery ledger, so "recap delivered" and "recap clicked" are server-side
-- facts rather than client-side guesses (§7).
CREATE TABLE IF NOT EXISTS weekly_progress (
  account_id UUID NOT NULL REFERENCES account_identity(account_id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  xp_gained BIGINT NOT NULL DEFAULT 0,
  levels_gained INTEGER NOT NULL DEFAULT 0,
  kc_gained JSONB NOT NULL DEFAULT '{}'::jsonb,
  clog_slots_gained INTEGER NOT NULL DEFAULT 0,
  goal_progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  qualified_for_streak BOOLEAN NOT NULL DEFAULT FALSE,
  recap_token TEXT UNIQUE,
  recap_sent_at TIMESTAMPTZ,
  recap_channel TEXT,
  recap_clicked_at TIMESTAMPTZ,
  PRIMARY KEY (account_id, week_start),
  CHECK (recap_channel IS NULL OR recap_channel IN ('discord', 'email'))
);
CREATE INDEX IF NOT EXISTS weekly_progress_week_idx ON weekly_progress(week_start DESC);

-- SPEC §2.2 milestones. Append-only.
-- PRINCIPLE 1 IS ENFORCED HERE, not in the application: every kind names a
-- real in-game achievement. There is deliberately no kind for opening the
-- site, clicking, or referring anyone — a hollow badge cannot be inserted
-- because the database will not accept one.
CREATE TABLE IF NOT EXISTS milestone (
  milestone_id BIGSERIAL PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES account_identity(account_id) ON DELETE CASCADE,
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  kind TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  shared BOOLEAN NOT NULL DEFAULT FALSE,
  CHECK (kind IN (
    'level', 'kc_threshold', 'clog_slot', 'ca_tier',
    'gear_tier_unlocked', 'goal_completed', 'adventurer_rank_up'
  ))
);
CREATE INDEX IF NOT EXISTS milestone_account_idx ON milestone(account_id, achieved_at DESC);

-- §7 D1/D7 return. One row per account per day the player actually opened a
-- page, which is the only shape that can answer "did they come back on day 7";
-- last_seen_at holds a single timestamp and cannot.
--
-- NOT account_retention, despite the name. That table is about how long DATA is
-- kept. This is about whether a PLAYER returned, and the two would have been
-- read into each other for years.
--
-- A date and an account id, nothing else: no path, no referrer, no address. It
-- CASCADEs from the identity, so delete-my-data takes it without being taught.
CREATE TABLE IF NOT EXISTS account_visit (
  account_id UUID NOT NULL REFERENCES account_identity(account_id) ON DELETE CASCADE,
  visit_date DATE NOT NULL,
  PRIMARY KEY (account_id, visit_date)
);
CREATE INDEX IF NOT EXISTS account_visit_date_idx ON account_visit(visit_date DESC);

-- Hashed counters for the limits that have no account to hang off yet: the
-- on-demand refresh (per RSN) and first registration (per source address).
-- Only digests are stored, never the address or the name, and rows outside the
-- window are deleted on write so this needs no scheduled job.
CREATE TABLE IF NOT EXISTS rate_attempt (
  scope TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS rate_attempt_lookup_idx ON rate_attempt(scope, key_hash, created_at DESC);

-- A migration that reads a new column backfills it in the same commit
-- (CLAUDE.md). Every goal pinned before today has no baseline, and a goal with
-- no baseline reads as progress-from-zero: a level-92 player who pinned 99
-- would see 92% on the day they set it. Seed each one from that account's
-- newest snapshot so the percentage counts from when the goal was set.
--
-- Only skills are backfilled, because skills are the only metric the pre-today
-- goal types (item|level|unlock) measure against and the only one every
-- existing snapshot carries. Goals whose baseline cannot be derived keep NULL,
-- which the reader treats as "unknown" and says so, rather than as zero.
UPDATE account_pinned_goal g
SET baseline = jsonb_build_object(
      'skills', s.skills,
      'capturedAt', s.captured_at,
      'backfilled', true
    )
FROM (
  SELECT DISTINCT ON (account_id) account_id, skills, captured_at
  FROM sync_snapshot
  ORDER BY account_id, captured_at DESC
) s
WHERE g.account_id = s.account_id AND g.baseline IS NULL;

-- The oldest goal per account becomes the primary one. Exactly one, enforced
-- by account_pinned_goal_primary_idx above; without this every pre-today
-- account has zero primaries and the goal bar has nothing to pin.
UPDATE account_pinned_goal g
SET is_primary = TRUE
FROM (
  SELECT DISTINCT ON (account_id) account_id, goal_key
  FROM account_pinned_goal
  ORDER BY account_id, pinned_at ASC
) first
WHERE g.account_id = first.account_id
  AND g.goal_key = first.goal_key
  AND NOT EXISTS (
    SELECT 1 FROM account_pinned_goal p
    WHERE p.account_id = g.account_id AND p.is_primary
  );

-- Backfill in the same commit that adds the column (CLAUDE.md). Left NULL,
-- every existing account reads as never-attempted and the whole roster becomes
-- due at once — the first cron run after deploy would then hand Jagex a burst
-- in one batch instead of the even drain the ordering is there to produce.
-- Seeded from the newest cron snapshot, which is the last attempt we can prove.
UPDATE account_identity i
SET hiscore_checked_at = s.taken_at
FROM (
  SELECT DISTINCT ON (account_id) account_id, taken_at
  FROM hiscore_snapshot
  WHERE source = 'cron'
  ORDER BY account_id, taken_at DESC
) s
WHERE i.account_id = s.account_id AND i.hiscore_checked_at IS NULL;

-- Same for the visit ledger: an account that has synced or claimed has been
-- seen, and without a day-zero row every one of them lands in the D1/D7
-- denominator as a cohort member who never visited at all. That reports a
-- return rate lower than the truth, which is the direction a metric is least
-- likely to be questioned in.
INSERT INTO account_visit (account_id, visit_date)
SELECT account_id, last_seen_at::date FROM account_identity
ON CONFLICT DO NOTHING;
`;

export function syncSchemaStatements(): string[] {
  return SCHEMA_SQL
    .split(/;\s*$/m)
    .map((statement) => statement.trim())
    .filter(Boolean);
}
