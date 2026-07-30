# Scapestack — Companion Hub Promptbook

**Date:** 2026-07-28
**Status:** execution promptbook. Feed the phases to Codex in order, one at a time.
**Source:** three multi-agent audits of 2026-07-26/27 (70 findings, 11 adversarially confirmed), the flow measurement of 2026-07-28, and everything shipped in between. Raw analysis annex: `docs/design/CODEX-MASTERPROMPT-2026-07-28.md`.

Every number in this file was measured on the date given. Where a claim could not be measured, it is not here.

---

## 0. The constraint that decides the order

Not value. Not effort. **Honesty first, then architecture, then depth.**

The reason is in one screenshot. `/next?rsn=Lynx+Titan` — the number one account in the game, 200,000,000 XP in every skill — was told *"Finish Skill capes"* and *"Get Ava's device"*, in 32px bold, under the eyebrow **"Do this first"**, justified by *"This best matches your visible account progress."*

That justification is `src/lib/recommendation-decision.ts:357`, the last case in the switch — the string emitted when the engine has **no fact to cite**. The most confident sentence in the product appears precisely when it knows least.

Three rules follow, and none is negotiable:

1. **Fix the lie before the layout.** Every phase after 0 makes the product prettier or deeper. Doing any of them first is polishing a false answer.
2. **One URL before any new feature.** There are currently two account pages and four separate intakes. Adding a fifth surface to that costs more than it gives — and a half-built third account page triples the problem rather than solving it.
3. **The plugin batches, and it batches last.** The Plugin Hub builds one immutable commit and cannot roll back. The server must accept a new contract version on production, verified, *before* any plugin sends it. Published: `0.3.0` / contract 3. Candidate `0.4.0` / contract 4 is prepared and deliberately unsubmitted. **Laurens submits, not the agent.**

---

## 1. The diagnosis

### 1.1 The plugin is shrinking

Measured against `api.runelite.net/pluginhub` on 2026-07-28:

| plugin | installs | rank |
|---|---|---|
| **scapestack-sync** | **7** — was 12 on 2026-07-26 | **2242 / 2403** |
| quest-helper | 583,710 | 1 |
| wikisync | 320,601 | 7 |
| inventory-setups | 226,125 | 24 |
| runeprofile | 88,547 | 80 |
| wom-utils | 80,568 | 90 |
| hub median | 1,017 | — |

Seven. Net **negative** across two days: people installed it and uninstalled it again.

Two causes, both structural rather than bad luck:

- RuneLite attaches a warning — *"submits your IP address and comprehensive account data to a 3rd-party server not controlled or verified by RuneLite developers"*. Warned plugins sit near a median of **149** installs against **1,686** for unwarned ones. The `"Turn everything on"` button at `ScapestackSyncPanel.java:207` flips four settings in one click, including bank transmission. That is what a Hub reviewer reads as a dark pattern, and it is why the warning is fair.
- The panel a player gets after installing shows four cards: sync status, connect browser, what syncs, troubleshooting. All plumbing. Nobody installs a plugin to be told it is working.

**Consequence for every design decision below:** any flow that assumes the plugin is installed has failed for 2,396 of 2,403 plugins' worth of players.

### 1.2 Jagex already does the headline feature, in the client

The Activity Adviser has shipped to all accounts since **8 September 2022**. It recommends activities from stats and quest progress. Its quest table entry for Animal Magnetism reads *"Learn how to equip Ava's ranged devices."* That is, in substance, what `/next` offered a 200m account.

Zero install friction, zero alt-tab, zero typed name.

### 1.3 The flow *is* the dashboard

Measured in the repo on 2026-07-28:

| | |
|---|---|
| Stranger → answer | homepage (pitch + input + demo table) → `/next?rsn=` → spinner → result |
| The result | **45 sections/regions** in one **238 KB** file, `next-client.tsx` |
| Steering beside the answer | **8 moods × 4 time budgets** — configuration *before* the answer |
| Returning player | 3 stations: welcome block → button → `/next`, while `/u/[rsn]` exists as a **second** account page |
| Another question | `/bank`, `/dps`, `/goals` each with their **own intake** — four times telling one site who you are |
| Accent | **49** orange uppercase labels where Wise Old Man has zero (26 since swept) |

