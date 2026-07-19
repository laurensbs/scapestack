# ODR-01 - First Useful Plan Verification

Status: **LIVE VERIFIED**

Verified: 2026-07-19

Production deployment: `dpl_EPMYxA5SXcSu6yL6LPBpuXUrGAVs`

Implementation head: `56dbb65`

## Outcome

Scapestack now exposes an actionable `/next` plan in less than 2.5 seconds
on every measured cold desktop and mobile run. The first result no longer
waits for client hydration before starting account work and performs no
client POST before the plan appears.

| Viewport | Cold actionable runs | Maximum | Gate |
| --- | --- | ---: | --- |
| Desktop | 1,222ms / 2,391ms / 993ms | 2,391ms | PASS |
| Mobile | 1,318ms / 1,073ms / 1,128ms | 1,318ms | PASS |

Warm `/next` runs were 724ms / 877ms / 1,642ms on desktop and 1,017ms /
970ms / 1,043ms on mobile. No run has a deliberate loader floor.

## Baseline And Failed Attempts

The ODR-00 production baseline exposed cold `/next` plans in 12,773ms /
3,013ms / 3,075ms on desktop and 3,335ms / 2,710ms / 2,754ms on mobile.

Three intermediate production attempts were retained instead of being
reported as successful:

| Attempt | Desktop cold | Mobile cold | Result |
| --- | --- | --- | --- |
| 1 | 2,902 / 3,064 / 2,230ms | 1,744 / 1,653 / 1,154ms | FAIL |
| 2 | 1,976 / 1,734 / 2,030ms | 1,136 / 2,835 / 1,455ms | FAIL |
| 3 | 1,986 / 3,149 / 3,550ms | 2,433 / 2,238 / 1,710ms | FAIL |

Attempt 3 proved that shorter provider deadlines alone were insufficient:
slow client chunks still postponed the Server Action. The final architecture
starts account loading in a streamed server component while those chunks
download, then hydrates from the already computed plan.

## Root Causes Fixed

1. A forced two-second loader floor delayed every plan.
2. Hiscores, WOM, Temple, collection-log and Scapestack sync were separate,
   effectively unbounded client calls.
3. The recommendation required another sequential Server Action after the
   account reads.
4. Client hydration had to finish before any account lookup started.
5. Homepage ISR could combine server HTML and a pathname-dependent client
   bundle from different renders, producing React hydration error `#418`.
6. The sync read performed schema setup before a normal SELECT.

## Implementation

- Critical and optional account providers have independent abortable budgets.
- A shared input builder preserves one source-priority contract for initial
  plans and explicit bank overrides.
- The initial recommendation is computed with its account context in one
  server operation.
- `/next` streams that operation during route render; the client consumes the
  prefetched context and retains the Server Action only as a rerun fallback.
- The homepage is one immutable static deployment artifact, eliminating the
  observed hydration mismatch at its source.
- Timing logs contain durations and states only, never RSNs or bank rows.

## Degraded Mode

The bounded-source contract aborts slow providers and returns an honest null
enrichment. During the local production audit, a real run recorded two
timeouts (`scapestack` and `temple`) with total planning time 947ms; the
corresponding local browser gate remained below 1,499ms. Unit coverage also
proves timeout, abort and provider-error fallback behavior. This is below the
absolute four-second degraded-mode gate.

## Quality Gates

- `npm run ci:check`: PASS
- Vitest: 220 files, 1,375 tests passed
- Smoke organizer: PASS
- Planner audit: PASS
- Outcome controller audit: PASS
- Plugin Hub offline release contract: v0.3.0 / contract v3 PASS
- Production build: PASS
- Production browser audit: 24 navigations, zero readiness failures
- Console errors: 0
- Page errors: 0
- Hydration errors: 0
- Overflow runs: 0
- Broken images: 0
- Unnamed controls: 0

## Evidence

- Final production audit: `docs/qa/outcome-recovery/ODR-01/production/production-routes.json`
- Final desktop/mobile screenshots: `docs/qa/outcome-recovery/ODR-01/production/screenshots/`
- Final accessibility trees: `docs/qa/outcome-recovery/ODR-01/production/ax/`
- Local streamed-route proof: `docs/qa/outcome-recovery/ODR-01/local-streaming/production-routes.json`
- Failed production attempts: `docs/qa/outcome-recovery/ODR-01/production-attempt-1/`,
  `production-attempt-2/` and `production-attempt-3/`

## Residual Risk

The slowest measured cold desktop result is 109ms inside the 2.5-second gate,
so latency still needs production monitoring. Provider availability can also
change the evidence available on a newly requested plan. A plan already shown
to the player remains frozen; ODR-02 now owns the authoritative RuneLite sync
loop that will reduce provider variance.
