# Promptbook — werkzaamheden, terugkeerheid, UI/UX

_Geschreven na de audit van 2026-07-25. Elke prompt hieronder komt uit een
bevinding die adversarieel geverifieerd is, niet uit een wishlist. Bronnen:
`docs/SCAPESTACK-AUDIT-2026-07-25.md` (48 bevindingen) en
`docs/SCAPESTACK-ACCESS-MODEL-PLAN-2026-07-25.md`._

Volgorde is bewust. Deel A is schuld die rente kost. Deel B verandert of het
product terugkerend wordt. Deel C is pas geloofwaardig als A af is — mooie
schermen boven fout advies maken het erger, niet beter.

---

## Staande regels — geldt voor élke prompt hieronder

Plak dit blok mee, of zet het één keer in `CLAUDE.md`. Elke prompt in dit
document gaat ervan uit dat deze regels gelden.

> **Werkregels voor Scapestack**
>
> 1. **Bewijs, geen plausibiliteit.** Dit is OSRS. Spelers kennen de eisen uit
>    hun hoofd; één fout feit leest als bewijs dat de maker het spel niet
>    speelt. Controleer elke bewering over het spel tegen `data/quests.json`,
>    `data/diaries.json` of `src/lib/slayer/monsters.ts` vóór je hem opschrijft.
>    Kun je het niet uit de repo bewijzen, schrijf het dan niet op.
> 2. **Onterecht blokkeren is even erg als onterecht aanraden.** Het faalt
>    alleen stiller. Als je content achter een eis zet, moet die eis
>    verifieerbaar zijn. Zie de curatieregel bovenaan
>    `src/lib/content-access-data.ts`.
> 3. **Drie toestanden, nooit twee.** `unlocked` / `locked` / `unknown`. Iets
>    verbergen omdat je het niet zeker weet is een bug, geen voorzichtigheid.
>    Zie `src/lib/content-access.ts`.
> 4. **36% van de tests toetst broncodetekst, geen gedrag** (3.037
>    `toContain`-asserts). Verplaats je code, dan breken tests die niets met je
>    wijziging te maken hebben. Dat is verwacht. Repareer ze door de *intentie*
>    te toetsen, niet door de string bij te werken. Voor de `/next`-engine
>    bestaat daar al een helper voor: `tests/helpers/next-up-source.ts`.
> 5. **Copy-regels** uit `docs/scapestack-product-direction.md`: spelerstaal
>    (bankstanding, trip, KC, task, unlock, gear, stop point), nooit
>    producttaal (status, payload, readiness, data source, sync, confidence).
> 6. **De gate is `npm run ci:check`.** Typecheck, 1435 tests, smoke, twee
>    audits, plugin release-check en de productiebuild. Voor plugin-werk
>    daarnaast `cd plugin && ./gradlew test`.
> 7. **Raak de plugin niet aan zonder het te zeggen.** De Plugin Hub bouwt één
>    onveranderlijke commit en je kunt niet terugrollen. Zie
>    `plugin/PUBLISHING.md`.
> 8. **Wees eerlijk over wat je niet hebt gedaan.** Half werk dat als af wordt
>    gepresenteerd is duurder dan geen werk.

---

# Deel A — Werkzaamheden

## A1. TempleOSRS eruit

De duurste regel code in het product: ~300 ms op elke plan-render, voor een
endpoint dat structureel 404 geeft.

