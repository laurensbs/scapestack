# Rebrand audit — old-school OSRS met een modern randje

_Fase 6.1 uit `docs/PROMPTS.md`. Geen code in dit document. Bedoeld om
de **vier concrete wijzigingen** uit prompts 6.2 en 6.3 (drie kleuren
+ één font) accuraat te kunnen pinnen voordat we gaan editen._

---

## 1. Wat is er nu — feitelijk

### Kleuren-tokens (`src/app/globals.css`, `@theme` blok)

**Surfaces** — diep donker, geen warmte:
- `--color-bg: #07090C` — bijna zwart, lichte blauw-tint
- `--color-bg-2: #0A0D12` — iets lichter
- `--color-panel: #0F1217` — kaart-niveau
- `--color-panel-2: #141821` — verheven kaart
- `--color-border: #1C1F26`, `--color-border-strong: #262A33`

**Tekst** — koel grijs, geen warmte:
- `--color-text: #E8EAED`
- `--color-text-dim: #9AA0AB`
- `--color-text-muted: #5B6170`

**Het ene accent — mint groen overal:**
- `--color-accent: #00E29A` (mint)
- `--color-accent-soft: #4DEEB7`
- `--color-gold` alias voor `#00E29A` (legacy naam, géén echt goud)
- `--color-good: #00E29A` (zelfde mint)

**Semantisch:**
- `--color-warning: #FFB454` (oranje, warm)
- `--color-danger: #FF6566` (helder rood)

**Bank "skeumorphic" tokens** — destijds OSRS-hout vervangen door
modern donker:
- `--color-osrs-wood-*`: allemaal nu donker-blauwgrijs (`#0B0E12` → `#1F232C`)
- `--color-osrs-bank-bg: #0A0D12` — geen wood-grain
- `--color-osrs-tab-active: #161A22`, `inactive: #0F1217`
- `--color-osrs-title: #00E29A` (mint)
- `--color-osrs-qty-yellow: #FFD66B`, `qty-white: #E8EAED`, `qty-green: #00E29A`

**Comment in de file zegt expliciet:** *"Modern dark with a single mint
accent. No gold, no skeuomorphic OSRS chrome in the brand layer — the
OSRS feel only comes from pixelated items in the bank grid. Everything
else: clean, dark, monochrome with one bright accent."*

Het palet is dus **Linear/Vercel met OSRS-sprites ingeplakt**. Mint
is de gehele brand-personality.

### Fonts (`src/app/layout.tsx`)

