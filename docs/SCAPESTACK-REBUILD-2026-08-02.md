# Scapestack — the rebuild

**Date:** 2026-08-02
**Replaces:** every promptbook before it. `COMPANION-HUB` (07-28), `JOURNAL`
(07-31) and `COMPANION-SHELL` (08-01) are now history, not instructions. Their
findings were mostly right. Their *method* was wrong, and this document exists
because the method is the thing that has to change.
**Source:** `scapestack.org/p/lauky` on production, measured 2026-08-02, after
Codex executed all eight phases of the last promptbook.
**Extended:** 2026-08-08 — §11–13, after an external research report was
verified claim by claim. Tasks 0–5 are unchanged and still run first.

---

## 1. Read this before anything else

Every previous promptbook was executed. Not partially — completely. Phases A
through H all shipped:

```
1f02ca3  Finish Phase A identity typography
9a378dc  Finish Phase B goal picker typography
0531f99  Finish Phase C route hierarchy
18a7d94  Finish Phase D homepage hierarchy
4bac33e  Finish Phase E Journal typography
6ad4f12  fix: preserve monotonic RuneLite progress      (F1)
0352268  fix(plugin): preserve unread progress          (F2)
e8eb207  Add OSRS marks to player identity              (G)
1011cea  Render a daily homepage boss                   (H)
```

Net `+3,895` lines in `src/` across thirty commits. Every instruction followed.

**And the page is worse.** That is not a complaint about Codex. Codex did what
it was told. The instructions were the problem, and section 3 explains exactly
how.

---

## 2. What is actually on the page right now

Measured on production, `/p/lauky`, 2026-08-02.

| | Desktop 1280×720 | Mobile 390×844 |
|---|---|---|
| Page height | **4,828px** | **5,450px** |
| Screens of scroll | **6.7** | **6.5** |

For **3,478 characters of text**. The entire page could be read aloud in under
three minutes, and it occupies six and a half screens.

**Seven sections, each roughly its own page:**

| Section | Height | Characters |
|---|---|---|
| Identity band | 652px | 182 |
| Your goals | 838px | 225 |
| Check finished quests | **5,227px** | 878 |
| Your routes | 2,662px | 735 |
| Your bank | 357px | 96 |
| Bosses | 2,902px | 496 |
| Account | 1,875px | 760 |

*(section heights measured at the narrower pane width, where blocks stack;
the totals in the table above are the true page heights at each viewport)*

**The first screen, in full:** the name `lauky`. The words `Ironman · not
synced`. Then `TOTAL LEVEL 2,202`, `COMBAT 123`, `TOTAL XP 230,138,971` — and
`QUESTS —`, `DIARIES —`, `COLLECTION LOG —`. Then a search box reading
`Try "barrows", "99 slay" or "fairy"`, and under it: `Nothing pinned.`

Three of the six identity cells are em dashes. The other three are numbers the
player can see in-game by pressing one key.

**39 of 56 images on the page have an empty `src` and render nothing.** The
sprites that do load are 16px, 29px and 30px source files displayed in ~64px
boxes. That is what those six empty squares under "CLOSEST FOR THIS ACCOUNT"
are: Phase G, shipped exactly as written, producing six dark holes.

**Weight distribution across 269 text-bearing elements:** `600` on 148, `400`
on 125. **More than half the page is semibold.** That is the mechanical reason
it still reads as one flat grey mass after the type scale was fixed — the sizes
now differ, and the weights say everything is equally important.

**The first thing a player can act on** is `connect RuneLite` at y≈554. The
second is 1,253px down.

---

## 3. Why you get the same outcome every time you paste it into Codex

This is the question that matters, and there is a clean answer.

### 3a. Every prompt was additive, and only the additive part was checkable

Look at what each phase asked for: *add* an identity band. *Add* a goal picker.
*Add* routes as first-class. *Add* a boss render. *Add* sprites to the band.

