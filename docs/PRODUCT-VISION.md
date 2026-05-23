# Scapestack — product-visie en honest assessment

_Schrijven, niet bouwen. Status: onderzoek, mei 2026._

Dit document is een eerlijke nulmeting. Het bevat geen feature-lijsten of code-plannen — die komen later, en alleen voor dingen die deze visie ondersteunen. Het doel is: begrijpen waar Scapestack staat, voor wie het is, en waar de echte mogelijkheden liggen.

---

## 1. Wat Scapestack vandaag is

**Vijf live tools** (mei 2026):

| Tool | Wat het doet | Waarde |
|---|---|---|
| Bank Organizer | Plak je bank → auto-gesorteerde RuneLite-tabs terug | Hoog wanneer het werkt |
| What to do now | RSN + bank → ranked aanbevelingen (goals/bosses/quests/diaries/minigames/money/skills) | Hoog — uniek |
| Goal Tracker | RSN + bank → 30+ untradeable goal-sets bijgehouden | Middel |
| DPS Calculator | Boss + bank → optimale setup en DPS | Middel — concurrentie |
| Hiscore Lookup | RSN → polished stats-kaart | Laag — concurrentie |

Plus twee "soon" (GP Tracker, GE Price Tracker) en drie "planned" (Quest Planner, Skill Planner, Diary Tracker).

**Wat is hier echt sterk?** De Bank Organizer + Goal Tracker + What-to-do-now zijn de **kern**. Ze vormen samen iets dat geen andere tool heeft: een geïntegreerd "wat heb ik / wat kan ik / wat zal ik doen" voor je hele account. De Hiscore-tool en DPS-calculator zijn afgeleiden — er bestaan al goede alternatieven (RuneScape Wiki DPS calc, Crystal Math Labs, Templeosrs).

**Eerlijke conclusie:** Scapestack is geen verzameling losse tools. Het is potentieel **één tool** die toevallig in vijf hokjes is opgedeeld.

---

## 2. Wie is de OSRS-speler die hier komt?

Niet één persoon. Tenminste drie scherp verschillende:

### A. De vastlopende mid-game (350-1800 total)
**Hun probleem:** Te veel te doen, geen idee waar te beginnen. Discord/Reddit/Wiki/YouTube hebben allemaal antwoorden maar *niet voor jouw account*. Open de bank, zie 300 items, denk "wat moet ik hiermee", sluit het spel.

**Wat ze willen horen:** "Doe NU dit. Daarna dit. Het kost ~X uur. Dit unlock je."

**Wat Scapestack hen al biedt:** /next hub. Maar de hub voelt nog als een lijst, niet als een **gids**.

### B. De PvMer (combat 100+, gerichte progressie)
**Hun probleem:** Optimaliseren. "Welke gear heb ik die ik niet gebruik?" "Welke boss past bij mijn DPS?" "Ben ik klaar voor CoX/ToB/ToA?"

**Wat ze willen horen:** "Met deze gear haal je X DPS op Vorkath. Upgrade Y → +12% DPS. Skip Z, slechte ROI."

**Wat Scapestack hen biedt:** DPS-tool — maar zonder upgrade-pad-context. De What-to-do-now suggereert bosses op CL-gate, niet op echte gear-readiness.

### C. De skiller / completionist (200/200, alle pets, alle music tracks)
**Hun probleem:** Lange, lange grinds. Burn-out. "Heb ik dit cape eigenlijk al?" "Wat mis ik nog?"

**Wat ze willen horen:** "Je bent 3 untradeables van CA Master. 47 muziek-tracks van Music Cape. 1 pet van Pet Cape."

**Wat Scapestack hen biedt:** Goal Tracker, maar gefocust op gear-sets, niet op de completionist-doelen (music, pets, varlamore, etc.).

---

## 3. Waarom komen mensen terug?

Op dit moment: **niet**. Eerlijk: er is geen reden. Je plakt je bank, krijgt tabs, klaar.

Wat zou wél een reden zijn? Drie mogelijkheden, eerlijk gewogen:

### Optie 1: Voortgang die meegaat
Je bank verandert per week. Plak hem nu en over een maand → "je hebt deze week 4 Vorkath kills gedaan, 2 dragon bones meer dan vorige week, je bent nu binnen 1 item van een set die je toen 4 items af was". Dit bestaat technisch al (snapshot history, score history in bank-result.tsx), maar het is **verborgen** en niet de hoofdervaring.

**Eerlijke risico**: dit vereist dat spelers terugkomen. Kip-en-ei.

### Optie 2: Eén ding per dag
Open Scapestack, krijg ÉÉN aanbeveling voor vandaag, met geschatte tijd. "Vandaag: Wintertodt — 12 KC voor pyromancer hat. ~45 min." Klein, behapbaar, vooral voor de mid-game burnout-speler.

**Eerlijke risico**: de Wiki-data ondersteunt dit, maar het vereist dat we de aanbeveling-engine "weet wat je gisteren deed" — opnieuw retentie-data.

### Optie 3: Sociaal
Vergelijk met vrienden. "Wij hebben allebei Bandos chest, jij hebt tassets, ik niet — laten we duo Bandos doen." Of: "Friends-leaderboard van goals voltooid deze maand."

