# ScapeStack Product Reset Audit

Datum: 2026-07-09  
Scope: fase 1 audit, geen product- of codewijzigingen.  
Repos: webapp `osrs-bank-organizer`, RuneLite plugin `scapestack-runelite-plugin`.

## Samenvatting

ScapeStack is duidelijk opgeschoven van losse tools naar een trip-planner: de homepage is rustiger, `/next` heeft een echte tripkaart, Smart Tidy heeft een wizard, en accounttypes sturen delen van de logica. Toch voelt het product nog vaak als een dashboard/toolbox omdat de eerste laag nog te veel ScapeStack-systemen toont: route lenses, readiness panels, DPS-metrics, syncstatus, bankcategorieen en context-banners.

De normale OSRS-speler moet binnen drie seconden zien: waarheen, wat pakken, wat mist, wanneer klaar, en wat veranderde sinds RuneLite-sync. Die antwoorden bestaan verspreid in de app, maar zijn nog niet dominant genoeg als dagelijkse return loop.

## Evidence en beperkingen

Gelezen webappbestanden:
- `src/app/page.tsx`
- `src/app/next/next-client.tsx`
- `src/lib/next-up.ts`
- `src/lib/action-plan-text.ts`
- `src/components/bank-result.tsx`
- `src/lib/reorganize.ts`
- `src/lib/use-case-tabs.ts`
- `src/app/dps/dps-client.tsx`
- `src/components/boss-detail-modal.tsx`
- `src/lib/account-type.ts`
- `src/lib/item-availability.ts`
- `src/lib/quest-requirements.ts`
- `src/lib/diary-requirements.ts`
- `src/lib/sync-repo.ts`
- aanvullend: `src/app/bank/page.tsx`, `src/app/plugin/page.tsx`, relevante sync/plugin/quest helpers.

Gelezen tests: homepage-copy, no-dashboard-copy, product-contract, `/next` action plans, next best actions, confidence copy, plugin-sync summary, Smart Tidy wizard, account mode badge, account type, item availability, plugin payload/config/chat tests.

Gelezen pluginbestanden: `ScapestackSyncPlugin.java`, `ScapestackSyncConfig.java`, `GameStateReader.java`, `CollectionLogReader.java`, `ClaimClient.java`, `ServerResponseSummary.java`, `SyncGate.java`, `SyncServiceReadiness.java`, `README.md`.

Gecontroleerde routes via lokale devserver, HTTP/SSR en beschikbare visuele evidence:
- `/`
- `/next?sample=1`
- `/bank?mode=tidy&sample=1`
- `/dps?boss=zulrah&bank=none`
- `/plugin?rsn=Scapestack&from=next#verify-sync`

Niet volledig interactief geverifieerd, omdat browserautomatisering bleef hangen en volgens opdracht is losgelaten:
- `/next` met vooraf gevulde saved bank plus saved RSN in `localStorage`.
- Client-side sample-run na klikken op "Try a sample plan".
- `/bank` na echt client-side opslaan van een bank.
- Smart Tidy wizard tot RuneLite copy/export in gehydrateerde browser.
- DPS-modal clicks voor normale boss, Wintertodt/Tempoross en HCIM Wilderness-boss.
- Mobile hydrated states met saved data.

Deze audit gebruikt daarom HTTP-, code-, test-, commit- en screenshot-evidence. Browserstate-claims zijn als afgeleid behandeld waar ze niet end-to-end bewezen zijn.

## Scores

| Dimensie | Score | Korte reden |
| --- | ---: | --- |
| Eerste 3 seconden | 6/10 | Homepage is helder, maar returning/sync-context ontbreekt; `/next` toont nog keuzes en panels. |
| Premium gevoel | 6/10 | Rustiger UI, maar toolrails, support/coffee en veel secondary panels maken het utilitair. |
| OSRS-specificiteit | 7/10 | Veel OSRS-data, maar vaak nog checklist/readiness in plaats van route/inventory/finish. |
| `/next` actionability | 6/10 | Tripkaart is goed, maar alternatieven en context concurreren met het antwoord. |
| Bank organizer helderheid | 5/10 | "Paste once" is duidelijk; "begin hier met je bank" is nog zwak. |
| Smart Tidy bruikbaarheid | 5/10 | Wizard helpt, maar voelt als sort/export, niet als echte RuneLite setup. |
| Retentiewaarde na sync | 4/10 | Latest delta bestaat, maar geen sterke historische "sinds vorige sessie" loop. |
| Ironman/HCIM/UIM/GIM diepgang | 5/10 | Sommige beslissingen veranderen, maar vaak blijft het badge/note. |
| Boss-flow | 5/10 | Modal helpt, maar `/dps` blijft calculator-first; activities vallen uit de hoofdflow. |
| RuneLite plugin eenvoud | 5/10 | Config is klein, maar chatmeldingen zijn count/status-first en passief. |

