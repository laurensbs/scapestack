# Scapestack — masterprompt: één product van losse tools maken

> Geschreven 28 juli 2026. Elk getal hieronder is die dag gemeten, niet onthouden.
> Waar een bron ontbreekt, staat het er niet. Geef dit hele bestand aan Codex.

---

## 0. De opdracht in één zin

Scapestack heeft zes bestemmingen, vier eigen invoerschermen en twee accountpagina's.
Het moet **één URL per speler** worden waar de bank het ruggenmerg is en elke andere
vraag een sectie is. Bouw dat, met de data die al binnenkomt.

---

## 1. Harde randvoorwaarden — hier niet van afwijken

| | |
|---|---|
| Git dir | `.repo-git`, niet `.git`. Elk commando: `git --git-dir=.repo-git --work-tree=.` |
| De poort | `npm run ci:check` — typecheck, 1637 tests, smoke, `audit:next`, `audit:controller`, `plugin:release-check`, build. Rood = niet klaar. |
| Plugin-suite | `cd plugin && ./gradlew test --offline` |
| SSR/caching/rendering | Alleen waar op `npm run build` + `next start`. De dev-server liegt. Dit is drie keer als feit geshipt en drie keer fout gebleken. |
| Plugin-release | De Plugin Hub bouwt **één onherroepelijke commit** en kan niet terugrollen. De server moet een nieuwe contractversie eerst op productie accepteren, geverifieerd, vóór enige plugin die verstuurt. Alles batcht in één release. Indienen doet Laurens, niet jij. |
| Stem | Geen AI-taal. Verboden: *seamless, powerful, effortless, elevate, empower, intuitive, robust, streamline, transform, journey, ultimate, unleash* — plus *vibe* en *session*. Het woord voor een trip is **trip**. Droog, tweede persoon, gekwantificeerd. Reken in ticks, trips, KC en veelvouden van drop rate — nooit in "hours saved". |
| Eén schaal per betekenis | `--color-good`/`--color-warning` zijn byte-identiek (#FF981F) en `--color-danger`/`--color-bad` ook. Nooit tussen twee daarvan vertakken — `tests/one-scale-per-meaning.test.ts` faalt erop. Elk oordeel gaat via `.scape-verdict[data-gate="ready\|test\|blocked"]`, de negenstaps gate-ramp. |
| Accentbudget | Drie plekken per scherm: woordmerk, dé primaire actie, links/actieve tab. Sectielabels zijn stil grijs. Een guard telt dit. |

---

## 2. De cijfers die alles bepalen

**De plugin is aan het krimpen.** Gemeten tegen `api.runelite.net/pluginhub`:

| plugin | installs | plek |
|---|---|---|
| **scapestack-sync** | **7** — was 12 twee dagen eerder | **2242 / 2403** |
| quest-helper | 583.710 | 1 |
| wikisync | 320.601 | 7 |
| inventory-setups | 226.125 | 24 |
| runeprofile | 88.547 | 80 |
| wom-utils | 80.568 | 90 |
| hub-mediaan | 1.017 | — |

Zeven. Netto **negatief**: mensen hebben hem geïnstalleerd en wéér verwijderd. Elk
ontwerp dat aanneemt dat de plugin er is, faalt voor 2.396 van de 2.403 plugins.

**Waarom die krimp geen mysterie is.** RuneLite hangt een waarschuwing aan de plugin
("submits your IP address and comprehensive account data to a 3rd-party server not
controlled or verified by RuneLite developers"). Plugins met waarschuwing hebben een
mediaan van ~149 installs tegen ~1.686 zonder. En het paneel dat je krijgt na
installeren toont vier kaarten: sync-status, browser koppelen, wat er gesynct wordt,
probleemoplossing. Vier kaarten leidingwerk. Niemand installeert een plugin om te
horen dat hij werkt.

**Jagex doet de kernvraag zelf al, in de client.** De Activity Adviser staat sinds
8 september 2022 in het spel en beveelt activiteiten aan op basis van stats en
questvoortgang. Het wiki-artikel over Animal Magnetism in die tabel zegt: "Learn how
to equip Ava's ranged devices." Dat is inhoudelijk wat `/next` een 200m-account
aanraadde.

---

## 3. Wat er nu staat — geïnventariseerd

### Werkt en is geverifieerd

- **Wiki-feiten via de Bucket-API.** `npm run wiki:sync` haalt 3.234 monsters, 5.698
  uitrustingsrijen, 16.527 item-id's en alle 227 quests op. `npm run wiki:check`
  bevraagt live opnieuw en faalt bij afwijking. `src/lib/bosses.ts` typt geen getallen
  meer — HP, defensie, magic level, `size` en `attributes` komen uit de projectie.
  Dit repareerde 232 verschillen over 48 van 59 bazen (Callisto 470→1000, Araxxor
  460→1020, Hueycoatl 700→2500).
- **Live GE-prijzen** via `prices.runescape.wiki/api/v1/osrs/{latest,mapping}`. CORS
  staat open — de browser haalt ze zelf op, dus een geplakte bank hoeft de server nooit
  op. Aanwezigheid in `mapping` **ís** verhandelbaarheid.
- **De bank-affordability-engine** (`src/lib/bank-affordability.ts`). Prijst het *gat*
  in een set tegen de coins in de bank. Live: *"14.500.000 gp banked. Ahrim's
  robeskirt — 1.572.490 gp. That finishes Ahrim's set."* Weigert te prijzen als er iets
  onverhandelbaars in het gat zit, als de feed plat ligt, of voor een account dat niet
  kan kopen.
- **Zekerheidsnotatie.** `decisionConfidence()` leidt uit `provenance` af: `measured`
  (bank/RuneLite), `likely` (alleen Hiscores), `guess` (niets). De eyebrow zegt "Do
  this first" / "Best fit for your levels" / "Best guess".
- **De terugkeer-lus, half.** Elke plugin-sync verzoent het geaccepteerde stoppunt met
  de nieuwe snapshot (`recommendation-outcome.ts`) en slaat een verdict op.
  `LastTripLine` toont het nu boven het plan: *"Push Vardorvis to 50 KC. KC 47 of 50."*
- **Bankleks dicht.** `/next` en `/quests/[slug]` redigeren nu vóór het plannen in
  plaats van erna.

### Bestaat, maar werkt niet

| | |
|---|---|
| `next-up-quests.ts:58` | `if (completedQuestNames?.has(...)) continue;` — zonder plugin is die set `undefined`, dus wordt **geen enkele quest overgeslagen**. Elke quest in het spel leest als niet-gedaan. Dit is waarom Lynx Titan (200m XP in elk skill) te horen kreeg: "Finish Skill capes" en "Get Ava's device". |
| `recommendation-decision.ts:357` | `"This best matches your visible account progress"` — de laatste case, de zin die verschijnt als er géén feit te noemen is. De zelfverzekerdste regel op de pagina is de regel die betekent "ik weet niets". |
| `PLANNING_SOURCE_DEADLINES_MS.hiscores` | 900 ms. Jagex' `index_lite.json` meet 400–720 ms van een woonlijn; wij draaien via gedeelde Vercel-egress. Een timeout geeft dezelfde `null` als een echte 404, en `loadPlanningContext(...).catch(() => null)` rendert dan de demo-fixture onder de echte naam. |
| `next-client.tsx` | **238 KB, 45 secties/regio's** in één bestand |
| Mood × tijd | **8 stemmingen × 4 tijdsbudgetten** als stuurwerk náást het antwoord — configuratie vóór het antwoord |
| Twee accountpagina's | `/next?rsn=` én `/u/[rsn]`, allebei renderen de identiteit, allebei half |
| Vier intakes | `/bank`, `/dps`, `/goals` hebben elk hun eigen invoerscherm |
| Farming-timers | De plugin leest RuneLite's Time Tracking-store en schrijft `readyAt` naar Postgres. **De planner leest het nooit** — enige consument is de diagnostiek |
| Ironman | `bank-affordability-panel` ondersteunt `cannotBuy` en het is getest, maar niet aangesloten: op `/bank` bestaat geen betrouwbaar accounttype-signaal. Nu ziet een Ironman "Buy now" naast een Karil's leatherskirt |

### Al gesloopt (niet terugbouwen)

Zes spookroutes (`/gp`, `/ge`, `/quests`, `/skills`, `/diary`, `/hiscore`) — nu 308's
uit `next.config.ts`, geen route-componenten. De **Stack Score** (30% rijkdom op log-schaal,
25% aantal items, 20% miljoen-gp-slots — driekwart mat bankgrootte). Het verzonnen plan
op de niet-gevonden-pagina. Het perkament-frame. Twaalf dode kleur-ternaries.

---

## 4. Waarom spelers niet terugkomen

Vier redenen, in volgorde van hoe hard ze zijn.

1. **Het product staat op het verkeerde scherm.** Zeven installs tegen Quest Helper's
   583.710. Quest Helper beantwoordt "wat nu" als de volgende klik, ín de client. Ons
   antwoord kost een alt-tab, een getypte naam en een wachttijd — precies op het moment
   dat de speler al vastgelopen bij zijn bank staat. En in PR #12536 is aan de
   RuneLite-reviewers verteld dat in-client aanbevelingen er **bewust** uit zijn
   gelaten. Dat is geen regel. Dat is het weggeven van het waardevolste oppervlak.

2. **Het produceert niets dat je aan iemand kunt laten zien.** Elk duurzaam OSRS-tool
   maakt een sociaal object: WOM rendert een rang op iemand anders' client en zijn
   groepspagina's laten clanofficieren zien wie er niet meedoet; RuneProfile maakt een
   deelbare kaart (88.547 installs — het enige tool boven 10.000 in de
   waarschuwingscohort). "Wat moet ik vanavond doen" is privé van constructie, en dat is
   de slechtst mogelijke vorm voor mond-tot-mondgroei.

3. **Het concurreert op de as van de wiki, met de data van de wiki.** Elk databestand
   komt van `oldschool.runescape.wiki` of `prices.runescape.wiki`. Je kunt je upstream
   niet overtreffen: 17 geldmethodes tegen een sorteerbare tabel van 485 rijen; 59 bazen
   tegen een wiki-DPS-calculator met 2.853 monstervarianten, hitverdelingen, TTK-grafieken
   en live gear-import uit de draaiende client.

4. **Het kan niet zeggen dat het iets niet weet — en gokt dan.** Zie §3. Elke tester
   betrapte het in de eerste alinea. Een 200m-Herblore-account kreeg Druidic Ritual
   met score 96/100 omdat Shilo Village als onafgerond las.

**En de enige echte terugkeerreden was al ingebouwd en werd nooit getoond.** De
outcome-reconciliatie draaide bij elke sync, de verdicts stonden in `outcome_match`, en
de plan-pagina begroette een terugkerende speler met exact dezelfde "DO THIS FIRST" of
hij zijn doel gehaald had of nooit van de bank was geweest. Dat is gerepareerd
(`LastTripLine`), maar het moet naar het paneel ín het spel.

---

## 5. De API's — wat werkt, met werkende queries

### OSRS Wiki Bucket (Weird Gloop) — géén sleutel, géén auth

Cargo en SMW zijn **uit** op deze wiki. Bucket werkt:

```
https://oldschool.runescape.wiki/api.php?action=bucket&format=json
  &query=bucket('infobox_monster').select('page_name','hitpoints','attribute','size')
         .where('page_name','Vorkath').run()
```

DSL: `bucket('x').select('a','b').where('f','>',n).limit(500).offset(0).run()`.
Namen kleingeletterd, spaties worden underscores. Paging is offset-based.
User-Agent meesturen. **47 tabellen.** Wij gebruiken er vier.

**Wat we al gebruiken:** `infobox_monster`, `infobox_bonuses`, `infobox_item`, `quest`.

**Wat er nog ligt en het product één geheel maakt:**

| tabel | waarom het alles verbindt |
|---|---|
| `money_making_guide` | De 485-rijen-tabel van de wiki. Join met bank + levels + prijzen → *"van 485 methodes kun je er nu 12 beginnen met wat er in je bank ligt"*. De wiki kán dat niet — hij weet niet wat jij hebt |
| `recommended_equipment` | De eigen gear-aanbeveling van de wiki per baas. Join met de bank → *"de wiki raadt X aan; jij hebt 4 van de 6"* |
| `combat_achievement` | CA-taken; `Golf 1` bouwde dit met de hand |
| `collection_log_source` | Wat dropt wat. Join met wat je bezit → welke baas je clog-slot oplevert |
| `dropsline` + `drop_table_sources` | Droprates; nu 113 KB handmatig JSON |
| `varbit` | Voor de plugin |
| `quest.official_length` | Letterlijk het antwoord op "past dit in mijn 60 minuten", dat we nu gokken |
| `quest.ironman_concerns` | Het Ironman-gat dat elk tool heeft |
| `quest.start_point` | Onze "START"-regel, door de wiki geschreven in plaats van door ons |

### Prijzen — `prices.runescape.wiki/api/v1/osrs`

`/latest` en `/mapping`. CORS open, geverifieerd vanuit de pagina. `mapping` = de
verhandelbare wereld; aanwezigheid erin is verhandelbaarheid. Insta-buy-kant (`high`)
citeren, want dat is wat een speler vanavond betaalt.

### Wat we nog niet aanraken

- **WOM-API** (`api.wiseoldman.net`) — gains, records, groepen, competities.
  Dependency én concurrent. Wij lezen alleen `lastChangedAt`.
- **Hiscores** `index_lite.json` — 900 ms deadline is te krap, zie §3.
- **RuneLite Time Tracking** — de plugin leest het, de planner niet.

---

## 6. Waar het heen moet — de architectuur

### Eén URL is het product

Wise Old Man heeft geen dashboard-probleem omdat er níéts naast de spelerpagina bestaat.
`/players/lynx-titan` is één URL waar alles over het account leeft, onder tabs die nooit
opnieuw vragen wie je bent. Identiteit als kopregel met "Last updated 27 minutes ago"
stil ernaast. Vijf gelijke cijferdozen zonder kleuroordeel. Eén dichte tabel die de
pagina vult. Eén accent (blauw) op drie plekken.

**Bouw `/p/[rsn]`.** Van boven naar beneden:

| blok | inhoud | bestaat al als |
|---|---|---|
| Kop | naam · accounttype · "synced 18 min ago" · één knop (Sync) | `/u/[rsn]` identiteit |
| Vorige trip | "Je zei 50 KC. Je staat op 47." — alleen bij terugkeer | `LastTripLine` |
| **Het antwoord** | Doe dit eerst — Start/Bring/Stop-tabel, één actie, zekerheids-eyebrow | `/next` hero |
| Not this? | drie alternatieven als rijen | `/next` alternatieventabel |
| Je bank | "14,5m banked. Robeskirt — 1,57m. Dat maakt Ahrim's af." | affordability-paneel |
| Tabs | Plan · Bank · Bosses · Slayer — **zelfde URL, nooit een nieuwe intake** | de vier losse tools |
| Account | Skill/Level/XP/Rank-tabel | `/u/[rsn]` tabel |

`/next?rsn=` en `/u/[rsn]` worden redirects hierheen. **Elk blok bestaat al** — dit is
samentrekken, niet bijbouwen.

### De bank is het ruggenmerg, niet een tool

Nu heeft elke tool zijn eigen intake. Als de bank één keer op de spelerpagina staat,
is er geen `/dps`, `/goals` of `/slayer` meer — er zijn vier **vragen over één bank**:

- *Bosses* — welke bazen kan deze bank doden (bestaat: `boss-viability`)
- *Sets* — wat kan deze bank afmaken (bestaat: `bank-affordability`)
- *Task* — wat is de huidige Slayer-taak (bestaat: `/slayer`)
- *Money* — welke van de 485 wiki-methodes kun je nu starten (**nieuw**, §7)

### Regels van de grammatica

1. Configuratie **nooit** vóór het antwoord. Mood en tijd zijn geen vragen vooraf; het
   standaardantwoord komt direct, "Not this?" stuurt daarna bij.
2. Status hoort in de kopregel. "Synced 18 min ago" naast de naam — nooit als oranje
   regel in de layout.
3. Een metriek is nooit een kop. "+18k XP" is een tabelcel.
4. Eén radius, één paneeltint, één tabelvorm. Nooit kaart-in-kaart.
5. Als het antwoord een tweede tab nodig heeft, is het mislukt.

---

## 7. Creatieve ideeën — concreet, niet vaag

### 7.1 De bank over tijd — het enige dat niemand kan

De plugin synct de bank elke sessie. Eén snapshot vertelt wat je hebt; een **reeks**
vertelt wat je *doet*. `sync_snapshot` en `account-snapshot-delta.ts` bestaan al.

- *"Je hebt 8.000 Zulrah-scales, drie weken onaangeroerd. Dat is een blowpipe die je
  niet gemaakt hebt."* — dode voorraad
- *"Je Ranarr-stock zakte 400 sinds dinsdag."* — je doet je herb-runs echt
- *"Deze 40 items zijn 12% in prijs gestegen terwijl je weg was: 2,1m."* — terugkeerder
- *"Je hebt vier keer op rij supplies voor Vorkath gekocht en nul KC gemaakt."*

Niet één hiervan kan de wiki, WOM, TempleOSRS, WikiSync of Jagex' Activity Adviser
zeggen. Een bank is veranderlijke account-state; de wiki is een documentenverzameling.
**Dit is het moeras van het moeras.** Bouw dit vóór welke UI-verfijning dan ook.

### 7.2 De geldgids van de wiki, persoonlijk gemaakt

`money_making_guide` heeft ~485 rijen met eisen. Join met levels + bank + live prijzen:

> **Van 485 geldmethodes kun je er nu 12 beginnen.** Geen inkoop nodig.
> Zulrah — 3,4m/u — je hebt blowpipe, darts, antivenom+. Ontbreekt: niets.

De wiki heeft de content en kan hem niet filteren op *jou*. Wij kunnen dat en doen het
niet. Dit is het scherpste "één geheel"-argument in het hele product.

### 7.3 "Niets" is een geldig antwoord

De gemeenschap gebruikt *efficiencyscape* als scheldwoord. Het meest gestemde tool van
deze vorm op r/2007scape kreeg als **meest gevraagde functie: de suggesties van de maker
kunnen wegklikken**. Bouw:

- *"Je bent 3 KC van je vorige stoppunt. Maak dat af, verder niets."*
- *"Niets urgents. Doe waar je zin in hebt — dit staat er morgen nog."*
- Een **Verberg**-knop op elke rij, die blijft plakken.

Een tool dat toestemming geeft, wordt vertrouwd. Een tool dat altijd een opdracht heeft,
wordt een baas.

### 7.4 De plugin wordt het product

Zie §8. Kortste versie: het paneel toont het antwoord, niet de sync-status.

### 7.5 Eén deelbaar object

RuneProfile is het enige tool boven 10.000 installs in de waarschuwingscohort, en het
maakt een **deelbare kaart**. Ons enige deelbare artefact zou moeten zijn: *"Wat mijn
bank vanavond kan afmaken"* — een OG-image met de affordability-tabel. Dat is een
plaatje dat een speler in zijn clan-Discord plakt en dat niemand anders kan maken.

---

## 8. De RuneLite-plugin — wat er moet veranderen

### Wat er nu is

`ScapestackSyncPanel.java`, 431 regels, vier kaarten: `syncCard()`,
`connectBrowserCard()`, `whatSyncsCard()`, `troubleshootingCard()`. Er is een
`setNextAction`-rij, en die zegt dingen als "Press Sync now". Alles leidingwerk.

Twee dingen zijn al gerepareerd, ongepubliceerd: de chatregel
`"Scapestack is syncing your progress..."` vuurde vóór élke sync met een scheduler op
15 minuten en `chatFeedback` standaard aan — ~16 gameberichten per avond over een
achtergrondverzoek, in de chatbox waar je op drops let. Nu alleen bij handmatig syncen.

### Wat het moet worden

**Het paneel toont het antwoord.** Op `PluginPanel.PANEL_WIDTH = 225px`:

```
NU
Vorkath
Blowpipe + dragon darts liggen in je bank.

Stop bij      20 kills
Nu            7 / 20
Nog           ~34 min

herbs klaar over 12 min · birdhouses klaar

[ Iets anders ]
```

De farming-timers staan daar wél in beeld; nu leest de planner ze nooit.

**Wat er verder moet:**

1. **Zeg iets als de bank opengaat.** De plugin is het enige dat de bank live ziet. Op
   het moment dat een speler zijn bank opent: *"Robeskirt kost 1,57m. Je hebt 14,5m.
   Dat maakt Ahrim's af."* Dat is in-client waarde zonder website.
2. **Verdien de waarschuwing weg.** De "Turn everything on"-knop flipt vier
   instellingen in één klik, inclusief bankverzending — dat is wat een Hub-reviewer als
   dark pattern leest en het is waarom de waarschuwing terecht is. Vervang door één
   "Sync on login". Lees de contributieregels van `runelite/plugin-hub` en werk uit
   welke velden de waarschuwing triggeren; als minder versturen hem weghaalt, is dat
   ~10× installs waard.
3. **De kleinste versie die het waard is zonder website.** Antwoord die vraag expliciet.
   Als het antwoord "geen" is, is de plugin het probleem.
4. **Contract:** markeer per voorstel of het een contractbump nodig heeft. Kandidaat
   `0.4.0` / contract 4 ligt klaar en is bewust niet ingediend.

---

## 9. Faalpatronen die deze repo al betaald heeft

Lees dit als een lijst dingen die je niet hoeft te herontdekken.

1. **Een guard die niet kan falen, is geen guard.** Vijf keer voorgekomen. Het patroon
   is altijd `expect(source).toContain("een string")`: dat pint de implementatie vast
   in plaats van het gedrag. Vier van die guards beschermden juist het defect —
   één pinde `"Start here"`, de eyebrow van de **verzonnen** resultaatkaart.
   **Regel: na elke nieuwe guard, saboteer het ding dat hij beschermt en kijk of hij
   rood wordt.** Herstel daarna en check `git status`.
2. **Een holle fixture is net zo erg.** Mijn eigen leak-guard slaagde twee keer voor
   niets: `bankStatus` was een string in plaats van een `PluginBankStatus`-object, en
   daarna was `capturedAt` epoch en dus verlopen — beide keren kwam de bank nooit in de
   planner en testte de assertie een leeg plan.
3. **Verifieer tegen iets dat een negatief kan opleveren.** Een deploy-check die op
   HTTP 200 polt keurt de vorige build goed. Een lek-check tegen een niet-bestaand
   account bewijst niets. Een database-check met een verse rij raakt `ON CONFLICT` nooit.
4. **Een dode agent leest exact als "niets gevonden".** Bij elke fan-out: controleer op
   gestorven agents voor je "0 bevindingen" gelooft. In deze sessie stierf de
   skiller/pure-archetype-agent — **dat accounttype is nog niet geanalyseerd**.
5. **Verzin geen heuristiek in code die met heuristieken moet stoppen.** Mijn
   versiekeuze was "pak de rij met de meeste hitpoints"; die koos *Awakened* Vardorvis
   (1400 hp, combat 1136). De wiki markeert zijn eigen `default_version`.
6. **De browser-pane kan `visibilityState: "hidden"` melden** en een React streaming
   reveal heeft dan niet geverfd. Een DOM-query vindt niets en dat leest als een kapotte
   pagina. Wacht op de inhoud, niet op het load-event.
7. **Een migratie die een nieuwe kolom leest, vult hem in dezelfde commit.**

---

## 10. Volgorde van werk

1. **De spelerpagina** op `/p/[rsn]`, uit de bestaande blokken. `/next?rsn=` en
   `/u/[rsn]` worden redirects. Doe dit als één geheel — een half gebouwde derde
   accountpagina verdrievoudigt het probleem.
2. **`next-up-quests.ts:58`.** Zonder plugin mag een quest niet als "niet gedaan"
   gelden. Maak van het gat een **vraag** ("Heb je Dragon Slayer II gedaan?" ja/nee, en
   bewaar het antwoord) — dat is tegelijk de onboarding die de plugin nu moet zijn.
   Verwijder `recommendation-decision.ts:357` en vervang hem niet.
3. **Mood en tijd achteraf.** Default antwoordt direct; bijsturen na het antwoord.
4. **Bank-over-tijd** (§7.1) — het echte moeras.
5. **Geldgids-join** (§7.2) — de scherpste "één geheel".
6. **Tools worden tabs.** `/dps`, `/slayer`, `/goals` renderen binnen de
   spelerpagina-schil; alleen `/bank` houdt een paste-intake voor wie zonder naam komt.
7. **Homepage terugsnoeien** tot één zin + één invoer. Bekende accounts gaan direct
   naar hun pagina.
8. **Plugin-batch** (§8) — bouwen, niet indienen.

---

## 11. Klaar is

- `npm run ci:check` groen, en `cd plugin && ./gradlew test --offline` groen.
- Elke nieuwe guard is bewijsbaar rood te krijgen — laat zien hoe.
- Eén URL per speler. Nul routes die om een naam vragen die de site al heeft.
- Geen enkele bewering die de data niet draagt. Waar we het niet weten, staat dat er,
  en is het een vraag in plaats van een gok.
- Het accent staat op maximaal drie plekken per scherm.
- Geen enkel getal in `src/lib` dat de wiki ook heeft.

---

## 12. Bronnen

- `api.runelite.net/pluginhub` — installatiecijfers, 28 juli 2026
- `oldschool.runescape.wiki/api.php?action=bucket` — 47 tabellen, live getest
- `prices.runescape.wiki/api/v1/osrs/{latest,mapping}` — CORS geverifieerd
- `wiseoldman.net` + `/players/lynx-titan` — schermen bekeken 28 juli 2026
- `runelite.net/plugin-hub`, `github.com/runelite/plugin-hub` — regels en cohorten
- [OS League Tools](https://www.osleague.tools/) — de vorm die op r/2007scape werkte;
  meest gevraagde functie was *Hide*
- [Wise Old Man](https://wiseoldman.net/) — open source, de spelerpagina-architectuur
- [OSRSTools.net](https://www.osrstools.net/tools), [OSRS Toolkit](https://osrstoolkit.com/),
  [CalcOSRS](https://calcosrs.com/tools/) — de calculator-laag waar je niet mee moet concurreren
- Repo-metingen: `next-client.tsx` (238 KB / 45 secties), `mood.ts` (8×4),
  intakes per route, accent-telling over `src/`