Each has an unambiguous success condition — the thing exists — and Codex hits it
every time. Alongside each one sat a paragraph about premium feel, about being a
companion and not a dashboard. That paragraph has **no success condition at
all**, so it cannot be satisfied, only ignored.

Nothing in five promptbooks ever said *remove*. Nothing set a ceiling. Nothing
forced a choice between two things that both wanted the same space. A design is
the set of things you decided not to put on the page, and no document I wrote
ever asked for that decision. So the page accumulated: seven sections, each one
a correct answer to a correctly-written prompt, and together six and a half
screens of nothing much.

**Codex did not fail to make a page. It was never asked to make a page. It was
asked, eight times, to add a section.**

### 3b. The gate never looks at the page

`ci:check` runs: typecheck → 1,681 unit tests → smoke → `audit:next` →
`audit:controller` → `plugin:release-check` → build.

Playwright is installed. `playwright.config.ts` exists. There is an `e2e` script
and a real spec at `tests/e2e/product-matrix.spec.ts`.

**`npm run e2e` is not in `ci:check`.**

So: 273 test files, and not one of them opens the rendered page. A page can ship
with 39 empty images, six and a half screens of height and 55% semibold text,
and every gate stays green, because every gate is looking at source code.

This repo already has the rule that explains the consequence — *a new guard's
first test is that it can fail*. For everything visual there was no guard at
all. Which is why the pattern is so consistent:

### 3c. The scoreboard

Sort every intervention in this repo's history by whether a number with a test
was attached to it.

**Had a number and a test — all fixed, all stayed fixed:**

- Type scale: 26 distinct font sizes → **7**. A ceiling with a ratchet test.
- The typeface: `document.fonts.size` 0 → 10. A binary fact about a missing file.
- Monotonic sync merge: quest history stopped being wiped. Had a negative test
  (post full → post empty → assert full).
- Off-scale usage count: ratcheted 735 → 713 and enforced.

**Was described in prose — none of it landed, across five documents:**

- "premium companion feel"
- "not a dashboard"
- "the visual family is the quest journal"
- "warmth from the Journal palette"
- the rendered target at `docs/design/player-page-target.html`, which nothing
  imports and nothing diffs against, and which the live page resembles in no
  respect

The pattern has been stable for five documents and it has never once broken.
**Write a number with a failing test and it gets fixed. Write a description of
a feeling and nothing happens.** That is not a fact about Codex. It is a fact
about specifications.

### 3d. So the fix is not a better description

I have now written roughly 2,400 lines of prose about how this page should feel.
A sixth attempt at describing it more vividly would fail the same way. The
correct move is to stop describing the outcome and start **budgeting the page**,
then put that budget in the gate where it can fail the build.

Everything below is written that way. There is exactly one paragraph of taste
in this document and it is section 4.

---

## 4. What the page is — one sentence

> `/p/[rsn]` answers one question: **what should I do when I log in tonight?**

That is the whole product. A player already knows their total level, their
combat, and their XP; the game shows it in one keypress. The only thing
Scapestack can know that the client does not show is *what to do next, given
everything about this account*.

Which means the current first screen is precisely inverted. It opens with
identity — three numbers the player already has and three em dashes — and puts
the answer 1,253px down. **Identity is not the answer, it is the credential
that makes the answer trustworthy.** It belongs in the header, small and
permanent, not occupying the opening screen.

That is the only aesthetic judgement in this file. Everything else is arithmetic.

---

## 5. Task 0 — the budget, in the gate, failing today

**Run this first and alone. Do not touch a component in this task.**

