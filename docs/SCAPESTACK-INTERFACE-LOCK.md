# Scapestack Interface Lock

Status: active from Phase 30

## North star

Scapestack is an OSRS companion that opens on one decision, one boss, one route,
or one inventory. It must not look like a SaaS dashboard. The page is the canvas;
content does not need a card merely because it belongs to a section.

The visual sentence is:

> Black canvas. Cream answer. Gold action. OSRS art proves what the answer is about.

## Reference lock

These references were found through Refero. We borrow structure, never a skin.

| Reference | Refero style ID | Borrow | Reject |
| --- | --- | --- | --- |
| Wayfinder | `168f20ae-b58e-4781-b9b8-46b2d9b81b5f` | Primary foundation: full-bleed dark scene, minimal chrome, content integrated into the canvas, no shadow-based elevation | Illustrated forest palette and positive tracking |
| Pipe | `c00d3961-a100-4c22-91fe-75f6e488e579` | Flat black planes, compact 8px controls, one accent reserved for action, type-led hierarchy | SaaS metrics, feature grids, orange brand color |
| Franco Maria Ricci Editore | `741dff45-aa42-4ed0-8379-f4992610d404` | Serif moments, gallery-like object focus, space and hairlines as structure | White canvas, all-serif body copy, zero-radius everywhere |
| Krea | `3a63b3fa-dc79-4dc3-935e-3f8f4ab447a7` | Quiet near-black control surfaces and high-fidelity media as the visual anchor | AI-product glow, abstract media and generic command-center language |

Concrete screen patterns:

| Screen | Refero screen ID | Lesson |
| --- | --- | --- |
| Factory welcome | `169081b2-2e94-45a5-8e4c-14435707404e` | A first screen can be mostly empty when the one next action is obvious |
| Cursor focused dialog | `bc3870e7-fd72-458a-843a-e47e0cfcca94` | Dim the product decisively; keep the dialog short and the action full-width |
| Chargetrip vehicle picker | `89aab6de-84c4-4bed-8535-182be8ece203` | Search and selectable image rows belong in a focused sheet, not a dashboard grid |

## Tokens

### Color roles

- `--color-bg`: true app canvas. It is never used as a badge color.
- `--color-panel`: quiet control surface used only when containment improves use.
- `--color-parchment`: focused dialog/sheet surface only.
- `--color-text`: cream answer and primary labels.
- `--color-text-dim`: supporting instruction.
- `--color-text-muted`: tertiary metadata that may disappear on mobile.
- `--color-accent`: primary action, current selection and focus ring only.
- `--color-danger`: destructive or genuinely failed state only.
- Success is a check icon plus plain cream/gold copy. There is no green success system.

### Shape and spacing

- Control radius: `8px`.
- Focus surface/dialog radius: `10px`.
- Boss and route tile radius: `8px`.
- Pills are reserved for a compact account identity or one-word state. Commands are not pills.
- Page max-width: `1152px`; reading width: `720px`; dialog width: `672px`.
- Page gutter: `16px` mobile, `24px` tablet and desktop.
- Major section gap: `48px` desktop, `32px` mobile.
- Shadows never create the hierarchy. Canvas contrast, hairlines and spacing do.

### Type roles

- Display serif: one answer, boss, reward, route or account name.
- Sans: controls, descriptions, numbers, filters and checklists.
- Eyebrows are optional. Never stack an eyebrow, status chip, subtitle and helper line above the answer.
- No viewport-scaled type. Mobile sizes are explicit.
- Letter spacing is always `0`, except tiny uppercase metadata where `0.08em` is the maximum.

## Primitive contract

### Page (`.scape-page`)

One max-width, one gutter and one vertical rhythm. Every main product route uses it.

### Page intro (`.scape-page-intro`)

Unframed. One small icon may sit inline with the title. It contains a title, one line
of supporting copy and at most one action. It is not a hero card.

### Focus (`.scape-focus`)

Use for the single route, boss or reward that owns the page. It may use a parchment
tone and a stronger border. Never nest another focus surface inside it.

### Dialog (`.scape-dialog`)

Centered, parchment-toned and short. Header, body, primary action. Long optional help
belongs in a collapsed disclosure or a mobile sheet.

### Sheet (`.scape-sheet`)

Bottom-aligned on mobile, centered on desktop. Search and selectable rows are allowed.
The background page is inert while open.

### Boss tile (`.scape-boss-tile`)

The boss sprite is the anchor. The whole tile is clickable. Show name plus at most two
facts before selection. No “open details” command inside the tile.

### Route choice (`.scape-route-choice`)

An action row, not a mini report. Show route art, route name, one account-specific
reason and the stop point. The full row selects it.

### Inventory (`.scape-inventory`)

Stable slot grid with real item sprites. Missing items use an empty outlined slot and a
plain “Missing” label. Do not render inventory facts as KPI cards.

### Checklist (`.scape-checklist`)

One vertical list separated by hairlines. Every row has a real checkbox state, one label
and optional short consequence. No progress-ring dashboard.

### Primary action (`.scape-primary-action`)

Gold, 8px radius, black label, minimum 44px hit area. Each view has exactly one obvious
primary action. Secondary actions are outlined or text-only.

## Route composition

- Homepage: promise, RSN input, one boss image. No feature grid.
- `/next`: one route answer, two larger alternatives, optional steps below.
- `/bank`: bank grid is the app. Setup and import are focused dialogs, not a second page.
- `/dps`: searchable boss gallery, then one encounter sheet with owned loadout.
- `/goals`: one closest useful unlock, then a browsable reward trail. No readiness rail.
- `/plugin`: check active RSN, show one result, show one repair action only when needed.
- Account home: account name and next trip first; timeline and skill history read as an
  editorial log, not a collection of KPI cards.

## Mobile lock

- The order is answer, action, alternatives, detail. Desktop uses the same order.
- Primary actions are full-width where the thumb needs a decision.
- Dialogs become bottom sheets with `max-height: 92dvh` and their action remains visible.
- Boss tiles are at least two columns only when each sprite remains legible; otherwise one.
- Tertiary metadata may hide, but essential setup and stop points must wrap, never truncate.
- Touch targets are at least `44px`.

## Automatic rejects

- Nested cards or a card around an entire page section.
- KPI rows, readiness rails, “used / loaded / detected” status matrices.
- Decorative gradient orbs, glows and colored fog.
- Green success banners.
- Pill-shaped commands.
- More than one filled CTA in a viewport section.
- Generic labels such as status, signals, context, payload or data source.
- Empty icon tiles whose only purpose is decoration.
