# ScapeStack Premium Product Promptplan

Bijgewerkt op 2026-07-09.

Gebruik deze prompts vanaf de huidige ScapeStack codebase. De app heeft nu al `/next`, bank organizer, Smart Tidy, accounttype badges, quest/diary readiness, RuneLite sync en een plugin panel. De volgende slag moet niet meer gaan over "meer data tonen", maar over het product veranderen in een OSRS trip caller: een speler opent ScapeStack, ziet wat hij nu moet doen, pakt de juiste items, doet de trip en komt terug omdat de volgende login weer duidelijk is.

## Vaste Instructie Voor Elke Prompt

```text
Werk vanaf de bestaande ScapeStack webapp-codebase en RuneLite plugin-codebase. Maak geen losse rewrite. Lees eerst de relevante bestanden, bestaande tests en recente wijzigingen. Behoud bestaande patronen, projectstructuur, datamodellen en syncflows waar mogelijk. Implementeer daarna gericht, voeg tests toe waar gedrag of copy verandert, en sluit af met concrete verificatiestappen.

Productregel:
Elke zichtbare UI-sectie moet een OSRS-speler helpen met een concrete tripbeslissing:
- waar ga ik heen?
- wat pak ik uit mijn bank?
- wat mis ik nog?
- welk level, quest, diary task of item houdt mij tegen?
- wat verandert door Normal/Ironman/HCIM/UIM/GIM?
- wanneer ben ik klaar en mag ik opnieuw syncen?

Vermijd normale speler-copy zoals:
- dashboard
- Session board
- Main move
- Backup moves
- Worth it because
- Bring/check
- Stop when
- bank signal
- blockers als los productwoord
- route progress als primaire boodschap
- slash-route taal zoals /next, /bank, /goals in normale UI
- raw IDs prominent buiten dev/debug/tooltip context
- technische sync/payload/endpoint taal

Gebruik OSRS-speler taal:
- Next trip
- Do this first
- Before you leave
- Grab from bank
- Still missing
- Finish after
- Claim the reward
- Sync again after the unlock
- Open your bank once
- Source this yourself
- Stage this for UIM
- Group storage not checked

Verifieer altijd:
- npm test voor relevante tests
- npm run typecheck
- npm run build
- plugin: cd plugin && ./gradlew test als plugin geraakt wordt
- desktop en mobile browser check voor gewijzigde schermen
```

---

## Prompt 1: Maak `/next` Een OSRS Trip Caller, Geen Planner Dashboard

```text
Doel:
Herwerk `/next` zodat de eerste ervaring voelt als "dit is mijn volgende OSRS trip", niet als een planner/dashboard met routes, backups en bewijs.

Lees minimaal:
- src/app/next/next-client.tsx
- src/lib/next-up.ts
- src/lib/action-plan-text.ts
- src/lib/mood.ts
- tests/next-client-confidence-copy.test.ts
- tests/scapestack-product-contract.test.ts
- tests/next-up-action-plan.test.ts

Probleem:
De app heeft nu wel een duidelijke aanbeveling, maar de UI toont nog te veel systeem-denken: route cards, alternative moves, readiness text, ID strips, status badges en detailpanelen. Een OSRS-speler moet niet eerst leren hoe ScapeStack denkt.

Nieuwe eerste viewport:
Toon precies één primaire tripkaart:
- titel: concrete actie, bijvoorbeeld "Finish Karamja gloves" of "Do Animal Magnetism"
- kleine context: Quest / Diary / Boss / Bank / Slayer
- "Before you leave": maximaal 2 regels
- "Grab from bank": alleen als bankdata echt helpt
- "Still missing": alleen echte ontbrekende level/quest/item/task
- "Finish after": concreet klaar-moment
- één primaire knop: "Start this trip", "Open quest", "Set up bank" of "Check kill"

Verberg onder details:
- route bewijs
- item IDs
- waarom deze ranking
- source/debug/sync informatie
- extra recommendations

Taken:
1. Maak een component of refactor in `next-client.tsx` naar `NextTripCard`.
2. Laat `NextTripCard` maximaal 5 high-signal regels tonen.
3. Verwijder zichtbare labels als "Session board", "Main move", "Backup moves", "Worth it because", "Bring/check", "Stop when".
4. Maak alternatives secundair:
   - header: "Not this one?"
   - maximaal 2 compacte opties
   - geen uitgeklapte detailpanelen standaard
5. RouteCard blijft bestaan, maar mag pas onder "More routes" of details.
6. Voeg copy tests toe die oude dashboardwoorden verbieden.
7. Mobile: eerste viewport moet één trip tonen zonder scroll-chaos.

Acceptatiecriteria:
- Binnen 3 seconden ziet een OSRS-speler waar hij heen moet.
- Eerste viewport bevat geen dashboard/productwoorden.
- Alternatieven voelen als fallback, niet als tweede dashboard.
- Item IDs zijn niet dominant zichtbaar in normale flow.
```

