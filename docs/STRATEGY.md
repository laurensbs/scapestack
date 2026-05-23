# Scapestack strategie — mei 2026

_Geen optie-document, geen ideeën-lijst. Eén richting, vastgelegd zodat
volgende sessies niet opnieuw vragen "wat bouwen we eigenlijk"._

---

## De keuze in één zin

**Scapestack wordt de site die voor jouw OSRS-account zegt wat het
slimst is om als volgende te doen.** Niet vijf tools. Eén tool met
ondersteunende delen.

---

## Wat we bouwen

### `/next` is de identiteit

De "wat zou ik nu doen?"-hub is het product. De homepage stuurt mensen
daar primair naartoe. De andere tools bestaan in dienst van `/next`,
niet als losse producten.

Concreet betekent dat:
- **Homepage hero-knop = "What should I do?"**, niet "Open Bank
  Organizer".
- **Bank Organizer wordt een data-leverancier**. Plak bank → klaar →
  ga door naar /next. Niet een eindbestemming op zichzelf.
- **Goal Tracker idem.** Het is een detail-view van wat /next al
  samenvat. Behouden voor wie het apart wil, niet meer een hoofdtool.
- **DPS Calculator blijft niche.** Mensen die DPS willen, weten dat
  ze het willen. Het hoeft geen homepage-prominentie.
- **Hiscore Lookup is een wegwerptool.** Iemand zoekt een vriend, klaar.
  Geen identiteit.

### Eén nieuwe route: `/returning`

Subroute van `/next`. Specifiek voor returning spelers: "wanneer was je
voor het laatst actief? Hier is wat sindsdien veranderd is, gefilterd
op wat jou raakt." Acquisitie-magneet (Google: "returned to osrs 2026"
heeft geen goede landing page).

### Wat we schrappen

- **GP Tracker** — Wiki Prices doet dit. Geen moat. Verwijderen van
  homepage roadmap.
- **GE Price Tracker** — idem. RuneLite plugin + ge-tracker.com
  bedienen dit al.

De stubs `/gp` en `/ge` mogen blijven bestaan voor 404-preventie, maar
verdwijnen uit de homepage tool-grid.

### Wat blijft staan (lichte status)

- **Quest Planner, Skill Planner, Diary Tracker** — niet apart bouwen,
  hun functionaliteit landt in `/next` als rec-types. Quest- en diary-
  recs bestaan al. Skill milestones idem. ComingSoon-stubs blijven
  voor SEO en nieuwsgierigheid, maar geen aparte ontwikkeling.

---

## Wat we niet bouwen

Bewust. Komen niet meer terug op de agenda:

- **AI chat assistent**. Voegt niks toe boven rule-based engine.
- **Native mobile apps**. Mobile-web is genoeg.
- **Sociale features** (vrienden, vergelijken, leaderboards). Templeosrs
  en WOM bedienen dit. Geen moat.
- **In-game integratie / RuneLite plugin**. Buiten ons bereik.
- **"Beter dan Wise Old Man worden"**. Verkeerde framing. WOM doet
  tracking; wij doen *wat-nu*. Geen concurrentie.

---

## Hoe we meten dat het werkt

Drie meetbare doelen voor de komende maand:

1. **`/next` is de meest-bezochte route**, niet `/bank`. (Vereist
  analytics — separate vraag.)
2. **Een nieuwe bezoeker krijgt binnen 10 seconden minstens 3 echte
  recs**, of via sample-flow of via RSN-lookup. Geen lege staat,
  geen "voer eerst je bank in dan je RSN dan..."-trechter.
3. **De `/returning` flow werkt voor 3 verschillende return-datums**
  (1 jaar, 2 jaar, 5 jaar) met meaningful output per case.

Als één daarvan na een maand niet waar is, is de uitvoering fout en
herzien we hoe (niet wat).

---

## Volgorde van bouwen

1. **Homepage opnieuw uitlijnen** rond `/next` als primaire actie.
   Bank/Goals/DPS/Hiscore in een secundair "tools"-blok daaronder.
   Schrap GP/GE-cards.
2. **`/next` lege-staat fixen**. Een bezoeker zonder bank of RSN moet
   *iets* zien — generieke "begin hier"-stappen of voorbeeld-uitvoer.
3. **`/returning` bouwen** — wiki update-feed → filter op skills/bank
   → "deze 3 updates raken jouw account". Sub-route van `/next`.
4. **Bank Organizer als data-pijplijn herframen**. Na organize → een
   "ga naar /next"-knop, in plaats van uitsluitend export-actie.

Niet meer dan dit voordat we meten of het werkt. Geen pre-emptieve
features.

---

## Wat dit document NIET is

- Geen UI-ontwerp. Dat volgt uit de keuzes hierboven.
- Geen tijdschema. Sessie voor sessie, iteratief.
- Geen feature-completeness-belofte. Het mag "minder doen, beter".
