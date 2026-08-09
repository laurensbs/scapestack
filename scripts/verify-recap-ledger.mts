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

const RSN = `scapestack-ledger-probe-${process.pid}`;
const WEEK = weekStart(new Date("2026-08-09T18:00:00.000Z"));
const WEBHOOK = "https://discord.com/api/webhooks/1234567890123456789/abcdefghijklmnopqrstuvwxyz0123456789";

let accountId = "";

try {
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