---

## Prompt 2: Vereenvoudig Route Cards Tot Klikbare OSRS Keuzes

```text
Doel:
Maak route cards intuïtief: icon, naam, "nog X nodig", klik voor korte info. Geen gelabelde analyseblokken.

Lees minimaal:
- src/app/next/next-client.tsx
- src/lib/next-up.ts
- src/lib/path-progress.ts
- tests/next-client-confidence-copy.test.ts

Probleem:
Uitgeklapte route cards toonden labels zoals Do, Bring/check, Missing, Stop when en Worth it because. Dat voelt als een template, niet als OSRS.

Nieuwe card:
Collapsed:
- OSRS icon/sprite
- title
- tiny label: "Ready", "1 thing left", "Need 35 Agility", "Missing rope"
- CTA: Open

Expanded:
- maximaal 3 bullets zonder labels
- bullets moeten spelerstaal zijn:
  - "Train Fishing 43 -> 46."
  - "Biohazard is still missing."
  - "Rope is in bank; mith grapple is missing."
  - "Finish after the diary tier is claimed."
- geen vijf vakjes
- geen "worth it because"
- geen "bring/check"
- geen "stop when"

Taken:
1. Gebruik bestaande `RouteCard`, `routeCardDetailLines`, `playerRouteLine` of bouw daarop verder.
2. Filter generieke regels zoals:
   - Find unlock
   - Check gear
   - Check setup
   - Nothing obvious
3. Maak item IDs alleen zichtbaar als kleine tooltip/debug detail, niet als normale content.
4. Zorg dat diary/quest/boss route identity blijft via sprites, niet via ruwe IDs.
5. Tests moeten oude labels verbieden.

Acceptatiecriteria:
- Een uitgeklapte route voelt als een korte OSRS checklist.
- Geen template-labels in route details.
- Geen vage placeholders zoals "Find unlock".
```

---

## Prompt 3: Maak Bank Organizer Een RuneLite Bank Setup Flow

```text
Doel:
Verander `/bank` van een organizer-dashboard naar "set up my RuneLite bank tabs".

Lees minimaal:
- src/app/bank/page.tsx
- src/components/bank-result.tsx
- src/lib/reorganize.ts
- src/lib/use-case-tabs.ts
- src/lib/archetype.ts
- tests/bank-export-feedback.test.ts
- tests/bank-toolbar-actions.test.ts
- tests/smart-tidy-wizard.test.ts

Probleem:
Bank organizer toont te veel controls, warnings, saved banks, filters, density, profile, sort en details voordat de speler voelt dat zijn bank beter wordt.

Nieuwe first viewport:
Titel:
"Set up RuneLite bank tabs"

Flow:
1. "Choose style"
   - PvM
   - Ironman
   - Questing
   - Skilling
   - Minimal
2. "Preview tabs"
   - echte item sprites
   - tabnaam
   - item count
   - geen enorme lege grid
3. "Copy to RuneLite"
   - duidelijke output

Taken:
1. Maak de bank grid direct zichtbaar onder de setup flow.
2. Zet technische import warnings onder "Import note" collapsed.
3. Zet saved banks onder de grid.
4. Zet advanced controls onder "More controls".
5. Verwijder normale copy zoals profile, use-case, density, fallback IDs uit first viewport.
6. Fix sparse bank rendering:
   - weinig items moeten bovenin compact tonen
   - geen items extreem laag in een enorme grid
7. Smart Tidy:
   - maximaal 2 voorkeurvragen
   - before/after preview
   - apply animation
   - daarna "Copy to RuneLite"
8. Voeg tests toe voor first viewport order, sparse bank compacting en verborgen technische details.

Acceptatiecriteria:
- Een speler weet binnen 3 seconden hoe hij zijn bank richting RuneLite krijgt.
- Smart Tidy voelt begeleid, niet als sort-knop.
- Bank grid is niet pas helemaal onderaan zichtbaar.
```

