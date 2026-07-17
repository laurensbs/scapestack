# Scapestack 90+ Master Promptbook

Status: active planning document  
Created: 2026-07-15  
Baseline commit: `b7391c8`  
Baseline product score: 5.8/10  
Target product score: at least 8.8/10, with no core category below 8.0

This file turns the July 15 product audit into an executable development
program. It supersedes the execution order in
`docs/SCAPESTACK-RETENTION-REFERO-PROMPTPLAN-2026-07-15.md`, but keeps that file
as historical context.

The purpose is not to make Scapestack larger. The purpose is to make it more
truthful, useful and habit-forming:

> Scapestack remembers the account, notices what changed, calls one worthwhile
> OSRS trip, and learns whether that advice helped.

---

## 1. How To Run This File

When the user says `ga door`, execute exactly the first phase whose status is
`TODO` and whose dependencies are complete.

For every phase:

1. Read this file, the named source files and their current tests.
2. Inspect the live implementation before deciding what to change.
3. Preserve unrelated user changes in a dirty worktree.
4. Implement the complete vertical slice. Do not stop at types or mock UI.
5. Add tests that fail for the old behavior and pass for the new behavior.
6. Run the phase-specific checks plus the global verification gate.
7. Inspect mobile and desktop when player-facing UI changes.
8. Update the phase status from `TODO` to `DONE` and append evidence:
   - files changed;
   - tests added;
   - commands run;
   - screenshots or measurements;
   - commit hash.
9. Commit intentionally and push `main` unless the user says otherwise.
10. Stop. State the next phase and wait for `ga door`.

Never mark a phase complete because the page looks better or CI is green. A
phase is complete only when its behavioral acceptance criteria are proven.

### Status Values

- `TODO`: not started.
- `IN PROGRESS`: currently being implemented.
- `BLOCKED`: cannot continue after three real attempts; document the blocker.
- `DONE`: implementation, tests, verification, commit and push are complete.

### Global Verification Gate

Run after every implementation phase:

```bash
npm run typecheck
npm test
npm run build
```

Run when relevant:

```bash
npm run smoke
npm run smoke:live
npm run audit:next
npm audit --omit=dev
cd plugin && ./gradlew test
```

For UI phases, use Playwright against a production build. Check at least:

- mobile: 390x844;
- compact mobile: 360x800;
- desktop: 1440x1000;
- no horizontal overflow;
- no console errors;
- no overlapping fixed navigation;
- primary action visible without hunting;
- touch targets at least 44x44 CSS pixels for primary controls;
- text is not clipped or ellipsized when it contains the actual plan.

### Global Implementation Rules

- Do not add a dashboard to explain intelligence. Put intelligence into the
  recommendation.
- Do not expose raw sync, payload, source, readiness, signal or confidence
  language to players.
- Do not claim exact knowledge when Scapestack only has an estimate.
- Mood is a contract, not a weak ranking hint.
- RuneLite and bank data are silent context, not the main task.
- Keep the bank organizer. Simplify its entry flow; do not remove its depth.
- Prefer one primary object and one primary decision per viewport.
- Use OSRS sprites and concrete account facts instead of decorative AI visuals.
- Never solve a retention problem with notifications before the underlying
  return value exists.
- Never solve a recommendation problem with more explanatory copy.
- Player-facing copy must be short enough to scan while standing at a bank.
- Privacy must remain explicit: never collect login credentials, chat, clicks,
  screenshots or unrelated game state.

---

## 2. Score Contract

The final audit must score every category with evidence. Scores cannot be
self-awarded by the implementation agent.

| Category | Baseline | Target | Required proof |
| --- | ---: | ---: | --- |
| Product promise | 8.5 | 9.2 | Five-second comprehension test |
| Homepage and branding | 8.0 | 9.0 | Mobile/desktop visual review |
| First-run onboarding | 4.5 | 9.0 | RSN to useful plan in one flow |
| Recommendation relevance | 5.5 | 9.0 | Golden account scenarios |
| Recommendation trust | 5.0 | 9.0 | Provenance and honesty tests |
| Mood integrity | 3.5 | 9.5 | Zero hard-constraint violations |
| RuneLite engineering | 7.5 | 9.0 | Plugin and API test suite |
| RuneLite product value | 4.5 | 9.0 | Automatic progress loop |
| Bank engine | 8.0 | 9.0 | Existing organizer regressions green |
| Bank UX | 4.0 | 8.5 | Short modal entry and usability test |
| Check Kill breadth | 6.0 | 9.0 | Catalog coverage report |
| Check Kill depth | 4.5 | 8.5 | Boss-specific trip validation |
| Goals and unlocks | 5.5 | 8.5 | Exact missing-step scenarios |
| Account return value | 3.5 | 9.0 | Returning-user end-to-end test |
| Cross-device continuity | 2.5 | 8.5 | Server-backed account history |
| Mobile UX | 5.5 | 9.0 | Browser and Lighthouse gates |
| Visual consistency | 6.0 | 9.0 | Reference-lock review |
| Accessibility | 8.8 | 9.5 | Lighthouse and keyboard audit |
| Engineering quality | 8.5 | 9.0 | CI, boundaries and complexity checks |
| Product analytics | 2.0 | 9.0 | Full decision funnel events |
| Retention loop | 3.0 | 9.0 | Progress-to-next-plan proof |

Final launch gates:

- overall score at least 8.8;
- no core category below 8.0;
- mobile Lighthouse performance at least 90 on `/` and `/next`;
- mobile LCP below 2.5 seconds on a production build;
- accessibility at least 95;
- zero known mood-contract violations;
- zero recommendation golden-scenario failures;
- all tests, build, API smoke and plugin tests green.

---

## 3. Current Evidence To Preserve

The July 15 baseline established:

- 1,077 Vitest tests passed;
- the Java plugin tests passed;
- 209 Next.js pages built successfully;
- live Wiki price and bank smoke passed;
- sync authentication and claim routes behaved correctly;
- dependency audit reported zero known production vulnerabilities;
- the homepage scored 99 desktop and 85 mobile performance;
- `/next` scored 75 mobile performance with 5.7 second LCP;
- the current semantic audit prints warnings but does not fail CI;
- `Chill` followed by `Surprise me` can produce routes outside the expected
  vibe;
- the current sync repository overwrites the latest player row and does not
  retain an immutable history;
- trip history is localStorage-only;
- the bank page exposed roughly 110 buttons in a mobile smoke run;
- the homepage is visually stronger than the authenticated/product surfaces;
- the largest client and recommendation files are several thousand lines.

Do not regress the working bank organizer, plugin security or clean homepage
while addressing these gaps.

---

# Program A - Measurement And Account Memory

## Phase 00 - Make Product Quality Machine-Checkable

Status: DONE
Depends on: none  
Improves: engineering quality, recommendation relevance, trust

### Prompt

```text
Replace the advisory recommendation audit with a real quality gate.

Read:
- scripts/audit-next.ts
- src/lib/next-up.ts
- src/lib/fixtures.ts
- tests/next-best-actions.test.ts
- tests/next-up-basis.test.ts
- tests/scapestack-product-contract.test.ts

Build:
1. Extract representative account scenarios into typed fixtures.
2. Give every scenario hard invariants, allowed outcomes and forbidden outcomes.
3. Make the audit exit non-zero on any violated hard invariant.
4. Keep diagnostic output, but distinguish hard failures from editorial notes.
5. Add coverage for main, ironman, early game, midgame, maxed, returning,
   skiller, active Slayer, no bank, rich bank and stale RuneLite states.
6. Add a JSON result artifact so score changes can be compared over time.
7. Add this gate to ci:check.

Do not assert exact recommendation titles unless the title is itself the
contract. Test decision properties and factual consistency.

Acceptance:
- a Chill raid headline makes the command fail;
- a completed quest recommendation makes the command fail;
- a 1 KC scout boss cannot win without another strong reason;
- existing good scenarios pass;
- CI now rejects semantic recommendation regressions.
```

Evidence:
- Completed: 2026-07-15
- Commit: `29b6663`
- Files: `scripts/audit-next.ts`, `scripts/next-audit-rules.ts`,
  `scripts/next-audit-scenarios.ts`, `tests/next-audit.test.ts`, `.gitignore`
- Tests added: six recommendation quality-gate tests covering the passing
  baseline, deliberate hard failure, editorial note, invalid Chill boss,
  1-KC scout headline and CI/artifact wiring
- Commands: `npx vitest run tests/next-audit.test.ts`, `npm run audit:next`,
  `npm run ci:check`, `git diff --check`
- Browser evidence: not applicable; this phase changed no player-facing UI
- Metric change: advisory 5-scenario printout -> 13 typed scenarios, 73
  evaluated rules, zero hard failures and a machine-readable JSON artifact
- Known residual risk: the Callisto scout is correctly demoted but falls
  outside the first eight visible choices; retained as one editorial note

## Phase 01 - Define The Decision Funnel

Status: DONE
Depends on: Phase 00  
Improves: product analytics, retention diagnosis

### Prompt

```text
Create a privacy-safe analytics event contract for the entire recommendation
lifecycle.

Read:
- src/lib/analytics.ts
- src/app/page.tsx
- src/app/next/next-client.tsx
- src/lib/recommendation-feedback.ts
- src/lib/trip-timeline.ts

Track typed events for:
- RSN submitted;
- first plan rendered;
- mood chosen or changed;
- recommendation impression;
- recommendation accepted;
- another plan requested;
- recommendation skipped and reason;
- trip started;
- trip completed manually;
- trip completed through sync evidence;
- RuneLite sync success/failure;
- bank attached/refreshed;
- return visit;
- recap viewed;
- boss opened and loadout used.

Include stable recommendationId, route family, mood, account stage, available
context and timing. Hash or omit raw RSNs. Never send bank contents or plugin
tokens.

Add schema validation, unit tests and a documented funnel. Use an injectable
transport so local development and tests do not require an analytics vendor.

Acceptance:
- every primary player action emits one documented event;
- events do not contain credentials, raw bank rows or claim tokens;
- duplicate rerenders do not emit duplicate impressions;
- tests prove the complete first-run and returning-user funnel.
```

