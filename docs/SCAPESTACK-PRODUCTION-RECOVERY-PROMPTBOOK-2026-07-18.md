# Scapestack Production Recovery Promptbook

Status: active execution controller
Created: 2026-07-18
Baseline commit: `2dd61b7`
Baseline product score: 5.2/10
Target product score: at least 8.8/10, with no core category below 8.0
Execution pointer: `REC-02`

This file is the controller for recovering Scapestack from a locally green but
production-incomplete state. It does not replace the product ideas in
`docs/SCAPESTACK-90-PLUS-MASTER-PROMPTBOOK-2026-07-15.md`. It overrides that
file's completion claims whenever real production evidence disagrees with
them.

The recovery program has one standard of truth:

> A phase is not complete when a component works alone. It is complete when an
> OSRS player can experience the promised behavior through the real product.

The target loop is:

```text
RuneLite observes progress
  -> Scapestack receives a complete, versioned snapshot
  -> one stable account identity owns that snapshot
  -> Scapestack notices the meaningful change
  -> the recommendation changes for a factual reason
  -> the player can start one bounded trip
  -> later progress closes that trip automatically
  -> the return screen proves what changed and offers the next trip
```

---

## 1. The `ga door` Controller Contract

When the user says `ga door`, follow this protocol exactly.

1. Open this file and read the latest user message.
2. Check the worktree before touching files. Preserve unrelated user changes.
3. Find the phase marked `IN PROGRESS`. If none exists, select the first `TODO`
   phase whose dependencies are `DONE`, or `WAITING EXTERNAL` with all local
   contract work proven.
4. Read the named code, tests, production evidence and previous phase evidence.
5. Mark the selected phase `IN PROGRESS` before implementation.
6. Implement the smallest complete vertical slice that advances that phase.
   Do not spend a turn only proposing code when the code can be written.
7. If the phase is larger than one safe turn, leave it `IN PROGRESS`, record the
   completed milestone and continue that same phase on the next `ga door`.
8. Run the phase-specific verification and the global gate.
9. For player-facing work, inspect real desktop and mobile screenshots and fail
   on console errors, unauthorized requests, overflow, overlap or empty primary
   states.
10. Mark a phase `DONE` only when all behavioral acceptance criteria are proven.
11. Append evidence using the template in section 8.
12. Stage only files belonging to the phase. Never stage unrelated dirty files.
13. Commit and push `main` after a completed phase unless the user says not to.
14. Report what changed, what was proven and which phase comes next. Then stop.

If an external Plugin Hub review is the only remaining condition, mark the
phase `WAITING EXTERNAL`, record the URL and continue with the first independent
`TODO` phase on the next `ga door`. Do not call an external review delay a code
failure.

### Status Values

- `TODO`: not started.
- `IN PROGRESS`: active; the next `ga door` continues this phase.
- `WAITING EXTERNAL`: all local work is proven; an upstream action is pending.
- `BLOCKED`: the same blocker remained after three real attempts and no other
  meaningful progress is possible.
- `DONE`: implementation, behavioral proof, evidence, commit and push complete.

`WAITING EXTERNAL` may satisfy a dependency for subsequent local implementation
when its evidence proves the required local contract. It never satisfies the
final production launch gate in REC-19.

### Scope Rules

- Do not edit the older master promptbook unless a phase explicitly requires a
  historical correction.
- Do not stage or revert unrelated changes.
- Do not solve product gaps with more explanatory copy.
- Do not add dashboards to expose internal intelligence.
- Do not call mocked UI data end-to-end proof.
- Do not call an HTTP 200 a successful player experience.
- Do not claim exact account knowledge when a field is missing or unavailable.
- Do not publish a plugin version until the website, standalone repository and
  Plugin Hub artifact agree on its contract.

---

## 2. Evidence Hierarchy

When evidence conflicts, use this order from strongest to weakest:

1. A real installed Plugin Hub build syncing a real account into production,
   followed by a real browser return flow.
2. A production deployment using real persistence and a test RuneLite client.
3. A local production build using the real database and real Java plugin.
4. A deterministic integration test spanning API, persistence and browser.
5. A Playwright story with mocked network data.
6. Unit and component tests.
7. Type correctness and build success.
8. Implementation notes or visual inspection without behavior.

Lower-level evidence is still required, but it may never overrule a failure at
a higher level.

### Definition Of A Real Sync Proof

A sync proof must record:

- plugin version and artifact commit;
- claimed account identity;
- server response and persistence result;
- snapshot availability for skills XP, quests, diaries, collection log, Slayer,
  boss KC and bank;
- browser session identity;
- rendered progress or explicit honest unavailable state;
- recommendation before and after the snapshot;
- no unauthorized or unhandled browser requests.

---

## 3. Current Production Baseline

The 2026-07-18 audit established the following facts.

### What Works

- `npm run ci:check` passed.
- 1,344 Vitest tests passed.
- Typecheck, smoke and the 217-page production build passed.
- Playwright passed 23 stories with one intentional desktop skip.
- Java plugin unit tests passed.
- A real Java plugin -> API -> Neon test passed all 10 claim, auth, conflict and
  sync scenarios.
- The production deployment was ready and production logs contained repeated
  `POST /api/sync 200` responses.
- The live Wiki price and bank smoke passed.

### What Does Not Work Well Enough

- The real Lauky snapshot came from plugin `0.2.0`, while the main repository
  advertises `0.3.0`.
