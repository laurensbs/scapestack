# Scapestack retention audit - 2026-07-15

Fase 0 audit. Geen implementatie in deze fase. Doel: scherp krijgen waarom Scapestack nog niet voelt als een tool waar een OSRS-speler dagelijks naar terugkomt, en welke product/UI-richting de volgende fases moeten volgen.

## 1. Waarom mensen niet terugkomen

Scapestack lost nu vooral een eerste vraag op: "wat moet ik nu doen?" Dat is sterk, maar nog niet genoeg voor terugkeer. Een speler komt pas terug als Scapestack voelt als een sessieboek, gear-checker en account-memory tegelijk.

De grootste gaten:

1. **Geen levende voortgangslus**
   - Wise Old Man bouwt retention rond snapshots, gains, records, achievements, groups en competitions. Hun homepage noemt historische hiscore tracking, gains, records, leaderboards, clan progress en Discord updates.
   - Scapestack geeft een route, maar laat daarna te weinig zien: wat heb ik sinds de laatste scan gedaan, wat veranderde daardoor, welke stop point is nu afgevinkt, wat is de volgende logische stap?

2. **Te weinig bewijs dat het advies account-specifiek is**
   - De app zegt soms dat RuneLite of bank helpt, maar het bewijs voelt abstract.
   - Een speler wil zinnen als: "Je hebt 312 raw sharks, genoeg voor ~X Cooking XP", "Geen salve amulet gevonden, Vorkath blijft backup", "Karamja gloves 3/4: deze diary task mist nog".

3. **Tools voelen nog als losse routes**
   - `/next`, `/bank`, `/dps`, `/goals` en `/plugin` delen wel account-state, maar de ervaring voelt niet altijd als een enkel companion-systeem.
   - De beste richting is: 1 account boven alles, dan overal dezelfde simpele acties: Plan trip, Add bank, Check kill, Check RuneLite, Unlock.

4. **Te veel uitleg waar een speler een beslissing verwacht**
   - OSRS-spelers willen snel zien: kan ik weg van de bank, wat moet ik meenemen, waar stop ik, wat unlockt dit?
   - Panels met status, context, filters en labels halen focus weg van de actie.

5. **Nog te weinig "actually useful" momenten**
   - De app moet vaker hard kiezen:
     - "You can kill Vorkath, but missing Salve makes it worse."
     - "Your bank supports Zulrah, but supplies are low."
     - "Do this diary before more Slayer."
     - "This boss is not worth it yet; unlock X first."
     - "Cooking to 99 needs X XP; your bank covers Y XP."

## 2. Waar de UI nog dashboard voelt

Homepage is nu relatief sterk: groot OSRS-gevoel, duidelijke RSN-intake, boss/image focus. De grootste dashboard-lekken zitten in de toolroutes.

1. **Header/status chrome**
   - `src/components/current-run-bar.tsx` toont nog een pill-rail met RSN, bank, RuneLite en vibe. Dat is handig, maar voelt als setup-status.
   - Dit moet meer als account menu + checkmarks voelen, niet als permanente contextbalk.

2. **/next**
   - `src/app/next/next-client.tsx` heeft een goede primaire kaart, maar de laag eromheen voelt nog analytisch: sync summary, route timeline, details, status strips, "After this", "Want something else", "Why recommended".
   - De speler moet boven de fold alleen zien:
     - Do this first
     - waarom voor mij
     - bring
     - stop at
     - twee grote alternatieven
   - Dieper bewijs moet in een modal, niet in panels onder elkaar.

3. **/dps**
   - `src/app/dps/dps-client.tsx` is al beter als boss grid, maar heeft nog sort/filter/DPS/GP/hr taal en kleine kaartjes.
   - De juiste vorm is een boss picker: grote clickable boss tiles met image, "Can kill / needs X / skip for now", en daarna een boss detail modal met owned setup, missing upgrade, inventory and supply plan.