```
Task 0: put the rendered page in the gate.

Playwright is installed, playwright.config.ts exists, tests/e2e/ has a spec, and
`npm run e2e` is NOT in ci:check. That omission is why a page with 39 empty
images shipped past 273 test files. Fix the omission first.

1. Add `npm run e2e` to the ci:check chain, after `build`. Make it start the
   PRODUCTION server (next build + next start), never the dev server — this
   repo has shipped SSR and caching claims from the dev server three separate
   times and been wrong every time.

2. Write tests/e2e/page-budget.spec.ts. It loads /p/lauky at 1280x720 and at
   390x844 and asserts:

     page height          <= 2200px desktop, <= 2800px mobile
     top-level sections   <= 3
     images               <= 20, and ZERO with naturalWidth === 0
     any image displayed  >= 40px must have naturalWidth >= 32
     font sizes           exactly the six tokens, no others
     font weight 600      on <= 35% of text-bearing elements
     distinct text colours <= 5
     horizontal overflow  none at 390px
     first actionable control other than "connect RuneLite" is above the fold

3. Run it. Record the actual failures in the spec file as a comment, with today's
   numbers, so the next person can see the distance travelled:
     height 4828/5450, sections 7, images 56 (39 empty), weight-600 55%,
     font sizes 7 (11.5px x4 off-scale)

Gate: the spec must FAIL on current main, on every assertion listed above except
horizontal overflow. If any assertion passes today, the threshold is too loose —
tighten it until it fails, because a budget that already passes is not a budget.
Report the failure output before doing anything else.
```

**Why this task is first and separate.** Everything after it is verified by it.
Without it, the next eight tasks are eight more descriptions.

---

## 6. Task 1 — delete until the budget passes

**Nothing is added in this task. This is the task that has never been written
before, and it is the one that changes the outcome.**

```
Task 1: get /p/[rsn] under the Task 0 budget by removal only.

Do not add a component. Do not restyle. Do not improve anything. Remove, merge
and collapse until tests/e2e/page-budget.spec.ts is green.

The seven sections become three. The mapping:

  KEEP as section 1 — the answer.
    What to do tonight. This is the page. It gets the top of the screen and the
    only --text-answer on it.

  KEEP as section 2 — your goals.
    What you told us you are working toward, and how close it is.

  KEEP as section 3 — routes.
    The path from here to those goals.

  MOVE to the header — the identity band.
    Name, account type, total level, combat. One line, always visible, ~28px
    tall. Total XP, quests, diaries and collection log go with it as a tooltip
    or a /u/[rsn] link — NOT as six cells occupying the opening screen. Three of
    those cells are em dashes today; an em dash is the product admitting it does
    not know you, and it should not be the first thing anyone reads.

  MOVE to /u/[rsn] — the bank section (357px, 96 characters) and the account
    section (1,875px). Neither answers "what do I do tonight".

  COLLAPSE — the bosses section (2,902px). Whatever in it is an answer belongs
    in section 1. The rest is a table that belongs on its own route.

  REWRITE — "Check finished quests", currently 5,227px and the single largest
    thing on the page. It is a form asking the player to tell us which quests
    they have finished. See Task 3; in THIS task it collapses to one line with
    a link, and nothing more.

Gate: `npm run ci:check`, which now includes the budget spec. It must go green
by deletion. If it cannot, report which assertion is blocking and why — do not
add anything to make it pass.
```

**The rule that makes this stick, and it goes in `CLAUDE.md`:**

> A section may only be added to `/p/[rsn]` if a section is removed in the same
> commit. The page has a fixed budget of three.

---

## 7. Task 2 — the answer is the page

```
Task 2: make section 1 answer the question.

Right now the top of the page is identity and the answer is 1,253px down. Invert
it. When a player opens /p/lauky the first thing on the screen is what to do
tonight, at --text-answer weight 800 — the one loud element, and there is
exactly one.

Structure, top to bottom, inside a single viewport:

  one line   what to do
  one line   why it is that, in the player's units — ticks, trips, KC,
             multiples of drop rate. Never "hours saved".
  one row    what it needs (sprites, 40px, real ones — see Task 4)
  one link   why not something else

That is the entire section. No card, no border, no panel. It is the page, and a
page does not need a container.

If the account has not synced, the answer is still an answer — derived from
hiscores — and it says what connecting RuneLite would add. It does NOT become a
connect prompt. "Ironman · not synced" plus three em dashes is the current
behaviour and it tells a returning player the product knows nothing about them.

Gate: `npm run ci:check`. The budget spec asserts exactly one --text-answer and
one weight-800 element on the page; if section 2 or 3 wants to be loud, it is
wrong.
```

