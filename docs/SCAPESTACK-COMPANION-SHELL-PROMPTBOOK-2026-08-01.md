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

## 0b. Why the UI does not work — the craft, measured

Section 0 is about what is *missing*. This is about what is *wrong* with what is there.
All of it measured on `/p/lauky`, 2026-08-01.

### There is no type scale, only two sizes

The name renders at `text-4xl sm:text-6xl` — 60px. Everything under it is `text-[12px]`
or `text-[11px]`. A 5× jump with nothing in between is not a hierarchy; it is a headline
and a footnote. Nothing on the page occupies the middle, which is where a companion does
its work — the goal names, the route steps, the answer.

Measured across `src/`: **twenty-six distinct font sizes**, nine of them between 9px and
14px in half-pixel steps. `11px` (170 uses), `11.5px` (132), `12px` (165), `12.5px` (125)
and `13px` (134) alone are **726 usages that no eye can separate**. The page reads as one
flat grey mass because it is one weight.

**The scale is now defined and enforced**, because a principle in a document does not
survive translation into code — five promptbooks in a row proved that here. Six tokens in
`globals.css`, each with one job:

| token | size | job |
|---|---|---|
| `--text-label` | 11px | uppercase section marker, table headers |
| `--text-micro` | 12px | secondary and dim body — notes, sources, counts |
| `--text-body` | 14px | the default: table cells, sentences, values |
| `--text-subject` | 19px | what a player scans: goal names, route steps, boss names |
| `--text-answer` | 28px | the ONE loud element per screen |
| `--text-page` | 40px | the page title. Rare — most screens do not have one |

`tests/type-scale.test.ts` holds a ratchet at **735 off-scale usages** and fails if that
number goes up. Every phase below lowers it; lower the `CEILING` constant in the same
commit that earns it. A 60px account name is not on the scale, which is the point.

### Three heading patterns on one screen

```
YOUR GOALS            uppercase label + large question heading
DO THIS FIRST         uppercase label + large title
Not this?             small bold, sentence case, no label
YOUR BANK             uppercase label
```

Four sections, three different constructions. A reader learns a pattern in the first two
sections and then has to relearn it. Pick one and use it everywhere.

### The empty state outweighs the content

"Nothing pinned" plus the picker occupies more vertical space than the actual answer
below it. The loudest, largest, most colourful thing on a returning player's page is a
form asking them to configure something. An empty state should be the smallest state, not
the biggest.

### Two solid buttons compete, and the wrong one wins

`Pin goal` renders as a solid light block. `Open unlocks` renders as a solid light block.
They are the same weight, so the page has two primary actions — which means it has none.
Worse, `Pin goal` sits higher, so the visually dominant action on the page is the
secondary one.

One primary action per screen, solid. Everything else is a link or an outline.

### Dismissal competes with content

In "Not this?", each row's `Hide` control carries the same visual weight as the route name
beside it. An action whose entire purpose is to make something disappear should never draw
the eye as hard as the thing itself.

### The measure is blown

`player-hub-shell.tsx:21` sets `max-w-5xl` — 64rem, about 1024px. The Start / Bring /
Stop values run the full width of that column as single lines. At 1024px and 13px type
that is roughly 160 characters per line, against a comfortable 60–75. The eye loses the
line on the return sweep, which is exactly the feeling of "this is dense and I do not want
to read it".

Long-form values need their own measure inside the wide column. The column being wide is
fine; the sentence spanning it is not.

### Everything is 13px grey on black

The goal picker, the Start/Bring/Stop table, the route rows and the bank line are all
rendered at the same size, weight and colour. Nothing is emphasised because everything is
equal. When a design has no contrast in weight, every element competes and the page reads
as noise even when the information is good — which is a fair description of what the
screenshot looks like.

### The accent budget guard was walked past for three days

`one-scale-per-meaning.test.ts:108` matched the literal string
`"eyebrow text-[var(--color-accent)]"`. The code writes
`eyebrow mb-2 text-[var(--color-accent)]`. One utility class in between and the guard
sees nothing. Two orange eyebrows shipped and the suite stayed green.

Fixed on 2026-08-01 — the guard now parses the class list rather than one spelling of it,
and the two offenders are gone. Recorded here because it is the sixth guard in this repo
that could not fail, and because the rule it protects is one of the few that keeps the
page from turning orange again.

### What a player experiences, in order

1. A 60px name — information they already had.
2. A form asking them to make a decision before the page has told them anything.
3. An answer in the same visual weight as the form.
4. Two competing solid buttons.
5. Rows where the dismiss control is as loud as the content.

None of those steps is a rendering bug. Every one is a hierarchy decision, and that is
why re-skinning has not fixed it and will not.

### The rule the phases below encode

**Rank everything, then render the rank.** A companion shows more than a tool does, so it
lives or dies on whether the ranking is visible. Size, weight, colour and position each
carry one step of that rank, and if they disagree the page reads as noise. The identity
band is quiet chrome. The goals are the subject. The answer is the one loud thing. Routes
are navigation. The bank is a footer. That order is not decoration — it is the product.

---

## 0c. The rendered target

`docs/design/player-page-target.html` is the player page as it must look. Open it in a
browser before writing a line, and open it again when you think a phase is done.

It exists because prose has failed here five times running. Each promptbook described
hierarchy correctly and each result came back flat, because a sentence like "rank
everything, then render the rank" leaves the resolution to whoever implements it — and an
implementer resolves ambiguity toward what they already know.

The file is not a component and nothing imports it. Its colours and sizes are copied from
`globals.css`; if the two ever disagree the tokens win and the file is stale, so fix it in
the same commit.

What it asserts, in the order these get broken:

1. **One loud thing.** The answer is 28px. Nothing else on the page is.
2. **One solid button.** Everything else is an outline or a link.
3. **The identity band is chrome** — small quiet labels — but its **numbers** carry the
   Jagex data colours, because a number is data and a label is not.
4. **Sprites are 40px in a slot**, and the answer's is 64px. Below 32px an OSRS sprite is
   decoration; at 40px it is recognisable at a glance.
5. **Long sentences get their own measure** (~65ch) inside the wide column. The column is
   1024px; the sentence is not.
6. **Dismissal is quieter than what it dismisses.**
7. **Fractions**, never percentages, never a progress bar.
8. **An unknown is an em dash.** Never a zero.

Verified in the file itself: exactly one element uses `--text-answer`, exactly one uses
the solid `.btn`, and it contains zero hardcoded `font-size` values outside the six
tokens. Hold your output to the same three counts.

---

## Phase A — the identity band

**Why first.** It is the answer to "who am I" and it is the reason a page feels like
*yours* within half a second. Every number already exists.

```
Read docs/SCAPESTACK-COMPANION-SHELL-PROMPTBOOK-2026-08-01.md sections 0, 0b and 0c first, open
docs/design/player-page-target.html in a browser, and read
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
