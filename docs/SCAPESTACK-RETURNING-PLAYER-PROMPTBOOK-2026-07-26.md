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

### 1.1 `dps.ts` computes every number for a maxed account · shipped 2026-07-26

`CombatStats` threads real levels through the engine; `MAXED_STATS` stays the documented default so the catalogue still works before an account is attached, and `BossViability.assumedMaxed` makes the UI say which it is showing. The offensive prayer now follows the account's Prayer level (and the Defence requirement Chivalry and Piety carry), and the standard-spellbook base — a flat 28, the Fire Surge hit, for every account — scales with Magic.

Wired into `/dps` (which now fetches the Hiscores for the RSN it already had), `/next` (which was fetching the skills and discarding them) and `/bank` (which was holding the prop and not passing it down).

**Two things this uncovered, both worth remembering.**

*Honest numbers break thresholds tuned on dishonest ones.* `READY_DPS 4.5 / TEST_DPS 2.4` were calibrated when every account scored as maxed. With real levels, a 70/75 account with a whip is correctly blocked at every boss the recommendation window offers it — because that window only reaches 25 combat levels below the player, and Obor and Bryophyta, which die in well under a minute, sit just outside it. The engine went from "everyone can kill everything" to "you can kill nothing" in one step. `reachableBossFallback` closes it, firing only when nothing in the window is *ready*, and only off measured kill times.

*A dead gate is worse than no gate.* `npm run audit:next` sat in `ci:check` and never ran: its `import.meta.url === \`file://${process.argv[1]}\`` guard fails whenever the repo path contains a space, which this one does. It printed nothing and exited 0. It now runs 73 rules over 13 scenarios — and passed with real levels in the engine, which is the only reason to trust that the rest of Wave 1 has a net to fall into.

### 1.1 (original prompt, kept for reference)

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

### 1.2 The remaining visible edges · shipped 2026-07-26

**Half the boss roster was not "ungated" — it was absent.** `bossRecs` does `if (gate === undefined) continue`, so the 30 of 60 bosses with no `BOSS_CL_GATE` entry could never be recommended at all. That included Hespori, Amoxliatl and Moons of Peril, which sit exactly in the band the reachable-boss fallback was written to serve and which it therefore could never reach either. All 25 real bosses now carry a bar read off their own wiki page; four genuine non-combat activities are allowlisted, and the byte-identical second King Black Dragon entry — same stats, same icon, same name, listed twice on `/dps` — is gone, with its old links redirected.

The gate table now lives in `src/lib/boss-gates.ts` because `/dps` kept its own copy to avoid pulling the engine into the client bundle, and the two had drifted twenty-five entries apart with nothing to say so.

**The minigame window made one number do two jobs.** `gateLevel + 25` answered both "is this open" and "is this still worth doing", and got both wrong: the highest gate in the list is Agility 52, so no minigame was ever offered above level 77 and an all-80 account got none at all. Wintertodt's own card reads *"the fastest path from 50 to 99 Firemaking"* and it was hidden for the top 24 levels of exactly that range. Split into `gateLevel` and `relevantUntil`, with a score that decays across the span — without that decay, removing the window put "Try Wintertodt" second on a 2376-total account's plan.

Two gates in that file were invented rather than sourced. Soul Wars is 40 combat and 500 total, not Attack 40. Barbarian Assault has no requirement at all, and the fictional Hitpoints 40 bar plus the window made the Fighter torso invisible to every account above 65 Hitpoints.

**"Why this trip?" explained a trip that was not on screen.** The panel read `result.headline` while the card rendered `WhatToDo`'s own pick, re-ranked by mood, time budget, route lens, shuffle, saved feedback and explicit selection. They diverge on the first render for most accounts and always after any interaction.

**The adversarial pass on this batch: 26 claims, 16 refuted, 4 real after deduplication — all four mine.** The worst was an infinite render loop on the `/goals → /next` deep link: `recommendationForGoalRoute` built a fresh object every render, the new on-screen-pick callback turned that into a state update, and React aborted at "Maximum update depth exceeded" — reproduced in a headless browser against the committed code, and verified fixed live on production afterwards. The others: Amoxliatl's `{ needs: [] }` suppressed it for every bank-pasting account (an empty list now means "no gear gate"), Hespori's 65 Farming bar lived in a comment and was enforced nowhere, and the two combat-gated minigames vanished above combat 100. Plus one meta-defect: the new gear-gate name test validated *zero* names — its regex anchored on a header comment and captured the wrong table, which is how a misnamed item survived it. The test imports the table directly now.

