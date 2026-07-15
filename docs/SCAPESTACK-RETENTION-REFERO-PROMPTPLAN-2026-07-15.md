# Scapestack Retention + Refero Promptplan

Bijgewerkt op 2026-07-15.

Gebruik dit bestand als werkvolgorde voor de volgende grote Scapestack-slag.
Het doel is niet "meer schermen" of "meer data tonen", maar Scapestack
veranderen in een OSRS companion waar spelers terugkomen omdat het account
onthoudt wat veranderde, slimmer plant, en minder als dashboard voelt.

## Werkwijze

De gebruiker hoeft na elke fase alleen `ga door` te zeggen.

Elke fase moet zelfstandig afgerond worden:
- lees eerst de relevante code en tests;
- voer alleen de fase uit die aan de beurt is;
- maak geen losse rewrite;
- voeg of update tests;
- check desktop en mobile als UI verandert;
- run minimaal `npm test`, `npm run typecheck`, `npm run build`;
- als plugin-code verandert: `cd plugin && ./gradlew test`;
- commit en push;
- eindig met: wat is gedaan, checks, commit hash, en wat de volgende fase is.

Stop na elke fase. Wacht op `ga door`.

## Product North Star

Scapestack is de anti-bankstanding companion voor OSRS.

Een speler opent Scapestack en denkt:

> Wat moet ik nu doen?

Scapestack antwoordt:

1. Dit is je beste trip nu.
2. Dit heb je al.
3. Dit mis je nog.
4. Pak dit uit je bank.
5. Stop hier.
6. Volgende login verandert de route door je progress.

RuneLite-data is stille intelligentie. De speler moet niet een sync-dashboard
zien, maar voelen:

> Scapestack weet wat ik al gedaan heb.

## Waarom Mensen Nu Nog Niet Terugkomen

1. Scapestack is nog te veel een eenmalig antwoord.
   Wise Old Man geeft een reden om terug te komen via gains, history, records,
   groups en competitions. Scapestack moet hetzelfde doen voor trips: wat
   veranderde sinds je vorige login, welke route is nu beter, wat heb je
   afgerond, wat is je volgende clean stop point.

2. De app bewijst slimheid nog niet concreet genoeg.
   Als hij Cooking aanbeveelt, moet hij tonen hoeveel XP er nog nodig is, welke
   raw fish in de bank zit, hoeveel XP dat dekt, en wat ontbreekt. Anders voelt
   de aanbeveling als gokken.

3. De tools voelen nog los.
   Plan, Bank, Check kill, Goals en RuneLite moeten rond een account-memory
   werken. Niet steeds opnieuw naam invullen, niet overal Add bank, niet overal
   context uitleggen.

4. Te veel UI voelt als panelen en rails.
   Minder cards-in-cards, minder labels, minder statusblokken. Meer grote
   klikbare OSRS-keuzes, modals voor setup, en een full-bleed black/gold
   companion gevoel.

5. Er zijn te weinig "actually useful" momenten.
   De app moet vaker zulke regels maken:
   - You can kill Vorkath, but Salve makes the trip much better.
   - Your bank has enough raw fish for 430k Cooking XP.
   - Karamja hard is one task away; gloves change your next Slayer route.
   - This boss is killable, but not worth camping before upgrade X.

## Refero Direction Lock

Gebruik Refero bij UI-fases. Zoek en vergelijk, maar kopieer geen merk.

Basisrichting:
- Chantlings: black canvas, warm orange/gold accent, refined serif, veel
  negatieve ruimte, weinig chrome.
- Wayfinder: immersive dark storytelling, UI voelt geintegreerd in de wereld,
  geen dashboardboxen.
- Krea: premium dark product, scherpe hierarchy, restrained surfaces.
- Modal/card patterns: grote option cards, zoekbare grids, duidelijke selectie,
  geen kleine tabelrijen voor primaire keuzes.

