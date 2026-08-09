/**
 * Exercises the recap delivery ledger against a real Postgres.
 *
 * The unit tests for this run against mocks, and mocks cannot answer the two
 * questions that matter: does the atomic claim actually stop a second send,
 * and does deleting an account actually take the ledger with it. Both are SQL
 * behaviour. This repo has already shipped a schema that every text-reading
 * test called correct and Postgres rejected outright.
 *
 * Creates one throwaway account, drives the whole path, and deletes it.
 * Exits 2 when it could not run at all — an unrun check is never a pass.
 */

import { neon } from "@neondatabase/serverless";
import {
  claimRecapSend,
  clearDiscordWebhook,
  clogSlotsAround,
  recapCandidates,
  recapMetrics,
  recordRecapClick,
  releaseRecapSend,
  setRecapSettings,
  upsertWeeklyProgress,
  weekStart
} from "../src/lib/weekly-recap-repo";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("verify-recap-ledger: DATABASE_URL is not set, so nothing was verified.");
  process.exit(2);
}

const sql = neon(url);
const failures: string[] = [];

function check(name: string, condition: boolean, detail = ""): void {
  if (condition) {
    console.log(`  ok   ${name}`);
    return;
  }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
  console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
}

const RSN_PREFIX = "scapestack-ledger-probe-";
const RSN = `${RSN_PREFIX}${process.pid}`;
const WEEK = weekStart(new Date("2026-08-09T18:00:00.000Z"));
const WEBHOOK = "https://discord.com/api/webhooks/1234567890123456789/abcdefghijklmnopqrstuvwxyz0123456789";

let accountId = "";