## Top 10 frictiepunten

### 1. `/next` voelt nog als plannerbord

Route/scherm: `/next`.

Wat de speler ziet: "Pick today's trip", route lenses, een hoofdtripkaart, maar ook route lanes, best actions, quest rail, bank progress en "make plan smarter".

Waarom niet natuurlijk: de speler zoekt "waarheen, wat pakken, wat mist, wanneer klaar"; de UI start nog deels bij ScapeStack-keuzes en context.

Oorzaak: `NextIntake` en `ResultView` in `src/app/next/next-client.tsx` dragen onboarding, routekeuze, pluginstatus, alternatieven en planning tegelijk. `src/lib/next-up.ts` levert brede recommendations.

Bestanden: `src/app/next/next-client.tsx`, `src/lib/next-up.ts`, `src/lib/action-plan-text.ts`, product-contract tests.

Wijziging: quick win: eerste viewport alleen tripkaart plus compacte "Using: RSN/bank/RuneLite" strip. Structureel: session-plan model met alternatieven pas na "niet deze".

Regressierisico: hoog; veel tests en links verwachten bestaande panels.

### 2. Sync is nog geen return loop

Route/scherm: `/next`, `/plugin`, plugin chat.

Wat de speler ziet: "Last RuneLite scan", freshness, counters en status.

Waarom niet natuurlijk: "24 skills, 180 quests" voelt technisch; "sinds vorige sync kun je nu Barrows doen" geeft reden om terug te komen.

Oorzaak: `src/lib/sync-repo.ts` bewaart latest row en delta, geen `sync_history`. Plugin success-copy in `ScapestackSyncPlugin.java` is count-first.

Bestanden: `src/lib/sync-repo.ts`, `src/lib/next-plugin-sync-summary.ts`, `src/app/next/next-client.tsx`, `src/app/plugin/page.tsx`, `ScapestackSyncPlugin.java`.

Wijziging: quick win: bovenaan `/next` "Nieuw sinds laatste sync" met gameplay-gevolgen. Structureel: sync history/session feed.

Regressierisico: medium/hoog; datamodel en plugin tests raken.

### 3. Bankpagina zegt niet scherp waar te beginnen

Route/scherm: `/bank`, `/bank?mode=tidy`.

Wat de speler ziet: "Add bank", "Paste once. Save. Better trips everywhere." Met saved bank opent output snel.

Waarom niet natuurlijk: een speler wil weten of eerst teleports, supplies, gear of quest items gefixt moeten worden.

Oorzaak: `src/app/bank/page.tsx` focust op input/auto-open; `buildBankDecision` in `src/components/bank-result.tsx` is niet dominant genoeg.

Bestanden: `src/app/bank/page.tsx`, `src/components/bank-result.tsx`, `src/lib/bank-tags.ts`.

Wijziging: quick win: "Start here" strip met eerste bankactie. Structureel: bankflow koppelen aan een concrete volgende trip.

Regressierisico: medium.

### 4. Smart Tidy is geen volledige RuneLite setup

Route/scherm: Smart Tidy.

Wat de speler ziet: presets, tabvolgorde en copy/export.

Waarom niet natuurlijk: RuneLite setup betekent voor spelers tags, tabs, gearsets, importstappen en klaar zijn voor een trip; niet alleen sorteren.

Oorzaak: `src/lib/reorganize.ts` sorteert/dense-packt items; `src/lib/use-case-tabs.ts` bouwt brede categorie-tabs; wizard zit erbovenop.

Bestanden: `src/components/bank-result.tsx`, `src/lib/reorganize.ts`, `src/lib/use-case-tabs.ts`, Smart Tidy tests.

Wijziging: quick win: expliciete "RuneLite tab order" en "Tonight tab". Structureel: per trip/accounttype echte Bank Tags setup genereren.

Regressierisico: medium.

### 5. Accounttype is nog te vaak badge/note

Route/scherm: `/next`, `/bank`, questdetail, diaries, bossing.