- The real snapshot had 24 skill levels but no XP values, 207 quests, 20 diary
  records, no boss KC, no collection log, no bank, an unresolved Slayer task ID
  and no meaningful latest delta.
- The browser saved Lauky locally but `/api/account/timeline` and
  `/api/account/decision` returned `401` without the separate pairing cookie.
- The homepage could say `RuneLite refreshed` while it could not display a
  meaningful RuneLite change.
- The real `/next` result was a generic Cooking maxing lane with Farming 99 and
  60 Expert ToA KC as alternatives despite missing bank and boss context.
- The Playwright RuneLite stories used mocked connection and timeline data.
- `ci:check` did not run Playwright or the real Java end-to-end test.
- The live release checker inspected stale PR state and did not truthfully
  describe the current Plugin Hub master pin.
- `src/app/next/next-client.tsx` remained 5,867 lines.
- `getSyncedPlayer` converted database failures into a generic missing-player
  result after logging only `getSyncedPlayer failed`.
- The primary `/next` flow still contained a donation block.

### Baseline Scores

| Category | Baseline | Target |
| --- | ---: | ---: |
| Core promise | 7.0 | 9.2 |
| Visual branding | 7.0 | 9.0 |
| Homepage and onboarding | 6.0 | 9.0 |
| Mobile and responsive behavior | 8.0 | 9.2 |
| Recommendation relevance | 4.0 | 9.0 |
| Account-specific proof | 3.5 | 9.0 |
| Return loop | 2.5 | 9.0 |
| RuneLite transport and auth | 8.5 | 9.5 |
| Live plugin data completeness | 3.0 | 9.0 |
| Plugin player UX | 5.0 | 9.0 |
| Identity and persistence | 3.0 | 9.0 |
| Reliability and observability | 5.0 | 9.0 |
| Automated test breadth | 7.0 | 9.0 |
| Real integration coverage | 4.0 | 9.5 |
| Maintainability | 4.0 | 8.5 |
| Reddit and launch fit | 5.0 | 9.0 |

---

## 4. Product Contract

Scapestack is an OSRS session companion, not a tracker dashboard.

### First Visit

1. Enter one RSN.
2. Pick a mood and available time.
3. Receive one credible trip immediately.
4. Add RuneLite or bank only when it changes the answer.

### Return Visit

1. See one meaningful change since the last visit.
2. See whether the previous trip moved, completed or became a bad choice.
3. Receive one next trip based on the new state.
4. Never manually re-enter the same RSN or reconnect an already connected
   account.

### Recommendation Contract

Every primary recommendation must provide:

- one concrete goal;
- one account-specific reason that can be traced to observed data;
- one first click or first in-game action;
- one bounded stop point;
- owned gear or supplies only when known;
- one honest caveat when important context is unavailable;
- zero contradictions with mood, account mode, requirements or completed work.

At most two alternatives may be visible. They must be meaningfully different,
viable for the account and compatible with the selected mood.

### RuneLite Contract

RuneLite is silent intelligence. It should make Scapestack say things like:

- `You gained 376 Cooking XP since the last scan.`
- `25 Gargoyles left on your task.`
- `Dragon Slayer II is done, so Vorkath is now available.`
- `Your bank now covers this trip.`

It should not make Scapestack show payloads, readiness panels, internal source
labels or version diagnostics in the primary player flow.

### Design Contract

- Near-black, white and restrained OSRS gold remain the core palette.
- Use old-school serif display type only for meaningful headings.
- Use large OSRS objects, bosses, rewards and item sprites as the visual anchor.
- One primary object and one primary action per viewport.
- Setup actions are modal or bottom-sheet flows; play decisions are pages.
- No nested cards, KPI grids, status rails or large empty decorative sections.
- Mobile is the default composition, not a compressed desktop layout.
- Technical and privacy details remain available, but never above the main
  player action.

---

# Recovery Program A - Make The Real Data Path True

## REC-00 - Freeze And Prove The Baseline

Status: DONE
Depends on: none
Improves: truthfulness of the entire program

### Completed Evidence

- Full local CI, Playwright, Java unit tests and live smoke were executed.
- A production build and real Java plugin were tested against Neon.
- Production deployment and sync logs were inspected.
- The real Lauky snapshot and real browser behavior were inspected.
- The visual homepage and `/next` output were captured at desktop size.
- The audit found the plugin version split, account-session `401` responses,
  missing live fields, generic recommendations and false confidence from mocked
  product stories.

No completion claim from the old promptbook may overrule this baseline.

---

## REC-01 - Make Plugin Release State Truthful

Status: DONE
Depends on: REC-00
Improves: plugin distribution, operational trust

### Prompt

```text
Create one truthful RuneLite release contract across the main repository,
standalone plugin repository and Plugin Hub master.

Inspect:
- plugin/runelite-plugin.properties
- plugin/build.gradle
- scripts/check-plugin-release.mjs
- src/lib/plugin-version.ts and all current-version constants
- the standalone Scapestack plugin repository
- the current Plugin Hub master entry, not only an old merged PR

Build:
1. Define one canonical release manifest containing semantic version, contract
   version, source commit and minimum supported website contract.
2. Make the release checker compare the main plugin, extracted standalone
   artifact and actual Plugin Hub master pin.
3. Make stale PR metadata informational rather than the source of truth.
4. Fail on version, source or contract drift.
5. Produce machine-readable release evidence.
6. Pin the RuneLite dependency instead of `latest.release`, unless current
   official Plugin Hub guidance requires a different reproducible mechanism.
7. Document the exact extract, test, commit and Plugin Hub update sequence.

Do not publish yet if REC-02 changes the payload contract. This phase makes the
release path truthful and reproducible first.
```

