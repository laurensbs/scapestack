# Scapestack — Journal Promptbook

**Date:** 2026-07-31
**Status:** execution promptbook. Feed the phases to Codex in order, one at a time.
**Supersedes for UI/product direction:** `docs/SCAPESTACK-COMPANION-HUB-PROMPTBOOK-2026-07-28.md` (its architecture phases still stand; this one replaces its visual and product thesis).
**Source:** the two production screenshots of 2026-07-31, the branding analysis of the same day, and the measured repo state.

---

## 0. The constraint that decides the order

Not honesty this time — that phase shipped. **Ownership first.**

```
savedGoal   → does not exist
trackGoal   → does not exist
myGoals     → does not exist
```

Grepped 2026-07-31 across `src/lib`. Everything Scapestack stores is **derived**: the
RSN, the bank, mood preferences, what was dismissed. The player is never allowed to say
*this is what I am working toward.*

That single absence is why the product reads as a dashboard, and it is why every visual
fix so far has failed to move it. A dashboard is a read-only view of somebody else's
system. A companion is a place where your intentions live. Wise Old Man holds your
gains. Quest Helper holds your current quest. A collection-log plugin holds your log.
Scapestack computes an answer and forgets you.

Three rules follow:

1. **Goals the player chooses come first.** Every phase after 1 orients to a goal. Doing
   them in any other order rebuilds them afterwards.
2. **The skin is phase 3, not phase 1.** Warm ground and sprites on a product that still
   holds nothing is a prettier dashboard.
3. **The plugin batches, and it batches last.** The Plugin Hub builds one immutable
   commit and cannot roll back. The server must accept a contract version on production,
   verified, before any plugin sends it. Published: `0.3.0` / contract 3. Candidate
   `0.4.0` / contract 4 is prepared and unsubmitted. **Laurens submits.**

---

## 1. The diagnosis

### 1.1 What the screenshots show

**The homepage, logged in.** "WELCOME BACK, LAUKY", then *"Since last scan: +18k XP"* as
the largest line on the page, then the actual answer — *"Push Sarachnis to 50 KC now uses
this progress"* — in small grey underneath, then a button, then roughly 800px of nothing
with the footer floating in it.

18k XP is about five minutes of play. It is the headline. The headline comes from
`runelite-progress-memory.ts:33`, which builds a title from the *strongest signal*
rather than the *most important fact*.

The emptiness below is self-inflicted: on 2026-07-28 the pitch block and the demo
specimen were hidden for known accounts, which removed elements without designing what
replaces them. That was optimising a count, not designing a screen.

**`/next`, a real account.** Two dense tables — "More unlock moves" and "Unlock gaps" —
with a column headed **UNLOCK** showing `93/100`, and a legend underneath explaining what
the column means. A score that needs a legend is not a score.

### 1.2 Engineering notes are shipping as player copy

| On screen | What it actually is |
|---|---|
| "Grand Exchange buying is not assumed." | `account-type.ts:131` — an internal assumption explained to the player |
| "Unlock is how much of the account this opens, out of a hundred." | a legend for a column that is therefore not self-evident |
| "Missing lists only requirements Scapestack can see." | a disclaimer about our own coverage |
| "Iron route: missing items need source hints, not GE assumptions." | repeated once per row, three times on screen |

A player reads that as: this thing doubts itself.

### 1.3 The colour research was done and never used

`SCAPESTACK-DESIGN-SYSTEM.md` samples the game's interface pixel by pixel —
`--osrs-chrome: #453C33`, the wood tones, the gold edge. The app runs on
`--color-bg: #0D0D0C`. Near-black plus orange reads as a crypto dashboard, not as
RuneScape. The warm ground was already researched and sitting unused.

### 1.4 The Wise Old Man advice was half wrong

Earlier promptbooks hold up Wise Old Man as the model for architecture **and** skin. Only
the first is right. WOM is a **tracker** — a web app showing numbers over time. Scapestack
is a **companion**. The visual family for a companion is the set of interfaces players
already use to keep progress: the quest journal, the achievement diary, the collection
log. Lists of what you own and what you have done, in a frame, with fractions.

Keep WOM's architecture lesson (one URL per player). Drop its skin.

### 1.5 The plugin is two mechanisms and neither is explained

Measured 2026-07-31 in `ScapestackSyncPanel.java` and `connect-browser-modal.tsx`:

- **Syncing** — the plugin claims an RSN via `/api/sync/claim` and POSTs snapshots. Works
  with no browser involved.
- **Pairing** — a separate 8-character code the player fetches on the site and types into
  the plugin, then presses "Approve connection". This is what tells the site *you* own
  the account, and it gates the unredacted view.

That is **three steps across two apps**, two different concepts, and two different failure
modes — none named in plain language anywhere. Quest Helper, at 583,710 installs, is:
install, done. Scapestack Sync is at **7 installs, rank 2242 of 2403**, down from 12 on
2026-07-26. Net negative.

The panel itself shows four cards: sync status, connect browser, what syncs,
troubleshooting. All plumbing. Nobody installs a plugin to be told it is working.

### 1.6 What already works — do not rebuild

Wiki facts via the Bucket API (`npm run wiki:sync` / `wiki:check`; 3,234 monsters, 5,698
equipment rows, 16,527 item ids, 227 quests). Live GE prices with CORS open. The
affordability engine. The confidence notation (`measured` / `likely` / `guess`). The
return loop (`LastTripLine`). Bank redaction before planning. The sprite endpoint at
`/api/sprite/item/[id]`.

---

## Phase 1 — goals the player chooses

**Why first.** Without a thing that is *yours*, nothing that follows is a companion.

```
Read docs/SCAPESTACK-JOURNAL-PROMPTBOOK-2026-07-31.md sections 0 and 1 before touching
anything. Repo: git dir is `.repo-git`, so every git command needs
`--git-dir=.repo-git --work-tree=.`. The gate is `npm run ci:check`.

Task: let a player pin what they are working toward, and store it.

Right now nothing in src/lib stores a player-chosen goal — grep savedGoal, trackGoal,
myGoals: all absent. Everything persisted is derived (RSN, bank, mood, dismissals). That
absence is why the product reads as a dashboard.

Build:

1. A goal a player pins. Three kinds, because these are the three ways an OSRS player
   states an intention:
     item      "Barrows gloves", "Twisted bow", "Fire cape"
     level     "99 Slayer", "70 Agility"
     unlock    "Fairy rings", "Piety", "Ava's assembler"
   Each pinned goal stores: kind, target, the sprite item id where one exists, and when
   it was pinned. Reuse GOAL_SETS and the boss/quest tables for the pickable list — do
   not invent a new catalogue.

2. Storage. Local first (same pattern as saved-bank.ts), and synced to the account when
   one is connected, so a pinned goal survives a device change. Owner-gated exactly like
   the snapshot: pinned goals are not public.

3. Progress per goal, computed from what we already know: levels from Hiscores, quests
   and diaries from the plugin, items from the bank. Expressed as a FRACTION — 7/10, 94/99
   — never a percentage and never a progress bar. The game counts in fractions and so do
   we.

4. When a goal cannot be measured, say so on the row rather than hiding it or guessing.
   "Needs RuneLite to see finished quests" is a real state.

Do not build a goal-suggestion engine. The player picks. A "recommended goals" list is
the same mistake as recommending a trip nobody asked for.

Gate: `npm run ci:check`. Write the test first and show it red: a pinned goal survives a
reload and reports a fraction. After every new guard: sabotage the thing it protects,
confirm red, restore, confirm `git status` clean, and report that proof — this repo has
shipped five guards that could not fail, four of which protected the defect.
```

**The trap.** The temptation is to auto-pin goals from the engine's existing goal sets, so
the feature "works" on first load. Do not. A goal the system chose is exactly what already
exists and exactly what feels like a dashboard. Empty is the correct first state, and the
empty state is a picker.

**Done when.** A player can pin three things, close the tab, come back, and see the same
three with their fractions.

---

## Phase 2 — everything orients to the goal

**Why here.** The goal only means something if the rest of the product serves it.

