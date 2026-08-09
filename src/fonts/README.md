# Fonts

**Nothing is committed here any more, and nothing should be.**

## What was here, and why it left

Three faces from [RuneStar/fonts](https://github.com/RuneStar/fonts) release
1.103-0 — `RuneScape-Plain-12`, `RuneScape-Bold-12` and `RuneScape-Quill-Caps`.
Their name-tables read `licence: Public Domain`, vendor `runestar.org`, so they
were CC0 as far as RuneStar could grant it.

That was never the question. They are **recreations of Jagex's own interface
letterforms**, and a CC0 declaration by a third party cannot license someone
else's IP. `REBRAND.md` §9.4 rules them out under the Jagex Fan Content Policy:

> Do NOT embed official Jagex fonts or extract assets from the game cache /
> client. Do not use FontStruct/RuneStar RuneScape-font recreations (they
> reproduce Jagex IP).

They were removed on 2026-08-09 along with Archivo.

## What replaced them

Three Google Fonts, all **SIL OFL 1.1**, loaded through `next/font/google` in
`src/app/layout.tsx` — self-hosted at build time, so no external request and no
flash of fallback:

| Role | Face | Weights | Used for |
|---|---|---|---|
| Display | **Cinzel** | 600, 700 | h1–h3, panel titles, the wordmark |
| Body | **Fraunces** | 400, 500, 600 + italic | everything a player reads |
| Numeral | **Pixelify Sans** | 500, 700 | game numbers only — KC, levels, gp, XP, timers |

Cinzel earns the carved-stone feeling honestly: it is a Roman-inscription
serif, so it reads as chiselled by construction rather than by imitating a game
asset. It also removed a real constraint — the bitmap faces were crisp only at
multiples of 16px, which `tests/e2e/page-budget.spec.ts` had to enforce as a
rule. Cinzel is crisp at any size.

Pixelify Sans supplies the pixel-game cue for numbers without touching a Jagex
letterform. It is confined to `.numeral`; the page-budget spec's family axis
now exists to catch it leaking into prose, where it would be a novelty rather
than an interface.

## Rules

- Never add a font here. Use `next/font/google` with an OFL face.
- Never add Inter, Roboto, Open Sans, Lato, Arial, system-ui, Poppins, Space
  Grotesk, Geist or Montserrat. `scripts/rebrand-lint.mjs` fails the build on
  all of them, and `src/app/design-tokens.ts` holds the list.
- Never add a recreation of a Jagex face, whatever licence it claims.