### Acceptance

- Offline and live checks agree with GitHub primary sources.
- A deliberately stale standalone commit fails.
- A deliberately stale Plugin Hub pin fails.
- An old merged PR cannot create a false failure when master is current.
- Plugin source and website expected version have one owner.
- Gradle resolution is reproducible.

### Verification

```bash
npm run plugin:release-check
npm run plugin:release-check:live
cd plugin && ./gradlew clean test
```

### Evidence

- Completed: 2026-07-18
- Status: DONE
- Commit: `ef2f930`
- Push: `origin/main` advanced from `2dd61b7` to `ef2f930`
- Scope: added `plugin/release-manifest.json`; separated candidate `0.3.0`
  from published `0.2.0`; made player-facing version checks follow the
  published artifact; made Gradle read the candidate contract and lock the
  tested RuneLite `1.12.33` dependency graph; replaced stale-PR release truth
  with Plugin Hub master, pinned standalone artifact and standalone-main checks;
  added JSON evidence and corrected the exact publishing handoff.
- Tests added: stale Plugin Hub pin, untracked standalone commit,
  candidate-ahead state, Plugin Hub manifest parsing, JSON evidence parsing,
  manifest version ownership and dependency-lock coverage.
- Commands: `npm run ci:check` passed with 216 files and 1,346 tests;
  typecheck, smoke, release check and the 217-route production build passed;
  `cd plugin && ./gradlew clean test` passed the RuneLite Java suite;
  `npm run plugin:release-check:live` and
  `npm run plugin:release-evidence` passed; `git diff --check` passed.
- Real integration proof: the live checker read
  `runelite/plugin-hub` master, fetched the artifact pinned at
  `dafcfb495aa1221a273e6f0e03d6aff5f2f41b92`, resolved standalone `main` with
  `git ls-remote`, read its `0.2.0` properties and compared official RuneLite
  Maven release `1.12.33`. All published comparisons returned zero failures.
- Browser proof: no layout changed in this phase. Web behavior is protected by
  tests proving the installable `0.2.0` artifact is no longer mislabeled as
  outdated while reviewer copy still targets candidate `0.3.0`.
- Production proof: Plugin Hub master and standalone `main` both point to clean
  published commit `dafcfb4`; historical PR `#12536` is informational and can
  be unavailable or stale without failing a correct master state.
- Score movement: reliability and observability `5.0 -> 5.8`; release truth is
  now machine-verifiable, while the incomplete live snapshot still limits the
  overall product score.
- Residual risk: candidate `0.3.0` is intentionally not published; REC-02 must
  finish and prove its payload first. Gradle reports existing deprecated API and
  Gradle-10 compatibility warnings.
- Next phase: `REC-02`

---

## REC-02 - Complete And Ship The RuneLite Snapshot Contract

Status: TODO
Depends on: REC-01
Improves: live plugin data completeness, recommendation relevance

### Prompt

```text
Finish the plugin snapshot before publishing the next release.

The website needs explicit availability plus values for:
- skill levels and XP;
- quest completion;
- diary completion at useful task granularity where RuneLite exposes it;
- collection-log coverage and item IDs;
- Slayer task name, ID, location, remaining count, streak, points and blocks;
- boss KC;
- account mode;
- optional bank item IDs and quantities;
- captured-at timestamps per domain when they differ.

Implement:
1. Add missing boss KC extraction through supported RuneLite APIs. Never scrape
   widgets or infer zero when unavailable.
2. Resolve Slayer task names and locations where supported; represent unknown
   explicitly.
3. Send XP as exact integers and protect maxed/virtual-level behavior.
4. Distinguish `available`, `unavailable`, `permission-off`, `not-loaded` and
   `unsupported` for every optional domain.
5. Preserve bank opt-in and privacy. Add a gentle migration path for existing
   users whose old version left bank sync off.
6. Keep payload size bounded and reject malformed or impossible values.
7. Add contract fixtures generated by the actual Java serializer and consumed
   by TypeScript schema tests.
8. Publish the completed version to standalone and submit/update Plugin Hub.

Do not use a field merely because the API accepts it. Prove the installed
plugin can populate it or mark it unavailable honestly.
```

### Acceptance

- A real test account snapshot contains XP and supported boss KC.
- Slayer task name is present when RuneLite knows it.
- Missing collection-log or bank data is never shown as an empty completed set.
- Java and TypeScript agree on the exact contract fixture.
- Payload/auth/claim limits remain green.
- The standalone source and Plugin Hub submission point to the tested artifact.

### Verification

```bash
cd plugin && ./gradlew clean test
npm test -- plugin-sync
npm run plugin:release-check
npm run plugin:release-check:live
```

Also run the real Java -> local production server -> Neon smoke and record the
persisted snapshot coverage.

---

## REC-03 - Unify Saved RSN, Plugin Claim And Browser Identity

Status: TODO
Depends on: REC-00
Improves: account continuity, return loop, trust

### Prompt

