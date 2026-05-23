# Bank Organizer — hoe OSRS-spelers het écht doen

_Mei 2026. Geschreven voordat we de huidige organizer gaan herbouwen._

De huidige organizer faalt op één fundamenteel niveau: hij sorteert items
als losse dingen, niet als delen van een gebruik. Een speler die zijn bank
opent ziet "alle wapens onder elkaar, alle potions onder elkaar" — dat
klopt **niet** met hoe echte OSRS-spelers banken.

Dit document legt vast wat een goede bank doet, gebaseerd op community
patronen (RuneLite Bank Tags Layouts, r/2007scape bank-tour threads,
Tuck's 9-tab pattern, RuneScape Wiki "Bank" guide).

---

## De kern: een bank is een verzameling loadouts, geen verzameling items

De fundamentele vraag is **niet** "wat voor item is dit?" maar:

> "Wanneer pak ik dit, en wat pak ik ernaast?"

Een Saradomin brew zit niet bij "potions" als losse categorie. Hij zit bij
**"de stack die ik mee-take naar Vorkath"** — samen met antifire potion,
super combat potion, sharks, anti-venom, ranging potions. Een Ranarr seed
zit niet bij "seeds". Hij zit in **"herb-run loadout"** — met compost,
magic secateurs, farming teleports, en spade.

Items horen bij **activiteiten**, niet bij eigenschappen.

---

## Acht principes die een goede bank-organizer moet volgen

### 1. Rij/kolom = één activiteit

Een speler kijkt naar tab 5 en weet: "deze 8 slots zijn alles wat ik nodig
heb voor Zulrah". Geen scrollen, geen zoeken. Alles in één visueel blok.

We doen dit al voor:
- **PvM Gear** (set-kolommen per Bandos/Armadyl/Ancestral)
- **Potions** (herb-pipeline-rijen)
- **Skilling** (top 3 themed rijen voor pouches/essence/tools)

Maar **niet** voor:
- **Combat / Range / Magic** (weapons + armor + supplies door elkaar)
- **Resources** (logs, ores, bars dense gepakt)
- **Skilling** (na de top 3 rijen wordt het alsnog dense)
- **Food** (sharks naast lobsters naast karambwan)

### 2. Voorspelbare positie — muscle memory

Een speler moet kunnen zeggen "tab 1 slot 1 = teleport tab" zonder te
hoeven kijken. Dat betekent:

- **Slot 0 van een tab = de signature item van die tab.** Combat tab → je
  beste weapon. Potions → Saradomin brew. Skilling → je pickaxe.
- **Slot-positie hangt af van het *type* slot, niet van wat er in zit.**
  Een weapon staat altijd op weapon-positie, ook als je een nieuwe weapon
  hebt. Geen verschuiving bij upgrade.

We doen dit deels via de bank-filler tiles (we behouden gaten). Maar de
"alles dense gepakt"-fallback voor de meeste tabs vernietigt dit.

### 3. Hiërarchie binnen een tab — best bovenaan

Bovenaan in een tab: wat je **dagelijks** gebruikt.
Middendeel: wat je **af en toe** gebruikt.
Onderaan: **keepsakes**, zeldzame drops, "voor het geval dat".

Voorbeeld Combat-tab voor een PvMer:
```
Rij 1: Whip · Scythe · Tbow · Twisted bow · DWH · Voidwaker · BGS · Defender
Rij 2: Bandos set (chest, tassets, boots) · Avernic · Torture · Fury
Rij 3: Justiciar set (alt voor tanky bosses)
Rij 4: Dharok set (Wildy alt)
Rij 5-6: minder gebruikte specs / cosmetic gear
```

Niet "alle wapens onder elkaar, dan alle body, dan alle legs". Dat is
**voorraadkast-denken**, niet bank-denken.

### 4. Lege slots als visuele scheidingstekens

Een echte OSRS-bank heeft gaten. Geen gaten = items lopen visueel in
elkaar over → "muur van sprites" → speler kan niets vinden.

Het Vanilla OSRS Bank-Tags-formaat ondersteunt geen gaten — items moeten
dense flow. **Maar** ons web-overzicht is geen Bank Tags-export. We mogen
gaten tonen in de **viewer** zelfs als de export-string dense is. Dat is
een belangrijke distinctie die we nu niet maken.

Of: het nieuwe **RuneLite Bank Tags Layouts** plugin ondersteunt wél
sparse layouts. Onze export zou daar voor moeten genereren — niet voor de
oude dense Bank Tags.

### 5. Visuele rijmen — gelijke dingen in gelijke posities

Als je Bandos chest, tassets, boots in een kolom hebt, en je hebt óók
Armadyl chest, chaps, boots → die staan **in dezelfde rij-volgorde**. Eye
scans verticaal voor "wat heb ik op slot X", horizontaal voor "vergelijk
melee vs ranged".

Dit is wat we voor PvM Gear doen (`SET_SLOT_ORDER`). Maar voor andere
sets/categorieën doen we het niet.

### 6. Eén ding, één plek

Een Saradomin brew(4) heeft één canonieke plek. Niet ook nog een copy in
"Potions" en in "Combat supplies". Spelers worden gek van duplicaten —
het verraadt dat de organizer de items niet "snapt", maar gewoon kopieert.

Onze use-case tabs doen dit goed (one-bucket-per-item via `bucketFor`),
maar onze type-tabs dupliceren wél (dezelfde brew in zowel Combat als
Potions wanneer een tab-modus switcht).

### 7. Stacks zijn visueel onderscheidend

Een Ranarr (4) ziet er identiek uit als Ranarr (1) als je niet kijkt.
Spelers willen op een **oogopslag** zien hoeveel doses ze hebben.

- Dosis-getal **altijd zichtbaar** (we doen dit nu) ✓
- Hoeveelheidsgetal **prominent** (kleur per orde van grootte: wit < 100k,
  geel < 10M, groen ≥ 10M — OSRS doet dit native) ✓ deels
- **Stack-waarde** als optioneel overlay bij ≥100k (we doen dit) ✓

### 8. Workflow-conformiteit, niet alfabet

De pipeline grimy → clean → unfinished → (4)(3)(2)(1) volgt de **brewing
workflow**. Een speler die brewt, beweegt links → rechts in de rij. Items
in workflow-volgorde tonen = match met fysieke beweging.

Dit principe moet overal gelden:
- **Smithing-rij**: ore → bar → product
- **Crafting-rij**: hide → leather → finished armor
- **Cooking-rij**: raw → cooked
- **Runecrafting-rij**: essence → tiara → talisman → runes

Op dit moment dumpen we ores, bars, en bewerkte items in losse cellen.

---

## Hoe de huidige organizer faalt — concreet

### Combat-tab
**Nu**: alle weapons gegroepeerd, daaronder alle body-slot armor,
daaronder alle leg-slot, etc. Dense-gepakt.

**Hoort**: rij 1 = top-tier weapons (whip/scythe/tbow), rij 2 = top-tier
gear (chest/legs/cape/ring/ammy), rij 3 = secondary loadouts (Dharok,
Karil), rij 4+ = utility (defender, slayer helm, salve), rest = oude
upgrades en cosmetic.

### Skilling-tab (na de 3 themed rijen)
**Nu**: ores, logs, bars, gems, seeds, hides, planks — allemaal dense
gepakt in volgorde van skill-rank.

**Hoort**: workflow-rijen per skill:
- Mining-rij: pickaxe · ores (tin/copper/iron/coal/mithril/adamantite/rune) · gems
- Smithing-rij: bars (bronze/iron/steel/mithril/adamant/rune) · hammer · arrowtips
- Woodcutting-rij: axe · logs · bird nests
- Crafting-rij: hides · leather · gold/silver bars · gems · molds
- Farming-rij: seeds · saplings · supercompost · spade · secateurs

Met lege slots tussen elke skill-rij als visuele scheiding.

### Food-tab
**Nu**: sharks naast karambwan naast lobsters dense-gepakt.

**Hoort**: kolommen — kolom 1 raw, kolom 2 cooked. Of: rij per food-tier
(top-PvM, mid-tier, F2P).

### Magic-tab
**Nu**: staves naast hats naast robes dense-gepakt.

**Hoort**: per spellbook (standard/ancient/lunar), gear-set kolommen
(Ancestral / Virtus / Ahrim / Mystic), staves per element.

---

## Wat moet er veranderen aan de code

Niet de classifier. Die werkt nu (Wiki-driven). Wel:

1. **De layout-builders** voor Combat / Range / Magic / Food / Resources /
   Skilling-overflow moeten net zo workflow-bewust worden als de huidige
   PvM-Gear / Potions / Skilling-top-rijen.
2. **Een rij-template-systeem**: per tab een set rij-templates met named
   slots, waar items in matchen. Niet meer "subtab → dense-pack" maar
   "rij A: weapon-slot 1-5 | rij B: armor-slot 1-8 | ...".
3. **Gaten in de viewer** ook als de Bank Tags-export dense is. Of liever:
   schakel over op Bank Tags Layouts plugin als doel-export.
4. **Hierarchical scoring** in plaats van flat weight. Een item heeft
   tier (S/A/B/C/D) + slot. Top-tier = rij 1, lager = rij 2/3.

---

## Volgende stap

Voordat ik dit ga bouwen wil ik dit document met je doornemen. Klopt deze
analyse met wat jij voelt als je naar de bank kijkt? Mis ik principes?
Zijn er principes die je *minder* belangrijk vindt dan ik denk?

Dit is een fors herontwerp van de organizer. Beter eerst weten of we het
juiste herontwerpen.