Scapestack vertaling:
- black canvas;
- gold as action/accent only;
- white/cream display text;
- OSRS sprites and boss art as primary visuals;
- 1 focus per screen;
- setup in modals, niet als hele pagina tenzij echt nodig;
- grote touch targets, mobile first;
- geen drukke rails boven de fold;
- minimale topbar;
- account memory als thuisbasis.

Vermijd:
- generic SaaS dashboard;
- green sync/success theme;
- mini badges overal;
- nested panels;
- four-column status blocks;
- "data source", "signals", "payload", "readiness", "blockers" als speler-copy.

## Altijd Te Lezen Bij Start Van Elke Fase

Lees minimaal:
- `docs/scapestack-product-direction.md`
- `docs/SCAPESTACK-RETENTION-REFERO-PROMPTPLAN-2026-07-15.md`
- `src/app/page.tsx`
- `src/app/next/next-client.tsx`
- `src/components/header.tsx`
- `src/components/current-run-bar.tsx`
- `src/lib/next-up.ts`
- relevante tests voor de fase

Gebruik `rg` om actuele copy en componenten te vinden. Vertrouw niet alleen op
dit document.

## Globale Copy Regels

Gebruik:
- bankstanding
- next trip
- first click
- grab from bank
- still missing
- finish after
- stop point
- sync after progress
- trip
- KC
- task
- unlock
- gear
- supplies
- GP
- diary
- quest
- Slayer
- clog

Vermijd player-facing:
- dashboard
- signals
- payload
- readiness
- data source
- exact account state
- Plugin Hub
- PR
- blockers
- status panel
- source
- confidence
- analysis page

Interne code mag technische termen houden als dat domeinmodellen zijn, maar UI
en normale tests moeten spelerstaal bewaken.

---

# Fase 0 - Harde Audit + Reference Lock

## Prompt

```text
Doe eerst een harde product-, UI-, UX- en retention-audit van Scapestack.

Doel:
Vastleggen waarom spelers nu niet terugkomen, waar Scapestack nog te veel als
dashboard voelt, en welke Refero-richting we vastzetten voordat we bouwen.

Lees minimaal:
- docs/scapestack-product-direction.md
- docs/SCAPESTACK-RETENTION-REFERO-PROMPTPLAN-2026-07-15.md
- docs/REBRAND-AUDIT.md
- docs/PRODUCT-AUDIT-2026-07-08.md
- src/app/page.tsx
- src/app/next/next-client.tsx
- src/app/dps/dps-client.tsx
- src/app/goals/page.tsx
- src/app/bank/page.tsx
- src/components/header.tsx
- src/components/current-run-bar.tsx
- src/app/globals.css
- tests/no-dashboard-copy.test.ts
- tests/homepage-copy.test.ts
- tests/next-client-confidence-copy.test.ts
- tests/dps-row-affordance.test.ts
- tests/goals-data-source-copy.test.ts

Gebruik Refero:
1. Search styles voor:
   - dark fantasy companion app black gold
   - premium dark product interface
   - immersive storytelling dark web
2. Search screens voor:
   - selectable cards modal
   - searchable grid picker
   - onboarding choose preference cards
3. Vat alleen de bruikbare patronen samen. Kopieer geen merk.

Schrijf een nieuw auditdocument:
`docs/SCAPESTACK-RETENTION-AUDIT-2026-07-15.md`

Structuur:
1. Waarom mensen niet terugkomen
2. Waar de UI nog dashboard voelt
3. Wat Wise Old Man beter doet voor retention
4. Wat RuneLite/Wiki beter doen voor trust
5. Refero reference lock
6. Nieuwe UI-principes
7. Top 10 concrete code changes in impactvolgorde
8. Welke tests toegevoegd of aangepast moeten worden

Bouw nog geen UI. Commit en push alleen het document.
Stop daarna en wacht op "ga door".
```

## Acceptatie

- Er is een concreet auditdocument.
- Het document noemt echte bestanden/componenten uit de codebase.
- Refero is gebruikt en vertaald naar Scapestack-regels.
- Geen implementatie buiten docs.