```text
Remove the split between a browser-local RSN and the server account session.

Current failure:
- the browser can say `Welcome back, Lauky` from localStorage;
- RuneLite can sync Lauky into player_sync;
- account timeline and decision routes still return 401 without a separate
  pairing cookie.

Build one progressive identity model:
1. An RSN remains enough for public Hiscores and a first plan.
2. When the plugin opens Scapestack, use an expiring one-time claim to establish
   the HttpOnly browser account session automatically.
3. Existing pairing-code recovery remains available for another device.
4. Migrate local mood, bank attachment and active plan to the stable account ID
   after connection.
5. Removing the account clears active local state and revokes that browser
   session without deleting server history.
6. Every account-scoped API returns typed reasons, not ambiguous 401 console
   noise.
7. The UI never says RuneLite is connected when the browser cannot access the
   connected account history.

Preserve claim-token security, SameSite cookies, expiry, replay protection and
RSN rename support.
```

### Acceptance

- Plugin opener -> website creates the browser session without manual RSN entry.
- A saved local RSN cannot impersonate the connected history.
- Homepage timeline and decision writes return 200 for the connected browser.
- A second unpaired browser cannot access private account history.
- Account removal and recovery work end to end.
- No 401 requests appear during a valid return flow.

### Verification

- API authorization tests.
- Browser cookie and one-time claim tests.
- Playwright stories for first device, second device, removal and recovery.
- Real plugin opener smoke against a production build.

---

## REC-04 - Preserve Meaningful Progress Instead Of Overwriting It

Status: TODO
Depends on: REC-02 and REC-03
Improves: return value, data truthfulness

### Prompt

```text
Make repeated auto-sync safe and make the last meaningful change durable.

Current risk:
- player_sync is a latest projection;
- identical/no-change syncs can leave the latest summary empty;
- the player then sees `No new progress` even when an earlier scan contained
  the progress that should close the current trip.

Implement:
1. Keep immutable account snapshots as the historical source of truth.
2. Deduplicate identical snapshots by stable checksum.
3. Update freshness on a no-change sync without erasing the latest meaningful
   delta or unresolved recommendation outcome.
4. Build a query for `progress since this accepted plan`, not merely `latest
   sync summary`.
5. Distinguish first baseline, no observed change, unavailable data, source
   correction and real progress.
6. Reconcile out-of-order and retried syncs idempotently.
7. Add retention and pruning rules that preserve useful facts without storing
   unnecessary bank history.

The homepage should never derive progress from one overwriteable summary field.
```

### Acceptance

- A progress snapshot followed by five identical scans still closes the plan.
- A no-change scan updates `last scanned` but preserves the meaningful recap.
- First sync is a baseline, not a fake zero-gain event.
- Missing XP or boss KC remains unknown.
- Concurrent retries create one snapshot and one outcome.
- Bank privacy constraints remain intact.

### Verification

- Repository concurrency/idempotency tests.
- Fixed snapshot-delta fixtures.
- Real database migration and rollback review.
- End-to-end accepted-plan -> progress -> repeated sync -> return recap test.

---

# Recovery Program B - Make The Recommendation Worth Trusting

## REC-05 - Add A Data-Coverage Gate Before Ranking

Status: TODO
Depends on: REC-02 and REC-04
Improves: recommendation honesty, account-specific proof

### Prompt

```text
Before ranking candidates, calculate what Scapestack actually knows for this
decision.

Create a typed planning context that distinguishes:
- observed and fresh;
- observed but stale;
- explicitly unavailable;
- never synced;
- local-only bank context;
- public Hiscores fallback;
- derived estimate with a named method.

Use the context as hard eligibility rules:
1. Do not headline raids or demanding bosses without requirements and a viable
   setup signal.
2. Do not claim bank shortages when bank data is unavailable.
3. Do not claim completed/unfinished quests from missing quest coverage.
4. Do not make KC commitment claims without boss KC.
5. Do not promote an active Slayer task when its task identity is unresolved.
6. Use a conservative public-data plan when richer context is missing.

Produce one player-safe caveat only when missing context could materially change
the trip. Keep internal coverage details out of the primary UI.
```

### Acceptance

- Lauky's old 0.2 snapshot cannot produce an Expert ToA headline or backup
  without independent viability proof.
- Unknown bank never becomes `no raw fish found`.
- Missing boss KC cannot become `you have experience here`.
- Fresh complete data can unlock richer recommendations.
- Every recommendation records the facts and exclusions used for testing.

---

## REC-06 - Rebuild Ranking Around Player Intent And Opportunity Cost

Status: TODO
Depends on: REC-05
Improves: recommendation relevance, mood integrity

### Prompt

```text
Revalidate every candidate family under hard player-intent constraints.

Required intents:
- Chill;
- AFK;
- Short;
- GP;
- Bossing;
- Unlock;
- Continue my route;
- Surprise me within my selected intent.

Ranking order:
1. Hard eligibility and safety.
2. Explicit mood and time contract.
3. Active commitments such as a known Slayer task or accepted route.
4. Near, meaningful unlocks with bounded work.
5. Proven account momentum such as committed boss KC.
6. Bank-supported opportunity.
7. Long arcs such as maxing only when the player chose that arc or is genuinely
   close.

Demote:
- 1-4 KC scouts;
- long prerequisite chains without a major payoff;
- Wilderness or raid content without explicit intent and setup proof;
- generic skillcape pushes far from 99;
- alternatives that are merely different labels on the same activity;
- repeated recommendations the player recently skipped.

Build deterministic diversity within the selected intent. Randomize changes the
route, never the contract.
```

### Acceptance

