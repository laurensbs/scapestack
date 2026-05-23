# Save-bank — design

_Mei 2026. Fase 5 uit PROMPTS.md. Eén beslissing per vraag, geen
optie-vergelijking; de afwegingen staan in de uitleg._

## Aanbeveling in één zin

**localStorage, één huidige bank, los van RSN, met een aparte
"remember-RSN" key. Plus een gebruiks-toggle "Don't save this device"
voor gedeelde browsers.**

---

## 1. Waar slaan we op?

**localStorage.** STRATEGY.md heeft auth bewust uitgesloten — geen
accounts, geen server-state. URL-shared snapshot-codes (`/bank/share/[code]`)
zijn er al voor *delen*, niet voor *eigen-bank*; een "permalink mijn
bank" zou een hostingkost erbij vragen voor exact één gebruiker.
localStorage is gratis, instant, en past bij "geen account, geen
plugin."

Risico: nieuwe device → opnieuw plakken. Dat is acceptabel — de
gemiddelde returning speler bezoekt vanaf dezelfde browser; de URL-
share-flow bestaat voor de andere gevallen.

## 2. Wat slaan we op?

**Alleen de banktags-string + de timestamp.** Niet de OrganizeResult,
niet de sort/density/tab-volgorde-voorkeuren.

Reden: de banktags-string is de bron-of-truth. Organize-result is afgeleid;
verandert de engine (nieuwe items, betere classifier), dan willen we de
nieuwe output zien — niet de gecachte oude. Voorkeuren (sort/density)
zitten al per sessie in de UI-state en hoeven niet persistent te zijn
voor de v1.

Payload-schema (versie 1):
```ts
{ version: 1, banktags: string, savedAt: number /* epoch ms */ }
```

`version` veld is verplicht — toekomst-migratie zonder breken.

## 3. Hoeveel banks?

**Eén.** Geen named slots ("main / alt / ironman").

Reden: voegt UI-complexiteit toe (slot-picker) voor een use-case die de
meeste spelers niet hebben. Wie meerdere accounts beheert kan vandaag al
een banktags-string ergens noteren; we lossen 80% op met één slot. Als
mensen erom vragen breiden we uit, niet eerder.

## 4. Aan RSN koppelen?

**Nee — RSN apart opgeslagen in z'n eigen localStorage key.**

Reden: de bank-save moet ook werken zonder dat de speler een RSN
invoert (niet iedereen wil z'n naam delen, sample-flow). En de RSN moet
ook ge-onthouden worden als de speler géén bank heeft geplakt (bv. /next
RSN-only flow). Twee onafhankelijke "remember me" features, twee keys:

- `scapestack:saved-bank:v1` — `{ version, banktags, savedAt }`
- `scapestack:saved-rsn:v1` — `string` (trimmed RSN)

De `snapshot-history.ts` per-RSN keten blijft bestaan; save-bank is
*orthogonaal* — geen historie, gewoon "de laatste die ik plakte."

## 5. Privacy

Banktags-string lekt waarde en gear-loadout, niet identiteit. Maar op
een gedeelde browser is dat alsnog ongewenst. Mitigaties:

- **Auto-save default = aan.** Toont "Saved · X minutes ago" badge in
  de result-header zodat de speler ziet dat het gebeurt.
- **"Don't save on this device"-toggle in de banner-flow.** Een
  klein link-knopje onder de "Use saved bank"-banner. Klik = `clear()` +
  een sessieflag die voorkomt dat we deze sessie opnieuw saven.
- **Een "Forget my bank"-link in de result-header** naast de
  "Saved"-badge. Eén klik = weg.

Geen disclaimer-modal — die voegt friction toe waar de actie zelf al
laagdrempelig is.

---

## Auto-save vs expliciete knop

**Auto-save** als de organize-flow slaagt, met zichtbare badge. Reden:
de hele rationale voor save-bank is "niet meer opnieuw plakken" — een
expliciete "Save"-knop herintroduceert friction. De badge maakt zichtbaar
dat het gebeurt; de "Forget" link maakt het terug te draaien. Dat is de
juiste balans voor "no surprises, low friction."

## Welcome-back banner UX

Bij paginalaad op `/bank` of `/next`:
- Als `loadSavedBank()` data oplevert: banner met
  *"Welcome back — we still have your bank from {relative time}"*
  + primaire knop "Use saved bank" + secundaire link "Start fresh" + tertiare link "Don't save on this device".
- "Use saved bank" laadt + submit automatisch.
- "Start fresh" doet `clearSavedBank()` en toont de gewone intake.
- "Don't save on this device" doet `clearSavedBank()` + zet
  sessionStorage flag `scapestack:save-bank:disabled` voor deze sessie.

## Volgorde van implementatie

1. `src/lib/saved-bank.ts` + tests (5.2)
2. Wire in `/bank` (5.3) — banner + auto-save na succesvolle organize
3. Wire in `/next` (5.4) — banner + RSN-remember