---

## 8. Task 3 — the quiz is the biggest thing on the page and it should not exist

5,227px asking the player to tell us which quests they have finished.

The stated reason is true: hiscores do not expose quest completion. But the
plugin does — `GameStateReader.readQuests` reads it from `Quest.getState`, and
after F1/F2 the server keeps it. So the quiz is the fallback for accounts
without the plugin, and it is currently the *default* experience, at 60% of the
page.

```
Task 3: the quiz becomes progressive, and stops being a wall.

1. Never show more than THREE questions at once, and only the three that
   currently block the nearest goal. "Barrows gloves needs Recipe for Disaster —
   done?" is worth answering. Sixty checkboxes is a chore, and a returning
   player who is deciding whether to log in tonight will not do a chore.

2. Every answer immediately changes something visible on the page. If answering
   does not move a route or unlock a goal, do not ask it.

3. If the plugin is connected, the quiz does not appear at all. Not collapsed —
   absent.

4. One line above it, in plain words: "RuneLite fills these in automatically."
   Link to the setup. This is the only place on /p/[rsn] that sells the plugin.

Gate: `npm run ci:check`. The budget spec's 2200px ceiling enforces this: three
questions fit, sixty do not.
```

---

## 9. Task 4 — 39 empty images, and the sprites that are too small to see

```
Task 4: fix the images that shipped broken.

Measured on production today: 56 <img> on /p/lauky, 39 with an empty src that
render nothing. The six squares under "CLOSEST FOR THIS ACCOUNT" are the visible
symptom. Phase G shipped and produced holes.

1. Find the 39. They resolve to the empty string, which means a null/undefined
   id reached the src without a guard. An <img> with no source must not render
   at all — no element, no box, no reserved space.

2. The sprites that DO load are 16px, 29px and 30px source files displayed in
   ~64px boxes. chisel.weirdgloop.org serves item sprites at their native
   inventory size. Either display them at native size, or pick a source that
   has the resolution. Do not upscale a 16px PNG into a 64px box and call it a
   sprite — that is the same mistake Phase D made with the boss render.

3. The budget spec already asserts both: zero images with naturalWidth 0, and
   naturalWidth >= 32 for anything displayed above 40px. Make it green.

Gate: `npm run ci:check`.
```

---

## 10. Task 5 — weight, because the type scale only did half the job

```
Task 5: 148 of 269 text-bearing elements are weight 600. Get it under 35%.

The type scale fixed sizes and the page still reads flat, because weight was
never budgeted. When more than half the page is semibold, semibold means
nothing.

  400  body, and anything that is not a name or a number
  600  names and numbers — the thing a player scans
  800  the single answer, once per page, and nowhere else

700 currently appears 4 times and is not in the system. Remove it or make it 600.

While in there: 11.5px appears 4 times and is off-scale. It is the last
off-scale size on this page. Remove it and lower CEILING in tests/type-scale.ts
in the same commit.

Gate: `npm run ci:check`.
```

---

## 11. The research report, verified (2026-08-08)

An external research report arrived proposing a rebuild: runescapecn skin,
RuneStar fonts, a panel dashboard at `/`, WOM and TempleOSRS integration.
Every claim in it that could be checked was checked, against the repo and
against the live services, before any of it was allowed into this document.