**Eerlijke risico**: vereist accounts, vrienden-lijsten, gedeelde data. Schaal-uitdaging. Nu nog te vroeg.

**Mijn voorkeur, eerlijk gezegd**: **Optie 1 + 2 samen**. Voortgang die meegaat is de retentie-motor, één-ding-per-dag is de gewoonte-trigger. Beide bouwen op data die we al hebben.

---

## 4. Concurrentie — eerlijk

| Tool | Wat ze beter doen | Wat zij missen |
|---|---|---|
| **RuneLite plugins** | In-game integratie | Geen overzicht, geen advies |
| **Wiki** | Allesomvattend | Geen personalisatie, traag |
| **Templeosrs** | Tracking + leaderboards | Geen actie-advies, geen bank |
| **OSRSBox** | Item database | Geen account, geen tool |
| **Maximum efficiency / Theoatrix YouTube** | Optimal paths | Statisch, geen jouw-account |
| **r/2007scape** | Community antwoorden | Generiek, traag, geen continuïteit |

**De gap waar Scapestack in past**: gepersonaliseerd, web-based (geen RuneLite-install vereist), én actie-gericht (niet alleen tracking).

Dat is uniek. Maar het is nog niet *waardevol genoeg* om voor terug te komen. De Bank Organizer doet één klus en is klaar. Goal Tracker is een momentopname.

---

## 5. Waar verliezen we spelers nu?

Educated guess (zonder analytics):

1. **Lege intake-page**. Eerste indruk: "weer een tool die mijn data wil". Geen demo, geen "kijk wat je krijgt" tot ze daadwerkelijk plakken.
2. **Geen reden om RSN te geven**. Optioneel, en de waarde van wel-geven is niet duidelijk genoeg op het intake-scherm.
3. **Resultaat is statisch**. Eén keer kijken, niks bewaard, niks volgt op.
4. **Bank-organizer-resultaat overweldigt**. 9 tabs, knoppen, panelen — de gebruiker zegt "OK, nu wat?".
5. **/next hub levert lijst, geen verhaal**. 15 aanbevelingen is veel. Voor een burnout-speler is dat exact het probleem dat ze ontvluchten.

---

## 6. UX-principes voor een echte herziening

Als we ooit een UI-redesign doen, dan vanuit deze regels:

1. **Eén ding per scherm**. Niet "hier is je bank, hier zijn 7 secties". Wel "Hier is het belangrijkste. Klaar daarmee? Door naar het volgende."
2. **Default to verhaal, optie tot lijst**. De /next hub moet starten met "Vandaag: doe X. Want Y. Hierna: Z." Een knop "toon alle aanbevelingen" voor wie meer wil.
3. **Voortgang voelbaar maken**. Niet "Bandos set: 2/5", maar "Bandos set: 2/5 — laatste keer was het 1/5. +1 deze week."
4. **OSRS-natief, niet web-natief**. Sprites overal, lettertypes die bij OSRS passen, geen emoji's, geen Material Design. Dat is grotendeels al bereikt.
5. **Kleine, snelle ervaring**. Een speler die binnenkomt → 5 seconden → "ah, nu weet ik wat ik moet doen" → weg. Niet 30 panelen scrollen.

---

## 7. Wat ik denk dat de volgende stap zou moeten zijn

Eerlijk geadviseerd, niet wat ik nu graag zou bouwen:

**Stap 0: Bank Organizer fixen.** Punt. Welke layout/volgorde-bug er ook is, die fix is meer waard dan welke nieuwe feature ook. De rest van de site is niets als de kern niet werkt.

**Stap 1: Snapshot-flow zichtbaar maken.** Voortgang-vergelijking bestaat al in de code (snapshot-history.ts, diff.ts), maar het is een randverhaal. Maak het de hoofdervaring: "plak je bank elke maandag, zie hoe je groeide".

**Stap 2: Daily focus in /next.** Top-1 aanbeveling met "vandaag", de rest collapsable. Stilte boven ruis.

**Stap 3: Stop met nieuwe tools toe te voegen tot Stap 1-2 staat.** GP Tracker, GE Price, Quest Planner — afblijven. Andere tools doen dit al goed. Verdiep in plaats van verbreed.

---

## 8. Wat ik *niet* zou bouwen — eerlijk

- **Een eigen GE Price Tracker.** OSRS Wiki Prices doet dit. Geen meerwaarde.
- **Eigen Skill Planner.** OSRS Wiki Calculators doet dit. Geen meerwaarde.
- **Sociale features.** Te vroeg, schaal-pijn, weinig retentie-bewijs.
- **Discord-bot integratie.** Lijkt cool, kost veel onderhoud, niche.
- **AI-chat assistent.** Klinkt sexy, voegt niks toe dat de huidige rule-based engine niet beter doet.

---

## Samenvatting in één zin

> Scapestack is geen verzameling tools — het is een geïntegreerd
> "wat heb je, wat kan je, wat zal je doen" voor één OSRS-account.
> De retentie zit in voortgang die meegaat. Eerst de kern fixen,
> dan voortgang als hoofdverhaal, dan pas meer.
