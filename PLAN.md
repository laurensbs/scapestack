# Phase 1 plan — SCAPESTACK_SPEC.md §9, items 1–7

Mapped onto the repo as it stands on 2026-08-08 (`e01926e`). Every claim below
was checked against the source, not assumed.

---

## What already exists (do not rebuild)

| Spec asks for | Already here | Where |
|---|---|---|
| Player registry keyed by RSN | `account_identity` (UUID + rsn, pairing, delete flow) | `src/lib/sync-schema.ts` |
| Plugin state (quests/diaries/clog/slayer/bank) | `sync_snapshot` — and it is **already a time series**: one row per distinct checksum with `captured_at` and a computed `delta` | `src/lib/sync-schema.ts:152` |
| Server-side hiscores proxy | `fetchHiscores()`, server-only, 5-min revalidate, bounded by `AbortSignal.timeout` | `src/lib/hiscores.ts:48` |
| Saved goals | `account_pinned_goal` + localStorage mirror, server sync via `/api/account/goals` | `src/lib/pinned-goals.ts` |
| Goal → trip prioritisation | `recommendationMovesPinnedGoal`, `goalTripWhy`, `buildPinnedGoalTrip` | `src/lib/pinned-goal-orientation.ts`, `src/lib/pinned-goal-trip.ts` |
| Goal picker | The goal bar — first line of the answer, six rows + search | `src/components/goal-bar.tsx` |
| Demo character | `REFERENCE_ACCOUNT` (combat 109, 11-item bank) rendered on `/` | `src/lib/reference-account.ts` |
| Analytics transport | `track()` → Plausible, typed event union | `src/lib/analytics.ts` |

**The gap is not the goal system. It is that nothing has a clock:** no hiscores
time series, no weekly aggregate, no milestone feed, no notification channel,
and no baseline on a goal — so "82% to your Fire cape" cannot be computed today.

---

## Item-by-item

### 1. Schema + migrations — **NEEDS YOUR APPROVAL**

The spec's `players` table is `account_identity` under a different name. I would
**extend, not duplicate**, and add four tables. Concretely:

| Spec table | Plan |
|---|---|
| `players` | Extend `account_identity` with `notify_discord_webhook_url`, `notify_email`, `notify_email_verified_at`, `notify_weekly_recap bool default true` |
| `hiscore_snapshots` | **New table.** `sync_snapshot` is plugin-sourced and only exists for synced players; the cron backbone must work for RSN-only players too |
| `plugin_state` | Already `sync_snapshot` (latest row wins). No change |
| `goals` | Extend `account_pinned_goal` with `baseline jsonb`, `is_primary bool`, `sort_order int`, `completed_at`. The `CHECK` on `goal_key` currently allows only `item\|level\|unlock` — widening it to the spec's nine types is the breaking bit |
| `weekly_progress` | New table |
| `milestones` | New table |
| `gear_tiers` | **Phase 2. Not built now.** |

Three things I want you to say yes to before I touch the DB:

- **`notify_email` is new PII** in a product whose privacy posture is a stated
  trust asset (§1.6). It needs to land in the existing delete-my-data path and
  in the retention policy, not beside it.
- **Widening the `goal_key` CHECK** is a live-data change. Existing rows stay
  valid; the constraint has to be dropped and recreated.
- `scripts/db-init.mjs` is idempotent `CREATE TABLE IF NOT EXISTS` + `ALTER …
  ADD COLUMN IF NOT EXISTS`. I would follow that pattern rather than introduce a
  migration runner. **A migration that reads a new column backfills it in the
  same commit** (CLAUDE.md), so `baseline` gets backfilled from the newest
  snapshot for every existing goal.

### 2. Hiscores proxy + daily cron + deltas

- Proxy exists. Add `src/app/api/cron/hiscores/route.ts`, guarded by
  `CRON_SECRET`, jittered, bounded by a wall clock rather than a fixed count —
  the work per account is a round trip to someone else's server, so any count
  large enough to be useful is also large enough to overrun the function.
- **`vercel.json` does not exist** — needs creating with a `crons` entry. Vercel
  Hobby allows one cron per day, which is exactly what §2.3 job 1 needs; the
  weekly job (item 5) rides the same daily tick and no-ops except on Sunday.
- Delta computation reuses the shape `sync_snapshot.delta` already uses.
- On-demand "Refresh now", rate-limited 1/10min per RSN.

### 3. Goal picker: templates, baseline, primary

- The picker exists and is one click from the top of the page. What is missing
  is **the baseline** — without it every percentage is measured from zero, and
  §3.1 explicitly requires measuring from goal start.
