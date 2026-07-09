# ScapeStack Product Audit

Bijgewerkt op 2026-07-08.

Scope: audit-only. Geen productcode aangepast. Gelezen: webapp home, `/next`, bank organizer, boss/DPS modal, DPS client, next-up logic, bank action loop, accounttype/item-availability/diary readiness tests, syncflow tests, en RuneLite plugin config/sync/notification/collection-log classes. Recente commits meegenomen: `193dd85`, `8733f49`, `74c7fb9`, `6af245f`, `cd2aee5`, `e4bdaa3`, `ef783bd`, `cb1db2b`.

Browsercheck lokaal op `http://localhost:4174`:
- `/`
- `/next?rsn=lauky&bank=local`
- `/bank?rsn=lauky`
- `/bank?mode=tidy&rsn=lauky&from=next`
- `/bank?sample=1` als bank-resultaat proxy met echte organizer UI
- `/dps?rsn=lauky&from=bank&boss=bryophyta`
- `/plugin?rsn=lauky&from=next&bank=none#verify-sync`

Geen losse screenshotbestanden opgeslagen, zodat de audit de enige wijziging blijft. Per punt staat daarom de gecontroleerde route.

Tijdens de browsercheck verschenen ook twee technische signalen in de lokale dev logs:
- `getSyncedPlayer failed: column "skills" does not exist` op plugin/next sync checks. Dit wijst op lokale database-schema drift of ontbrekende migratie.
- Dubbele React key `fairy-rings:quest:Fairytale I - Growing Pains` in de routeweergave. Dit kan route rows visueel dupliceren of verkeerd hergebruiken.

## Eerlijke Scores

| Onderdeel | Score | Oordeel |
| --- | ---: | --- |
| Premium gevoel | 6.5/10 | De rustige home-richting werkt. Bank en DPS voelen nog als toolpanels met te veel controls tegelijk. |
| OSRS-specificiteit | 7/10 | Veel OSRS-data, sprites en routes bestaan. Copy en prioritering klinken nog soms als product/analytics-taal. |
| Bank organizer helderheid | 5/10 | Krachtige engine, maar `/bank` maakt niet direct duidelijk: kies layout, tidy, copy naar RuneLite, klaar. |
| `/next` actionability | 7/10 | Main move is beter, maar route/backup/drilldown maakt eerste ervaring nog druk. |
| Ironman/UIM/GIM diepgang | 6/10 | Datamodel en tests zijn er, maar UI voelt nog niet echt als aparte Ironman route met helm-identiteit en sourcing-first stappen. |
| RuneLite plugin eenvoud | 7/10 | Geen zichtbare URL input meer. Chat/config copy is compacter, maar nog technisch rond CL, bank status en `/next` taal. |

## Top 10 Frictiepunten

### 1. Smart Tidy is nog geen slimme begeleide bankflow

Route: `/bank?sample=1`, `/bank?mode=tidy&rsn=lauky&from=next`

Waarom verwarrend: de speler ziet een grote banktool met `Tidy bank`, `Tidy`, `Use-case`, `Item type`, `Profile`, `Sort`, `Density`, `More`, ID-knoppen en daarna pas de bank. "Smart Tidy" voelt als een sorteerknop, niet als een begeleide keuze. Er is geen duidelijke stap: "1. kies hoe je speelt, 2. bekijk voor/na, 3. copy tabs naar RuneLite." De speler moet zelf beoordelen of "the layout looks usable".

Vermoedelijke bestanden:
- `src/components/bank-result.tsx`
- `src/lib/reorganize.ts`
- `src/lib/use-case-tabs.ts`
- `src/lib/bank-action-loop.ts`
- tests rond `bank-toolbar`, `bank-action-loop`, `snapshot`, `layout`

Type: grotere feature.

Regressierisico: hoog. Bank layout, export strings, drag/drop, filters en saved-bank flows zijn breed gekoppeld.

### 2. `/bank` maakt niet direct duidelijk waar je moet beginnen

Route: `/bank?rsn=lauky`

Waarom verwarrend: als er geen direct bruikbare saved-bank context is, opent de pagina op `Add bank` met Bank Memory uitleg, paste area, file upload, clear/save/sample. Dat is functioneel, maar niet OSRS-speler-first. Als er wel bankresultaat is, komt de organizer met veel controls boven de bank. In beide states ontbreekt een dominante spelerzin als: "Open RuneLite bank -> copy Bank Memory -> paste -> press Smart tidy -> copy tabs back."