---

# Fase 1 - Account Home + Memory Loop

## Prompt

```text
Bouw Scapestack rond een account-home in plaats van losse tools.

Doel:
Een speler vult een OSRS naam een keer in. Daarna voelt Scapestack als:
"Welkom terug. Dit veranderde. Dit is nu je volgende trip."

Lees minimaal:
- src/app/page.tsx
- src/app/u/[rsn]/page.tsx
- src/components/header.tsx
- src/components/current-run-bar.tsx
- src/lib/account-storage.ts
- src/lib/saved-bank.ts
- src/lib/mood-storage.ts
- src/lib/recommendation-feedback.ts
- src/lib/next-plugin-sync-summary.ts
- tests/profile-page-copy.test.ts
- tests/current-run-bar.test.ts
- tests/account-storage.test.ts
- tests/homepage-copy.test.ts

Probleem:
Account, bank, RuneLite en vibe bestaan al, maar de UI herhaalt context en de
speler voelt nog niet dat Scapestack hem kent.

Taken:
1. Maak de homepage voor returning users een account-home card:
   - "Welcome back, {rsn}"
   - "Plan next trip"
   - Bank status met checkmark als bank aanwezig is
   - RuneLite status met checkmark of refresh als stale
   - Last vibe
   - "What changed since last time" als er sync/memory is
2. Verwijder dubbele account context bovenin als rechts al account-dropdown
   staat.
3. Zorg dat remove account echt:
   - account uit storage haalt
   - bank koppeling voor dat account niet als actief toont
   - welcome back state reset
   - UI direct update zonder refresh
4. Maak Bank, RuneLite en Vibe klikbare modals/popovers, niet aparte rails.
5. Voeg tests toe voor:
   - saved account wordt homepage primary state
   - remove account reset homepage
   - bank checkmark alleen als bank echt gekoppeld is
   - RuneLite stale toont refresh, live toont check

UI-regels:
- mobile first;
- geen statusrail;
- geen dashboardtaal;
- grote knoppen;
- black/gold/white;
- popups in OSRS parchment/dark style.

Verifieer, commit, push. Stop daarna.
```

## Acceptatie

- Terugkerende speler hoeft geen naam opnieuw in te voeren.
- Account verwijderen werkt zichtbaar.
- Bank/RuneLite/vibe zitten in compacte acties.
- Geen dubbele account pills.

---

# Fase 2 - `/next` Als Route Companion, Niet Als Antwoordkaart

## Prompt

```text
Verdiep `/next` tot een echte OSRS route companion.

Doel:
Niet alleen "Do this first", maar:
- wat nu
- wat daarna
- waarom deze route veranderde
- wat de bank/RuneLite concreet bijdroeg
- wat je bij de volgende login opnieuw moet laten checken

Lees minimaal:
- src/app/next/next-client.tsx
- src/lib/next-up.ts
- src/lib/mood.ts
- src/lib/recommendation-feedback.ts
- src/lib/next-plugin-sync-summary.ts
- tests/next-client-confidence-copy.test.ts
- tests/next-up-action-plan.test.ts
- tests/mood.test.ts

Probleem:
De aanbeveling voelt soms willekeurig of dun. Randomize kan nog verkeerd
aanvoelen als gekozen vibe niet gerespecteerd wordt. De route-flow is aanwezig,
maar moet slimmer en minder panel-achtig.

Taken:
1. Maak "What are you in the mood for?" direct klikbaar als keuzegrid/modal:
   - Chill
   - GP
   - Bossing
   - Unlock
   - AFK
   - Short
   - Surprise me
2. Randomize moet altijd binnen de gekozen vibe blijven.
   - Chill mag geen Chambers of Xeric headline geven.
   - AFK mag geen intense boss headline geven.
   - GP mag bossing als money-maker alleen als het past.
3. Breid routeTimeline uit:
   - Now
   - After
   - If you get bored
   - Next login
   - Sync after progress
   Geen "timeline dashboard".
4. Voeg per headline concrete proof toe, maar kort:
   - "Your bank covers X XP"
   - "RuneLite skipped finished diary steps"
   - "You already have 48 KC; 50 is a clean stop point"
   - "No bank, so gear stays conservative"
5. Voor skills:
   - toon XP left
   - toon banked XP als bank aanwezig is
   - toon missing supplies
   - ironman: source path als supplies ontbreken
6. Voor bosses:
   - toon killable / not worth camping / upgrade first
   - toon best owned gear
   - toon inventory setup uit bank
   - toon missing key upgrade
7. Voor diaries/quests:
   - toon grootste missing step
   - toon reward item groter
   - laat afvinken van manual steps toe waar RuneLite niet genoeg weet

Tests:
- randomize respects mood
- chill randomize does not return raid/intense boss
- skill rec includes XP left when skill known
- banked supplies appear for Cooking/Fletching/Prayer/etc.
- RuneLite copy uses scan time, not "old"
- no dashboard/status/payload/readiness/player-facing blockers

Verifieer, commit, push. Stop daarna.
```