Wise Old Man has no dashboard problem because **nothing exists beside the player page**. `/players/lynx-titan` is one URL; everything about the account lives there under tabs that never ask who you are again. Identity as a header line with *"Last updated 27 minutes ago"* quietly beside it. Five equal stat boxes with no colour verdict. One dense table filling the page. One accent, blue, in three places: active tab, Update button, links.

### 1.4 Why nobody comes back

Four reasons, hardest first.

1. **The product is on the wrong screen.** Seven installs against 583,710. Quest Helper answers "what next" as the next click, in-client, at the exact moment the player is standing at their bank. Our answer costs an alt-tab, a typed name and a wait. In PR #12536 the RuneLite reviewers were told in-client recommendations were deliberately left out. That is not a rule — that is giving away the most valuable surface in the ecosystem and keeping the plumbing.
2. **It produces nothing anyone can show anyone.** Every durable OSRS tool makes a social object: WOM renders a rank on someone else's client and its group pages let clan officers see who is not pulling weight; RuneProfile makes a shareable card and is the **only** tool above 10,000 installs in the entire warned cohort. "What should I do tonight" is private by construction — the worst possible shape for word of mouth.
3. **It competes on the wiki's axis with the wiki's data.** Every data file comes from `oldschool.runescape.wiki` or `prices.runescape.wiki`. You cannot out-content your upstream: 17 money methods against a sortable 485-row table; 59 bosses against a wiki DPS calculator with 2,853 monster variants, hit distributions, TTK graphs and live gear import from the running client.
4. **The one honest return loop existed and was never shown.** Outcome reconciliation ran on every plugin sync and wrote verdicts to `outcome_match`; the plan page greeted a returning player with the same "DO THIS FIRST" whether they had hit their target or never left the bank. Shipped 2026-07-27 as `LastTripLine`. It still needs to reach the panel *inside* the game.

### 1.5 What already works — do not rebuild these

- **Wiki facts via the Bucket API.** `npm run wiki:sync` pulls 3,234 monsters, 5,698 equipment rows, 16,527 item ids, 227 quests. `npm run wiki:check` re-queries live and fails on drift. `src/lib/bosses.ts` types no numbers any more. This corrected **232 disagreements across 48 of 59 bosses** — Callisto 470→1000, Araxxor 460→1020, the Hueycoatl 700→2500 — and replaced two engine guesses with wiki facts (the Salve amulet was chosen by a regex over the boss *name*, so it went to Skotizo, a demon, and was withheld from Vet'ion and Calvar'ion, which are undead; the Scythe applied 1.75× to every target regardless of size).
- **Live GE prices.** `prices.runescape.wiki/api/v1/osrs/{latest,mapping}`, CORS open, verified from the page. Presence in `mapping` **is** tradeability.
- **The affordability engine.** `src/lib/bank-affordability.ts` prices the *gap* in a set against the coins in the bank. Live: *"14,500,000 gp banked. Ahrim's robeskirt — 1,572,490 gp. That finishes Ahrim's set."*
- **Confidence notation.** `decisionConfidence()` derives `measured` / `likely` / `guess` from provenance, so no field can be forgotten.
- **Bank leaks closed.** `/next` and `/quests/[slug]` redact *before* planning instead of after.

### 1.6 Already demolished — do not resurrect

Six ghost routes (`/gp`, `/ge`, `/quests`, `/skills`, `/diary`, `/hiscore`) → 308s from `next.config.ts`, no route components. The **Stack Score** (30% wealth on a log scale, 25% item count, 20% million-gp slots — three quarters of it measured bank size). The fabricated result card on the not-found screen. The parchment frame. Twelve dead colour ternaries where `--color-good` and `--color-warning` hold the same hex.

---

## Phase 0 — the honesty floor

**Why first.** Everything else is decoration on a false answer. This is also the smallest phase.

