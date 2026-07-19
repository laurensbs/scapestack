# Scapestack Outcome Recovery Promptbook

Status: active execution controller
Created: 2026-07-19
Baseline commit: `47b6441`
Baseline score: `6.4/10`
Execution pointer: `ODR-01`
Last validated phase: `ODR-00`
Target: a measured, trustworthy OSRS companion with no core product score below `8.0`

This file supersedes the **execution order** in:

- `docs/SCAPESTACK-90-PLUS-MASTER-PROMPTBOOK-2026-07-15.md`
- `docs/SCAPESTACK-PRODUCTION-RECOVERY-PROMPTBOOK-2026-07-18.md`

Those files remain historical evidence. Their `DONE` labels do not prove that
the current live product works. This controller starts from the live July 19
audit and is deliberately smaller, stricter and outcome-driven.

The product north star is:

> Scapestack gives one credible trip quickly, helps the player finish it,
> notices what changed through RuneLite, and continues the same account
> journey next time.

The target loop is:

```text
RSN + mood + time
  -> one evidence-backed trip in under 2.5 seconds
  -> start an active trip
  -> play to a concrete stop point
  -> RuneLite observes real progress
  -> Scapestack reconciles the result
  -> show what changed
  -> advance the same long-term route
  -> give the next bounded trip
```

---

## 1. Why The Previous Programs Did Not Produce The Desired Result

The earlier promptbooks produced substantial code, but their control system
allowed product quality to lag behind implementation volume.

1. **Capability completion replaced player-outcome completion.** A timeline,
   event, popup or ranking field could be marked done without proving that a
   player encountered a better end-to-end experience.
2. **Local tests outranked live behavior.** Mocked browser stories stayed green
   while production had cold loads around eleven seconds and a repeatable
   hydration error.
3. **Negative recommendation tests were mistaken for intelligence.** The audit
   proved that obviously forbidden outcomes were absent, but not that the
   winner was the best use of this account's time.
4. **The work was split into too many features.** Forty phases created many
   partially connected components instead of one dominant return loop.
5. **Visual work happened before interaction truth was stable.** Pages became
   cleaner, but hidden rows, empty space and generic reasons still made the
   product feel thin.
6. **Promptbook state drifted from production.** The recovery controller still
   calls plugin `0.3.0` unpublished even though it is now live in Plugin Hub.
7. **No measured retention contract existed.** Instrumentation events exist,
   but no D1/D7 cohort proves that the product creates a habit.
8. **The same agent implemented and awarded the score.** This encouraged green
   completion reports instead of adversarial validation.

This controller corrects those failure modes.

---

## 2. The `ga door` Execution Contract

When the user says `ga door`, execute this protocol exactly.

1. Read the latest user message first. It overrides this file when the two
   conflict.
2. Read this file and locate the phase in `Execution pointer`.
3. Inspect the current worktree before editing:

   ```bash
   git --git-dir=.repo-git --work-tree=. status -sb
   git --git-dir=.repo-git --work-tree=. diff --check
   ```

4. Preserve every unrelated user change. Never clean or stage the worktree
   broadly.
5. Read the named production code, tests, previous evidence and live route.
6. Reproduce the exact current behavior before changing it. Record the before
   measurement in `docs/qa/outcome-recovery/ODR-XX/`.
7. Change the selected phase to `IN PROGRESS` before implementation.
8. Implement one complete vertical milestone. Do not end on a plan, type-only
   change, dead component or mocked UI when executable work is possible.
9. Run the phase gate. A player-facing phase also requires desktop and mobile
   browser proof.
10. If the phase is larger than one safe turn, append milestone evidence, keep
    it `IN PROGRESS`, commit the coherent milestone and stop. The next
    `ga door` continues the same phase.
11. Mark a phase `LIVE VERIFIED` only when the promised behavior works on the
    production deployment. Unit tests and a local build are not enough.
12. Mark a measurement phase `VALIDATED` only when its stated sample and time
    window exist. Do not manufacture retention data.
13. Update the execution pointer only after the current phase reaches its
    required evidence level.
14. Stage only phase files, commit intentionally and push `main` after every
    proven milestone unless the user says not to.
15. Report: behavior changed, evidence, remaining risk and next pointer. Then
    wait for `ga door`.

Do not ask the user what to do next when the pointer is unambiguous. Ask only
for an action Codex cannot perform, such as opening a real bank in RuneLite.
Mark that action `WAITING PLAYER`, continue any independent automated proof,
and resume it after the user confirms.