- Chill and AFK never return raids or high-attention bosses.
- Short fits the selected time bound including travel/setup overhead.
- Surprise me cannot escape the chosen intent.
- Active, fully identified Slayer work can beat a generic maxing lane.
- Repeated skips alter ranking without hiding the best factual option forever.
- Primary and two alternatives are viable and meaningfully different.

### Verification

- Golden accounts for early main, midgame main, late main, ironman, returning
  player, PvMer, skiller, active Slayer and incomplete plugin data.
- Property tests for mood/time hard constraints.
- A machine-readable audit that fails CI on any hard violation.

---

## REC-07 - Make Every Plan Prove Why It Won

Status: TODO
Depends on: REC-05 and REC-06
Improves: trust, clarity, Reddit fit

### Prompt

```text
Replace generic decision copy with a factual decision proof.

Every primary recommendation needs structured fields:
- goal;
- accountFact;
- decisionReason;
- firstStep;
- stopPoint;
- bring, when known;
- avoid, only when materially useful;
- whyNotNextBest, stored for diagnostics but normally hidden.

Good proof:
- `48 Vorkath KC makes 50 a clean stop.`
- `Your bank has 312 raw sharks, enough for about 65K Cooking XP.`
- `25 Gargoyles remain on your current task.`
- `One Karamja Hard task is left and it unlocks the gloves.`

Bad proof:
- `This best matches your visible account progress.`
- `This fits unlock and 60 minutes.`
- `RuneLite helped.`

Generate copy from structured facts, not title-specific conditionals spread
through React. Keep one proof sentence visible and deeper evidence on demand.
```

### Acceptance

- No primary recommendation uses a generic fallback when a concrete fact exists.
- If no concrete account fact exists, the plan says exactly which public fact or
  preference it used without pretending RuneLite depth.
- Proof cannot contradict bank, requirements, mood or stop point.
- Copy remains short on 360px mobile.
- Tests ban generic proof phrases from player-facing primary cards.

---

## REC-08 - Turn One Recommendation Into A Real Route

Status: TODO
Depends on: REC-06 and REC-07
Improves: depth, actual usefulness

### Prompt

```text
Make the selected trip calculable rather than descriptive.

For the selected stop point calculate:
- amount of XP, KC, tasks or items required;
- estimated time as a range;
- owned supplies and expected coverage;
- missing inputs;
- best available method from the account's context;
- a smaller fallback stop point when the full target is not practical;
- sourcing path for ironmen;
- buy list for mains, with honest price freshness;
- what the route unlocks next.

Skill examples:
- Cooking: raw food in bank, XP per item, amount cookable, amount still needed;
- Herblore: herbs, unfinished potions, secondaries and partial chains;
- Prayer: bones/ashes, method eligibility and banked XP;
- Smithing/Crafting/Fletching/Construction: complete material chains;
- Farming: seeds, patches, loop duration and next availability.

Boss examples:
- owned loadout;
- inventory and supplies for one trip;
- likely trip length range;
- missing high-impact upgrade;
- `not worth it yet` route when an unlock dominates gear spending.
```

### Acceptance

- Numbers reconcile with the parsed bank and current XP.
- Unknown data never becomes zero.
- Ironmen receive source -> process -> stop; mains receive owned -> buy -> trip.
- Route recalculates after a new bank or RuneLite snapshot.
- Every supported skill uses the shared model rather than bespoke UI copy.
- Boss inventory never exceeds game inventory constraints.

---

# Recovery Program C - Close The Return Loop

## REC-09 - Make Plan Start And Completion Durable

Status: TODO
Depends on: REC-03, REC-04 and REC-08
Improves: retention, learning

### Prompt

```text
Turn a recommendation into a durable decision lifecycle.

States:
- shown;
- accepted;
- started;
- progressed;
- completed;
- stopped early;
- skipped;
- invalidated by new account state.

Implement:
1. The primary CTA starts the trip with one click.
2. Persist the exact evidence and stop point used at decision time.
3. Reconcile later snapshots against that evidence.
4. Auto-progress and auto-complete when the data proves it.
5. Ask for one lightweight confirmation only when the plugin cannot observe the
   outcome.
6. Let the player stop or switch without punishment.
7. Use outcome history to avoid repeated bad suggestions, not to create opaque
   personalization.

Do not require the player to find a hidden `mark done` control for the normal
RuneLite-connected path.
```

### Acceptance

- A Cooking XP stop point completes from a later XP snapshot.
- A boss KC stop point completes from later KC.
- A Slayer task completes without misreading a reassigned task.
- Repeated syncs cannot complete twice.
- Unsupported outcomes ask one clear question.
- Cross-device browser sessions see the same active trip.

---

## REC-10 - Rebuild The Homepage As A Return Moment

Status: TODO
Depends on: REC-03, REC-04 and REC-09
Improves: homepage, return value

### Prompt

```text
Design the homepage around the player's current state, not a generic empty hero.

States:
1. First visit: RSN input, mood/time, one plan.
2. Public-only returning RSN: one fresh public-data plan and a quiet RuneLite
   upgrade path.
3. Connected, no meaningful change: show the active trip or one fresh trip;
   never imply failure.
4. Connected with progress: show one concrete change and the next action.
5. Completed trip: show the completion moment and the next bounded trip.
6. Sync failure: keep the last trusted plan and offer one fix.

Remove giant dead space. Use one relevant OSRS object or boss as the visual
anchor. Keep secondary setup actions inside the account menu or one compact
modal. Do not add a timeline dashboard.
```