> Lees `src/lib/temple.ts`, `src/lib/planning-context.ts` en
> `src/app/actions.ts`.
>
> `https://templeosrs.com/api/player_quests.php` bestaat niet meer — hij geeft
> 404 voor elke speler. Verifieer dat eerst zelf met een paar echte RSN's, en
> controleer of een ander Temple-endpoint (`player_stats.php`,
> `player_info.php`) wél 200 geeft, zodat je zeker weet dat het aan dít pad
> ligt en niet aan de host.
>
> Meet daarna wat het kost: start `npx next start`, doe zes `/next`-renders en
> lees de `scapestack.next_context`-regels. Noteer `elapsedMs` voor de
> temple-bron en `totalMs`.
>
> Verwijder vervolgens de Temple-questbron volledig:
> - de bron uit de `Promise.all` in `loadPlanningContext`
> - `templePayload`, `TemplePayload`, `templeAction` en `fetchTemple`
> - `templeQuestsCompleted` uit `NextUpInput` en `computePathProgress`
> - het `temple`-budget uit `PLANNING_SOURCE_DEADLINES_MS`
>
> Let op twee dingen. `questsPathFromExactQuests` in `path-progress.ts` wordt
> óók door de RuneLite-plugin gebruikt — die tak blijft, alleen de Temple-bron
> verdwijnt. En `syncedSources.temple` zit in een payload die de UI leest;
> verwijder die pas nadat je hebt gecontroleerd wie hem gebruikt.
>
> Meet na afloop opnieuw en zet het verschil in de commit-boodschap.
> Verifieer met `npm run ci:check`.

## A2. `/api/sync/claim` dichttimmeren

Nu een ongeauthenticeerde, ongelimiteerde permanente claim op elke RSN in het
spel.

> Lees `src/app/api/sync/claim/route.ts`, `src/lib/sync-auth.ts` en
> `src/lib/account-pairing.ts` (die heeft al een rate-limit-patroon met
> `recent_pairings`).
>
> Het probleem: iedereen kan de naam van elke speler claimen vóórdat die speler
> de plugin installeert, en er is geen weg terug — `recordClaim` is
> first-wins en er bestaat geen reclaim-endpoint.
>
> Bouw twee dingen:
> 1. **Rate limiting per IP en per token.** Volg het patroon uit
>    `account-pairing.ts`: een tellende query over een tijdvenster, geen nieuwe
>    infrastructuur. Kies een limiet die een echte speler nooit raakt (één
>    install claimt hooguit een handvol namen) en documenteer de keuze in een
>    comment.
> 2. **Een terugweg.** Een claim die nooit een geslaagde `/api/sync` heeft
>    gehad is niets waard — een echte speler synchroniseert binnen seconden na
>    het claimen. Laat zo'n ongebruikte claim verlopen (bijvoorbeeld na 24 uur)
>    zodat de rechtmatige eigenaar hem alsnog kan pakken. Een claim mét
>    syncgeschiedenis blijft onaantastbaar.
>
> Schrijf tests voor: kaper claimt en synchroniseert nooit → echte speler kan
> na het venster claimen; kaper claimt én synchroniseert → blijft geblokkeerd
> (dat is het gedrag dat we willen, ook al is het vervelend); normale speler
> raakt de rate limit nooit.
>
> Verifieer met `npm run ci:check`.

## A3. `data/items.json` een buildscript geven

> Lees `scripts/build-item-data.mjs`, `scripts/build-quest-data.mjs` (als
> voorbeeld van een script dát bestaat) en vergelijk `data/items.json` met
> `data/item-meta.json`.
>
> `items.json` (727 KB) heeft geen buildscript en mist 366 momenteel
> verhandelbare items. `item-meta.json` is later gebouwd en spreekt hem tegen.
> Twee bestanden die hetzelfde beschrijven en uit elkaar zijn gelopen — precies
> het patroon dat in deze codebase al drie keer is voorgekomen
> (`DIARY_REWARD_ICONS`, de Slayer-poorten, de RSN-normalisatie).
>
> Bepaal eerst wat elk bestand levert en wie het leest. Beslis daarna één van
> twee dingen, en leg de keuze vast in een comment:
> - één bestand, één script, en de andere verdwijnt; of
> - twee bestanden met verschillend doel, één script dat beide genereert, en
>   een test die de overlap consistent houdt.
>
> Schrijf het script in de stijl van de bestaande `build-*.mjs` en documenteer
> de regenereer-instructie in `README.md`.
>
> Verifieer met `npm run ci:check`.

## A4. Wiki-redirects in de drop-rate builder

> Lees `scripts/build-drop-rates.mjs`.
>
> De scraper volgt geen Wiki-redirects. The Hueycoatl kwam daardoor met een
> lege droptabel binnen en er faalde niets — dat is de echte bug: stille
> gedeeltelijke data.
>
> Doe twee dingen:
> 1. Volg redirects (de MediaWiki-API doet dat met `redirects=1`).
> 2. Laat het script **falen** op een lege droptabel voor een baas die in
>    `src/lib/bosses.ts` staat. Een generator die stil niets oplevert is
>    erger dan een generator die stuk gaat.
>
> Regenereer, laat het diff zien, en noem in de commit welke bazen data
> kregen die ze eerst misten.

