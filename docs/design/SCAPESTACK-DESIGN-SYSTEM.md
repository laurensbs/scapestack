# Scapestack Design System

**Sourced 2026-07-26.** Every number and colour here was measured or quoted from a
primary source. Raw evidence with URLs: [`RESEARCH-RAW-2026-07-26.md`](RESEARCH-RAW-2026-07-26.md).

Nothing in this file is a preference. Where something is a judgement call it says so.

---

## 0. The one thing to understand first

OSRS players do not read marketing. This is measurable, not a hunch.

Across all **1,985 RuneLite Plugin Hub descriptions** — the largest body of copy
players have written for other players — these words appear **zero times**:

> seamless · powerful · effortless · elevate · empower · intuitive · robust ·
> cutting edge · leverage · streamline · supercharge · transform · journey ·
> next-level · game-changing · ultimate · unleash · tailored · bespoke ·
> stunning · beautiful · "optimize your" · "maximize your" · "level up your"

The most-installed plugin in the game, at **575,810 installs**, is described in
four words: **"A helper for questing."** The second, at 400,672: *"GPU renderer
with a suite of graphical enhancements."* Median description length across the
whole hub is **10 words**. Nobody says "we" or "our" — 0% of 1,985.

r/2007scape has a report button for AI-generated content, and players post
ChatGPT-written OSRS copy verbatim as a punchline. Sounding like a machine is a
specific, recognised failure mode in this community.

**So: less is more is not a style choice here. It is the register.**

---

## 1. Colour

### 1.1 What OSRS actually looks like

Sampled pixel-by-pixel from the wiki's native-resolution interface PNGs, and
cross-checked against RuneLite's `JagexColors.java`.

The game is **olive-brown, stone-grey and parchment**. It is not gold on black.

| Token | Hex | What it is |
|---|---|---|
| `--osrs-panel` | `#3E3529` | Interface panel fill |
| `--osrs-chrome` | `#453C33` | Surrounding chrome |
| `--osrs-parchment` | `#BBAB8B` | Parchment / dialogue |
| `--osrs-ink` | `#000000` | Outlines and the drop shadow |

### 1.2 Saturated colour is reserved for data

This is the single most transferable rule in OSRS's visual language: **the
interface is drab so the numbers can shout.** Every saturated colour in the game
carries meaning.

| Hex | Meaning | Source |
|---|---|---|
| `#FF981F` | Interface heading | 100% of sampled title pixels; `JagexColors.DARK_ORANGE_INTERFACE_TEXT` |
| `#FFFF00` | Levels, stacks under 100K | 100% of 1,238 sampled skill-tab pixels |
| `#FFFFFF` | Stacks 100K–9.9M (suffix K) | Wiki `Stackable_items` |
| `#00FF80` | Stacks 10M+ (suffix M) | Wiki `Stackable_items`; 94.4% of sampled pixels |
| `#FF9040` | Item name in right-click menu | `JagexColors.MENU_TARGET` |
| `#00FFFF` | Scenery · `#FFFF00` NPC · `#FFFFFF` player | Wiki `Choose_Option` |

**Players read magnitude by colour with no legend.** A green number is millions.
That is learned vocabulary we get for free — and breaking it is worse than not
using it.

### 1.3 The difficulty ramp — use this

OSRS has a native 9-step red→green ramp for "is this appropriate for me",
derived from combat level difference. It ramps through **hue at full
saturation**, never through lightness.

| Δ level | Hex | | Δ level | Hex |
|---|---|---|---|---|
| +10 or more | `#FF0000` | | −1 to −3 | `#C0FF00` |
| +7 to +9 | `#FF3000` | | −4 to −6 | `#80FF00` |
| +4 to +6 | `#FF7000` | | −7 to −9 | `#40FF00` |
| +1 to +3 | `#FFB000` | | −10 or more | `#00FF00` |
| equal | `#FFFF00` | | | |

Scapestack's whole product answers *"can I do this right now"*. The game already
ships the colour language for that answer. **Use it for boss verdicts, gear
checks and level gates.** Do not invent a red/amber/green.

### 1.4 Judgement call: the current palette

Current site is `#030201` with gold `#E0AE37`. The research verdict, quoted:
*"closer to generic epic fantasy than to OSRS."* It is also darker than anything
in RuneLite (whose darkest surface is `#171717`), and the gold sits
uncomfortably next to the client's own accent `#DC8A00`.

**This is the thing worth changing.** Not to literal `#3E3529` panels on the web
— that reads as pastiche — but the *logic*: quiet ground, saturated colour on
data only.

---

## 2. Type

### 2.1 The RuneScape fonts are free

`github.com/RuneStar/fonts` ships every in-game font as OTF/TTF under **CC0-1.0**
— public domain, no licensing risk, verified via the GitHub API. Latest release
`1.103-0`, `RuneScape-Fonts.zip`.