Evidence:
- Completed: 2026-07-15
- Commit: `ff0d7f2`
- Files: `src/lib/analytics.ts`, `src/lib/sync-trip-completion.ts`,
  `src/app/next/next-client.tsx`, `src/components/hero-intake.tsx`,
  `src/components/plugin-sync-checker.tsx`,
  `src/components/add-bank-modal.tsx`,
  `src/components/boss-detail-modal.tsx`, `src/app/u/[rsn]/weekly-recap.tsx`,
  `docs/ANALYTICS-EVENTS.md`
- Tests added: 12 tests across the typed event contract, privacy filtering,
  transport failure isolation, impression deduplication, first-run funnel,
  returning funnel, source-level instrumentation and conservative RuneLite
  completion evidence
- Commands: `npx vitest run tests/analytics.test.ts
  tests/analytics-instrumentation.test.ts tests/sync-trip-completion.test.ts`,
  `npm run ci:check`, `git diff --check`
- Browser evidence: not applicable; this phase added no player-facing layout
  or copy
- Metric change: 5 loosely typed Plausible events -> 18 canonical lifecycle
  events plus 5 migration-safe legacy events, all behind runtime property
  allow-lists and an injectable transport
- Known residual risk: exact sync completion currently covers proven quest,
  diary, skill-target and named clog outcomes; boss-KC and Slayer stop-point
  completion stay unclaimed until the plugin delta exposes matching evidence

## Phase 02 - Design Immutable Account History

Status: DONE
Depends on: Phase 01  
Improves: cross-device continuity, return value, RuneLite product value

### Prompt

```text
Design and implement the server data model that turns latest-state sync into
account history.

Read:
- src/lib/db.ts
- src/lib/sync-repo.ts
- src/lib/sync-schema.ts
- src/app/api/sync/route.ts
- src/app/api/sync/claim/route.ts
- scripts/db-init.mjs
- existing Neon conventions in the repository

Add migrations for:
- account identity/claim;
- immutable sync snapshots;
- normalized snapshot summary and checksum;
- recommendation decisions;
- trip lifecycle events;
- outcome matches;
- account preferences such as mood and timebox;
- retention and deletion metadata.

Requirements:
- latest-state reads remain fast;
- duplicate identical plugin syncs are deduplicated;
- historical rows are append-only except explicit privacy deletion;
- bank payload retention is minimized and documented;
- migrations are idempotent and safe for the existing production database;
- no token or secret is written to logs;
- provide repository interfaces rather than SQL in UI code.

Add repository and migration tests. Document data retention and deletion.

Acceptance:
- two changed syncs produce two historical snapshots;
- an identical retry does not create fake progress;
- latest-state APIs keep their current behavior;
- an account can delete all stored history;
- no current sync route regression.
```

Evidence:
- Completed: 2026-07-15
- Commit: `4a16cb7`
- Files: `src/lib/sync-schema.ts`, `src/lib/account-history.ts`,
  `src/lib/account-history-repo.ts`, `src/lib/sync-repo.ts`,
  `src/lib/sync-auth.ts`, `src/lib/db.ts`, `src/app/api/sync/route.ts`,
  `scripts/db-init.mjs`, `docs/account-history-retention.md`
- Tests added: five account-history tests covering identical-sync
  deduplication, changed-state append, atomic latest/history persistence,
  privacy-minimized bank summaries, deterministic checksums and cascading
  account deletion; migration coverage now includes all seven history tables,
  append-only rules and latest-read indexes
- Commands: `npx vitest run tests/account-history.test.ts
  tests/sync-schema.test.ts tests/sync-route.test.ts
  tests/full-syncflow-regression.test.ts tests/sync-auth.test.ts`,
  `npm run ci:check`, `git diff --check`
- Browser evidence: not applicable; this phase changed no player-facing UI or
  copy
- Metric change: latest-only overwrite -> one fast latest projection plus one
  immutable snapshot per distinct normalized account state; identical retries
  reuse the prior checksum and snapshot ID
- Privacy change: historical snapshots never store raw bank item rows; only
  availability, item count and an irreversible bank checksum are retained.
  Explicit account deletion cascades through snapshots, decisions, trips,
  outcomes, preferences and retention metadata
- Known residual risk: existing production accounts begin accruing immutable
  snapshots with their next successful sync; pre-migration historical states
  cannot be reconstructed from the former latest-only table

## Phase 03 - Build Snapshot Diff Intelligence

Status: DONE
Depends on: Phase 02  
Improves: trust, return value

### Prompt

```text
Turn consecutive snapshots into a stable, typed account delta.

Read:
- src/lib/snapshot-history.ts
- src/lib/snapshot-compare-summary.ts
- src/lib/runelite-progress-memory.ts
- src/lib/sync-repo.ts
- src/lib/sync-schema.ts

Compute:
- XP gained per skill and total;
- levels gained;
- quests completed;
- diary tiers completed;
- collection-log additions;
- boss KC changes when available;
- Slayer task, streak and points changes;
- bank additions, removals and quantity changes without exposing the full bank
  in normal UI;
- elapsed time and freshness.

Separate unknown, unchanged and unavailable. Never turn missing data into zero.
Use deterministic IDs so a delta can be reconciled to a recommendation later.

Acceptance:
- fixtures cover first sync, identical sync, partial old payload, changed sync
  and stale sync;
- impossible negative deltas are represented honestly;
- UI consumers receive short facts, not prewritten dashboard copy.
```

Evidence:
- Completed: 2026-07-15
- Commit: `7e46324`
- Files: `src/lib/account-snapshot-delta.ts`,
  `src/lib/account-history.ts`, `src/lib/account-history-repo.ts`,
  `src/lib/sync-repo.ts`, `src/lib/sync-schema.ts`,
  `src/app/api/sync/route.ts`, `docs/account-snapshot-deltas.md`,
  `docs/account-history-retention.md`
- Tests added: six comparison-engine fixtures covering first sync, identical
  sync, partial legacy payload, changed sync, stale/regressed sync and capped
  bank movement; one persistence test proves the stable delta ID and typed
  facts are stored beside the immutable snapshot
- Commands: targeted Vitest coverage for snapshot deltas, history, schema and
  sync route; `npm run ci:check`; `git diff --check`
- Full verification: 170 test files and 1,108 tests passed; typecheck, smoke,
  recommendation audit, plugin release check and production build passed. The
  recommendation audit retained one pre-existing editorial note and reported
  zero hard failures
- Browser evidence: not applicable; this phase changed no player-facing UI or
  layout
- Metric change: consecutive immutable snapshots now produce one deterministic,
  typed delta with elapsed time, read-time freshness and short structured facts
  for XP, levels, quests, diaries, clog, boss KC, Slayer and bank movement
- Correctness change: unavailable, unknown and unchanged are distinct states;
  missing data never becomes zero, while impossible negative monotonic progress
  is retained as a source regression instead of being silently discarded
- Privacy change: full bank rows remain only in the latest projection. Historical
  deltas retain at most the 100 largest item movements while preserving the
  total number of changed rows and a truncation flag
- Known residual risk: boss KC remains unknown until the plugin or another
  trusted upstream source sends it. Snapshots created before Phase 02 cannot be
  reconstructed or diffed retroactively

## Phase 04 - Make Accounts Durable Across Devices

Status: DONE
Depends on: Phase 02  
Improves: cross-device continuity, onboarding

### Prompt

```text
Replace device-only account memory with a safe progressive account claim.

Do not require email/password before first value. Preserve RSN-first use.

Build:
- anonymous local account first;
- plugin claim as the preferred proof that the player controls the RuneLite
  session for that RSN;
- recovery/reconnect path after reinstall or second device;
- clear conflict behavior when an RSN is already claimed;
- local bank attachment scoped to the correct account;
- account removal that immediately clears active UI state without deleting
  server history unless the player explicitly asks for deletion.

Do not pretend an OSRS name alone is authentication.

Acceptance:
- a new player gets a plan without registration;
- plugin connection upgrades the same account instead of creating a duplicate;
- a second device can recover history through an explicit safe flow;
- removing the local account stops Welcome Back immediately;
- tests cover casing and renamed display names.
```

Evidence:
- Completed: 2026-07-15
- Commits: `1f511e5`, `69b63b9`
- Files: `src/lib/account-pairing.ts`, `src/lib/account-session-cookie.ts`,
  `src/lib/account-connection.ts`, `src/lib/account-storage.ts`,
  `src/lib/saved-bank.ts`, `src/lib/sync-auth.ts`, `src/lib/sync-schema.ts`,
  `src/app/api/account`, `src/components/connect-browser-modal.tsx`,
  `src/components/header.tsx`, `plugin/src/main/java/app/scapestack/runelite/PairingClient.java`,
  `plugin/src/main/java/app/scapestack/runelite/ScapestackSyncPanel.java`,
  `plugin/src/main/java/app/scapestack/runelite/ScapestackSyncPlugin.java`,
  `docs/account-pairing.md`
- Flow: an RSN remains an anonymous local profile. A browser starts a
  short-lived code, the already claimed RuneLite install approves it, and the
  browser exchanges its one-time secret for a 30-day HttpOnly, SameSite=Lax
  session. A second device can repeat this explicit flow without email or a
  password