### Status Values

- `TODO`: no work started.
- `IN PROGRESS`: active; the next `ga door` continues this phase.
- `WAITING PLAYER`: one explicit real-client action is required.
- `MEASURING`: implementation is live, but the required observation window is
  still running.
- `BLOCKED`: the same blocker survived three concrete attempts and no useful
  independent work remains.
- `LIVE VERIFIED`: implementation and real production behavior are proven.
- `VALIDATED`: a measurement or independent product gate passed.

### Evidence Ladder

Use the strongest available evidence. Lower levels never overrule a failure at
a higher level.

1. Real Plugin Hub client -> production API -> persistence -> real browser.
2. Production browser behavior with real persistence and external services.
3. Local production build with real database and real Java plugin.
4. Deterministic cross-system integration test.
5. Playwright with controlled fixtures.
6. Unit and component tests.
7. Typecheck and build.
8. Source inspection or written intent.

Every phase states its required minimum level.

### Never Do This

- Do not add another dashboard, KPI grid, readiness rail or source panel.
- Do not solve weak recommendations with more prose.
- Do not expose payload, signal, readiness, source or confidence jargon.
- Do not call an HTTP 200 a successful sync.
- Do not call a recommendation smart because it avoids one forbidden case.
- Do not show exact gear, supplies, completion or progress unless the data
  proves it.
- Do not let optional WOM, Temple or collection-log calls block the first trip.
- Do not change the displayed recommendation after the player starts it.
- Do not add notifications before the completed-trip return loop is useful.
- Do not weaken the bank organizer; simplify entry, preserve its depth.
- Do not replace OSRS objects with abstract AI decoration.
- Do not redesign the homepage again unless evidence from a later phase
  requires it.

---

## 3. Current Audited Baseline

### Proven Strengths

- Full CI passes: 217 test files and 1,362 tests.
- Typecheck, smoke, recommendation audit and 217-page production build pass.
- Playwright passes 23 stories with one conditional skip.
- RuneLite plugin unit suite and build pass.
- Plugin `0.3.0` is published in Plugin Hub and release checks pass.
- `/api/sync` reports a configured, ready database and contract limits.
- Seven core routes return HTTP 200 on desktop and mobile.
- No audited route had horizontal overflow, broken images or unnamed controls.
- The homepage has a clear OSRS-native black, cream and restrained gold brand.

### Proven Gaps

- Cold live `/next` was measured at 10.96 seconds; the profile at 10.15 seconds.
- `/next` performs five lookups in one blocking `Promise.all` and deliberately
  keeps the loader visible for at least two seconds.
- The mobile homepage produced React hydration error `#418` on three repeated
  runs.
- The loaded `/next` accessibility tree exposed no heading.
- The live result reason was generic rather than account-evidenced.
- Goals recommended `Defence cape` as the best next unlock because the goal set
  was started and incomplete, not because the grind had the highest utility.
- The 13-scenario recommendation audit has 73 hard rules, but mostly proves
  absence of obvious mistakes rather than comparative quality.
- A true Java plugin -> server -> persistence -> browser smoke exists in source
  but was skipped in the latest Gradle run because its local server was absent.
- Browser reminders use an in-memory timer and are not durable after closure.
- The strongest account timeline lives on the profile instead of the core
  session loop.
- Plausible events exist, but there is no measured D1/D7 return cohort.

### Baseline Score Contract

| Category | Baseline | Target | Required final proof |
| --- | ---: | ---: | --- |
| Product promise | 8.5 | 9.0 | Five-second comprehension |
| First useful plan | 7.0 | 9.0 | Cold actionable result <=2.5s |
| Recommendation relevance | 5.5 | 8.8 | Pairwise golden benchmark |
| Recommendation evidence | 5.5 | 9.0 | Two concrete account facts per winner |
| Active session | 4.5 | 8.8 | Start-to-stop E2E |
| Long-term route | 4.0 | 8.5 | Session advances a durable journey |
| Return value | 4.0 | 8.8 | Sync-to-next-trip E2E |
| RuneLite contract/release | 8.5 | 9.2 | Real Plugin Hub production proof |
| RuneLite player UX | 6.0 | 8.8 | Silent fresh-state handoff |
| Bank and boss utility | 7.5 | 8.5 | Contextual trip proof |
| Branding | 8.0 | 8.8 | Reference lock and player test |
| Inner product UI | 6.5 | 8.5 | One-object-per-viewport review |
| Mobile/accessibility | 6.5 | 9.0 | Zero errors + keyboard/AX gate |
| Performance | 5.0 | 9.0 | Cold production measurements |
| Measurement | 4.5 | 8.5 | Decision and D1/D7 cohorts |
| Privacy/trust | 8.0 | 9.0 | Threat model + deletion proof |
| Engineering | 9.0 | 9.2 | Full CI and cross-system gate |
| Reddit fit | 6.5 | 8.5 | Beta evidence, not copy alone |