| Font | In-game role |
|---|---|
| Plain 12 (`p12_full`) | Almost every interface, including the chatbox |
| Plain 11 (`p11_full`) | Inventory item amounts, and nothing else |
| Bold 12 (`b12_full`) | Emphasis |
| Quill 8 (`q8_full`) | Dialogue boxes |
| Quill Caps (`quill_caps_large`) | Large display, 48pt |

**Use them for numbers and labels, not for body copy.** They are 16px bitmap
faces; long paragraphs in them are unreadable and mark a site as fan-made.

### 2.2 The two rules that make text look OSRS

Both are measured, not impressionistic.

**Hard drop shadow at exactly +1px right, +1px down. Never blurred, never
spread.** Of 429 pixels sampled at `#FF981F` in the bank title, 55.9% had pure
`#000000` at `(x+1, y+1)` and **0%** had black at `(x−1, y−1)`. RuneLite's own
`TextComponent.java` does exactly this: draw black at `x+1, y+1`, then the colour
at `x, y`.

```css
text-shadow: 1px 1px 0 #000;
```

**Zero anti-aliasing.** 100.0% of 1,238 sampled yellow glyph pixels were exactly
`#FFFF00` — not one intermediate tone.

```css
-webkit-font-smoothing: none;
image-rendering: pixelated;
```

The OSRS Wiki applies `image-rendering: pixelated` to RuneScape-font elements in
its own `MediaWiki:Common.css`. Apply both **only** to RuneScape-font runs.

---

## 3. Geometry

OSRS runs on a hard **36px vertical rhythm** in a 765×503 client.

| Element | Size |
|---|---|
| Item sprite | 36 × 32 |
| Inventory slot pitch | 42 × 36 |
| Bank slot pitch | 48 × 36 |
| Tab plaque | 33px |

**Zero border radius, everywhere.** RuneLite's own theme sets every arc to 0.
Content fields are almost perfectly flat; only chrome carries texture.

For the web: a **4px base with a 36px module** for anything holding item sprites
keeps the bank grid honest at any zoom.

---

## 4. Motion

### 4.1 The rule that makes restraint free

**WCAG 2.3.3**: opacity and colour changes that do not alter *perceived size,
shape, or position* are **not motion animation**. An opacity-only fade therefore
needs no `prefers-reduced-motion` substitute at all.

For gold-on-dark that is also the most on-brand gesture available — light coming
up on metal. **Default to opacity. Add transform only when it earns its place.**

### 4.2 Numbers

Converged across Atlassian, Material 3, and the View Transitions UA default:

| Use | Duration |
|---|---|
| Interaction feedback (hover, press) | 50–150ms |
| Transitions (reveal, panel, route) | 150–400ms |
| Anything at all | **never over 300ms** unless it is a page transition |

**Easing must be asymmetric for entrances.** Symmetric curves read as cheap.

```css
--ease-enter: cubic-bezier(0.05, 0.7, 0.1, 1);   /* M3 emphasized decelerate */
--ease-out:   cubic-bezier(0.4, 1, 0.6, 1);      /* Atlassian practical */
```

`linear` is correct **only** on a scroll timeline — the scroll supplies the
easing itself.

### 4.3 Scroll-driven animation

`animation-timeline: view()` and `scroll()` are real CSS now and run off the main
thread — no IntersectionObserver, no scroll listeners, no library. But MDN still
labels them *"Limited availability… not Baseline."*

**So build every reveal as progressive enhancement with the finished state as the
default.** If the property is unsupported, the content is simply there.

```css
@supports (animation-timeline: view()) {
  .reveal {
    animation: fade-up linear both;
    animation-timeline: view();
    animation-range: entry 10% cover 30%;
  }
}
```

### 4.4 What never to do

- **Never reveal-on-scroll the data the player came to read.** Chrome may
  animate. Content may not. On a planner, the plan is content.
- **Never parallax.** Described in the research as "universally triggering".
- **Cap staggers hard.** More than ~4 items staggering reads as a template.
- Never animate on first paint what the player asked for by name.

---

## 5. Voice

### 5.1 Register

Dry, second-person, quantified. The joke is always at the player's own expense,
never about the product being good. RuneLite's own documentation sets the
ceiling:

> "We don't guarantee that the plugins in the hub will actually work, or that
> they won't crash your game and kill your HCIM."

Real hub descriptions: *"It's ok to be sad, especially when you've been clicking
the same spot for 10 hours."* · *"Assert your dominance against the doors."* ·
*"Stop yellow clicking today."*

### 5.2 Units

Players count in **ticks, trips, KC, and multiples of drop rate**. Never in
"hours saved".

- **trip** — one inventory-load outing. Tied to the 28 inventory slots.
- **KC** — kill count. The unit of boss progress.
- **dry** — expressed as a *multiple of drop rate*, never as time. Real titles:
  *"9x dry with 9000 kc no pet"*, *"over 4x dry for pet"*.
- **spooned** — its antonym. Got it far too early.

**"Evening" is not tool vocabulary.** Nor is "session" in the marketing sense.
Scapestack's existing copy uses both; that is a real finding against us.

