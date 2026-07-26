# Scapestack — Returning Player Promptbook

**Date:** 2026-07-26
**Status:** reference promptbook. Registered in `SCAPESTACK-EXECUTION-CONTROLLER.json` under `referencePromptbooks`; it does not move `executionPointer`.
**Source:** the returning-player audit of 2026-07-25 (8 lenses, 40 strengths, 29 gaps) and the 48-finding improvement audit in `SCAPESTACK-AUDIT-2026-07-25.md`.

This is the implementation plan for those findings. It is ordered by a hard constraint, not by value — read the next section before deciding to reorder anything.

---

## 0. The constraint that decides the order

The server deploys in a minute and can be rolled back. The RuneLite plugin goes through Plugin Hub review, is pinned to one immutable commit, and **cannot be rolled back**.

Two rules follow, and neither is negotiable:

1. **The server leads.** It must accept a new field, on production, verified, *before* the plugin sends it.
2. **Plugin work batches.** Four separate improvements are four review cycles and four irreversible decisions. They ship as one.

The sharp edge today is in `src/lib/plugin-snapshot-contract.ts:84`:

```ts
if (body.contractVersion !== PLUGIN_SNAPSHOT_CONTRACT_VERSION) {
  return { ok: false, error: `Unsupported contractVersion; expected ${PLUGIN_SNAPSHOT_CONTRACT_VERSION}` };
}
```

Hard equality. Published plugin is `0.3.0` / contract `3`. **A v4 plugin released before the server accepts v4 breaks every synced player, permanently.**

---

## Wave 0 — the repositioning · shipped 2026-07-26

The only wave that changes what the product *is*. Small, because the data was already there.

**What landed:**

- `src/lib/returning-player.ts` — WOM's `lastChangedAt` becomes absence bands (`active` / `brief` / `lapsed` / `long` / `dormant`). It had been fetched since the beginning and read by nothing.
- `src/lib/account-stage.ts` — `returning` is a detection instead of the 1900-total fallback it had always been. A 1583-total player back after five months read "Midgame main", the same label as someone who logged out an hour ago.
- `src/lib/game-updates.ts` — what the game added, with every date read off the OSRS Wiki rather than recalled.
- `src/components/returning-briefing.tsx` — the answer to "what did I miss", above the plan, server-rendered.
- `src/lib/name-key.ts` — the quest-name canonicaliser, previously a byte-identical private copy in two modules.

**The trap in this wave, for the record.** WOM only advances `lastChangedAt` when something triggers an update of that profile, and Scapestack only ever GETs. A player who logs in daily but whom nobody tracks carries a months-old timestamp. Told naively, an active player gets "you have been away five months" — wrong about the one fact they can check instantly. Two mitigations shipped: `latestActivity()` takes the freshest signal across WOM *and* our own `syncedAt`, and the copy states what was observed ("No XP recorded on this account in about 8 months") rather than asserting where the player was.

Verified in a production build, not the dev server: `/next?rsn=Faux` renders the briefing as real DOM markup.

**The adversarial pass found five real defects in this wave.** 29 claims raised across five lenses, 24 refuted, and every survivor was reproduced by hand before being fixed:

| defect | why it mattered |
|---|---|
| `describeAbsenceLength` printed "1 year and 12 months" | years carved in 365-day units, remainder in 30-day ones — self-contradictory, five days out of every year |
| Varlamore dated 2024-01-10 | that is Children of the Sun's date; Jagex shipped the quest ten weeks early. Anyone who left in between never saw the region |
| "no supplies carried in" on Fortis Colosseum | that rule belongs to The Gauntlet. Acting on it costs gear in a dangerous instance |
| the stage test used a fixed date against a live clock | it would have flipped to failing on 2026-08-18, with no commit to blame |
| `hasPluginSync` was too weak a guard | next-up.ts passes `pluginSyncState === "live"`, false for any snapshot over 24h — exactly when a stale WOM record wins. Now on an explicit `lastActiveAt` |

Two of those were factual errors about the game, in the file whose own header demands every fact be sourced rather than recalled. That is the failure mode to expect, not an unlucky one.

**Leave it running for two weeks before Wave 3.** `scripts/return-report.mjs` measures whether routes actually bring people back; this is the first change worth measuring with it.

---

## Wave 1 — correctness debt that is live right now