## A5. Dode retentie-machinerie: opruimen of afmaken

> Lees `src/lib/account-history-repo.ts`, `src/app/api/account/delete/route.ts`
> en de `deletion_requested_at` / `delete_after` kolommen in
> `src/lib/sync-schema.ts`.
>
> De uitgestelde-verwijdering is dode code: er staat wel een intentie in het
> schema, maar niets verwijdert ooit iets. Dat is een privacybelofte die je
> niet nakomt.
>
> Kies expliciet en voer uit:
> - **Afmaken**: een cron of route die verlopen accounts echt opruimt, met een
>   test die bewijst dat er data verdwijnt; of
> - **Weghalen**: kolommen en code eruit, en de belofte uit de teksten halen.
>
> Half laten staan is geen optie. Zeg in de commit welke kant je koos en
> waarom.

---

# Deel B — Terugkeerheid

Lees vóór dit deel `docs/SCAPESTACK-RETENTION-AUDIT-2026-07-15.md`. Die is
scherp over presentatie. Wat hier staat gaat over iets anders: de vraag die het
product beantwoordt.

**De strategische kern:** *"Wat moet ik nu doen?"* is een laagfrequente vraag.
Wie actief speelt zit midden in een grind en weet precies wat hij doet — de
vraag komt op bij terugkeer na een pauze of bij max-verveling. Een paar keer
per jaar. *"Is deze taak het waard?"* wordt elke Slayer-taak gesteld,
meerdere keren per sessie, en vereist precies de data die alleen jouw plugin
levert.

## B1. Meet eerst welke vraag mensen stellen

Niet bouwen op mijn analyse. Bouwen op jouw data.

> Lees `src/lib/analytics.ts` en `docs/ANALYTICS-EVENTS.md`.
>
> Ik wil één vraag beantwoord krijgen: **welke route brengt mensen terug?**
>
> Instrumenteer minimaal:
> - eerste bezoek per route (`/next`, `/slayer`, `/dps`, `/bank`)
> - herhaalbezoek binnen 7 dagen, per route
> - of er een plugin-sync aan vooraf ging
> - of de speler een tweede actie deed of direct wegging
>
> Voeg geen dashboard toe. Eén script dat de cijfers uitdraait is genoeg.
> Belangrijk: geen RSN's, geen bankinhoud, geen PII in events — zie
> `docs/privacy-security-threat-model.md`.
>
> Rapporteer wat er nodig is om over twee weken te kunnen zeggen: "route X
> heeft de hoogste terugkeer." Bouw daarna niets meer tot die data er is.

## B2. `/slayer` als hoofdproduct

De hoogfrequente vraag, en je sterkste datavoordeel. Wise Old Man kan dit niet.
De Wiki kan dit niet. Een DPS-calculator kan dit niet.

> Lees `src/app/slayer/`, `src/lib/slayer-task-decision.ts` en
> `docs/scapestack-product-direction.md`.
>
> `/slayer` beantwoordt de enige vraag die een speler meerdere keren per sessie
> stelt: doen, skippen, blokkeren, extenden, bursten of cannonen. Vandaag staat
> hij weggestopt als subtool.
>
> Maak hem de hoofdbelofte:
> 1. De homepage-hero krijgt een tweede, gelijkwaardige route: naast "Stop
>    bankstanding" komt de taakbeslissing. Eén zin, spelerstaal, geen uitleg.
> 2. `/slayer` moet bruikbaar zijn **zonder account**: toon de mastertabel en
>    de taaklijst meteen. Het account maakt het persoonlijk, het is geen
>    toegangseis. Zie `src/components/boss-roster.tsx` voor hoe dit op `/dps`
>    is opgelost.
> 3. De beslissing moet boven de vouw staan en één woord zijn: **Do** /
>    **Skip** / **Block** / **Extend**. De onderbouwing eronder, niet ervoor.
>
> Let op: `slayer-client.tsx` toont vandaag "Turael is the strongest available
> master" vóórdat er invoer is, omdat `useState(3)`/`useState(1)` meteen
> `rankMasters` voedt. Los dat op — raden vóór invoer ondermijnt precies het
> vertrouwen dat deze route moet winnen.
>
> Verander niets aan `/next`. Verifieer met `npm run ci:check`.