| Claim | Verdict |
|---|---|
| runescapecn registry, quoted tokens | **True.** Lives on `www.runescapecn.com` (naked domain 307s — follow redirects). `runescape.json` 2,543b; `button.json` carries `#8a7340`, `border-2 border-black`, the corner rivets and both bevel insets verbatim. Repo licence MIT (GitHub API). |
| RuneStar fonts 1.103-0, CC0 | **True — downloaded.** `RuneScape-Fonts.zip`: 10 families as ttf+otf, ~6KB each, name-table reads `Public Domain`, families named exactly `RuneScape Plain 12` etc. This unblocks §0d of the previous book: the earlier 404s were guessed raw paths; the real distribution is the release zip. |
| "crispest at multiples of 16px" | **True, and now explained**: `unitsPerEm=16` in the head table (Quill: 32). At any other size the glyph grid misses the pixel grid. Consequence below, in Task 6. |
| Dev/start on port 4173 | True. |
| Route map | **Partly.** `/diary`, `/skills`, `/ge`, `/gp`, `/hiscore` do not exist. Real: `bank dps goals link next p plugin quests share slayer u`. |
| "Mood" control | **True** — a real subsystem: `src/lib/mood.ts`, 77 references in `next-client.tsx`. |
| Plugin opens `/next?rsn=…&source=plugin-sync&bank=none` | True — `ScapestackSyncPlugin.java:776`. |
| `/api/sync/claim`, sha256, first-wins | True — the route exists as described. |
| WOM v2, 20 req/60s | **True, measured live**: `ratelimit-limit: 20`, reset 60s. `lauky` resolves with combat 123 — matches the page. |
| Prices `/api/v1` vs `/api/v2` | Both return 200 today. |
| "The app currently feels empty" | **False for `/p/[rsn]`** — measured at 6.5 screens. True only for a first visit without an RSN, and the demo account the report prescribes already exists: `src/lib/reference-account.ts`. |
| Add `osrs-json-hiscores` | **Rejected** — `src/lib/hiscores.ts` already parses hiscores server-side. No new dependency for a solved problem. |

**Adopted:** the skin and the fonts (Task 6), the never-empty check (Task 7).

**Rejected, with reasons:**

- **Phase 1, the "Overarching Player dashboard".** A grid of six panels — orbs,
  XP chart, bank value, CL bar, Slayer, hero card — is the dashboard look by
  construction, and "it feels like a dashboard" is the complaint this entire
  document exists to fix. The report optimises "never empty"; this page's
  measured disease is "never chosen". The three-section budget stands.
- **The tier-ladder component.** The header already carries "Hiscores only —
  connect RuneLite for quests, diaries and your bank". That is the ladder, in
  one line. A persistent three-row unlock component is a fourth section.
- **WOM, TempleOSRS, GE alerts.** Deferred, not refused — WOM is verified live
  and viable. New data sources pointed at a page that is over budget make it
  more over budget. They queue behind a green budget spec.
- **A route conflict the report exposed, recorded but not solved here:**
  `/next` and `/p/[rsn]` both answer "what should I do", and the plugin opens
  `/next`. After the rebuild one of them redirects to the other; until that
  decision, build nothing new on both. "Mood" lives on `/next` and waits for
  the same decision.

---

## 12. Task 6 — the skin, as a replacement

The meta-diagnosis in §3 said every intervention so far was a prohibition, and
prohibitions cannot produce rightness. This is the first task that is a
positive visual idea: the game's own interface grammar — stone, gold, bevels,
zero radius, the game's own faces. It is also the only part of the report that
answers what five promptbooks of "premium companion feel" prose were reaching
for, and it comes with checkable numbers.