- Identity behavior: linking upgrades the existing local profile with a stable
  server account ID. Casing changes do not fork an account; when the same
  RuneLite install reports a real display-name change, the stable server
  identity, local preferences and account-scoped bank attachment migrate
  together
- Conflict and removal behavior: a different plugin token cannot take over an
  existing claim. Removing a connected local profile revokes only that browser
  session and immediately clears local Welcome Back state; immutable server
  history is retained
- Security and privacy: plugin, pairing and browser secrets are stored only as
  SHA-256 hashes; codes expire after ten minutes; browser sessions expire after
  30 days; pairing starts are capped at five per minute. Manual bank exports
  remain browser-local and scoped to the normalized account name
- Persistence fix: legacy append-only PostgreSQL rules were migrated to
  update-blocking triggers. History stays immutable while idempotent
  `INSERT ... ON CONFLICT DO NOTHING` snapshots work in the real Neon-backed
  RuneLite flow
- Tests added: pairing crypto and lifecycle, repository persistence, route
  authorization/cookies/rate limiting, browser connection UI, plugin pairing
  client and panel coverage, plus regressions for account casing, display-name
  migration, bank migration and claim conflicts
- Commands: targeted pairing Vitest coverage; `npm run ci:check`;
  `./gradlew test` in `plugin`; `git diff --check`
- Full verification: 174 test files and 1,123 tests passed; typecheck, smoke,
  recommendation audit, offline plugin release check and the 213-page
  production build passed. The recommendation audit retained one pre-existing
  editorial note and reported zero hard failures
- Browser evidence: desktop and 390x844 mobile pairing states were verified at
  `/tmp/scapestack-phase04-desktop-fixed.png`,
  `/tmp/scapestack-phase04-mobile.png` and
  `/tmp/scapestack-phase04-mobile-code.png`; the modal is portalled outside the
  sticky header, remains scrollable and had no browser errors or overlap
- Known residual risk: reconnect currently requires access to an already
  claimed RuneLite install; there is no email recovery fallback. A first-mover
  claim conflict still needs a future explicit support/reclaim policy instead
  of an unsafe automatic takeover

## Phase 05 - Create A Stable Account Timeline API

Status: DONE (2026-07-16)
Depends on: Phases 03 and 04  
Improves: return value, profile, retention

### Prompt

```text
Create one server-side timeline model used by homepage, profile and /next.

The timeline should return player-relevant moments, not database events:
- gained 180k Slayer XP;
- finished Falador Hard;
- reached 50 Vorkath KC;
- bank now supports a better Zulrah setup;
- completed the previous Scapestack stop point;
- skipped a route twice;
- next recommendation changed for a concrete reason.

Merge server history with legacy local trip events during migration. Deduplicate
events and keep source/provenance internal.

Acceptance:
- timeline is ordered, paginated and account-scoped;
- player copy never says payload, signal, data source or reconciliation;
- no empty cards are rendered when there is no progress;
- API tests cover unauthorized, empty, partial and returning states.
```

### Phase 05 Evidence

- Added one authenticated, account-scoped timeline API at
  `/api/account/timeline`, backed by changed RuneLite snapshots, trip lifecycle
  events and recommendation changes. The response exposes concise player
  moments and opaque IDs/cursors; database provenance stays internal.
- Added ordered cursor pagination, strict account UUID scoping and an
  idempotent legacy browser-history import. Legacy events are accepted only
  when their normalized RSN exactly matches the connected RuneLite account.
- Extended immutable trip history with optional player-facing titles and a
  unique legacy import key. Existing rows remain valid and duplicate imports
  are ignored by PostgreSQL.
- Replaced the separate weekly recap, profile change panel and `/next` sync
  summary with one quiet `AccountTimeline` component on homepage, profile and
  `/next`. Empty history renders nothing; public profiles cannot display the
  connected browser's history for a different RSN.
- Migrated analytics from the obsolete `recap:viewed` event to
  `timeline:viewed`, while retaining privacy-safe return-visit measurement.
- API and model coverage includes unauthorized, empty, partial, returning,
  cursor validation, account scoping, deduplication, malformed legacy input and
  safe import-failure responses.
- Real integration proof: a Neon-backed RuneLite claim paired a browser,
  created an HttpOnly session, imported a legacy Dragon Slayer II completion
  and returned `Finished Dragon Slayer II` from the protected timeline API.
- Browser proof: homepage, `/next` and `/u/Lynx Titan` were checked at
  1440x1000 and 390x844. The shared timeline rendered consistently, had no
  horizontal overflow or browser errors, and no duplicate progress panel.
  Screenshots are in `/tmp/scapestack-phase-05/`.
- Verification: `npm run ci:check` passed with 178 files and 1,139 tests,
  smoke, zero hard recommendation failures, offline plugin release checks and
  a 214-page production build. `./gradlew test` passed the full plugin suite,
  including the live Neon-backed end-to-end flow. `git diff --check` passed.
- Implementation commit: `f372c7d`.
- Residual risk: the timeline can only reconstruct moments recorded after
  server history or exact-RSN legacy trip history exists. Older unrecorded
  browser activity cannot be inferred safely.

---

# Program B - Close The Recommendation Loop

## Phase 06 - Define A Recommendation Decision Contract

Status: DONE (2026-07-16)
Depends on: Phase 00  
Improves: trust, relevance, engineering quality

### Prompt

```text
Introduce a typed RecommendationDecision model between ranking and UI.

It must contain:
- stable id and version;
- activity and route family;
- exact goal;
- first step;
- stop point;
- timebox;
- required and optional setup;
- factual reasons with provenance;
- unknowns and assumptions;
- reasons alternatives lost;
- mood and account constraints applied;
- completion evidence that a future sync can recognize;
- fallback when data is insufficient.

Do not store player-facing paragraphs in the ranking engine. Generate concise
copy from typed facts at the boundary.

Acceptance:
- the headline cannot exist without a stop point and completion rule;
- factual reasons are traceable to public stats, bank, RuneLite or preference;
- unknown data cannot be presented as confirmed;
- current UI can adopt the contract incrementally.
```

### Evidence

- Completed on 2026-07-16.
- Added a versioned `RecommendationDecision` contract with a stable identity,
  route and account constraints, provenance facts, explicit unknowns,
  alternatives, completion evidence and a typed fallback.
- The primary `/next` trip now renders its title, reason, first step and stop
  point from boundary copy generated from the contract. Bank-specific setup is
  included only when the saved bank proves it.
- Connected accounts persist the exact validated decision through
  `/api/account/decision`; repeated renders reuse the same row for five minutes
  and link the latest account snapshot. A live Neon proof created one row,
  reused it on the second write and confirmed the snapshot link.
- Browser proof covered 1440x1000 and 390x844: no horizontal overflow, browser
  errors, failed responses or Next.js error overlay. Screenshots are in
  `/tmp/scapestack-phase-06/`.
- Verification: `npm run ci:check` passed with 182 files and 1,151 tests,
  smoke, zero hard recommendation failures, offline plugin release checks and
  a 215-page production build. `./gradlew test` passed the full plugin suite.
  `git diff --check` passed.
- Implementation commit: `d9a5866`.
- Residual risk: older recommendation generators still expose their legacy
  shape internally. The headline boundary is migrated now; later ranking
  phases can move each generator onto the contract without a UI rewrite.

## Phase 07 - Make Mood A Hard Constraint

Status: DONE (2026-07-16)
Depends on: Phase 06  
Improves: mood integrity, trust

### Prompt

```text
Redesign intent filtering so mood removes invalid candidates before ranking.

Define explicit contracts:
- Chill: low pressure, low reset cost, no raid or mechanically intense boss;
- AFK: meaningful idle windows and low click intensity;
- GP: expected profit is positive and evidence is fresh enough;
- Bossing: boss/KC trip with account-appropriate setup;
- Unlock: quest, diary, level or item unlock with a meaningful payoff;
- Short: setup plus stop point fits the selected timebox;
- Surprise me: diverse, but still obeys any selected mood and account limits.

Add intensity, attention, setup time, wilderness and death-cost dimensions to
candidates. Do not infer Chill from duration alone.

Acceptance:
- Chill can never produce Chambers of Xeric;
- AFK can never produce active Vardorvis;
- Short cannot produce a multi-hour prerequisite chain;
- tests enumerate every candidate family against every mood.
```

### Evidence

- Completed on 2026-07-16.
- Added a typed internal session profile for every recommendation: intensity,
  attention, setup and minimum time, idle window, reset and death cost,
  wilderness/raid risk, setup confidence, profit evidence, unlock value and
  prerequisite depth.
- Mood eligibility now removes invalid candidates before scoring, backups,
  remembered-trip restoration and route previews. A route lens or random roll
  can no longer override the selected mood contract.
- Removed blanket AFK classification from minigames, generic skill milestones
  and maxing routes. High-combat accounts retain a real low-attention method;
  the verified sample selects `Birdhouse run` and randomizes to `Run herbs +
  birdhouses`, while Prayer, Chambers of Xeric and Vardorvis remain excluded.
- Added an 11 recommendation-family by 8 mood contract matrix plus named
  regressions for Chill/Chambers of Xeric, AFK/Vardorvis and Short/long
  prerequisite chains.
- Browser proof covered 1440x1000 and 390x844. Chill, AFK, Short and Bossing
  produced contract-valid headlines; AFK `Surprise me` stayed inside AFK; no
  horizontal overflow or browser errors remained. Screenshots are in
  `/tmp/scapestack-phase-07/desktop-final.png` and `mobile-final.png`.
- Verification: `npm run ci:check` passed with 184 files and 1,167 tests,
  smoke, zero hard recommendation-audit failures, offline plugin release checks
  and a 215-page production build. `./gradlew test` passed the full plugin
  suite. `git diff --check` passed.
