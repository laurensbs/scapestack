# Scapestack — toegangsmodel en herpositionering

Plan van 2026-07-25. Vier werkstromen, in volgorde van waarde. Fase 1 is de
enige die de andere drie blokkeert: zolang het advies fout kan zijn, is elke
UI-verbetering vernis.

## Aanleiding

Een account op level 99 in alles, waarvan RuneLite meldt dat het **nul quests**
heeft voltooid, krijgt vandaag deze aanbevelingen:

| Aanbeveling | Werkelijke poort |
| --- | --- |
| Wrath rune crafting | Mourning's End Part II |
| Blood rune crafting | Sins of the Father |
| Rune dragons | Dragon Slayer II |
| Vorkath | Dragon Slayer II |
| Zulrah | Regicide-keten |
| Birdhouse run | Bone Voyage |
| Redwood logs | 75% Hosidius-gunst |
| Tithe Farm | 100% Hosidius-gunst |

Acht onmogelijke adviezen, terwijl de exacte questlijst binnenkomt via de
plugin. `moneyRecs()` en `bossRecs()` krijgen die lijst simpelweg niet mee.

OSRS-spelers kennen deze poorten uit hun hoofd. Fout advies leest hier niet als
onnauwkeurigheid maar als bewijs dat de maker het spel niet speelt.

---

## Fase 1 — Toegangsmodel

### Drie toestanden, niet twee

Dit is het hele ontwerp. Een binaire vergrendeld/open-check zou Vorkath
verbergen voor elke speler zonder plugin, en dat is erger dan het probleem.

| Toestand | Wanneer | Gedrag |
| --- | --- | --- |
| `unlocked` | exacte data aanwezig én voldaan | normaal aanbevelen |
| `locked` | exacte data aanwezig én niet voldaan | **onderdrukken**, en de quest zelf als route aanbieden |
| `unknown` | geen exacte data | tonen, maar de eis zichtbaar meesturen |

De `unknown`-tak is geen compromis maar een functie. "Vorkath — vereist Dragon
Slayer II" is nuttige informatie voor een speler die het niet zeker weet, en
het is eerlijk over wat Scapestack wel en niet weet. Het is bovendien de
directe aanleiding om de plugin te installeren: met sync verdwijnt de slag om
de arm.

De plumbing bestaat al: `completedQuestNames` is `undefined` zonder exacte
bron, anders een `Set<string>` met lowercase namen. Dat mapt één-op-één op de
drie toestanden.

### Wat we wel en niet kunnen verifiëren

| Poorttype | Bron | Verifieerbaar |
| --- | --- | --- |
| Quest | plugin `questsCompleted`, TempleOSRS | ja, exact |
| Skill-level | Hiscores, plugin | ja, exact |
| Diary-tier | plugin `diariesCompleted` | ja, exact |
| Gunst (Hosidius e.d.) | — | **nee**, blijft `unknown` |
| Questpunten | Hiscores | ja |

Gunst wordt niet gesynct door de plugin. Die blijft dus altijd `unknown` en
krijgt een zichtbare eis in plaats van een verzwegen aanname. Gunst toevoegen
aan de plugin-payload is een aparte overweging (nieuwe contractversie).

### Bestanden

```
src/lib/content-access.ts        types + evaluator (unlocked/locked/unknown)
src/lib/content-access-data.ts   poorten per money-slug en boss-slug
```

Evaluator-vorm:

```ts
type AccessState = "unlocked" | "locked" | "unknown";

interface AccessRequirement {
  quests?: string[];                       // alle vereist
  favour?: { house: string; percent: number };
  skills?: Array<{ skill: string; level: number }>;
  diary?: { region: string; tier: DiaryTier };
}

interface AccessVerdict {
  state: AccessState;
  missing: string[];        // speler-taal: "Dragon Slayer II"
  unverified: string[];     // "75% Hosidius-gunst"
}
```

Geen nieuwe data nodig: `data/quests.json` bevat 183 quests met volledige
`questReqs` en `skillReqs`, dus een enkele questnaam volstaat als poort — de
keten eronder hoeven we niet te herhalen.

### Aanpassingen aan bestaande code

- `MoneyMethod` krijgt `access?: AccessRequirement`.
- `moneyRecs(skills, accountMeta)` → `moneyRecs(skills, accountMeta, access)`.
- `bossRecs(...)` en `kcRecs(...)` idem.
- `locked` → rec valt weg; in plaats daarvan komt de blokkerende quest als
  eigen aanbeveling naar boven ("Doe Dragon Slayer II — unlockt Vorkath en
  rune dragons").
- `unknown` → rec blijft, met de eis in `needs[]` en een gedempte score, zodat
  een geverifieerde aanbeveling altijd wint van een onzekere.

### Tests

- Het scenario hierboven: 99-alles, nul quests → geen van de acht verschijnt.
- Zelfde account mét de quests → alle acht mogen verschijnen.
- Zonder plugin (`completedQuestNames === undefined`) → ze verschijnen wél,
  met zichtbare eis; niets wordt stilzwijgend onderdrukt.
- Gunst-content blijft altijd `unknown`.

---

## Fase 2 — Elke pagina bruikbaar zonder account

`/dps` heet "Can I kill this?" en toont vandaag **nul bazen** tot je een bank
plakt. `/skills` rendert 46 tekens. Elke pagina is een formulier in plaats van
inhoud.

Omkering: inhoud staat er altijd, het account maakt het persoonlijk.

- `/dps` toont de volledige bossenlijst met afbeeldingen, meteen. Zonder
  account: naam, plaatje, combat-eis, poort ("vereist DS2"). Met bank/plugin:
  het oordeel erbovenop ("kan je aan · mist Salve · nog niet").
- De bank-intake zakt van "stap 3 van 4" naar één knop boven de lijst.

Lost twee dingen tegelijk op: het lege gevoel, en het feit dat er nu niets te
indexeren valt voor zoekmachines.

---

## Fase 3 — Zwaartepunt naar `/slayer`

`"Wat moet ik nu doen?"` is een laagfrequente vraag — spelers stellen hem bij
terugkeer of bij max-verveling. `"Is deze taak het waard?"` wordt elke taak
gesteld, meerdere keren per sessie, en vereist precies de data die alleen de
plugin levert (exacte taak, blocklist, punten, bank).

Geen herbouw, wel herpositionering: `/slayer` krijgt gelijke of hogere
prominentie in navigatie en homepage-copy, met de taakbeslissing als
hoofdbelofte in plaats van als subtool.

---

## Fase 4 — Plugin passief maken

1. **Eén merknaam.** Nu 24× "ScapeStack" tegenover 58× "Scapestack" in
   speler-zichtbare tekst.
2. **Minder knoppen.** Zeven instellingen, waarvan `Sync now` een boolean is
   die zichzelf terugzet en `Reconnect player` permanent reparatiegereedschap
   in het instellingenmenu is.
3. **Storingsregels weg uit het paneel.** De drie "if X then Y"-zinnen leren de
   speler omgaan met onbetrouwbaarheid. Ontbrekende collection-log of bank moet
   de app melden op het moment dat het uitmaakt, niet RuneLite vooraf.

Let op: plugin-wijzigingen vragen een volledige release-cyclus (extract →
standalone → Plugin Hub PR) en zijn niet terug te rollen. Zie
`plugin/PUBLISHING.md`.

---

## Openstaand

De wijzigingen van 2026-07-25 (RSN-fix, engine-split, README) staan nog niet op
GitHub. De U+00A0-bug is dus **nog live in productie**: spelers met een spatie
in hun naam kunnen de plugin niet gebruiken. Pushen is een aparte beslissing.