Vermoedelijke bestanden:
- `src/app/bank/page.tsx`
- `src/components/intake.tsx`
- `src/components/bank-result.tsx`
- `src/lib/saved-bank.ts`
- `src/lib/account-storage.ts`

Type: quick win + grotere feature.

Regressierisico: medium. Copy en layout kunnen klein, maar saved-bank auto-load/account-specific storage moet voorzichtig.

### 3. Bank grid is visueel indrukwekkend maar start te laag en te technisch

Route: `/bank?sample=1`

Waarom verwarrend: de echte bank staat onder hero, why/help, preferences, stack colours, search, tab filters en warnings. Een OSRS-speler wil eerst zien: "dit is mijn bank, dit zijn de tabs, dit moet ik veranderen." Nu voelt het alsof de bank een output van een dashboard is in plaats van de primaire workspace.

Vermoedelijke bestanden:
- `src/components/bank-result.tsx`
- `src/components/bank-grid.tsx` indien aanwezig in split components
- `src/lib/bank-filler.ts`
- `src/lib/bank-search.ts`

Type: grotere feature.

Regressierisico: medium. De volgorde kan worden aangepast zonder engine changes, maar responsive gedrag en sticky controls zijn kwetsbaar.

### 4. `/next` is action-first, maar nog steeds druk door route/drilldown/backup lagen

Route: `/next?rsn=lauky&bank=local`

Waarom verwarrend: de pagina opent met `Main move`, maar daaronder staan snel `Backup moves`, `Route`, `More unlock moves`, `Unlock blockers`, `Routes to inspect`, `Almost there`. Voor gevorderde spelers is dat waardevol, maar voor een normale speler voelt het alsof er meerdere dashboards om aandacht vragen. Ook copy als "re-run /next", "bank signal" en "Route" trekt de speler uit de OSRS-context.

Vermoedelijke bestanden:
- `src/app/next/next-client.tsx`
- `src/lib/next-up.ts`
- `src/lib/recommendation-data-action.ts`
- `tests/next-client-confidence-copy.test.ts`

Type: quick win + grotere feature.

Regressierisico: medium. Copy en section ordering zijn relatief veilig; recommendation sequencing is gevoeliger.

### 5. Boss/DPS begint nog als vergelijker in plaats van "kan ik deze kill doen?"

Route: `/dps?rsn=lauky&from=bank&boss=bryophyta`

Waarom verwarrend: zelfs met bankcontext toont de pagina eerst boss picker, filters, sortering, DPS, style, weapon en GP/hr. In de modal staat inventory wel, maar na statblokken, quick picks, setup en upgrades. Een OSRS-speler verwacht bij Bryophyta eerst: "Neem dit mee, probeer 1 kill, stop als supplies te hard gaan, dit mis je."

Vermoedelijke bestanden:
- `src/app/dps/dps-client.tsx`
- `src/components/boss-detail-modal.tsx`
- `src/lib/boss-viability.ts`
- `src/lib/bosses.ts`
- `tests/boss-viability.test.ts`
- `tests/dps-empty-gear-copy.test.ts`

Type: grotere feature.

Regressierisico: medium-high. Modal state, boss filtering, deep links en bank handoff zitten in dezelfde flow.

### 6. Ironman/UIM/GIM bestaat technisch, maar mist productidentiteit

Route: `/next?rsn=lauky&bank=local`, quest/diary readiness tests, plugin sync payload

Waarom verwarrend: de engine heeft `ironman`, `hardcore`, `ultimate`, `group` en goede copy voor sourcing/staging. Maar de UI voelt nog niet als een aparte Ironman route. Er zijn geen duidelijke helmet badges per accounttype, geen routebrede "self-source first" checklist, geen GIM group-storage disclaimer op elk itembesluit, en UIM-staging is nog vooral tekst in readiness in plaats van een aparte workflow.

Vermoedelijke bestanden:
- `src/lib/account-type.ts`
- `src/lib/item-availability.ts`
- `src/lib/quest-requirements.ts`
- `src/lib/diary-requirements.ts`
- `src/app/next/next-client.tsx`
- `src/components/bank-result.tsx`
- `plugin/src/main/java/app/scapestack/runelite/GameStateReader.java`

Type: grotere feature.

Regressierisico: medium. Engine tests bestaan, maar UI regressies rond copy/status badges zijn waarschijnlijk.

### 7. RuneLite plugin is eenvoudiger, maar chatfeedback blijft deels technisch

Route: plugin code + `/plugin?rsn=lauky&from=next&bank=none#verify-sync`

