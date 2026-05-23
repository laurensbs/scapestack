# /next lege-staat — audit (mei 2026)

_Notities voor fase 2.2 in docs/PROMPTS.md. Geschreven door Claude
tijdens fase 2.1 zodat de volgende prompt direct kan handelen._

## Wat een bezoeker NU ziet op /next (vóór run())

1. IntroCard: "No idea what to do next?" met 4-zin uitleg dat we bank +
   RSN willen.
2. De volledige Intake-component, identiek aan /bank: 4-stappen "How
   it works" + textarea voor banktags + RSN-veld + "Organize"-knop.

## De drie problemen

1. **`/next` ziet er identiek uit als `/bank`.** Dezelfde
   4-stappen RuneLite-flow, dezelfde textarea, dezelfde "Organize"-knop.
   Een bezoeker weet niet waarom hij hier zou zijn ipv op /bank.

2. **De RSN-only path is verstopt.** Het meeste werk in /next leunt op
   Hiscores, niet op de bank — maar de UI vraagt bank-data eerst en
   RSN als bijzaak. Voor returning spelers (één van de doelgroepen
   in STRATEGY.md) is bank-export gewoon onmogelijk; ze zijn al maanden
   weg.

3. **Geen voorbeeld van de output.** Wat de hub produceert (8 typen
   aanbevelingen, drop-rate insights, etc.) is niet zichtbaar tot
   je iets invult. Nieuwe bezoekers zien een formulier zonder weten
   waar het toe leidt.

## De drie veranderingen voor fase 2.2 (zonder volgorde)

1. **RSN-only path zichtbaar maken** — een prominente intake-keuze
   bovenaan: "Just look up my account (RSN only)" naast "Paste my bank
   too (sharper advice)". Twee paden, één ervan veel lichter.

2. **"Try with sample data" knop op /next** — net als op de homepage.
   Klik → meteen ResultView met sample-data, geen input nodig. Toont
   wat de output is.

3. **Submit-label fixen** — "Organize" werkt voor /bank, niet voor
   /next. Verander naar "Show me what to do" of vergelijkbaar. De
   Intake-component is gedeeld; ofwel parameteriseren ofwel een
   /next-specifieke wrapper.

## Wat ik NIET zou doen in fase 2.2

- Geen volledige re-skin van /next. De grouped checklist + headline
  card die de result-view rendert werkt prima — het lege-staat-
  probleem zit aan de pre-result kant.
- Geen nieuwe data-sources. Drie UI-tweaks; geen Wiki-research, geen
  nieuwe API.
- Geen verandering aan de Intake-component zelf als het te invasief
  wordt. Ofwel een prop toevoegen, ofwel een lokale variant voor /next.