4. **/goals**
   - `src/app/goals/goals-client.tsx` heeft nog progress/cards/filter-denken.
   - Unlocks moeten voelen als item/reward cards: grote Karamja gloves, Elite void, Ardougne cloak, crystal equipment. Klikken opent een checklist met what is done, what is missing, why it matters.

5. **/bank**
   - `src/app/bank/page.tsx` is verbeterd, maar Add bank moet overal een popup zijn. `/bank` moet de organizer/workbench blijven, niet de eerste stap voor elke context.
   - Bank paste moet: paste, how-to screenshot, save. Organizer pas daarna.

6. **Copy en labels**
   - Woorden als "status", "context", "detected", "source", "ready", "optional", "setup", "progress" voelen snel dashboardachtig.
   - Gebruik liever OSRS-acties: Bring, Start, Stop at, Skip for now, Worth doing, Missing, Bank has, Buy, Fish first, Sync again.

## 3. Wat Wise Old Man beter doet voor retention

Wise Old Man is geen session planner, maar het wint op terugkeer doordat het een historisch accountgeheugen heeft. Volgens hun eigen site bouwen ze rond hiscore snapshots, gains, all-time records, achievements, leaderboards, groups, competitions, clan progress en Discord updates. Hun player pages tonen ook tabs als Overview, Gained, Competitions, Groups, Records, Achievements en Name Changes.

Wat Scapestack hiervan moet lenen zonder een dashboard te worden:

1. **Daily delta, niet charts**
   - Toon: "Since last scan: +142k Cooking XP, 3 diary tasks, 12 Vorkath KC."
   - Niet als grafiek bovenaan, maar als kleine "What changed" strip na de primaire route.

2. **Streak/return hook**
   - "Last trip ended at 38 Vorkath KC. Clean stop: 50 KC."
   - "You said Short last time; want another short route?"

3. **Account profile memory**
   - Een vaste account home: `/u/lauky`.
   - Laatste bank, laatste RuneLite scan, last mood, started route, done routes.

4. **Social proof later, niet nu**
   - Groups/competitions zijn sterk voor WOM, maar Scapestack moet eerst solo useful worden.
   - Later: clan route ideas, weekly anti-bankstanding challenge, "what your group is doing tonight".