```
Read docs/SCAPESTACK-COMPANION-HUB-PROMPTBOOK-2026-07-28.md sections 0 and 1 before
touching anything. Repo: the git dir is `.repo-git`, so every git command needs
`--git-dir=.repo-git --work-tree=.`. The gate is `npm run ci:check`.

Task: stop the engine presenting guesses as facts. Two changes.

1. src/lib/next-up-quests.ts:58 reads
     if (completedQuestNames?.has(q.name.toLowerCase())) continue;
   Without the plugin that Set is undefined, the optional chain yields undefined, that
   is falsy, and NO quest is skipped — every quest in the game reads as not done. This
   is why /next told a 200m-XP-in-every-skill account to "Finish Skill capes" and to
   "Get Ava's device", and why a 200m Herblore account got Druidic Ritual at 96/100.

   Fix: a quest whose completion cannot be verified must not be offered as an action.
   Do not silently drop it either — turn the gap into a QUESTION. "Have you done Dragon
   Slayer II?" with yes/no, answer persisted locally, at most three at a time, and
   those answers feed the same completedQuestNames set. That is simultaneously the
   onboarding the plugin currently has to be.

2. Delete the string "This best matches your visible account progress" —
   src/lib/recommendation-decision.ts:357, the `visible_progress_fit` case. Do not
   replace it with another reassuring sentence. When there is no fact, the confidence
   notation already prints "Best guess" and the source line already explains why.

Write the test FIRST and show it red: assert a maxed account with no plugin is not
offered a quest it has obviously completed. Then fix, then show it green.

Gate: `npm run ci:check`. Commit when green; never push red.
```

**The trap.** Making unverifiable quests unavailable removes recommendations for the ~40% of visitors with no plugin and no WOM build string. If the engine then has nothing to say, that is the *correct* output and the question flow is the answer — do not backfill with a softer guess. If Codex reports "no recommendations for a stat-only account", that is the phase working, not failing.

**Done when.** A maxed account with no plugin is never told to do a quest it finished in 2007, and `recommendation-decision.ts` contains no sentence that sounds like a fact when there is none.

---

## Phase 1 — one URL is the product

**Why here.** Every block already exists, spread over six URLs. Until they are one page, each later phase has to be built two or three times.

```
Task: build the single player page at /p/[rsn].

Every block below already exists. This is consolidation, not new features. Assemble
top to bottom:

  header      name · account type · "synced 18 min ago" · one Sync button
              (from src/app/u/[rsn]/page.tsx)
  last trip   src/components/last-trip-line.tsx — already owner-gated
  the answer  the /next hero: confidence eyebrow, Start/Bring/Stop table, one action
  not this?   the /next alternatives table
  your bank   src/components/bank-affordability-panel.tsx
  account     the Skill/Level/XP/Rank table from /u/[rsn]

Then redirect /next?rsn= and /u/[rsn] to /p/[rsn]. Land this as ONE change: a
half-built third account page beside the existing two triples the problem. If you
cannot finish it, revert rather than leave three.

Hard rules:
- planning-context.ts redacts BEFORE planning. Never reorder that.
  tests/bank-never-leaves-server.test.ts stays green and must not be weakened — it is
  the guard for two live bank leaks that three source-grep guards missed.
- The confidence eyebrow ("Do this first" / "Best fit for your levels" / "Best guess"
  plus sourceLine) is tested; behaviour must survive byte-identical.
- No card-in-card. One radius, one panel tint, one table shape. The accent appears in
  at most three places per screen: wordmark, primary action, links.
  tests/one-scale-per-meaning.test.ts enforces the colour rules.
- next-client.tsx is 238 KB across 45 sections. Split it along the blocks above as you
  move them. Do not carry the monolith across.

Wise Old Man's player page is the model: identity as a header line with freshness
quietly beside it, then one dense table that fills the page. Look at
wiseoldman.net/players/lynx-titan if you need the reference.

Gate: `npm run ci:check`, and verify on `npm run build` + `next start` at 375px — the
dev server lies about SSR and rendering, which this repo has shipped as fact three
times. Where an existing test pinned the old route shape, update it and say which and
why. After every new guard: sabotage the thing it protects, confirm red, restore,
confirm `git status` clean. Report that proof.
```

**The trap.** Five source-grep guards in this repo have passed while the thing they guarded was broken, and **four of them actively protected the defect** — one pinned `"Start here"`, the eyebrow of a *fabricated* result card. When Codex says "test added", ask for the sabotage result. `expect(source).toContain("some string")` pins an implementation, not a behaviour.

**Done when.** One URL per player. Zero routes that ask for a name the site already has.

---

## Phase 2 — configuration after the answer