Server-only. Everything here is visible to a returning player today and wrong.

### 1.1 `dps.ts` computes every number for a maxed account

```
Read src/lib/dps.ts. STATS is a module constant of { attack: 99, strength: 99,
ranged: 99, magic: 99 } with no parameter for real levels, and nothing passes
player stats in. Every DPS figure on /dps is therefore computed for a maxed
account, and the best offensive prayers are assumed alongside it.

Thread real levels through. The prayer assumption must follow the account's
actual Prayer level rather than being unconditional. Where levels are unknown,
say the numbers are for a maxed account instead of quietly presenting them as
this player's.

Verify against a real mid-level account: the kill-time figure must change when
the levels do, and the /dps verdict must not tell an 85-Attack account it can
do what a 99 can.
```

**Do this first in the wave.** It is the most damaging item on the list: the page's entire promise is "can I kill this", and it currently answers for somebody else's account.

### 1.2 The remaining visible edges

```
Work through these, judging each on its own rather than applying one pattern:

- 30 of 60 bosses have no BOSS_CL_GATE entry, so they carry no combat bar.
- The minigame window only offers content within 25 levels, which hides exactly
  the content a returning player never saw.
- "Why this trip?" explains a different trip than the one shown.
- The unchosen default mood reorders the first card before the player picks.
- Combat Achievements do not exist anywhere in the product.

For each: state what is wrong, what you changed, and what you verified. If one
of these turns out not to be worth fixing, say so and leave it.
```

---

## Wave 2 — one plugin release

### 2.1 Server first, and only the server

```
Make parsePluginSnapshotContract accept contract 3 AND 4, with every v4 field
optional. Do not touch the plugin in this step.

Deploy. Verify on production that a v3 snapshot still round-trips and a
hand-built v4 body is accepted. Leave it running.
```

The gap between 2.1 and 2.2 is the point. Do not close it in the same session.

### 2.2 Then the plugin, once

```
One release, carrying all of:

- equipment (worn gear, not just the bank)
- farming, tree and birdhouse timers
- Combat Achievements
- a sync on logout

Batched because the Plugin Hub builds one immutable commit and there is no
rollback. Anything left out waits for the next release.
```

**Equipment needs an explicit decision from the owner before this ships.** The README and the Hub PR currently promise Scapestack never sends inventory. Equipment is a different field from inventory, but the distinction is finer than a reader of that promise will assume, and the promise has to change in the same release. My recommendation is to make the change — equipment is less sensitive than bank contents and it is precisely what makes "can I do this?" answerable — but it is a promise the owner made, not one I can revise.

**Farming timers are the only item on this whole list that gives a player a reason to open Scapestack unprompted.** Everything else answers a question the player already had.

---

## Wave 3 — the depth the new data unlocks

Cannot start earlier; each of these needs a field Wave 2 adds.

- **Gear progression** — "your next upgrade is X, here is how you pay for it" (needs equipment)
- **The return loop** — "your Ranarrs are ready, birdhouses in 20 minutes" (needs timers)
- **Route to a goal** instead of one step — `/goals` says "4 pieces" and cannot answer what comes after
- **Time to goal** — the question every returning player actually asks

---

## Working rules

Carried from the session that produced this. Eighteen commits, each with a green `ci:check`, still produced 32 regressions — two of them worse than the problem they fixed.

**A migration that reads a new column backfills it in the same commit.** `last_synced_at` shipped without one, so every pre-existing claim read NULL and became takeover-eligible: 4 of 6 production claims were seizable, all with real synced data.

**Anything about SSR or caching is measured on `npm run build` + `next start`, never the dev server.** This was wrong three times in one day. `/dps` measured 3,728 characters on dev and served 219 in production, because `useSearchParams` excludes a Suspense boundary's contents from the prerendered HTML.

**One wave per deploy, verified on production before the next starts.** Not for tidiness — so that when something breaks you know which change did it.

**An adversarial pass closes every wave.** Not when you happen to feel suspicious. Two of the worst defects of that day were only findable that way: a migration run against real data, and behaviour that exists solely in a production build.

**Facts about the game get sourced, not recalled.** Every date in `game-updates.ts` was read off the wiki. Two factual errors in one session — a quest requirement and a skill-cape count — both caught only by checking. A wrong date in that file is presented to the player as fact about their own absence.
