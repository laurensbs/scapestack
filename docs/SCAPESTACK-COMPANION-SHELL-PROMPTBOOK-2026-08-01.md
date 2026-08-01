# Scapestack — Companion Shell Promptbook

**Date:** 2026-08-01
**Status:** execution promptbook. Feed the phases to Codex in order, one at a time.
**Builds on:** `docs/SCAPESTACK-JOURNAL-PROMPTBOOK-2026-07-31.md` — its phases 1 (goals), 4 (route as path), 5 (plugin in plain words) and 7 (plugin panel) still stand unchanged. This book replaces its phases 2, 3 and 6.
**Source:** `/p/lauky` on production, measured 2026-08-01, after Codex shipped Journal phase 1.

---

## 0. What the screenshot proves

Journal phase 1 landed: goals can be pinned. And the page still does not read as a
companion. That is worth understanding precisely, because the fix is not "more polish".

**The browser tab knows more about the account than the page does.**

```
tab       lauky · 2202 total · 123 cb
page      lauky
          ironman · synced 18 minutes ago
          From your Hiscores only — connect RuneLite to include quests and your bank
```

Total level, combat level, total XP, quests, diaries, collection log — all of it is
fetched, and none of it is on screen. `SyncedPlayer` carries `questsCompleted`,
`diariesCompleted`, `collectionLogItemIds` and `skills`; the header renders a name, a
type, an age and a disclaimer.

**The first interactive thing on the page is a form.** `pinned-goals-panel.tsx:177, 187,
195` — three native `<select>` elements and a *Pin goal* button, above any content. A
native select renders the operating system's dropdown and popup. Nothing else on a page
can look premium while an OS widget sits at the top of it. And a companion greets you with
information; a settings screen greets you with a form.

**There is no game on the page.** `src/app/page.tsx` is 27 lines: a heading, one line, an
input. `src/lib/bosses.ts` carries `iconItemId` on **77 bosses** and
`/api/sprite/item/[id]` exists and works. The imagery is sitting there, unused.

**"Pick a maxing lane: Cooking"** — to a 2202-total account. "Lane" is engine vocabulary,
and the answer itself is thin.

### What premium actually means here

Not gradients and not animation. Four things, all measurable:

1. **No browser defaults.** A native `<select>`, a default focus ring or an unstyled
   scrollbar reads as unfinished faster than any amount of layout fixes it.
2. **Real imagery at real size.** 40px in a corner is decoration. 96–160px is a subject.
3. **Density with hierarchy.** A companion shows a lot and ranks it. The current page
   shows little and ranks nothing.
4. **Zero apology.** Every disclaimer sentence subtracts.

---

## Phase A — the identity band

**Why first.** It is the answer to "who am I" and it is the reason a page feels like
*yours* within half a second. Every number already exists.

```
Read docs/SCAPESTACK-COMPANION-SHELL-PROMPTBOOK-2026-08-01.md section 0 first, and
docs/SCAPESTACK-JOURNAL-PROMPTBOOK-2026-07-31.md for the standing rules. Repo: git dir is
`.repo-git`, so every git command needs `--git-dir=.repo-git --work-tree=.`. The gate is
`npm run ci:check`.

Task: the player page opens with who this account is.

Today the header renders a name, "ironman · synced 18 minutes ago", and a coverage
disclaimer. The browser tab title carries more account information than the page body.

Build the identity band directly under the name — the six numbers an OSRS player actually
quotes about themselves:

  Total level      2202
  Combat           123
  Total XP         421,880,412
  Quests           158 / 158
  Diaries          44 / 48
  Collection log   612 / 1,600

Sources, all already fetched and currently discarded:
  total / combat / XP   Hiscores skills, or SyncedPlayer.skills when synced
  quests                SyncedPlayer.questsCompleted against the quest table
  diaries               SyncedPlayer.diariesCompleted against data/diaries.json
  collection log        SyncedPlayer.collectionLogItemIds

Rules:
- Fractions, never percentages, never progress bars. The game counts in fractions.
- A number we cannot see renders as an em dash with the reason available on the row, not
  as zero and not as a guess. An unsynced account showing "Quests —" is honest; showing
  "Quests 0 / 158" is a lie.
- Tabular figures, right-aligned, so the column scans.
- The band is chrome, so it is quiet: no accent colour on the labels. The NUMBERS may use
  the data colours already in the design system (#FFFF00 for levels, #00FF80 for 10M+).
- Kill the coverage disclaimer paragraph. Coverage is one short line in the band's footer
  ("Hiscores only — connect RuneLite for quests, diaries and your bank"), said once.

Gate: `npm run ci:check`. Write the test first and show it red: an unsynced account
renders em dashes rather than zeros for quests, diaries and collection log. After every
new guard: sabotage the thing it protects, confirm red, restore, confirm `git status`
clean, report that proof. This repo has shipped five guards that could not fail, four of
which protected the defect they were written to prevent.
```