- `GeistSans` (Vercel's eigen sans-serif, neutraal modern)
- `GeistMono` (mono, voor tabular nums + raw item-IDs)
- `font-feature-settings`: cv11/ss01/ss03 in `globals.css`, light
  optical sizing — een paar premium-typografische tweaks

Geen OSRS-natieve font. **Trebuchet MS** is de in-game font; daar
verwijzen we nergens naar.

### Animaties — er zijn er veel, ~15

- Inkomende (`hero-fade`, `slide-up`, `tile-rise`, `pop-in`,
  `fade-in`, `tooltip-in`) — allemaal kort, gemiddeld 0.25-0.6s
- Aandacht (`mint-pulse-dot`, `pulse-glow`, `glow-fade`) — herhaalde
  mint-aura's
- Interactie (`tab-bounce`, `reshuffle`, `mint-sweep`, `divider-sweep`)
- Sidebar-icoon-animaties (`layers-drop`, `target-lock`, `sword-slash`)
- Een mysterieuze `float-y` (5.5s) — gebruikt op een handvol decoratie-
  elementen

Alle accent-animaties gebruiken `rgba(0, 226, 154, ...)` — **mint
overal**, geen variatie.

---

## 2. Wat voelt al old-school OSRS?

Per element, eerlijk:

| Element | Score | Waarom |
|---|---|---|
| **Item-sprites** | ✓ Authentiek | Echte OSRS Wiki PNG's, pixelated rendering. Dit is wat het spel *is*. |
| **Bank-grid layout** | ✓ Half | 8-koloms grid met slot-borders is een directe parallel met het in-game bank-paneel. |
| **Qty-cleur-tiers (geel/wit/groen)** | ✓ Authentiek | Dit zijn de echte in-game stack-kleuren. Eén van de weinige plekken waar OSRS-conventie wint van Linear-stijl. |
| **Tab-strip** | ◑ Twijfelachtig | Visueel een mainstream tab-component, niet de in-game houten tab-strip die OSRS-spelers kennen. |
| **Knoppen** | ✗ Te modern | Mint-gradient pill-buttons. Voelt Vercel/Linear, niet RuneScape. |
| **Typografie** | ✗ Modern | Geist Sans is een mooi 2024-font, maar voor een speler met OSRS-context: te clean, te steriel. |
| **Hoofd-accent (mint)** | ✗ Onnatief | Mint #00E29A bestaat niet in het OSRS-kleurenpalet. De spelers zien dit niet als "OSRS-kleur". Het is een SaaS-startup-accent. |
| **Achtergrond** | ◑ Acceptabel | Diep zwart met blauwtint is OK — donker is OSRS-natief (bank-paneel is donkergrijs), maar het mist warmte. |
| **Lege tegels / fillers** | ✓ Goed | Bank filler sprite + 55% opacity is een echte OSRS-conventie. |

**Samenvatting**: het is een *modern dashboard met OSRS-sprites erin
geplakt*. De brand-laag (kleuren, fonts, knoppen) is generieke SaaS;
de content-laag is authentiek.

---

## 3. Wat zou "old-school met modern randje" betekenen?

Niet kopiëren wat OSRS in-game doet — een 2007-RuneScape-skin op een
4K-scherm oogt amateuristisch. Wel: drie principes.

### Principe A — Het OSRS-palet binnenhalen, niet imiteren

OSRS heeft een herkenbaar kleurenpalet dat al decennia consistent is:
- **Tab-yellow `#FFD66B`** (numerieke quantity, ook al in onze tokens)
- **Rune-blue `#3C82F6`** (lawrune, magic-thema)
- **Herblore-green `#4FAE51`** (warme groen, niet mint)
- **OSRS-goud `#E6A52F`** (skill-cape goud, quest-XP-popups)
- **Hitsplat-rood `#A02B27`** (combat-feedback)
- **Combat-orange `#E68945`** (slayer task XP)

Mint `#00E29A` past niet in dit palet — het is fluo, neon, koud.
Vervangen door **OSRS-goud** als accent geeft direct herkenning zonder
de hele site geel te maken. Goud signaleert "iets bijzonders" in OSRS
(quest reward, cape unlock, level-up) — perfect voor een
"primary action"-accent.

### Principe B — Warmte erin, koudheid eruit

De huidige background (`#07090C` met blauwtint) voelt 2024-SaaS.
OSRS-banken hebben warmere donkergrijzen, soms zelfs houten randjes.
We hoeven het hout niet terug te brengen, maar de blauw-tint mag eruit
ten gunste van neutraal-warm donker. Dat is een one-line change in
`--color-bg`.

### Principe C — Typografie die *associeert* met OSRS zonder dat het
crap-leesbaar wordt

OSRS gebruikt **RuneScape UF** (de stylized font in dialogen) en
**Trebuchet MS** (de UI-font). RuneScape UF is niet leesbaar in body
copy op desktop. Trebuchet MS is dat wel, en lijkt qua karakteristiek
sterk op **Inter** of **Source Sans** — humanistische sans-serifs met
brede ronde letters.

Geist Sans is daarentegen geometrisch en koeler. Een swap naar een
*humanistische* sans (Inter is veiligste keuze — gratis, Google Fonts,
breed gebruikt) brengt OSRS-resonantie zonder dat we het op-zicht
"old-school" laten worden.

Voor headings is iets pittigers mogelijk — bijv. **Cinzel** of
**Cormorant Garamond** als sub-tag voor specifieke headings ("WHAT
SHOULD I DO NEXT?") — maar dat is fase 6.3 als we überhaupt willen.

---

## 4. Concrete aanbeveling

Vier wijzigingen voor de volgende prompts (6.2 = kleuren, 6.3 = font +
animatie). Niet meer, niet minder.

### Drie kleurwijzigingen voor prompt 6.2

1. **Mint accent vervangen door OSRS-goud.**
   - `--color-accent: #00E29A` → `#E6A52F` (OSRS-skill-cape goud)
   - `--color-accent-soft: #4DEEB7` → `#FFCC55` (lichter goud voor hover)
   - `--color-good: #00E29A` blijft mint — "good/success" is een
     semantisch label, niet brand-color. Splitsing.
   - **Alle `rgba(0, 226, 154, …)` literals in keyframes en shadows
     in globals.css** vervangen door `rgba(230, 165, 47, …)`.
   - Effect: elke primary-knop, badge, hero-CTA, bank-title, dot-
     pulse, qty-green-tier (etc.) krijgt warm goud i.p.v. mint. Sterke
     visuele rebrand zonder structurele wijziging.

2. **Background-tint verschuiven van blauw naar neutraal-donker.**
   - `--color-bg: #07090C` → `#0C0A07` (zelfde donkerheid, omgekeerde
     hue — een hint van warmte i.p.v. blauw).
   - `--color-bg-2: #0A0D12` → `#100D08`.
   - Effect: subtiel. Verwijdert de "Linear-blauwzwart" associatie
     zonder de pagina lichter te maken. Bank-grid blijft dezelfde
     donkere achtergrond hebben.

3. **Border-tokens iets warmer maken zodat ze niet metallic-blauw
   ogen.**
   - `--color-border: #1C1F26` → `#231F1A` (donkerbruin-grijs).
   - `--color-border-strong: #262A33` → `#332D24`.
   - Effect: elke paneel-rand krijgt een hint van houten warmte.
     Visueel klein, maar de site gaat van "tech dashboard" naar
     "RuneScape-ish artifact".

Bewust niet aanraken in 6.2:
- `--color-warning` (oranje #FFB454) — al warm genoeg.
- `--color-danger` (rood #FF6566) — al warm genoeg.
- `--color-osrs-qty-*` — die zijn al OSRS-authentiek.
- De text-kleuren — niet aanraken, leesbaarheid eerst.

### Eén font-beslissing voor prompt 6.3

**Geist Sans → Inter.** Dat is het.

- Reden: humanistische sans, breder en ronder, sterker karakter dan
  Geist's geometrische lijnen. Past beter bij OSRS-gevoel (Trebuchet-
  familie) zonder dat we per se Trebuchet zelf gebruiken (die is
  goedkoop-Microsoft-ish in 2026).
- Inter is bovendien aan-en-uit-Google-Fonts, perfecte font-loading
  via `next/font/google` (geen layout shifts), en breed bekend.
- `GeistMono` blijft staan voor tabular nums en mono-velden — geen
  reden om die te verstoren.

Niet doen: een display-font voor headings (Cinzel/Cormorant) toevoegen
in 6.3. Houd het op één font-swap. Als de site daarna nog "te clean"
voelt, kunnen we dat in een volgende iteratie.

---

## 5. Wat ik niet aanraak in fase 6

Bewust uit de scope:

- **Bank-grid layout.** De grid + slot-borders zien er al goed uit;
  een rebrand daarvan raakt classifier-output en gedrag.
- **Animatie-volume.** Er zijn ~15 keyframes. Ik weet niet of dat te
  veel of te weinig is — dat is gebruikerservaring, niet visueel
  ontwerp. Eén nieuwe signature-animatie in 6.3, geen verwijdering.
- **Layout/spacing/sizing.** Dit document gaat over kleuren en fonts.
  Spacing-revisie is een eigen project.
- **Iconen.** Lucide-icoonset blijft staan. Per-categorie OSRS-sprite-
  icons zou leuk zijn, maar valt buiten scope (dat is data-werk: per
  rec-kind het juiste in-game item kiezen).
- **Logo / wordmark.** "scape**stack**" met mint-stack-deel blijft —
  die wordt natuurlijk goud na de kleur-swap. Geen herontwerp.

---

## Volgende stap

Als jij akkoord bent met deze vier aanbevelingen (drie kleuren + Inter
font), zeg dan **"doe fase 6.2"** en ik voer prompt 6.2 uit:
implementeer alleen die drie kleurwijzigingen, niets anders. Daarna
prompt 6.3 voor font + één signature-animatie.

Als je een aanbeveling wil aanpassen — bijv. "goud voelt te
verzadigd, probeer een verzadigde rune-blauw als accent" — typ dat
nu, dan herzie ik dit document en pas de prompts daarna aan.