### Acceptance

- A real Lauky return renders meaningful data or an honest actionable state.
- `RuneLite refreshed` is shown only when browser identity and usable snapshot
  state agree.
- No valid connected return flow emits 401 or console errors.
- Primary action is visible at 360x800 without scrolling.
- Desktop remains quiet without looking empty.
- No donation prompt interrupts the first useful loop.

---

## REC-11 - Rebuild `/next` Around One Playable Trip

Status: TODO
Depends on: REC-07, REC-08 and REC-09
Improves: `/next` UX, non-dashboard feel

### Prompt

```text
Turn `/next` into a playable session screen.

Above the fold show only:
- large OSRS object/boss/reward;
- `Do this first`;
- goal;
- one factual `Why for you` sentence;
- first step;
- stop point;
- start-trip CTA.

Below it show at most two large, fully clickable alternative routes. Put route
math, supplies and decision evidence in one intentional detail sheet, not a
stack of collapsed panels.

Remove:
- donation/support from the core decision flow;
- generic status labels;
- repeated `More`, `Details`, `Context`, `Ready` and `Setup` surfaces;
- toolbars that do not help start the trip;
- empty explanatory sections.

Use progressive disclosure, but do not hide the first action or stop point.
```

### Acceptance

- One primary route dominates every viewport.
- Backups are larger clickable choices, not miniature dashboard rows.
- No generic recommendation sentence remains.
- Route details open as a modal/bottom sheet and remain keyboard accessible.
- The page has no horizontal overflow at 360, 390 and 430px.
- No fixed controls cover content.
- The exact real recommendation is never clipped.

---

## REC-12 - Make The Plugin A Quiet Companion

Status: TODO
Depends on: REC-02, REC-03 and REC-09
Improves: plugin UX, activation

### Prompt

```text
Redesign the RuneLite panel around one job: keep Scapestack current.

Default panel:
- account name;
- last successful scan time;
- one sentence about what changed, when known;
- one primary `Sync now` action;
- one `Open next trip` action;
- a compact bank-sync toggle with clear privacy meaning.

Connection states:
- not connected;
- connecting through one-time claim;
- connected and fresh;
- connected but partial;
- stale;
- failed with one actionable fix;
- plugin update required.

Move diagnostics, endpoint details and raw coverage into an advanced section.
Auto-sync should be understandable and reliable without a panel of settings.
Use RuneLite-native interaction patterns and keep the panel compact.
```

### Acceptance

- First connection takes at most one plugin action and one website confirmation.
- A successful scan shows exact time, not `old` or a vague state.
- Partial bank/clog/KC availability is honest without a dashboard.
- Failure preserves the last success and names one fix.
- Panel unit/snapshot tests cover every state.
- Real RuneLite client inspection confirms no clipping at normal sidebar width.

---

# Recovery Program D - Make The System Reliable

## REC-13 - Stop Hiding Persistence And Sync Failures

Status: TODO
Depends on: REC-03 and REC-04
Improves: reliability, supportability

### Prompt

```text
Make every sync and account-history failure diagnosable without exposing
technical language to players.

Implement:
1. Typed repository errors for unavailable database, schema drift, auth failure,
   invalid payload, conflict and missing player.
2. Preserve error causes and structured request/account-safe correlation IDs.
3. Never convert a database error into `no sync found`.
4. Add structured logs for receive -> validate -> claim -> persist -> snapshot ->
   outcome reconciliation.
5. Add counters for sync success, partial snapshots, rejected payloads,
   persistence failures, timeline 401s and recommendation fallbacks.
6. Add a private operational health check that verifies required schema and
   current plugin contract.
7. Review Vercel runtime declarations. Use default Node.js/Fluid Compute unless
   a route has a proven reason for another runtime.

Player UI should receive one stable error code mapped to one useful action.
```

### Acceptance

- Simulated database failure is not rendered as `No RuneLite sync`.
- Logs can trace one sync without storing bank rows or tokens.
- Alerts distinguish a bad release from a single invalid client.
- The previous `upsertSyncedPlayer failed` cluster would identify its cause.
- Build no longer emits avoidable runtime/static-generation warnings.

---

## REC-14 - Add A Real Cross-System CI Gate

Status: TODO
Depends on: REC-02, REC-03, REC-04 and REC-09
Improves: integration coverage, release confidence

### Prompt

```text
Create a deterministic CI story that proves the real product chain.

The gate must:
1. Build the Next.js production server.
2. Start an isolated test database or isolated schema.
3. Run the actual Java plugin serializer and HTTP client.
4. Claim a deterministic account.
5. Send baseline skills, quests, diaries, Slayer, boss KC and optional bank.
6. Open the browser through the real one-time claim.
7. Accept a recommendation.
8. Send a second snapshot that crosses the stop point.
9. Reload the browser and assert the completion recap plus next trip.
10. Fail on console errors, 401s, pending account requests, schema drift or
    incomplete cleanup.

Mocks may remain for fast component stories, but this gate cannot mock RuneLite,
account identity, persistence, timeline or decision APIs.

Add it to `ci:check` or a required CI workflow with clear runtime expectations.
```

### Acceptance

- Reproducing the old local-RSN/timeline-cookie split fails the gate.
- Reproducing plugin 0.2 against a 0.3-required schema fails clearly.
- No-change retries remain idempotent.
- Test artifacts include request trace, snapshot coverage and two screenshots.
- Cleanup is safe and always runs.