**The trap.** The instinct is to fill every cell so the band looks complete. A zero where
the truth is "unknown" is exactly the failure this repo already paid for once, when the
engine treated every quest as unfinished because a Set was undefined. Em dash, always.

**Done when.** A stranger looking over your shoulder can tell what kind of account this is
without scrolling.

---

## Phase B — pick a goal the way you pick an item

```
Task: replace the goal picker with something that belongs in a game.

pinned-goals-panel.tsx:177, 187 and 195 render three native <select> elements plus a
button, and they are the first interactive thing on the page. A native select draws the
operating system's dropdown; that single detail undoes any amount of polish elsewhere.

Replace with:
- One search field. Type "barrows", "99 slay", "fairy" and see matches across all three
  goal kinds at once. The player does not know or care that "item", "level" and "unlock"
  are different types in our model — that is our schema leaking into their vocabulary.
- Results as a grid of sprite tiles, 64px, with the name under each. /api/sprite/item/[id]
  exists; GOAL_SETS and the boss table already carry the ids.
- Click a tile to pin. No separate Pin button.

The empty state is not a form. It is a short line and six suggested tiles drawn from what
this account is closest to — the engine already computes proximity, so use it. "Nothing
pinned" plus three dropdowns is a settings screen.

When goals ARE pinned, the picker collapses to a single "+ Add goal" affordance. The
picker must never outrank the goals themselves.

Gate: `npm run ci:check`. Add a guard that no <select> element exists in
src/components/pinned-goals-panel.tsx, and none in the player page tree — this is the
kind of regression that arrives silently in a refactor.
```

**The trap.** A search field that only matches the start of a name will feel broken —
players type "slay" for Slayer and "bgloves" for Barrows gloves. Match on substring across
name and group, and show the kind as a quiet label on the tile rather than as a filter the
player must set first.

---

## Phase C — routes are the product

**Why here.** The user's own words: *routes bepalen naar max, routes naar collections.* A
route is the general form; "route to Barrows gloves", "route to max" and "route to the
collection log" are instances. This is what a companion holds that a tool does not.

```
Task: make a route a first-class object, and ship three kinds.

Journal phase 4 specifies the visual form: a vertical path with done nodes ticked, the
current node marked, and future nodes carrying their one blocking requirement. Build the
data behind it, and three routes:

1. ROUTE TO A PINNED GOAL — the unlock chain. Barrows gloves is Recipe for Disaster is
   seven subquests, each with its own gate. This is the one Journal phase 4 already
   describes; build it first because the other two reuse its shape.

2. ROUTE TO MAX — the remaining skills, ordered, with XP remaining on each and the
   nearest one marked as current. Do NOT express this in hours; "hours to max" is a
   banned unit in this product's voice and the existing maxEstimate.totalHours figure is
   wrong at both ends (3,520.5 for a 1,433-total iron, 0 for a maxed account). Express it
   in XP and levels, which is what a player checks.

3. ROUTE TO THE COLLECTION LOG — which bosses hold the most slots this account does not
   have. data/drop-rates.json and SyncedPlayer.collectionLogItemIds are both present. A
   row reads: boss, slots you are missing, and the rarest one. Rank by slots missing, not
   by rarity — a companion helps you finish, not gamble.

Rules:
- A route the account cannot verify says so per node. No plugin means no confirmed quest
  completions, and a node that assumes either way is the failure this repo already paid
  for.
- Every route node that names a thing carries its sprite at 40px.
- No "Unlock 93/100" score and no legend explaining a column. A number that needs a legend
  is not a number. That pair is deleted, not restyled.

Gate: `npm run ci:check`, plus 375px on a production build — `npm run build` +
`next start`. The dev server lies about rendering here and that has shipped as fact three
times.
```

**The trap.** Route to max is easy to make demoralising: 23 rows of eight-figure XP
numbers is a wall. Show the nearest three and let the rest expand. The companion's job is
the next step, not the full ledger.

---

## Phase D — the homepage gets a face