Wat de speler ziet: mode badges en notes; soms aangepaste ranking, money recs, UIM staging of HCIM risk.

Waarom niet natuurlijk: UIM, HCIM en GIM verwachten andere routes, niet dezelfde flow met waarschuwing.

Oorzaak: `src/lib/account-type.ts` en `src/lib/item-availability.ts` zijn goed begonnen, maar GIM storage ontbreekt, hardcore GIM wordt `group`, en UI houdt vaak dezelfde basisstructuur.

Bestanden: `src/lib/account-type.ts`, `src/lib/item-availability.ts`, `src/lib/next-up.ts`, quest/diary libs, DPS files, `GameStateReader.java`.

Wijziging: quick win: per flow "Because you are X" als beslissing. Structureel: accounttype policy per route.

Regressierisico: hoog.

### 6. Quest/diary readiness blijft checklistachtig

Route/scherm: questdetail, diary readiness, `/next` recs.

Wat de speler ziet: missing skills, prereqs, item requirements en readiness labels.

Waarom niet natuurlijk: dit lijkt op wiki/checklist; ScapeStack moet vertalen naar route, inventory, teleport, finish, sync.

Oorzaak: `quest-requirements` en `diary-requirements` evalueren requirements correct, maar triprecepten zijn beperkt.

Bestanden: `src/lib/quest-requirements.ts`, `src/lib/diary-requirements.ts`, `src/app/quests/[slug]/quest-detail-client.tsx`, `src/lib/next-up.ts`.

Wijziging: quick win: bovenaan "Go / Bring / Missing / Stop after / Sync after". Structureel: quest/diary recipes als OSRS-tripstappen.

Regressierisico: medium.

### 7. Bossing blijft calculator-first

Route/scherm: `/dps`, boss modal, Wintertodt/Tempoross, HCIM Wilderness.

Wat de speler ziet: DPS, KPH, accuracy, loot pace, setup links; zonder bank "Add bank for Zulrah".

Waarom niet natuurlijk: de primaire vraag is "kan ik een trip doen?", niet "wat is mijn DPS?". Activities horen activity prep te tonen.

Oorzaak: `src/app/dps/dps-client.tsx` filtert results naar hp/weaknesses en sorteert rond combat metrics. Modal heeft activity helpers, maar main list sluit activiteiten praktisch uit.

Bestanden: `src/app/dps/dps-client.tsx`, `src/components/boss-detail-modal.tsx`, boss/DPS data.

Wijziging: quick win: boss cards primair trip verdict; Wintertodt/Tempoross activity empty state. Structureel: aparte boss trip picker naast calculator.

Regressierisico: medium.

### 8. Pluginmeldingen zijn technisch/passief

Route/scherm: RuneLite config, chat, Collection Log-flow, `/plugin`.

Wat de speler ziet: toggles en chatregels met counts, bankstatus en CL-instructies.

Waarom niet natuurlijk: de plugin moet zeggen wat de speler nu kan doen, niet alleen dat data is bijgewerkt.

Oorzaak: geen pluginpanel; `ScapestackSyncPlugin.java` bouwt count-first messages. `CollectionLogReader.java` vereist handmatig openen/klikken van CL tabs.

Bestanden: `ScapestackSyncConfig.java`, `ScapestackSyncPlugin.java`, `CollectionLogReader.java`, `GameStateReader.java`, plugin tests.

Wijziging: quick win: "Updated ScapeStack. New: X. Open /next for Y." Structureel: pluginpanel met latest sync, missing capture en route action.

Regressierisico: medium.

### 9. Homepage mist returning-player context

Route/scherm: `/`.

Wat de speler ziet: "OSRS trip picker", "Stop bankstanding. Pick the next trip.", RSN input en boss preview.

Waarom niet natuurlijk: goed voor eerste bezoek, maar niet voor "ik kom terug na RuneLite-sync".

Oorzaak: `src/app/page.tsx` gebruikt algemene hero/intake en lijkt saved sync/bank state niet als primaire first viewport te maken.

Bestanden: `src/app/page.tsx`, `src/components/hero-intake.tsx`, homepage tests.

Wijziging: quick win: bij saved RSN/bank "Welcome back: X changed, next trip Y". Structureel: homepage als return hub.

Regressierisico: laag/medium.

### 10. Informatiearchitectuur blijft toolbox

Route/scherm: globale nav, `/next`, `/bank`, `/dps`, `/plugin`.