**Why here.** Cheap once Phase 1 exists, and it removes the last thing between a player and their answer.

```
Task: stop asking the player to configure before answering.

src/lib/mood.ts exposes 8 moods × 4 time budgets, and the result page surfaces them as
steering beside the answer. A player who wanted to pick a mood would not have needed a
recommendation engine — and the community uses "efficiencyscape" as an insult, so
being asked to choose a mood reads as being managed.

Change: the default answer renders immediately, with no mood or time selection visible.
"Not this?" is the only steering and it sits BELOW the answer. Mood and timebox become
a refinement of an answer that already exists, never a precondition for getting one.

Keep the engine's mood/timebox inputs. Only the UI order changes. Do not delete the
mood system and do not add a settings page.

Also: add a Hide control to every alternative row, and make it stick. The most upvoted
tool of this shape on r/2007scape (osleague.tools, 2,464 upvotes) had exactly one
most-requested feature — the ability to delete the author's own suggestions.

Gate: `npm run ci:check`. Several tests pin the current picker; update them to pin the
new order and list which.
```

**The trap.** "Not this?" must not become a mood picker with a new name. It offers concrete alternatives with real copy — a boss, a quest, a set — not adjectives.

---

## Phase 3 — the bank over time

**Why here.** This is the moat's moat, and it is the first phase that adds something no competitor can copy. It needs Phase 1's single page to have somewhere to live.

```
Task: build what nobody else can.

The plugin syncs the bank every session. `sync_snapshot` stores them and
src/lib/account-snapshot-delta.ts already diffs two. One snapshot says what a player
HAS; a series says what they DO.

No competitor can do this, and the reason is structural: a bank is mutable per-account
state and the wiki is a document store. The wiki has every item and no idea what is in
yours. WOM and TempleOSRS track XP and KC. WikiSync (320,601 installs) sends quests,
diaries and collection log. Jagex's Activity Adviser reads stats and quests. None of
them see a bank, and none of them ever will.

Build a module that reads the snapshot series and emits observations, each carrying the
arithmetic in player voice. Start with these four — all derivable from data already in
Postgres:

  dead stock       "8,000 Zulrah's scales, untouched for three weeks. That is a
                    blowpipe you have not made."
  real habits      "Your ranarr stock dropped 400 since Tuesday."
  price movement   "40 items in your bank moved up 12% while you were away: 2.1m."
  bought, unused   "You bought Vorkath supplies four times and gained no KC."

Rules:
- No observation without the numbers behind it. A first sync produces no observations,
  ever — if the series is too short, emit nothing and say so.
- Owner-gated at the same layer as the bank redaction: these summarise synced bank
  contents, so shipping one to a stranger leaks through the summary what the redaction
  withholds in the raw. Add the assertion to tests/bank-never-leaves-server.test.ts.
- On /bank, prices are fetched by the BROWSER. That page promises "Saved on this device
  only" and a pasted bank has never touched Postgres; routing it through the server to
  price it would break that promise for a feature nobody asked to pay for.
  prices.runescape.wiki serves CORS — verified.
- Rank by actionability, not by novelty. "You have 8k scales" beats "your total went
  up".

Tests must be able to fail: build a two-snapshot fixture, assert an observation, then
flatten the fixture and assert silence.

Gate: `npm run ci:check`.
```

**The trap.** A hollow fixture is as bad as a hollow assertion. The bank-leak guard in this repo passed twice for nothing: first `bankStatus` was a string instead of a `PluginBankStatus` object, then `capturedAt` was epoch and read as stale — both times the bank never entered the planner and the assertion tested an empty plan. Check that the fixture actually reaches the code under test before trusting a green.

**Done when.** Two snapshots produce a sentence with real numbers; one snapshot produces silence; a stranger gets neither.

---

## Phase 4 — join the wiki to the player

**Why here.** The sharpest single argument that Scapestack is one product rather than six, and it needs the bank spine from Phase 3.

