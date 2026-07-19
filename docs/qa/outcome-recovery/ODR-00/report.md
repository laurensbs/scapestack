# ODR-00 Reality Baseline

Captured: 2026-07-19
Baseline commit: `47b6441`
Measured score: `6.4/10`
Launch ready: **no**

ODR-00 changed the execution and verification system, not player-facing
behavior. It reconciles the live product, website contract and Plugin Hub
release before later phases change the product again.

## Verdict

Scapestack has a strong promise, recognizable visual direction, a substantial
bank/boss utility and unusually broad automated coverage. It is not yet a
dependable returning-player companion. The first recommendation is not always
fast, its reason is not comparative enough, the browser gate is red, the
homepage hydrates incorrectly in production and the owned live snapshot still
comes from plugin `0.2.0` despite `0.3.0` being published.

The baseline is therefore valid, but the product is not launch ready.

## Verification Results

| Gate | Result | Observed |
| --- | --- | --- |
| Full CI | Pass | 217 files, 1,362 tests, typecheck, smoke, release audit and 217-page build |
| Live smoke | Pass | Bank organizer completed with live prices in 577 ms |
| Local browser | Fail | 19 passed, 4 failed, 1 skipped |
| Production routes | Fail | 84/84 ready, but 12 hydration page errors |
| Java unit | Pass | 89 tests, 0 failures, 0 skipped |
| Java integration | Pass | 10 tests, 0 failures, 0 skipped, isolated Neon branch |
| Plugin release | Pass | Plugin Hub `0.3.0`, contract v3, merged and pinned |

The two browser failure families are materially different:

1. Desktop and mobile first-time planning remained on `Building your next
   trip...` after the ten-second assertion deadline.
2. Desktop and mobile RuneLite stories mocked an obsolete browser route while
   the production page now reads through a server action, so they remained on
   `Checking`.

Neither failure is hidden inside a green CI label. ODR-01 owns planning latency;
ODR-02 owns the real RuneLite browser story.

## Production Timing

Each route/viewport pair ran three cold and three warm navigations. The audit
used medians, retained every raw run and did not quote the fastest result as the
product truth.

| Route | Viewport | Cold median | Warm median | Result |
| --- | --- | ---: | ---: | --- |
| Home | Desktop | 685 ms | 130 ms | Fast, hydration error in all six runs |
| Home | Mobile | 310 ms | 89 ms | Fast, hydration error in all six runs |
| Next | Desktop | 3,075 ms | 2,520 ms | All six runs miss 2.5 s; cold max is 12,773 ms |
| Next | Mobile | 2,754 ms | 2,508 ms | All six runs miss 2.5 s |
| Plugin settled | Desktop | 1,094 ms | 890 ms | Correct update-to-v0.3.0 state |
| Plugin settled | Mobile | 1,017 ms | 444 ms | Correct update-to-v0.3.0 state |

Across the complete seven-route audit:

- 84 navigations measured;
- zero readiness failures;
- zero horizontal-overflow runs;
- zero broken images;
- zero unnamed controls;
- twelve page errors, all React hydration error `#418` on the homepage;
- `/next` exposes its recommendation as an `h2` and has no `h1`.

The exact measurements and all screenshots/accessibility trees live in
`production-routes.json`, `screenshots/` and `ax/`.

## Release And Sync Truth

The release facts are no longer ambiguous:

- Plugin Hub version: `0.3.0`;
- website/plugin contract: v3;
- pinned source commit: `e29f6ac6995ffd8f95c3f71bebeac1d0ea26ebd3`;
- Plugin Hub review: merged;
- `/api/sync`: ready with no missing database tables or columns.

The current owned production snapshot tells a different account-level story:

- synced at `2026-07-19T10:57:36.844Z`;
- plugin version `0.2.0`;
- contract coverage object absent;
- 24 skills, 207 quests, 20 diaries;
- Slayer task present;
- zero collection-log items, boss KC and bank items in the snapshot;
- bank enabled but explicitly unavailable because it was not opened this
  session.

This does **not** mean contract v3 is broken. The isolated real Java integration
wrote and read all eight v3 domains successfully. It means the real account has
not yet supplied a current v3 snapshot, which ODR-02 must reconcile visibly.

## Safe Java Integration Gate

The former end-to-end test could delete a real production claim and could be
silently skipped when no server was present. ODR-00 replaced that behavior with
an explicit `pluginE2e` task that:

- requires an isolated database URL and test RSN;
- refuses a database URL equal to production;
- fails when prerequisites are absent instead of skipping;
- cleans only its isolated identity;
- writes a contract-v3 fixture through the real Java serializer;
- covers claim, auth, conflict, reclaim and full domain persistence;
- ran ten tests with zero skips.

The temporary Neon branch is disposable test infrastructure and is removed
after evidence capture.

## Scorecard

| Category | Score | Target | Main gap |
| --- | ---: | ---: | --- |
| Product promise | 8.5 | 9.0 | Result does not fully deliver the homepage promise |
| First useful plan | 7.0 | 9.0 | Slow and occasionally over ten seconds locally |
| Recommendation relevance | 5.5 | 8.8 | No pairwise proof that the winner is best |
| Recommendation evidence | 5.5 | 9.0 | Generic reason, weak opportunity-cost explanation |
| Active session | 4.5 | 8.8 | No proven durable start-to-reconcile loop |
| Long-term route | 4.0 | 8.5 | Trips do not visibly advance one stable journey |
| Return value | 4.0 | 8.8 | No measured D1/D7 or compelling return moment |
| RuneLite contract/release | 8.5 | 9.2 | Published v3, owned snapshot still v0.2.0 |
| RuneLite player UX | 6.0 | 8.8 | Real sync-to-browser observation is unproven |
| Bank/boss utility | 7.5 | 8.5 | Utility is deep, live bank context is absent |
| Branding | 8.0 | 8.8 | Strong home, less unified inner product |
| Inner-product UI | 6.5 | 8.5 | Repeated panels and collapsed rows feel thin |
| Mobile/accessibility | 6.5 | 9.0 | Hydration failure and missing `h1` |
| Performance | 5.0 | 9.0 | First answer misses the target |
| Measurement | 4.5 | 8.5 | No retention cohort or comparative quality gate |
| Privacy/trust | 8.0 | 9.0 | Strong boundaries, stale state needs reconciliation |
| Engineering | 9.0 | 9.2 | Broad coverage, browser outcome gate remains red |
| Reddit fit | 6.5 | 8.5 | Pitch works; actual intelligence is not yet defensible |

Mean score: `6.39`, reported as `6.4/10`.

## Next Phase Implications

ODR-01 must remove the first-answer latency and hydration failure before visual
or recommendation expansion. Its production gate is three cold desktop and
mobile runs at or below 2.5 seconds, with an absolute four-second degraded mode
and zero hydration/page errors.

ODR-02 must then prove installed Plugin Hub client -> production persistence ->
browser -> planner against one current v3 snapshot. A plugin-side `Synced` label
alone does not satisfy that outcome.

Later phases should not award higher intelligence scores until the winner cites
real account evidence and beats a defined alternative in a comparative test.
