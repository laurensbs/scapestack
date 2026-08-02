# Scapestack — the rebuild

**Date:** 2026-08-02
**Replaces:** every promptbook before it. `COMPANION-HUB` (07-28), `JOURNAL`
(07-31) and `COMPANION-SHELL` (08-01) are now history, not instructions. Their
findings were mostly right. Their *method* was wrong, and this document exists
because the method is the thing that has to change.
**Source:** `scapestack.org/p/lauky` on production, measured 2026-08-02, after
Codex executed all eight phases of the last promptbook.

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

## 11. What not to do

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

## 12. The order

```
0  budget in the gate, failing            no components touched
1  delete until it passes                 no components added
2  the answer becomes the page
3  the quiz becomes three questions
4  the 39 empty images
5  the weight budget
```

0 and 1 are the whole point. If only those two ship, the page is better than it
is today. If 2 through 5 ship without them, this document will have failed the
same way the five before it did.
