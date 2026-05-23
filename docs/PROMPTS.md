# Prompts — kopieer-en-plak voor toekomstige sessies

_Geen wishlist. Geschreven om de strategie uit STRATEGY.md uitvoerbaar te
maken. Elke prompt is concreet, eenduidig, en geeft Claude exact genoeg
context om niet te raden._

Lees STRATEGY.md voordat je een prompt hieronder kiest. Volgorde van de
secties matcht de werkbalk in dat document.

---

## Fase 1 — Homepage opnieuw uitlijnen rond `/next`

### Prompt 1.1 — Hero omdraaien

> Lees `src/app/page.tsx` en `docs/STRATEGY.md`. De huidige hero stuurt
> bezoekers naar `/bank?sample=1`. Volgens de strategie moet `/next` de
> primaire actie worden, niet de bank organizer.
>
> Doe drie dingen:
> 1. Verander de primaire hero-knop naar **"What should I do next?"** met
>    link naar `/next`. De huidige primaire-knop ("See it with a sample
>    bank") wordt secundair (ghost-style) en blijft linken naar
>    `/bank?sample=1`.
> 2. Herschrijf de subhead onder de h1 zodat hij `/next` als kern
>    beschrijft, niet de bank organizer. Maximaal 2 zinnen, geen jargon.
> 3. De BankPreview hero-illustratie blijft staan — een
>    georganiseerde bank is nog steeds een goede visual demo. Vervang
>    GEEN andere copy, GEEN andere visuals, GEEN andere knoppen.
>
> Verifieer met `npx tsc --noEmit`, `npm test`, en `npm run build`.
> Commit met een korte, eerlijke boodschap. Push.

### Prompt 1.2 — Tool-cards schrappen + secundair maken

> Lees `src/app/page.tsx`, `src/lib/tools.ts` en `docs/STRATEGY.md`. De
> homepage toont nu 9 tool-cards. Strategie schrapt GP Tracker en GE
> Price Tracker, en degradeert Bank/Goals/DPS/Hiscore tot secundaire
> tools onder de hoofdactie.
>
> Doe vier dingen:
> 1. Verwijder GP Tracker en GE Price Tracker uit `TOOLS` in
>    `src/lib/tools.ts`. De `/gp` en `/ge` routes blijven bestaan
>    (geen 404), maar verdwijnen van de homepage.
> 2. Op de homepage: hernoem de "Live tools" sectie-header naar
>    "More tools" en maak hem kleiner. Hij staat ondergeschikt aan
>    de hero.
> 3. Verplaats `/next` uit "Live tools" — die staat al primair in de
>    hero, niet ook nog in een card-grid.
> 4. Verwijder de hele "Roadmap" sectie (plannedTools-blok). Quest /
>    Skill / Diary Tracker zijn geen aparte tools meer per strategie.
>
> Geen visuele redesign. Alleen schrappen en herrangschikken. Verifieer
> met typecheck, tests, build. Commit en push.

---

## Fase 2 — `/next` lege-staat fixen

### Prompt 2.1 — Lege-staat audit

> Open `src/app/next/next-client.tsx` en bekijk wat een bezoeker ziet
> die op `/next` belandt zonder bank en zonder RSN — dus de eerste
> render, voor `run()` ooit is aangeroepen. Beschrijf in 6 zinnen wat
> die bezoeker ziet en wat onduidelijk is voor iemand zonder context.
>
> Bouw nog niets. Alleen analyse. Eindig met "de drie concrete dingen
> die ik zou veranderen, zonder volgorde". Stop daar.

### Prompt 2.2 — Lege-staat actie

> Lees je eigen analyse uit prompt 2.1 (zit in chat-context of in
> `docs/EMPTY-STATE-NOTES.md` als je hem opgeschreven hebt). Implementeer
> de drie veranderingen die je voorstelde. Beperk je tot 1 bestand
> (`next-client.tsx`) tenzij absoluut noodzakelijk. Geen scope-uitbreiding.
>
> Verifieer met typecheck, tests, build. Commit per atomic change als
> dat zinvol is, anders één commit. Push.

---

## Fase 3 — `/returning` bouwen

> ⚠ **Volgorde-noot**: pas oppakken na Fase 5 (Save bank) en Fase 6
> (Visual rebrand). Een nieuwe acquisitie-pagina zonder retentie-fix
> en zonder visuele identiteit verspilt het verkeer dat erop landt.

### Prompt 3.1 — Wiki update-feed POC

> Doel: een script dat OSRS Wiki update-aankondigingen ophaalt en per
> update extract: datum, titel, korte beschrijving, "raakt-skills" tags
> (welke skills de update toevoegt/verandert) en "raakt-items" tags
> (welke nieuwe items).
>
> Stappen:
> 1. Probeer met `curl` of `fetch` de OSRS Wiki MediaWiki API met
>    `action=query&list=categorymembers&cmtitle=Category:Updates` — dump
>    de eerste 10 titels.
> 2. Voor 3 willekeurige updates uit die lijst: bekijk hun wikitext
>    (`action=parse&prop=wikitext`) en kijk of er een herkenbaar patroon
>    is voor datum / skills / items.
> 3. Schrijf NIETS productiewaardig. Dit is research. Eindig met een
>    document `docs/UPDATE-FEED-RESEARCH.md` waarin staat: (a) is de
>    pijplijn haalbaar, (b) welk pattern volg je, (c) inschatting in
>    sessie-aantallen.
>
> Stop bij het document. Vraag toestemming voor de echte build voordat
> je verder gaat.

### Prompt 3.2 — `/returning` route bouwen

> _Alleen uitvoeren NA prompt 3.1 en NA bevestiging van Laurens dat de
> pijplijn haalbaar is._
>
> Bouw de `/returning` route:
> 1. Een nieuwe pagina `src/app/returning/page.tsx` met intake: "wanneer
>    was je voor het laatst actief?" (een date picker of een drop-down
>    met 1 jaar / 2 jaar / 3 jaar / 5 jaar geleden), plus RSN-veld
>    (optioneel maar aangeraden).
> 2. Een server action die `data/updates.json` (uit prompt 3.1) leest,
>    filtert op datum, en uit de Hiscores/bank inschat welke updates
>    de speler raken.
> 3. Output: max 5 "this changed since you left"-cards, met sprite,
>    titel, één-zin uitleg, en "interesseert dit jou?"-indicator.
>
> Registreer de tool in `src/lib/tools.ts`. Voeg een link toe vanaf de
> homepage hero, naast de primaire `/next`-knop.
>
> Verifieer met typecheck, tests, build. Push.