That is two passes in a row where a guard I wrote to catch a failure was itself broken in a way that made it pass vacuously (`audit:next`'s dead main-guard, then this). **A new gate's first test is that it can fail.**

### 1.3 Combat Achievements — deliberately not built here

They belong in Wave 2, and the reason is worth writing down so nobody relitigates it.

CA points and tier are **not on the OSRS Hiscores** — the `index_lite` response is 25 skills and 90 activities, and no row carries them — and **not on Wise Old Man**, whose metric list is a strict subset plus EHP/EHB. There is no server-only path to them.

A hiscores-*derived* version is a trap. Only 26% of the 469 task varbits are kill-count type, the only kind a server could infer; the other 74% — mechanical, perfection, restriction, speed, stamina — are structurally invisible. Of the monsters in the derivable slice, about fifty need a hand-maintained alias table and sixteen have no hiscores row at all. The result would silently under-report every account while showing neither of the two numbers players actually quote.

In the plugin it is nearly free: `VarbitID.CA_POINTS` and the six `CA_TIER_STATUS_*` varbits already exist in the pinned runelite-api, and `GameStateReader` already reads `SLAYER_POINTS` the same way. It also populates on login without the player opening any interface, which makes it a more reliable domain than the collection log. **Add it to the contract v4 batch.**

---

## Wave 2.2 — the plugin batch, assembled but not submitted · 2026-07-26

Candidate `0.4.0` / contract `4`. **Published stays `0.3.0` / contract `3`** — nothing has gone to the Plugin Hub, and nothing will until the equipment decision is made. The point of this step is that the decision becomes the only thing left.

**Combat Achievements are the one v4 domain this build collects.** Points and highest completed tier, from `VarbitID.CA_POINTS` (14815) and the six `CA_TIER_STATUS_*` varbits (12863–12868) — IDs read out of the pinned runelite-api 1.12.33 jar rather than recalled. They live in VarPlayers, so they populate on login without the player opening any interface: a more reliable domain than the collection log.

**Equipment and farming ship as `unsupported` with a stated reason.** That is what coverage is for, and both alternatives are worse: omitting them fails the server's own v4 validation, and empty arrays would claim we looked and found nothing. Equipment reads `equipment-not-collected-by-design`, and both READMEs now say the contract reserves a slot the plugin declines to fill.

### The open decision — equipment

Both READMEs list equipment under **"Never sent"**, and that is published: it is in the Plugin Hub PR and visible to everyone who installed the plugin. It is a promise to users, not an implementation detail, so it is not mine to withdraw.

Flipping it is now a one-line change — `Domain.unsupported(...)` becomes a real read, plus the README lists. **Everything else in the batch is ready.**

The case for saying yes: equipment is what makes "can I kill this?" honest for a player whose best gear is worn rather than banked, and it is strictly less sensitive than the bank contents already synced. The case for saying no: the promise was made in those words, and a plugin that quietly starts sending a category it named as never-sent is exactly the thing that costs a Hub plugin its trust.

### Two checks the release tooling was missing

- `PluginSnapshotContract.VERSION` must equal `candidate.contractVersion`. Nothing tied them together, so the Java constant could be bumped, shipped and rejected by the server on every request with the check green — and the Hub cannot roll back. Verified by setting the manifest to contract 9: passes without the check, fails with it.
- Every coverage domain the plugin sends must be one the website knows, and the reverse. It caught a word out of its own neighbouring comment on the first run, which is how it earned a comment-stripping pass.

`tests/fixtures/plugin-sync-v3.json` is frozen, with a Java test saying so. It is the byte-real payload the published plugin sends and the server must keep parsing it for as long as anyone runs that build. The Gradle fixture writer rewrote it as v4 once — it was pointed at the v3 path while the source had already moved.

---

## Wave 2.1 — the server accepts contract v4 · shipped 2026-07-26

The server now parses `contractVersion` 3 **and** 4, with `equipment`, `farming` and `combatAchievements` as three new coverage domains, each validated to the same standard as the v3 payloads. The published constant stays at 3: release checks pin against it, and it moves only when a plugin actually ships. Nothing in the plugin changed.

Three traps this had to route around, each a prior failure class here:

- `normalizePluginSnapshotCoverage` reads rows written before v4 existed. The new domains are optional there and required only in the v4 parser — folding them into the shared list would have rejected every stored row on read.
- `getSyncedPlayer` selects explicit columns and deliberately skips DDL on the hot path, so the three columns were created on production **before** the deploy.
- The history ledger's checksum is fed by `ImmutableSnapshotState`. The v4 fields live outside it, so the canonical form of existing snapshots is unchanged and dedup keeps working.

**The adversarial pass found two real defects, and nearly lost them.** The workflow reported "0 confirmed" — but six of twelve verify agents had been killed by a session limit, and a killed agent returns null, which filters out of `confirmed` exactly like a refutation. Both criticals were in that group.

*The v4 columns were write-once.* `PERSIST_SYNC_SQL` gates each column on `($17::jsonb ->> '<domain>') = 'available'`, and `$17` is `resolveSnapshotAvailability`'s return — an object literal with exactly the seven core keys. `NULL = 'available'` is never true, so the `CASE` fell to `ELSE` and kept the stored value: written on INSERT, never updated for an account that already had a row. My own production check missed it because it used a fresh RSN, which takes the INSERT path.

*`/quests/[slug]` leaked the bank.* It read the snapshot straight from the database, bypassing the visibility layer, and passed the whole bank to a client component — so `?rsn=<any name>` returned that player's full bank in the public RSC payload. Confirmed live against a real 830-stack account. `/next` was fixed for exactly this in July; this route was missed.

**Two rules earned here, both about verification rather than code:**

- *A verification must be able to produce a negative.* A deploy check polling for HTTP 200 approves the old build. A database check with a fresh row never exercises `ON CONFLICT`. A leak check against a 404 slug proves nothing. Each of those three happened today.
- *A regression test for a systemic bug should be structural.* The replacement asserts that **every** domain the SQL gates on is a key the resolver can emit — not that three specific names are present. It was reverted once to confirm it fails.

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
- Combat Achievements (see 1.3 — unreachable any other way)
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