Waarom verwarrend: URL input is weg en default endpoint is goed. Toch zegt de plugin nog dingen als `CL not loaded`, `CL opened, no item slots loaded`, `Open Scapestack /next`, `bank sync off`, `bank not opened this session`. Dat is nuttig, maar voelt als syncdiagnostiek. Voor een speler moet het meer klinken als: "Open Collection Log once so Scapestack can stop suggesting drops you already have."

Vermoedelijke bestanden:
- `plugin/src/main/java/app/scapestack/runelite/ScapestackSyncPlugin.java`
- `plugin/src/main/java/app/scapestack/runelite/ScapestackSyncConfig.java`
- `plugin/src/main/java/app/scapestack/runelite/CollectionLogReader.java`
- `plugin/src/test/java/app/scapestack/runelite/ScapestackSyncPluginTest.java`
- `src/app/plugin/page.tsx`
- `src/components/plugin-sync-checker.tsx`

Type: quick win.

Regressierisico: low-medium. Mostly copy/tests, but chat message tests are exact-string based.

### 8. Plugin setup pagina toont nog developer concepts in normale flow

Route: `/plugin?rsn=lauky&from=next&bank=none#verify-sync`

Waarom verwarrend: de normale setup is beter, maar de pagina toont bij unconfigured state nog `npm run db:init`, setup command, developer endpoint details en `Open /next`. Dat is logisch voor lokale dev, maar in een spelerflow voelt het alsof ScapeStack nog niet "af" is. Slash-route taal moet weg uit normale copy.

Vermoedelijke bestanden:
- `src/app/plugin/page.tsx`
- `src/components/plugin-sync-checker.tsx`
- `src/lib/plugin-sync-diagnostics.ts`
- `src/lib/plugin-sync-service.ts`

Type: quick win.

Regressierisico: low. Vooral copy en collapsed-dev visibility.

### 9. Diary unlocks zijn technisch goed, maar nog niet zichtbaar even concreet als quests

Route: `/next?rsn=lauky&bank=local`, tests `tests/diary-requirements.test.ts`

Waarom verwarrend: diary requirement matching heeft skill, quest, item, UIM en completed-tier tests. Maar in de zichtbare `/next` ervaring staat diary vaak tussen routes/unlocks, niet als een eigen "3 blockers left" kaart met tasks, items, payoff en stop point. De data is er, de productpresentatie moet nog scherper.

Vermoedelijke bestanden:
- `src/lib/diary-requirements.ts`
- `src/lib/diary-db.ts`
- `src/lib/next-up.ts`
- `src/app/next/next-client.tsx`
- mogelijke diary detail componenten/routes

Type: grotere feature.

Regressierisico: medium. Next Best Actions ordering en diary completion skip logic kunnen verschuiven.

### 10. Copy gebruikt nog producttaal in plaats van OSRS-spelertaal

Routes: `/`, `/next?rsn=lauky&bank=local`, `/bank?sample=1`, `/plugin?rsn=lauky&from=next&bank=none#verify-sync`

Waarom verwarrend: voorbeelden uit de browsercheck: `Routes`, `Unlock board`, `Before you go`, `Use-case`, `Profile`, `Density`, `More unlock moves`, `bank signal`, `re-run /next`, `CL`, `bank sync off`, `57 bosses checked`. Dit zijn geen foute woorden, maar ze maken het geheel meer tool/dashboard dan premium OSRS planner.

Vermoedelijke bestanden:
- `src/app/page.tsx`
- `src/app/next/next-client.tsx`
- `src/components/bank-result.tsx`
- `src/app/dps/dps-client.tsx`
- `src/components/boss-detail-modal.tsx`
- `src/app/plugin/page.tsx`
- copy contract tests

Type: quick win.

Regressierisico: low-medium. Exact-string tests moeten mee.

## Conclusie

ScapeStack staat inhoudelijk veel verder dan een generiek dashboard: sync, accounttypes, quest/diary readiness, bank context, next best actions en DPS/boss checks bestaan. De grootste resterende zwakte is productcompositie. Te veel schermen tonen nog eerst controls, stats of systeemstatus voordat ze de speler begeleiden naar een concrete OSRS-handeling.

De hoogste-impact volgende slag is niet nog meer data toevoegen, maar drie flows opnieuw prioriteren:

1. Bank: van organizerpanel naar "RuneLite bank tidy wizard".
2. DPS: van boss vergelijker naar "one kill loadout verdict".
3. Ironman routes: van accounttype-label naar echte sourcing/staging route met helm-identiteit.