```
Task: give the logged-out homepage a subject, and say what Scapestack is.

src/app/page.tsx is 27 lines: a heading, one line, an input. There is no game on it.
Meanwhile src/lib/bosses.ts carries iconItemId on 77 bosses and /api/sprite/item/[id]
works.

1. A large boss sprite as the page's subject — 128-160px, pixelated, with the boss named
   quietly beside it. It CHANGES, but never on a timer: pick it deterministically from
   the day, so it is different when you come back tomorrow and stable while you are
   looking at it. An element that cycles on an interval is an ambient loop, which this
   design system removed everywhere else on purpose.

2. Positioning. The current headline is "Stop bankstanding and pick the next trip." Say
   what it IS as well as what it does:

     Your OSRS companion.
     Scapestack remembers what you are working toward and tells you the next step.
     [ name field ]  [ Open my page ]

3. Under the fold, three proof lines with real counts pulled from the data at build time
   — bosses checked, quests tracked, items priced. Wise Old Man does this with four
   figures and it is the cheapest credibility on the page. Do not invent user counts.

Keep it to one screen. No feature grid, no testimonials, no demo table of somebody else's
account.

Gate: `npm run ci:check`. Confirm on a production build that the sprite renders at size
without layout shift and that the page is one screen at 375px.
```

**The trap.** "It changes occasionally" invites `setInterval`. Do not. A day-seeded pick
gives the same feeling with none of the cost, and it survives a player who leaves the tab
open for six hours.

---

## Phase E — the Journal skin

**Why last of the visual phases.** Applying warmth and sprites to a page that now holds
goals, an identity band and routes is worth it. Applying it to what shipped yesterday
would have been a prettier dashboard.

This phase is unchanged from `SCAPESTACK-JOURNAL-PROMPTBOOK-2026-07-31.md` phase 3 — run
that prompt verbatim. Summary of what it does: ground moves from `#0D0D0C` to the warm
tones already sampled and sitting unused in the design system (`#1C1811` ground, `#2A2318`
panel, `#151009` slot, `#8A7142` edge); every row that names a thing gets its sprite at
40px; fractions replace percentages; ticks and crosses carry done-state in shape as well
as colour.

**The trap, restated because it is the one that will bite.** Warm ground plus saturated
data colours goes garish the moment chrome creeps up in saturation. The rule that keeps it
honest is already in `globals.css`: **saturated colour is data only.** If a border, a
label or a background becomes colourful, it is wrong.

---

## Working rules

**A guard that cannot fail is not a guard.** Five source-grep guards in this repo passed
while the thing they guarded was broken, and four actively protected the defect. After
every new guard: sabotage, confirm red, restore, confirm `git status` clean, report the
proof.

**Verify against something that can produce a negative.** A deploy check polling for HTTP
200 approves the previous build.

**Anything about SSR, caching or rendering is only true on `npm run build` + `next start`.**

**A metric is never a headline.** "+18k XP" is a table cell. Written before 2026-07-28 and
violated on the homepage anyway.

**One scale per meaning.** Every verdict goes through `.scape-verdict[data-gate]`.

**Voice.** Dry, second person, quantified. Banned: seamless, powerful, effortless, elevate,
empower, intuitive, robust, streamline, transform, journey, ultimate, unleash — plus vibe,
session, and "lane" as in "maxing lane". Count in ticks, trips, KC and multiples of drop
rate, never in hours.

---

## Appendix — the shell, top to bottom, when all phases have run

```
  scapestack                                    Today · Setup · Boss · lauky

  lauky                                                              [ Sync ]
  ironman · synced 18 minutes ago

  TOTAL     COMBAT   TOTAL XP        QUESTS      DIARIES    COLLECTION LOG
  2202      123      421,880,412     158/158     44/48      612/1,600
  Hiscores only — connect RuneLite for quests, diaries and your bank

  YOUR GOALS                                                      + Add goal
  [sprite] Barrows gloves      Recipe for Disaster · 3 subquests left     7/10
  [sprite] 99 Slayer           94 → 99 · 8.1m XP to go                  94/99
  [sprite] Fairy rings         Fairytale II · needs a Dramen branch      nearly

  DO THIS FIRST
  [sprite 64] Monkey Madness I
              The next gate to Barrows gloves.
  Start   Talk to King Narnode in the Grand Tree.
  Bring   Monkey greegree — it is in your bank.
  Stop at After the Jungle Demon. That is the long half.
  [ Open ]  [ Something else ]

  ROUTES
  To Barrows gloves      7/10      →
  To max                 23 skills, Cooking nearest    →
  To the collection log  612/1,600, Sarachnis holds 4  →

  YOUR BANK
  812 items · 14,500,000 gp
  Ahrim's robeskirt — 1,572,490 gp. That finishes Ahrim's set.
```

Six numbers, three goals, one answer, three routes, one bank line. That is a companion.
Everything above exists in the data today; none of it is on screen.
