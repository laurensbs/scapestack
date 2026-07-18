# Phase 33 Mobile Performance Report

Date: 2026-07-18

## Goal

Bring the production mobile paths for `/` and `/next` closer to launch gates by
reducing first-viewport work:

- prioritize the real homepage hero image;
- avoid eager loading hidden boss hero images;
- keep boss DPS/detail UI out of the first `/next` client bundle;
- keep KC probability charts out of the first detail bundle until needed.

## Changes

- Homepage hero now renders one active boss image instead of five in-viewport
  images with opacity toggles.
- The first hero boss image keeps `priority`; later rotated bosses remain lazy.
- `/next` now stores only the selected `bossSlug` in the main client component.
- Boss detail, owned-gear derivation, DPS setup, inventory planning and upgrade
  checks moved behind `LazyBossDetailModal`.
- KC probability chart moved behind `LazyKcProbabilityGraph`.

## Production Evidence

Build command:

```bash
npm run build
```

Result: passed. Next.js generated 216 static pages and the dynamic `/next`
route compiled successfully.

Local production server:

```bash
npm run start
```

HTTP warm-server probe:

| Route | Status | TTFB | Total | HTML |
| --- | ---: | ---: | ---: | ---: |
| `/` | 200 | 11 ms | 12 ms | 35.7 KB |
| `/next?rsn=lauky&bank=none` | 200 | 8 ms | 9 ms | 28.6 KB |

Browser screenshots:

- `docs/performance/phase33-home-mobile.png`
- `docs/performance/phase33-next-mobile.png`

Browser console errors: 0 on both mobile pages.

## Bundle Evidence

The `/next` client-reference manifest no longer contains:

- `lazy-boss-detail-modal`
- `boss-detail-modal`
- `kc-probability-graph`
- `ownedGear`
- `bestStyleAndSetup`

Those appear in separate static chunks instead:

| Chunk | Size | Contains |
| --- | ---: | --- |
| `.next/static/chunks/1_xa6xxbrcbrt.js` | 16 KB | lazy boss wrapper / owned gear bridge |
| `.next/static/chunks/0pxmc5o14bta9.js` | 64 KB | boss detail, DPS, inventory plan |
| `.next/static/chunks/1jeka2b4cuivx.js` | 52 KB | boss detail support code |

The main `/next` entry still includes the planner itself and recommendation UI,
but no longer ships the heavy boss-detail calculation path before a click.

## Measurement Notes

Local Lighthouse was not available in this toolchain, and the in-app browser
read-only evaluation sandbox did not expose `window.performance`. The saved
evidence therefore uses:

- production `next build`;
- production `next start`;
- browser mobile screenshots at `390x844`;
- browser console checks;
- local HTTP timing;
- Next client-reference manifest inspection.

Run Lighthouse CI in deployment for score/LCP/CLS gate enforcement.