No final score may be raised without the proof in the last column.

---

## 4. Global Verification Gate

Run for every implementation milestone:

```bash
npm run typecheck
npm test
git --git-dir=.repo-git --work-tree=. diff --check
```

Run before phase completion:

```bash
npm run ci:check
npm run e2e
npm run smoke:live
npm run plugin:release-check:live
(cd plugin && ./gradlew test)
```

For UI phases, verify at minimum:

- 390x844 mobile;
- 360x800 compact mobile;
- 1440x1000 desktop;
- keyboard-only path;
- accessibility tree names and heading structure;
- no console/page errors;
- no hydration warnings;
- no overflow or overlap;
- no clipped recommendation text;
- primary action reachable without opening a technical panel.

For performance phases, record at least three cold and three warm runs. Keep
raw JSON, screenshots and exact environment details. Do not quote the best run.

---

# Program A - Make The Core Path Fast And True

## ODR-00 - Reconcile Reality And Install The Outcome Gate

Status: VALIDATED (2026-07-19)
Required evidence: level 2
Improves: execution truth, measurement, release confidence

### Prompt

```text
Re-baseline Scapestack from current production and make this controller the
only active execution pointer.

Do not change player-facing product behavior in this phase.

Build:
1. Re-run CI, Playwright, live smoke, plugin release checks and Gradle tests.
2. Re-run the seven-route desktop/mobile production audit with cold and warm
   timing, console, page-error, overflow, broken-image and accessibility-tree
   capture.
3. Record the actual Plugin Hub version, pinned commit, website contract,
   production API readiness and latest real snapshot coverage.
4. Run the real Java end-to-end smoke instead of accepting its skipped result.
5. Create docs/qa/outcome-recovery/ODR-00/baseline.json and report.md.
6. Add a machine-readable outcome-gate schema with category score, evidence
   level, artifact path, timestamp and pass/fail reason.
7. Make stale promptbook claims fail the controller audit when they contradict
   release or production evidence.

Acceptance:
- published plugin 0.3.0 is recorded truthfully;
- no integration skip is hidden inside a green Gradle result;
- cold timings and the hydration failure are reproducible or explicitly
  disproven with raw evidence;
- every baseline score links to evidence;
- this file's pointer is the only pointer used on the next ga door.
```

### Evidence

- Machine-readable baseline and all 18 category scores:
  `docs/qa/outcome-recovery/ODR-00/baseline.json`
- Human audit and next-phase implications:
  `docs/qa/outcome-recovery/ODR-00/report.md`
- Production route audit: 84 measured navigations, zero readiness failures,
  twelve reproducible homepage hydration errors:
  `docs/qa/outcome-recovery/ODR-00/production-routes.json`
- Browser gate: 19 passed, four failed, one skipped:
  `docs/qa/outcome-recovery/ODR-00/local-browser-gate.json`
- Published release truth: Plugin Hub `0.3.0`, contract v3, pinned commit
  `e29f6ac6995ffd8f95c3f71bebeac1d0ea26ebd3`:
  `docs/qa/outcome-recovery/ODR-00/release-evidence.json`
- Explicit isolated Java integration: ten tests, zero failures, zero skips:
  `docs/qa/outcome-recovery/ODR-00/plugin-e2e.xml`

ODR-00 is validated because the baseline and gate are reproducible. The
baseline remains `launchReady: false`; ODR-01 owns the first-answer latency,
browser timeout and hydration failures exposed here.

---

## ODR-01 - Deliver One Useful Plan In Under 2.5 Seconds

Status: IN PROGRESS
Depends on: ODR-00
Required evidence: level 2
Improves: first useful plan, performance, trust

### Prompt

