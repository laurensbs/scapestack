# Bank Organizer — implementatie-plan voor de "8 principes"

_Mei 2026. Plan, geen code. Geschreven om de scope eerlijk in te schatten._

Gebaseerd op `BANK-ORGANIZER-PRINCIPLES.md`. Per principe: wat doen we al,
wat moet anders, welke functies raken het, welke tests breken.

---

## Status per tab — wat werkt al?

| Tab | Layout-builder nu | Werkt? | Probleem |
|---|---|---|---|
| **Teleports** | `buildUseCaseLayout` (dense) | Deels | Geen workflow; portrait + tabs + jewellery door elkaar |
| **PvM Gear** | `buildPvmGearLayout` (set-kolommen) | **Ja** | Voldoet al aan principes 1, 4, 5, 8 |
| **Potions** | `buildPotionsLayout` (herb-rijen) | **Ja** | Voldoet al aan principes 1, 4, 8 |
| **Skilling** | `buildSkillingLayout` (3 themed rijen + dense overflow) | Half | Top 3 rijen goed, overflow dense |
| **Drops** | `buildUseCaseLayout` (dense) | Nee | Geen hiërarchie, geen workflow |
| **Clue** | `buildUseCaseLayout` (dense) | Nee | Geen hiërarchie |
| **Quest** | `buildUseCaseLayout` (dense) | Nee | Geen hiërarchie |
| **Cosmetic** | `buildUseCaseLayout` (dense) | Nee | Geen workflow |
| **Misc** | `buildUseCaseLayout` (dense) | OK | Dump-tab — dense is hier passend |

**Conclusie**: 2 tabs voldoen volledig (PvM Gear, Potions), 1 half (Skilling),
6 tabs hebben werk nodig. We hoeven de classifier niet aan te raken.

---

## Per principe: werk + risico

### Principe 1 — Rij/kolom = één activiteit
**Doen we voor**: PvM Gear (set-kolommen), Potions (herb-rijen), Skilling top-3
**Doen we niet voor**: Teleports, Drops, Clue, Quest, Cosmetic, Skilling overflow

**Werk**: nieuwe rij-templates schrijven per use-case tab. Patroon staat al in
`buildPotionsLayout`/`buildSkillingLayout`: definieer rij-templates met named
slot-matchers, voor elke rij vul slot N met de eerste item die matcht, fill
rest met bank-filler.

**Voorbeeld nieuwe Drops-rijen**:
```
Rij 1 (boss uniques tier 1):  Tbow · Scythe · Shadow · Fang · Lightbearer · ...
Rij 2 (boss uniques tier 2):  Bandos hilt · Sara hilt · Zammy hilt · ...
Rij 3 (pets):                  Vorki · Olmlet · Lil Zik · ...
Rij 4 (third-age):             3rd age weapons + armor
Rij 5+ (rest):                 dense overflow
```

**Risico's**:
- Item-namen-matching: een Tbow matcht regex `/twisted bow/i` makkelijk, maar
  "Bandos hilt" matcht ook "Saradomin hilt" als ik niet word-anchor. Vereist
  zorgvuldige regex.
- Items die in meerdere rijen passen (slayer helm = combat én slayer). Eerst-
  match-wins zoals nu, of expliciete prioriteit?

### Principe 2 — Voorspelbare positie (signature item op slot 0)
**Doen we voor**: niets expliciet.

**Werk**: voor elke tab definieer een "signature slot 0"-regel:
- Combat: best owned 2H melee weapon
- Range: best owned crossbow / bow
- Magic: best owned staff
- Food: best owned cooked food
- Skilling: best owned pickaxe

**Risico**: "best owned" = subjectief. Vereist een tier-tabel per item-type
(we hebben gear-tiers in `pvm-items.ts`, niet voor andere items).

### Principe 3 — Hiërarchie binnen tab
**Doen we voor**: deels via `weight`-attribuut van classifier.

**Werk**: definieer een **tier-systeem** per use-case tab. S/A/B/C/D tiers.
Top-tier → rij 1. Lager → onderstaande rijen.

**Voorbeeld Combat-tab tiers**:
- S-tier weapons: Tbow, Scythe, Shadow, Voidwaker (raid drops + spec)
- A-tier weapons: Whip, AGS, Saeldor, Fang
- B-tier weapons: Dragon scim, Abyssal bludgeon
- C-tier: Rune/Adamant weapons
- D-tier: lower-tier metals, cosmetic

**Risico**: tier-lijsten moeten onderhouden worden bij elke OSRS-update. Veel
items. Niet uit Wiki te halen, vereist curatie. **Dit is het zwaarste werk.**

### Principe 4 — Lege slots als scheidingstekens
**Doen we voor**: PvM Gear (filler tussen sets), Potions (filler in pipelines).

**Werk**: alle nieuwe rij-templates moeten lege scheidingsrijen tussen
groepen gebruiken. Implementatie-detail: hoe markeren we "deze hele rij is
spacer" zodat bankgrid hem rendert als 8 lege slots?

**Risico**: export-string compatibiliteit. Vanilla Bank Tags ondersteunt geen
gaten — als wij gaten tonen in de viewer maar dense export, is er
mismatch tussen UI en in-game resultaat. Spelers raken in de war.

**Beslismoment**: ofwel:
- (a) Alleen visuele gaten in de viewer, export blijft dense → speler vraagt
  zich af waarom de export niet matcht
- (b) Switch naar Bank Tags Layouts plugin als export-doel (ondersteunt
  sparse layouts) → speler moet die plugin hebben