---

## REC-15 - Decompose Product Boundaries Without Changing Behavior

Status: TODO
Depends on: REC-06 through REC-11
Improves: maintainability, regression safety

### Prompt

```text
Break up the remaining monoliths after their behavior is protected.

Primary target: `src/app/next/next-client.tsx`.

Extract boundaries, not arbitrary components:
- account planning context loader;
- recommendation query and refresh controller;
- intent/time selection;
- plan lifecycle commands;
- route presentation model;
- primary trip view;
- alternative route picker;
- route detail sheet;
- account-safe analytics.

For the plugin, separate:
- snapshot collection;
- payload serialization;
- claim/auth transport;
- sync scheduling;
- panel state model.

Keep public behavior and tests stable. Avoid a new abstraction unless it owns a
real domain contract.
```

### Acceptance

- No player-facing behavior regresses.
- The route component does not know database or raw payload shapes.
- Ranking code has no React dependency.
- Plugin panel does not assemble transport payloads.
- Main files have clear ownership and materially lower complexity.
- Full integration gate remains green throughout.

---

# Recovery Program E - Prove Retention And Modern Product Quality

## REC-16 - Measure The Actual Decision And Return Funnel

Status: TODO
Depends on: REC-09, REC-10, REC-11 and REC-14
Improves: product analytics, retention decisions

### Prompt

```text
Instrument the smallest privacy-safe funnel that can answer whether Scapestack
is useful.

Measure:
- RSN submitted -> useful plan rendered;
- plan rendered -> started;
- started -> observed progress;
- progress -> completed;
- completed -> next trip opened;
- connected RuneLite activation;
- D1 and D7 return to a useful account state;
- recommendation skip/reroll rate by candidate kind and intent;
- fallback rate caused by incomplete data.

Do not send RSNs, bank contents, item lists, exact XP or raw recommendation
payloads to analytics. Use pseudonymous account-safe IDs and coarse event
properties.

Create one internal analysis document/query, not a player-facing dashboard.
Define minimum sample sizes before drawing product conclusions.
```

### Acceptance

- Every event has a documented question and privacy contract.
- Duplicate renders and retries do not inflate conversion.
- Funnel can distinguish first visit, public return and connected return.
- D1/D7 are based on useful return behavior, not any page view.
- A test environment cannot pollute production metrics.

---

## REC-17 - Run Refero-Led Visual And OSRS Mental-Model Validation

Status: TODO
Depends on: REC-10, REC-11 and REC-12
Improves: visual system, comprehension, Reddit fit

### Prompt

```text
Audit the rebuilt product against current high-quality interaction references
and real OSRS mental models.

Use Refero when available for:
- calm return-state composition;
- mobile bottom sheets;
- one-object decision pages;
- visual search/picker grids;
- progressive setup flows;
- empty and partial-data states.

Do not copy brand styling. Translate interaction hierarchy into Scapestack's
old-school black, white and gold system.

Test with at least these player mindsets:
- new/returning OSRS player;
- midgame main;
- ironman;
- PvMer;
- skiller/AFK player;
- skeptical r/2007scape user.

Ask them to explain within five seconds:
1. what Scapestack does;
2. why the first plan is for their account;
3. how to start;
4. where to stop;
5. why returning tomorrow should be useful.

Record exact objections. Change only repeated or severe issues.
```

### Acceptance

- At least 80% understand the core promise without prompting.
- At least 80% can start the trip and identify the stop point.
- No participant describes the main flow as a dashboard, AI wrapper or tracker.
- Mobile and desktop screenshots pass a fresh independent visual review.
- OSRS object imagery is real, relevant and never decorative filler.

---

## REC-18 - Hit Mobile, Accessibility And Performance Gates

Status: TODO
Depends on: REC-10 through REC-15
Improves: production quality

### Prompt

```text
Run a production-build quality pass on the real data states.

Viewports:
- 360x800;
- 390x844;
- 430x932;
- 768x1024;
- 1440x1000;

Test:
- first visit;
- connected no-change return;
- meaningful progress return;
- partial plugin data;
- primary plan with long real OSRS names;
- route detail sheet;
- plugin setup/repair;
- bank modal;
- boss and unlock pickers.

Require:
- no overflow, overlap or clipped text;
- primary action thumb-reachable;
- keyboard and screen-reader semantics;
- focus trapping and return for dialogs;
- reduced-motion behavior;
- Lighthouse mobile performance >= 90;
- accessibility >= 95;
- LCP < 2.5 seconds on `/` and `/next` production builds;
- no console errors or unauthorized background requests.
```

### Acceptance

- Store screenshots and machine-readable Lighthouse/browser artifacts.
- Fix regressions in the owning component rather than with page-specific CSS.
- Preserve visual hierarchy at every required viewport.

---

## REC-19 - Independent Production And Plugin Launch Gate

Status: TODO
Depends on: REC-01 through REC-18
Improves: final launch confidence

### Prompt

```text
Perform an independent audit. Implementation notes are not proof.

Run:
- full CI;
- real cross-system gate;
- plugin unit and Java end-to-end tests;
- offline and live release checks;
- production API and persistence smoke;
- live Wiki/bank smoke;
- recommendation golden scenarios;
- Playwright desktop/mobile matrix;
- Lighthouse and accessibility;
- privacy, auth, deletion and recovery tests;
- one real installed Plugin Hub account sync;
- first-run, accepted-trip, progress and return recordings.

Inspect production logs for errors after the real sync. Inspect the persisted
snapshot and the exact browser result. Confirm that the installed plugin version
matches the release manifest.

Score every category from section 3. An independent score requires observed
behavior, not the agent's opinion.
```