try {
  // Sweep leftovers first. DATABASE_URL points at the live database, and a
  // process killed between the INSERT below and the DELETE at the end leaves a
  // real account_identity row behind — one with no deletion mark, so it enters
  // accountsDueForRefresh and the daily cron asks Jagex about
  // "scapestack-ledger-probe-9241" every morning forever, while counting in
  // goalSetRate()'s denominator. Self-healing beats hoping the process lives.
  const swept = await sql.query(
    `DELETE FROM account_identity WHERE rsn LIKE $1 RETURNING rsn`,
    [`${RSN_PREFIX}%`]
  ) as Array<{ rsn: string }>;
  if (swept.length > 0) console.log(`  swept ${swept.length} leftover probe account(s)`);

  const created = await sql.query(
    `INSERT INTO account_identity (rsn, display_name) VALUES ($1, $1) RETURNING account_id`,
    [RSN]
  ) as Array<{ account_id: string }>;
  accountId = created[0].account_id;

  await upsertWeeklyProgress({
    accountId, weekStart: WEEK, xpGained: 1_200_000, levelsGained: 1,
    kcGained: { zulrah: 12 }, clogSlotsGained: 3,
    goalProgress: { "99 Slayer": { pctBefore: 74, pctAfter: 82 } },
    qualifiedForStreak: true
  });

  // Re-running the job must not duplicate a week.
  await upsertWeeklyProgress({
    accountId, weekStart: WEEK, xpGained: 1_300_000, levelsGained: 1,
    kcGained: { zulrah: 12 }, clogSlotsGained: 3, goalProgress: {}, qualifiedForStreak: true
  });
  const weeks = await sql.query(
    `SELECT xp_gained FROM weekly_progress WHERE account_id = $1::uuid`, [accountId]
  ) as Array<{ xp_gained: string }>;
  check("a re-run overwrites the week instead of duplicating it",
    weeks.length === 1 && Number(weeks[0].xp_gained) === 1_300_000, `${weeks.length} rows`);

  await setRecapSettings(accountId, { enabled: true, discordWebhookUrl: WEBHOOK });
  const before = await recapCandidates(WEEK, 50);
  check("an opted-in account with a webhook is a candidate",
    before.some((row) => row.accountId === accountId));

  // The claim is the guard against sending twice. Fired concurrently, because
  // that is the case a prior read-then-write would get wrong.
  const [first, second] = await Promise.all([
    claimRecapSend(accountId, WEEK, "discord"),
    claimRecapSend(accountId, WEEK, "discord")
  ]);
  const tokens = [first, second].filter(Boolean);
  check("two concurrent claims produce exactly one token", tokens.length === 1,
    `got ${tokens.length}`);

  const token = tokens[0]!;
  const after = await recapCandidates(WEEK, 50);
  check("a sent account is no longer a candidate",
    !after.some((row) => row.accountId === accountId));

  const click = await recordRecapClick(token);
  check("a click resolves to the player's name", click?.rsn === RSN, String(click?.rsn));

  // Read as text. The driver hands back Date objects, and comparing two of
  // those with === compares references, which is false however the column
  // behaved — a check that fails whether or not the code is right.
  const clickedAt = async () => {
    const rows = await sql.query(
      `SELECT recap_clicked_at::text AS at FROM weekly_progress WHERE account_id = $1::uuid`,
      [accountId]
    ) as Array<{ at: string }>;
    return rows[0]?.at;
  };
  const firstClick = await clickedAt();
  await recordRecapClick(token);
  const secondClick = await clickedAt();
  check("a second click does not move the timestamp", secondClick === firstClick,
    `${firstClick} then ${secondClick}`);

  check("an unknown token resolves to nothing", (await recordRecapClick("not-a-token")) === null);

  const metrics = await recapMetrics(WEEK);
  check("the ledger can answer delivery and CTR",
    metrics.sent >= 1 && metrics.clicked >= 1, JSON.stringify(metrics));

  // A clicked recap must not be un-sent by a release: the click is the fact
  // §7 counts, and releasing would let a second copy go out to a player who
  // already read the first.
  await releaseRecapSend(accountId, WEEK);
  const stillSent = await sql.query(
    `SELECT recap_sent_at IS NOT NULL AS sent FROM weekly_progress WHERE account_id = $1::uuid`,
    [accountId]
  ) as Array<{ sent: boolean }>;
  check("releasing does not un-send a recap that was already clicked", stillSent[0]?.sent === true);

  const clog = await clogSlotsAround(accountId, WEEK);
  check("no sync means null, not zero, on both sides",
    clog.before === null && clog.after === null, JSON.stringify(clog));

  // The collection-log reading, against real rows. `collection_log_item_ids`
  // is INTEGER[] NOT NULL, so a sync whose log was never opened stores an
  // empty array and cardinality returns 0 — read as a count, that says the
  // player owned nothing, and the first sync after they finally open the log
  // is reported as "812 new collection-log slots this week". The row records
  // which it was, in availability->>'collectionLog'. Text-reading tests cannot
  // tell any of this; only running it can.
  const sync = async (capturedAt: string, ids: number[], availability: string) => {
    await sql.query(`
      INSERT INTO sync_snapshot (
        account_id, checksum, summary, account_type, skills, quests_completed,
        diaries_completed, collection_log_item_ids, bank_summary, availability,
        plugin_version, captured_at
      ) VALUES ($1::uuid, $2, '{}'::jsonb, 'regular', '{}'::jsonb, '[]'::jsonb,
        '[]'::jsonb, $3::int[], '{}'::jsonb, $4::jsonb, 'probe', $5::timestamptz)
    `, [
      accountId,
      `${capturedAt}-${availability}-${ids.length}`.padEnd(64, "0").slice(0, 64),
      `{${ids.join(",")}}`,
      JSON.stringify({ collectionLog: availability }),
      capturedAt
    ]);
  };

  await sync("2026-07-30T12:00:00Z", [], "not-loaded");
  await sync("2026-08-05T12:00:00Z", [1, 2, 3, 4, 5], "available");
  const notLoaded = await clogSlotsAround(accountId, WEEK);
  check("a sync whose log was never opened reads as unknown, not as zero",
    notLoaded.before === null && notLoaded.after === 5, JSON.stringify(notLoaded));

  await sync("2026-08-01T12:00:00Z", [1, 2], "available");
  const both = await clogSlotsAround(accountId, WEEK);
  check("two loaded readings give a real difference",
    both.before === 2 && both.after === 5, JSON.stringify(both));

  await sql.query(`DELETE FROM sync_snapshot WHERE account_id = $1::uuid`, [accountId]);
  await sync("2026-01-05T12:00:00Z", [1, 2], "available");
  await sync("2026-08-05T12:00:00Z", [1, 2, 3, 4, 5], "available");
  const stale = await clogSlotsAround(accountId, WEEK);
  check("a reading from months before the week is not this week's baseline",
    stale.before === null, JSON.stringify(stale));
  await sql.query(`DELETE FROM sync_snapshot WHERE account_id = $1::uuid`, [accountId]);

  await clearDiscordWebhook(accountId);
  const cleared = await recapCandidates(WEEK, 50);
  check("clearing the webhook removes the account from the queue",
    !cleared.some((row) => row.accountId === accountId));

  // Delete-my-data. The ledger hangs off the identity by CASCADE; if that ever
  // stops being true, a deleted player's week survives them.
  await sql.query(`DELETE FROM account_identity WHERE account_id = $1::uuid`, [accountId]);
  accountId = "";
  const orphans = await sql.query(
    `SELECT COUNT(*)::int AS n FROM weekly_progress WHERE recap_token = $1`, [token]
  ) as Array<{ n: number }>;
  check("deleting the account takes the ledger row with it", orphans[0]?.n === 0);
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
  console.error(`  FAIL ${error instanceof Error ? error.message : String(error)}`);
} finally {
  if (accountId) {
    await sql.query(`DELETE FROM account_identity WHERE account_id = $1::uuid`, [accountId]).catch(() => {});
  }
}

if (failures.length > 0) {
  console.error(`\nverify-recap-ledger: ${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log("\nverify-recap-ledger: the delivery ledger behaves against a real database.");