## Acceptatie

- `/next` voelt als een route, niet als losse kaart.
- De speler ziet waarom deze pick nu klopt.
- Randomize voelt niet dom.
- Mobile is groter en cleaner.

---

# Fase 3 - Goals Als Unlock Companion

## Prompt

```text
Herbouw `/goals` als "What unlock next?" companion, geen progress dashboard.

Doel:
Een speler ziet in een oogopslag:
- welk unlock bijna klaar is
- welk item/reward het oplevert
- wat precies mist
- wat afgevinkt kan worden
- wat RuneLite/bank al zeker weet

Lees minimaal:
- src/app/goals/page.tsx
- src/lib/goals.ts
- src/lib/path-progress.ts
- src/lib/diary-requirements.ts
- src/components/path-detail-modal.tsx
- tests/goals-data-source-copy.test.ts
- tests/path-progress.test.ts
- tests/path-detail-modal-affordance.test.ts

Probleem:
Goals toont nog progress en status-achtige blokken. De speler wil geen
dashboard; hij wil weten of hij Karamja gloves, elite void, defender, assembler,
diary reward of quest unlock moet doen.

Taken:
1. Eerste viewport:
   - "Closest unlock"
   - grote reward sprite/item
   - naam
   - "1 thing left" / "Need 70 Prayer" / "Claim reward"
   - primaire knop: "Open steps"
2. Cards voor unlocks:
   - groter
   - klikbaar
   - reward sprite prominent
   - progress klein
   - geen rail met Bank/RSN/RuneLite
3. Unlock modal:
   - grote reward
   - missing steps
   - bank items gevonden
   - RuneLite completed steps
   - manual checkboxes voor niet-verifieerbare stappen
4. Special cases:
   - Elite void impliceert normal void
   - Karamja gloves route moet per tier duidelijk zijn
   - diary rewards tonen exact tier reward
   - quest cape/barrows gloves/fairy rings/defender/assembler als route cards
5. Copy:
   - geen "untradeable progress" als primaire header
   - geen "make it smarter" bovenaan
   - geen "data source"
   - geen "blockers"

Tests:
- Karamja gloves card opens reward modal
- Elite void requires normal void path
- Bank-owned reward is marked handled
- Manual checkbox persists locally
- no dashboard copy

Verifieer, commit, push. Stop daarna.
```

## Acceptatie

- Goals voelt als unlock map.
- Beloning staat centraal.
- Details zitten in modal.

---

# Fase 4 - Check Kill Als Boss Browser + Trip Builder

## Prompt

