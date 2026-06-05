# User-test scenarios — does /next actually help?

_Mei 2026. The single hardest thing to know about Scapestack right now is
not whether the code is clean, but whether the engine's output is
**useful** for a real player. This doc nails five concrete archetypes
to a wall so we can score against them — and so a returning session
doesn't have to re-derive "what does good advice even look like?"_

The reproducible version of this check is `scripts/audit-next.ts` —
running `npx tsx scripts/audit-next.ts` prints the engine's top
recommendations for each scenario below. If the output drifts away from
the expectations here, that's signal: either the expectations are wrong
(write down why and update them) or the engine regressed.

---

## Scenario A — "Returning casual"

A player who quit around year 2 of OSRS at combat 80, all stats
60-75, around 100 quest points, no diaries done, a small bank with
mid-tier gear. They come back in 2026 and don't know where to start.

**Inputs:**
- Combat ≈ 80, Total ≈ 1100
- Attack 70, Strength 75, Defence 70, Hitpoints 75, Ranged 70, Magic 70,
  Prayer 52, Slayer 50, all others 60-70
- 105 QP, no diary activities on the Hiscores
- Bank: Whip, Rune platebody set, Black d'hide set, Mystic robes,
  Glory amulet, Ring of wealth, Stamina pots, Sharks. ~30 items.

**Expected top-3 ideas (in any order):**
1. **Quest points / a specific quest** — they're 50 QP off Quest Cape's
   threshold; any single high-payoff quest (Recipe for Disaster
   sub-quests, While Guthix Sleeps, etc.) should rank.
2. **A diary tier that fits their visible skill gates** — Medium or Hard is
   fine, but the copy must not imply every non-skill diary task is proven.
3. **Slayer push** — they're sat at 50 Slayer with combat gear to match;
   pushing toward 70 unlocks Abyssal demons + whip drop chance.

**Signs of a bad output:**
- Top pick is "tidy your bank" (low effort, low payoff — never the
  headline for a player who came back to PLAY).
- A boss recommendation that requires gear they don't have (e.g. Tbow
  Vorkath, mid-tier mage at GWD).

---

## Scenario B — "Maxed iron on a grind"

A maxed ironman, 2277 total, every cape, looking for the next
multi-month project. Bank-pasted to flag the rare drops they're chasing.

**Inputs:**
- Every skill 99, total level 2277
- 300 QP, several boss KCs:
  Vorkath = 1500, Zulrah = 800, CoX = 250, ToB = 80, ToA = 400 (raids
  done), Hydra = 600, DT2 bosses 200-400 each.
- Bank: Tbow, Scythe, Shadow, Bowfa+crystal, Masori, Torva, Soulreaper
  axe, fully kitted out.

**Expected top-3 ideas:**
1. **A pet they're dry on** — KC * 1/rate computation should flag the
   most "deserved" pet (e.g. Vorkath 1500 KC = ~2.5x expected on Vorki).
2. **A unique drop they're dry on** — same math, applied to a uniques
   table (Tbow at 250 CoX KC = expected ~0.7; if it's still missing,
   "you're 30% likely to have it by now" reads as honest).
3. **A specific completion** — collection log unique, a CA tier they're
   one boss off, a Music Cape gating quest.

**Signs of a bad output:**
- Suggesting a goal they obviously have ("Get 99 Slayer" to someone
  who is maxed).
- Suggesting beginner content (Black d'hide → green d'hide goals).
- A diary they've done.

---

## Scenario C — "Early account, no RSN"

A brand-new account, no Hiscores entry yet, who pastes a starter
bank just to see what the tool can do. Combat level ~3, total ~32, no
quests.

**Inputs:**
- skills = [] (no Hiscores)
- 0 QP, no boss KCs
- Bank: Bronze sword, leather chaps, 50 lobsters, 100 cooked shrimp,
  10 air runes, 5 mind runes, a coif. Tutorial-island leftovers.

**Expected top-3 ideas:**
1. **"Add your OSRS name for sharper advice"** — without Hiscores the
   engine should *flag* the shortcoming, not pretend to give expert
   advice.
2. **Quest starters** — Cook's Assistant, Rune Mysteries, Sheep
   Shearer. Free QP that opens up the world.
3. **Bank suggestion** — gather essential utility (rune pouch, glory,
   teleport tabs) before grinding.

**Signs of a bad output:**
- "You're 1-2 items away from completing Bandos set."
- A 90+ skill milestone recommendation.
- A boss recommendation. They have a bronze sword.

---

## Scenario D — "Mid-game PvM player"

A combat-110-ish main with 180 QP, Zulrah/Vorkath history, a few DT2 kills,
and good mid-game melee gear. They want the next concrete account move, not
a generic "go boss" card.

**Inputs:**
- Attack/Strength around 90, Ranged 92, Magic 85, Prayer 74, Slayer 80.
- 180 QP, no verified diaries past Hard.
- Boss KC includes Vorkath 250, Zulrah 180, Vardorvis 15.
- Bank includes Whip, blowpipe, Bandos pieces, torture, Infernal cape,
  Vorkath's head, Magic fang.

**Expected top ideas:**
1. **Started-grind continuation** — Vardorvis to 50 KC is a real, finite
   next session because the player already started it.
2. **Mid-game account unlock** — Monkey Madness II / Blood Moon / similar
   if stats and QP fit.
3. **Diary/gear/boss advice with context** — not generic boss spam.

**Signs of a bad output:**
- Claiming Desert Treasure II is complete from 15 Vardorvis KC alone.
- Diary path at 0% despite clear Easy/Medium skill evidence.
- Skills path near max-cape parity for an account that is still mid-game.

---

## Scenario E — "Skiller (very low combat)"

A level-3 skiller with strong non-combat skills. The engine must respect the
account identity instead of treating the player as a failed main.

**Inputs:**
- Attack/Strength/Defence/Ranged/Magic/Prayer/Slayer at 1, Hitpoints 10.
- Non-combat skills mostly 80-99.
- 60 QP, no boss KC.
- Small utility bank.

**Expected top ideas:**
1. **Skiller-weighted skill progress** — roughly half-way through the
   account they are actually building.
2. **Non-combat money/skilling options** — herb runs, blood runes,
   Construction 83, etc.
3. **Diary progress from visible skill gates** — especially Easy/Medium
   tiers that do not require combat assumptions.

**Signs of a bad output:**
- Any boss recommendation.
- Combat skill milestones.
- Grandmaster combat quests purely because non-combat stats qualify.

---

## How to use

1. `npx tsx scripts/audit-next.ts` — see what the engine actually says
   for each scenario.
2. Compare against the expectations above.
3. **If a scenario fails** the eyeball test, that's the next thing to
   fix — not the next feature. The bar for "shippable" is all five
   scenarios producing top-3 that a real OSRS player would consider
   reasonable.
4. **If an expectation here is wrong** (the engine surfaces something
   better than what we listed), update this doc. The doc is a living
   reference for our own taste, not gospel.

## Why five, not ten

Five is enough to catch the worst regressions across the spectrum
(no-RSN starter → returning casual → mid-game PvM → maxed iron → skiller)
without bogging down. If we find a category of account the engine handles
badly that isn't covered here (HCIM-no-prayer, F2P-only, pure), add it
only when it exposes a distinct failure mode. Don't pre-emptively pad the
list.