```
Task: make the pinned goal the subject of every answer.

Today the trip recommendation, the bank panel and the boss list each answer their own
question. Once a goal is pinned, they answer ONE question: what moves this goal.

1. The trip answer states WHY in terms of the goal:
     "Monkey Madness I — the next gate to Barrows gloves."
   Not "This best matches your visible account progress" — that string is already deleted;
   do not reintroduce its shape.

2. The bank panel prices the GOAL first, then everything else:
     "Ahrim's robeskirt — 1,572,490 gp. That finishes Ahrim's set."
   becomes secondary to whatever the pinned goal needs.

3. When nothing moves the pinned goal tonight, say that plainly and offer the alternative
   without dressing it up:
     "Nothing tonight moves Barrows gloves — the next step is a 3-hour quest.
      Here is something else worth doing."

4. When a goal completes, say it once, clearly, and offer to pin the next thing. Do not
   celebrate with animation; the community reads that as a mobile game.

Rules:
- Every verdict word goes through .scape-verdict[data-gate]. Never a new colour language.
  tests/one-scale-per-meaning.test.ts enforces this.
- Voice: dry, second person, quantified. Banned: seamless, powerful, effortless, elevate,
  empower, intuitive, robust, streamline, transform, journey, ultimate, unleash — plus
  vibe, session and tonight-as-a-headline. The word for a trip is trip.

Gate: `npm run ci:check`.
```

**The trap.** "Orients to the goal" must not become "ignores everything else". A player
with a pinned 99 Slayer goal still wants to know their bank can finish Ahrim's. The goal
sets the *order*, not the *contents*.

---

## Phase 3 — the Journal skin

**Why here.** Now there is something worth dressing.

```
Task: replace the near-black web skin with the game's own journal grammar.

The visual model is NOT Wise Old Man. WOM is a tracker — a web app of numbers over time.
This is a companion, and the companion family is the interfaces players already use to
keep progress: the quest journal, the achievement diary, the collection log. Lists of what
you own and what you have done, in a frame, with fractions.

1. Ground. Move from --color-bg: #0D0D0C to the warm tones already sampled and sitting
   unused in SCAPESTACK-DESIGN-SYSTEM.md:
     ground   #1C1811      panel  #2A2318
     slot     #151009      rule   #3A3226 / #5A4E3C
     edge     #8A7142      (the gold interface border)
   The data colours do not change and do not move: #FF981F headings, #FFFF00 levels,
   #00FF80 for 10M+, #FF9040 item names. Those are Jagex's own, already sampled, and they
   may only land on a real number or a real item name.

2. Sprites. Every row that names a thing gets its sprite at 40px, pixelated, in a slot
   that reads like an inventory square. /api/sprite/item/[id] already exists and is
   currently used at 16-30px in a handful of places. A player recognises a whip faster
   than they read "Abyssal whip".

3. Fractions, not percentages. 7/10, 94/99, 812 items. No progress bars anywhere.

4. Ticks and crosses for done/not-done, the diary's own vocabulary, in shape as well as
   colour so it does not depend on hue.

Do not add texture images, drop shadows, or a parchment background photo. This is the
game's grammar, not its wallpaper.

Gate: `npm run ci:check`, and verify on `npm run build` + `next start` at 375px — the dev
server lies about rendering here and that has shipped as fact three times. Check contrast
on the new ground: every text colour must clear 4.5:1.
```

**The trap.** Warm ground plus saturated data colours is close to garish if the chrome
creeps up in saturation. The rule that keeps it honest is already written in
`globals.css`: **saturated colour is data only.** If a border, a label or a background
becomes colourful, it is wrong.

---

## Phase 4 — the route as a path

```
Task: replace the unlock tables with the chain a player actually thinks in.

"Unlock gaps" and "More unlock moves" are tables of rows with an UNLOCK column reading
93/100 and a legend below explaining the column. Delete the score and the legend both — a
number that needs a legend is not a number.

An OSRS unlock is a chain: Barrows gloves is Recipe for Disaster, which is seven
subquests, each with its own gate. Render it as a vertical path: done nodes ticked,
the current node marked, future nodes with their one blocking requirement. The player
should be able to point at where they are without reading a sentence.

Where a requirement cannot be verified (no plugin), the node says so instead of assuming
either way.

Gate: `npm run ci:check`, plus 375px on a production build.
```

---

## Phase 5 — say what the plugin does, in plain words

**Why here, and why it is site-only.** This ships immediately and needs no Hub release.
The plugin rebuild is phase 7.