```text
Maak `/dps` een boss browser en trip builder, niet een single verdict page.

Doel:
Speler ziet alle bosses als grote klikbare tiles, zoekt of filtert, klikt een
boss, en krijgt:
- can I kill this?
- best owned gear
- inventory setup from bank
- missing upgrades
- buy/gather list
- first trip and stop point

Lees minimaal:
- src/app/dps/dps-client.tsx
- src/components/boss-picker.tsx
- src/components/boss-detail-modal.tsx
- src/lib/bosses.ts
- src/lib/boss-viability.ts
- src/lib/dps-bank-context.ts
- src/lib/gear.ts
- tests/dps-row-affordance.test.ts
- tests/boss-detail-modal-affordance.test.ts
- tests/boss-viability.test.ts
- tests/dps-upgrade-actions.test.ts

Probleem:
Check kill kan nog te veel als dashboard/summary voelen. De gebruiker wil alle
bosses naast elkaar, search, click, details.

Taken:
1. Eerste viewport:
   - search bar
   - filter chips: All, GP, Slayer, Wildy, Raid, Beginner, Solo
   - grote boss tiles met boss art/id/sprite
   - geen open details link; hele tile is clickable
2. Boss detail modal:
   - boss groot
   - verdict: "Do one trip", "Upgrade first", "Skip for now"
   - best owned gear
   - inventory setup uit bank
   - missing supplies
   - upgrade before camping
   - expected kill speed / rough GP only als nuttig
3. Inventory setup:
   - food
   - potions
   - teleport out
   - ammo/runes
   - spec weapon if owned
   - buy/gather missing
4. Als bank ontbreekt:
   - "Add bank to build setup"
   - popup, geen aparte grote pagina
5. Geen dashboard labels:
   - status
   - source
   - readiness
   - DPS table above fold

Tests:
- all bosses render as clickable buttons/cards
- boss detail opens from card click
- best inventory uses owned bank items
- missing inventory items appear as buy/gather
- no "Open details" copy
- no dashboard copy

Verifieer, commit, push. Stop daarna.
```

## Acceptatie

- Check kill voelt als OSRS boss picker.
- Boss detail is een trip setup, geen spreadsheet.

Status 2026-07-15: uitgevoerd in fase 4. `/dps` toont nu alle bosses als grote
klikbare tiles met All/GP/Slayer/Wildy/Raid/Beginner/Solo filters, geen
"Open details" link, een boss-detail modal met inventory setup, buy/gather
chips en "Upgrade before camping", plus bijgewerkte copy/tests. De modal-first
Add Bank flow blijft bewust onderdeel van fase 5.

---

# Fase 5 - Bank Organizer Als Popup + RuneLite Setup Tool

## Prompt

```text
Maak bank toevoegen overal een modal-first flow, en behoud `/bank` als volledige
bank organizer.

Doel:
Vanuit homepage, /next, /dps en /goals opent "Add bank" een simpele popup:
- paste bank
- how to met screenshot
- save
- continue

De volledige `/bank` blijft bestaan als organizer voor Bank Tags en tabs.

Lees minimaal:
- src/app/bank/page.tsx
- src/components/hero-intake.tsx
- src/components/header.tsx
- src/components/current-run-bar.tsx
- src/components/bank-setup-steps.tsx
- src/lib/saved-bank.ts
- src/lib/bank-handoff-url.ts
- tests/bank-intake-ux.test.ts
- tests/bank-setup-steps.test.ts
- tests/bank-rsn-prefill.test.ts

Taken:
1. Bouw of centraliseer `AddBankModal`.
2. Modal inhoud:
   - title: "Add bank"
   - korte uitleg: "Paste Bank Memory once. Scapestack saves it on this device."
   - screenshot van Bank Memory flow via bestaande cubeupload/image assets
   - textarea
   - paste button
   - save button
   - link: "Open full organizer"
3. Als RSN actief is, koppel bank automatisch aan dat account.
   - Geen OSRS name input in modal als account bekend is.
4. Na save:
   - header toont Bank added checkmark
   - `/next` gebruikt bank direct
   - `/dps` gebruikt bank direct
5. `/bank` first viewport:
   - "Organize RuneLite bank"
   - bank grid/preview
   - copy to RuneLite
   - advanced controls collapsed
6. Verwijder duplicate Add bank states als bank al toegevoegd is.

Tests:
- modal opens from header/current run bar
- save links bank to active RSN
- no RSN input when active account exists
- Bank added updates immediately
- full organizer still accessible

Verifieer, commit, push. Stop daarna.
```