```
Task: make the wiki's own money-making guide personal.

The wiki publishes ~485 money methods with requirements in the Bucket table
`money_making_guide`. It cannot filter them by what YOU own — it has no idea. We can,
and do not. `src/lib/goals.ts` says out loud that it chose untradeable goals partly
because "they don't fluctuate with GE prices"; that was sensible for a static table and
it is exactly why the product never asked the only question it owns.

1. Add `money_making_guide` and `recommended_equipment` to scripts/wiki-sync.mjs,
   following the existing pattern exactly.
   - Check each bucket's real schema first: oldschool.runescape.wiki/w/Bucket:<Name>.
     Do NOT assume field names. `infobox_bonuses` has no version_anchor and uses
     page_name, not item_name — assuming otherwise cost a run.
   - Cargo and SMW are disabled on this wiki; Bucket is the API. Query shape:
     api.php?action=bucket&format=json&query=bucket('x').select('a','b').limit(500).offset(0).run()
     Names lowercase, spaces become underscores, paging is offset-based, send a
     descriptive User-Agent.
   - `npm run wiki:check` must pass afterwards. It re-queries live and fails on drift,
     which is what makes a stale snapshot a red build rather than a wrong answer.

2. Project it onto what an account can actually start: join requirements against levels,
   the bank, and live GE prices. The FILTER is the headline, not the list:

     "Of 485 money methods, 12 you can start right now with what is in your bank."
     Zulrah — 3.4m/hr — blowpipe, darts, antivenom+ all in bank. Missing: nothing.

3. An Ironman sees no ranking driven by buyable inputs. Reuse the `cannotBuy` shape
   already built and tested in bank-affordability-panel.tsx rather than inventing a
   second account-type branch.

Do NOT build a GP/hr table. The wiki has one, sortable, and it is better. Build the
filter that the wiki structurally cannot.

Gate: `npm run ci:check`.
```

**The trap.** Do not invent a heuristic inside the code whose whole job is to stop inventing heuristics. The version-picking rule in `wiki-project.mjs` was first written as "take the row with the most hitpoints" — it selected **Awakened Vardorvis**, 1400 HP, combat 1136, an optional superhard mode almost nobody fights. The wiki marks its own `default_version`; use the wiki's answer, not a plausible-sounding rule.

**Done when.** A number appears on screen that is the count of *startable* methods, and that count changes when the bank changes.

---

## Phase 5 — the tools become sections

**Why here.** Once the bank is loaded once, there are no four tools — there are four questions about one bank. Doing this before Phase 1 would mean rebuilding it after.

```
Task: /bank, /dps, /goals and /slayer stop being destinations.

A player currently tells the same site who they are four times. Once the bank is loaded
on /p/[rsn], these are four questions about one bank:

  Bosses  which bosses this bank can kill        src/lib/boss-viability.ts
  Sets    what this bank can finish              src/lib/bank-affordability.ts
  Task    the current Slayer task                /slayer
  Money   which wiki methods are startable now   Phase 4

Render them as sections/tabs of /p/[rsn] on the SAME URL with no second intake
anywhere. /dps, /slayer and /goals redirect to the matching section. /bank keeps a
paste intake — and only that — for a player who arrives with no name.

Do not duplicate the identity header per section. Do not add per-section spinners; the
page has one.

While you are in /dps: the missing-item reason must never be the truncated part. Labels
may truncate, answers may not. "Missing Anti-dr…" was shipped in a 119px cell.

Gate: `npm run ci:check`, plus a check on `npm run build` + `next start` at 375px that
no section overflows horizontally and no table truncates an answer.
```

**The trap.** The browser pane can report `document.visibilityState === "hidden"`, and a React streaming reveal will not have painted. A DOM query then finds nothing and reads exactly like a broken page. Wait for the content, not for the load event.

---

## Phase 6 — the homepage disappears for people we know

**Why here.** Last of the site phases, because it is the only one that is purely subtraction and it depends on `/p/[rsn]` existing.

```
Task: cut the homepage to one sentence, one input, one button.

Wise Old Man's homepage is one line, one field, one button called Track, a sidebar of
products, and four proof statistics. That is the target.

- Logged out: headline, one line of what it does, the name field, the button. Nothing
  else. The build-time demo specimen goes — "here is what someone else's account looks
  like" is not why anyone typed their own name.
- Known account: no homepage at all. Redirect straight to /p/[rsn]. The current welcome
  block is an extra station between a site that already knows the answer and the answer.

src/components/hero-intake.tsx carries both states plus two modals. Strip it to the
logged-out form; the remembered-account branch is deleted, not restyled.

Gate: `npm run ci:check`. On a production build, confirm a first-time visitor and a
known account each reach an answer in ONE navigation.
```

