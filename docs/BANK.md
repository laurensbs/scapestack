# Bank Organizer — beslissingen

_Geconsolideerd uit drie eerdere docs (PLAN / DECISIONS / PRINCIPLES), mei
2026. De Bank Organizer is per STRATEGY.md geen identiteit meer maar een
data-leverancier voor /next. Deze doc bewaart alleen de keuzes die in de
code zitten, zodat een volgende sessie weet waarom._

---

## De kern

Een bank is een **verzameling loadouts**, geen verzameling items. De
vraag is niet "wat voor item is dit?" maar **"wanneer pak ik dit, en wat
pak ik ernaast?"**. Saradomin brews horen bij "Vorkath-stack", niet bij
"potions"; ranarr seeds bij "herb-run loadout", niet bij "seeds".

Daarom zijn de use-case tabs (Combat / Range / Magic / Food / Potions /
Skilling / Drops / Trophy / Currency / Jewellery) de primaire indeling
— niet item-type tabs.

## Beslissingen (in de code)

1. **Type-tab modus blijft naast use-case modus.** ~50 regels fallback,
   sommige skillers verkiezen het, geen reden om te verwijderen. Type-tab
   blijft op de oude dense layout; use-case krijgt de banded layout.

2. **Lege slots zijn viewer-only.** Vanilla RuneLite Bank Tags
   ondersteunt geen gaten — een plugin-vereiste (Bank Tags Layouts) zou
   de "plak → klaar"-belofte breken. De viewer toont jouw layout, de
   export is dense, met een UI-disclaimer.

3. **Tier-curatie = hand-curated S-tier + Wiki-value rest.** Volle
   hand-onderhoud is zwaar (200+ items); puur op Wiki-value falen voor
   gear-overlap (Tbow > Scythe in waarde maar Scythe = melee-S, Tbow =
   range-S). Korte hand-lijst voor S-tier per tab (~5-10 items), Wiki-
   value als fallback. Onderhoudslast: 1–2× per jaar nieuwe drops
   bijplakken.

4. **Banded layouts voor zwakke tabs.** Combat / Range / Magic / Food /
   Skilling-overflow / Drops kregen rij-per-activiteit layouts in plaats
   van dense "alles bij elkaar". Drops eerst gedaan als
   proof-of-concept, daarna geschaald.

5. **Workflow-rijen voor Skilling.** Per skill een eigen rij in
   workflow-volgorde (tool → resource → product), niet alfabetisch of
   op item-type.

## Bewust niet gedaan

- Inventory loadout-presets buiten wat al in `presets.ts` zit (Vorkath
  etc.) — niet uitgebouwd.
- Sociale features (delen, public banks) — uit scope.
- Volle tier-systeem (S/A/B/C/D) — overkill voor de gewonnen accuratesse.

## Waar dit leeft in de code

- `src/lib/sort.ts` — use-case-tab classifier
- `src/lib/banded.ts` — banded layouts per tab
- `src/lib/keepers.ts` — hand-curated S-tier per use-case
- `src/lib/junk.ts` — junk-filter heuristieken
- `src/lib/presets.ts` — loadout-presets (Vorkath, herb-run, …)
- `src/components/bank-result.tsx` — viewer + drag-drop + RuneLite export
- `tests/banded-layouts.test.ts`, `tests/layout.test.ts`,
  `tests/keepers.test.ts`, `tests/bank-tags.test.ts` — regressie
