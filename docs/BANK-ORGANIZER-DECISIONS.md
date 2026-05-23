# Bank Organizer — beslissingen, mei 2026

_Genomen na BANK-ORGANIZER-PLAN.md. Beslisser: ik (Claude), op verzoek
"bepaal wat het beste werkt." Vastgelegd zodat de keuzes herleidbaar zijn._

---

## 1. Type-tab mode → behouden

De oude "Combat / Range / Magic / Skilling / …"-modus blijft. Het is ~50
regels fallback-logica, sommige skillers vinden hem simpeler dan use-case
tabs, en het kost niets om hem te bewaren. Verwijderen om te verwijderen
voegt geen waarde toe.

Wel: de nieuwe layout-werkwijze richt zich op de **use-case mode**. Type-
tab mode blijft op de huidige (dense) layout. Dat is acceptabel — wie type-
tab kiest, kiest de simpele modus.

## 2. Lege slots → alleen visueel in de viewer

Vanilla OSRS Bank Tags ondersteunt geen gaten. We konden óf switchen naar
Bank Tags Layouts plugin (vereist plugin-install) óf gaten alleen in de
viewer tonen.

**Keuze**: viewer-only. De waardepropositie van Scapestack is "plak →
klaar". Een plugin-vereiste vernietigt dat. Wel met **een kleine UI-
disclaimer**: "Wat je hier ziet is jouw layout. De RuneLite-export is
dense, want vanilla Bank Tags ondersteunt geen lege slots."

Honesty over completeness.

## 3. Tier-tabellen → gecombineerd (hand-curated S-tier + Wiki-value rest)

Volledige hand-onderhoud is zwaar (200+ items, elke update). Volledige
auto-afleiding uit Wiki-value faalt (Tbow waarde > Scythe waarde, maar
Scythe is melee-S, Tbow range-S).

**Keuze**: korte hand-curated S-tier lijst per use-case tab (~5-10 items),
voor de rest Wiki-value als heuristiek. Dat geeft 95% accuratesse zonder
de last van een complete tier-bibliotheek.

Onderhoudslast: nieuwe S-tier drops (Soulreaper axe, Eldritch nightmare
staff, etc.) toevoegen aan de korte lijst. Realistisch 1-2x per jaar.

## 4. Tab-volgorde → Drops eerst

Drops is:
- Visueel het zwakste (boss-uniques willekeurig dense gepakt)
- Conceptueel het eenvoudigst (geen workflow, alleen hiërarchie)

Daarmee een goede proof-of-concept van het nieuwe patroon. Als het werkt
voor Drops, schalen we naar Combat / Range / Magic / Food / Skilling-
overflow.

## 5. Scope → het lichte pad

Volle herontwerp (4-5 sessies) staat op gespannen voet met de input "stop
met bouwen, ga onderzoeken." Een 4-5-sessies-project starten direct na
zo'n boodschap is tegenstrijdig.

**Keuze**: het lichte pad uit BANK-ORGANIZER-PLAN.md. Concreet:

- **Principe 3 (Hiërarchie)** voor de 6 zwakke tabs: korte S-tier lijst
  + Wiki-value fallback. Best owned op rij 1, rest in waarde-volgorde.
- **Principe 8 (Workflow-rijen)** voor de Skilling-overflow: per skill
  een eigen rij in workflow-volgorde.
- **Geen** volledig tier-systeem, geen S/A/B/C/D-curatie, geen totale
  herstructurering van elke tab.

Doel: ~70% van de waarde in 1-2 sessies. Als de speler na deze fase nog
"items door elkaar gedumpt" voelt, dan pas volle pad.

## Niet-keuzes (bewust opengelaten)

- **Inventory setups / loadout-presets** — bestaat al deels via `presets.ts`
  (Vorkath etc.). Niet uitgebreid.
- **Sociale features** — uit PRODUCT-VISION uitgesloten.
- **Quest XP-rewards in /next** — apart vervolg, niet nu.

---

## Volgorde van werk

1. **Drops-tab herschrijven** (proof-of-concept van het patroon)
2. Tests rond Drops bijwerken
3. Verifiëren dat use-case Drops nu écht "boss-uniques bovenaan, gewone
   drops onder" toont
4. **Pas dan beslissen** of we Combat/Range/Magic/Food/Skilling-overflow
   ook doen, of dat de Drops-fix voldoende is

Geen "alle 6 tabs in één keer" — incrementeel, valideerbaar.