Wat de speler ziet: Plan, Bank, Check kill, Add RSN, support, mood/vibe, plugin guide.

Waarom niet natuurlijk: spelers denken in sessies, niet modules.

Oorzaak: product is per tool gegroeid; tests bannen dashboardwoorden maar niet toolbox-architectuur.

Bestanden: hoofdroutebestanden, header/nav, product copy tests.

Wijziging: quick win: "Plan" als default; Bank/Boss/Plugin als context binnen trip. Structureel: IA rond "Next session".

Regressierisico: hoog.

## Expliciete auditantwoorden

`/next` toont nog systeemdenken: ja. De dashboardwoorden zijn grotendeels weg, maar route lenses, panels, lanes en context maken het nog dashboardachtig.

Bankpagina startpunt: gedeeltelijk. "Paste once" is duidelijk, maar de pagina zegt niet direct genoeg welke bankactie eerst moet.

Smart Tidy als RuneLite setup: deels. Het is een wizard voor sort/export, nog geen volledige RuneLite trip setup.

Historische sync-diffs: onvoldoende. Er is latest delta, geen overtuigende geschiedenis of sessiefeed.

Accounttype als badge: deels opgelost, maar nog niet diep genoeg. UIM/GIM/HCIM veranderen niet consequent de hele flow.

Quest/diary readiness: nog wiki/checklistachtig. Requirements zijn correcter dan de productflow.

Bossing: nog calculator-first. DPS/KPH/accuracy zijn te dominant; activities en HCIM risk moeten route-first.

Pluginmeldingen: technisch/passief. Counts en status overheersen boven "wat nu doen".

## Aanbevolen volgorde fase 2-10

1. Fase 2: `/next` reset naar een enkele sessie-opdracht.
2. Fase 3: sync history en "sinds vorige sessie" return loop.
3. Fase 4: bank en Smart Tidy als echte RuneLite setup.
4. Fase 5: accounttype decision policies.
5. Fase 6: questdetail en diary readiness als triprecepten.
6. Fase 7: boss/activity trip picker, calculator secundair.
7. Fase 8: RuneLite pluginmeldingen en eventueel panel.
8. Fase 9: homepage voor returning players.
9. Fase 10: IA opruimen, premium polish en regressietests op first viewport.

## UI verwijderen, verbergen of samenvoegen

- Route lens grid op `/next` achter "Change plan".
- Route lanes, extra recommendations, quest rail en bank progress achter "Not this trip?".
- `MakePlanSmarter` alleen tonen als het plan echt zwak is.
- Saved bank banner, plugin banner en RSN context samenvoegen tot een "Using" strip.
- Support/coffee uit eerste waarde-ervaringen halen.
- Developer/self-hosting endpoint op `/plugin` standaard verbergen.
- Skilling/minigame filter in `/dps` verbergen of hernoemen tot activities werken.
- Boss slugs, DPS assumptions, accuracy en GP/hr uit primaire cards halen.
- Bank diagnostics/tips/suggestions achter eerste bankactie collapsen.
- Plan/Bank/Check kill mentaal samenbrengen onder "Next session".

## Definitie van "af" per hoofdflow

Homepage is af als nieuwe spelers de trip-belofte begrijpen en returning spelers direct zien wat sinds sync veranderde.

`/next` is af als de eerste viewport antwoordt: waarheen, wat pakken, wat mist, wanneer klaar, wat veranderde sinds sync.

`/bank` is af als de eerste output een concrete bankactie geeft, niet alleen organizer-output.

Smart Tidy is af als de speler een RuneLite-ready trip/tab/tag setup krijgt met missing-items en importstappen.

Questdetail is af als het route-first is: go, bring, missing, finish after, sync after.

Diary readiness is af als de app per tier de dichtstbijzijnde tasks met teleports, items, danger en accounttype toont.

Boss-flow is af als "kan ik een trip doen?" primair is en DPS detailinformatie is. Activities en HCIM Wilderness krijgen eigen beleid.

RuneLite plugin is af als syncmeldingen zeggen wat veranderde en welke ScapeStack route nu geopend moet worden.

Accounttypes zijn af als Normal, Ironman, HCIM, UIM en GIM aanbevelingen, sourcing, risk, staging en stopcondities echt veranderen.

Retentie is af als elke sync een sessieverhaal oplevert: klaar, nieuw beschikbaar, nog geblokkeerd, beste volgende trip.