### 5.3 The word list

**Use:** trip · KC · task · grind · camp · tick · safespot · clog · stack · pot ·
tab · inv · setup · gear · alt · main · iron · btw · dry · spooned · GWD · mid-game ·
maxed · slot · drop · scout · block

**Never:** seamless · powerful · effortless · elevate · empower · intuitive ·
robust · leverage · streamline · transform · journey · unlock (except literally,
as in an unlocked door) · ultimate · curated · personalised · solution · insight ·
platform · "take your X to the next level"

`unlock` deserves a note: it appears 21 times across the hub corpus and is
**always literal** — "Highlights unlocked and locked doors in Barrows". Scapestack
uses it as a noun for reward sets. That is borderline; keep it only where it
names a real game unlock.

### 5.4 Trust is bought with specifics

The research is unambiguous: players trust a tool that **names exactly what data
goes to which named domain, with sharing default-off**. Reassurance does the
opposite.

Scapestack Sync's current Plugin Hub listing names the data it sends but **not
the destination** — unlike every high-trust peer. That is a concrete gap worth
closing.

---

## 6. RuneLite panel

The plugin panel must look native or it looks bolted on. RuneLite's system is
encoded in three files, not in prose.

| Constant | Value |
|---|---|
| `ColorScheme.DARK_GRAY_COLOR` | `#282828` — page |
| `ColorScheme.DARKER_GRAY_COLOR` | `#1E1E1E` — cards |
| RuneLite accent | `#DC8A00` |
| `PluginPanel` content width | **225px** |
| Panel padding | 6px |
| Row gap | 3px · card gap 5px |
| Default font | RuneScape bitmap, 16pt |
| Every arc | **0** |

**Scapestack's panel currently uses its own browns and `Font.SANS_SERIF`.** It
collides on both axes: `#030201` is darker than RuneLite's darkest surface, and
`#E0AE37` sits wrong against `#DC8A00`.

Native means: `ColorScheme` constants, `FontManager`, gray-key/white-value status
lines, decoration-stripped icon buttons, 5px card stacking.

**Plugin Hub reviewers check security and Jagex compliance, not looks.** A plugin
that talks to an external server gets a mandatory warning string. Nothing
prohibits a session planner.

---

## 6b. Direction B — the chosen system

Laurens picked **B, "Wiki"** from the four in [`directions.html`](directions.html)
on 2026-07-26. His words for it: *"Tabel, hairline, bron erbij, verder niets.
Geen chrome, geen sfeer — de data is de vormgeving."*

The objection raised against it at the time — *this exists already, and better* —
was wrong and is recorded here so it does not get re-raised. The wiki is a
**reference**; Scapestack is a **recommendation**. Same form, different job.
Borrowing a trusted form for a new job is not duplication, it is the shortest
route to credibility.

### What B decides

| | |
|---|---|
| **Ground** | `#0D0D0C`, warm-neutral. Warm on purpose: a cold ground casts OSRS item sprites, which are heavily brown and gold, as garish. |
| **Colour** | Data only, using the game's hexes. The interface is drab so the numbers can shout. |
| **Type** | One family. Hierarchy is weight and size — a reference tool has no editorial headline face. |
| **Separation** | A hairline rule. A rule states a boundary; a shadow implies a depth this product does not have. |
| **Links** | Underlined ink, not tinted. Tinting is for data. |
| **Radius** | 3px on controls, 0 in tables. |
| **Verdicts** | Three of the game's nine ramp steps, symmetric about the centre: blocked `#FF3000`, test `#FFFF00`, ready `#40FF00`. |

Not the ramp's endpoints, because the engine never claims a boss is impossible
or trivial, and an encounter it refuses to score carries no gate at all. That is
why no fourth colour was needed. `#FF3000` rather than pure red because pure red
measures **4.49:1** on `--color-panel` — a fail.

### The homepage shows data rather than describing it

`src/components/home-specimen.tsx` runs the real engine over
`src/lib/reference-account.ts` at build time. Two rules keep it honest, both
learned by getting it wrong:

- **Never best-in-slot.** At BiS the engine picks Tumeken's shadow for all 59
  bosses and every row is identical.
- **Only encounters the engine will answer with one number.** Sorting by
  slowest-winnable pulled raids to the top and the homepage printed *"Theatre of
  Blood — Abyssal whip — 15m — Can kill"*. A raid is rooms, roles and a team.
  `bossKnowledge.dpsModel` already carries that judgement; use it.

The table shows the **boundary** — the hardest fights that are still clean, then
the easiest that are not. That is what a player wants to know, and it makes the
verdict column span more than one step of the ramp, so the design argues for
itself instead of being explained.

---

## 7. How to use this

Any design work on Scapestack — site or plugin — is checked against this file
before it is called done. The agent that does that is
[`.claude/agents/scapestack-design.md`](../../.claude/agents/scapestack-design.md).

When something here is wrong, fix it here first and cite the source. This file
beats taste, including mine.
