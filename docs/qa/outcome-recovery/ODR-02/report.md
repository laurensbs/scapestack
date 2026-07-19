# ODR-02 - Real RuneLite Production Loop

Status: **LIVE VERIFIED**

Implementation commit: `3133e0b`
Production deployment: `dpl_2ednFqVp94mg6cuwDtRKyFibbtyH`
Verified on: 2026-07-19

## Outcome

The installed RuneLite Plugin Hub build, the production sync API, Neon storage,
the browser connection screen and `/next` now agree on one current account
snapshot. A green plugin label is no longer treated as sufficient proof.

The browser receives a privacy-minimized receipt containing only claim proof,
version, accepted time, coverage, counts and bank availability. Full quests,
bank rows, Slayer state and boss values stay server-side for planning.

## What Changed

- `POST /api/sync` returns an explicit accepted receipt with claim, plugin and
  contract versions, timestamp and per-domain coverage.
- `GET /api/sync/status` exposes the same no-store receipt without account
  payload values.
- The RuneLite connection page watches for a first or newer accepted scan for
  15 seconds and updates without a page reload.
- V3 planning input is authoritative per domain. `not-loaded` remains unknown;
  it is never converted to an empty clog, boss KC, Slayer or bank claim.
- A recent retained bank can still shape a plan while the UI asks the player to
  open the bank before refreshing it. Turning bank permission off removes it.
- The immediate plugin-to-`/next` handoff gets one bounded Neon retry so a cold
  first read cannot erase the scan that was just accepted.
- The Java E2E now verifies the accepted receipt, `player_sync`, immutable
  `sync_snapshot`, public browser readback, auth, replay and cleanup.

## Deterministic Cross-System Gate

`npm run ci:cross-system` ran against a disposable schema-only Neon branch and
used the real Java v3 serializer against a real Next.js server.

- Tests: **10**
- Skipped: **0**
- Failures: **0**
- Errors: **0**
- Full round trip: Java serializer -> Next API -> Neon projection/history ->
  public browser receipt
- Disposable branch deleted after the run

Machine-readable result: [`plugin-e2e.xml`](./plugin-e2e.xml)

## Live Production Proof

### Published client

- Plugin Hub release: `0.3.0`
- Contract: `v3`
- Published pin: `e29f6ac6995ffd8f95c3f71bebeac1d0ea26ebd3`
- RuneLite release checked: `1.12.33`
- `npm run plugin:release-check:live`: passed

### Installed client to production

The installed client for `Lauky` wrote fresh production snapshots after login.
The retained evidence receipt is privacy-minimized:

- accepted at `2026-07-19T19:26:03.969Z`;
- plugin `0.3.0`, contract `3`, verified claim;
- skills, quests, diaries, boss KC, Slayer and account mode: `available`;
- collection log: `not-loaded` because it was not opened;
- bank: `not-loaded` for this session, while the previous 809-stack bank is
  retained and clearly labelled as needing an in-game refresh.

Receipt: [`production/live-receipt.json`](./production/live-receipt.json)

### Browser readback

The production connection page observed the newer accepted receipt in
**2,014 ms**, below the 15-second gate, without a browser reload.

- Started: `2026-07-19T19:18:29.930Z`
- Visible: `2026-07-19T19:18:31.944Z`
- Horizontal overflow: none at 1280px and 390px
- Missing domains are instructions, not false zero states

Timing: [`production/readback.json`](./production/readback.json)

### Planner consumption

`/next?rsn=Lauky&from=plugin&intent=short&time=15` produced **Tidy your
bank** and referenced concrete retained snapshot facts:

- `Blood rune x5738`
- `Air rune x143`

This proves the player-facing decision consumed the persisted plugin bank
snapshot instead of merely showing a successful connection badge.

## Responsive Proof

- [Desktop RuneLite connection](./production/screenshots/desktop-plugin.png)
- [Mobile RuneLite connection](./production/screenshots/mobile-plugin.png)
- [Desktop snapshot-backed plan](./production/screenshots/desktop-next.png)
- [Mobile snapshot-backed plan](./production/screenshots/mobile-next.png)

The metric files beside the screenshots record viewport width, page width and
horizontal-overflow checks. AX snapshots are in `production/ax/`.

## Verification

| Gate | Result |
| --- | --- |
| `npm test` | 224 files, 1,386 tests passed |
| `npm run typecheck` | passed |
| `npm run build` | passed, including `/api/sync/status` |
| `./gradlew test` | passed |
| `npm run ci:cross-system` | 10 E2E tests, zero skipped |
| `npm run plugin:release-check:live` | published `0.3.0` passed |
| Vercel production | `READY`, commit `3133e0b` |
| Production runtime errors (1h) | none |
| Production 5xx logs (30m) | none |

## Acceptance Matrix

| Acceptance | Evidence | Result |
| --- | --- | --- |
| Installed client -> production -> browser | live receipt, screenshots, AX | pass |
| Accepted scan visible within 15 seconds | 2,014 ms readback | pass |
| Planner references snapshot fact | rune quantities in live winner | pass |
| No false empty domain | coverage copy and planning tests | pass |
| Zero skipped plugin E2E | XML `skipped="0"` | pass |
| Auth, replay and limits remain green | Java E2E + 1,386 web tests | pass |

The collection log and current-session bank are intentionally still marked
`not-loaded`; opening those RuneLite views and syncing will make them available.
That is honest degraded mode, not an application failure.