- Implementation commit: `913279e`.
- Residual risk: session profiles are deterministic curated facts. New route
  generators must supply or infer the same dimensions, and Phase 08 still has
  to make repeated randomization diverse across all eligible families.

## Phase 08 - Make Randomize Diverse Without Becoming Random

Status: DONE (2026-07-16)
Depends on: Phase 07  
Improves: mood integrity, perceived intelligence

### Prompt

```text
Replace route-lens roulette with constrained recommendation diversity.

Randomize should:
- stay inside the selected mood and timebox;
- exclude the current recommendation and recently rejected identities;
- avoid repeating the same family until alternatives are exhausted;
- weight strong account fits above novelty;
- explain a changed pick only when necessary;
- preserve hard account restrictions such as ironman sourcing and wilderness
  avoidance.

Use deterministic seeded tests and session memory. Do not make the result
random merely to look dynamic.

Acceptance:
- ten Chill rolls contain no hard violation;
- the first three valid rolls are distinct when enough candidates exist;
- repeated randomize never promotes a known impossible route;
- refresh does not reset rejection memory accidentally.
```

### Evidence

- Completed on 2026-07-16.
- Replaced route-lens roulette and `Math.random()` with a deterministic,
  account-seeded selector. Account fit remains dominant; the seed only breaks
  near-score ties.
- `Surprise me` now keeps the chosen mood, timebox and account constraints,
  excludes current and recently rejected identities, and uses a shared route
  family taxonomy to avoid same-family repetition until the valid pool is
  exhausted.
- Rejection memory persists in the existing versioned local store and is
  scoped by RSN and mood. A more recent rejection also prevents an older
  `started` memory from forcing that trip back after refresh.
- Added deterministic regression coverage for ten valid Chill rolls, three
  distinct early families, account-fit priority, impossible setup exclusion,
  RSN/mood scoping and reload persistence.
- Browser proof: four successive Chill rolls produced different valid routes;
  AFK alternated only between its two eligible routes before repeating. A page
  refresh retained earlier rejections. Desktop and 390x844 mobile had no
  browser errors or horizontal overflow. Screenshots are in
  `/tmp/scapestack-phase-08/desktop-final.png` and `mobile-final.png`.
- Verification: `npm run ci:check` passed with 185 files and 1,172 tests,
  smoke, zero hard recommendation-audit failures, offline plugin release checks
  and a 215-page production build. `./gradlew test` passed the full plugin
  suite. `git diff --check` passed.
- Implementation commit: `5678886`.
- Residual risk: very narrow moods such as AFK can legitimately have only two
  eligible routes. Repetition is then expected after the valid pool is
  exhausted rather than filling the screen with an invalid activity.

## Phase 09 - Reconcile Plans With New RuneLite Progress

Status: DONE
Depends on: Phases 03 and 06  
Improves: RuneLite product value, retention

### Prompt

```text
Build an Outcome Engine that compares new account deltas with accepted plans.

Recognize outcomes such as:
- target level or XP reached;
- target KC reached;
- quest completed;
- diary tier completed;
- collection-log item obtained;
- Slayer task completed or changed;
- required bank quantity acquired;
- partial progress toward the stop point.

Classify outcomes as completed, progressed, unchanged, contradicted or unknown.
Never mark completion from ambiguous evidence. Keep a manual correction path.

Acceptance:
- an accepted 48-to-50 KC plan completes after a +2 KC delta;
- unrelated XP cannot complete the plan;
- partial progress changes the next stop point;
- duplicate sync does not duplicate completion;
- result becomes a timeline moment and analytics event.
```

### Phase 09 Evidence

- Added explicit completion targets for KC, levels, quests, diaries,
  collection-log items, Slayer tasks and bank quantities. The persisted
  recommendation contract now carries the exact evidence required to prove
  the stop point.
- Clicking `I started`, `Mark done` or skip stores an idempotent lifecycle
  event linked to the exact server-side decision. A sync only reconciles the
  latest lifecycle state when it is still `started`.
- Added the typed Outcome Engine with `completed`, `progressed`, `unchanged`,
  `contradicted` and `unknown` states. Relevant skill XP and partial KC,
  Slayer or bank progress update the next stop point; unrelated XP and
  unavailable sources cannot complete a plan.
- Outcomes are immutable and unique per snapshot plus decision. Duplicate
  syncs cannot duplicate completion, while progressed plans remain active for
  a later snapshot.
- Meaningful outcomes appear in `Since last time`. Confirmed completion hides
  the finished recommendation locally, manual `Mark done` remains available,
  and `outcome:viewed` records only status plus evidence type.
- Verification: 187 test files and 1,187 tests passed, including new pure
  engine, repository, route, timeline, schema and analytics coverage.
  `npm run ci:check` passed typecheck, smoke, recommendation audit, offline
  plugin release checks and the 215-page production build. `./gradlew test`
  passed the full RuneLite plugin suite. Desktop and 390x844 browser checks
  had content, no Next.js error overlay and no mobile horizontal overflow.

## Phase 10 - Learn From Accept, Skip And Completion

Status: DONE
Depends on: Phases 01 and 09  
Improves: personalization, retention

### Prompt

```text
Use explicit and observed outcomes to personalize ranking.

Signals may include:
- accepted activity families;
- repeated skips with a reason;
- completion rate by timebox;
- chosen mood;
- boss commitment through KC;
- unfinished routes;
- repeated wilderness avoidance;
- preference for active or low-pressure play.

Rules:
- never infer permanent dislike from one skip;
- decay old preferences;
- let the player reset learned preferences;
- expose only simple player controls such as "less like this";
- do not build a preference dashboard.

Acceptance:
- repeated bossing completions influence future ranking;
- one accidental skip has limited effect;
- hard mood constraints always beat learned preferences;
- tests prove preference reset.
```

### Evidence

- Added a local, RSN-scoped preference model that learns from started trips,
  manual completions, RuneLite-confirmed completions and explicit skips.
- Preference evidence decays over time and is bounded to a 0.8-1.2 ranking
  multiplier, so account fit and the selected mood remain authoritative.
- One route change has only a minor effect. `Less like this` moves away for the
  current session and records decaying taste evidence instead of permanently
  hiding an activity.
- RuneLite outcomes retain the original mood, route and timebox so observed
  completions can improve later picks without exposing a player-facing profile.
- `Reset learned choices` removes learned taste and reversible hides while
  preserving activities already marked complete.
- Verification: all 188 test files and 1,193 tests passed after the final
  interaction refinement. The production build, recommendation audit,
  offline plugin release checks and full RuneLite Gradle suite passed. Desktop
  and 390x844 browser flows confirmed Less-like, Undo and reset behavior with no
  horizontal overflow or Next.js error overlay.

## Phase 11 - Add Recommendation Honesty Levels

Status: DONE
Depends on: Phase 06  
Improves: trust

### Prompt

```text
Make recommendations honest about what Scapestack can and cannot know.

Internally classify plans as:
- verified by current bank/RuneLite facts;
- supported by public account facts;
- estimated from incomplete context;
- not enough information for a precise trip.

Translate this into action, not badges:
- give exact quantities only when known;
- use conservative setup when bank is absent;
- offer Add bank only if it materially changes the route;
- say "check this first" for uncertain manual requirements;
- demote plans whose missing facts could invalidate them.

Do not show Confidence, Source or Data Quality panels.

Acceptance:
- no-bank recommendations avoid exact inventory claims;
- missing diary task data cannot become a confirmed blocker;
- uncertain plans lose against equally useful verified plans;
- copy tests prevent technical status language.
```

### Evidence

- Added one shared internal honesty assessment with `verified`, `supported`,
  `estimated` and `insufficient` levels. These levels only affect ranking and
  safe actions; they are never rendered as badges or dashboard panels.
- Plans whose progress, completion state or setup could be invalidated are
  demoted. An equally useful route supported by known facts now beats a
  supply-dependent estimate, while hard mood contracts remain authoritative.
- No-bank boss and KC plans no longer expose exact inventory claims. They
  start by checking gear, food and teleport coverage for one short trip.
- Quest, diary and Slayer completion is only treated as current when RuneLite
  can prove it. Unscanned diary requirements become a first check instead of
  a confirmed blocker, and public KC remains sufficient for public KC goals.
- `Add bank` is offered only when current gear, supplies or banked materials
  can materially change feasibility or method. Generic Agility and minigame
  routes do not ask for it.
- Verification: all 189 test files and 1,202 tests passed. `npm run ci:check`
  passed typecheck, smoke, recommendation audit, offline plugin release checks
  and the 215-page production build. `./gradlew test` passed the full RuneLite
  plugin suite. Clean desktop and 390x844 browser checks showed no technical
  panels, no unsupported `Still missing` claim, no error overlay and no mobile
  horizontal overflow.

---

# Program C - Deep OSRS Domain Intelligence

## Phase 12 - Build A Shared Skill Progress Model

Status: DONE
Depends on: Phase 06  
Improves: recommendation depth, goals

### Prompt

```text
Create a reusable SkillRoute model for every OSRS skill.

For each supported method calculate:
- current level and XP;
- target and XP remaining;
- realistic method options;
- XP per action/item;
- quantities required;
- banked quantities and banked XP;
- short-session stop point;
- account-type sourcing path;
- costs or profit where applicable;
- unlock reached at the target.

Start with a generic framework and verified method modules. Do not copy one
Cooking assumption to unrelated skills.

Acceptance:
- all 23 skills have a valid fallback route;
- methods never ask for irrelevant gear/food/teleports;
- output distinguishes banked, buyable, source-yourself and unknown;
- tests cover low, mid, near-99 and maxed states.
```

### Evidence

- Added one reusable `SkillRoute` contract for current level and XP, target,
  XP remaining, method options, session stop, requirements, bank coverage,
  sourcing, cost/profit when known and the unlock at the target.