```text
Remove latency from the core promise without making the answer unstable.

Inspect:
- src/app/next/next-client.tsx
- Hiscores, WOM, Temple, collection-log and sync actions
- profile and goals fetch paths
- Next.js cache and Vercel function behavior
- the production hydration trace

Build:
1. Remove the forced two-second loader floor.
2. Define critical context: fresh Scapestack sync when available plus official
   Hiscores. These may block only until a strict first-answer deadline.
3. Treat WOM, Temple and collection-log enrichment as bounded optional work.
   Add AbortSignal timeouts and do not let one slow provider hold the result.
4. Use cached/stale-safe data where truthful. Never render an enrichment that
   contradicts a fresher plugin snapshot.
5. Freeze the recommendation once the player sees or starts it. Late data may
   offer an explicit recalculate action, never silently swap the trip.
6. Replace blank loading with a stable, accessible shell that contains no item
   IDs, fake notes or lore delay.
7. Find and fix the production hydration mismatch at its source. Do not merely
   suppress all hydration warnings unless the exact Vercel-injected attribute
   is proven harmless and narrowly contained.
8. Add server-timing or privacy-safe elapsed metrics for critical and optional
   sources.

Acceptance:
- three cold production runs expose an actionable plan in <=2.5s each;
- absolute degraded-mode answer appears within 4s during an optional-provider
  outage;
- zero hydration/page errors on repeated desktop and mobile runs;
- cached runs are not deliberately delayed;
- recommendations never change underneath an active trip;
- all existing planner facts remain truthful.
```

---

## ODR-02 - Close The Real RuneLite Production Loop

Status: TODO
Depends on: ODR-00
Required evidence: level 1
Improves: RuneLite UX, data completeness, trust

### Prompt

```text
Prove that the installed Plugin Hub build and the website share one current
account state. Treat the plugin's Synced label as insufficient evidence.

Build:
1. Run installed plugin 0.3.0 against production with an owned test account.
2. Capture claim identity, accepted contract version, plugin version, sync
   timestamp and per-domain coverage without exposing private payload values.
3. Ensure skills/XP, quests, diaries, clog, Slayer, boss KC and optional bank
   report available, unavailable, not loaded or permission off honestly.
4. Make the website automatically observe a successful sync through polling,
   revalidation or a secure handoff. A player must not manually reload and
   guess whether the server received it.
5. If bank is enabled but not loaded, say to open the bank. Do not say the
   player has no bank or no items.
6. Make the Java end-to-end smoke non-optional in the cross-system gate. Use a
   deterministic isolated identity and clean it safely.
7. Verify that the planner consumes the same persisted snapshot the plugin
   just wrote.

Acceptance:
- real installed client -> production -> browser succeeds;
- website shows the accepted scan time within 15 seconds;
- planner decision evidence references at least one fact from that snapshot;
- no false empty collection log, bank, boss KC or Slayer state;
- zero skipped plugin E2E tests in the release gate;
- auth, claim replay and payload limits remain green.
```

---

# Program B - Make The Recommendation Deserve Trust

## ODR-03 - Give Every Winner An Evidence Contract

Status: TODO
Depends on: ODR-01 and ODR-02
Required evidence: level 4
Improves: recommendation evidence, honesty, copy

### Prompt

```text
Replace generic recommendation reasons with structured decision evidence.

Create an internal contract containing:
- observed account facts used;
- inferred facts and their limits;
- hard eligibility checks;
- why the winner beat the nearest alternative;
- missing context that could reverse the decision;
- first action and measurable stop point;
- explicit reasons to avoid or defer the route.

Rules:
1. A primary recommendation must cite at least two concrete account facts when
   those facts exist: level/XP gap, current Slayer task, KC, completed unlock,
   bank item/quantity or recent delta.
2. Never show source names as the reason. Translate data into OSRS meaning.
3. Generic lines such as 'matches visible progress' cannot satisfy the gate.
4. When evidence is too weak, abstain honestly and ask for exactly one piece of
   context that can change the answer.
5. Keep the visible reason to one or two short sentences. Put the complete
   evidence in tests and optional details, not a dashboard.
6. Preserve uncertainty: public stats cannot prove quest, diary, clog, bank or
   active task completion.

Acceptance:
- every golden winner has structured evidence;
- no generic reason can pass the audit;
- the visible reason names real account progress;
- missing context produces one useful next action, not a status panel;
- contradictory evidence fails CI.
```

---

## ODR-04 - Replace Safety Rules With Comparative Decision Quality

Status: TODO
Depends on: ODR-03
Required evidence: level 4
Improves: relevance, mood integrity, goals