## Acceptatie

- Add bank is geen overweldigende pagina meer.
- Full bank organizer blijft krachtig.

Status 2026-07-15: uitgevoerd in fase 5. Er is een centrale `AddBankModal`
toegevoegd met Bank Memory screenshot, paste, save en "Open full organizer".
Header/accountmenu, CurrentRunBar, homepage, `/next` intake en de `/dps`
missing-bank state gebruiken nu deze modal-first flow. De save koppelt aan de
actieve RSN zonder extra RSN-input en triggert bestaande saved-bank events,
terwijl `/bank` de volledige organizer blijft.

---

# Fase 6 - RuneLite Plugin Als Silent Memory Engine

## Prompt

```text
Verbeter RuneLite sync zodat het voelt als account memory, niet als plugin
status.

Doel:
RuneLite zegt niet "payload/status"; Scapestack zegt:
- last scan
- XP gained since last scan
- finished quests skipped
- diary steps skipped
- Slayer/task updated
- bank snapshot refreshed

Lees minimaal:
- plugin/src/main/java/... relevante Scapestack plugin files
- src/app/plugin/page.tsx
- src/components/plugin-sync-checker.tsx
- src/lib/plugin-sync.ts
- src/lib/plugin-sync-diagnostics.ts
- src/lib/next-plugin-sync-summary.ts
- src/lib/sync-schema.ts
- tests/plugin-page-copy.test.ts
- tests/plugin-sync-diagnostics.test.ts
- tests/next-plugin-sync-summary.test.ts
- tests/sync-schema.test.ts

Taken:
1. Plugin page:
   - title: "Check RuneLite"
   - status:
     - "RuneLite is helping your next trip"
     - "Press Sync now, then check again"
     - "Last scan: Jun 28, 10:51"
   - geen Plugin Hub/PR/payload/readiness boven fold
2. Refresh knop overal waar RuneLite stale is:
   - opent plugin page/checker
   - copy zegt wat te doen
3. Sync summary:
   - XP since last scan
   - quests completed
   - diary tiers completed
   - clog additions
   - Slayer task change
   - bank snapshot age
4. Gebruik deze summary in:
   - homepage account home
   - `/next`
   - `/goals`
   - `/dps`
5. Voeg plugin tests toe als payload/schema verandert.

Tests:
- player-facing copy contains "Last scan"
- no payload/readiness/signals/player-facing Plugin Hub
- stale RuneLite shows refresh action
- live RuneLite shows checkmark
- XP delta renders as return value

Verifieer web en plugin, commit, push. Stop daarna.
```

## Acceptatie

- RuneLite voelt nuttig maar stil.
- Sync wordt account memory.

---

# Fase 7 - Visual System Reset

## Prompt

```text
Voer een visuele reset uit op basis van Refero lock: black/gold/white OSRS
companion, geen goedkoop dashboard.

Doel:
Een consistente stijl over homepage, /next, /bank, /dps, /goals, plugin.

Lees minimaal:
- src/app/globals.css
- src/app/layout.tsx
- src/components/header.tsx
- src/components/current-run-bar.tsx
- src/components/hero-intake.tsx
- src/app/next/next-client.tsx
- src/app/dps/dps-client.tsx
- src/app/goals/page.tsx
- src/app/bank/page.tsx
- tests/theme-token-regression.test.ts
- tests/banded-layouts.test.ts
- tests/no-dashboard-copy.test.ts

Gebruik Refero opnieuw:
- dark fantasy black gold style
- premium dark product interface
- selectable card modal

Reference lock:
- black canvas
- warm gold action
- cream/white display text
- subtle brown/parchment surfaces only for focused modals
- few borders
- no green success theme except maybe tiny check icon if unavoidable
- no nested cards
- mobile-first spacing

Taken:
1. Update CSS tokens:
   - base black
   - panel near-black
   - parchment modal surface
   - gold action
   - muted cream text
   - danger/warning restrained
2. Define component rules:
   - primary action
   - ghost action
   - modal
   - boss tile
   - account pill
   - route card
3. Remove inconsistent green.
4. Make mobile layouts feel intentional:
   - bigger inputs
   - bigger cards
   - sticky bottom action only where useful
5. Screenshot check:
   - homepage mobile/desktop
   - /next mobile/desktop
   - /dps mobile/desktop
   - /bank modal mobile
   - /goals modal mobile

Tests:
- theme tokens expected
- no old green dominance classes if present
- no nested panel regression where tests can catch it

Verifieer, commit, push. Stop daarna.
```