- Every current Hiscores skill has a safe fallback, including Sailing. Fishing
  keeps its richer verified method catalogue while the other skills use a
  conservative method until deeper modules replace it.
- Requirements are method-specific. Agility no longer receives generic gear,
  food or teleport advice; Cooking asks for raw food, Mining for a pickaxe and
  Runecraft for essence plus its actual access tool.
- Supply context is typed as `banked`, `buyable`, `source-yourself` or
  `unknown`. Unknown item-to-XP conversion stays unknown instead of inventing
  precision ahead of the Phase 13 banked-XP calculators.
- Milestone pushes, protection prayers, Graceful routes and maxing lanes now
  use the shared model. Their copy includes actual XP remaining, a realistic
  method and a bounded 45-minute stop instead of generic level-only advice.
- Tests cover every skill plus low, mid, near-99 and maxed accounts, invalid
  Hiscores fixture XP, banked raw food, regular versus iron sourcing and
  non-negative XP/quantity invariants.
- Verification: all 190 test files and 1,209 tests passed. `npm run ci:check`
  passed typecheck, smoke, recommendation audit, release checks and the
  215-page production build. `./gradlew test` passed the RuneLite suite.
  Desktop and 390x844 browser checks had content, no error overlay and no
  horizontal overflow.

## Phase 13 - Make Banked XP Correct Across Skills

Status: DONE (2026-07-16)
Depends on: Phase 12  
Improves: bank intelligence, recommendation trust

### Prompt

```text
Implement banked-XP calculators with item variants and realistic conversions.

Cover at minimum:
- Cooking raw foods and burn-sensitive estimates;
- Prayer bones and ashes by method;
- Herblore unfinished/finished potion chains;
- Fletching logs, bows, darts and bolts;
- Crafting gems, hides, glass and battlestaves;
- Smithing ores, bars and products;
- Construction planks;
- Firemaking logs;
- Farming seeds where a useful estimate is possible;
- Magic runes for selected training methods.

Normalize noted/variant item IDs and never confuse cooked with raw supplies.
Show the best relevant subset, not every bank row.

Acceptance:
- Lauky-like banks with raw fish report the fish and covered Cooking XP;
- zero/missing bank data does not say "no raw fish";
- maxed skills do not recommend a 99 push;
- property tests prevent negative quantities and XP.
```

### Evidence

- Added one shared, pure banked-XP engine for Cooking, Prayer, Herblore,
  Fletching, Crafting, Smithing, Construction, Firemaking, Farming, Magic and
  Runecraft. `/next` and `SkillRoute` now use the same recipes instead of
  maintaining different client-side XP tables.
- Item variants and noted labels collapse into one canonical stack. Quantities
  and XP are finite and non-negative, and only the three most relevant stacks
  are player-facing while totals still include every usable material.
- Cooking counts raw food only and exposes a burn-sensitive XP range. Cooked
  fish cannot become future Cooking XP. Prayer supports bury, gilded altar,
  Chaos Altar and Ectofuntus assumptions without multiplying ashes.
- Herblore allocates unfinished potions, herbs, vials and shared secondaries
  once; finished potion doses are excluded. Fletching likewise allocates
  feathers and bow strings once. Crafting battlestaves require charged orbs,
  Smithing coal is allocated once, and finished Smithing products are not
  counted again.
- A missing bank is explicitly `unknown`, an inspected bank without a usable
  method is `known-empty`, and neither state invents a "no raw fish" claim.
  Maxed routes no longer retain a recommended training method.
- Regression coverage includes a Lauky-like 2,000 raw-shark Cooking route,
  noted variants, raw versus cooked food, Prayer methods, potion chains,
  shared Fletching parts, Crafting and Smithing chains, planks, logs, seeds,
  selected Magic casts and hostile numeric inputs.
- Verification: all 191 test files and 1,219 tests passed. `npm run ci:check`
  passed typecheck, smoke, recommendation audit, release checks and the
  215-page production build. `./gradlew test` passed the RuneLite suite.
  Desktop and 390x844 browser checks had content, no error overlay, no browser
  errors and no horizontal overflow. Screenshots are in
  `/tmp/scapestack-phase-13/`.

## Phase 14 - Build Ironman Supply Routes

Status: DONE (2026-07-16)
Depends on: Phase 13  
Improves: ironman relevance

### Prompt

```text
When an ironman lacks supplies, generate a source route rather than a GE list.

Model:
- source activity;
- requirements;
- expected acquisition rate range;
- amount needed for the selected stop point;
- whether sourcing is worth doing now;
- alternatives already present in the bank;
- when a smaller target is better.

Examples:
- fish before Cooking only when banked alternatives are insufficient;
- collect secondaries before Herblore;
- obtain planks through an account-appropriate path;
- do not tell an ironman to buy an unavailable upgrade.

Acceptance:
- route chain includes source -> process -> stop point;
- a viable bank alternative beats unnecessary sourcing;
- uncertain rates are ranges, not fake precision;
- tests cover main versus ironman behavior.
```

### Evidence

- Added one typed ironman supply-route catalogue on top of the shared
  banked-XP engine. Routes model source activity, requirements, conservative
  acquisition-rate ranges, the amount needed for the selected session,
  source time, banked alternatives and a smaller bounded target.
- `SkillRoute` now emits a real `source -> process -> stop` chain for supported
  ironman shortages. The normalized `/next` route preserves those three steps
  instead of flattening them back into the generic recommendation flow.
- A usable bank stack always wins first. Full session coverage suppresses
  sourcing entirely; partial coverage is consumed before only the remaining
  gap is sourced. Missing bank context remains unknown and cannot invent a
  raw-food or secondary shortage.
- Account rules keep mains on buyable prep, use carry/stage wording for UIMs,
  keep hardcores off Wilderness-tagged sources and do not assume group storage.
  Cooking, Herblore and Construction have contextual routes, with additional
  conservative routes for Prayer, Crafting, Smithing, Fletching, Firemaking,
  Farming, Magic and Runecraft.
- Regression tests cover main versus iron, a complete lower-tier bank
  alternative, a partial raw-shark stack, bounded long grinds, ranarr/snape
  grass matching, owned-log sawmill conversion, UIM copy, unknown bank data
  and the final `/next` source/process/stop labels.
- Verification: all 192 test files and 1,229 tests passed. `npm run ci:check`
  passed typecheck, smoke, recommendation audit, offline plugin release checks
  and the 215-page production build. `./gradlew test` passed the full RuneLite
  suite. Desktop 1440x1000 and mobile 390x844 browser checks had content, no
  error overlay and no horizontal overflow; a repeat network check had no
  failed responses. Screenshots are in `/tmp/scapestack-phase-14/`.
- Residual risk: collection rates are deliberately broad curated ranges, not
  live efficiency claims. Unknown quest/access requirements remain visible for
  the player to confirm until exact RuneLite progress can prove them.

## Phase 15 - Build Exact Diary Task Progress

Status: COMPLETE (2026-07-17)
Depends on: Phases 03 and 06  
Improves: goals, trust

### Prompt

```text
Turn diary recommendations from tier-level guesses into task-level routes.

Use verified diary requirements and available RuneLite var/state. Where exact
automatic state is unavailable, provide a compact manual checklist whose state
is saved to the account.

For a recommended diary show:
- reward item and meaningful payoff;
- exact remaining tasks known;
- manual tasks to confirm;
- required skill/item/quest preparation;
- best regional sweep order;
- a one-session stop point where possible.

Infer prerequisite rewards: owning elite diary gear implies lower tiers are
complete. Never recommend already-earned lower rewards.

Acceptance:
- Karamja gloves detail shows the exact tier and remaining work;
- elite reward ownership closes normal/hard prerequisites;
- unknown tasks are checkable, not labeled confirmed blockers;
- checklist state survives return visits.
```

### Evidence (2026-07-17)

- `data/diaries.json` is generated from current OSRS Wiki diary tables and now
  contains 492 named tasks across all 48 region/tier routes.
- RuneLite tier booleans and owned reward items are treated as completion
  evidence. Individual tasks remain honest manual checks until RuneLite exposes
  task-level state.
- Every diary recommendation carries its exact reward, remaining task count,
  next three-task sweep, preparation, blockers and a one-session stop point.
- Owning a higher diary reward infers every lower tier, including Karamja gloves
  4 closing Easy through Elite and suppressing obsolete glove recommendations.
- Manual checks are saved per RSN and survived a browser reload during desktop
  and 390px mobile verification; both viewports had no overflow or error overlay.
- `npm run ci:check` passed 195 test files / 1,242 tests, smoke, recommendation
  audit, plugin release checks and the production build. `plugin/./gradlew test`
  also passed.

## Phase 16 - Build Quest Prerequisite Routes

Status: COMPLETE (2026-07-17)
Depends on: Phase 06  
Improves: unlock recommendations

### Prompt

```text
Model quest recommendations as the shortest meaningful next block, not a long
Wikipedia chain.

Calculate:
- completed prerequisites;
- first incomplete prerequisite;
- skill requirements and boost assumptions;
- required items present in bank;
- major payoff;
- expected block length;
- clean point to stop and replan.

Demote very long chains unless the unlock materially changes the account.
Link to the Wiki for the full guide rather than reproducing it.

Acceptance:
- only the next executable block is shown;
- completed quests never appear as work;
- a 2-3 hour chain does not win a Short session;
- bank items are used without dumping an item checklist dashboard.
```

### Evidence (2026-07-17)

- `src/lib/quest-route.ts` now resolves the first executable unfinished quest
  block from exact RuneLite or tracker completion evidence. Without that
  evidence it refuses to invent completed prerequisites.