- Add the six missing goal types (`skill_xp`, `boss_kc`, `gear_tier`, `quest`,
  `diary`, `clog_slots`, `ca_tier`, `custom`).
- `is_primary`: exactly one, pinned everywhere. The goal bar already renders
  `goals[0]` — that becomes "the primary goal" properly rather than by accident.
- **Onboarding step 1**: today `/` is RSN → `/p/[rsn]`. Spec wants RSN → three
  suggested goals → pick or skip. `pinnedGoalSuggestionsFromPlan` already
  produces the suggestions; this is a routing and copy change, not new logic.

  **Built as the goal line's empty state, not as a screen — and this is the one
  decision in item 3 worth your overrule.** A `/start/[rsn]` route was written
  and then deleted, because two tests fail the moment it exists:
  `tests/first-run-flow.test.ts` ("saves a fresh RSN and opens its canonical
  answer **without setup**") and `tests/hero-intake-copy.test.ts`. They are not
  stale assertions — they were written to hold open a path this repo cleared by
  *removing* a first-run setup screen, and they name that screen's dead symbols
  (`markAccountFirstSetupSeen`, `setShowFirstSetup`, `role="dialog"`) so it
  cannot come back. Adding an interstitial withdraws that promise, and it also
  makes every new player pay for the planning context twice.

  So: `/p/[rsn]`'s goal line asks "What are you working toward?" above the
  fold, one click opens **three** suggestions rather than six, and the trip is
  already rendered underneath so ignoring the question costs nothing. That is
  RSN → suggested goals → pick or skip, on one page.

  If you want the literal separate screen, say so and the two guards come out
  with it — but they should come out on purpose, not as collateral.

### 4. Goal-aware `/next` — mostly done, needs the label

Prioritisation is live (a pinned goal already reorders and can synthesise a trip
the catalogue cannot serve). Missing is the **exact string** from §3.1:
`Serves your goal: {goal}`. That is a copy change in
`recommendation-decision.ts` plus a marker the e2e can assert.

### 5. Weekly recap + Discord + email + CTR

- Recap job on the Sunday branch of the daily cron.
- Discord embed exactly per §3.3 (`🔥 This week on {RSN}`, text progress bar
  `▓▓▓▓▓▓▓▓░░ 82%`, unsubscribe footer).
- Email: double opt-in. **This needs a transactional provider and an env var**
  (spec suggests Resend). I will build the Discord half first — it is free, it
  needs no third party, and §2.4 lists it first — and put email behind a flag
  until you have picked a provider.
- CTR: one token per recap, `/r/[token]` → redirect with the goal context, so
  the metric is a server-side fact rather than a client-side guess.

### 6. Empty-state overhaul

- `/next` still literally renders *"Enter an OSRS name to get one clear next
  move."* — the §0.4 complaint verbatim (`next-client.tsx:1098`).
- Same in `plugin-sync-checker.tsx:237`.
- Both get the demo character's real output plus §3.4's copy.

### 7. Copy pass — §3.5 strings, exact

| Where | Now | §3.5 |
|---|---|---|
| `src/app/page.tsx:28,31` | "Your OSRS companion." + "Scapestack remembers…" | "Stop bankstanding. Set a goal, and Scapestack tells you the next step every session — and sends you a Sunday recap of what you banked." |
| `src/components/hero-intake.tsx:49` | "Open my page" | "Show my next step" |
| recap template | — | "🔥 This week on {RSN}: +1.2M XP, 3 new collection-log slots, and you're now 82% to your Fire cape. ~14 Jad waves to go. Next step →" |

**Collision to decide:** the new hero is ~3× longer than the current one, and
`/` is inside the page-budget spec's height and type budgets. I will fit it
inside the budget; if it cannot fit, I stop and ask rather than raise the
budget — a budget nobody enforces is the failure this repo already paid for.

---

## §7 instrumentation, added per item as I go

| Metric | How | Added with |
|---|---|---|
| Goal-set rate | `goal_set` event + a server-side count of accounts with ≥1 goal | item 3 |
| Recap delivery | Row per send in `weekly_progress` | item 5 |
| Recap CTR | `/r/[token]` redirect, server-side | item 5 |
| D1/D7 return | Server-side from `account_identity.last_seen_at` — **note the name collision**: `account_retention` is about *data* retention, not user retention. New table or new columns, not that one | item 2 |
| RSN activation | `rsn_entered` event | item 6 |

---

## Non-goals I will actively enforce (§8)

No daily streaks, no points for site usage, no leaderboards, no WOM/Bank Memory
clone, no Jagex assets, no accounts/passwords, no marketing email. §1.1 in
particular: **every reward maps to a real in-game achievement** — the milestone
kinds are limited to levels, KC thresholds, clog slots, CA tiers, gear tier-ups
and goal completions, and nothing else may write to that table.

---

## Order and checkpoints

Items run 1 → 7, one commit each, `npm run ci:check` green before the next, and
this file ticked as I go.

- [x] 1. Schema + migrations — done `ci:check` green, 1,747 unit tests. Four
      guards sabotage-proved: allowing a `login` milestone kind, narrowing the
      goal CHECK so existing rows break, removing the baseline backfill, and
      dropping the milestone cascade each turn one red.
- [x] 2. Hiscores cron + deltas — done. `ci:check` green, 1,804 unit tests,
      `db:verify` 129/129. **`CRON_SECRET` must be set in the Vercel project
      or the route stays shut** (it fails closed on purpose). Fourteen guards
      sabotage-proved.

      Three defects in the first pass, all fixed: the cron read Jagex on
      `PLANNING_SOURCE_DEADLINES_MS.hiscores`, which is a 900 ms *page* budget
      and would have punched holes in the time series; the queue was ordered by
      last **success**, so a name not on the hiscores never succeeds, sorts
      first forever and starves every ranked player behind it; and a fixed
      batch of 40 with no wall-clock check overran `maxDuration` at any
      realistic deadline. The queue is now ordered by `hiscore_checked_at`
      (attempt, not success) and bounded by the clock.

      Registration-on-visit was added because `account_identity` was only ever
      written by a plugin sync or a claim — an RSN-only player had no row, so
      the cron had nothing to iterate for exactly the population
      `hiscore_snapshot` was split out to serve.

      **Item 1's schema was broken on the database and this is what found
      it.** The daily unique index used `taken_at::date`; a timestamptz cast to
      date is STABLE, not IMMUTABLE, and Postgres rejects it in an index
      expression. `ensureSyncSchema` applies statements in order and caches the
      promise, so that one line meant `weekly_progress`, `milestone`,
      `account_visit` and every backfill never ran, and every later call
      rejected from the cache. 1,747 green tests missed it because all of them
      assert on the schema as *text*, and text cannot tell you what Postgres
      will accept. `npm run db:verify` runs it against a real database and
      exits 2 rather than pass when `DATABASE_URL` is absent.
- [x] 3. Goal picker: baseline, types, primary, onboarding step 1 — done.
      `ci:check` green, 1,837 unit tests, `db:verify` 129/129. Nine guards
      sabotage-proved.

      **Baseline** is captured at the moment of pinning, from the evidence the
      page is already rendering, and the percentage is measured from it. Level
      goals are measured in XP rather than levels — 92 → 99 Slayer is 6.5M XP,
      and counting it in levels calls the first 100k one seventh done. No
      baseline reads as unknown, never as 0%.

      **Six types** added: `skill_xp`, `boss_kc`, `quest`, `diary`,
      `clog_slots`, `ca_tier`. `gear_tier` and `gear_item` are deliberately
      NOT among them — gear tiers are Phase 2 (see the table above) — and
      `custom` has no way to be measured, so it would be a goal the product
      can only ever shrug at. Quest and diary are absent from the *static*
      picker list because quest-db and diary-db read from disk with node:fs;
      they are pinnable and arrive as server-side suggestions.

      **`is_primary`** is read by the goal line, which had been showing
      `goals[0]` — the OLDEST pin, by accident of the sort order, so a goal set
      months ago outranked the one set this morning.

      **Item 1 left the delete guard behind**: it widened the `goal_key` CHECK
      to the spec's types and left `deleteAccountPinnedGoal` matching only
      `item|level|unlock` with no underscore. Every new kind could have been
      pinned and then never removed. The regex and the CHECK are now one rule,
      asserted against each other.

      **Onboarding step 1 did NOT land as a separate screen.** See below.
- [x] 4. "Serves your goal" label — done. `ci:check` green, 1,841 unit tests.
      The label fires only on structured evidence (`completionTarget`), never
      on a title match — guarded.
- [ ] 5. Weekly recap + Discord (+ email behind a flag)
- [ ] 6. Empty states
- [ ] 7. Copy pass

**Two decisions I need from you before item 1:**

1. **Email**: pick a provider (Resend?) and I add it, or I ship Discord-only for
   Phase 1 and leave `notify_email` unbuilt. Discord-only is the faster,
   cheaper, more OSRS-native path and §2.4 ranks it first.
2. **`notify_email` PII**: yes to storing an email address, on the condition
   that it is double-opt-in, one-click unsubscribe, and inside the existing
   delete-my-data path?

Everything from item 2 onward is additive and safe. Item 1 is the only one that
touches live data.