### Prompt

```text
Make the quality audit answer 'is this the best choice?' instead of only 'is
this choice technically allowed?'.

Build a pairwise benchmark of at least 30 account/session scenarios covering:
- new, early, midgame, late and maxed accounts;
- main, iron, hardcore, skiller and PvM profiles;
- Chill, AFK, GP, Bossing, Unlock, Short and focused sessions;
- active Slayer tasks;
- near unlocks versus long prestige grinds;
- one-KC scouts versus established bosses;
- sufficient, insufficient and unknown bank supplies;
- fresh, stale, partial and missing RuneLite data;
- returning players with accepted, skipped and completed history.

For every scenario define:
- the preferred route family or small allowed winner set;
- a clearly worse comparison that must lose;
- factual invariants;
- expected evidence;
- opportunity-cost reason;
- cases where Scapestack must abstain.

Fix known quality errors:
1. A skill cape is not a useful next unlock merely because another cape made
   the set 'started'. Promote 99 only when close in XP/time, explicitly chosen
   as a long-term route, or uniquely valuable.
2. Chill/AFK must satisfy hard attention constraints, not weak score bonuses.
3. Long prerequisite chains lose to nearby meaningful unlocks unless their
   payoff is materially better and shown.
4. Bank feasibility can promote a route but wealth alone cannot make it fun or
   appropriate.
5. Randomize samples only from the same eligible intent set and avoids recent
   repetitions.

Acceptance:
- pairwise benchmark passes with zero hard violations;
- Defence cape does not win the current Lauky unlock case without maxing
  intent;
- Chill never produces raids or high-attention trips;
- three independent seeded runs remain diverse but intent-correct;
- editorial review samples expose no generic or nonsensical winner.
```

---

# Program C - Turn A Suggestion Into A Journey

## ODR-05 - Build One Durable Account Journey

Status: TODO
Depends on: ODR-04
Required evidence: level 4
Improves: long-term route, return value, intelligence

### Prompt

```text
Introduce a durable Journey model so today's trip advances an overarching OSRS
goal instead of resetting the product after every answer.

Support initial journey families:
- useful account unlocks;
- quest/diary progression;
- PvM progression;
- Slayer progression;
- ironman self-sufficiency;
- maxing or skill lane;
- player-selected custom objective.

A Journey contains:
- one player-readable destination;
- current milestone;
- ordered dependencies;
- next bounded session block;
- evidence of completed milestones;
- branches when bank, quest or skill requirements differ;
- a recalculation reason when new data changes the route.

Behavior:
1. Infer at most one suggested journey, but let the player confirm or change it
   with one lightweight choice.
2. Today's recommendation must be a session-sized slice of that journey.
3. Completing a trip advances the milestone; it does not roll an unrelated
   recommendation.
4. Randomize changes the method or compatible session block, not the account's
   declared destination.
5. Persist the journey server-side for a connected RuneLite account and use a
   local RSN-scoped fallback without the plugin.
6. Explain route changes with one concrete OSRS fact.

Acceptance:
- first session, active session and return session use the same journey ID;
- a completed milestone deterministically advances the route;
- an ironman route inserts self-sourcing when supplies are insufficient;
- a main route may use GE procurement when appropriate;
- the player can change or stop a journey without deleting account history;
- no journey dashboard is introduced.
```

---

## ODR-06 - Make `Start` Become An Active Trip

Status: TODO
Depends on: ODR-05
Required evidence: level 2
Improves: active session, mobile UX, actionability

### Prompt

```text
Turn the primary recommendation into a playable active-trip state.

Use Refero flow research for active workout/session patterns, especially the
sequence template -> start -> progress -> finish -> summary. Translate the
interaction logic, not the fitness aesthetic.

Build:
1. Before start, show one large OSRS object/reward, one reason, one first action
   and one stop point.
2. Start changes the page into an active trip. Hide competing alternatives and
   recommendation controls while active.
3. Show only controls useful during play: current step, progress input where
   RuneLite cannot observe it, stop point, finish/stop and one compact setup
   sheet when gear or supplies matter.
4. Use boss KC, XP, Slayer remaining, quest/diary completion or a manual block
   as the progress unit; never use a fake percentage.
5. Keep the active trip recoverable after reload and on the paired device.
6. On mobile, keep the next useful action reachable with one hand and preserve
   at least 44px touch targets.
7. Do not add a timer unless time itself defines the stop point.

Acceptance:
- Playwright proves plan -> start -> reload -> active trip;
- the page has one primary action per state;
- no alternatives or donation CTA compete with an active trip;
- exact progress appears only when observable;
- desktop and mobile have no overlap, clipping or accessibility errors.
```