**The trap.** The remembered-account branch of `hero-intake.tsx` was the last surface still wearing the pre-direction-B parchment frame, and the guard that should have caught it asserted the frame class was absent from `page.tsx` while the frame lived one component down. Guard the component that renders, not the page that imports it.

---

## Phase 7 — the plugin batch

**Why last.** One immutable Hub commit, no rollback. Everything the plugin might send has to be accepted by production first, and the site has to be worth syncing to before the plugin is worth installing.

```
Task: rebuild the RuneLite panel so it is worth installing on its own.

Context you must respect: scapestack-sync is at 7 installs, rank 2242 of 2403, down
from 12 two days ago — net negative. Quest Helper has 583,710 and answers the same
question inside the client. Jagex's own Activity Adviser has done stats-and-quests
recommendations in-client since September 2022, with zero install friction.

1. Replace the panel body with the ANSWER, at PluginPanel.PANEL_WIDTH = 225px:

     NOW
     Vorkath
     Blowpipe + dragon darts are in your bank.

     Stop at       20 kills
     Now           7 / 20
     Left          ~34 min

     herbs ready in 12 min · birdhouses ready

     [ Something else ]

   The farming and birdhouse timers are already read from RuneLite's Time Tracking
   store by FarmingTimerReader and written to Postgres. The planner has never read
   them — the only consumer is plugin-sync-diagnostics.ts. Put them on screen here.

2. Delete the "Turn everything on" button (ScapestackSyncPanel.java:207). One click
   flipping four settings including bank transmission is what a Hub reviewer reads as a
   dark pattern, and it is why the account-data warning is fair. Replace with a single
   "Sync on login" toggle.

3. Read github.com/runelite/plugin-hub's contribution rules and determine exactly which
   transmitted fields trigger the account-data warning. Report whether sending less
   removes it. Warned plugins sit near a median of 149 installs against 1,686 unwarned —
   if the warning is removable, that is worth more than any feature in this phase.

4. The bank is the unique asset and the plugin is the only thing that sees it live. What
   can it say the moment a player opens their bank? "Robeskirt is 1,572,490. You have
   14,500,000. That finishes Ahrim's." — in-client value with no website at all.

5. Answer explicitly: what is the smallest version of this plugin that is worth
   installing with NO website? If the honest answer is "none", say so.

Mark every proposal with whether it needs a contract bump. Candidate 0.4.0 / contract 4
is prepared and deliberately unsubmitted. Do NOT submit anything to the Plugin Hub —
Laurens submits.

Gate: `cd plugin && ./gradlew test --offline` and `npm run ci:check`.
```

**Already fixed, unpublished.** `notifyChat("Scapestack is syncing your progress...")` fired before *every* sync, with the scheduler on a 15-minute delay and `chatFeedback` defaulting true — roughly sixteen game messages an evening announcing a background HTTP request, in the chatbox a player is reading for drops. Manual syncs only now.

---

## Phase 8 — the one shareable thing

**Why last-but-optional.** It is the only growth mechanism available to a product whose core output is private, and it costs almost nothing once Phase 3 exists.

```
Task: build one shareable object.

RuneProfile is the only tool above 10,000 installs in the entire warned-plugin cohort,
and what it makes is a shareable card — not a plan. "What should I do tonight" is
private by construction, which is the worst possible shape for word of mouth in this
community.

The one artefact we can make that nobody else can: "What my bank can finish." An
OpenGraph image rendering the affordability table — sets, missing pieces, cost, verdict
— for a given account. A player pastes it in their clan Discord and no other tool in
the ecosystem can produce it.

Rules:
- Owner-gated to generate, public only if the owner explicitly opts in per-image. Never
  make an account's bank shareable by default. src/app/share/trip/opengraph-image
  already exists as the pattern.
- Real numbers only. A fabricated share card would undo everything Phase 0 fixed.
- No item names in the URL. No bank contents in a query string.

Gate: `npm run ci:check`.
```

---

## Working rules