```
Task: explain the plugin and the connection in language a player uses.

Measured today: connecting is THREE steps across TWO apps — fetch an 8-character code on
the site, type it into the plugin panel, press "Approve connection". And there are two
separate mechanisms the player must understand and nobody names:
  syncing  — the plugin sends your account to Scapestack. No browser needed.
  pairing  — the 8-character code, which tells the site YOU own this account and unlocks
             the private view.
Neither is explained anywhere in plain language. Scapestack Sync has 7 installs against
Quest Helper's 583,710, where the whole setup is: install, done.

1. Cut the connection to as few actions as possible. The plugin can open a browser
   (RuneLite exposes LinkBrowser). Make the panel's Connect button open
   scapestack.org/link?code=XXXXXXXX directly, so the player presses one button in the
   game and one button in the browser. Typing a code by hand is the fallback, not the
   path. NOTE: the plugin half of this is phase 7 — build the /link route and the
   one-click approval NOW so the plugin has something to open.

2. Write the explanation, and use exactly this shape. Short sentences, no jargon, no
   reassurance:

     What Scapestack is
     Scapestack remembers what you are working toward and tells you the next step.

     What the plugin does
     The plugin reads your account from RuneLite and sends it to Scapestack. That is how
     the site knows which quests you have finished, what is in your bank and what your KC
     is — things the Hiscores do not show.

     Without the plugin
     Scapestack only sees your Hiscores: levels and KC. Quests, diaries and your bank stay
     invisible, so the site guesses. It says so when it does.

     What it sends
     Your name, your levels, finished quests and diaries, your collection log, your Slayer
     task, and your bank if you switch that on.

     What it does not send
     Your password. Your inventory. Your chat. Where you are standing. Screenshots.

     Turning it off
     Uninstall the plugin, or press Delete my data on Scapestack. Both stop it.

3. Delete the four disclaimer strings listed in §1.2 of the promptbook. Coverage is
   explained ONCE, in the account header ("From your Hiscores only — connect RuneLite to
   include quests and your bank"), not per row.

4. RuneLite attaches a warning to this plugin: "submits your IP address and comprehensive
   account data to a 3rd-party server not controlled or verified by RuneLite developers."
   Warned plugins sit near a median of 149 installs against 1,686 unwarned. Do not hide
   that warning — quote it on /plugin and answer it directly, in the same plain register.
   A player who reads the warning and then reads our answer trusts us more than one who
   only meets it in the Hub.

Voice check: read every sentence you write out loud. If it sounds like a privacy policy
or a release note, rewrite it.

Gate: `npm run ci:check`. tests/voice-lint.test.ts must stay green; extend it to cover the
new copy.
```

**The trap.** The instinct on a privacy explanation is to add reassurance —
"we take your privacy seriously", "industry-standard encryption". Every one of those
sentences makes a player trust it less, and they are all banned by the voice rules. State
what is sent, state what is not, state how to stop it. Nothing else.

---

## Phase 6 — the homepage is one door

```
Task: cut the logged-out homepage to one sentence, one input, one button, and send known
accounts straight to their page.

Logged out: headline, one line of what it does, the name field, the button. The
build-time demo specimen goes — "here is what someone else's account looks like" is not
why anyone typed their own name.

Known account: no homepage. Redirect to the player page. The current welcome block is an
extra station between a site that already knows the answer and the answer, and hiding
elements from it on 2026-07-28 left 800px of nothing — do not repeat that; delete the
branch rather than emptying it.

src/components/hero-intake.tsx carries both states plus two modals. Strip it to the
logged-out form.

Gate: `npm run ci:check`. On a production build, confirm a first-time visitor and a known
account each reach an answer in ONE navigation.
```

---

## Phase 7 — the plugin panel, batched

**Why last.** One immutable Hub commit, no rollback, and the site has to be worth syncing
to before the plugin is worth installing.

```
Task: rebuild the RuneLite panel so it shows the goal, not the plumbing.

Read §1.5 and §8 context: 7 installs, rank 2242/2403, down from 12. Quest Helper is at
583,710 answering the same question in-client. Jagex's own Activity Adviser has done
stats-and-quests recommendations in-client since September 2022, with zero install
friction. The current panel shows four cards of plumbing.

1. The panel body becomes the pinned goal and the next step, at
   PluginPanel.PANEL_WIDTH = 225px:

     NOW
     [sprite] Monkey Madness I
              toward Barrows gloves

     Stop at    Jungle Demon
     Goal       7/10

     herbs ready in 12 min · birdhouses ready

     [ Something else ]

   The farming and birdhouse timers are already read by FarmingTimerReader and written to
   Postgres; the planner has never read them. Put them on screen here.

2. Connect in one button. The panel's Connect opens
   scapestack.org/link?code=XXXXXXXX in the browser (RuneLite's LinkBrowser). The typed
   code stays as the fallback for players who blocked the browser open. The /link route
   ships in phase 5, so it exists before this button does.

3. Delete the "Turn everything on" button (ScapestackSyncPanel.java:207). One click
   flipping four settings including bank transmission is what a Hub reviewer reads as a
   dark pattern, and it is why the account-data warning is fair. Replace with a single
   "Sync on login".

4. Read github.com/runelite/plugin-hub's contribution rules and determine exactly which
   transmitted fields trigger the warning. Report whether sending less removes it. If it
   is removable, that is worth more than every feature in this phase combined.

5. When the player opens their bank, the plugin is the only thing that sees it live. Say
   the one useful sentence: "Ahrim's robeskirt is 1,572,490. You have 14,500,000. That
   finishes Ahrim's set." In-client value with no website at all.

6. Answer explicitly: what is the smallest version of this plugin worth installing with NO
   website? If the honest answer is "none", say so.

Mark every proposal with whether it needs a contract bump. Candidate 0.4.0 / contract 4 is
prepared and deliberately unsubmitted. Do NOT submit anything to the Plugin Hub.

Gate: `cd plugin && ./gradlew test --offline` and `npm run ci:check`.
```