### Launch Gates

- Overall score >= 8.8.
- No core category below 8.0.
- Recommendation relevance and account-specific proof >= 8.5.
- Return loop and real integration coverage >= 9.0.
- RuneLite transport/auth >= 9.0 and live data completeness >= 8.5.
- Zero hard mood or eligibility violations.
- Zero unexplained 401s, pending account requests or swallowed persistence
  failures in the tested player stories.
- Plugin main, standalone and Plugin Hub state agree.
- A real player sees progress from a real installed plugin and receives a changed
  next trip.

If any gate fails, append one narrowly scoped `REC-20+` remediation phase. Do
not lower the target and do not call the program complete.

---

## 5. Global Verification Gate

Run after every implementation phase unless the phase changes documentation
only.

```bash
npm run typecheck
npm test
npm run build
git diff --check
```

Run when relevant:

```bash
npm run ci:check
npm run e2e
npm run smoke:live
npm run plugin:release-check
npm run plugin:release-check:live
cd plugin && ./gradlew test
```

For sync, identity, history or lifecycle phases, the real cross-system story is
mandatory once REC-14 provides it. Until then, use the existing Java
`EndToEndSmokeTest` against a built local server and real test persistence.

### Vercel Tooling Note

The local Vercel CLI observed during the baseline was `54.18.5`; current tooling
was `56.3.1`. Upgrade before relying on CLI diagnostics:

```bash
npm i -g vercel@latest
```

Do not make a broad Vercel configuration migration as part of an unrelated
phase. Use official Vercel guidance when runtime, deployment or observability
work is in scope.

---

## 6. Player-Facing Copy Guard

Avoid in the primary player experience:

- payload;
- signals;
- readiness;
- data source;
- verified payload;
- exact account state;
- Plugin Hub PR;
- status dashboard;
- confidence score;
- context panel;
- detected;
- source coverage.

Prefer concrete OSRS actions and facts:

- Start;
- Bring;
- Stop at;
- Skip for now;
- Worth doing;
- Missing;
- Bank has;
- Buy first;
- Fish first;
- Sync again;
- Trip;
- KC;
- Task;
- Unlock;
- Gear;
- Supplies;
- GP;
- Diary;
- Quest;
- Slayer;
- Clog.

The code may use precise technical terms internally. Tests should protect the
player-facing boundary, not ban useful engineering language from logs or docs.

---

## 7. Phase Completion Rules

A phase cannot be marked `DONE` when any of these are true:

- only unit tests prove a cross-system promise;
- the browser uses mocked sync/history data for the claimed proof;
- screenshots were not visually inspected for a UI phase;
- a real account flow emits console errors or unauthorized requests;
- the live plugin still runs a different contract;
- player-facing copy claims data that was unavailable;
- the implementation adds another status panel instead of improving the action;
- a test was weakened to accommodate the implementation;
- unrelated user changes were staged or reverted;
- required external work is merely described but not submitted.

When a phase reveals a deeper defect, fix it inside the phase if it is required
for the acceptance criteria. Otherwise append a clearly scoped remediation
phase and explain why it is independent.

---

## 8. Evidence Template

Append this under the phase before marking it `DONE`:

```text
### Evidence

- Completed: YYYY-MM-DD
- Status: DONE | WAITING EXTERNAL
- Commit: <hash>
- Push: <remote/branch and result>
- Scope: <important files and behavior>
- Tests added: <tests>
- Commands: <commands and outcomes>
- Real integration proof: <what crossed component boundaries>
- Browser proof: <viewports, screenshots, console/network result>
- Production proof: <deployment/log/snapshot result, if relevant>
- Score movement: <category before -> after with reason>
- Residual risk: <concise and honest>
- Next phase: <REC-NN>
```

---

## 9. Controller Prompt

Use this prompt whenever work resumes:

```text
Open `docs/SCAPESTACK-PRODUCTION-RECOVERY-PROMPTBOOK-2026-07-18.md`.

Read the latest user message and the `ga door` controller contract. Check the
worktree and preserve unrelated changes. Continue the phase marked
`IN PROGRESS`; otherwise execute the first `TODO` phase whose dependencies are
complete or waiting only on an external review after local proof.

Implement one complete, testable vertical milestone. Use the evidence hierarchy:
do not substitute mocks or green unit tests for a real cross-system promise.
Run the phase verification and global gate, inspect mobile/desktop when UI is
affected, update status and evidence, stage only scoped files, commit and push.

Then report the proven result, name the next phase and stop. Wait for `ga door`.
```

---

## 10. Expected End State

The program is complete only when this exact story works:

1. A player installs the current Scapestack RuneLite plugin.
2. The plugin connects the correct Scapestack browser account once.
3. The player receives one credible plan based on their actual account.
4. They start it with one click.
5. RuneLite observes progress without extra browser work.
6. Scapestack preserves that progress through repeated auto-syncs.
7. The player returns and sees one concrete accomplishment.
8. The previous plan is completed or updated automatically.
9. The next recommendation changes for an account-specific reason.
10. The whole experience is quiet, mobile-first, OSRS-native and free of
    dashboard or AI-wrapper language.

That is the retention product. Everything else is supporting infrastructure.