---

## Prompt 4: Maak Smart Tidy Echt Slim Met Keuzes En Feedback

```text
Doel:
Smart Tidy moet voelen alsof ScapeStack jouw bankstijl snapt en een RuneLite layout voorstelt.

Lees minimaal:
- src/components/bank-result.tsx
- src/lib/reorganize.ts
- src/lib/use-case-tabs.ts
- src/lib/archetype.ts
- tests/smart-tidy-wizard.test.ts
- tests/banked-layouts waar relevant

Gewenste flow:
1. Klik "Smart tidy"
2. Vraag 1: "How do you mostly play?"
   - PvM
   - Ironman
   - Questing
   - Skilling
   - Minimal
3. Vraag 2: "What should be first?"
   - Gear
   - Teleports
   - Supplies
   - Current grind
4. Preview:
   - links huidige bank snapshot compact
   - rechts voorgestelde tabs
   - 6-10 representative sprites per tab
5. Knoppen:
   - Apply layout
   - Try another setup
6. Na apply:
   - kleine item/sprite animation
   - "Copy tabs to RuneLite"

Belangrijk:
- Gebruik bestaande reorganize/buildUseCaseTabs logic.
- Geen heavy rewrite.
- Geen technische termen in normale flow.

Tests:
- wizard states: choosing, preview, applying, applied
- presets tonen juiste tabnamen
- apply update de layout
- sparse bank blijft compact
- copy-to-RuneLite blijft zichtbaar

Acceptatiecriteria:
- Smart Tidy voelt als premium bank setup.
- Speler hoeft geen advanced controls te begrijpen.
- Resultaat is visueel en direct bruikbaar.
```

---

## Prompt 5: Maak Accounttype Een Speelstijl, Niet Alleen Badge

```text
Doel:
Normal, Ironman, HCIM, UIM en GIM moeten zichtbaar anders voelen in planning, items, bank readiness en route-keuze.

Lees minimaal:
- src/lib/account-type.ts
- src/components/account-mode-badge.tsx
- src/lib/item-availability.ts
- src/lib/quest-requirements.ts
- src/lib/diary-requirements.ts
- src/lib/next-up.ts
- src/app/next/next-client.tsx
- src/app/quests/[slug]/quest-detail-client.tsx
- plugin/src/main/java/app/scapestack/runelite/GameStateReader.java
- tests/account-mode-badge.test.ts
- tests/item-availability.test.ts

Probleem:
Accounttype bestaat, maar voelt nog soms als label. Een Ironman moet voelen: "deze app plant echt voor mijn restrictions".

Taken:
1. Maak per accounttype een planning tone:
   - Normal: buy/grab from bank is allowed
   - Ironman: source yourself, shop/skilling/minigame hints
   - HCIM: avoid risky source if alternative exists
   - UIM: stage/carry/store, nooit normale bank-ready taal
   - GIM: own bank checked, group storage not verified
2. Voeg helmet/sprite identity toe aan key plekken:
   - `/next` trip card
   - quest readiness
   - diary readiness
   - bank setup
   - plugin verify
3. Route keuze:
   - Ironman: sourceable unlock chains hoger
   - UIM: korte staging acties hoger
   - HCIM: Wilderness/bossing lager tenzij duidelijke payoff
   - GIM: missing items niet aannemen als group available
4. Copy:
   - "Buy from GE" alleen voor Normal
   - "Source yourself" voor iron modes
   - "Stage before starting" voor UIM
5. Tests voor alle accounttypes.

Acceptatiecriteria:
- Een Ironman-speler herkent direct dat ScapeStack voor Ironman plant.
- UIM ziet nergens normale bank-ready taal.
- GIM krijgt geen automatische group-storage aanname.
```

---

## Prompt 6: Maak Quest En Diary Details Wiki-Light, Maar Trip-First