---

## Fase 4 — Bank Organizer als data-pijplijn herframen

### Prompt 4.1 — Post-organize "ga naar /next"-flow

> Lees `src/components/bank-result.tsx` en `docs/STRATEGY.md`. Na het
> plakken van een bank ziet de speler nu de georganiseerde tabs en een
> "Copy to RuneLite"-actie. Strategie zegt dat de bank-organizer een
> data-leverancier voor `/next` is — dus na organize moet er een
> duidelijke vervolgactie naar `/next` zijn.
>
> Doe twee dingen:
> 1. Voeg in de header van `BankResult` (rechtsboven, naast "Copy to
>    RuneLite") een **secundaire knop** "What should I do next?" toe.
>    Hij linkt naar `/next` en geeft via een query-param (?from=bank)
>    door dat de speler net een bank heeft geplakt.
> 2. `/next` herkent `?from=bank` en toont bovenaan een banner "We
>    gebruiken je net-geplakte bank — geen RSN nodig." Eén regel.
>
> Verifieer met typecheck, tests, build. Push.

---

## Fase 5 — "Save my bank" — de #1 retentie-fix

Plakken bij elke bezoek is de grootste friction die overblijft. Een
returning speler die elke maand komt kijken hoort niet elke maand z'n
banktags-string te zoeken. Drie sub-prompts: ontwerp, opslag, UI.

### Prompt 5.1 — Ontwerpkeuze opschrijven (geen code)

> Lees `docs/STRATEGY.md` en `src/lib/snapshot-history.ts`. We willen
> dat een speler z'n bank kan **opslaan** zodat hij bij latere bezoeken
> niet opnieuw hoeft te plakken. Schrijf `docs/SAVE-BANK-DESIGN.md`
> waarin staat:
>
> 1. **Waar slaan we op?** Drie opties met voor/nadelen:
>    - localStorage (browser-only, simpel, geen account)
>    - URL-gedeelde snapshot-code (zoals /bank/share/[code] al doet —
>      kan dit uitbreiden tot een persistente "mijn bank"-code?)
>    - Account-gebaseerd (vereist auth → in STRATEGY.md uitgesloten)
> 2. **Wat slaan we op?** Alleen de banktags-string? Of ook organisatie-
>    voorkeuren (sort, density, tab-volgorde, pins)? Of een volledige
>    OrganizeResult?
> 3. **Hoeveel banks?** Eén "huidige" bank, of meerdere named slots
>    ("main bank", "alt", "ironman")?
> 4. **Wat als de speler een RSN heeft ingevoerd?** Koppelen we de
>    save aan de RSN of staat hij los?
> 5. **Privacy.** Wat als de speler de browser deelt? Banktags exposes
>    waarde, niet identiteit, maar het is goed daar bewust van zijn.
>
> Eindig met **één aanbeveling** ("ik zou X doen omdat Y"), niet drie
> opties. Bouw geen code.

### Prompt 5.2 — Implementeer de opslaglaag

> _Alleen uitvoeren NA prompt 5.1 en NA bevestiging van Laurens dat de
> aanbevolen aanpak klopt._
>
> Bouw `src/lib/saved-bank.ts`: een client-side module met
> `loadSavedBank()`, `saveSavedBank(items, opts)`, `clearSavedBank()`,
> volgens het ontwerp uit `docs/SAVE-BANK-DESIGN.md`. Inclusief:
> - Versie-veld in het payload (voor toekomstige migraties).
> - JSON-parse foutafhandeling — corrupte storage = stille terugval
>   naar geen-saved-bank, niet een crash.
> - 1 vitest-bestand `tests/saved-bank.test.ts` met 3-5 tests die de
>   round-trip + corrupt-payload + clear-flow dekken.
>
> Geen UI-wijziging in deze prompt. Alleen de module + tests.

### Prompt 5.3 — UI-integratie in /bank

> _Alleen uitvoeren NA prompt 5.2._
>
> Wikkel de Intake-component in /bank zodat bij paginalaad
> `loadSavedBank()` wordt geprobeerd. Als er een saved bank is:
> - Toon een banner bovenaan de intake: "Welcome back — we still have
>   your bank from <datum>." Met twee knoppen: "Use saved bank" (laadt
>   en submit automatisch) en "Start fresh" (clears en toont normale
>   intake).
> - In `BankResult`-header naast Copy/Smart-tidy/What-next: een
>   discrete "Save this bank" knop (of automatic, met "Saved ✓"
>   bevestiging). Beslissing in design-doc.
>
> Verifieer met typecheck, tests, build. Push.