**Already fixed, unpublished.** `notifyChat("Scapestack is syncing your progress...")`
fired before *every* sync with the scheduler on 15 minutes and `chatFeedback` defaulting
true — roughly sixteen game messages an evening about a background HTTP request, in the
chatbox a player is reading for drops. Manual syncs only now.

---

## Working rules

**A guard that cannot fail is not a guard.** Five source-grep guards in this repo passed
while the thing they guarded was broken, and **four actively protected the defect** — one
pinned `"Start here"`, the eyebrow of a fabricated result card; two pinned
`bankItems: serverBankItems`, the line that leaked the bank. After every new guard:
sabotage, confirm red, restore, confirm `git status` clean, report the proof.

**Verify against something that can produce a negative.** A deploy check polling for HTTP
200 approves the previous build. A leak check against an account with no snapshot proves
nothing.

**Anything about SSR, caching or rendering is only true on `npm run build` + `next start`.**
Shipped as fact three separate times.

**A dead agent reads exactly like "nothing found".** The skiller/pure archetype agent died
in the 2026-07-27 audit — that account type is still unanalysed.

**One scale per meaning.** `--color-good`/`--color-warning` are byte-identical, as are
`--color-danger`/`--color-bad`. Never branch between two of them. Every verdict goes
through `.scape-verdict[data-gate]`.

**A metric is never a headline.** "+18k XP" is a table cell. This rule was written before
2026-07-28 and violated on the homepage anyway; it is here because it needs enforcing, not
restating.

---

## Appendix A — the plugin in plain words, ready to ship

This is the copy for phase 5. Use it as written unless you can make it shorter.

> ### How Scapestack and the plugin work together
>
> **Scapestack** remembers what you are working toward and tells you the next step.
>
> **The plugin** reads your account from RuneLite and sends it to Scapestack. That is how
> the site knows which quests you have finished, what is in your bank and what your KC is
> — things the Hiscores do not show.
>
> **Without it**, Scapestack only sees your Hiscores: levels and KC. Quests, diaries and
> your bank stay invisible, so the site guesses. It says so when it does.
>
> **Connecting** takes one button in the game and one in your browser.
>
> **It sends** your name, your levels, finished quests and diaries, your collection log,
> your Slayer task, and your bank if you switch that on.
>
> **It does not send** your password, your inventory, your chat, where you are standing,
> or screenshots.
>
> **To stop it**, uninstall the plugin or press Delete my data. Either one is enough.
>
> RuneLite shows a warning on this plugin because it sends account data to a server they
> do not run. That is accurate. The list above is exactly what it sends.

---

## Appendix B — known gaps, named so they are not mistaken for coverage

- **The skiller/pure account type is unanalysed.** Its agent died mid-run.
- **The Ironman gate on `/bank` is built and tested but not wired.** The only "ironman" in
  scope at the call site is `smartTidyPrefs.playstyle`, a bank *tidy preset* the player
  picks — wiring a money claim to that would take a main's GP column away. It needs the
  synced `accountType` threaded to `/bank`.
- **The plugin cannot currently open a browser.** No `LinkBrowser` import exists in
  `plugin/src/main/java/app/scapestack/runelite/`. Phase 7 adds it; phase 5 must not
  assume it is there.
- **Return analytics have nothing to measure yet.** `scripts/return-report.mjs` needs
  weeks of data.
