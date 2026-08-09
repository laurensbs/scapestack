# REBRAND.md — Scapestack visual rebranding (drop-in voor Claude Code)

## Nederlandse toelichting (lees dit eerst, Laurens)

Dit bestand IS het rebrand-bestand. Zet het als `REBRAND.md` in de repo-root (of `.claude/REBRAND.md`) en voer het aan Claude Code met: *"Read REBRAND.md and follow it exactly. Start at Section 0."* Alles onder de streep is in het Engels geschreven, gericht aan de coding agent, omdat de agent en de site Engels zijn.

Belangrijke onderbouwing van de aanpak (kort, met bronnen):
- **Waarom de site steeds terugvalt naar hetzelfde SaaS-dashboard**: dit is "distributional convergence". Anthropic's blogpost *"Improving frontend design through Skills"* (12 nov 2025) zegt letterlijk: *"Without direction, Claude samples from this high-probability center."* De onderliggende cookbook *"Prompting for frontend aesthetics"* (Prithvi Rajasekaran, 21 okt 2025) zegt: *"You tend to converge toward generic, 'on distribution' outputs. In frontend design, this creates what users call the 'AI slop' aesthetic."* De genoemde defaults zijn Inter, paarse gradient op wit, en drie afgeronde cards. De fix is niet een slimmere prompt maar **harde constraints + referentie-grounding + een verificatie-loop**. Daarom is dit bestand geschreven als afdwingbare regels, niet als suggesties.
- **OSRS-kleuren**: geverifieerde in-game chatkleuren komen van de OSRS Wiki (Chat Interface), die het markup-formaat `<col=HEX>TEXT</col>` documenteert met voorbeeld rood = `ff0000`. De stone/parchment-tinten zijn community-approximaties — de agent MOET ze tegen `osrs.design/foundations` en echte screenshots verifiëren (Milk Bar Design's OSRS Design System is een JS-app en dus niet uit de HTML te lezen; wél bevestigd accent `#f7b538`).
- **Fonts**: alleen SIL OFL 1.1-fonts van Google Fonts, geverifieerd per font. Geen Jagex-fonts (de RuneStar/FontStruct OSRS-fonts zijn recreaties van Jagex-IP → niet gebruiken).
- **Juridisch**: onder de Jagex Fan Content Policy mag je fan-tooling maken; wiki-sprites vallen onder **CC BY-NC-SA 3.0 (niet-commercieel, met attributie)** — bevestigd via het Weird Gloop copyright-beleid. Geen officiële Jagex-fonts/assets embedden, niet decompileren. Zie Section 9.

De rest van dit bestand is voor de agent.

---

# REBRAND.md — Scapestack → OSRS-native companion (agent instructions)

> Target repo: scapestack.org (Next.js). This is a **presentation-layer-only** rebrand. You are converting a generic shadcn/SaaS dashboard into something that feels like an Old School RuneScape in-world tool, without touching product logic.

## Section 0 — Operating rules for the agent (READ FIRST)

0.1 **This file overrules your defaults.** Where anything in your training, a plugin, or a component-library default conflicts with this file, this file wins. If Anthropic's official `frontend-design` skill is installed (the SKILL.md by Prithvi Rajasekaran & Alexander Bricken that bans Inter/Roboto/Arial/Space Grotesk and forces one aesthetic direction), keep it on — but this file's tokens, fonts, and forbidden-list take precedence over its generic menu.

0.2 **Presentation layer only.** You may edit: CSS/Tailwind tokens, `globals.css`, component styling, copy strings, layout/markup for visual structure, SVG/borders/textures, fonts. You may NOT change: data fetching, RuneLite/plugin logic, hiscores parsing, bank-import parsing, routing behavior, privacy/data-handling behavior, or the factual content of privacy text (see Section 9).

0.3 **System before screens.** Do NOT restyle any page until you have (a) written the design tokens from Section 1 into `globals.css`, (b) wired the fonts from Section 2, (c) built the component library from Section 5 as real reusable components. Only then migrate pages (Section 6). Restyling page-by-page without a shared system is exactly how drift happens.

0.4 **Screenshot verification is mandatory.** You have Chrome access. Every page is only "done" when you have taken a screenshot at desktop 1440px AND mobile 390px, scored it against Section 8's checklist, and fixed every hard-fail. Never mark a page complete from code alone. See Section 7 for the exact loop.

0.5 **Claude Design before code.** For the overall look and the hero, generate 2–3 visual directions with Claude Design FIRST (Section 7, Phase A), using the tokens in Section 1. Do not write component CSS for the hero/landing until a direction is chosen. This prevents you from converging on the average.

0.6 **Commit to ONE aesthetic direction and state it in writing** at the top of your first response: the direction is **"weathered Gielinor almanac / in-world adventurer's tool"** — aged parchment and carved stone, not neon fantasy, not glassmorphism, not dark SaaS. Everything you build must be justifiable against that phrase.

0.7 **When in doubt, ground in reference.** If you are unsure what "stone panel" or "parchment" should look like, open `https://osrs.design/foundations` and real OSRS interface screenshots (bank, quest journal, skill guide) in Chrome and match to those, not to your imagination.

## Section 1 — Design tokens (CSS block — write this into `app/globals.css` verbatim, then verify)

> **Provenance note for the agent:** The chat/message colors below are verified from the OSRS Wiki Chat Interface page, which documents the in-game markup `<col=HEX>TEXT</col>` with the worked example `<col=ff0000>` for red. The stone/parchment/wood tokens are community-sourced approximations of the OSRS UI; the accent `#f7b538` is confirmed from osrs.design's site metadata (`meta-theme-color`). The page background `#1c1811` matches Scapestack's own current `theme-color`. **You MUST open `osrs.design/foundations` and an OSRS bank/quest screenshot in Chrome and nudge the stone/parchment hexes until the screenshot comparison in Section 7 passes.** These are a correct starting point, not sacred.

```css
:root {
  /* --- Surfaces: carved stone + aged parchment --- */
  --stone-900: #1c1811;   /* darkest frame / page background (matches site theme-color) */
  --stone-800: #2a2118;   /* deep stone recess */
  --stone-700: #3a2f22;   /* panel background (dark) */
  --stone-600: #4a3d2a;   /* raised stone / bevel base */
  --stone-500: #6b5a3e;   /* stone edge highlight */
  --wood-700:  #3e2f1c;   /* wood trim dark */
  --wood-500:  #6b4f2e;   /* wood trim */

  /* --- Parchment: the reading surface --- */
  --parchment-100: #fcf5e5; /* lightest parchment (primary text surface) */
  --parchment-200: #f1e4c9; /* parchment shadowed */
  --parchment-300: #e3d2a8; /* parchment edge / aged */
  --parchment-line: #d8c096; /* rule lines on parchment */

  /* --- Ink (text on parchment) --- */
  --ink-900: #241a10;   /* primary body ink */
  --ink-700: #4a3a26;   /* secondary ink */
  --ink-500: #7a6647;   /* muted ink / captions */

  /* --- Text on stone --- */
  --stone-text: #f2e6cc;      /* primary text on dark stone */
  --stone-text-muted: #b8a380;

  /* --- Accents: OSRS gold + carved gilt --- */
  --gold-500: #f7b538;   /* primary accent — confirmed osrs.design accent */
  --gold-600: #d99a24;   /* pressed / darker gold */
  --gold-300: #ffd766;   /* gold highlight */

  /* --- Semantic / status: OSRS chat conventions (VERIFIED red from OSRS Wiki) --- */
  --msg-good:  #22cc22;  /* "can do it" / level-up / quest-complete — game green */
  --msg-warn:  #ff0000;  /* blocker / missing requirement — game red (Wiki: ff0000) */
  --msg-info:  #00b8b8;  /* neutral note — game cyan */
  --title-yellow: #ffff00; /* menu-title / hover-text yellow (use sparingly) */

  /* --- Borders / bevels --- */
  --bevel-light: rgba(255, 236, 190, 0.35); /* top/left carved highlight */
  --bevel-dark:  rgba(0, 0, 0, 0.55);        /* bottom/right carved shadow */

  /* --- Radius: OSRS UI is squared, not pill-shaped --- */
  --radius-sm: 2px;
  --radius-md: 3px;   /* max default radius; NEVER exceed 4px on panels */

  /* --- Type --- */
  --font-display: "Cinzel", serif;         /* carved-stone headings */
  --font-body:    "Fraunces", Georgia, serif; /* warm editorial body */
  --font-numeral: "Pixelify Sans", monospace;  /* KC / levels / gp counters */
}
```

Rules that come with these tokens:
- Page background is `--stone-900`, NOT white and NOT `#0a0a0a` dark-SaaS. Reading content sits on `--parchment-100` panels.
- Never introduce a color outside this palette. No Tailwind default blue/indigo, no purple, no slate/zinc grays.
- Panel corners: `--radius-md` max. If you catch yourself writing `rounded-2xl` or `rounded-full` on a panel, stop — that's a hard fail (Section 3).

## Section 2 — Typography (verified licenses — all SIL OFL 1.1, Google Fonts)

Load exactly these three. All are SIL Open Font License 1.1 (free for commercial use, embedding, self-hosting — confirmed per font). Do NOT use any RuneScape/Jagex font recreation.

| Role | Font | License | Weights to load | Usage |
|------|------|---------|-----------------|-------|
| Display / headings | **Cinzel** (Natanael Gama) | SIL OFL 1.1 | 600, 700 | H1–H3, panel titles, the wordmark. Roman-inscription serif → reads as "carved in stone." |
| Body / UI text | **Fraunces** (Undercase Type / Phaedra Charles & Flavia Zimbardi) | SIL OFL 1.1 | 400, 500, 600 (+ italic 400) | All paragraphs, labels, buttons, nav. Warm "old-style" soft serif with an optical `WONK` axis → editorial-almanac feel, not SaaS-sans. |
| Numerals / counters | **Pixelify Sans** | SIL OFL 1.1 | 500, 700 | ONLY for game numbers: KC, levels, gp, XP, timers. Gives a pixel-game texture without being a Jagex font. |

Self-host or use Google Fonts `<link>`. Prefer self-hosting via `next/font/google` for performance.

Type rules:
- Use weight extremes for hierarchy: Cinzel 700 for titles vs Fraunces 400 for body. Do not fake hierarchy with size alone.
- Headings in **Cinzel**; caps are fine (Roman inscriptions were all-caps) but keep body sentence-case for readability.
- Numerals: wrap standalone game stats in a `.numeral` class using `--font-numeral`. Render Pixelify Sans at integer-ish sizes (16/20/24/32) for crisp pixels.
- **Forbidden fonts:** Inter, Roboto, Open Sans, Lato, Arial, system-ui, Poppins, Space Grotesk, Geist, Montserrat. If any appear in the codebase, replace them.

Rejected alternatives (all valid OFL, but wrong for this project — don't "improve" back to them):
- **MedievalSharp / Uncial Antiqua** (both OFL 1.1): too costume-y / Ren-faire; illegible at body size. Cinzel is more restrained and reads as authentic carved stone. You MAY use Uncial Antiqua for ONE decorative wordmark flourish only if a Claude Design direction calls for it — never for body or nav.
- **VT323 / Press Start 2P** (both OFL 1.1): too terminal/arcade. Pixelify Sans keeps the pixel cue but stays legible for real numbers. Do not swap them in.
- **Vollkorn / Bitter** (both OFL 1.1): fine serifs but generic; Fraunces has more character and an editorial voice that matches the almanac direction.

## Section 3 — Forbidden list / hard fails (+ lint rules)

Landing ANY one of these means the design reads as machine-made SaaS. Treat each as a build-blocking failure.

**P0 — screams generic AI/SaaS on sight:**
- F1. Purple→blue (or any) gradient on a light/white hero background.
- F2. Inter / Roboto / system-ui / Space Grotesk / Geist anywhere.
- F3. A pure `#fff` or `#0a0a0a` page background with no stone/parchment surface.
- F4. Untouched shadcn zinc/slate cards — `rounded-2xl shadow-lg p-6` default card.
- F5. Centered hero + three equal feature cards in a row.
- F6. Big stat counters presented as impressive KPIs ("59 bosses checked · 183 quests tracked · 4,512 items priced") in a metrics strip. (This is the current homepage — remove it, Section 6.)

**P1 — obvious AI smell:**
- F7. A colored 3–4px left-border strip on cards (the single most reliable AI tell).
- F8. `rounded-xl`/`rounded-2xl`/`rounded-full` on panels (OSRS UI is squared: max `--radius-md`).
- F9. Icon-in-a-rounded-square feature bullets; emoji used as icons.
- F10. Glassmorphism / frosted blur panels.
- F11. Generic drop shadows (`shadow-lg`, soft 8px blur). OSRS depth comes from **hard bevels** (light top-left, dark bottom-right), not blur.
- F12. Marketing copy voice: "Elevate your…", "Built for the modern…", "Supercharge", "seamless", "powerful". (See Section 4.)

**P2 — cosmetic:**
- F13. Flat uniform spacing with no rhythm; everything same size.
- F14. Sentence-case SaaS labels where in-world labels belong (Section 4).

**Lint rules (add a `scripts/rebrand-lint.mjs` that greps the built CSS/JSX and fails CI):**
```
FAIL if regex matches in /app,/components:
  - /font-family[^;]*(Inter|Roboto|Space Grotesk|Geist|system-ui)/i
  - /(from|via|to)-(purple|indigo|violet|blue|fuchsia)-/   (Tailwind gradient/color)
  - /(bg|text|border)-(slate|zinc|gray|neutral)-/           (default grays)
  - /rounded-(xl|2xl|3xl|full)/  on elements with class ~ /panel|card/
  - /shadow-(lg|xl|2xl)/
  - /border-l-4|border-l-\[/                                 (left-border strip)
PASS requires: every color used resolves to a var(--…) token from Section 1.
```
Run this lint before every screenshot pass and before "done."

## Section 4 — Copy wordlist + literal BEFORE→AFTER rewrites

### 4.1 Mandatory jargon → player-language glossary (apply site-wide)

| SaaS / jargon term | Replace with (OSRS player voice) |
|--------------------|----------------------------------|
| Sync / Sync now | Update from RuneLite / Refresh from Gielinor |
| Setup | Kit up / Your kit |
| Export / Import bank | Copy your bank in / Paste your bank |
| Dashboard | Your adventure log / Player page |
| Stats / Metrics | (remove; if needed: "What you banked") |
| Delete my data | **Forget me** |
| Get started / Sign up | Start your next trip |
| Loading… | Checking your account… / Scrying your account… |
| Error / Something went wrong | The scroll is blank — try again |
| Submit | Confirm / Set off |
| Settings | Options (OSRS uses "Options") |
| Feature / Features | (remove marketing framing entirely) |
| Users / Players tracked | Adventurers |
| Empty state (no data) | "Nothing in the bank yet." |

Voice rules: dry, plain, faintly British, understated. Short declarative sentences. No exclamation-marketing. Model on OSRS examine-text — the OSRS Wiki notes examine text "often injected humour or subjective observations" (deadpan, useful-then-wry) — and quest dialogue. Never hype. If a sentence would fit on a startup landing page, rewrite it.

### 4.2 Literal BEFORE → AFTER (current live copy, verified from the site on the crawl date)

**Homepage (`/`)**
- H1 BEFORE: "Stop bankstanding." → **KEEP** — it's already perfect OSRS voice. (Confirm it stays.)
- Subhead BEFORE: "Set a goal, and Scapestack tells you the next step every session — and sends you a Sunday recap of what you banked." → AFTER (tighter almanac voice): "Tell it your goal. It picks your next trip, tells you when to stop, and posts what you banked each Sunday."
- Stat strip BEFORE: "**59** bosses checked · **183** quests tracked · **4,512** items priced" → **DELETE the KPI strip entirely** (hard-fail F6). If you want the numbers, fold them into flavor text on a stone plaque: "The almanac tracks 59 bosses and 183 quests." — not as counters.
- Caption BEFORE: "Today's boss · General Graardor" → AFTER: keep, style as a parchment caption under the boss sprite.
- Footer BEFORE: "Scapestack · What can I do now in OSRS? · Made for Gielinor" → KEEP.

**`/next` (Today / the plan)**
- BEFORE: "Picking your next trip..." → KEEP (good). Style as parchment being unrolled.
- BEFORE: "Checking your account" → AFTER: "Checking your account…" styled as a chat-line.
- BEFORE table "Start / Stop at" (e.g. "Start · Check Vardorvis and lock Blazing blowpipe." / "Stop at · Run 10-25 KC without changing the goal mid-session.") → reframe as an **AdventureBrief** (Section 5): "You set off:" and "Come home when:".
- BEFORE: "This is what your plan looks like" → AFTER: "A sample briefing".
- BEFORE: "Free. Your bank stays in this browser." → KEEP (privacy-factual, do not alter meaning).

**`/bank` (Setup → "Kit up")**
- Page title BEFORE: "Add bank once" → AFTER: "Add your bank once".
- Nav label BEFORE: "Setup" → AFTER: "Kit" (see nav below).
- BEFORE: "Paste your RuneLite bank." → KEEP.
- BEFORE step labels: "1. Install Bank Memory" / "2. Copy item data" → KEEP, frame as parchment steps.
- BEFORE: "Saved on this device only." → KEEP (privacy-factual).

**`/dps` (Boss → "Can I kill this?")**
- BEFORE H1: "Can I kill this?" → KEEP (great voice).
- BEFORE: "Every boss with what the game requires to get in. Add your bank and the requirements become a verdict about your account." → KEEP meaning; this is good almanac voice.
- Boss list (Obor, Bryophyta, … Vorkath, Nex, etc.) → render as **Bestiary** (Section 5), grouped In reach / Almost / A dream.

**`/slayer` (Task → "Is this task worth it?")**
- BEFORE H1: "Is this task worth it?" → KEEP.
- Slayer masters (Turael, Mazchna, Vannaka, Chaeldar, Duradel with their requirements/task ranges) → render as NPC roster plaques with the master's name as an in-world label.

**`/plugin` (RuneLite)**
- BEFORE H1: "Keep your next trip current." → KEEP.
- The privacy section ("What it sends / What it does not send / The Sunday recap / Turning it off") → **KEEP ALL WORDING FACTUALLY INTACT** (Section 9). You may restyle it as a **BankerDialog** parchment scroll, but do not change what it says it sends/doesn't send, and keep the verbatim RuneLite warning quote.
- Button BEFORE: "Delete my data" → AFTER: "**Forget me**" (label only; behavior unchanged).

### 4.3 New navigation labels (BEFORE → AFTER)
Current nav (verified): **Today · Setup · Boss** (+ mobile: Trip · Task · Bank · RuneLite).
- Today → **Today** (keep) or "Next trip"
- Setup → **Kit**
- Boss → **Bestiary**
- (mobile) Trip → Today · Task → **Slayer** · Bank → **Kit** · RuneLite → **RuneLite**
Style the active nav item like an OSRS selected side-tab (raised gold, pressed bevel).

## Section 5 — Component library specs (build these first, Section 0.3)

Build each as a real reusable component with the Section 1 tokens. Depth = **hard bevels**, never blur.

**5.1 `StonePanel`** — the base container.
- Background `--stone-700`; 2px outer border `--wood-700`; inner 1px bevel: top/left `--bevel-light`, bottom/right `--bevel-dark`. Radius `--radius-md`. Optional riveted corners (small 4px squares in `--gold-600`).
- Title bar: `--wood-500` strip, Cinzel 700 in `--stone-text`.
- Replaces every generic shadcn Card.

**5.2 `ParchmentNote`** — the reading surface for content/results.
- Background `--parchment-100`; subtle paper texture (CSS radial-gradient noise in `--parchment-200` at ~3% opacity); torn/deckled edge via mask or a 1px `--parchment-300` inset border. Text in `--ink-900` (Fraunces). Ruled lines optional using `--parchment-line`.
- Use for: the plan/briefing body, examine-style descriptions, privacy scroll.

**5.3 `SkillShowcase`** — a skills vitrine.
- Grid of skill tiles on `StonePanel`; each tile shows the skill icon (wiki sprite, see Section 9 attribution), skill name (Fraunces), and level as a **`.numeral`** (Pixelify Sans) that turns `--title-yellow` on hover (mimics OSRS hover-yellow). Level-up state flashes `--msg-good`.

**5.4 `BankerDialog`** — bank import & the RuneLite/privacy flow as an NPC conversation.
- A `ParchmentNote` with an NPC portrait slot on the left (use a generic banker-style sprite from the wiki under attribution, or a neutral silhouette if unsure) and a name label bar ("Banker") in OSRS dialogue style. Body text in Fraunces. Continue/confirm as a gold-bevel button.
- Use on `/bank` and to house the `/plugin` privacy content (wording unchanged).

**5.5 `AdventureBrief`** — a single trip as a parchment briefing.
- `ParchmentNote` headed with the trip title (Cinzel). Two labeled lines: "You set off:" and "Come home when:" (replaces the current Start/Stop table). A boss/skill sprite pinned top-right. KC/target as `.numeral`.

**5.6 `Bestiary`** — bosses grouped by reachability.
- Three sections with in-world headers: **In reach** (green `--msg-good` accent), **Almost** (gold `--gold-500`), **A dream** (muted `--ink-500`). Each boss = a stone plaque tile: sprite, name (Cinzel small), requirement line (Fraunces), and a verdict chip that reads "Can do it" / "Almost" / "Not yet" using the msg colors. This turns the current flat boss grid + the "verdict about your account" copy into an in-world roster.

**5.7 `ScrollRecap`** — the Sunday recap.
- A `ParchmentNote` styled as a sealed scroll (wax-seal circle in `--msg-warn`/`--gold-600`) listing what was banked: XP, levels, KC, log slots, goal progress — each number a `.numeral`. Header in Cinzel: "This week in Gielinor".

**5.8 `SpriteFrame`** — wrapper for any wiki sprite.
- Fixed pixel-art rendering: `image-rendering: pixelated;` never blur/scale-smooth. Provides the attribution hook (Section 9).

Global button spec: squared (`--radius-sm`), gold face (`--gold-500`) with top bevel `--bevel-light` and bottom `--bevel-dark`; pressed state uses `--gold-600` and inverts the bevel. Text Fraunces 600, `--ink-900`. No pill buttons.

## Section 6 — Page-by-page migration plan (current state → target)

Do these in order. Each page: apply tokens → swap components → apply copy (Section 4) → run lint (Section 3) → run screenshot loop (Section 7) → score (Section 8).

**6.0 Global shell (do first).** Replace body bg with `--stone-900`. Rebuild the top nav as an OSRS tab bar (gold selected tab, wood strip). Wordmark "scapestack" in Cinzel with a small gold flourish. Rebuild the mobile bottom bar (Trip/Task/Bank/RuneLite) as stone tabs. Footer keeps its text, styled as an engraved line in `--stone-text-muted`.

**6.1 `/` Homepage.** Current: hero "Stop bankstanding." + subhead + RSN input + General Graardor sprite + **KPI strip (DELETE)** + footer. Target: full-bleed `--stone-900` with atmospheric depth (layered stone gradient, faint map/parchment texture — NOT a flat color, NOT a purple gradient). Hero H1 in Cinzel. RSN input styled as a carved input with a gold "Show my next step" button. Boss sprite in a `SpriteFrame` on a stone pedestal with the "Today's boss · General Graardor" caption on a small parchment tag. Remove the three-number metrics row entirely (F6).

**6.2 `/next` Today.** Wrap the plan in `AdventureBrief`. "Picking your next trip…" becomes an unrolling-parchment loading state. Sample plan → sample `AdventureBrief`. Keep "Free. Your bank stays in this browser." verbatim as a footnote on the parchment.

**6.3 `/bank` Kit.** Convert the paste-bank flow into `BankerDialog`. Keep the Bank Memory install steps (step1.png/step2.png) but frame them as numbered parchment steps. Keep all "Saved on this device only" wording.

**6.4 `/dps` Bestiary.** Convert the boss grid into `Bestiary` with the three reachability groups. Keep H1 "Can I kill this?" and the requirement lines. Sprites via `SpriteFrame`.

**6.5 `/slayer` Slayer.** Keep H1 "Is this task worth it?". Render the five masters (Turael, Mazchna, Vannaka, Chaeldar, Duradel) as NPC stone plaques with their requirements and task ranges as `.numeral`.

**6.6 `/plugin` RuneLite.** House the entire privacy explanation in a `BankerDialog`/`ParchmentNote` scroll. **Do not alter the factual content** (what it sends / doesn't send / Sunday recap / turning it off / the verbatim RuneLite warning). Rename the button to "Forget me". Add the `ScrollRecap` as a visual example of the Sunday recap.

**6.7 New routes.** If new routes exist beyond these, apply the same order (shell → components → copy → lint → screenshot). Do not invent features.

## Section 7 — Claude Design workflow (Phase A) + Chrome workflow (Phase B)

### Phase A — Claude Design: generate directions BEFORE coding
1. Feed Claude Design the tokens (Section 1) and the direction phrase (0.6). Prompt it to generate **2–3 distinct mockups** of the homepage hero + one `Bestiary` view. Each direction must include a **signature element** (the one memorable in-world device): e.g. (a) a carved-stone almanac cover, (b) an unrolled parchment map with a wax seal, (c) an OSRS-style quest-journal spread.
2. Do NOT write component CSS for the hero until Laurens (or you, if unattended) pick ONE direction. Save the chosen mockup URL/image as the reference. State the chosen signature element in writing.
3. Lock the chosen palette/type into `app/design-tokens.ts` and reference it from `globals.css` and `tailwind.config` so future sessions start from the system, not defaults. Add a line to `CLAUDE.md`: "Design tokens live in app/design-tokens.ts and REBRAND.md — start from them, never from generic defaults." (This is the documented drift-fix: capture the first good result so the next session doesn't restart from the statistical center.)

### Phase B — Chrome screenshot loop (per page)
Run this loop for every page, minimum two passes (first pass closes ~70% of the gap, second ~25%; if still off after two, your reference was ambiguous — get a clearer OSRS screenshot rather than iterating blind):
1. Start the dev server. In Chrome, open the page.
2. Screenshot at **desktop 1440px** and **mobile 390px**.
3. Compare each screenshot to (a) the chosen Claude Design mockup and (b) a real OSRS interface screenshot (bank / quest journal / skill guide) and `osrs.design/foundations`.
4. List concrete deltas in: typography hierarchy, color (any non-token color?), radius (any >4px?), depth (bevel vs blur?), copy voice (any jargon left?), and the forbidden list (Section 3).
5. Fix the top deltas. Re-screenshot. Repeat until Section 8 passes with zero hard-fails.
6. Prompt pattern to use: *"Screenshot this page at 1440 and 390. Compare to [mockup] and to an OSRS bank screenshot. List every difference in type, color, radius, depth, and copy. Fix all hard-fails from REBRAND Section 3. Re-screenshot and confirm."*

## Section 8 — Verification checklist / anti-dashboard acceptance criteria

A page passes only if ALL are true (score each screenshot):
- [ ] Page background is stone (`--stone-900`), reading content on parchment. Not white, not dark-SaaS.
- [ ] Zero forbidden fonts (Section 3 F2); headings Cinzel, body Fraunces, game numbers Pixelify Sans.
- [ ] Zero gradients-on-white; zero purple/indigo/blue/slate/zinc anywhere.
- [ ] Every color resolves to a Section 1 token (lint passes).
- [ ] Panel radius ≤ 4px; depth is hard bevel, not blur/`shadow-lg`.
- [ ] No KPI/metrics counter strip anywhere (F6).
- [ ] No three-equal-cards-in-a-row hero (F5); a clear single visual anchor / signature element is present.
- [ ] No colored left-border card strips (F7).
- [ ] All jargon replaced per Section 4.1; no marketing voice (F12).
- [ ] "Forget me" button present; privacy wording factually unchanged.
- [ ] Character/adventure-centric: the player's account/goal is the subject, not "the product." A boss/skill sprite or in-world device is visible above the fold.
- [ ] Wiki sprites render pixelated (not blurred) and attribution is present (Section 9).
- [ ] Screenshots taken at 1440px AND 390px and both pass.
- [ ] "Would this be mistaken for a Stripe/Linear/Vercel dashboard?" → must be **No**.

## Section 9 — What NOT to touch (features, legal, logic)

9.1 **Do not change product features or behavior.** No new features, no removed features, no changed routing/data flows. Visual/copy only.

9.2 **Do not change RuneLite/plugin logic** or how bank import/hiscores parsing works. Restyle the UI around it only.

9.3 **Privacy text is factual — keep meaning verbatim.** On `/plugin` keep exactly what the site says it sends ("Your name, your levels, finished quests and diaries, your collection log, your Slayer task, and your bank if you switch that on") and does not send ("Your password. Your inventory. Your chat. Where you are standing. Screenshots."), the Sunday-recap description, the "turning it off" instructions, and the **verbatim RuneLite warning quote** ("submits your IP address and comprehensive account data to a 3rd-party server not controlled or verified by RuneLite developers."). You may restyle; you may not reword these.

9.4 **Jagex Fan Content Policy compliance:**
- Do NOT embed official Jagex fonts or extract assets from the game cache/client. Use only the OFL fonts in Section 2. Do not use FontStruct/RuneStar RuneScape-font recreations (they reproduce Jagex IP).
- Wiki sprites (skill/boss icons) are under **CC BY-NC-SA 3.0** (confirmed via the Weird Gloop copyright policy that governs the OSRS Wiki: "Content on the RuneScape wikis is licensed under Creative Commons BY-NC-SA 3.0"). This is **non-commercial**, share-alike, with attribution. Add a visible attribution line in the footer/credits: "Item and skill icons from the OSRS Wiki, CC BY-NC-SA 3.0" and link to the source page history (linking to a page's `?action=history` is the wiki's accepted attribution method for single-page reuse). **Because the license is non-commercial, if Scapestack ever charges money, these sprites must be replaced or separately licensed — flag this to Laurens; do not silently ship paid features with them.**
- Include the standard fan-content disclaimer in the footer: "Created using intellectual property belonging to Jagex Ltd under the Jagex Fan Content Policy. Not endorsed by or affiliated with Jagex." (RuneScape and Old School RuneScape are Jagex trademarks.)
- Do not reproduce Jagex's own UI chrome pixel-for-pixel or use their logos; build an *inspired* look with your own OFL fonts and CSS. The goal is "feels like Gielinor," not "copies Jagex assets."

9.5 Do not alter the "Made for Gielinor" footer line or the Buy Me a Coffee support link behavior.

---

### Appendix — why each big decision is grounded (for Laurens, not the agent)

- **Stone-not-dark, parchment-not-white:** the whole point of the rebrand is to escape the "average" that Anthropic itself names — *"Safe design choices… dominate web training data. Without direction, Claude samples from this high-probability center"* (Anthropic, *Improving frontend design through Skills*, 12 Nov 2025). Hard tokens + a forbidden list + a screenshot loop are the documented three-part fix; that's why this file leans on all three rather than on adjectives like "modern" or "clean" (which the same guidance says carry no information for the model).
- **Cinzel/Fraunces/Pixelify Sans:** all three verified SIL OFL 1.1 (commercial-safe, embeddable). Cinzel is explicitly a Roman-inscription serif ("carved stone"); Fraunces is an editorial old-style serif with a WONK axis for warmth; Pixelify Sans supplies the pixel-game cue for numbers without touching Jagex fonts.
- **Gold `#f7b538`:** the only hard value recoverable from osrs.design (its site theme-color); everything else stone/parchment is an approximation the agent must reconcile against real screenshots.
- **Red `#ff0000` / green / cyan / yellow:** OSRS Wiki Chat Interface documents `<col=ff0000>` directly; green (level-up/quest-complete), cyan (info) and yellow (menu-title/hover) follow the game's fully-saturated chat convention. Use them only as status semantics, sparingly.
- **Copy voice:** modeled on OSRS examine text, which the wiki describes as deliberately injecting "humour or subjective observations" — dry, British, understated. The site's own best lines ("Stop bankstanding.", "Can I kill this?") already nail it; the rebrand keeps them and drags the SaaS jargon ("Setup", "Sync", "Delete my data") into the same voice.
---

## Section 10 — Phase A outcome and verified amendments (appended 2026-08-09)

### 10.1 Chosen direction

**C — The Field Ledger.** Signature element: **the journal column** — a
recessed panel with a studded title bar and a black tally footer, at the OSRS
side panel's real proportions, with the boss standing behind it at full height.

Chosen over A (The Almanac) and B (The Cairn) for one reason that survives
building: at 390px an OSRS panel is 225px wide, so the signature element gets
*stronger* on mobile. A's bound spine only exists in two columns and collapses
into a cream blog post; B's gilt slab has to be re-thought. C is also the only
one whose layout is a number rather than a judgement — one row template and one
detail panel absorb all 76 bosses.

Directions were grounded by sampling three real interface PNGs pixel-by-pixel,
not by eye: `Bank_interface.png` (panel `#494034`, frame `#252522`, title
`#ff981f`), `Quest_tab.png` (frame `#3e3529`, well `#332b21`, quest names
coloured by state), `Skills_tab.png` (3-column grid, black total bar), plus
`osrs.design/foundations`. **Section 1's tokens survived that comparison
unchanged** — `--stone-700 #3a2f22` against the game's `#3e3529`, `--stone-600
#4a3d2a` against `#494034`.

### 10.2 Amendment to Section 2 — Pixelify Sans is not a numeral face for ratios

Measured, not asserted: Pixelify Sans renders `5` as a hard S and `7` as a bare
stem. At **every** size §2 names — 13, 16, 20, 24 and 32px — `1/508` reads as
`1/808` and `68/70` reads as `68/10`.

§2's own wording already scopes it correctly: "KC, levels, gp, XP, timers" are
standalone labelled quantities. Ratios, drop rates and fractions are not in
that list and must not be in this face. Drop rates are the whole `/dps`
proposition.

**Rule:** `.numeral` (Pixelify Sans) for a single labelled quantity. Fraunces
with `font-variant-numeric: tabular-nums lining-nums` for every ratio, drop
rate, fraction and price.

### 10.3 Amendment to Section 1 — `--msg-warn` has a size floor

`#ff0000` measures **3.95:1** on `--stone-800` and **4.43:1** on `--stone-900`.
Both fail WCAG AA for normal-size text.

**Rule:** red status text renders at 16px/600 minimum, where AA-large (3:1)
applies, or on a chip that raises the contrast. It is never used for body copy.
This is a floor, not a preference.

### 10.4 Note on Cinzel

Cinzel has no lowercase — it renders lowercase as small capitals. §2's "keep
body sentence-case for readability" therefore only ever applied to Fraunces,
and "Stop bankstanding." will always read as caps. That is the intended
Roman-inscription effect, not a bug.