---

## ODR-07 - Close Trips From Real Progress And Show The Result

Status: TODO
Depends on: ODR-06 and ODR-02
Required evidence: level 1
Improves: RuneLite value, return loop, trust

### Prompt

```text
Use new RuneLite snapshots to reconcile the active trip and produce a useful
finish moment.

Build:
1. Match snapshot deltas to the active trip's completion target.
2. Distinguish completed, progressed, contradicted, unchanged and unavailable.
3. Never complete from elapsed time alone.
4. Show a concise result such as:
   - gained 42,000 Slayer XP;
   - 25 Gargoyles left;
   - reached 50 Vorkath KC;
   - completed the diary tier;
   - bank now covers the trip.
5. Advance the Journey only when evidence or explicit manual completion is
   trustworthy.
6. Preserve the last meaningful delta across identical auto-syncs.
7. Generate the next session block from the updated state.
8. Handle contradictions: if progress happened elsewhere, acknowledge it and
   recalculate without blaming the player.

Acceptance:
- a real plugin sync updates one active trip in production;
- unchanged sync cannot erase the last meaningful result;
- false zero/unavailable fields cannot complete or regress a trip;
- finish summary and next trip use the same Journey;
- manual completion is labelled manual and can be corrected;
- real client -> browser return flow is captured on mobile and desktop.
```

---

## ODR-08 - Make The Homepage The Return Moment

Status: TODO
Depends on: ODR-07
Required evidence: level 2
Improves: return value, first-run separation, branding

### Prompt

```text
Give first-time and returning players different home states without creating a
profile dashboard.

First visit remains:
- Stop bankstanding;
- one RSN field;
- mood/time choice;
- one clear plan.

Return visit becomes one of three focused states:
1. Continue the active trip.
2. Review one meaningful change and take the next trip.
3. No new progress: continue or recalculate without implying failure.

Rules:
- Do not show stat grids, source readiness or a timeline feed above the action.
- Show at most one meaningful delta and one next action.
- Keep profile/history as optional depth, not the homepage task.
- Remove donation prompts from the decision and active-trip viewport. Support
  can remain after value has been delivered.
- Never ask for the same RSN again on the same saved or paired account.
- Fresh RuneLite state should arrive automatically; expose refresh only when
  it is stale or failed.

Acceptance:
- first visit and return visit have distinct E2E stories;
- an active trip is the first return action;
- a completed trip shows its result before the next recommendation;
- no generic welcome card displaces useful progress;
- mobile first viewport contains the complete return decision.
```

---

# Program D - Make The Whole Product Feel Like One Companion

## ODR-09 - Unify Memory Across Browser And RuneLite

Status: TODO
Depends on: ODR-07
Required evidence: level 2
Improves: continuity, personalization, trust

### Prompt

```text
Make starts, skips, completions, mood and Journey continuity reliable without
forcing a conventional login.

Build:
1. A claimed RuneLite account owns server-side Journey, active trip,
   recommendation feedback and meaningful outcomes.
2. An RSN-only user retains a clearly local fallback.
3. Pairing a browser migrates compatible local history once and deduplicates
   events.
4. A second paired device sees the same active trip and next milestone.
5. Removing a local account revokes that browser session and clears local
   convenience state without silently deleting server history.
6. Provide explicit history deletion through a secure account-owned flow.
7. Replace the current in-memory notification timer. Either implement a real
   durable service-worker/push reminder with consent or remove the promise;
   do not fake durability.
8. Preserve privacy: no raw bank contents or RSN in analytics events.

Acceptance:
- two paired browser contexts share one active Journey;
- unpaired browser cannot access private history;
- local-to-paired migration is idempotent;
- removal, revocation and deletion are tested separately;
- reminders survive closure or are no longer offered as durable reminders.
```

---

## ODR-10 - Recompose Inner Pages Without Dashboard Language

Status: TODO
Depends on: ODR-06 and ODR-08
Required evidence: level 2
Improves: inner UI, branding, mobile, tool unity

### Prompt