```
Task 6: apply the OSRS interface grammar. Replacement only.

Run AFTER Task 1 is green. This task swaps styling; it adds no section, no
component and no height. The budget spec stays green throughout.

1. Fonts. Commit the ttfs from RuneStar release 1.103-0 (RuneScape-Fonts.zip —
   licence Public Domain, verified in the name-table): Plain 11, Plain 12,
   Bold 12, Quill, Quill Caps. ~6KB each; no conversion needed; load via
   next/font/local. unitsPerEm is 16 (Quill: 32), so these faces are
   pixel-crisp ONLY at 16/32/48px. Two new tokens: --text-rs: 16px and
   --text-rs-display: 32px, added to SCALE in tests/type-scale.test.ts in the
   same commit. The RS faces take: identity-band numbers, buttons (Bold 12),
   section names (Quill Caps at 32px). Archivo keeps: body prose, tables,
   everything under 16px. An RS face at any size other than 16/32/48 is a bug.

2. Tokens. Vendor them by hand from
   https://www.runescapecn.com/r/styles/runescape.json (use www — the naked
   domain 307s) into globals.css. Do NOT run shadcn init against this repo: it
   wants to own globals.css, and three ratchet tests read that file. Verified
   values: primary 45 65% 58%, ring 30 100% 56%, border pure black,
   radius 0px, rs-gold #C9A961.

3. Bevels, verbatim from button.json: border-2 border-black; raised
   `inset 1px 1px 0 rgba(255,255,255,0.25), inset -1px -1px 0 rgba(0,0,0,0.6)`;
   active inverts it; fill #8a7340, hover #9a8350. Buttons and panels only.
   Zero border-radius everywhere.

4. One scale per meaning, restated for the new ground: chrome is stone and
   gold — the runescape.json tokens. The OSRS text colours (yellow, green,
   red, cyan, white) are DATA ONLY, exactly as the game's own interfaces use
   them. The accent-budget and eyebrow guards will start failing during this
   task; update each in the commit that breaks it, and prove each can still
   fail before moving on.

5. theme-color moves off #030201 onto the new ground colour.

Gate: npm run ci:check including the budget spec. Page height may not grow by
a single assertion — a skin adds zero pixels. If height grows, the skin
smuggled in a section.
```

**Why after the deletion and not before.** Skinning seven sections produces a
prettier seven sections; that is precisely what happened between 07-31 and
08-02. The grammar goes onto the three sections that survive Task 1.

---

## 13. Task 7 — never empty, for the price of a check

The one product principle from the report worth keeping, and it is nearly free:
the demo account already exists (`src/lib/reference-account.ts`, rendered by
`home-specimen.tsx`).

```
Task 7: assert the product is never blank.

1. / without an RSN shows the demo answer and the day boss. Already built —
   assert it.
2. /p/[rsn] for a valid RSN that has never synced renders an answer-shaped
   page from hiscores alone (Task 2 behaviour), never a connect-wall, never
   an empty state.

Both as Playwright assertions next to the budget spec. No new UI in this task;
if either assertion fails, fix the state, not the assertion.
```

---

## 16. Driven in Chrome, 2026-08-08 — what a returning player actually meets

The budget work made the page short. This section is what was still wrong when
someone used it, as the account owner, in a real browser.

### 16a. The product refused the goal it had just invited

Pinning "95 Fletching" at 94/95 produced:

> Nothing in this 60-minute list moves 95 Fletching. Here is something else
> worth doing.

Structural, not a missing row. Every generator in `next-up.ts` reads a
hand-written constant; the skill generator reads `SKILL_MILESTONES` — **eight
skills, fifteen levels, no Fletching, never 95** — while the goal picker offers
`[70, 80, 85, 90, 92, 95, 99]` across **all twenty-four**. The picker and the
engine were built against different ladders, so the app has been suggesting
goals it structurally cannot answer.

Fixed by building the trip from the goal (`src/lib/pinned-goal-trip.ts`);
`buildSkillRoute` already did the work for any skill at any level. The test
that matters walks the picker's own catalogue and fails when it offers a goal
the engine cannot serve — the assertion that would have caught this.

**The general rule this exposes:** any catalogue the UI can index into must be
tested against the UI's own index, not against a sample.

### 16b. The homepage subject was invisible three days out of four

"Today's boss · Phantom Muspah" over an empty rectangle. The PNG had loaded and
nothing was dimming it — the render is dark on a `#1C1811` ground. Measured
across all twelve curated renders:

| | contrast vs ground |
|---|---|
| Cerberus | **1.07:1** — the same luminance as the page |
| Vardorvis | 1.36:1 |
| Nex | 1.60:1 |
| Vorkath | 2.19:1 |
| Zulrah | 4.36:1 |

**Nine of twelve under 3:1.** Curation was not available — only three clear it —
so the fix is a treatment: layered gold drop-shadows outline the sprite the way
the game outlines an NPC, on a lifted plate.
`scripts/measure-boss-contrast.mjs` commits the numbers.

**The rule:** a design token changed under existing art is a change to the art.
The ground moved to `#1C1811` in Task 6 and nothing re-checked what stood on it.

### 16c. Closed on 2026-08-08 — all three

Each was a missing surface over machinery that already worked.

**The owner was a stranger** because there were two coverage states where the
product needed three. "A row exists but this browser is not the paired one" had
no representation, so `/p` said "synced 9 days ago" and "Hiscores only" in the
same breath. `AccountCoverageLine` carries all three and the unpaired state
offers the step that was actually missing — `ConnectBrowserModal` did the whole
handshake already and nothing outside the site header could reach it. Checked
before shipping the button: `/api/account/pair/approve` requires the plugin's
install token, so a stranger clicking "This is me" gets a code nobody approves.

**The three trust claims** are one line, on both routes, from one component.

**The clock is on.** `FarmTimersLine` renders in the existing `lastTrip` slot as
an `<aside>` — no fourth section — and formats its countdown in the browser on a
30-second tick, because a server-rendered "next in 1h 20m" is correct for one
minute and a lie for the rest of the session. Owner-only by construction. It
stays dark until a contract-4 row exists, which is correct: the surface is
built *before* plugin 0.4.0 ships, not after.

**What the gate caught that I did not.** `AccountCoverageLine` renders its own
`<p>` and `PlayerIdentityBand` wrapped it in another. A `<p>` inside a `<p>` is
auto-closed by the parser, so server HTML and client DOM disagreed and React
threw hydration error #418 on every `/u` render. 1,738 unit tests saw nothing.
Third time in this batch that only the rendered page found the defect — which is
the argument for §3b restated in its strongest form.

### 16d. What is still open

- **The engine still answers from generators, not from the account.** Task 16a
  fixed the skill ladder; the same shape exists in every other generator —
  each reads a hand-written constant. The next pinned goal class that has no
  matching constant will fail the same way, and the catalogue test only covers
  skills.
- **Plugin 0.4.0 is prepared and unsubmitted.** The farm surface is live and
  dark. Shipping the plugin is the step that turns the clock on, and the Plugin
  Hub builds one immutable commit — so the release should carry every batched
  plugin change at once.

---

## 14. What not to do

**Do not add a section.** Three is the budget. If something new is worth adding,
name what comes off in the same commit.

**Do not make it prettier before it is shorter.** Warmth, sprites, palette and
motion applied to a 6.5-screen page produce a prettier 6.5-screen page. That is
what happened between 07-31 and today.

**Do not treat the rendered target as a spec.**
`docs/design/player-page-target.html` was written on the theory that Codex would
diff against it. Nothing imports it, nothing tests against it, and the live page
resembles it in no respect. Keep it as a sketch or delete it, but do not point a
task at it — a target nothing measures is prose with angle brackets.

**Do not verify on the dev server.** SSR, caching and what actually renders are
only true on `next build` + `next start`. This repo has been wrong about that
three times.

**Do not accept a green budget spec that was green on the first run.** If it
passed before any work was done, the thresholds are wrong.

---

## 15. The order

```
0  budget in the gate, failing            no components touched
1  delete until it passes                 no components added
2  the answer becomes the page
3  the quiz becomes three questions
4  the 39 empty images
6  the skin, as a replacement             after 1; adds zero height
5  the weight budget                      after 6 — measured against the new faces
7  never empty                            any time after 1
```

0 and 1 are the whole point. If only those two ship, the page is better than it
is today. If 2 through 5 ship without them, this document will have failed the
same way the five before it did.