```text
Doel:
Quest/diary detailpagina's moeten niet aanvoelen als een statische wiki of checklist-dashboard. Ze moeten antwoord geven: kan ik dit nu doen, en wat pak ik eerst?

Lees minimaal:
- src/app/quests/[slug]/page.tsx
- src/app/quests/[slug]/quest-detail-client.tsx
- src/lib/quest-requirements.ts
- src/lib/diary-requirements.ts
- src/lib/item-availability.ts
- tests/quest-requirements.test.ts
- tests/diary-requirements.test.ts
- tests/quest-detail-sync.test.ts

Nieuwe detailstructuur:
1. Top verdict:
   - "Ready to start"
   - "Need 2 things first"
   - "Train first"
   - "Items missing"
   - "Stage for UIM"
2. Before you go:
   - items from bank
   - teleports/tools
   - risk note if HCIM
3. Still missing:
   - skill gaps
   - quest prereqs
   - item gaps
   - diary tasks
4. Finish after:
   - concrete quest step, diary tier claim, unlock, teleport, reward

Taken:
1. Verplaats lange requirement details onder collapsed sections.
2. Toon bank matches als spelerstaal:
   - "Rope is in bank"
   - "Mith grapple missing"
   - "UIM: stage this before starting"
3. Combineer quest/diary item requirements met accounttype availability.
4. Tests moeten exacte readiness en copy checken.

Acceptatiecriteria:
- Directe link met `?rsn=` blijft echte synced data gebruiken.
- Een speler ziet eerst de trip decision, daarna pas details.
- Diary unlocks zijn net zo concreet als quests.
```

---

## Prompt 7: Bouw Een "Welcome Back" Retention Loop

```text
Doel:
Maak de reden om terug te komen duidelijk: ScapeStack moet na elke RuneLite sync zeggen wat veranderd is en wat daardoor nu openstaat.

Lees minimaal:
- src/lib/sync-repo.ts
- src/app/next/page.tsx
- src/app/next/next-client.tsx
- src/lib/next-up.ts
- plugin sync payload handling
- tests/full-syncflow-regression.test.ts

Probleem:
Nu voelt ScapeStack nuttig wanneer je twijfelt. Voor retentie moet het voelen als: "ik open dit elke login, want het weet wat ik net heb gedaan."

Nieuwe concepten:
- Last sync summary
- Since last trip
- Newly unlocked
- No longer recommended because completed
- Next clean trip

Taken:
1. Zoek of vorige sync snapshots opgeslagen worden. Als niet, voeg minimale snapshot-diff toe:
   - quests completed delta
   - diary completed delta
   - bank item count/status change
   - accounttype detected/changed
   - collection log additions indien beschikbaar
2. Toon in `/next` compact:
   - "Since last sync: Biohazard completed"
   - "Now open: Ardougne Medium"
   - "Next trip: grab mith grapple"
3. Verberg dit als er geen betrouwbare vorige sync is.
4. Plugin chat blijft kort:
   - "ScapeStack synced. New quest progress found."
5. Tests:
   - first sync no delta
   - quest delta
   - diary delta
   - bank status delta
   - no noisy dashboard when no delta

Acceptatiecriteria:
- Speler ziet progressie door terug te komen.
- `/next` voelt actueel na RuneLite sync.
- Geen raw diff/debug in normale UI.
```

---

## Prompt 8: Boss / DPS Flow Als "Can I Kill This?", Niet Calculator