### Prompt 5.4 — UI-integratie in /next

> _Alleen uitvoeren NA prompt 5.3._
>
> /next moet `loadSavedBank()` ook gebruiken — een returning speler
> wil meteen z'n hub zien, niet eerst opnieuw RSN typen. Aanpak:
> - Op /next paginalaad: probeer `loadSavedBank()` parallel aan de
>   `?from=bank` sessionStorage-check. Als één van beide bank-data
>   oplevert, pre-vul de intake.
> - RSN onthouden in localStorage (separate key, niet in de bank-
>   payload). Pre-vul het RSN-veld als die er is.
>
> Verifieer met typecheck, tests, build. Push.

---

## Fase 6 — Old-school visual rebrand

_Volgorde belangrijk: alleen beginnen NADAT Fase 5 ("Save bank")
gepubliceerd is en werkt. Reden: rebranding op een tool die elke sessie
opnieuw geplakt moet worden voelt nog steeds frustrerend, hoe mooi de
verf ook is._

### Prompt 6.1 — Visuele audit

> Open `src/app/globals.css` en de homepage + /bank + /next. Lees de
> kleuren-tokens, font-keuzes, animaties die er al zijn. Schrijf
> `docs/REBRAND-AUDIT.md`:
>
> 1. **Wat is er nu?** Welke kleuren (CSS custom properties), welke
>    fonts (Geist Sans / Mono), welke animaties (de keyframes in
>    globals.css), welke styling-conventies (Tailwind v4 met `@theme`).
> 2. **Wat voelt al old-school OSRS?** Geef per element een score:
>    item-sprites (waarschijnlijk OK), bank-grid (OK?), buttons (te
>    modern?), typografie (modern), kleuren (mint accent is niet
>    OSRS-natief).
> 3. **Wat zou old-school met modern randje betekenen?** Niet kopiëren
>    van de in-game UI (dat oogt 2007 op een 4K scherm). Wel: kleuren
>    uit het OSRS-palet (Tab-yellow, rune-blue, herblore-green), iconen
>    uit het spel, typografie die past bij Trebuchet (de OSRS-font) maar
>    leesbaar blijft. Mint-accent vervangen door OSRS-goud of -rood?
>
> Geen code. Eindig met **drie concrete kleurwijzigingen + één font-
> beslissing** die je zou voorstellen. Niet meer.