## Acceptatie

- App voelt als eenzelfde product.
- Geen goedkope green SaaS look.
- Mobile voelt primary, niet aangepast achteraf.

---

# Fase 8 - Retention Features: Weekly Recap + Shareable Trip

## Prompt

```text
Bouw de eerste echte terugkom-loop: weekly recap + shareable trip.

Doel:
Scapestack moet een reden geven om morgen/volgende week terug te komen.

Lees minimaal:
- src/lib/mood-storage.ts
- src/lib/recommendation-feedback.ts
- src/lib/score-history.ts
- src/lib/snapshot-history.ts
- src/app/u/[rsn]/page.tsx
- src/app/next/next-client.tsx
- src/app/opengraph-image.tsx
- tests/profile-page-copy.test.ts
- tests/recommendation-feedback.test.ts

Taken:
1. Local account timeline:
   - last planned trip
   - started
   - done
   - skipped
   - RuneLite XP since last scan
   - bank updated time
2. Account home:
   - "This week"
   - XP gained if available
   - trips started/done locally
   - best unlock moved closer
   - next clean trip
3. Shareable trip card:
   - one OSRS plan
   - boss/item sprite
   - stop point
   - no sensitive bank details
4. Add "Mark done" loop:
   - after mark done, route updates
   - home shows completed
5. No auth. Store locally unless existing server model is already safe.

Tests:
- local timeline stores done/skipped/started
- account home renders recap when data exists
- share card excludes bank contents
- mark done changes next pick memory

Verifieer, commit, push. Stop daarna.
```

## Acceptatie

- Scapestack heeft een reden om terug te keren.
- Recap is OSRS progress, geen analytics dashboard.

---

# Fase 9 - Final Reddit Fit Pass

## Prompt

```text
Doe een laatste Reddit-fit pass alsof Scapestack morgen op r/2007scape gaat.

Pitch:
"I built a RuneLite-powered tool that tells you what to do next when you log
in, so you stop bankstanding."

Lees alle belangrijke schermen en tests:
- homepage
- /next
- /dps
- /goals
- /bank
- /plugin
- /u/[rsn]
- no-dashboard/copy/theme tests

Taken:
1. Maak `docs/REDDIT-LAUNCH-CHECK-2026-07-15.md`:
   - eerste screenshot
   - post title
   - post body
   - expected objections
   - privacy answer
   - why RuneLite is optional
   - why bank stays local
2. Fix alleen high-impact polish issues:
   - overlapping text
   - duplicate CTAs
   - dashboard words
   - mobile cramped cards
   - unclear click targets
3. Run screenshots/browser checks.
4. Run full verification.

Verifieer, commit, push. Stop daarna.
```

## Acceptatie

- Eerste screenshot bewijst anti-bankstanding.
- Copy voelt Reddit-native.
- UI voelt als one product.

---

# Eerste Commando Voor De Volgende Sessie

Gebruik dit als de gebruiker `ga door` zegt:

```text
Start met Fase 0 uit `docs/SCAPESTACK-RETENTION-REFERO-PROMPTPLAN-2026-07-15.md`.
Voer alleen die fase uit. Gebruik Refero zoals beschreven. Commit en push.
Stop daarna en wacht op "ga door".
```