```text
Doel:
Maak boss flow minder calculator en meer trip verdict: kan ik deze boss doen met mijn bank, wat draag ik, wat mis ik, welke boss past beter?

Lees minimaal:
- src/app/dps/dps-client.tsx
- src/components/boss-detail-modal.tsx
- src/components/bank-result.tsx BossTagSection
- src/lib/bosses.ts
- src/lib/dps.ts
- src/lib/presets.ts
- tests/boss-detail-modal-affordance.test.ts
- tests/bank-export-feedback.test.ts

Problemen:
- Boss grid kan overweldigen.
- Modal kan inventory verbergen.
- DPS cijfers komen te vroeg.
- Boss loadout tag voelt als generator, niet als trip output.

Nieuwe flow:
1. Header: "Pick a boss"
2. Eerst categorieën:
   - Beginner
   - Slayer
   - GWD
   - Raids
   - Wildy
   - Skilling/minigame
3. Toon 8-12 aanbevolen bosses, niet 60.
4. Bij selectie:
   - verdict: "Try one trip", "Gear missing", "Not worth yet", "Risky for HCIM"
   - gear from bank
   - missing upgrades
   - inventory setup altijd zichtbaar/scrollbaar
   - "Copy RuneLite tab"
   - "Try another boss" sprite rail

Taken:
1. Maak boss modal rechterkolom scrollbaar.
2. Inventory altijd bereikbaar op laptop en mobiel.
3. Toon andere bosses naast/onder modal.
4. DPS blijft beschikbaar, maar niet als eerste mentale model.
5. Tests voor modal overflow, boss rail, inventory DOM en copy.

Acceptatiecriteria:
- Speler kiest sneller een boss.
- Modal voelt als loadout/trip planner, niet als stat sheet.
- Inventory verdwijnt niet buiten beeld.
```

---

## Prompt 9: RuneLite Plugin Als Officiële Sync Companion

```text
Doel:
Maak de RuneLite plugin nog rustiger: normale speler ziet alleen sync status, account mode, bank checks en next action. Geen URL, payload, endpoint, HTTP of debugwoorden.

Lees minimaal:
- plugin/src/main/java/app/scapestack/runelite/ScapestackSyncPanel.java
- plugin/src/main/java/app/scapestack/runelite/ScapestackSyncPlugin.java
- plugin/src/main/java/app/scapestack/runelite/ScapestackSyncConfig.java
- plugin/src/main/java/app/scapestack/runelite/CollectionLogReader.java
- plugin tests

Taken:
1. Panel polish:
   - status header
   - account mode with icon/helmet if feasible
   - last sync
   - bank checks on/off
   - Collection Log instruction only when needed
2. Chat copy:
   - short, calm
   - no technical terms
   - no URL
3. Collection Log:
   - if API cannot open it, keep clear fallback:
     "Open Collection Log once, then sync again."
4. Config:
   - keep dev/self-hosting hidden
   - normal config remains product copy
5. Tests:
   - no URL/endpoint/payload in normal copy
   - default official endpoint still works
   - accounttype sync remains
   - bank opt-in remains
   - Collection Log fallback is clear

Acceptatiecriteria:
- Plugin feels official, not like a webhook/debug tool.
- Normal user never sees a URL.
- Local development remains possible through hidden env/property override.
```

---

## Prompt 10: Final Product QA En Push

```text
Doel:
Na alle productverbeteringen controleren dat ScapeStack echt minder dashboard en meer OSRS trip caller is.

Controleer in browser desktop en mobiel:
- /
- /next?rsn=<naam>
- /bank?mode=tidy&rsn=<naam>&from=next
- /quests/<slug>?rsn=<naam>
- /dps?rsn=<naam>&boss=bryophyta
- /plugin

Checklist:
1. Eerste scherm geeft één duidelijke OSRS actie.
2. Geen dashboard/productwoorden in first viewport:
   - Session board
   - Main move
   - Backup moves
   - Worth it because
   - Bring/check
   - Stop when
   - bank signal
3. Bank setup voelt als RuneLite tab setup.
4. Smart Tidy heeft keuzes, preview, apply en copy.
5. Ironman/UIM/GIM copy is echt anders.
6. Quest/diary detail begint met verdict.
7. Boss modal heeft inventory bereikbaar.
8. Plugin toont geen URL of technische syncwoorden.
9. Mobile heeft geen overflow/overlap.
10. Tests en build groen.

Draai:
- npm test
- npm run typecheck
- npm run build
- cd plugin && ./gradlew test

Maak daarna:
- korte productreview met scores voor:
  - premium gevoel
  - makkelijk beginnen
  - OSRS-specificiteit
  - bank organizer
  - RuneLite plugin
  - Ironman/UIM/GIM
  - terugkomreden
- commit klein en duidelijk
- push naar main als de gebruiker dat vraagt

Acceptatiecriteria:
- Product voelt als "wat ga ik nu in OSRS doen?"
- Niet als "hier is je accountdashboard".
- Bekende beperkingen eerlijk genoemd.
```