Het tweede is technisch beter maar vereist plugin-install. **Dit moet je
beslissen voordat ik code schrijf.**

### Principe 5 — Visuele rijmen (gelijke posities)
**Doen we voor**: PvM Gear (slot-order = head/body/legs/hands/feet voor elke set).

**Werk**: voor elke nieuwe rij-template, zorg dat parallelle rijen dezelfde
slot-volgorde gebruiken. Voorbeeld Combat:
```
Rij 1 (S-tier loadout):  weapon · helm · body · legs · cape · ammy · ring · gloves
Rij 2 (A-tier loadout):  weapon · helm · body · legs · cape · ammy · ring · gloves
```
Zelfde positie per slot-type, andere items.

**Risico**: laag. Dit is gewoon discipline in de templates.

### Principe 6 — Eén ding, één plek (geen duplicaten)
**Doen we voor**: use-case mode (`bucketFor` is exclusive).
**Doen we niet voor**: type-tab mode (een Sara brew zit in Combat én Potions
afhankelijk van regex-match).

**Werk**: type-tab mode reviewen. Maar... type-tab mode is de oude modus
die we hebben verlaten. **Vraag**: ondersteunen we type-tab mode überhaupt
nog? Of laten we hem vallen?

### Principe 7 — Stacks visueel onderscheidend
**Doen we voor**: qty colors, dose-badges, gp-value overlay.

**Werk**: geen — voldoet al.

### Principe 8 — Workflow-conformiteit per skill-rij
**Doen we voor**: Potions (herb pipeline).
**Doen we niet voor**: Smithing, Crafting, Cooking, Mining, Woodcutting in
de Skilling-overflow.

**Werk**: nieuwe skill-workflow-rijen toevoegen aan `buildSkillingLayout`:
- Mining-rij: pickaxe · ores · gem-rocks
- Smithing-rij: hammer · bars · arrowtips
- Cooking-rij: raw food · cooked food per tier
- Woodcutting-rij: axe · logs (normal → magic → redwood)
- Crafting-rij: hides · leather · gold/silver bars · molds
- Farming-rij: seeds · saplings · supercompost · spade · secateurs

**Risico**: medium. Vergelijkbaar met de bestaande themed rijen — patroon is
bekend, alleen meer ervan.

---

## Tests die mogelijk breken

Huidige test-categorieën (210 tests):
- `tests/keepers.test.ts` (130 tests) — classifier routing, niet layout
- `tests/layout.test.ts` — **DIRECT IMPACT**: layout-tests bewaken huidige
  posities. Een herschreven Combat-tab breekt deze.
- `tests/goals.test.ts` — niet geraakt
- `tests/playstyle.test.ts` (3 tests) — niet geraakt
- `tests/filler-labels.test.ts` (2 tests) — direct geraakt; nieuwe rijen
  betekenen nieuwe filler-positions
- `tests/meta-smoke.test.ts` — niet geraakt

**Schatting**: 5-15 tests die bijgewerkt moeten worden, geen verloren.

---

## Sessie-inschatting — eerlijk

| Werk | Schatting |
|---|---|
| Combat-tab herschrijven (tier-tabel + rij-templates) | **1 sessie** |
| Range + Magic tabs (vergelijkbaar) | **1 sessie** |
| Food + Drops + Clue + Quest + Cosmetic tabs | **1 sessie** |
| Skilling-overflow → workflow-rijen per skill | **1 sessie** |
| Teleports tab herstructureren | **0.5 sessie** |
| Lege-slots-systeem (principe 4) + beslissing over export | **0.5-1 sessie** |
| Tests bijwerken | **0.5 sessie** |
| **Totaal** | **4-5 sessies** |

Plus: **tier-tabellen onderhoud** is een doorlopende kost. Elke OSRS-update
voegt items toe; iemand moet ze in de tier-tabellen plaatsen.

---

## Beslismomenten vóór ik code schrijf

Ik heb antwoord van je nodig op deze:

1. **Type-tab mode**: laten we vallen of ondersteunen we hem nog? (Principe 6)
2. **Lege slots**: alleen visueel of switch naar Bank Tags Layouts plugin? (Principe 4)
3. **Tier-tabellen**: ben jij bereid die te onderhouden of moet de tool
   "best-tier" detecteren via item-meta (Wiki value)? Het laatste werkt vaak
   maar niet altijd (een Twisted bow is duurder dan een Scythe maar Scythe is
   tier-S in melee, Tbow in range — value vergelijking faalt).
4. **Volgorde**: welke tab pakken we eerst? Mijn voorkeur: **Drops**, want het
   is de meest zichtbaar slechte (boss-uniques door elkaar gedumpt).

---

## Eerlijke vraag aan jou

Dit is 4-5 sessies werk, met tier-tabellen die onderhouden moeten worden.
Voor jouw doel ("speler ziet georganiseerde bank, niet item-dump") is dit
de juiste weg.

Maar twee andere paden zijn ook valide:

- **Bestaande Bank Tags importeren**: een speler plakt een community-tag en
  wij vullen die met zijn items. Veel minder werk, geen tier-tabellen.
- **Minimum viable fix**: alleen principes 3 + 8 implementeren voor de 6
  zwakke tabs. Geen tier-S/A/B/C/D, gewoon "best owned" via simpele heuristiek
  + workflow-rijen. 1-2 sessies, 70% van de waarde.

Ik gok dat je de **volle herontwerp** wil. Maar voor ik begin: bevestig
dat dat de scope is, of kies een lichter pad.