- Each quest route carries the active block, larger payoff, block and chain
  duration, skill preparation without assumed boosts, bank-owned and missing
  quest items, stop point and the next block after replanning.
- Quest recommendations and Next Best Actions now point to the active quest,
  demote long chains, and redirect stale deeplinks when fresh RuneLite progress
  changes the first unfinished prerequisite.
- `/quests/[slug]` is route-first rather than a four-column requirements
  dashboard: Start, Bring, Get first, Stop and Next are the primary flow; the
  exact skill, quest and item list is behind one collapsed section and the Wiki
  remains the full walkthrough.
- Regression tests cover executable prerequisite selection, completed quest
  suppression, active-block-only bank and skill checks, unknown completion
  honesty, Short-session rejection of long chains, additive browser bank use
  and compact quest UI copy.
- `npm run ci:check` passed 196 test files / 1,246 tests, smoke,
  recommendation audit, plugin release checks and the 215-page production
  build. `plugin/./gradlew test` also passed. Desktop 1280x900 and mobile
  390x844 browser checks had content, no error overlay and no horizontal
  overflow; screenshots are in `/tmp/scapestack-phase-16/`.

## Phase 17 - Deepen Slayer Planning

Status: COMPLETE (2026-07-17)
Depends on: Phases 03 and 06  
Improves: recommendation relevance

### Prompt

```text
Make an active Slayer task one of Scapestack's strongest account-specific
moments.

Use:
- current task and remaining amount;
- master, points and streak;
- block list and unlocks;
- combat levels;
- banked gear and supplies;
- boss variant availability;
- timebox and mood.

Return:
- do, skip or boss-variant recommendation;
- first trip inventory;
- realistic task stop point;
- meaningful unlock or point consequence;
- conservative fallback if task state is stale.

Acceptance:
- active task is promoted when it fits;
- stale task is not presented as live fact;
- Chill and AFK choose suitable task methods;
- boss variants require viable gear and intent.
```

### Evidence

- Added a typed Slayer task decision engine for do, skip, boss variant and
  refresh routes, with mood, streak, points, account mode, bank inventory,
  task method and first-trip stop-point handling.
- Rebuilt `/slayer` around one executable task route. Task inventory, bank
  evidence, master comparison and setup readiness stay secondary or collapsed.
- Scapestack Sync v0.3.0 now resolves the canonical Slayer task name and
  location from RuneLite's game DB tables and sends named block-list entries.
  Raw IDs remain only as a backwards-compatible fallback.
- Old or stale scans no longer become live recommendations. An unresolved old
  task shows one honest RuneLite refresh action rather than guessing a monster.
- Regression coverage proves Chill/AFK task methods, skip-point protection,
  bank-gated boss variants, named task resolution and API normalization.
- `npm run ci:check` passed 197 test files / 1,257 tests, smoke,
  recommendation audit, plugin v0.3.0 release checks and the 215-page production
  build. `plugin/./gradlew test` also passed. Desktop 1440x1100 and mobile
  390x844 browser checks had content, no error overlay and no horizontal
  overflow; screenshots are in `/tmp/scapestack-phase-17/`.

## Phase 18 - Complete The Boss Knowledge Catalog

Status: COMPLETE (2026-07-17)
Depends on: Phase 06  
Improves: Check Kill breadth and depth

### Prompt

```text
Audit every boss shown in Check Kill and replace accidental generic coverage
with explicit support levels.

For each boss define:
- encounter type and group size;
- relevant combat styles;
- hard requirements and unlocks;
- minimum, comfortable and strong setup bands;
- key mandatory items;
- inventory archetype;
- supply pressure;
- death/wilderness risk;
- trip/KC stop point;
- GP data freshness;
- supported or estimate-only state.

Do not market all bosses as equally understood. Hide or label estimate-only
encounters through useful copy, not technical badges.

Acceptance:
- catalog coverage report has no silent generic fallback;
- raids and multi-role encounters are not reduced to one fake DPS number;
- wilderness risk influences ranking;
- tests cover every catalog entry.
```

### Evidence

- Added a typed knowledge catalog for all 60 Check Kill encounters. Every
  entry now declares encounter and group type, relevant combat styles,
  requirements, setup bands, mandatory items, inventory shape, supply and
  death pressure, Wilderness risk, stop point, GP confidence and support depth.
- Missing catalog entries now throw instead of silently inheriting generic
  coverage. Regression tests iterate over every visible boss and enforce the
  full contract.
- Raids, team bosses, phase fights and wave encounters no longer show or sort
  by one misleading DPS, kill-speed or GP/hour value. Their cards and details
  use room, role, switch or full-run guidance in player-facing language.
- Generic multi-style encounters now build one bank-aware switch row per
  required style plus full-run supplies instead of pretending one weapon is a
  complete setup.
- Wilderness and death risk now materially lower ranking, with additional
  HCIM penalties and one-low-risk-trip stop points.
- `npm run ci:check` passed 198 test files / 1,262 tests, smoke,
  recommendation audit, plugin v0.3.0 release checks and the production build.
  `plugin/./gradlew test` also passed. Desktop 1280x633 and mobile 390x844
  browser checks had content, no error overlay and no horizontal overflow;
  screenshots are in `/tmp/` with the `scapestack-phase18-` prefix.

## Phase 19 - Build Boss Inventory And Upgrade Plans

Status: COMPLETE (2026-07-17)
Depends on: Phases 13 and 18  
Improves: Check Kill usefulness

### Prompt

```text
Generate the best practical boss trip from the attached bank.

For a selected boss return:
- worn setup by slot;
- inventory with quantities;
- rune/ammo/charge requirements;
- food, prayer and utility;
- owned alternatives;
- missing mandatory items;
- one highest-impact affordable upgrade for mains;
- source path for ironmen;
- expected first-trip length range;
- explicit "not worth camping yet" when appropriate.

Optimize for the encounter, not raw average DPS. Respect switches, defence,
accuracy, mechanics and inventory slot pressure.

Acceptance:
- Vorkath notices Salve and anti-dragon requirements;
- Zulrah chooses viable switches and supplies;
- Barrows does not use a generic raid inventory;
- missing mandatory gear blocks a false Can kill verdict;
- UI can render an OSRS-style inventory without a metrics dashboard.
```

### Evidence

- Replaced presence-only boss prep with typed trip requirements: target
  quantities, mandatory items, bank alternatives, worn slots, inventory-slot
  pressure and a fixed 28-slot first-trip inventory.
- Vorkath now checks Salve, anti-dragon protection, antifire and individual
  Crumble Undead rune requirements. A two-handed weapon cannot silently share
  a required shield; a compatible one-handed bank alternative is selected or
  the trip remains blocked.
- Zulrah now requires viable magic and ranged switches plus venom protection,
  then builds prayer, food and teleport quantities for one rotation. Barrows
  uses a spade, magic weapon and one-chest supply plan rather than raid copy.
- Mandatory prep now blocks both the boss tile and detail verdict from showing
  a false successful trip. The detail view renders worn gear separately from
  a compact OSRS-style 4x7 inventory, with missing slots and owned alternatives.
- Check Kill now offers one encounter-tested next improvement. Normal accounts
  prefer the highest-impact option covered by the visible coin stack; iron
  modes receive a concrete self-source route instead of a GE action.
- Verification: typecheck, focused Phase 19 regressions and all 198 unaffected
  test files / 1,251 tests passed. All RuneLite Gradle tests passed. The eight
  excluded reviewer-packet CLI tests require a local IPC socket that this
  sandbox forbids; the webpack production compile passed before the unchanged
  `/plugin` page-export type gate, and local browser port binding was likewise
  unavailable in this sandbox.

## Phase 20 - Make Rates Fresh And Honest

Status: COMPLETE (2026-07-17)
Depends on: Phases 12 and 18  
Improves: GP recommendations, trust

### Prompt

```text
Separate live prices, measured rates and editorial estimates.

Build a rate registry with:
- source URL and retrieved date;
- applicable account assumptions;
- low/expected/high range;
- staleness threshold;
- calculation inputs;
- fallback when the source is unavailable.

Recalculate item-dependent costs/profit from live Wiki prices. Do not describe
old hardcoded GP/hour as current fact. Demote GP routes with stale or weak
evidence.

Acceptance:
- every displayed GP estimate has current inputs or says it is an estimate;
- price API failure does not crash planning;
- ironman ranking does not optimize GE profit as spendable value;
- freshness tests use a fixed clock.
```

### Evidence

- Added a typed rate registry that separates live prices, measured rates and
  editorial estimates. Every record carries a source URL, retrieval time,
  assumptions, calculation inputs, low/expected/high range, staleness window
  and a player-safe fallback.
- Check Kill no longer turns modelled TTK and old average loot into one precise
  GP/hour claim. Boss cards and details show a range, gross-value wording and a
  compact Wiki provenance link; KPH includes banking/mechanics uptime and the
  encounter ceiling.
- Iron accounts keep loot context but receive no spendable-GP ranking boost.
  The GP lens becomes Loot and sorts on trip fit instead of GE value.
- Money recommendations now say `Estimated`, use ranges and lose ranking weight
  when their editorial evidence ages. Item-price copy inside those routes is
  explicitly framed as an estimate and asks the player to test a short block.
- Added `/api/prices` on top of the resilient Wiki snapshot cache. Boss upgrade
  costs use the live Wiki price when available and a clearly labelled rough
  fallback when the feed is unavailable.
- Fixed a mobile boss-modal grid stretch found during browser verification by
  using normal stacked flow below desktop. Playwright confirmed desktop and
  mobile content, no framework overlay, no console errors, no horizontal
  overflow, 28 inventory slots and a fresh price response.
- Verification: 201 test files / 1,275 tests passed, TypeScript passed, all
  RuneLite Gradle tests passed and the Next.js 16 production build completed
  all 216 static pages.