```text
Modernize the inner product surfaces only after the core states are stable.

Research:
1. Use Refero styles for an immersive, dark, editorial product language.
2. Use Refero screens/flows for active sessions, focused decisions, searchable
   object browsers and progressive disclosure.
3. Create a reference lock before editing: primary direction, exact traits to
   preserve, borrowed interaction details, rejected patterns and token roles.

Preserve:
- near-black, white/cream and restrained OSRS gold;
- OSRS sprites and large bosses/rewards as the visual anchor;
- existing strong homepage identity;
- serif display headings only where they carry meaning;
- full bank-organizer capability.

Recompose:
1. `/next` around recommendation -> active trip -> result, not stacked panels.
2. Bank entry as a focused modal/sheet; organizer as a dedicated workspace.
3. Boss as a large searchable object browser whose details open directly.
4. Goals as one unlock route with inspectable steps, not a completion grid.
5. Plugin as current/fix only; diagnostics remain behind troubleshooting.
6. Profile as optional account history, not a second home/dashboard.

Rules:
- one primary object and action per viewport;
- no nested cards or KPI grids;
- collapsibles only for genuinely optional depth;
- do not hide the two most useful alternatives behind an unlabeled row;
- use whitespace for focus, not as an empty substitute for content;
- player copy names actions: Start, Bring, Stop at, Skip for now.

Acceptance:
- every core screen passes the one-object review;
- five-second screenshot test identifies the page task correctly;
- mobile and desktop remain recognizably one product;
- zero forbidden dashboard terms in player-facing core flows;
- no regression in bank, boss or goals capability.
```

---

## ODR-11 - Make Bank, Boss And Goals Serve The Journey

Status: TODO
Depends on: ODR-05 and ODR-10
Required evidence: level 4
Improves: tool unity, depth, actually-useful moments

### Prompt

```text
Connect the existing deep tools to the active Journey instead of leaving them
as separate destinations.

Build contextual handoffs:
1. A boss trip opens the boss directly with best owned gear, inventory,
   supplies, missing upgrades and one-trip verdict.
2. A skill trip calculates XP remaining, banked XP, usable bank quantities,
   missing materials and ironman sourcing where relevant.
3. A quest/diary trip opens the exact next requirement and skips proven
   completion.
4. A Slayer trip shows current task decision, remaining count and supported
   method only when known.
5. Bank organizer remains available as a full workspace, but the Journey asks
   only for the bank action that changes this trip.

Create actually-useful sentences from facts:
- You can kill Vorkath, but missing Salve makes this trip worse.
- Your bank supports Zulrah, but only for two trips of supplies.
- Do this diary before more Slayer because it unlocks the route.
- This boss is not worth camping yet; unlock X first.

Acceptance:
- each recommendation family has a vertical handoff test;
- quantities and inventory never use item-name guessing when exact IDs exist;
- unknown bank context stays conservative;
- ironman never receives a buy-only dependency;
- tool detail returns to the same active Journey without losing state.
```

---

# Program E - Prove Retention And Launch Quality

## ODR-12 - Measure The Real Decision And Return Funnel

Status: TODO
Depends on: ODR-08 and ODR-09
Required evidence: level 2, then MEASURING
Improves: analytics, learning, retention truth

### Prompt

```text
Turn existing events into a privacy-safe product learning loop.

Measure:
- first plan latency;
- plan impression -> start;
- start -> manual or RuneLite completion;
- another/skip reason;
- completion -> next trip;
- D1 and D7 return after first plan;
- D1 and D7 return after completed trip;
- fresh versus missing RuneLite context;
- recommendation family and account stage without raw RSN.

Build:
1. Validate that every event fires once with a stable anonymous or server-side
   account key that cannot reveal the RSN.
2. Define cohort queries and a versioned metric dictionary.
3. Add data-quality checks for duplicate, missing and impossible funnels.
4. Record recommendation version so ranking changes are comparable.
5. Do not build a player-facing analytics dashboard.
6. Establish baseline sample sizes and confidence limits before claiming an
   improvement.

Launch thresholds to validate, not assume:
- >=60% of rendered first plans start or intentionally choose another;
- >=35% of started trips are completed or show verified progress;
- D1 return improves against the pre-Journey baseline;
- plugin-connected players complete at a higher rate than public-only players;
- p75 first useful plan <=2.5s.

The phase enters MEASURING when instrumentation is live. It reaches VALIDATED
only after the required observation window and sample are recorded.
```

---

## ODR-13 - Run The Adversarial Product Matrix