## B3. De terugkeerlus die er niet is

> Lees `src/lib/account-timeline.ts`, `src/lib/account-snapshot-delta.ts`,
> `src/lib/recommendation-outcome-repo.ts` en de sectie "Wat Wise Old Man beter
> doet" in `docs/SCAPESTACK-RETENTION-AUDIT-2026-07-15.md`.
>
> Een sessieplanner heeft van nature geen terugkeerlus: als het advies goed is
> ga je spelen, en dan heb je de tool niet meer nodig. Wise Old Man is
> terugkerend omdat het een *geheugen* is — je gains veranderen terwijl je
> speelt, dus er is elke dag iets nieuws.
>
> Je hebt die machinerie al: snapshot-deltas, outcome-reconciliation bij elke
> sync, een timeline. Wat ontbreekt is dat de speler er iets van merkt.
>
> Bouw één ding, klein: na een sync die echte voortgang laat zien, opent
> `/next` met wat er sinds de vorige scan veranderd is — en of de vorige
> aanbeveling gelukt is. Vier regels, geen grafiek, geen paneel:
>
>     Sinds je laatste trip: +142k Cooking XP · 3 diary-taken · 12 Vorkath KC
>     Je vorige plan (Karamja Elite) staat nog open — verder afmaken?
>
> Harde eisen: het verschijnt **alleen** als er echt iets veranderd is; het
> staat ná de hoofdaanbeveling, niet ervoor; en het is geen statusbalk. Geen
> woord uit de verboden lijst.
>
> Verifieer met `npm run ci:check`.

## B4. Eerlijkheid als functie, niet als disclaimer

> Lees `src/lib/content-access.ts`, in het bijzonder `accessNeedsLine`.
>
> Het toegangsmodel produceert al regels als *"Needs Dragon Slayer II —
> Scapestack cannot confirm this without a RuneLite sync."* Dat is de sterkste
> installatie-aanleiding die het product heeft: het toont exact wat de plugin
> zou oplossen, op het moment dat het uitmaakt.
>
> Vandaag staat die regel in `needs[]`, diep in de detail-expand. Breng hem
> naar de plek waar hij werkt: op de kaart zelf, klein, naast de titel. Niet
> als waarschuwing — als aanbod.
>
> Ontwerp de copy voor twee gevallen:
> - onbekend: "Vereist Dragon Slayer II · sync RuneLite om dit te bevestigen"
> - bevestigd door de plugin: helemaal geen regel, want dan is er niets te
>   melden
>
> Meet daarna of het werkt (zie B1). Verifieer met `npm run ci:check`.

---

# Deel C — UI en UX

## C1. Elke route bruikbaar zonder account

Het lege gevoel is geen gevoel: `/skills` rendert 46 tekens, `/dps` deed 43 tot
dit is opgelost.

> Lees `src/components/boss-roster.tsx` — daar is dit voor `/dps` al opgelost —
> en daarna `src/app/goals/`, `src/app/skills/`, `src/app/quests/` en
> `src/app/diary/`.
>
> Het principe: **inhoud staat er altijd, het account maakt het persoonlijk.**
> Elke pagina is nu een formulier dat op invoer wacht. Vergelijk met wat
> OSRS-spelers dagelijks gebruiken — Wiki, Wise Old Man, DPS-calculators: alles
> is zichtbaar zonder inloggen.
>
> Doe per route hetzelfde als bij de bossenlijst:
> 1. Toon de volledige inhoud meteen, met sprites, gesorteerd van makkelijk
>    naar zwaar.
> 2. Toon per item de échte eis uit de data — niet een oordeel. Zonder account
>    weet je niets, dus beweer niets.
> 3. Met account komt het oordeel erbovenop.
>
> Meet vooraf en achteraf hoeveel zichtbare tekst `<main>` server-side rendert,
> en zet beide getallen in de commit. Dat is ook je SEO-winst: er valt nu
> niets te indexeren.
>
> Verifieer met `npm run ci:check`.