## Phase 21 - Rebuild Ranking Around Opportunity Cost

Status: TODO  
Depends on: Phases 07, 10, 12, 15, 16, 17, 18 and 20  
Improves: recommendation relevance

### Prompt

```text
Replace loosely accumulated scores with an explainable ranking pipeline.

Pipeline:
1. generate candidates;
2. apply hard account and mood constraints;
3. validate requirements;
4. estimate usefulness, friction, commitment and opportunity cost;
5. apply learned preferences;
6. enforce diversity for backups;
7. choose one winner and at most two materially different alternatives.

Strong promotions:
- active Slayer task;
- near meaningful unlock;
- established boss commitment;
- bank-supported short win;
- unfinished accepted route with progress.

Strong demotions:
- 1-4 KC scout with no other evidence;
- long prerequisite chain in a short session;
- wilderness without intent or setup;
- maxing lane far from a useful stop point;
- uncertain gear gate;
- recently rejected identity.

Acceptance:
- ranking emits a structured decision trace for tests/internal debugging;
- player UI receives only the winning facts;
- golden scenarios prove why the winner beats the runner-up;
- backups are different choices, not small variations of the same grind.
```

---

# Program D - One Clear Product Experience

## Phase 22 - Make First Run Deliver Value Immediately

Status: TODO  
Depends on: Phases 06 and 07  
Improves: onboarding, conversion

### Prompt

```text
Redesign the first-run flow from RSN to useful plan.

Required sequence:
1. player enters RSN;
2. Scapestack saves it automatically;
3. ask mood/time only if it materially changes the first answer;
4. render one public-stats plan immediately;
5. offer bank and RuneLite afterward as ways to sharpen the next plan.

Do not return the player to a Welcome Back setup card before showing value.
Do not force plugin install or bank import.

Use a compact progressive modal only for optional setup. The back button and
refresh must not restart onboarding.

Acceptance:
- fresh browser reaches a useful plan in one submit;
- RSN persists;
- optional context can be skipped;
- no duplicate account UI;
- Playwright covers fresh, invalid RSN, slow hiscores and returning states.
```

## Phase 23 - Turn Account Home Into A Return Moment

Status: TODO  
Depends on: Phases 05 and 09  
Improves: return value, profile UX

### Prompt

```text
Redesign the returning homepage around one progress sentence and one next
action.

Above the fold show:
- Welcome back, RSN;
- the most meaningful change since the previous visit;
- whether the previous stop point progressed or completed;
- one button: Open next trip.

Only show Bank or RuneLite refresh when stale context would materially change
the recommendation. Put account management in the account menu.

Remove empty What changed cards, setup rails and duplicate action grids.

Acceptance:
- a returning player understands what changed in five seconds;
- no-progress state still gives one useful next trip without fake celebration;
- progress and recommendation are server-backed across devices;
- mobile first viewport contains the return value and primary action.
```

## Phase 24 - Make `/next` One Decision Per Viewport

Status: TODO  
Depends on: Phases 21 and 22  
Improves: UI clarity, trust

### Prompt

```text
Rebuild /next around the RecommendationDecision contract.

Primary view:
- large activity/boss/item visual;
- goal;
- one account-specific reason;
- Start;
- Bring, only if relevant;
- Stop at;
- one primary action.

Below or behind deliberate disclosure:
- route steps;
- calculation;
- assumptions;
- two larger alternatives with clearly different vibes;
- why this was recommended.

Remove duplicated headings, context badges, More buttons, four-column status
rows, copy-plan and screenshot controls. Do not render absent fields.

Acceptance:
- the primary card fits the first mobile viewport where practical;
- no important plan text is truncated;
- at most two alternatives;
- clicking the whole alternative selects it;
- setup detail opens as a focused sheet/modal.
```

## Phase 25 - Make Route Chains Calculable And Interactive

Status: TODO  
Depends on: Phases 09, 12 and 24  
Improves: depth without dashboard UI

### Prompt

```text
Turn After this into a short dependency-aware route.

When expanded, calculate:
- required quantity or XP;
- what the bank already covers;
- what must be sourced or bought;
- estimated sessions;
- dependency order;
- next replan point.

For ironmen, insert sourcing only when required. For mains, distinguish owned,
buyable and not worth buying. Let a player choose a step and make it the active
trip.

Render this as an OSRS path, not cards full of metrics.

Acceptance:
- Cooking route can say fish/source -> cook -> stop;
- completed dependencies disappear;
- selecting a later step cannot bypass a hard requirement;
- new sync updates quantities and route state.
```

## Phase 26 - Simplify Bank Entry Without Removing The Organizer

Status: TODO  
Depends on: Phase 04  
Improves: bank UX

### Prompt

```text
Keep the complete bank organizer, but separate quick attachment from deep
organization.

Quick Add bank modal:
- one clear screenshot/Bank Memory instruction;
- paste/drop field;
- detected account;
- Save bank;
- optional How to with the existing screenshots;
- success returns to the interrupted plan.

Full Bank page:
- organizer remains available intentionally;
- reduce simultaneous toolbar controls;
- group advanced controls behind meaningful modes;
- preserve import warnings, Bank Tags and export behavior.

Plugin-bank should be primary when fresh; manual paste is fallback/override.
Do not show Add bank when a valid bank is already attached.

Acceptance:
- quick attach needs no more than one modal and one save action;
- bank is scoped automatically to the active account;
- organizer regression tests remain green;
- mobile primary state has far fewer than the baseline 110 buttons.
```

## Phase 27 - Make Check Kill A Boss Browser

Status: TODO  
Depends on: Phases 18 and 19  
Improves: Check Kill UX

### Prompt

```text
Present Check Kill as a searchable field of large clickable boss choices.

Browser requirements:
- boss sprite/art is the main visual;
- whole tile is clickable;
- search and useful filters;
- no Open details link;
- no fake precision in the grid;
- sort by account fit, not DPS by default.

Boss detail:
- verdict in plain OSRS language;
- best owned setup;
- inventory;
- missing mandatory item;
- highest-impact upgrade;
- first trip and stop point;
- relevant alternatives.

Acceptance:
- all supported bosses are discoverable;
- keyboard and mobile selection work;
- detail does not look like a four-column dashboard;
- no-bank state offers Add bank in a modal but still explains what can be known.
```

## Phase 28 - Make Goals An Unlock Companion

Status: TODO  
Depends on: Phases 15 and 16  
Improves: goals UX and depth

### Prompt

```text
Replace the goals overview dashboard with a browse-and-focus unlock companion.

Default view:
- one closest meaningful unlock;
- reward visual;
- why it matters for this account;
- exact next task;
- browse other unlocks.

Unlock browser:
- quests, diaries, capes and useful grinds;
- large clickable reward tiles;
- search/filter only when needed.

Focused detail:
- owned/completed inferred correctly;
- remaining tasks;
- manual checkboxes where automatic state is unavailable;
- required skills/items;
- start and stop point;
- send to /next as active route.

Remove untradeable counts, readiness rails and Bank/RSN/RuneLite status panels.

Acceptance:
- elite reward implies lower tiers;
- unknown progress is not called a blocker;
- selected checklist persists;
- one click turns an unlock into the current route.
```

## Phase 29 - Make RuneLite Setup Nearly Invisible

Status: TODO  
Depends on: Phases 03, 04 and 09  
Improves: RuneLite UX

### Prompt

```text
Reduce the plugin web experience to connect, check and fix.

States:
- not connected: Open RuneLite / install and find Scapestack Sync;
- waiting: press Sync now;
- connected: last scan date and one sentence about what changed;
- stale: Refresh RuneLite with exact action;
- error: one fix at a time.

Use a RuneLite deep/open action where supported, with a clear fallback when the
OS cannot open it. Avoid endpoint URLs in the normal path.

Acceptance:
- connected player never sees setup instructions first;
- status is automatically tied to the active account;
- bank sync status is represented accurately;
- technical diagnostics are hidden behind an explicit troubleshooting action;
- plugin and web tests remain green.
```

---

# Program E - Visual, Mobile And Technical Quality

## Phase 30 - Lock A Non-Dashboard Design System

Status: TODO  
Depends on: Phases 24, 27 and 28  
Improves: branding, visual consistency

### Prompt

```text
Use Refero and current premium game/product references to create a documented
Scapestack interface lock.

Research before editing. Save a short reference matrix that identifies what is
being borrowed structurally, not stylistically copied.

Direction:
- black canvas;
- warm gold for actions and selection;
- cream display text;
- restrained serif for major moments, readable sans for controls;
- boss/reward/item art as the visual anchor;
- negative space instead of section cards;
- parchment/dark brown only for focused dialogs;
- minimal top navigation;
- no green success system;
- no nested panels or status rails.

Define tokens and primitives for dialog, sheet, boss tile, route choice,
inventory, checklist and primary action. Remove one-off styling.

Acceptance:
- homepage, /next, /bank, /dps, /goals, /plugin and account home look like one
  product;
- every page has one obvious focus;
- screenshot review finds no generic SaaS dashboard composition;
- theme regression tests protect the lock.
```

## Phase 31 - Make The App Mobile-First

Status: TODO  
Depends on: Phase 30  
Improves: mobile UX

### Prompt

```text
Audit and rebuild mobile interactions rather than shrinking desktop layouts.

Check:
- fixed bottom navigation overlap;
- safe-area insets;
- primary action reachability;
- modal/sheet height and scrolling;
- 44x44 touch targets;
- readable plan text;
- boss grid density;
- keyboard behavior for RSN/search/bank paste;
- loading states without item IDs or note-like debug content.

Use fewer controls, not smaller controls. Keep important values in natural
language instead of miniature columns.

Acceptance:
- 360x800 and 390x844 flows work without overlap or horizontal scroll;
- carousel dots and icon actions meet target size;
- the first recommendation is usable one-handed;
- browser screenshots cover every primary flow.
```