Bronnen: [Wise Old Man homepage](https://wiseoldman.net/), [Wise Old Man GitHub](https://github.com/wise-old-man/wise-old-man), [Wise Old Man player example](https://wiseoldman.net/players/osrs%20send%20it).

## 4. Wat RuneLite/Wiki beter doen voor trust

RuneLite wint vertrouwen omdat het dicht bij de game zit en passief werkt. De Loot Tracker bewaart loot per event en kan loot via de RuneLite account onthouden. De XP Tracker toont sessie-XP, XP/hr, actions/hr en actions performed. Dat zijn concrete gameplay-termen, niet product-termen.

Scapestack moet RuneLite-data daarom presenteren als:

- "Last scan: Jun 28, 10:51 AM"
- "Skipped finished quests, diary steps, clog slots and Slayer mistakes."
- "Synced after your last stop point."

Niet als:

- "sync status"
- "payload"
- "data source"
- "readiness"

De Wiki en boss guides winnen vertrouwen door concrete setups: gear, inventory, minimum/budget/max, supplies and mechanics. Een Vorkath guide noemt bijvoorbeeld minimum ranged setup, salve amulet, bolts, potions, food and teleport. Scapestack moet dat vertalen naar "from your bank" in plaats van generieke gear advice.

Bronnen: [RuneLite Loot Tracker](https://github.com/runelite/runelite/wiki/Loot-Tracker), [RuneLite XP Tracker](https://github.com/runelite/runelite/wiki/XP-Tracker/c2120652d2317e708491e94ed3864dac65df797d), [Theoatrix Vorkath guide](https://www.theoatrix.net/post/vorkath-guide-osrs), [DropTracker](https://www.droptracker.io/).

## 5. Refero reference lock

### Primary visual direction

1. **Chantlings** (`1c90b38a-6941-472d-afc9-40a7d42e8bec`, iorama.studio/chantlings)
   - Dark fantasy, moonlit, refined serif, warm glow, negative space.
   - Use for OSRS companion atmosphere.

2. **Krea** (`3a63b3fa-dc79-4dc3-935e-3f8f4ab447a7`, krea.ai)
   - Near-black, luminous white, tight hierarchy, restrained surfaces.
   - Use for product clarity and avoiding clutter.

3. **Wayfinder** (`168f20ae-b58e-4781-b9b8-46b2d9b81b5f`, wayfinder.nfb.ca)
   - Storytelling interface, dark immersive scene, UI integrated into content.
   - Use for "journey/route" feeling instead of dashboard blocks.

### Secondary pattern references

1. **Selectable card modal**
   - Huddlekit and Kickstarter patterns: centered modal, 2-3 large choices, one CTA.
   - Use for mood picker, first-time setup, Add Bank, Add RuneLite.

2. **Searchable grid picker**
   - Partiful GIF picker (`6b4e4c23-b297-4d9c-a552-86424b5b9592`) and YouTube "Choose specific video" (`6ce2aec5-fabf-4a8b-ae5f-87664568e809`): modal with search + visual grid.
   - Use for boss picker, item picker, unlock picker.

3. **Onboarding preference cards**
   - Cursor (`5c2d176b-8d08-4cf1-a6c3-a0175e0f34a3`), ElevenMusic (`9f08dee9-7c90-4edd-b99c-1e914dc044ec`), Netflix title selection (`903c3dbf-4a66-4aab-a290-664da8b3dcb8`).
   - Use for "what are you in the mood for?" immediately after first RSN.

### Explicit rejects

- OpenSea/Linear/Fey-style data grids: too dashboard and too financial/SaaS.
- Midjourney-style AI lab: too AI-wrapper.
- Settings sidebars: useful for admin tools, wrong for OSRS session planning.
- Excessive nested cards: makes every route feel like a report.

## 6. Nieuwe UI-principes

1. **One decision per screen**
   - Homepage: enter RSN.
   - /next: do this first.
   - /dps: pick a boss.
   - /goals: pick an unlock.
   - /bank: organize bank, not explain bank.

2. **Modals for setup, pages for play**
   - Add bank, RuneLite sync, mood selection and account switching are modals.
   - Planner, boss picker, goals and bank organizer are pages.

3. **Proof in one sentence**
   - Every recommendation gets one account-specific proof line.
   - Example: "Bank has enough raw sharks for ~220k Cooking XP; fish more before pushing 99."

4. **OSRS object first**
   - Show boss/item/skill icon large.
   - Text explains what to do with it.
   - Avoid abstract state boxes.

5. **Bigger clickable surfaces**
   - Bosses, backups, unlocks and route choices should be full tiles.
   - Remove "Open details" links where the card itself can be clicked.

6. **Mobile-first by default**
   - Cards stack.
   - Modals are bottom sheets on mobile.
   - Primary action is thumb-reachable.

7. **Silent intelligence**
   - RuneLite and bank only appear as checkmarks, stale scan warnings or missing-context prompts.
   - Never as a dashboard above the main decision.

## 7. Top 10 concrete code changes in impactvolgorde

1. **Account home and memory loop**
   - Build a single account layer around saved RSN, saved bank, last RuneLite scan, last vibe, started route and completed stop points.
   - Touch: `src/components/header.tsx`, `src/components/account-switcher.tsx`, storage libs, homepage intake, `/next`.

2. **Replace status rails with account menu**
   - Remove or shrink `CurrentRunBar` from primary chrome. Keep checkmarks inside account dropdown and first-time modal.
   - Touch: `src/components/current-run-bar.tsx`, `src/components/header.tsx`.

3. **Make /next a route card, not report page**
   - Keep one primary card and two large alternatives. Move "why", route chain and what changed into modals.
   - Touch: `src/app/next/next-client.tsx`.

4. **Bank-aware skill planning**
   - Add banked XP and supply coverage for all relevant skills, not only Cooking.
   - Example: Cooking raw fish, Herblore herbs/secondaries, Prayer bones/ashes, Crafting hides/gems, Smithing bars/ores, Fletching logs/bows, Construction planks.
   - Touch: `src/lib/next-up.ts`, bank parsing libs, tests.

5. **Boss picker redesign**
   - `/dps` first view becomes large boss tiles + search. Click opens detail modal with owned gear, inventory, missing upgrade and "try one trip".
   - Touch: `src/app/dps/dps-client.tsx`, boss viability/loadout libs.

6. **Inventory setup per boss**
   - For every boss verdict, generate best owned setup and best inventory from bank. If missing, show "buy/farm these first".
   - Touch: DPS data, bank item mapping, tests.

7. **Unlock companion**
   - `/goals` becomes reward-first: large unlock cards, click-to-open checklist, manual tick-offs, RuneLite checkmarks when known.
   - Touch: `src/app/goals/goals-client.tsx`, goal data, path detail modal.

8. **Global Add Bank modal**
   - Add bank from homepage/header/next/dps/goals opens the same compact modal with paste, screenshot how-to and Save. `/bank` remains organizer.
   - Touch: bank components, header, hero intake, route CTAs.

9. **RuneLite refresh copy and stale scan logic**
   - Replace "RuneLite later/old" with exact scan time and refresh CTA.
   - Touch: plugin page, `next-plugin-sync-summary`, header account menu.

10. **Copy/test hardening**
   - Extend banned copy tests and add interaction tests for card clickability, vibe-aware randomize, no duplicate Add bank after saved bank, no technical rails above fold.
   - Touch: `tests/no-dashboard-copy.test.ts`, `tests/homepage-copy.test.ts`, `tests/next-client-confidence-copy.test.ts`, `tests/dps-row-affordance.test.ts`, `tests/goals-data-source-copy.test.ts`.

## 8. Welke tests toegevoegd of aangepast moeten worden

1. **Vibe-aware randomize**
   - Chill/AFK randomize cannot pick raids or intense bossing.
   - GP randomize prefers money routes.
   - Bossing randomize can pick bosses only if bank/gear/account supports it.

2. **Saved account flow**
   - First RSN is saved automatically.
   - Removing account clears welcome-back state and active selection.
   - Opening bank with an active RSN auto-attaches that bank to the account without showing duplicate OSRS name input.

3. **Bank added state**
   - If bank is saved, no top-level "Add bank" CTA remains unless the action is "refresh bank".

4. **Banked skill XP**
   - Cooking detects raw fish.
   - Herblore detects herbs and secondaries.
   - Prayer detects bones/ashes.
   - Crafting detects banked materials.
   - Recommendations show XP left, bank covers, and missing amount.

5. **DPS boss grid**
   - Boss cards are clickable as full tiles.
   - No "Open details" link is required.
   - Detail modal shows owned setup, missing upgrade and inventory.

6. **Goals unlock drilldown**
   - Karamja gloves opens as a reward modal.
   - Completed prerequisites are checked.
   - Missing tasks can be manually ticked.
   - Elite void implies normal void prerequisites.

7. **Player-facing copy bans**
   - Continue banning: signals, payload, readiness, data source, Plugin Hub, PR, exact account state.
   - Add soft bans in top-level UI: status, detected, context, source, optional, ready when used as dashboard labels.

8. **Visual hierarchy smoke tests**
   - Mobile: no overlap, primary route visible without scrolling too far.
   - Desktop: no status panel above the main action.
   - Add screenshots for homepage, /next, /dps, /goals, bank modal.

## Phase 1 start recommendation

Start with account memory + modal setup, not another visual polish pass. The current design direction is close enough visually; the product still loses retention because the app does not yet remember the player deeply enough or prove that bank/RuneLite changed the advice.

Fase 1 should implement:

1. Account memory cleanup.
2. First-time RSN -> mood modal -> optional bank/RuneLite modals.
3. Remove duplicate account/status rails.
4. Stale RuneLite timestamp copy.
5. Tests for removal, saved account, saved bank and mood popup.