**A guard that cannot fail is not a guard.** Five source-grep guards in this repo passed while the thing they guarded was broken, and **four actively protected the defect** — one pinned `"Start here"`, the eyebrow of a fabricated result card; two pinned `bankItems: serverBankItems`, the line that leaked the bank, as though it were the desirable half. After every new guard: sabotage the thing it protects, confirm red, restore, confirm `git status` is clean. Report the proof.

**Verify against something that can produce a negative.** A deploy check that polls for HTTP 200 approves the previous build. A leak check against an account with no snapshot proves nothing. A database check with a fresh row never exercises `ON CONFLICT`. All three happened here.

**Anything about SSR, caching or what actually renders is only true on `npm run build` + `next start`.** The dev server lies. Shipped as fact three separate times.

**A dead agent reads exactly like "nothing found".** On any fan-out, check for agents that died before believing a clean result. In the 2026-07-27 audit the skiller/pure archetype agent died — **that account type is still unanalysed**, and the account-type work has a hole in it that must not be mistaken for coverage.

**A migration that reads a new column backfills it in the same commit.**

**One scale per meaning.** `--color-good`/`--color-warning` are byte-identical, as are `--color-danger`/`--color-bad`. Never branch between two of them — the conditional renders the same pixel and reads like a working traffic light. Every verdict goes through `.scape-verdict[data-gate]`.

**Voice.** No AI language, ever. Banned: *seamless, powerful, effortless, elevate, empower, intuitive, robust, streamline, transform, journey, ultimate, unleash* — plus *vibe*, *session* and *tonight*. The word for a trip is **trip**. Dry, second person, quantified. Count in ticks, trips, KC and multiples of drop rate — never "hours saved". Full list with sources in `docs/design/SCAPESTACK-DESIGN-SYSTEM.md`.

---

## Appendix A — the APIs, with working queries

**OSRS Wiki Bucket** — no key, no auth. Cargo and SMW are disabled on this wiki.

```
https://oldschool.runescape.wiki/api.php?action=bucket&format=json
  &query=bucket('infobox_monster').select('page_name','hitpoints','attribute','size')
         .where('page_name','Vorkath').run()
```

47 tables. We use four. The nine that would make the product one thing:

| table | what it joins |
|---|---|
| `money_making_guide` | 485 methods the wiki cannot filter by what you own |
| `recommended_equipment` | the wiki's own gear pick per boss, against your bank |
| `combat_achievement` | CA tasks (built by hand in Wave 1) |
| `collection_log_source` | what drops what, against what you own |
| `dropsline` + `drop_table_sources` | drop rates; currently 113 KB of hand-kept JSON |
| `quest.official_length` | literally the answer to "does this fit in 60 minutes", which we guess |
| `quest.ironman_concerns` | the Ironman gap every tool has |
| `quest.start_point` | our "START" line, written by the wiki instead of by us |
| `varbit` | for the plugin |

**Prices** — `prices.runescape.wiki/api/v1/osrs/{latest,mapping}`. CORS open. `mapping` is the tradeable universe; presence in it is tradeability. Quote the insta-buy side (`high`) — that is what a player pays tonight.

**Not yet touched.** WOM's API (`api.wiseoldman.net`) for gains, records, groups and competitions — dependency and competitor at once; we read only `lastChangedAt`. Hiscores `index_lite.json` — the 900 ms deadline in `PLANNING_SOURCE_DEADLINES_MS` is too tight: Jagex measures 400–720 ms from a residential line and we run from shared Vercel egress, and on timeout `runBoundedSource` returns the same `null` as a genuine 404 while `loadPlanningContext(...).catch(() => null)` renders the demo fixture under the player's real name.

---

## Appendix B — known gaps, named so they are not mistaken for coverage

- **The skiller/pure account type is unanalysed.** Its agent died mid-run.
- **The Ironman gate on `/bank` is built and tested but not wired.** The only "ironman" in scope at the call site is `smartTidyPrefs.playstyle`, a bank *tidy preset* the player picks — wiring a money claim to that signal would take a main's GP column away. It needs the synced `accountType` threaded to `/bank`.
- **`maxEstimate.totalHours` is computed and never rendered.** Dead weight, not a visible defect. "GP/hour" and "bars/hour" stay — those are how players talk; the voice rule is about "hours saved" as a value claim, not about rates.
- **Return analytics need data.** `scripts/return-report.mjs` measures whether routes bring people back and has nothing to measure yet.