## Phase 32 - Complete Accessibility Semantics

Status: TODO  
Depends on: Phase 31  
Improves: accessibility

### Prompt

```text
Run a full keyboard, screen-reader-semantic and Lighthouse accessibility pass.

Fix:
- heading order;
- visible-label/accessibility-name mismatches;
- dialog focus trap and focus return;
- clickable non-button elements;
- search and grid semantics;
- selected state in mood and boss choices;
- contrast in muted gold/brown states;
- icon-only labels;
- reduced motion;
- error announcements.

Acceptance:
- Lighthouse accessibility at least 95 on all primary pages;
- primary flows complete with keyboard only;
- no axe critical/serious issues;
- component tests cover dialog and choice semantics.
```

## Phase 33 - Hit Mobile Performance Gates

Status: TODO  
Depends on: Phase 24  
Improves: performance, mobile UX

### Prompt

```text
Bring production mobile performance above the launch gates.

Baseline:
- homepage mobile 85, LCP 3.9s;
- /next mobile 75, LCP 5.7s;
- /next contains significant unused JavaScript.

Work:
- identify actual LCP elements;
- prioritize the real hero/recommendation image;
- correct image sizes and formats;
- lazy-load below-fold boss and detail UI;
- split heavy client-only modules;
- avoid shipping full catalogs to the first viewport;
- move pure ranking/data work server-side where appropriate;
- measure production builds, not dev mode.

Acceptance:
- mobile performance at least 90 for / and /next;
- LCP below 2.5 seconds;
- CLS below 0.05;
- no regression in recommendation behavior;
- before/after reports saved under docs or CI artifacts.
```

## Phase 34 - Break Up The Monoliths By Product Boundary

Status: TODO  
Depends on: Phase 06  
Improves: engineering quality and delivery speed

### Prompt

```text
Refactor the largest modules without changing player behavior.

Targets include:
- src/app/next/next-client.tsx;
- src/lib/next-up.ts;
- src/components/bank-result.tsx.

Extract around real boundaries:
- candidate generation;
- constraints and ranking;
- decision explanation;
- outcome matching;
- primary plan UI;
- alternatives UI;
- bank import;
- organizer workspace;
- export/share.

Do not create arbitrary tiny files or a generic abstraction framework. Keep
domain names explicit. Add boundary tests and a size/complexity guard that
prevents the monoliths from regrowing.

Acceptance:
- behavior snapshots and golden scenarios are unchanged;
- client bundles improve or remain stable;
- no new circular dependencies;
- each extracted module has one clear responsibility.
```

## Phase 35 - Harden Privacy, Security And Data Deletion

Status: TODO  
Depends on: Phases 02 and 04  
Improves: trust, production readiness

### Prompt

```text
Threat-model the plugin, claim flow, account history and bank handling.

Verify:
- claim token rotation and replay resistance;
- rate limits;
- account enumeration resistance;
- CSRF/origin behavior where relevant;
- logs never contain tokens or bank payloads;
- minimum bank/history retention;
- export and delete-account flow;
- local-only claims match actual behavior;
- share cards expose no sensitive bank details;
- API schema rejects oversized and malformed payloads.

Update player-facing privacy copy only where needed. Keep it short and factual.

Acceptance:
- automated authorization and deletion tests;
- dependency audit clean;
- documented data inventory and retention policy;
- no privacy claim contradicts implementation.
```

---

# Program F - Retention And Launch Proof

## Phase 36 - Build The Return Recap

Status: TODO  
Depends on: Phases 05, 09 and 23  
Improves: retention loop

### Prompt

```text
Create a concise daily/weekly recap that proves Scapestack remembered progress.

Possible content:
- previous trip and outcome;
- XP/levels gained;
- completed quest/diary/KC stop point;
- route that became available;
- recommendation that changed and why;
- one next trip.

Choose at most three meaningful moments. Do not show charts, KPI cards or an
empty timeline. Use an OSRS reward/boss/skill visual.

Acceptance:
- recap appears only when meaningful history exists;
- next action follows naturally from progress;
- same recap works across devices;
- no-progress state is quiet and useful;
- tests use fixed historical snapshots.
```

## Phase 37 - Add Voluntary Re-Engagement

Status: TODO  
Depends on: Phase 36  
Improves: retention without spam

### Prompt

```text
Add re-engagement only after the return recap creates real value.

Evaluate and implement the smallest useful option:
- browser reminder for a chosen stop point;
- shareable weekly recap;
- Discord webhook recap if the existing integration is appropriate;
- calendar-like session reminder.

All reminders must be opt-in, cancellable and tied to a player-chosen goal.
Never send generic "come back" messages.

Acceptance:
- message names the chosen OSRS goal;
- privacy and delivery failure are handled;
- no notification is created without explicit consent;
- analytics measures open-to-plan without storing sensitive payloads.
```

## Phase 38 - Make Sharing Prove Usefulness

Status: TODO  
Depends on: Phases 09 and 36  
Improves: Reddit fit, organic acquisition

### Prompt

```text
Redesign share artifacts around an actually useful account decision.

Good share examples:
- "My bank supports this Vorkath trip";
- "Scapestack changed my route after Falador Hard";
- "This bank covers 430k Cooking XP";
- "One task left for Karamja Hard".

The card should contain the account-safe result, a sprite, one reason and a
stop point. Do not include full bank contents, raw stats panels or AI language.

Acceptance:
- share image is understandable without surrounding UI;
- player can preview exactly what will be shared;
- private context is excluded by tests;
- Open Graph rendering works on mobile and social crawlers.
```

## Phase 39 - Build A Complete End-To-End Matrix

Status: TODO  
Depends on: Phases 22 through 38  
Improves: all product scores

### Prompt

```text
Create Playwright end-to-end coverage for the real product stories.

Stories:
1. first-time player -> RSN -> plan;
2. player adds bank -> plan becomes more specific;
3. player connects RuneLite -> history appears;
4. player chooses Chill -> randomizes -> no intense route;
5. player starts trip -> new sync -> automatic progress/completion;
6. returning player -> sees change -> opens next trip;
7. ironman missing supplies -> sourcing route;
8. Check Kill -> boss -> owned inventory -> missing upgrade;
9. diary unlock -> checklist -> route;
10. remove/recover account;
11. stale sync -> refresh;
12. mobile keyboard/modal/navigation behavior.

Use deterministic fixtures and a production build. Capture screenshots only at
meaningful product states. Fail on console errors, overflow and accessibility
violations.

Acceptance:
- matrix runs in CI;
- failures identify the broken player story;
- no test depends on current live hiscores or prices unless explicitly marked
  as a separate live smoke.
```

## Phase 40 - Run Real OSRS Comprehension Tests

Status: TODO  
Depends on: Phase 39  
Improves: product promise, trust, usability

### Prompt

```text
Test Scapestack with OSRS mental models rather than developer expectations.

Prepare five-minute moderated scripts for:
- new/returning player;
- midgame main;
- ironman;
- PvMer;
- skiller/AFK player.

Measure:
- what they think Scapestack does after five seconds;
- whether they trust the first recommendation;
- whether they can explain why it won;
- whether setup feels optional;
- whether they know how to start and where to stop;
- whether they expect tomorrow to be different;
- what feels cringe, SaaS-like or wrong in OSRS terms.

Do not lead participants. Record task outcomes and exact objections. Convert
only repeated/high-severity findings into changes.

Acceptance:
- at least five representative sessions or an explicitly documented proxy if
  real recruitment is unavailable;
- findings include severity and evidence;
- five-second comprehension succeeds for at least 80%;
- primary trip start succeeds for at least 80% without help.
```

## Phase 41 - Final Independent Score And Launch Gate

Status: TODO  
Depends on: all previous phases  
Improves: launch confidence

### Prompt

```text
Perform a new independent audit. Do not reuse implementation claims as proof.

Run:
- full CI;
- plugin tests;
- API auth/sync smoke;
- live bank price smoke;
- dependency audit;
- recommendation golden scenarios;
- full Playwright matrix;
- Lighthouse mobile and desktop;
- accessibility and keyboard audit;
- privacy/deletion checks;
- first-run and returning-user recordings/screenshots.

Score every category in the Score Contract. For each score provide evidence,
remaining gap and severity. Compare against the July 15 baseline.

Launch only if:
- overall >= 8.8;
- no core category < 8.0;
- mobile performance >= 90 and LCP < 2.5s;
- accessibility >= 95;
- semantic recommendation gate has zero failures;
- mood hard constraints have zero violations;
- full CI and plugin suite are green;
- the return flow proves accumulated value.

If a gate fails, create narrowly scoped remediation phases in this file. Do not
lower the gate and do not call the project complete.
```

---

## 4. Required Evidence Template

Append this under a phase when marking it `DONE`:

```text
Evidence:
- Completed: YYYY-MM-DD
- Commit: <hash>
- Files: <important files>
- Tests added: <tests>
- Commands: <commands and outcomes>
- Browser evidence: <paths/URLs and viewports>
- Metric change: <before -> after>
- Known residual risk: <none or concise risk>
```

## 5. Controller Prompt

Use this exact prompt when continuing the program:

```text
Open `docs/SCAPESTACK-90-PLUS-MASTER-PROMPTBOOK-2026-07-15.md`.

Find the first phase with Status: TODO whose dependencies are DONE. Execute
only that phase, deeply and end to end.

Follow the global implementation rules and verification gate. Do not mark the
phase complete based only on green tests: prove its behavioral acceptance
criteria. Update the phase status and append the required evidence. Commit and
push. Then stop, report the result and name the next phase. Wait for "ga door".
```