Status: TODO
Depends on: ODR-11
Required evidence: level 2
Improves: reliability, recommendation quality, accessibility

### Prompt

```text
Test Scapestack as a skeptical OSRS player, not as its implementer.

Run at least these stories:
- brand-new RSN;
- returning midgame main;
- iron with insufficient supplies;
- skiller;
- active Slayer task;
- established PvMer;
- 1-KC scout boss;
- maxed account;
- stale plugin;
- partial plugin coverage;
- bank permission off;
- bank enabled but not opened;
- optional provider timeout;
- sync/API outage;
- removed and re-paired browser;
- active trip resumed on mobile;
- completed trip returning the next day.

For each story record:
- visible recommendation and evidence;
- first useful plan time;
- expected and actual Journey transition;
- console/network/page errors;
- mobile/desktop screenshot;
- keyboard and accessibility-tree result;
- privacy and honesty outcome.

Red-team the ranking with pairwise counterexamples and change one input at a
time. The recommendation should change only for a defensible reason.

Acceptance:
- zero critical flow failures;
- zero hydration or unhandled request errors;
- zero hard recommendation-contract violations;
- degraded states remain useful and honest;
- no test relies solely on mocked success;
- independent audit issues are fixed or explicitly launch-blocking.
```

---

## ODR-14 - Independent Score, Reddit Beta And Launch Gate

Status: TODO
Depends on: ODR-13; ODR-12 may remain MEASURING
Required evidence: level 1 plus independent review
Improves: Reddit fit, launch confidence

### Prompt

```text
Run a final audit that is not allowed to inherit implementation optimism.

1. Re-score every category from the baseline table using linked evidence.
2. Re-run CI, E2E, live smoke, release, real plugin and production-browser
   gates from clean state.
3. Compare the live product with Wise Old Man's historical value loop and with
   Refero references for session completion and return states.
4. Perform a five-second comprehension test on homepage, plan, active trip and
   return state using people who did not implement the feature when available.
5. Prepare one honest r/2007scape beta post and one screenshot that show the
   actual trip/result loop, not feature marketing.
6. State known limitations plainly: data unavailable, inference, bank opt-in
   and what the plugin never collects.
7. Do not call it launch-ready when a core score is below 8.0 or a production
   gate fails.

Final gates:
- overall evidence-weighted score >=8.5;
- no core product score below 8.0;
- cold p75 first useful plan <=2.5s;
- zero production hydration/page errors;
- real Plugin Hub sync-to-return proof passes;
- recommendation benchmark has zero hard failures;
- active trip survives reload and paired-device return;
- meaningful progress advances the Journey;
- privacy/deletion tests pass;
- retention metrics are labelled MEASURING until statistically credible.

Output one final launch report with pass, conditional pass or fail. Never
change the threshold after seeing the result.
```

---

## 5. Phase Evidence Template

Append this under the active phase after every milestone:

```text
### Milestone evidence - YYYY-MM-DD

- Status before:
- Status after:
- Player behavior changed:
- Before evidence:
- After evidence:
- Evidence level reached:
- Files changed:
- Tests added or changed:
- Commands and exact results:
- Desktop screenshot:
- Mobile screenshot:
- Production deployment/URL:
- Plugin version/commit when relevant:
- Metrics before -> after:
- Known residual risk:
- Commit:
- Push:
- Next action:
```

Do not write `all green` without counts. Do not write `looks good` without a
screenshot and task-success statement.

---

## 6. Execution Ledger

| Phase | Status | Required evidence | Commit | Production proof |
| --- | --- | ---: | --- | --- |
| ODR-00 | TODO | 2 | - | - |
| ODR-01 | TODO | 2 | - | - |
| ODR-02 | TODO | 1 | - | - |
| ODR-03 | TODO | 4 | - | - |
| ODR-04 | TODO | 4 | - | - |
| ODR-05 | TODO | 4 | - | - |
| ODR-06 | TODO | 2 | - | - |
| ODR-07 | TODO | 1 | - | - |
| ODR-08 | TODO | 2 | - | - |
| ODR-09 | TODO | 2 | - | - |
| ODR-10 | TODO | 2 | - | - |
| ODR-11 | TODO | 4 | - | - |
| ODR-12 | TODO | 2 + measurement | - | - |
| ODR-13 | TODO | 2 | - | - |
| ODR-14 | TODO | 1 + independent | - | - |

The next `ga door` starts at `ODR-00`.