## C2. "Step 3 of 4" moet weg

> Lees `src/app/dps/dps-client.tsx` en `src/components/add-bank-modal.tsx`.
>
> De belofte is "type je naam, krijg één trip". De realiteit zegt "Step 3 of
> 4". Die tegenstrijdigheid staat op de pagina zelf.
>
> Maak van de bank-intake één knop boven de inhoud, geen stap in een reeks.
> Verwijder de stapnummering overal waar hij nog staat. De speler mag altijd
> kijken; toevoegen is optioneel en verbetert het antwoord.
>
> Verander niets aan wat de bank-intake dóet — alleen hoe hij zich presenteert.
> Verifieer met `npm run ci:check`.

## C3. De twee monolieten

Alleen doen als er een concrete aanleiding is. Refactoren zonder reden is hier
duur vanwege regel 4.

> Lees `src/app/next/next-client.tsx` (5.817 regels) en
> `src/components/bank-result.tsx` (5.997 regels), plus
> `tests/module-boundaries.test.ts` en `tests/helpers/next-up-source.ts`.
>
> `src/lib/next-up.ts` is eerder deze maand van 3.877 naar 11 modules gegaan.
> Volg exact dat patroon:
> - de publieke interface blijft identiek, zodat geen enkele aanroep verandert
> - vlakke bestandsnamen met prefix (`next-client-*.tsx`), passend bij de
>   bestaande conventie
> - broncode-toetsende tests worden bestand-onafhankelijk gemaakt, niet
>   bijgewerkt — kopieer de aanpak van `tests/helpers/next-up-source.ts`
> - voeg een size-guard toe aan `tests/module-boundaries.test.ts`, per module
>   én totaal
>
> Splits per samenhangend blok, en draai `npm run ci:check` na **elke** stap.
> Niet alles in één keer. Verwacht dat er tests breken die niets met je
> wijziging te maken hebben; dat is de reden dat dit stap voor stap moet.

## C4. Mobiel

> Lees `docs/MOBILE-AUDIT.md`, `src/components/mobile-action-bar.tsx` en
> `src/app/globals.css`.
>
> OSRS heeft een grote mobiele spelersbasis, en dat is precies de speler die
> "wat doe ik nu" vraagt — in de trein, niet achter zijn pc.
>
> Loop `/next`, `/slayer` en `/dps` door op 375×812. Rapporteer eerst wat er
> stuk is voordat je iets verandert: overloop, te kleine raakdoelen, tekst die
> afkapt, de actiebalk die inhoud bedekt.
>
> Fix daarna alleen wat je gemeten hebt. Geen redesign. Verifieer met
> `npm run ci:check` en met screenshots op 375 breed.

---

## Wat je níet moet prompten

- **"Maak de UI mooier."** Zonder concreet gebrek levert dat willekeurige
  wijzigingen die je daarna niet kunt beoordelen.
- **Plugin-instellingen schrappen.** De release-gate eist dat
  `syncOnQuestComplete` op `false` staat; dat is een toezegging in je Plugin
  Hub-review. Hoort in een bewuste release met aangepaste PR-body.
- **Alle 48 auditbevindingen in één sessie.** De laag-categorie is grotendeels
  onderhoudsschuld zonder speler-impact. Laat die liggen tot ze in de weg
  zitten.
- **Refactoren zonder aanleiding.** Zie regel 4: het kost hier meer dan
  elders.

---

## Volgorde die ik zou aanhouden

1. **A1** — pure winst op je kernmetriek, geen risico.
2. **A2** — het laatste resterende misbruikpad.
3. **B1** — meten vóór je aan B2 of B3 begint.
4. **C1** — lost het lege gevoel én de SEO op, en is mechanisch werk.
5. **B2 of B3** — afhankelijk van wat B1 laat zien. Niet allebei tegelijk.

A3, A4, A5, C2, C3 en C4 zijn geen van alle urgent. Pak ze op wanneer ze je
in de weg zitten.