### Prompt 6.2 — Implementeer de kleurwijzigingen

> _Alleen uitvoeren NA bevestiging van Laurens op de aanbevelingen uit 6.1._
>
> Pas de CSS-tokens in `src/app/globals.css` aan volgens de drie
> goedgekeurde kleurwijzigingen. **Niet meer aanpassen dan dat.** Geen
> font-wijziging in deze prompt (die zit in 6.3). Geen animatie-
> wijziging. Alleen de kleur-variabelen.
>
> Typecheck, tests, build. Visueel verifiëren op /, /bank, /next door
> screenshots te beschrijven (welke kleuren zie je waar). Push.

### Prompt 6.3 — Typografie + één signature-animatie

> _Alleen uitvoeren NA prompt 6.2._
>
> Twee precieze wijzigingen:
> 1. Pas de gekozen font aan (uit 6.1) — in `src/app/layout.tsx` waar
>    Geist Sans / Mono geladen worden. Eén font, niet allebei.
> 2. Voeg **één** nieuwe signature-animatie toe: een geïntegreerde
>    OSRS-gevoel-animatie die op de homepage hero verschijnt. Bijv.
>    een sprite die binnenvalt zoals een drop-melding, of een "click
>    here" sparkle. Eén. Geen drie. Geen vier. Eén die de
>    productpersoonlijkheid pakt.
>
> Verifieer typecheck, tests, build. Push.

---

## Algemene prompts (gebruik tussen fases door)

### De pijn-check (gebruik na elke fase)

> Open de site op de routes die je net wijzigde. Loop door alsof je een
> nieuwe OSRS-speler bent. Beschrijf in 4 zinnen of minder waar je nog
> zou bouncen, of bevestig dat het nu klopt. Bouw niets — alleen
> rapporteren.
>
> Als je iets vindt: noteer het, klaar voor de volgende sessie. Niet
> meteen fixen. Geen scope-uitbreiding.

### De gezondheidscheck (gebruik aan begin van elke sessie)

> Voer in volgorde uit:
> 1. `git status` — werkboom moet schoon zijn. Niet? Laat zien wat
>    openstaat en vraag wat te doen.
> 2. `npx tsc --noEmit` — moet schoon. Niet? Stop en fix die als
>    eerste taak.
> 3. `npm test` — moet groen. Niet? Stop en fix.
> 4. `npm run build` — moet slagen. Niet? Stop en fix.
>
> Als alle vier groen zijn: lees de laatste commit-bericht en
> `docs/STRATEGY.md`. Wacht op een echte taak. Niet uit jezelf bouwen.

### De "stop met bouwen, denk eerst"-prompt

> Sessie ziet eruit alsof het de verkeerde kant op gaat (Laurens'
> berichten worden vaag, eisen worden groot, geen succescriteria). Doe
> dit:
> 1. Stop met code.
> 2. Lees `docs/STRATEGY.md` opnieuw.
> 3. Schrijf één paragraaf: wat is er gevraagd, wat zou ik bouwen, wat
>    is mijn risico-inschatting. Voeg toe aan `docs/SESSION-LOG.md`.
> 4. Vraag Laurens om bevestiging of beperking voor je verder gaat.
>
> Beter een onderbroken sessie dan een herwerk-sessie erna.

---

## Wat ontbreekt expres

- Geen UI-kleur-prompts. Kleur is symptoom, niet oorzaak.
- Geen "verbeter alles"-prompts. Die werken nooit.
- Geen prompts voor features die buiten STRATEGY.md vallen (sociale
  features, mobile app, AI assistent, RuneLite plugin).
