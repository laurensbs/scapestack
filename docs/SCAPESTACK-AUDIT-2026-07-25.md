# Scapestack — geverifieerde verbeterpunten

Audit van 2026-07-25. Acht dimensies, elk door een aparte agent onderzocht en
daarna door een tweede agent adversarieel gecontroleerd met de opdracht de
bevinding te weerleggen. Alleen wat die controle overleefde staat hieronder.

Veel titels bevatten een correctie van de verificatiestap — dat is bewust: de
oorspronkelijke claim was daar te breed of deels onjuist.

**48 bevindingen** — 3 kritiek, 13 hoog, 15 middel, 17 laag.

---

## Kritiek (3)

### K1. The "Bossing" mood returns zero recommendations for every account without a bank — /next renders a dead empty state

**Dimensie:** Engine-logica · **Bestand:** `src/lib/mood.ts:392`

The "Bossing" mood returns zero recommendations for every account without a bank — /next renders a dead empty state

**Wat de speler merkt**
The product promise is "type your RSN and get one thing to do". A player who does that and taps the Bossing tile (SESSION_MOOD_GRID_CHOICES in next-client.tsx:4398, defaults to 120 min) gets next-client.tsx:5313 "No safe trip fits this exact mood and time yet. Pick another vibe or a longer session." — even when the engine produced 6 perfectly good boss recs. The same dead end hits the "Boss log" route lens (moodForRouteLens maps it to bossing) and the legacy "Focused" mood. It only works if the player pasted a bank or has a plugin bank sync.

**Voorgestelde fix**
Treat unknown setup as a soft penalty, not a hard eligibility violation, for the bossing/focused path: keep `wilderness && setupConfidence !== "verified"` hard, but demote the bare `setupConfidence === "unknown"` check to a scoring penalty (it already exists as `uncertain_gear_gate` in recommendation-ranking.ts). Alternatively, have pickForRoute fall back to the best hard-violating candidate when `scored.length === 0` rather than returning null. Add a regression test that runs computeNextUp on a hiscores-only profile and asserts pickForRoute(recs, "bossing", 120, "boss-log") is non-null — current tests (tests/mood.test.ts) only use hand-built recs with explicit gearConfidence, so they never exercise this.

<details><summary>Verificatienotitie</summary>

Reproduced independently end to end. mood.ts:389-394 applies `if (profile.setupConfidence === "unknown") violations.push("setup")` to ALL bossing candidates, and bossing only admits kind boss/kc/pvm-slayer. recommendation-session.ts:89-95+154 maps gearConfidence "unknown" -> setupConfidence "unknown"; next-up-bosses.ts:229-236 and next-up-kc.ts:151-155/296 both emit "unknown" whenever bank.length === 0, and next-up.ts:323/329 does the same for the plugin Slayer-task rec (sessionProfile.setupConfidence: decision.bankUsed ? "verified" : "unknown"), so even a RuneLite-synced Slayer task cannot rescue it. recommendation-ranking.ts:256/270 drops hard-violation candidates and mood.ts:663 returns null. My probes: MAXED 2277 no bank (15 recs) bossing=EMPTY, MID main CL~100 no bank (42 recs) bossing=EMPTY, IRONMAN mid no bank (36 recs) bossing=EMPTY, MID main WITH bank bossing=ok. Legacy "focused" is EMPTY too via contractMood (mood.ts:350-352). A CL~115 PvM main with 900 Vorkath / 512 ToA-Expert / 700 Thermo KC produced 6 kc recs, all rejected with violations ["setup"] (Callisto also "wilderness"), and pickForRoute(bossing,120,"boss-log") = NO PICK. UI path confirmed: next-client.tsx:4835 `pick = pickForRoute(visibleRecs, mood, minutes, routeLens, ...)`, :5233 `{activePick ? ... : (` and :5311-5313 renders the generic "No safe trip fits this exact mood and time yet." — there is no bossing-specific "paste your bank" empty state, so this reads as unintended rather than a designed contract. SESSION_MOOD_GRID_CHOICES (:4398) does default Bossing to 120 min and moodForRouteLens (:4414) does map "boss-log" to bossing.

</details>

### K2. Switching accounts in one RuneLite install silently deletes the other account's synced state and re-points its whole history/identity at the new RSN

**Dimensie:** Sync-contract · **Bestand:** `src/lib/sync-auth.ts:89`

Switching accounts in one RuneLite install silently deletes the other account's synced state and re-points its whole history/identity at the new RSN

**Wat de speler merkt**
A player with a main and an ironman on one RuneLite install (or two people on one PC) loses data every time they switch. Log into the ironman: the main's player_sync row is deleted, so scapestack.org/next?rsn=<main> falls back to guessed hiscores advice — quests, diaries, Slayer task and bank are gone. The main's entire snapshot ledger and trip history now render under the ironman's name. Any browser already paired as the main silently reports itself connected as the ironman (/api/account/me). And because player_claim was renamed away from the main, the main's RSN is now unclaimed — anyone else can claim it and post fabricated data under that name.

**Voorgestelde fix**
Key the claim on account identity, not on the install. Send RuneLite's client.getAccountHash() (stable per OSRS account, already available and currently unused anywhere in the repo) in the claim body, store it on player_claim, and only run the rename migration when the incoming accountHash equals the stored one. Absent that, store a token per RSN in InstallToken (map claimedRsn -> token) so a second character gets its own claim instead of stealing the first one's, and never DELETE player_sync as part of a claim.

<details><summary>Verificatienotitie</summary>

Verified end to end. InstallToken.java:31-33 uses one GROUP/KEY_TOKEN/KEY_CLAIMED triple with no account discriminator (grep for accountHash/per-account in plugin/src returns nothing). ScapestackSyncPlugin.java:324 re-claims whenever the logged-in name differs from the single cached claimedRsn. sync-auth.ts:89-122 then takes the migration branch: for the second character player_claim has no row (targetHash null), the token hash resolves to the first character (previousRsn), and account_identity has no row for the new RSN, so target_conflict is empty. In Postgres every data-modifying CTE in a WITH runs to completion, so removed_latest DELETEs player_sync for the first character, moved_identity renames its account_identity row (rsn is UNIQUE, and it is the FK parent for sync_snapshot/recommendation_decision/trip_lifecycle_event/outcome_match/account_browser_session per sync-schema.ts:85-205), and moved_claim renames the claim. account_id is non-null after the first sync (PERSIST_SYNC_SQL claim_link, account-history-repo.ts:52-55), so the migration succeeds. Switching back mirrors it exactly, so each switch deletes the other character's player_sync row. Reads confirm the consequences: account-history-repo.ts:203 and :226 join snapshots via account_identity.rsn, account-pairing.ts:198-202 resolves a browser session's RSN through the same account_id join (so /api/account/me reports the wrong character), and planning-context.ts:104-124 falls back to hiscores/wom/temple when getSyncedPlayer returns null. After the rename player_claim has no row for the first RSN, so hasExistingClaim is false and anyone may claim it. tests/sync-auth.test.ts:225 only covers the intended rename; nothing distinguishes a rename from an account switch. Two accounts on one install is a mainstream OSRS setup, so critical is right. Additional detail the finding missed: if the claim row's account_id is still NULL (claim succeeded but the first sync never landed), moved_identity matches nothing yet removed_latest has already deleted player_sync, so the destructive half runs even when the migration reports failure.

</details>

### K3. questPoints is permanently 0 for every player (Hiscores has no such activity and the plugin does not supply it), which makes the Quests path card read

**Dimensie:** Datapijplijn · **Bestand:** `src/lib/planning-input.ts:70`

questPoints is permanently 0 for every player (Hiscores has no such activity and the plugin does not supply it), which makes the Quests path card read 0% / "183 quests likely open" for a 2277 account, forces detectAccountStage into "new-account" for any RSN-only account below the pvm-ready thresholds, and pins the quest-cape unlock route at "0/290 quest points". However, the claim that the 12 QP-gated quests "can never be surfaced as a next step for any player" is WRONG: next-up-quests.ts:73 gates on `if (q.qpReq > 0 && qp > 0 && qp < q.qpReq) continue;` — the `qp > 0` term deliberately skips the QP check when QP is unknown (with an explicit comment saying so), so Dragon Slayer II, RFD, Legends' Quest etc. are still recommendable by the actual recommendation engine. The QP gate is only permanently false in the path-card nextSteps lists (path-progress.ts:402, :465). Likewise QUEST_CAPE_QP_THRESHOLD is not dead code — the early return in questRecs (`if (qp >= 290) return []`) is unreachable, but the three uses in next-up.ts (505, 591, 684) are `questPoints < 290` guards that are now always TRUE, so e.g. "Unlock fairy rings" fires for any 650+ total account with no plugin sync.

**Wat de speler merkt**
A player types their RSN — the core product flow — and the Quests path says "183 quests likely open" and 0% at any account level, including a 2277 total. That is instantly, obviously wrong to anyone who plays. Separately, Dragon Slayer II, Recipe for Disaster, Legends' Quest and 9 other QP-gated quests can never be surfaced as a next step for any player, plugin-synced or not.

**Voorgestelde fix**
Stop sourcing QP from Hiscores. Either (a) compute it from `scapestackSync.questsCompleted` plus a per-quest `qpAward` field added to data/quests.json by build-quest-data.mjs (the Wiki `{{Quest details|points=}}` param), or (b) treat questPoints as `number | null` and make the qpGate/budget logic explicitly "unknown → permissive" rather than "0 → everything locked". Add a test asserting a maxed hiscores fixture does not produce a 0% quests path.

<details><summary>Verificatienotitie</summary>

Verified end to end. Live probe of index_lite.json (Lynx Titan) returns 90 activities and zero matching /quest/i — OSRS Hiscores has no Quest points row. src/lib/planning-input.ts:70-71 is the only producer of questPoints, and grep across plugin/ shows the RuneLite plugin never sends QP either, so input.questPoints is 0 on every production path. I ran the real engine (buildNextUpInputFromSources + computeNextUp) against live Hiscores for Lynx Titan: questPoints = 0, Quests path = 0%, tagline "183 quests likely open." (data/quests.json has 183 entries, 12 with qpReq>0, min QP_BY_DIFFICULTY cost 1, so budget=0 leaves likelyDoneNames empty). Two additional confirmed consequences the finding did not mention, both worse than the tagline: detectAccountStage (src/lib/account-stage.ts:126,134-136) — I ran it with combat 95 / total 1610: qp=0 yields "new-account", qp=180 yields "midgame-main", so every mid-level RSN-only account is mis-staged and mis-ranked; and the quest-cape unlock route (path-progress.ts:884,1037-1042, minQuestPoints: 290) permanently renders "0/290 quest points — 290 quest points short" even for a quest-cape holder.

</details>

---

## Hoog (13)

### H1. Confirmed with two corrections

**Dimensie:** OSRS-domein · **Bestand:** `src/lib/next-up-bosses.ts:127`

Confirmed with two corrections. The Clue scroll (medium) example does not hold: bank data comes only from InventoryID.BANK (plugin/src/main/java/app/scapestack/runelite/GameStateReader.java:314) and clue scrolls cannot be stored in a bank, so 23139 never appears. The cox/tob/toa rows also cannot fire in bossRecs, because next-up-bosses.ts:209-210 skips any boss absent from BOSS_CL_GATE and those three slugs are not in it (they still bite in activeBossKcRecs, next-up-kc.ts:141). Everything else stands, and the reachable cases are worse than 'silent': the failure is omission, not a false statement shown to the player, which is why I dropped critical to high.

**Wat de speler merkt**
A player who owns a Dual macuahuitl (Moons of Peril is mainstream mid-game Varlamore content) is treated as already experienced at Vardorvis, The Leviathan, The Whisperer AND Duke Sucellus, so all four DT2 bosses vanish from their recommendations with no explanation. Owning a Clue scroll (medium) - which almost every account has at some point - deletes Alchemical Hydra. Owning an Armadyl helmet from a GWD Armadyl trip deletes K'ril. The failure is silent: the player never sees content they are actually ready for, and if they notice, the tool looks like it does not know which boss drops what.

**Voorgestelde fix**
Replace each list with drops actually unique to that boss, resolving every id through data/items.json. Vardorvis -> Ultor vestige/ring (28307), Leviathan -> Venator vestige/ring, Whisperer -> Bellator vestige/ring (28316) + Siren's staff (28324), Duke Sucellus -> Magus vestige/ring + Eye of the duke (28321). Drop 28997, 23139, 22944, 22731, 21748 entirely; move 11826 from kril to kree; keep 22324 under tob only. Add a unit test asserting every id in the table resolves in data/items.json AND appears in that boss's data/drop-rates.json table.

<details><summary>Verificatienotitie</summary>

Resolved every id in the table against data/items.json - all ten quoted mappings are exactly as claimed (28997 Dual macuahuitl, 28316 Bellator ring, 28324 Siren's staff, 28321 Eye of the duke, 22944 Rada's blessing 2, 22731 Dragon hasta, 21748 Noon, 11826 Armadyl helmet, 22324 Ghrazi rapier, 23139 Clue scroll (medium)). The OSRS attributions in the finding are correct: Bellator vestige is Whisperer-only, Siren's staff is Whisperer, Eye of the duke is Duke Sucellus, Noon is the Grotesque Guardians pet, Armadyl helmet is Kree'arra, Ghrazi rapier is ToB, Dual macuahuitl is Blood Moon. I then ran bossRecs through vitest: a bank containing Dual macuahuitl + Scythe + Tbow + Shadow at CL 120 with DT2 completed returns ['Try Araxxor','Try Grotesque Guardians']; remove the macuahuitl from the same bank and it returns ['Try Vardorvis','Try The Leviathan','Try Duke Sucellus','Try The Whisperer']. hasBossExperience returns true for all four DT2 slugs off that one item. Separately, a bank with Rada's blessing 2 + Toxic blowpipe at CL 115 / 95 Slayer drops 'Try Alchemical Hydra' from the list; removing the blessing restores it. Rada's blessing 2 is a Kourend medium diary reward held by a large share of accounts, so this is not a corner case.

</details>

### H2. Thermonuclear Smoke Devil is gated at 70 Slayer; the boss requires 93, and the repo's own data says so

**Dimensie:** OSRS-domein · **Bestand:** `src/lib/next-up-bosses.ts:99`

Thermonuclear Smoke Devil is gated at 70 Slayer; the boss requires 93, and the repo's own data says so

**Wat de speler merkt**
Any account at combat 90-115 with 70+ Slayer and a whip gets "Try Thermonuclear Smoke Devil" as a recommendation. They cannot enter the Smoke Devil Dungeon at all below 93 Slayer - the trip is impossible, not merely hard. A 23-level Slayer error on a Slayer boss is the most legible kind of wrong to an OSRS player, and it is reachable for a wide band of mid-game accounts.

**Voorgestelde fix**
Change slayerLevel to 93 on the thermonuclear entry. Then add a test that asserts BOSS_GEAR_GATES[slug].slayerLevel equals the numeric Slayer requirement parsed from boss-knowledge.ts REQUIREMENT_OVERRIDES for every boss that has one - the same test also catches the missing Araxxor gate.

<details><summary>Verificatienotitie</summary>

next-up-bosses.ts:99 reads exactly as quoted, slayerLevel: 70. The repo contradicts itself in two places I opened: src/lib/slayer/monsters.ts:487 (thermonuclear, slayerLevel: 93) and :366 (smoke_devil, slayerLevel: 93), plus src/lib/boss-knowledge.ts:288 (thermonuclear: ['93 Slayer','Smoke devil task']). The OSRS fact is right - the Smoke Devil Dungeon needs 93 Slayer to enter, so the trip is impossible below it, not merely hard. That gate is the only Slayer check on the path: matchedGearForBoss (line 153) is the sole slayerLevel test, boss-viability.ts contains no Slayer logic at all (grepped: zero matches), and BOSS_ACCESS in content-access-data.ts has no thermonuclear entry. BOSS_CL_GATE line 44 opens it at combat 90. Reproduced live: bossRecs(95, [Abyssal whip], Slayer 70) returns 'Try Thermonuclear Smoke Devil' as the top result.

</details>

### H3. SKILL_MILESTONES claims six unlocks at the wrong levels, including Ardougne rooftops at 70 Agility

**Dimensie:** OSRS-domein · **Bestand:** `src/lib/next-up.ts:86`

SKILL_MILESTONES claims six unlocks at the wrong levels, including Ardougne rooftops at 70 Agility

**Wat de speler merkt**
The card literally reads "Push Agility to 70 - Unlocks: Ardougne rooftop course" to a player who knows Ardougne is 90, and "Push Mining to 85 - Unlocks: Amethyst" to a player who knows it is 92. These are levels players quote from memory, so each one reads as proof the tool was written by someone who does not play. The Slayer 93 card promises "Cryptic clue tasks", which does not exist in the game at all.

**Voorgestelde fix**
Agility 70 -> "Pollnivneach rooftop course" (or move the milestone to 90 for Ardougne). Mining 85 -> "Runite ore", plus a separate 92 -> "Amethyst". Farming 83 -> "Spirit trees" (magic trees belong at 75, Hespori at 65). Herblore 78 -> "Zamorak brews", Herblore 90 -> "Super combat potions" (extended antifire is 84). Slayer 93 -> "Smoke devils / Thermonuclear". Add a test pinning each milestone level against the existing in-repo tables (banked-xp.ts recipes, slayer/monsters.ts, next-up-money.ts reqs).

<details><summary>Verificatienotitie</summary>

Table verified at src/lib/next-up.ts:85-94, rendering at :202 (payoff: `Unlocks: ${m.unlock}`) and :200 (why: `... XP to ${m.unlock}.`). All six OSRS levels in the finding are correct: Ardougne rooftop is 90 (70 is Pollnivneach), amethyst is 92 (85 is runite), magic trees are 75 and Hespori 65 (83 is the spirit tree), magic potion is 76 (78 is Zamorak brew), extended antifire is 84 (90 is super combat), and Slayer 93 is smoke devils - 'Cryptic clue tasks' is not OSRS content in any form. The in-repo cross-checks the finding cites are real: next-up-money.ts:146 has amethyst-mine at Mining 92, banked-xp.ts:159 has magic seed at 75, banked-xp.ts:172 has magic potion at 76. I ran computeNextUp on an account at Agility 67 / Mining 82 / Herblore 75 / Farming 80 / Slayer 90 and got the exact user-facing strings back, with 'Push Slayer to 93 || Unlocks: Cryptic clue tasks' ranked second overall in the plan, alongside 'Push Agility to 70 || Unlocks: Ardougne rooftop course' and 'Push Mining to 85 || Unlocks: Amethyst'.

</details>

### H4. Wines of Zamorak money method requires 66 Magic for Telekinetic Grab (it is 33) and lists nature runes that telegrab does not use

**Dimensie:** OSRS-domein · **Bestand:** `src/lib/next-up-money.ts:88`

Wines of Zamorak money method requires 66 Magic for Telekinetic Grab (it is 33) and lists nature runes that telegrab does not use

**Wat de speler merkt**
Wines of Zamorak is the classic low-level cash method - the exact player who needs it is a 40-60 Magic account, and this code refuses to ever show it to them. Anyone who does see the card is told a Magic requirement 33 levels too high and told to bank ~1k nature runes, which telegrab never consumes (1 law + 1 air per cast). Both errors are checkable in ten seconds in game.

**Voorgestelde fix**
Set req to [{ skill: "Magic", level: 33 }], change the needs line to "33 Magic for Telekinetic Grab", and replace the rune line with "Law runes x ~1k + Air runes x ~1k (1 law + 1 air per cast)". Nature runes belong only if the guide also recommends alching on the trip, in which case say so explicitly.

<details><summary>Verificatienotitie</summary>

next-up-money.ts:87-98 matches the quote exactly: req Magic 66, needs '66 Magic for Telekinetic Grab' and 'Nature runes x ~1k + Law runes x ~1k + Air runes'. Telekinetic Grab is 33 Magic and costs 1 law + 1 air per cast - no nature runes - and the repo's own wiki-generated data/quests.json says so ('50 coins OR 1 law & 1 air rune for Telekinetic Grab (requires Magic 33)' under Creature of Fenkenstrain). req is a hard filter at line 337 and again at 351. Reproduced both halves: moneyRecs at Magic 45 returns only ['Moss giants'] - the method is invisible to the low-level account it exists for - while at Magic 70 the card appears with needs ['66 Magic for Telekinetic Grab','Nature runes x ~1k + Law runes x ~1k + Air runes', ...] rendered verbatim via line 392.

</details>

### H5. Same defect, one wording fix: 92 Slayer gates entry to the Araxyte hive, so the player cannot get in at all rather than getting in and failing to deal

**Dimensie:** OSRS-domein · **Bestand:** `src/lib/next-up-bosses.ts:121`

Same defect, one wording fix: 92 Slayer gates entry to the Araxyte hive, so the player cannot get in at all rather than getting in and failing to deal damage.

**Wat de speler merkt**
Any account at combat 110-135 holding an abyssal whip gets "Try Araxxor" regardless of Slayer level. A player with 60 Slayer travels to the hive and cannot hurt anything. Araxxor is recent, popular content, so a wrong requirement on it is highly visible.

**Voorgestelde fix**
Add `slayerLevel: 92` to the araxxor entry in BOSS_GEAR_GATES, matching boss-knowledge.ts, and correct the content-access-data.ts comment. Cover it with the same boss-knowledge-vs-gear-gates consistency test proposed for Thermonuclear.

<details><summary>Verificatienotitie</summary>

next-up-bosses.ts:121 has no slayerLevel key, while every sibling the content-access-data.ts:77-80 comment names does have one (kraken 87 line 96, cerberus 91 line 97, hydra 95 line 98, sire 85 line 100, thermonuclear line 99, grotesque-guardians 75 line 108). BOSS_CL_GATE line 47 opens araxxor at combat 110. boss-knowledge.ts:301 states araxxor: ['92 Slayer','Araxyte task']. BOSS_ACCESS has no araxxor entry, and boss-viability.ts has no Slayer logic, so nothing downstream catches it. Reproduced: bossRecs(115, [Abyssal whip], Slayer 60) returns 'Try Araxxor' as the top recommendation.

</details>

### H6. minigameRecs never receives the access context, so quest-locked minigames are still recommended

**Dimensie:** OSRS-domein · **Bestand:** `src/lib/next-up.ts:1181`

minigameRecs never receives the access context, so quest-locked minigames are still recommended

**Wat de speler merkt**
This is the same failure class that was just fixed for moneyRecs and bossRecs, left in place for minigames. A synced account with 52 Agility and no Sins of the Father is told to go do Hallowed Sepulchre, which is a multi-quest chain away from being possible. It undercuts the plugin's core pitch: the exact quest data is loaded in the very same function and simply not passed down.

**Voorgestelde fix**
Add MINIGAME_ACCESS to src/lib/content-access-data.ts ({ "hallowed-sepulchre": { quests: ["Sins of the Father"] }, "volcanic-mine": { quests: ["Bone Voyage"] }, "pyramid-plunder": { quests: ["Icthlarin's Little Helper"] } }), make minigameRecs accept an optional AccessContext and run evaluateAccess / accessNeedsLine / accessScoreMultiplier exactly as bossRecs does, then pass accessContext at next-up.ts:1181. Extend allGateQuestNames() to include the new map so the existing quest-name test covers it.

<details><summary>Verificatienotitie</summary>

next-up.ts:1181 is `...minigameRecs(skills),` with no accessContext, sitting between bossRecs (1155) and moneyRecs (1182) which both receive it. next-up-minigames.ts:63 takes only HiscoreSkill[], and lines 71-72 are the entire filter. The three quest gates are real OSRS: Hallowed Sepulchre is in Darkmeyer behind Sins of the Father, Volcanic Mine is on Fossil Island behind Bone Voyage, Pyramid Plunder needs Icthlarin's Little Helper. All three quest names resolve in data/quests.json. Reproduced: minigameRecs at Agility 55 (everything else level 1) returns ['Try Hallowed Sepulchre']; Mining 55 returns ['Try Volcanic Mine','Try Motherlode Mine']; Thieving 25 returns ['Try Pyramid Plunder']. A full computeNextUp run on a 70-base account with no quest data also surfaced 'Try Hallowed Sepulchre' in the plan.

</details>

### H7. Every rec produced by kcRecs (the dry-streak "N <boss> KC" cards) carries link=/quests/sheep-shearer — note activeBossKcRecs ("Push X to 50 KC") links

**Dimensie:** Engine-logica · **Bestand:** `src/lib/next-up-kc.ts:290`

Every rec produced by kcRecs (the dry-streak "N <boss> KC" cards) carries link=/quests/sheep-shearer — note activeBossKcRecs ("Push X to 50 KC") links to /dps and is unaffected. On the headline card the CTA label is hard-coded by nextTripCtaLabel (next-client.tsx:3139-3140) to "Check kill" for kind "kc", not "Check quest requirements"; for the two recs with no bossSlug that "Check kill" button navigates to /quests/sheep-shearer (next-client.tsx:4060-4062, 4143-4151). The "Check quest requirements →" label the finding quotes appears in the expanded RecDetailPanel (next-client.tsx:5579/5634), which is where the bad link surfaces for the bossSlug-matched recs (Vorkath, CoX).

**Wat de speler merkt**
A player whose headline is "900 Vorkath KC" or "512 Tombs of Amascut: Expert Mode KC" expands the card and is offered "Check quest requirements →" pointing at Sheep Shearer, a 5-minute F2P starter quest. For ToA Expert and Thermonuclear smoke devil it is the main button on the card. This is exactly the "built by someone who does not play" signal.

**Voorgestelde fix**
In next-up-kc.ts:290 set `link: boss ? `/dps?boss=${boss.slug}` : "/dps"` (mirroring activeBossKcRecs which already uses `link: "/dps"` at line 170), and add the two missing BOSSES aliases so `bossSlug` resolves for "Thermonuclear smoke devil" and "Tombs of Amascut: Expert Mode" — bossForKcName's normaliser already exists in the same file and could be reused instead of the ad-hoc `wikiName.toLowerCase().replace(/[^a-z]/g, "-")` at line 277.

<details><summary>Verificatienotitie</summary>

The code claim is exactly right: next-up-kc.ts:290 sets `link: `/quests/${questSlug("Sheep Shearer")}`` for every rec produced by kcRecs. My probe on a CL~115 PvM main returned `[kc] 900 Vorkath KC link=/quests/sheep-shearer`, `[kc] 512 Tombs of Amascut: Expert Mode KC link=/quests/sheep-shearer`, `[kc] 700 Thermonuclear smoke devil KC link=/quests/sheep-shearer`, `[kc] 40 Chambers of Xeric KC link=/quests/sheep-shearer`. I also confirmed the two bossSlug misses: BOSSES has slug "thermonuclear"/name "Thermonuclear Smoke Devil" and slug "toa"/name "Tombs of Amascut", so the lookup at next-up-kc.ts:277 (`b.name === wikiName || b.slug === wikiName.toLowerCase().replace(/[^a-z]/g,"-")`) returns undefined for the hiscores names "Thermonuclear smoke devil" and "Tombs of Amascut: Expert Mode", making rec.link the primary action (recommendation-action.ts:127/139). Two corrections, neither of which changes the defect. Severity kept at high.

</details>

### H8. A claim conflict is unrecoverable: "Reconnect player" does not rotate the install token and no reclaim endpoint exists

**Dimensie:** Sync-contract · **Bestand:** `plugin/src/main/java/app/scapestack/runelite/ScapestackSyncPlugin.java:313`

A claim conflict is unrecoverable: "Reconnect player" does not rotate the install token and no reclaim endpoint exists

**Wat de speler merkt**
Any player who reinstalls RuneLite, moves to a new PC, clears settings, or switches RuneLite config profiles gets a fresh installToken and is permanently locked out of syncing their own account. The plugin repeatedly instructs them to press a button that provably cannot fix it, and there is no self-serve path back. Same dead end for anyone whose name was claimed first by someone else.

**Voorgestelde fix**
Add a reclaim path with in-game proof of ownership (e.g. the site issues a short code, the plugin echoes it back from the logged-in client, then rebinds player_claim.token_hash). Until that ships, make "Reconnect player" actually rotate: clear KEY_TOKEN as well as KEY_CLAIMED, and have the server distinguish 409-conflict from 403-stale so the plugin can stop retrying and show a link to a support page instead of looping.

<details><summary>Verificatienotitie</summary>

Verified. InstallToken.forgetClaim (InstallToken.java:83-85) writes only KEY_CLAIMED=""; KEY_TOKEN is untouched, and getOrCreate returns the existing token, so ScapestackSyncPlugin.java:313-317 re-presents the identical token. sync-auth.ts:81-84 returns the conflict unconditionally whenever a different hash already owns the RSN, so the outcome never changes. `find src/app/api -name route.ts` lists 14 routes and none is a reclaim route; the only "reclaim" hits in src/ or plugin/src are the sync-auth.ts:17 TODO comment and unrelated bank-slot copy. The retry loop is real: shouldRunIntervalSync (ScapestackSyncPlugin.java:933-943) fires every normalized interval with no backoff and no attempt cap, the 403 branch calls forgetClaim (line 374) so the next cycle re-claims, and notifyChat prints "Scapestack needs reconnect. Press Reconnect player, then Sync now." every cycle. The only thing that clears player_claim is deleteAccountHistory (account-history-repo.ts:270), reachable solely through DELETE /api/account/delete, which requires an existing paired browser-session cookie — and grep shows no component or lib in src/ ever calls that route, so there is no in-product path at all. Nuance worth recording: sync-auth.ts:15-19 documents the griefer variant as accepted v0.2 scope, but the far commoner self-lockout (fresh token from a new machine, cleared settings, or a different RuneLite config profile) is not documented anywhere, and the chat copy actively points at a button that cannot fix it.

</details>

### H9. Confirmed, with three refinements: (1) the undercount is generous — 45 tiers have quest-gated tasks and only 7 of those are in DIARY_TIER_OVERRIDES at

**Dimensie:** Datapijplijn · **Bestand:** `scripts/build-diary-data.mjs:204`

Confirmed, with three refinements: (1) the undercount is generous — 45 tiers have quest-gated tasks and only 7 of those are in DIARY_TIER_OVERRIDES at all, of which Kandarin:Hard, Falador:Medium and Karamja:Medium carry no questRequirements, so ~40 tiers have unenforced quest gates, not 37; (2) there is no green "Ready" badge — /diary permanently redirects to /next, and diaryReadinessLabel is used in exactly one place (next-up-diaries.ts:300) inside the rec's decisionReason text; (3) partial mitigations exist: diary-task-progress.ts:81-84 surfaces the first sweep task's raw requirement strings (which include "Quest Completion of X") in the prep lines, and diaryRecs suppresses all diary recs entirely at totalLevel >= 2100 without exact sync data, so a maxed RSN-only account is not affected.

**Wat de speler merkt**
A player with the skill levels but without Regicide is told Western Provinces Elite is "Ready", and next-up-diaries.ts:248 gives that rec a +14 score boost so it can become the single headline recommendation. Ardougne Hard is shown as ready without Legends' Quest or Monkey Madness I. This is the exact failure class the product cannot afford: a requirement-literate player knows a diary tier is quest-locked and reads the green "Ready" badge as proof the tool is guessing.

**Voorgestelde fix**
Parse the `requirements[]` strings the builder already produces (they follow a stable `Quest <Started|Completion of|Partial completion of> <Title>` shape) into a per-tier `quests: string[]` in data/diaries.json, matched against data/quests.json titles the same way content-access-data.ts does. Feed that into evaluateDiaryTier alongside the override list, and add a test asserting every tier whose task text names a quest also has a quest gate.

<details><summary>Verificatienotitie</summary>

Verified. scripts/build-diary-data.mjs emits only {skills, tasks} per tier (lines 200-206) — no quests field. src/lib/diary-requirements.ts:594 reads questRequirements exclusively from DIARY_TIER_OVERRIDES, which I counted: 9 keys total, and only 5 of them carry questRequirements (Ardougne:Medium, Western Provinces:Hard, Lumbridge & Draynor:Medium, Karamja:Hard, Karamja:Elite). Counting data/diaries.json: 45 of 48 tiers have at least one task whose requirements[] starts with "Quest ". readinessStatus (lines 336-352) returns "ready" once skills pass and quests/items are empty, and tierDependencies are auto-met when no exact diary data exists. I ran evaluateDiaryTier with 99s everywhere and empty completedQuests: Western Provinces Elite, Ardougne Hard, Morytania Hard, Fremennik Elite, Desert Elite all return readinessStatus "ready", questRequirements [], missingRequirements []. The +14 readinessBoost for "ready" at next-up-diaries.ts:246-250 is real. The OSRS facts check out too (WP Elite needs Regicide for the Tirannwn fletching task; Ardougne Hard needs Legends' Quest and partial MM1).

</details>

### H10. /next?rsn=<name> serialises the full plugin snapshot — including every bank item id/name/quantity, boss KC, Slayer task, collection-log ids and per-sk

**Dimensie:** Security & privacy · **Bestand:** `src/app/next/page.tsx:33`

/next?rsn=<name> serialises the full plugin snapshot — including every bank item id/name/quantity, boss KC, Slayer task, collection-log ids and per-skill XP — into the RSC flight payload of the SSR HTML for any unauthenticated visitor. The 'bank sync is ON by default' framing needs narrowing: ScapestackSyncConfig.autoSync() defaults to FALSE (README: 'Sync is off by default'), so nothing is uploaded until the player opts in; syncBankItems() defaults to true only as a sub-option of that opt-in. The exposure is real regardless, and is not limited to /next — src/app/actions.ts:69 syncedPlayerAction and :78 planningContextAction are exported Server Actions returning the same raw SyncedPlayer for arbitrary RSN input, and /u/[rsn] does its own unauthenticated getSyncedPlayer(hi.name).

**Wat de speler merkt**
A player installs the RuneLite plugin to get better advice; bank sync is on by default and the README only promises the plugin never sends "inventory, equipment, chat, screenshots or login details". It never says the bank becomes world-readable. `curl 'https://www.scapestack.org/next?rsn=SomeIronman'` returns that account's item-by-item bank with quantities. In OSRS, bank contents are wealth: this hands scammers, ragers and "bank-value" harassers a scraping endpoint keyed on a name they already know. It also inverts the plugin's entire selling point — the thing that makes advice exact is the thing that publishes your bank.

**Voorgestelde fix**
Gate anything beyond the public receipt on the account session cookie. In `loadPlanningContext`, take a `viewerAccountId`/session argument and return `scapestackSync` only when `getConnectedAccount(sessionToken)?.rsn === normalizeRsn(rsn)`; otherwise substitute `pluginSyncReceipt(player)` (counts + coverage only) so the planner still shows "12 quests verified" without shipping rows. Do the same in `syncedPlayerAction`, and mark the un-owned path as `bank: 'none'` so the engine falls back to hiscores-only planning. Add a test asserting `GET /next?rsn=other` never contains a bank item name in the response body.

<details><summary>Verificatienotitie</summary>

Verified line by line. src/app/next/page.tsx:71 pulls rsn from searchParams (trim+slice(0,12)), :33 calls loadPlanningContext(rsn), :38 passes the result as a prop to NextClient. src/app/next/next-client.tsx line 1 is "use client" and :365-368 declares initialPlanningContext: PlanningContextPayload | null — a client-component prop, therefore serialised into the flight payload unconditionally, independent of whether usePluginBank (:548) later chooses to use it. src/lib/planning-context.ts:75/:168 puts scapestackSync: SyncedPlayer straight into the payload, and src/lib/sync-repo.ts:22-48 shows SyncedPlayer carries bankItems (id/name/quantity, capped at 1200 by normalizeBankItems, sync-repo.ts:316), bossKc, slayer (points/streak/taskName/taskLocation), collectionLogItemIds and skills with xp. There is no middleware (no src/middleware.ts, no proxy.ts — confirmed by find), no session check on the path, and next.config.ts adds only nosniff/frame/referrer headers. Not intended behaviour by the repo's own account: src/lib/plugin-sync-receipt.ts:6-10 states the full snapshot is read 'on the server' while browsers get counts only, and docs/privacy-security-threat-model.md forbids player-facing responses containing complete bank contents (it says 'historical', which /next's current-bank leak arguably slips past on a technicality). Severity corrected to high rather than critical: this is disclosure of game-progress/inventory data for opted-in plugin users, with no credential, token or account-takeover component — the claim tokens are only ever stored as sha256 (sync-auth.ts:29-31) and are not in the payload.

</details>

### H11. Underscore RSNs are a separate claim namespace, so any account with a space in its name can be impersonated at its own Scapestack profile URL

**Dimensie:** Security & privacy · **Bestand:** `src/lib/rsn.ts:46`

Underscore RSNs are a separate claim namespace, so any account with a space in its name can be impersonated at its own Scapestack profile URL

**Wat de speler merkt**
An attacker picks any player with a space in their name — that is most veteran accounts — claims the underscore spelling, and uploads a fabricated account state. Scapestack's own generated profile link `/u/lynx_titan` then renders "Welcome back, Lynx_Titan" over attacker-controlled data, and `/next?rsn=Lynx_Titan` merges the victim's real hiscore levels with the attacker's fake quest/diary/bank state — which is exactly the input the recommendation engine trusts most. The visible failure is the planner confidently telling a player they have Dragon Slayer II done when they don't. The real owner also cannot ever claim the underscore spelling, because first-claim-wins is permanent.

**Voorgestelde fix**
Fold `_` into a space inside `cleanRsnInput` (`value.replace(/[\s_ ]+/g, " ")`) so `normalizeRsn` produces one key per real account, and drop `_` from `RSN_PATTERN` after folding. Replace the ad-hoc normalizers with the shared one: `sync-repo.ts:105`, `account-history-repo.ts:185`, `account-timeline-repo.ts:144` and `hiscores.ts:31` all re-implement it differently. Add a migration that merges any existing `%\_%` rows into their space-spelled twin and revokes conflicting `player_claim` rows. Also stop trusting Jagex's echoed `name`: canonicalise `hi.name` through `normalizeRsn` before `getSyncedPlayer` in u/[rsn]/page.tsx:59.

<details><summary>Verificatienotitie</summary>

Every link in the chain holds, and I independently reproduced the OSRS fact rather than trusting it. Live: GET secure.runescape.com/m=hiscore_oldschool/index_lite.json?player=Lynx_Titan returns {"name":"Lynx_Titan",...,"rank":114257,"level":2278,"xp":4600000000} and ?player=Lynx%20Titan returns {"name":"Lynx Titan",...} with byte-identical stats — same account, and Jagex echoes back the spelling you sent. Code: src/lib/rsn.ts:28 RSN_PATTERN allows '_', :31 ANY_SPACE folds whitespace only, :46 normalizeRsn never maps '_'→' ', so 'lynx titan' and 'lynx_titan' are two distinct DB keys. claim/route.ts:90-92 accepts 'Lynx_Titan' (cleanRsnInput no-op, isValidRsn true), :100-108 checkHiscoresForClaim → claim-hiscores.ts uses fetchHiscores which normalises with hiscores.ts:30-32 (trim+slice only, underscore preserved) → 'found'. recordClaim (sync-auth.ts:71-137) then binds the attacker's self-generated UUID to 'lynx_titan' with ON CONFLICT DO NOTHING first-wins, and the victim's real 'lynx titan' claim never collides with it. POST /api/sync then passes verifyClaim (route.ts:140-146 → sync-auth.ts:146-160) on the same key, storing fully attacker-controlled skills/quests/diaries/bossKc/bankItems. Read-back is poisoned on both surfaces: /u/[rsn]/page.tsx:47-48 does normalizeRsn(decodeURIComponent(rsn)) (trim+slice, underscore kept) → fetchHiscores → hi.name is Jagex's echo 'lynx_titan' → :59 getSyncedPlayer(hi.name) hits the attacker row while the page header renders the victim's real hiscore levels; /next?rsn=Lynx_Titan does the same merge via planning-context.ts:128-133. The app generates exactly that URL form: hiscores.ts:35-37 rsnSlug lowercases and maps spaces to underscores, and src/components/bank-result.tsx:2343 links to /u/${rsnSlug(inferredRsn)}. No displayName-vs-hiscores cross-check exists anywhere on the read path. First-claim-wins is permanent (no reclaim endpoint — see finding 3), so the real owner can never take the underscore key back.

</details>

### H12. Temple is a ~300 ms tax on essentially every warm /next render, and it can never return data — but the mechanism is worse and different from the one c

**Dimensie:** Performance · **Bestand:** `src/lib/planning-context.ts:15`

Temple is a ~300 ms tax on essentially every warm /next render, and it can never return data — but the mechanism is worse and different from the one claimed: the endpoint itself does not exist. I reproduced the timing independently: `npx next start` (Next 16.2.10 production, port 4197), six /next renders across two RSNs, all six logged `{"source":"temple","elapsedMs":301-304,"state":"timeout"}` with `totalMs` 314-330 and `criticalMs` 35-111 — so temple alone accounts for ~90% of the wall clock once hiscores/WOM are Data-Cache hits, and `loadPlanningContext`'s `Promise.all` (planning-context.ts:132-138) does gate the plan on it. The fetch-cache enumeration also holds: `.next/cache/fetch-cache` contains 24 chisel.weirdgloop.org, 4 secure.runescape.com and 3 api.wiseoldman.net entries and zero templeosrs.com entries. Two corrections. (1) 'Never finishes inside its budget' is not literally true — latency is bimodal, ~113-120 ms on a warm keep-alive connection and ~170-500 ms on a fresh one. `controller.abort()` (bounded-source.ts:49) destroys the undici connection, so the next request is always fresh; that is the real 'never warms up' loop, not a fixed upstream latency above 300 ms. In isolated probes I measured 4 successes ('miss', 161-212 ms) out of 20 bounded runs. (2) The far more important fact the audit missed: `https://templeosrs.com/api/player_quests.php` returns HTTP 404 (a 196-byte Apache HTML error page) for every player I tried — Woox, Lynx Titan, Zezima, B0aty, Settled, Faux, Odablock, Torvesta, Lauky — with and without extra query params. Real Temple endpoints on the same host return 200 JSON (`player_stats.php`, `player_info.php`, `player_gains.php`, `collection-log/player_collection_log.php`); `player_quests.php`, `player_quest_list.php`, `player_quest_status.php` and `player_achievements.php` all 404. So `fetchTemple` returns null on the happy path too (`if (!res.ok) return null`, temple.ts:56), and no Data Cache entry would exist even without the abort. The whole Temple quest source is dead code paying a real network round trip on the app's core metric.

**Wat de speler merkt**
Every single first plan — for every player, on every visit, cold or warm — waits an extra ~300 ms for a tracker that never actually delivers data. It is the largest single component of time-to-first-plan once Hiscores/WOM are cached, and unlike them it never gets faster.

**Voorgestelde fix**
Two changes: (1) raise the temple deadline above the observed p90 (~600 ms) OR drop Temple from the blocking `Promise.all` in `loadPlanningContext` and let it enrich a later client rerun; (2) more importantly, make the timeout non-poisoning — run the fetch WITHOUT the abort signal (or with a much longer signal) and race only the *waiting*, so the in-flight request still completes and populates the Data Cache for the next visitor. Right now the abort guarantees a permanent cache miss.

<details><summary>Verificatienotitie</summary>

Read planning-context.ts (deadline 300 ms at :15, Promise.all at :132-138), bounded-source.ts (abort at :49), temple.ts (:51-56 fetch with next.revalidate 300). Ran `npx next start` against the existing production build and hit /next six times: 6/6 temple timeouts at 301-304 ms, totalMs 314-330. Enumerated .next/cache/fetch-cache (32 entries, no templeosrs). Probed templeosrs.com directly from node and curl: player_quests.php 404 for 9 distinct RSNs, 113-505 ms; player_stats.php/player_info.php/player_gains.php 200 JSON. Ran a faithful reimplementation of runBoundedSource+fetchTemple 20 times: 14 timeouts, 6 completions at 161-212 ms.

</details>

### H13. 36% of the test suite asserts on source text rather than behaviour — 3,037 toContain and 689 not.toContain assertions against src files

**Dimensie:** Onderhoudbaarheid · **Bestand:** `tests/next-client-confidence-copy.test.ts:1`

36% of the test suite asserts on source text rather than behaviour — 3,037 toContain and 689 not.toContain assertions against src files

**Wat de speler merkt**
None visible, but it taxes every future change: the next split of next-client.tsx (5,817 lines) or bank-result.tsx has to hand-edit hundreds of string literals, which is exactly the pressure that makes people skip refactors and leave the monoliths growing.

**Voorgestelde fix**
Pick the ~10 highest-count files and convert them to behaviour tests, or at minimum generalise them the way tests/helpers/next-up-source.ts did — read a directory of related files instead of one hardcoded path. New source-text tests should need a justification comment; assertions on Tailwind class names and exact import lines should not be written at all.

<details><summary>Verificatienotitie</summary>

Reproduced with my own script: 226 test files, 81 read a src/ path and assert on the string (35.8%), 3,037 `.toContain(` and 695 `not.toContain(` occurrences. (Small nit: the 3,037 figure already includes the not.toContain calls, so the two numbers are not additive, and my not.toContain count is 695 vs the claimed 689 — neither changes the picture.) Spot-checked every cited example and all are accurate: bank-profile-handoff.test.ts:9-13 does assert the literal import line and `hover:underline`; header-navigation.test.ts:11-42 does pin `const snapshot = loadAccountSnapshot();` and `<CheckCircle2`; next-client-confidence-copy.test.ts is the top offender at 593 toContain / 203 not.toContain against a 5,817-line file; tests/helpers/next-up-source.ts:1-8 carries exactly the quoted rationale and is used only by the next-up family; dps-row-affordance.test.ts:56 forbids `tabIndex={0}` in the DPS client while grep confirms `tabIndex={0}` still lives in src/components/bank-result.tsx (5,997 lines). This is the one finding where nothing needed narrowing.

</details>

---

## Middel (15)

### M1. Same finding with three count fixes: BOSSES has 60 entries, not 63; 'bow of faerdhinen' appears in seven gear gates (lines 98, 104, 106, 112, 114, 118

**Dimensie:** OSRS-domein · **Bestand:** `src/lib/bosses.ts:4`

Same finding with three count fixes: BOSSES has 60 entries, not 63; 'bow of faerdhinen' appears in seven gear gates (lines 98, 104, 106, 112, 114, 118, 124), not six; and the gap is one entry wider than stated - Moons of Peril is modelled under that name while the hiscores activity is 'Lunar Chests', so its KC is dropped by bossForKcName too.

**Wat de speler merkt**
/dps cannot calculate The Nightmare or Phosani's Nightmare - a top-tier, very popular boss and the source of the Inquisitor's set and all three nightmare staves the DPS engine already scores. The Gauntlet is absent even though the app repeatedly tells players to bring a bow of faerdhinen. Hiscores KC for Nightmare, Phosani's, Gauntlet, Corrupted Gauntlet and Scurrius is dropped by bossForKcName (src/lib/next-up-kc.ts:88), so those grinds never produce a KC recommendation. To a 2026 player the roster reads as frozen around 2023 with a few Varlamore bolt-ons.

**Voorgestelde fix**
Add BOSSES entries for The Nightmare, Phosani's Nightmare, The Gauntlet, The Corrupted Gauntlet and Scurrius first (all on the hiscores boss leaderboard, all fitting the existing sprite/drop-table pipeline), then the 2025 releases (Royal Titans, Yama, Doom of Mokhaiotl). Each needs slug, hiscoresName matching the hiscores activity string, stats, and a drop-rates.json entry from scripts/build-drop-rates.mjs. Add a test asserting the hiscores boss-activity list is a subset of BOSSES slugs so the header comment cannot drift again.

<details><summary>Verificatienotitie</summary>

bosses.ts:4 does state the contract ('every boss that appears on the OSRS Hiscores boss leaderboards'). I enumerated BOSSES programmatically: The Nightmare, Phosani's Nightmare, The Gauntlet, The Corrupted Gauntlet, Scurrius, The Royal Titans, Yama and Doom of Mokhaiotl are all MISSING, out of 60 total entries. data/drop-rates.json has 31 keys and none match /nightmare|gauntlet|scurrius|titan|yama|mokhaiotl/, so kcRecs cannot surface them either. The KC-drop mechanism is real: planning-input.ts:75-79 copies every hiscores activity name straight into bossKc, and activeBossKcRecs bails at next-up-kc.ts:141 when bossForKcName returns undefined. The 'models the loot without the boss' evidence checks out - gear.ts:82 Harmonised nightmare staff, pvm-items.ts:106/130/131 all three nightmare staves, dps.ts:128 scoring the Harmonised, and boss-upgrade-plan.ts:123 literally telling the player 'Complete Corrupted Gauntlet for an enhanced crystal weapon seed' for content the roster does not contain.

</details>

### M2. nextBestActions has no skill-state inference, so "Collect 4 items for Druidic Ritual" is the #1 rendered unlock move for mid-game accounts (probed at 

**Dimensie:** Engine-logica · **Bestand:** `src/lib/next-up-quests.ts:309`

nextBestActions has no skill-state inference, so "Collect 4 items for Druidic Ritual" is the #1 rendered unlock move for mid-game accounts (probed at Herblore 55 and Herblore 88) whose Herblore level already proves the quest is done. It is NOT #1 for a maxed 2277 account — there it ranks #7 behind six Elite do-diary actions and is not rendered at all.

**Wat de speler merkt**
NextBestActionsPanel (next-client.tsx:1346, renders `actions.slice(0,5)`) tells a maxed 2277 account with 99 Herblore to go collect raw beef, raw rat meat, raw bear meat and raw chicken for a level-1 quest it demonstrably finished years ago. It also outranks genuinely useful unlocks for mid-game accounts.

**Voorgestelde fix**
Add the same skill-implies-quest inference nextBestActions is missing: filter `relevantQuestPool` with a predicate that drops quests whose reward skill is already trained past its unlock floor (Druidic Ritual when Herblore > 3, plus the obvious siblings), and/or drop curated quests whose skillReqs are all met by a huge margin when questPoints >= QUEST_CAPE_QP_THRESHOLD. Reuse `completedQuest`/`lvl` from next-up-shared.ts so both call sites share one rule.

<details><summary>Verificatienotitie</summary>

The mechanism is real (next-up-quests.ts:309-311 filters only on completedQuestKnown; with no plugin/Temple sync completedQuestNames is undefined, so nothing is filtered and no skill-state inference exists), and the engine's own gate at next-up.ts:503-507 (`herblore <= 3 && ... && !completedQuest(...)`) proves the inference is available. Reproduced: MID main (Herblore 55) and IRONMAN mid (Herblore 55) both show `{collect-items} Collect 4 items for Druidic Ritual (uv 96)` at rank #1, and a PvM main with Herblore 88 also shows it at rank #1 — all rendered, since NextBestActionsPanel does `actions.slice(0, 5)` (next-client.tsx:1580). BUT the headline example is wrong. For a MAXED 2277 account (Herblore 99, 300 QP, no sync) Druidic Ritual ranks #7, not #1: six do-diary Elite actions score 94+18=112 and Druidic Ritual scores 96+12=108, so it falls outside slice(0,5) and is never rendered. I re-ran with and without Sailing 99 — identical result both times. So the exact case the finding leads with (99 Herblore) is the one case where the player does not see it. Severity lowered because the panel lives inside the collapsed "More routes" <details> (next-client.tsx:1338-1346), not the headline.

</details>

### M3. diaryNextBestActions has no maxed-account guard, re-creating the exact failure diaryRecs was fixed for

**Dimensie:** Engine-logica · **Bestand:** `src/lib/next-up-diaries.ts:163`

diaryNextBestActions has no maxed-account guard, re-creating the exact failure diaryRecs was fixed for

**Wat de speler merkt**
A maxed player sees "More unlock moves" filled with five "Finish <Elite diary reward>" cards marked "High prep", with no evidence the tiers are incomplete. The bug the diaryRecs guard removed from the main list is still visible one panel below it.

**Voorgestelde fix**
Apply the same `computeTotalLevel(input.skills) >= 2100 && !input.completedDiaryTiers` early return in diaryNextBestActions, or better: lift the guard into one shared helper so the two diary surfaces cannot drift again.

<details><summary>Verificatienotitie</summary>

Verified in code and reproduced exactly. diaryRecs guards at next-up-diaries.ts:207-208 (`if (totalLevel >= 2100 && !context.completedDiaryTiers) return []`) with the comment about maxed accounts getting 7 Elite-diary recs; diaryNextBestActions (next-up-diaries.ts:155-186) only guards on `input.skills.length === 0 || input.diaries.size === 0`. Both feed /next (next-up.ts:1256 actionQueue -> next-client.tsx:1346). My MAXED 2277 / 300 QP / no-sync probe returned exactly the claimed head: Finish Ardougne cloak 4, Desert amulet 4, Falador shield 4, Fremennik sea boots 4, Kandarin headgear 4, Rada's blessing 4 — all uv 94, all do-diary (kindWeight 18 at next-up-quests.ts:350), occupying ranks 0-5 and therefore all five rendered slots of `actions.slice(0, 5)`. Medium is the right severity: the panel is inside the collapsed "More routes" disclosure.

</details>

### M4. The "GP" mood has no designed candidates for ironman accounts; it survives only on an accidental substring match

**Dimensie:** Engine-logica · **Bestand:** `src/lib/next-up-money.ts:310`

The "GP" mood has no designed candidates for ironman accounts; it survives only on an accidental substring match

**Wat de speler merkt**
An ironman tapping the GP tile gets either a dead page (maxed iron) or one arbitrary minigame that only qualified because its description happens to contain the word "profit". Ironmen do care about GP routes (they just self-source), and the herb/birdhouse supply loop the engine already builds for them is the right answer but is invisible to this mood.

**Voorgestelde fix**
Give the iron supply-loop rec (next-up.ts:735-772, `skill:iron-herb-birdhouse-loop`) an explicit `sessionProfile: { expectedProfit: "positive", profitEvidence: "account" }` and/or a "gp" routeTag, and stop deriving profit from a free-text regex in recommendation-session.ts:152 — make generators declare it. Also consider an iron-specific GP catalogue (resource runs, GOTR, herb runs) instead of returning [] wholesale.

<details><summary>Verificatienotitie</summary>

Every link in the chain verified, and the probe matches almost exactly. moneyRecs returns [] for irons (next-up-money.ts:310-314). The iron supply loop is emitted as `skill:iron-herb-birdhouse-loop` with kind "skill" and routeTags ["iron","afk","rebuild","skiller"] (next-up.ts:734-748) — no "gp" tag — while the main version is `money:rebuild-herb-birdhouse-loop` with tag "gp" (next-up.ts:775-787). bossRecs (next-up-bosses.ts:310) and activeBossKcRecs (next-up-kc.ts:175) both strip "gp" for irons. The cash gate is mood.ts:383-384 and profit is derived at recommendation-session.ts:141 (the finding cites 152; the code is at 141) from `rec.kind === "money" || routeTags.includes("gp") || /gp\/hr|average loot|profit/.test(text)`. Probes: IRON MAXED with bank -> 9 recs, cash-eligible 0, pickForRoute(cash,60) = NULL; IRON MAXED no bank -> 6 recs, 0 eligible, NULL; IRON MID (bank or not) -> exactly 1 eligible of 36/39, `Try Hallowed Sepulchre` with tags ["fun","skiller"], profit=positive/catalogue purely because next-up-minigames.ts:50 reads "...tradeable loot; actual profit moves with current prices" and hits the /profit/ regex. Same main profile for contrast: 8 cash-eligible recs.

</details>

### M5. Auto-sync writes two game-chat lines every 15 minutes by default, including mid-combat

**Dimensie:** Sync-contract · **Bestand:** `plugin/src/main/java/app/scapestack/runelite/ScapestackSyncPlugin.java:286`

Auto-sync writes two game-chat lines every 15 minutes by default, including mid-combat

**Wat de speler merkt**
Chat spam during Slayer, raids or Zulrah — messages the player did not ask for, four times an hour, scrolling their chatbox at arbitrary moments. This is a common reason players uninstall a plugin, and RuneLite Plugin Hub reviewers flag unsolicited periodic chat output.

**Voorgestelde fix**
Only chat on state changes and on user-initiated syncs: drop the "is syncing" line for non-manual triggers entirely, and for background syncs post the success line only when the response actually reports new progress (ServerResponseSummary.hasNewProgress is already parsed and available at line 580). Route routine status to the side panel, which is already wired via updatePanelStatus/updatePanelSnapshot.

<details><summary>Verificatienotitie</summary>

Verified. ScapestackSyncPlugin.java:286 calls notifyChat("Scapestack is syncing your progress...") with no `manual` guard, immediately before the worker thread starts, while the surrounding code (lines 238, 244-247, 278) carefully distinguishes manual from background triggers — the pre-flight line is the one place that check is missing. Line 366 adds the success line. startAutoSyncScheduler (line 519) polls every 60s and calls triggerSync(false) through the same path whenever shouldRunIntervalSync passes. ScapestackSyncConfig defaults confirm autoSyncIntervalMinutes()=15 and chatFeedback()=true, so a player who enables "Sync on login" gets 2 GAMEMESSAGE lines four times an hour for the whole session, plus the login sync and any quest-complete sync. The config copy underlines the mismatch: autoSyncIntervalMinutes is described as "refresh Scapestack quietly while you play". Mitigations that keep this at medium rather than higher: autoSync() defaults to false so this only affects opted-in players, and chatFeedback is a disclosed one-click opt-out.

</details>

### M6. The alternatives figure (44% non-items) and the named examples are exactly right

**Dimensie:** Datapijplijn · **Bestand:** `scripts/build-quest-data.mjs:214`

The alternatives figure (44% non-items) and the named examples are exactly right. The "17.3% of itemReq rows are not items" figure overstates the damage: many of those rows are legitimate generic Wiki labels a player would accept ("pickaxe", "light source", "coins", "nails", "axe", "H.A.M. robes"). The genuinely wrong rows are the spellbook/spell/skill ones — DT2's "Ancient Magicks" and "Blood Burst", DS1's "Magic". One impact the finding understated: these bogus names are not confined to /quests/[slug] — quest-route.ts:204-206 builds missingItems from the same itemRequirements whenever a bank is present, so "Ancient Magicks" can appear in a Desert Treasure II recommendation's needs list on /next.

**Wat de speler merkt**
On /quests/dragon-slayer-i a player reads "1x Silk — Alternative: 1x Thessalia or 1x Al Kharid or 1x Ardougne or 1x silk stall or 1x Thieving." and on DT2 sees "Ancient Magicks" listed as an item to bring. Every OSRS player knows Thessalia is a shopkeeper and Ancient Magicks is a spellbook. It reads as machine-generated garbage and undermines the whole requirements surface.

**Voorgestelde fix**
In parseItemReqs, only accept an alternative whose link target resolves to a name present in data/items.json (normalised the same way build-item-data.mjs's `norm()` does), and drop rows whose primary name likewise fails to resolve unless it is on a small allowlist of legitimate generic terms ("pickaxe", "axe", "light source", "food"). Add a data test asserting the non-item rate in alternatives stays at 0.

<details><summary>Verificatienotitie</summary>

Verified. scripts/build-quest-data.mjs:212-221 pushes every wiki link after the first into alternatives whenever the cleaned line contains " or ". Measured against data/items.json (10,541 distinct names): 511 alternatives, 225 (44.0%) are not item names; 995 itemReq rows, 179 (18.0%) not item names. Shipped rows reproduced exactly: Dragon Slayer I "Silk" -> alternatives Thessalia / Al Kharid / Ardougne / silk stall / Thieving; "Wizard's mind bomb" -> Rising Sun Inn / Falador / The Toad and Chicken / Burthorpe; Desert Treasure II itemReqs are [Ancient Magicks, Blood Burst, Ring of visibility, Tinderbox, Pestle and mortar, Pickaxe, Facemask]. The render at src/app/quests/[slug]/quest-detail-client.tsx:78-79 is unfiltered, and src/lib/quest-requirements.ts:391 passes req.alternatives straight through with no filtering.

</details>

### M7. build-drop-rates.mjs does not follow Wiki redirects, so The Hueycoatl shipped with an empty drop table and nothing failed

**Dimensie:** Datapijplijn · **Bestand:** `scripts/build-drop-rates.mjs:124`

build-drop-rates.mjs does not follow Wiki redirects, so The Hueycoatl shipped with an empty drop table and nothing failed

**Wat de speler merkt**
A player grinding The Hueycoatl gets a dry-streak / expected-uniques readout for every other boss on their Hiscores but never for this one, with no explanation. Tonalztics of ralos and the Huasca seed are exactly the chases that boss exists for.

**Voorgestelde fix**
Add `&redirects=1` to the parse URL (or use the canonical page title), and make main() fail loudly: `if (drops.length === 0) { errors++; console.error(...) }` plus a non-zero exit when any boss yields zero drops. Add a vitest that walks data/drop-rates.json and asserts every entry has drops.length > 0.

<details><summary>Verificatienotitie</summary>

Verified against the live Wiki. scripts/build-drop-rates.mjs:124 fetches action=parse&page=<name> with no redirects=1; line 50 registers {wiki: "Hueycoatl", hiscores: "The Hueycoatl"}. Live probe: page "Hueycoatl" returns 27 chars of wikitext ("#REDIRECT [[The Hueycoatl]]", 0 DropsLine), page "The Hueycoatl" returns 17,729 chars with 33 DropsLine templates. data/drop-rates.json ships {"Hueycoatl": {"hiscoresName": "The Hueycoatl", "drops": []}} — the only empty table of the 31 entries. Line 128 writes the entry unconditionally and line 130 logs "0 rare drops (rarest: —)" without failing. Consumer confirmed: src/lib/next-up-kc.ts:255 does `if (!headline) continue;` after both the iconic and the denom-window lookups, so The Hueycoatl silently yields no KC insight. tests/drop-rates-db.test.ts asserts only the three hand-curated raid entries (Tbow, Kodai, Ghrazi rapier, Elidinis' ward) — nothing checks a scraped table is non-empty. "The Hueycoatl" is a live Hiscores activity, so the KC path is genuinely reachable.

</details>

### M8. data/items.json has no build script and is stale by 366 currently-tradeable items — while item-meta.json, rebuilt later, disagrees with it

**Dimensie:** Datapijplijn · **Bestand:** `data/items.json:1`

data/items.json has no build script and is stale by 366 currently-tradeable items — while item-meta.json, rebuilt later, disagrees with it

**Wat de speler merkt**
A player who pastes a Bank Tags string (IDs only, no names) sees every 2025-2026 item as "Unknown item #33534", dumped into Misc, excluded from banked-XP (banked-xp.ts:223 skips names starting with "unknown item") and from gear/DPS matching. A plugin-synced player's collection-log delta shows "#33534" instead of "Etched araxyte fang" after the drop they actually care about.

**Voorgestelde fix**
Add scripts/build-item-data-ids.mjs that regenerates data/items.json from the RuneLite/OSRS item id→name dump (or the Wiki's Module:GEIDs + prices mapping union), wire it into package.json alongside the other builders, and add a CI check that the max id in items.json is >= the max id in item-meta.json. Until then, correct the README claim.

<details><summary>Verificatienotitie</summary>

Every number reproduced exactly. scripts/ contains build-quest-data, build-diary-data, build-drop-rates, build-item-data, build-boss-sprites, build-skill-sprites — no items builder; package.json wires only build:sprites and db:init. README.md:143-145 states "data/ is generated, not hand-edited. Rebuild with the scripts/build-*.mjs builders." build-item-data.mjs:144-152 loads data/items.json as its id->name source. Counts: items.json 28,744 ids, max id 30,389; live prices.runescape.wiki/api/v1/osrs/mapping 4,591 tradeable rows, max id 33,821; 366 tradeable items absent from items.json (33661 Venator fang, 33663 Venator tooth, 31148 Virtus armour set, 32360 Yellow fin, ...); data/item-meta.json holds 325 ids above 30,389 that items.json lacks (30404, 30406, ...), proving two different snapshots. Name probes: oathplate, avernic treads, eye of ayak, mokhaiotl all absent ("araxyte fang" exists but "Etched araxyte fang" does not). All five downstream code refs verified verbatim: skill-capes.ts:34 and goals.ts:128 hardcode Sailing: 31288, bank-result.tsx:2393 ships the fallback-tiles apology, organizer.ts:170 falls back to `Unknown item #${absId}`, sync-repo.ts:500-503 falls back to `#${id}` for collection-log names, banked-xp.ts:223 skips names starting with "unknown item".

</details>

### M9. /api/sync/claim is an unauthenticated, unthrottled, permanent land-grab on every RSN in the game

**Dimensie:** Security & privacy · **Bestand:** `src/app/api/sync/claim/route.ts:52`

/api/sync/claim is an unauthenticated, unthrottled, permanent land-grab on every RSN in the game

**Wat de speler merkt**
One script walking the hiscores pages can claim tens of thousands of RSNs in an afternoon. Every real player who later installs the plugin gets "RSN already claimed by another install" (sync-auth.ts:84) with no recovery path, which reads as "this tool is broken" and kills the plugin's whole value proposition. The same loop also turns the site into a free proxy hammering Jagex's hiscores from Vercel IPs, risking an IP block that breaks lookups for everyone.

**Voorgestelde fix**
Add per-IP throttling on the unauthenticated endpoints (Vercel WAF rate-limit rules in `vercel.json`, or Upstash) — /api/sync/claim, /api/sync/status and /api/account/pair/start in particular. Ship the reclaim path the comment promises before more names are squatted: require the claimant to prove control (e.g. set a specific value the plugin reads from the logged-in client, or a time-boxed challenge string), and expire claims whose `last_used_at` is older than N days so an abandoned squat self-releases.

<details><summary>Verificatienotitie</summary>

Confirmed as written. src/app/api/sync/claim/route.ts POST has no session, no signature, no rate limit — the only gates are content-length ≤ 50KB, RSN shape, and a best-effort hiscores existence check (:100-108) which is explicitly skipped for already-claimed RSNs and which deliberately accepts the claim on 'unreachable'. The bearer is caller-generated (sync-auth.ts:172-174 generateInstallToken → randomUUID; the plugin's InstallToken.getOrCreate does the same locally), so whoever POSTs first owns the name. recordClaim (sync-auth.ts:71-137) inserts first-wins with no TTL, no revocation and no ownership proof; the migration branch only fires when the target RSN has no existing claim, so it is not a takeover path. Verified there is no recovery: `grep -rn reclaim src plugin/src scripts` returns only the sync-auth.ts:17 comment promising a future /api/sync/reclaim and doc mentions — the endpoint does not exist. The plugin's 'Reconnect player' (forceClaimOnNextSync, ScapestackSyncConfig.java:59-66) just re-runs claim and is rejected by the same hash comparison. Verified no rate-limiting infrastructure: `grep -rniE 'ratelimit|rate.limit|upstash|@vercel/kv' src scripts` returns only account-pairing.ts:85 (per-victim-account pairing counter), src/app/actions.ts:41 and sprites.ts comments; there is no vercel.json (confirmed absent), so no WAF rules. Medium is the right severity — it is denial-of-onboarding plus an outbound-fetch amplifier, not data disclosure, and sync-auth.ts:16-19 shows the author knowingly deferred it rather than it being a silent oversight.

</details>

### M10. POST /api/account/pair/start is unauthenticated and hands the caller both the pairing code and the browserSecret for someone else's account, and the p

**Dimensie:** Security & privacy · **Bestand:** `src/app/api/account/pair/start/route.ts:19`

POST /api/account/pair/start is unauthenticated and hands the caller both the pairing code and the browserSecret for someone else's account, and the plugin's approval UI shows no requester context — but exploitation is not silent-by-default: it requires the victim to open the plugin panel, type the attacker's 8-character code into the 'Connect this browser' field and click 'Connect browser'. It is a social-engineering primitive that the server makes available, not a remote pairing takeover.

**Wat de speler merkt**
Classic OSRS-flavoured social engineering: "your Scapestack sync is broken, paste SCAP-7K2M into the plugin to fix it". The victim pastes a code the attacker generated, and the attacker's browser silently holds a month-long session on the victim's account — reading their whole activity timeline and able to delete every bit of their history. The victim sees nothing except "Browser connected", which is exactly what they expected to see.

**Voorgestelde fix**
Bind the pairing request to the requester before it exists: require the browser to already hold a pending anonymous cookie, or return only an opaque `pairingId` and deliver the `browserSecret` via httpOnly cookie rather than JSON. Show the approver what they are approving — have `/pair/start` record a short request descriptor (approximate location / user agent / created-at) and have the plugin panel display it with an explicit Approve/Deny before calling `approve`. Rate-limit `/pair/start` per IP so it stops being a plugin-user enumeration oracle.

<details><summary>Verificatienotitie</summary>

Route verified: src/app/api/account/pair/start/route.ts:6-34 validates only RSN shape and calls startAccountPairing(rsn); src/lib/account-pairing.ts:67-103 returns {pairingId, code, browserSecret} to the caller, and completeAccountPairing (:129-165) redeems that same secret for a session cookie. TTLs confirmed: PAIRING_TTL_MS 10 min (:6), SESSION_TTL_MS 30 days (:7). Rate limit confirmed to be per victim account, not per requester (:76-85, 5/min). Session powers confirmed: api/account/timeline/route.ts:22-33 full read (and POST import), api/account/delete/route.ts:34 deleteAccountHistory(account.rsn) — the delete route does check requestHasTrustedOrigin (:19), but an attacker driving their own browser on the real origin satisfies that. Oracle behaviour confirmed: 409 'Sync this player from RuneLite before connecting another browser' for unclaimed vs 200 for claimed. Plugin side confirmed: ScapestackSyncPlugin.java:453-481 requestBrowserPairing takes the typed code and calls pairingClient.approve with no display of origin/requester/scope; ScapestackSyncPanel.java:217-236 is a bare text field plus 'Connect browser' button with the copy 'Get a code on Scapestack, enter it here, then continue on that browser.' The one narrowing: the approve step is user-initiated inside RuneLite, so the victim must be talked into pasting the code — the finding's own impact paragraph acknowledges this, so medium stands.

</details>

### M11. Accurate on every code fact, but it is once per cold process, not once per request — the title overstates

**Dimensie:** Performance · **Bestand:** `src/lib/account-pairing.ts:185`

Accurate on every code fact, but it is once per cold process, not once per request — the title overstates. `getConnectedAccount` at account-pairing.ts:183-185 does `await ensureSyncSchema()` before its session query; `ensureSyncSchema` (sync-repo.ts:95-103) loops `await sql().query(statement)` over `syncSchemaStatements()`, which I executed via tsx: exactly 83 statements, including the `account_pairing` and `account_browser_session` DDL these routes actually need. `sql()` is `neon(url)` (db.ts:12,26) — the HTTP driver, one round trip per query, strictly sequential. I measured the project's own Neon instance with 10 `SELECT 1` probes: 33,34,35,37,37,40,41,118,186,942 ms, median 40 ms, so 83 sequential = ~3.3 s from this laptop (the auditor's 44.7 ms / 3.7 s reproduces). Call sites confirmed: /api/account/me:11, /api/account/timeline:19 and :25 via accountFor, /api/account/decision:16, /api/account/delete:27, plus account-timeline-repo.ts:60 and :185. hero-intake.tsx:114-117 does await both in sequence on mount. The mitigation the audit omits is `schemaReady ??=` — the promise is memoised for the process lifetime, so this is a cold-instance cost, not a per-request cost, and in-region on Vercel a Neon HTTP round trip is single-digit ms, putting the realistic tax at roughly 0.1-0.4 s per cold function rather than seconds. Also unsupported: 'the panel silently renders empty if anything upstream gives up first' — neither `hydrateConnectedAccount` (account-connection.ts:56-57) nor `loadConnectedMoments` (hero-intake.tsx:34-35) sets a timeout or AbortSignal, so nothing gives up; they just wait.

**Wat de speler merkt**
The exact players the RuneLite plugin exists for — connected accounts — hit the slowest path. On a cold function their "welcome back / here's what changed since last sync" panel is blocked behind 83 sequential database round trips (~0.3-0.8 s in-region on Vercel, 3.7 s from a distant client), and the panel silently renders empty if anything upstream gives up first.

**Voorgestelde fix**
Remove DDL from the read path entirely — `npm run db:init` (scripts/db-init.mjs) already applies the same schema, and `syncSchemaStatements()` is idempotent. If a runtime safety net must stay, collapse it to one HTTP request: `@neondatabase/serverless` v1.1 exposes `sql.transaction(queries[])` (node_modules/@neondatabase/serverless/index.d.ts:853-884, "allows multiple queries to be submitted (over HTTP) as a single, non-interactive Postgres transaction"), turning 83 round trips into 1. At minimum, gate it behind an env flag so production reads never run DDL.

<details><summary>Verificatienotitie</summary>

Read account-pairing.ts:183-205, sync-repo.ts:95-118 (including the comment that documents why the same await was removed from getSyncedPlayer), db.ts, both account route files, account-timeline-repo.ts:55-62, hero-intake.tsx:34-45 and :110-135, account-connection.ts:56-63. Counted statements by executing syncSchemaStatements() with tsx: 83. Measured Neon HTTP RTT with 10 read-only SELECT 1 probes against DATABASE_URL from .env.local: median 40 ms.

</details>

### M12. The two OSRS Wiki feeds (1.19 MB) bypass Next's Data Cache and are re-downloaded by every cold serverless instance

**Dimensie:** Performance · **Bestand:** `src/lib/prices.ts:22`

The two OSRS Wiki feeds (1.19 MB) bypass Next's Data Cache and are re-downloaded by every cold serverless instance

**Wat de speler merkt**
The first player to land on a freshly-scaled serverless instance and paste a bank waits ~0.6 s extra while the app downloads 1.19 MB of Wiki JSON that every other instance already has. On a traffic spike (many cold instances) every one of them re-downloads it, and the Wiki gets hammered by an app that identifies itself by name in its User-Agent.

**Voorgestelde fix**
Add `next: { revalidate: 3600 }` to the fetch in `src/lib/prices.ts:22` and `next: { revalidate: 86400 }` to `src/lib/alch.ts:22` so Vercel's Data Cache (shared across instances) serves them. Keep the in-process Map cache on top for zero-cost repeat calls within an instance. Separately, collapse prices.ts/alch.ts/wiki.ts onto one client for each endpoint.

<details><summary>Verificatienotitie</summary>

Verified in source and reproduced. prices.ts:22 and alch.ts:22 both call fetch with only headers — no `next` option, no `cache` option — while hiscores.ts:55, wom.ts:60 and the sprite route all pass `next: { revalidate }`. Next 15/16 defaults fetch to no-store, so only the module-level `cache`/`inflight` (prices.ts:10-11, alch.ts:18-19) applies, which is per-process. Reproduced against `next start` on the production build: /api/prices?ids=... took 0.288 s on the first hit and 0.003 s on the second, and the fetch-cache entry count was 32 before and 32 after, with hosts still only chisel.weirdgloop.org (24), secure.runescape.com (4), api.wiseoldman.net (3). Payload sizes measured directly: latest = 336,833 bytes, mapping = 849,747 bytes (1.19 MB total), both under Next's 2 MB per-entry Data Cache limit. The duplication claim also holds: wiki.ts:10-11 declares the same two URLs with its own mappingCache/latestCache. One nuance the finding omits: /api/prices/route.ts returns `cache-control: public, s-maxage=3600, stale-while-revalidate=86400`, so Vercel's edge absorbs most repeat client traffic; the uncached exposure is the server-side organize() path (organizer.ts:101-102) and each cold instance.

</details>

### M13. 13 components totalling 2,018 lines (not 2,094) have no module-path reference anywhere in src, six still have dedicated source-text test files, and rs

**Dimensie:** Onderhoudbaarheid · **Bestand:** `src/components/sidebar.tsx:1`

13 components totalling 2,018 lines (not 2,094) have no module-path reference anywhere in src, six still have dedicated source-text test files, and rsn-storage.ts / plugin-install.ts / three actions.ts exports are also unreferenced. Severity is overstated: the finding itself concedes zero user impact, and one of the 13 (sidebar.tsx) is documented as deliberately retained at src/app/layout.tsx:90-93.

**Wat de speler merkt**
None directly — but it makes the suite lie about what is protected. tests/sidebar-navigation.test.ts enforces `aria-current`, `aria-disabled` and drawer-button semantics on a nav no user can reach, while the header nav that every user actually sees is guarded only by another text-matching test. Anyone reading green CI concludes the navigation accessibility contract is covered.

**Voorgestelde fix**
Delete the 13 unreferenced components and their tests, plus src/lib/rsn-storage.ts, src/lib/plugin-install.ts and the three dead server actions. rsn-storage.ts is the urgent one: it is a sixth RSN key scheme (`scapestack:bank:${rsnSlug(rsn)}`, line 10) sitting in the tree waiting to be re-adopted by someone who greps for bank storage. If sidebar.tsx is genuinely being kept for later, move it to _archive/ so it stops attracting tests.

<details><summary>Verificatienotitie</summary>

I re-ran the reference scan independently (regex over every .ts/.tsx in src for `"@/components/<name>"` / relative forms) and got exactly the same 13 names. Summing the per-file line counts the finding itself lists gives 2,018, not 2,094 — the individual numbers are right, the total is wrong. I also checked for non-module-path references by grepping the exported symbol names: only two produced hits and both are false positives — `PathOverview` in src/lib/* is a distinct interface declared at path-progress.ts:1271, and `Intro` in intake.tsx appears only in two comments. rsn-storage.ts (4 exports), plugin-install.ts (3 exports) and womAction/collectionLogAction/templeAction (actions.ts:38/48/58) confirmed unreferenced. The six test files exist as listed. The sub-claim about the server-reference manifest is slightly off (8 node entries, not 7, and they span several files), but that is immaterial.

</details>

### M14. The name collision and the six divergent normalisers are real and worth fixing, but the failure mode is much narrower than 'the plugin says it worked 

**Dimensie:** Onderhoudbaarheid · **Bestand:** `src/lib/hiscores.ts:31`

The name collision and the six divergent normalisers are real and worth fixing, but the failure mode is much narrower than 'the plugin says it worked but the site does not know me': every current writer and reader of player_sync folds U+00A0 before it reaches sync-repo's normalize (the plugin at ScapestackSyncPlugin.java:699, /api/sync via rsn.ts, the browser via account-storage.ts:65). The divergence only bites if an NBSP-bearing name is passed straight to getSyncedPlayer, which no current call site does.

**Wat de speler merkt**
Latent, and it is the same failure mode as the bug fixed today: any caller that reaches getSyncedPlayer or the history repo without first passing through cleanRsnInput writes or reads a different row than /api/sync did. For a player with a space in their name that means a successful RuneLite sync that the planner cannot find — the exact 'the plugin says it worked but the site does not know me' complaint.

**Voorgestelde fix**
Rename src/lib/hiscores.ts:31 to something honest about what it does (e.g. `hiscoresLookupName`) so it stops shadowing the canonical export, and replace the four private normalisers with `normalizeRsn` from @/lib/rsn. A single grep guard (`toLowerCase().slice(0, 12)` may only appear in src/lib/rsn.ts) makes the invariant self-enforcing.

<details><summary>Verificatienotitie</summary>

Confirmed every cited location: hiscores.ts:31 `input.trim().slice(0,12)` (exported, no fold, no lowercase) collides with rsn.ts:46; src/app/u/[rsn]/page.tsx:6 and opengraph-image.tsx:4 import the hiscores one. sync-repo.ts:105 is `function normalize(rsn) { return rsn.trim().toLowerCase().slice(0,12); }` and is the key builder for the player_sync SELECT at :114-121. account-history-repo.ts:185 same body, 8 call sites. account-storage.ts:65 folds but never lowercases. recommendation-feedback.ts:293 `normalizeRsnKey` trims+lowercases with no length cap. rsn.ts's header does list only four pre-existing sites. Downgrading severity because I traced all five getSyncedPlayer callers (actions.ts:70/90, planning-context.ts:108/115, u/[rsn]/page.tsx:59 which passes the Jagex-canonical `hi.name`, quests/[slug]/page.tsx:63) and none of them can currently deliver an unfolded NBSP.

</details>

### M15. The desktop header nav genuinely has no Slayer entry (header.tsx:123-160 renders getPrimaryNavTools(), and tools.ts:8 PRIMARY_NAV_SLUGS is ["next","ba

**Dimensie:** Onderhoudbaarheid · **Bestand:** `src/components/header.tsx:22`

The desktop header nav genuinely has no Slayer entry (header.tsx:123-160 renders getPrimaryNavTools(), and tools.ts:8 PRIMARY_NAV_SLUGS is ["next","bank","dps"]), and the four-item LOOP_STEPS is rendered into `grid-cols-3` at header.tsx:187 so 'Boss' wraps alone onto a second row. Two corrections: (a) the 3-slug desktop list is not silent drift — tests/tools.test.ts:44-46 explicitly asserts `PRIMARY_NAV_SLUGS` equals ["next","bank","dps"], so it currently reads as pinned intent; (b) the mobile drawer is not the only mobile surface carrying Slayer — src/components/mobile-action-bar.tsx:38,48-53 renders a persistent bottom nav with 'Task' -> /slayer on every route except '/', mounted in layout.tsx:97. So mobile discoverability is fine; only desktop is affected.

**Wat de speler merkt**
A desktop player never sees Slayer in the persistent header. "Is this task worth it?" — which header.tsx:18-21 argues is the single question Scapestack answers best — is reachable on desktop only from inside /next or a bank context action. On mobile the drawer shows it, in a broken 3+1 grid.

**Voorgestelde fix**
Add "slayer" to PRIMARY_NAV_SLUGS in src/lib/tools.ts:8 and delete LOOP_STEPS, deriving the mobile drawer grid from getPrimaryNavTools() with `grid-cols-4` (or `grid-cols-2` at four items). Either make TOOLS the real source of truth or correct the stale comment at tools.ts:1-2 — right now it describes a landing page and sidebar that no longer consume it.

<details><summary>Verificatienotitie</summary>

Read header.tsx in full. LOOP_STEPS at :22-27 has 4 entries and is rendered only at :188 inside the `sm:hidden` drawer, wrapped by `className="mt-2 grid grid-cols-3 gap-1.5"` at :187 — the 3+1 layout is real. Desktop `<nav aria-label="Primary trip actions">` at :123 maps navTools only. tools.ts confirmed: 7 TOOLS entries, PRIMARY_NAV_SLUGS 3 entries, and grep confirms TOOLS is imported nowhere outside tools.ts and tests/tools.test.ts, so no landing page renders the full registry. header-navigation.test.ts:46-48 does assert Trip/Setup/Boss and never Task. The two things the finding misses are tests/tools.test.ts:44 (the 3-item list is asserted, not accidental) and the mobile action bar (Slayer is in a persistent mobile nav, not just the drawer).

</details>

---

## Laag (17)

### L1. VISIBLE_KIND_LIMITS is only partially enforced: it is skipped entirely for lists of <=12, and the unconditional fill pass at next-up.ts:904-907 re-flo

**Dimensie:** Engine-logica · **Bestand:** `src/lib/next-up.ts:885`

VISIBLE_KIND_LIMITS is only partially enforced: it is skipped entirely for lists of <=12, and the unconditional fill pass at next-up.ts:904-907 re-floods the visible slots with the dominant kind (probe: 9 of the visible 12 are money for a maxed main; 3 diaries against a limit of 1 for a mid main). The effect is confined to the ordering of result.rest — it does not change the headline (always sortedRecs[0]) and does not affect the mood pick, which re-scores order-independently, so the player never sees a 12-item money list.

**Wat de speler merkt**
A 2277 account gets a plan that is almost entirely "here are ten money-makers", and the same herb run appears twice (money:herbs-torstol from the ladder plus money:rebuild-herb-birdhouse-loop from accountRouteRecs, which the LADDERS dedupe in next-up-money.ts:323 does not cover). It is the account tier most likely to say "this tool has nothing for me".

**Voorgestelde fix**
Apply the kind caps unconditionally (drop the length<=12 early return) and make the fill pass respect a relaxed cap (e.g. limit+1) instead of ignoring caps. Separately, fold `money:rebuild-herb-birdhouse-loop` into the herbs LADDER so it cannot co-exist with `money:herbs-*`.

<details><summary>Verificatienotitie</summary>

The two code statements are literally true (next-up.ts:885 early-returns for lists of 12 or fewer; the fill pass at :904-907 re-adds with no kind check), and I reproduced money dominance — but via a different mechanism and with a much smaller real impact than claimed. My MAXED 2277 probe produced 15 recs, so the <=12 early return did NOT fire; the caps pass selected goal, money, money, boss, boss (5), and then the fill pass flooded the remaining 7 slots with money, giving 9 money in the visible 12. My MID main probe (42 recs) put 3 diaries in the visible 12 against a limit of 1, not the claimed 5. The impact claim does not hold: prioritizeVisibleRecommendations only REORDERS (it returns selected ++ the remainder, next-up.ts:909-912), next-client.tsx:1288-1290 hands the whole list to the session board, and the board renders one mood-picked headline plus two backups (next-client.tsx:4835, 5233-5272) — there is no 12-item list on screen. rankRecommendationCandidates is order-independent (recommendation-ranking.ts:251-278 scores each candidate then sorts by score with a seeded tiebreak), so the ordering does not bias the pick either, and recs[0] is sortedRecs[0] regardless of the caps. On the duplicate: both money:herbs-torstol ("Herb run · Torstols") and money:rebuild-herb-birdhouse-loop ("Run herbs + birdhouses") do appear for a maxed main, but they are different activities (single-crop herb run vs the herb+birdhouse daily loop), so "the same herb run appears twice" overstates it.

</details>

### L2. Tithe Farm can never be recommended — dead catalogue entry filtered by its own gpHr of 0

**Dimensie:** Engine-logica · **Bestand:** `src/lib/next-up-money.ts:251`

Tithe Farm can never be recommended — dead catalogue entry filtered by its own gpHr of 0

**Wat de speler merkt**
The Farmer's outfit / Seed box grind — a genuinely correct recommendation for a Farming-focused account — is silently unreachable. If it ever did fire, its `why` line would render as the bare word "active" (next-up-money.ts:385-387 falls back to `m.intensity` when gpHr is 0).

**Voorgestelde fix**
Either drop the entry and its MONEY_ACCESS row, or exempt zero-GP "unlock/reward" methods from the minGpHr filter (e.g. `if (m.gpHr > 0 && m.gpHr < minGpHr && m.intensity !== "afk") continue;`) and give it a real `why` string, since the plan copy at next-up-money.ts:420 already has a gpHr===0 branch that assumes it can render.

<details><summary>Verificatienotitie</summary>

Provable from the code without a probe. next-up-money.ts:248-261 defines tithe-farm with gpHr: 0 and intensity: "active"; the gate at :359-365 computes minGpHr as 800_000 / 200_000 / 50_000 by combat level and then `if (m.gpHr < minGpHr && m.intensity !== "afk") continue;`. 0 < 50_000 holds for every combat level and "active" !== "afk", so the entry is skipped on every code path. MONEY_METHODS is a module-local const (next-up-money.ts:40, referenced only at :336 and :350, and tests/module-boundaries.test.ts:47 asserts it is not re-declared elsewhere), so there is no other consumer. Repo-wide, "tithe" appears only twice in src/: the dead entry and the now-unreachable Hosidius 100% favour gate at content-access-data.ts:41. The `why` fallback claim is also correct — next-up-money.ts:385-387 falls back to the bare `m.intensity` string when gpHr is 0. Low severity is right.

</details>

### L3. recoveryMessageForHttpFailure(int, String) declares a `detail` parameter it never reads — dead code — and 4xx codes other than 401/403/429 produce one

**Dimensie:** Sync-contract · **Bestand:** `plugin/src/main/java/app/scapestack/runelite/ScapestackSyncPlugin.java:957`

recoveryMessageForHttpFailure(int, String) declares a `detail` parameter it never reads — dead code — and 4xx codes other than 401/403/429 produce one generic chat line with no product surface that names the actual payload error. The reason is not discarded: ServerResponseSummary.logDetail(code, body), which embeds the server's error string, is written to the RuneLite log at both call sites, and the generic player-facing copy is a deliberate, test-enforced decision.

**Wat de speler merkt**
When a sync is rejected for a fixable reason, the player is told "Scapestack could not sync. Open troubleshooting in the plugin panel" — with no indication of what is wrong — while the plugin quietly retries the same rejected payload every 15 minutes. The planner keeps serving stale advice and the player has no way to learn why, which reads as the tool being broken rather than the payload being one field off.

**Voorgestelde fix**
Return `detail` for 4xx: `if (statusCode >= 400 && statusCode < 500 && detail != null && !detail.isBlank()) return "Scapestack could not sync: " + detail;`. Also treat a 400 as terminal for that payload — stop the interval retry until the next login or manual Sync now, and surface the detail on the panel (setStatus/setNextAction) rather than only in the log.

<details><summary>Verificatienotitie</summary>

The dead parameter is real: recoveryMessageForHttpFailure (ScapestackSyncPlugin.java:957-968) never references `detail`, and grep shows failureDetail is passed nowhere else. The enumerated 400 strings in plugin-snapshot-contract.ts (lines 85-280) and route.ts exist as claimed, and a deterministic payload defect would be re-POSTed every interval. But two load-bearing parts of the claim are wrong. First, "thrown away": lines 372-373 and 379 log ServerResponseSummary.logDetail(res.code(), bodyText), which includes the server's verbatim error (ServerResponseSummary.java:47-52), so the reason is captured in the RuneLite log — it is simply not shown in chat. Second, the generic copy is intended, not an oversight: ScapestackSyncPluginTest.recoveryMessagesGiveActionableNextSteps (lines 576-596) asserts the exact strings for 403/500/429/400 and then runs assertNoPlayerTech, which fails if the message contains "http", "payload", "status code", "url" or "endpoint" — i.e. surfacing the server detail in chat is explicitly prohibited by the test suite. "Every 4xx becomes one generic line" also overstates it: 401/403 and 429 get their own specific copy. What survives is an unused parameter plus a genuine gap (no surface anywhere names the reason for a fixable 400), which is low, not high.

</details>

### L4. No runtime contract-version negotiation: the server hard-rejects anything but 3, and the readiness probe never exposes what the server accepts

**Dimensie:** Sync-contract · **Bestand:** `src/lib/plugin-snapshot-contract.ts:84`

No runtime contract-version negotiation: the server hard-rejects anything but 3, and the readiness probe never exposes what the server accepts

**Wat de speler merkt**
Today both sides are 3, so nothing is broken. But the plugin auto-updates through the RuneLite Plugin Hub while the site deploys separately and can be rolled back. The moment a 0.4.0 plugin ships with contractVersion 4 before the site deploys — or the site is rolled back after — every auto-updated player's sync hard-400s and, per the finding above, they see only "Scapestack could not sync". Their planner silently freezes on old data with no way to diagnose it.

**Voorgestelde fix**
Two cheap changes. (1) Add `contract: { current: 3, accepted: [3] }` to the GET /api/sync status body and have SyncServiceReadiness.parse read it; if the server does not accept PluginSnapshotContract.VERSION, drop contractVersion/coverage from the payload and POST the legacy shape — parsePluginSnapshotContract already accepts `contractVersion === undefined` as legacy, so the fallback needs no server work. (2) Accept a version range server-side (`if (version < MIN || version > MAX)`) instead of strict equality, so a minor plugin bump is not a hard break.

<details><summary>Verificatienotitie</summary>

Every fact checks out. plugin-snapshot-contract.ts:84 is a strict inequality against PLUGIN_SNAPSHOT_CONTRACT_VERSION=3 and route.ts:151-152 turns a mismatch into a 400 that rejects the whole payload. PluginSnapshotContract.VERSION is pinned and buildSyncPayload always emits it (ScapestackSyncPlugin.java:710). SyncServiceStatus (sync-service-readiness.ts:34-72) exposes ok/service/ready/plugin.currentVersion/endpoints/limits/database and no contract version — grep for contractVersion under src/app/api returns only the three sync-route occurrences. SyncServiceReadiness.parse reads only "ready" (plus "database" for the failure text). MINIMUM_WEBSITE_CONTRACT_VERSION is asserted only in tests/plugin-version-drift.test.ts:39, never read at runtime by either side. Severity corrected down because the finding itself concedes nothing is broken today: this is a latent release-process risk, not a defect. Worth adding that the exposure is symmetric and the site-first direction is worse — if the site bumps to 4 before the Hub release lands, every already-installed 0.3.0 plugin 400s at once — while the legacy path (contractVersion absent entirely) is still accepted, so only explicitly-versioned payloads are affected.

</details>

### L5. parsePluginSnapshotContract validates body.capturedAt strictly and returns it, but route.ts never reads snapshotContract.capturedAt and upsertSyncedPl

**Dimensie:** Sync-contract · **Bestand:** `src/app/api/sync/route.ts:151`

parsePluginSnapshotContract validates body.capturedAt strictly and returns it, but route.ts never reads snapshotContract.capturedAt and upsertSyncedPlayer has no capturedAt parameter, so persistSyncAndSnapshot falls back to the server clock — sync_snapshot.captured_at and player_sync.synced_at record receive time, not capture time. The realistic drift is seconds (readiness probe + optional claim + POST), not the material staleness or cross-snapshot reordering claimed.

**Wat de speler merkt**
The plugin's headline promise is that advice becomes exact. The ledger's ordering key (sync_snapshot_latest_idx on captured_at DESC), delta elapsedSeconds and snapshotDeltaFreshness are all computed from when Vercel received the POST, not when RuneLite read the account. A sync delayed by the readiness probe plus a claim round-trip, a slow connection, or a retry is timestamped late, so "synced 2 minutes ago" can be materially older than it claims and two snapshots captured in a different order can be persisted in the wrong order.

**Voorgestelde fix**
Thread it through: pass `capturedAt: snapshotContract.kind === "v3" ? snapshotContract.capturedAt : undefined` from route.ts into upsertSyncedPlayer, add it to the Omit<> signature in sync-repo.ts:182, and forward it to persistSyncAndSnapshot, which already accepts an optional `capturedAt`. Keep clamping to now when the client clock is ahead — the validator already bounds skew at 24h.

<details><summary>Verificatienotitie</summary>

The mechanism is exactly as described. plugin-snapshot-contract.ts:87-88 validates with an OSRS-release floor and a 24h skew ceiling and returns capturedAt in the v3 value; route.ts:299-314 builds the upsertSyncedPlayer argument without it; sync-repo.ts:264-278 calls persistSyncAndSnapshot without capturedAt; account-history-repo.ts:129 then defaults to new Date().toISOString(), which becomes $19 for both sync_snapshot.captured_at and player_sync.synced_at. Per-domain coverage.capturedAt and bankStatus.capturedAt do survive, so the snapshot-level value is indeed the only dropped timestamp, and it does feed the ordering index sync_snapshot_latest_idx, the delta's now-basis (account-history-repo.ts:138) and snapshotDeltaFreshness. Severity corrected because the impact is overstated: readSnapshot runs on the client thread immediately before the background POST, syncGate serializes syncs per install, and the elapsed work is a readiness GET plus at most one claim round-trip — seconds, not enough to make "synced 2 minutes ago" materially wrong, and cross-snapshot reordering would require concurrent installs writing the same account. There is also a defensible reason for the current behaviour the finding does not weigh: the validator tolerates up to 24h of client skew, so trusting a client clock as the ordering key of an append-only ledger would be worse than trusting the server's.

</details>

### L6. claim/route.ts:112 maps every recordClaim rejection without existingTokenHash to 500, including the user-level conflict at sync-auth.ts:121 ("New RSN 

**Dimensie:** Sync-contract · **Bestand:** `src/app/api/sync/claim/route.ts:112`

claim/route.ts:112 maps every recordClaim rejection without existingTokenHash to 500, including the user-level conflict at sync-auth.ts:121 ("New RSN is already connected to another account"). This is a genuine status-code/monitoring defect, but the claimed player-facing effect is wrong: no plugin path turns a claim status code into player-visible copy at all.

**Wat de speler merkt**
A player whose second character already exists on the site hits a permanent, user-caused conflict but is told the service is down and to try again later. They wait, retry every 15 minutes, and nothing ever changes. It also poisons monitoring: a routine conflict shows up as a server error rate on Vercel, hiding real 5xx.

**Voorgestelde fix**
Give recordClaim a discriminated reason code (`conflict-other-install` | `conflict-target-linked` | `invalid-rsn` | `db-error`) and map conflicts to 409, invalid input to 400, and only genuine database failures to 500. Then have the plugin stop the retry loop on 409 and surface the reason (see the recoveryMessageForHttpFailure finding).

<details><summary>Verificatienotitie</summary>

The server half is confirmed. Of recordClaim's six rejection reasons, only the two "RSN already claimed by another install" branches (sync-auth.ts:84 and :137) set existingTokenHash and get 409; line 121 is a genuine user-level conflict and returns 500, and "Invalid RSN" (line 73) is unreachable because claim/route.ts:93-95 already validates via lib/rsn. Real reachable trigger: the migration is refused whenever the target RSN already has an account_identity row, or whenever the source claim's account_id is still NULL. The monitoring point stands — routine conflicts inflate the Vercel 5xx rate. The player-facing half does not survive: ClaimClient.claim (ClaimClient.java:61-70) only log.warns the failure and returns a boolean, and ScapestackSyncPlugin.java:328-334 merely logs "Claim did not succeed; attempting sync anyway" before POSTing. The player therefore sees the message for the subsequent sync 403 — "Scapestack needs reconnect. Press Reconnect player, then Sync now." — never "Scapestack is temporarily unavailable". The cited ScapestackSyncPlugin.java:961 applies to the sync response, not the claim response; the browser-pairing path (line 468-470) likewise emits its own copy. Nobody is told to wait for a service that is fine.

</details>

### L7. pair/start/route.ts:4 and sync/status/route.ts:5 both define a local /^[A-Za-z0-9 _-]+$/ instead of using lib/rsn, so an interior U+00A0 is rejected t

**Dimensie:** Sync-contract · **Bestand:** `src/app/api/account/pair/start/route.ts:4`

pair/start/route.ts:4 and sync/status/route.ts:5 both define a local /^[A-Za-z0-9 _-]+$/ instead of using lib/rsn, so an interior U+00A0 is rejected there. It is a real consistency gap, but the claimed user-facing break is not reachable: the browser pairing flow folds the name client-side before the request, and /api/sync/status has no site or plugin caller.

**Wat de speler merkt**
A player who copies their display name out of the game client or another tool and pastes it into the browser-pairing flow is told their own name is not a valid OSRS name. It only affects names containing a space, and only the paste path — but it is the same failure the RSN fix was meant to eliminate, surviving in the one flow (browser pairing) the plugin's value proposition depends on.

**Voorgestelde fix**
Replace both local regexes with the shared helpers: `const cleaned = cleanRsnInput(rsn); if (!isValidRsn(cleaned)) return 400;` then pass `cleaned` downstream. src/app/api/sync/status/route.ts is currently only exercised by plugin/src/test/.../EndToEndSmokeTest.java:346, so it is a cheap fix before anything on the site starts calling it.

<details><summary>Verificatienotitie</summary>

The code claim is exactly right — both routes carry their own RSN_RE, pair/start:16 tests rsn.trim() (JS trim strips U+00A0 only at the ends), and lib/rsn.ts:31 exists precisely to fold it via ANY_SPACE = /[\s ]+/g, with its header listing four unified call sites that do not include these two. The sync and claim routes do use it (route.ts:135, claim/route.ts:93). What does not hold is the impact story. The only caller of /api/account/pair/start is startBrowserPairing (account-connection.ts:29), fed by ConnectBrowserModal's rsn prop, which is header.tsx's activeRsn. That value comes from loadAccountSnapshot -> getActiveAccount -> account-storage.ts:64, whose normalizeRsn does rsn.trim().replace(/\s+/g, " ") — and JS \s matches U+00A0, so a pasted "Lynx Titan" is folded to a plain space before it can reach the route. saveAccount does briefly call onActiveRsnChange with the raw draft, but the immediately following refresh() overwrites it from the normalized store in the same batched handler. /api/sync/status is worse still as a user-impact claim: grep across src/, plugin/src and docs finds no caller other than the Java EndToEndSmokeTest. So this is a latent duplication that will bite the next caller, not a live break in the flow the plugin's value proposition depends on.

</details>

### L8. Confirmed for the visible part

**Dimensie:** Product/UX · **Bestand:** `src/app/slayer/slayer-client.tsx:407`

Confirmed for the visible part. useState(3)/useState(1) at slayer-client.tsx:47-48 feed rankMasters immediately, and I loaded /slayer cold in a browser: before any input the page reads "NEXT SLAYER MOVE / Start with your OSRS name. / Turael is the strongest available master from the levels and quests currently known." I verified rankMasters at cb3/sl1 returns exactly one master (Turael, 15 tasks). The two supporting details are behind a collapsed <details> and are not what a visitor sees: the "Compare Slayer masters" single row and its "Combat 0+" label only render once the disclosure is expanded. The copy also hedges with "from the levels and quests currently known", which softens (but does not remove) the guessing impression.

**Wat de speler merkt**
The first thing /slayer tells a visitor is that Turael is the best master for them, derived from a level-3 placeholder they never supplied. Any Slayer player reads that as the tool guessing — and "Combat 0+" is not a real OSRS requirement, Turael simply has none. The "Compare Slayer masters" section is also effectively empty (one row) until an RSN is entered, so the page's secondary content has no cold-start value.

**Voorgestelde fix**
Render the master comparison and the topMaster sentence only after a successful lookup; before that show the seven masters with their real gates ("Turael — no requirement", "Duradel — 100 combat, 50 Slayer, Shilo Village") as static reference, and print "no combat requirement" instead of "Combat 0+".

<details><summary>Verificatienotitie</summary>

Reproduced the cold render live and confirmed the ranking numerically. It is one hedged sentence in an empty state whose own heading already says "Start with your OSRS name", and the cited empty-comparison/"Combat 0+" evidence is collapsed by default — copy polish rather than a medium-severity defect.

</details>

### L9. The coverage numbers are right, but two of the headline examples are OSRS-wrong and would themselves have been an embarrassing insight: TzTok-Jad's Fi

**Dimensie:** Datapijplijn · **Bestand:** `scripts/build-drop-rates.mjs:35`

The coverage numbers are right, but two of the headline examples are OSRS-wrong and would themselves have been an embarrassing insight: TzTok-Jad's Fire cape and TzKal-Zuk's Infernal cape are guaranteed rewards, not RNG chases — a "you're X KC dry" readout for them is meaningless (the same applies to Sol Heredit's Dizana's quiver). The gaps that actually cost the player a chase readout are Corporeal Beast (Elysian sigil), Nightmare / Phosani's (Inquisitor's), The Gauntlet / The Corrupted Gauntlet (enhanced crystal weapon seed), Kalphite Queen, Yama (Oathplate) and Doom of Mokhaiotl. Also worth framing correctly: the BOSSES array is explicitly commented "The bosses worth parsing", so this is a curated-scope/maintenance gap with no staleness alarm, not a pipeline malfunction.

**Wat de speler merkt**
Half of all boss grinds produce no "you're X KC dry" insight. The gaps include the most famous chases in the game — Elysian at Corp, Inquisitor's at Nightmare, Blade of Saeldor at Gauntlet, Infernal cape at Zuk, Fire cape at Jad, Oathplate at Yama. A player at 600 Corp KC gets nothing while a player at 30 Giant Mole KC gets a readout, which reads as arbitrary.

**Voorgestelde fix**
Derive the BOSSES list from the live Hiscores activity names instead of hardcoding it (fetch index_lite.json for any account, filter to boss rows, map name→Wiki page with a small override table for the handful that diverge), and fail the build when a live activity has no mapping. Add a coverage assertion to `npm run ci:check` so a new Jagex boss surfaces as a red test rather than silence.

<details><summary>Verificatienotitie</summary>

Coverage verified against live index_lite.json. 90 activities, 20 non-boss point/clue/rank rows, 70 boss KC rows. drop-rates.json has 31 entries (one empty) plus 4 raid entries in drop-rates-raids.json. Cross-check: 34 of 70 live boss rows have a usable (non-empty) table, 36 have none — the finding's 35-name list plus The Hueycoatl. Zero dead mappings: every hiscoresName in both files is a valid live activity. BOSSES (scripts/build-drop-rates.mjs:35-73) is a hand-written 31-entry array whose newest members are Araxxor / Hueycoatl / Amoxliatl (2024); Yama, Doom of Mokhaiotl, The Royal Titans, Shellbane Gryphon, Maggot King and Brutus are all live Hiscores rows with no entry, and nothing in the repo detects a new Hiscores row.

</details>

### L10. GET /api/sync/status?rsn= is an unauthenticated oracle exposing displayName, exact syncedAt, pluginVersion, coverage, bankStatus and per-domain counts

**Dimensie:** Security & privacy · **Bestand:** `src/app/api/sync/status/route.ts:12`

GET /api/sync/status?rsn= is an unauthenticated oracle exposing displayName, exact syncedAt, pluginVersion, coverage, bankStatus and per-domain counts including bankItems, with 404-vs-200 separating plugin users from everyone else. The 'Access-Control-Allow-Origin: *' emphasis is misplaced: the endpoint takes no cookies and no credentials, so a wildcard adds essentially nothing an attacker could not get by querying it server-side — the exposure is the unauthenticated endpoint itself, and everything it reveals is a strict subset of what /next already leaks (finding 1).

**Wat de speler merkt**
Because of the wildcard CORS header, any third-party website can silently probe from its visitors' browsers — an OSRS Discord embed or a clan site can fingerprint which of its visitors run the plugin, when they last played (`syncedAt` to the second), and roughly how big their bank is (`counts.bankItems`). Paired with the /next leak above it is the discovery half of a bank-scraping pipeline: enumerate hiscores names here, then pull the item list from /next.

**Voorgestelde fix**
Drop `Access-Control-Allow-Origin: *` on this route — the plugin does not need it (it is a desktop OkHttp client, not a browser, so CORS never applies to it), and the site calls it same-origin. Coarsen the response for unauthenticated callers: return `{ok, status}` plus `syncedAt` bucketed to the day, and move `counts` and `coverage` behind the account session. Rate-limit per IP.

<details><summary>Verificatienotitie</summary>

Route confirmed exactly as cited: src/app/api/sync/status/route.ts:8 sets Access-Control-Allow-Origin '*', :12-21 validates RSN shape only and returns pluginSyncReceipt(player) or 404. Receipt fields confirmed at src/lib/plugin-sync-receipt.ts:31-50 — rsn, displayName, syncedAt, pluginVersion, contractVersion, coverage, counts{skills,quests,diaries,collectionLogItems,bossKc,bankItems,slayer} and bankStatus (which itself carries enabled/itemCount/capturedAt/unavailableReason per plugin-bank-status.ts:10-15). No rate limit anywhere (same grep as finding 3). Two corrections drive the downgrade: (a) the CORS wildcard is not the risk — no credentials are involved, so cross-origin readability grants no capability a server-side fetch lacks; the 'silently probe from its visitors' browsers' framing implies a credentialed-CSRF-style leak that does not exist here; (b) this shape is deliberately the privacy-minimised one (plugin-sync-receipt.ts:6-10), and grep shows the app itself does not even call this route — only plugin/src/test/.../EndToEndSmokeTest.java:346 and tests/sync-status-route.test.ts do, while the web UI uses the pluginSyncStatusAction server action. Given finding 1 already publishes the item-by-item bank by name, this endpoint's incremental disclosure is marginal.

</details>

### L11. The delayed-deletion retention machinery is dead code — nothing ever purges an account

**Dimensie:** Security & privacy · **Bestand:** `src/lib/account-history-repo.ts:237`

The delayed-deletion retention machinery is dead code — nothing ever purges an account

**Wat de speler merkt**
A player who uninstalls the plugin has no route to "forget me": their latest bank snapshot in `player_sync.bank_items` and their whole history ledger sit there indefinitely, and — given the unauthenticated /next read above — stay publicly retrievable by name forever. The schema advertises a scheduled-deletion promise the product does not keep.

**Voorgestelde fix**
Either wire it up or remove it. To wire it up: add a `vercel.json` cron hitting an authenticated `/api/cron/retention` that runs `DELETE FROM account_identity WHERE delete_after IS NOT NULL AND delete_after <= NOW()` (the cascades handle the rest) plus `DELETE FROM player_sync` / `player_claim` by rsn, and call `requestAccountDeletion` from the plugin's uninstall/disconnect path and from an unpaired "delete my data" flow that proves ownership via the install token. Also add an idle-retention sweep for `player_sync` rows untouched for N months.

<details><summary>Verificatienotitie</summary>

Confirmed by exhaustive grep. `grep -rn 'delete_after|account_retention|requestAccountDeletion' src scripts tests` returns exactly: the function definition at src/lib/account-history-repo.ts:237-258, the schema declarations at src/lib/sync-schema.ts:59/65/221/226, and tests/sync-schema.test.ts:35 (a table-name list assertion only). Zero callers, zero readers of delete_after. No vercel.json exists (confirmed), `grep -rniI cron src scripts package.json` returns nothing, and `ls scripts` shows no purge/sweep script (only build-*, audit-*, probe-*, db-init). The only live deletion is api/account/delete/route.ts:34 deleteAccountHistory(account.rsn), which requires a paired browser session (getConnectedAccount) — so a player who synced but never paired a browser has no in-product way to remove their data, and account-history-repo.ts:261+ shows deleteAccountHistory does delete player_sync (the row holding bank_items) when it is reached. The finding's credit-where-due is also accurate: buildHistoricalBankSummary (account-history.ts:123-133) stores only availability/itemCount/unavailableReason/checksum, not bank rows. Low is correct — it is an unkept schema promise plus a gap in the self-service deletion path, not an active vulnerability.

</details>

### L12. The override is real and I reproduced it, but the user-facing impact is overstated and the parenthetical about the fallback path is self-contradictory

**Dimensie:** Performance · **Bestand:** `next.config.ts:39`

The override is real and I reproduced it, but the user-facing impact is overstated and the parenthetical about the fallback path is self-contradictory. next.config.ts:17-21 and :38-41 apply `public, max-age=86400, stale-while-revalidate=604800` to /api/sprite/item/:path*, and .next/routes-manifest.json carries it verbatim. The route handler sets `public, max-age=604800, stale-while-revalidate=2592000` (route.ts:50). Against `next start` on port 4197: GET /api/sprite/item/4151.png returns `Cache-Control: public, max-age=86400, stale-while-revalidate=604800` with `x-scapestack-sprite-source: primary` — config wins, 7d collapses to 1d, and there is no s-maxage so the edge TTL shortens too. Corrections: (a) the generated-fallback path sets max-age=86400 itself, so it is unaffected — I confirmed /api/sprite/item/999999999.png returns the same 86400 either way; only the primary path loses 7d. (b) 'Bank and plan pages redraw with visibly slower icon loads on the first visit of each day' does not follow: stale-while-revalidate=604800 survives the override, so browsers that honour SWR serve the cached sprite instantly and revalidate in the background. The cost is extra function invocations (the handler has no conditional-request support, so each revalidation re-streams the full PNG), not visible latency, except on browsers that ignore SWR.

**Wat de speler merkt**
OSRS item sprites are immutable game art. Instead of being cached for a week, every item tile is revalidated daily — a 500-item bank means 500 conditional requests per user per day hitting a serverless function that proxies chisel.weirdgloop.org, instead of once per week. Bank and plan pages redraw with visibly slower icon loads on the first visit of each day.

**Voorgestelde fix**
Drop `/api/sprite/item/:path*` from the `headers()` rule in next.config.ts (the route already sets its own, longer policy), or change that rule to match the route: `public, max-age=604800, s-maxage=604800, stale-while-revalidate=2592000, immutable`. Note the config-level rule always beats the handler's header, so the two must not disagree.

<details><summary>Verificatienotitie</summary>

Read next.config.ts and src/app/api/sprite/item/[id]/route.ts in full, dumped .next/routes-manifest.json headers, then started the production server and curled both the primary and the fallback sprite paths, comparing response headers.

</details>

### L13. A 727 KB items.json is statically imported into sync-repo and duplicated across five server chunks (~4 MB) for one name lookup

**Dimensie:** Performance · **Bestand:** `src/lib/sync-repo.ts:13`

A 727 KB items.json is statically imported into sync-repo and duplicated across five server chunks (~4 MB) for one name lookup

**Wat de speler merkt**
No direct gameplay impact — this is deploy weight and cold-start read cost. About 4 MB of duplicated payload in the serverless bundles that only exists to name up to 24 collection-log items on a plugin sync.

**Voorgestelde fix**
Replace the static import with the existing lazy loader: make `collectionLogItemName` async (or pre-resolve names via `await getItems()` once inside `buildSyncDeltaSummary`) and delete `import itemsJson from "../../data/items.json"`. `data/items.json` is already file-traced into every relevant route (verified in the .nft.json manifests), so the disk read will work in production.

<details><summary>Verificatienotitie</summary>

Every number checks out. data/items.json is 727.4 KB / 28,744 entries. sync-repo.ts:13 statically imports it and the only reference is line 500 inside collectionLogItemName, reached from collectionLogItemDelta which caps at .slice(0, 24) on the sync write path. Grepping the production build for the inlined map ('Dwarf remains') across .js chunks (excluding .map files) returns exactly five: three ssr chunks at 901,088 bytes and two at 802,992 bytes, 4.31 MB total, and the inline form is literally `a.exports=JSON.parse('{"0":"Dwarf remains","1":"Toolkit",...`. sync-repo is pulled in by app/actions.ts, planning-context.ts, app/u/[rsn], app/quests/[slug], both sync routes and — additionally — account-pairing.ts, so the /api/account/* functions carry it too. data/items.json is separately traced into the function bundles (it appears in .next/server/app/next/page.js.nft.json), so it ships twice over. One caveat on the proposed fix: item-db.ts getName is async and returns undefined rather than the `#id` fallback, while collectionLogItemDelta is synchronous, so the swap needs a small refactor rather than being drop-in.

</details>

### L14. wiki.ts's unused price/mapping fetchers ship to the browser in four client chunks

**Dimensie:** Performance · **Bestand:** `src/lib/wiki.ts:45`

wiki.ts's unused price/mapping fetchers ship to the browser in four client chunks

**Wat de speler merkt**
A small amount of never-executed networking code in every page's JavaScript (/next ships ~301 KB brotli of JS total). Negligible on its own, but it is pure waste and it hides the fact that the app has three separate clients for the same two Wiki endpoints.

**Voorgestelde fix**
Move `wikiSearchUrl` into a tiny client-safe module (e.g. src/lib/wiki-url.ts) and repoint the 10 importers at it, then delete `getWikiItemMapping`/`getLatestPrices`/`getItemPrice` (or fold them into the single server-side Wiki client suggested for prices.ts/alch.ts).

<details><summary>Verificatienotitie</summary>

Confirmed. Grepping getWikiItemMapping|getLatestPrices|getItemPrice across src/, tests/ and scripts/ returns only the three definitions in wiki.ts (lines 45, 65, 85) plus the self-call at :88 — no external caller. Grepping the production client chunks for 'prices.runescape.wiki' returns exactly four files: 05ar3nvp4yyu5.js (69 KB), 0eh5h_69fq1l9.js (65 KB), 1_xa6xxbrcbrt.js (15 KB), 1r62903v4p4x1.js (91 KB). Two small corrections that do not change the conclusion: twelve modules import wikiSearchUrl from wiki.ts, not ten (the list misses tip-actions.ts and suggestions.ts), and parseWikiMapping/parseLatestPrices are not dead — tests/wiki.test.ts exercises both — so only the three fetchers and their module-level caches are unreachable at runtime.

</details>

### L15. Both routes duplicate the validator instead of importing @/lib/rsn, and both reject a name containing U+00A0 that POST /api/sync accepts — but neither

**Dimensie:** Onderhoudbaarheid · **Bestand:** `src/app/api/sync/status/route.ts:5`

Both routes duplicate the validator instead of importing @/lib/rsn, and both reject a name containing U+00A0 that POST /api/sync accepts — but neither of the claimed user-facing consequences holds. Nothing in src/ calls /api/sync/status (grep for "api/sync" across src returns only the write/claim routes and doc comments); the plugin's Java main sources never call /status either — the only caller in the repo is plugin/src/test/.../EndToEndSmokeTest.java:346 with a hardcoded test RSN. And ScapestackSyncPlugin.java:699 `normalizeRsn` folds U+00A0 at source, so live plugin builds never send it. For /api/account/pair/start the rsn passed by src/lib/account-connection.ts:29 is header.tsx's `activeRsn`, which resolves through loadAccountSnapshot -> account-storage.normalizeRsn (`rsn.trim().replace(/\s+/g, " ")`, and JS \s matches U+00A0), so it is already folded. A 400 requires the narrow case of an NBSP name pasted in while no account record exists so loadAccountSnapshot falls back to loadSavedRsn() (trim-only). The real defect is duplicated validation logic, not a live outage.

**Wat de speler merkt**
A player whose display name has a space (the client stores it as U+00A0) can now sync from RuneLite — /api/sync accepts them — but the browser-side verification page and the "connect another browser" pairing flow both hand them back "Enter a valid OSRS name" with a 400. The plugin appears to work and the website appears to deny that they exist, which reads as the site being broken for anyone whose RSN is not one word.

**Voorgestelde fix**
Delete both local RSN_RE constants and the inline length checks; import { RSN_MAX_LENGTH, cleanRsnInput, isValidRsn, normalizeRsn } from "@/lib/rsn" and validate the cleaned value, exactly as src/app/api/sync/route.ts:135-138 already does. Then add a repo-wide guard test asserting that `/^\[A-Za-z0-9 _-\]\+\$/` appears only in src/lib/rsn.ts, so the fifth copy cannot appear.

<details><summary>Verificatienotitie</summary>

Verified src/app/api/sync/status/route.ts:5,13-14 and src/app/api/account/pair/start/route.ts:4,16 — both inline `/^[A-Za-z0-9 _-]+$/` and neither imports @/lib/rsn (only api/sync/route.ts:20 and api/sync/claim/route.ts:16 do). So the duplication claim is exactly right. The impact claim is not: grep shows zero callers of /api/sync/status anywhere in src (the /plugin verify flow uses the syncedPlayerAction server action, not this route), and plugin/src/main/java has no reference to /status at all. ScapestackSyncPlugin.java:699-703 folds ' ' to ' ' before the name enters the plugin. On the pairing side, account-storage.ts:65-67 folds interior whitespace on every upsert, and header.tsx:282-291 calls setActiveAccount then refresh(), which re-reads the folded value, so the mainline path never carries NBSP to the endpoint.

</details>

### L16. Three independent clients with three User-Agents and TTLs is accurate, and wiki.ts's fetch layer (getWikiItemMapping, getLatestPrices, getItemPrice) i

**Dimensie:** Onderhoudbaarheid · **Bestand:** `src/lib/wiki.ts:44`

Three independent clients with three User-Agents and TTLs is accurate, and wiki.ts's fetch layer (getWikiItemMapping, getLatestPrices, getItemPrice) is confirmed dead with tests/wiki.test.ts covering only its parsers. But the 'more importantly' half is wrong: the duplicated max(high,low) bank-value rule at wiki.ts:121 sits inside parseLatestPrices, which is only reachable from the three dead fetchers, so a divergence there cannot affect any bank total. The live rule exists in exactly one place, prices.ts:34-36. Also wikiSearchUrl has 12 call sites, not 5.

**Wat de speler merkt**
Indirect but real: the Wiki asks callers to identify themselves, and Scapestack presents as three different clients at three versions, one of which is a phantom. More importantly the bank-value rule that makes totals match RuneLite's Bank Memory now exists in two places, so the next tweak fixes one and leaves the other.

**Voorgestelde fix**
Delete getWikiItemMapping, getLatestPrices, getItemPrice, parseWikiMapping and parseLatestPrices from src/lib/wiki.ts and their tests, reducing wiki.ts to wikiSearchUrl. Hoist the USER_AGENT string to one shared constant used by prices.ts and alch.ts, derived from package.json version so it cannot go stale again.

<details><summary>Verificatienotitie</summary>

Verified prices.ts:5,7-8 (latest endpoint, UA 'scapestack/0.3 - https://www.scapestack.org', 1h TTL), alch.ts:6-8 (mapping endpoint, UA 'scapestack/0.3 - personal project', 24h TTL), wiki.ts:9-13 (both endpoints, UA 'scapestack/0.6 (+https://www.scapestack.org)', 24h/10min). Grepped each wiki.ts export across src+tests+scripts: getWikiItemMapping, getLatestPrices and getItemPrice appear only in their own file; parseWikiMapping/parseLatestPrices appear only there and in tests/wiki.test.ts; wikiSearchUrl has 12 importers. Line numbers in the finding are consistently one or two low (getWikiItemMapping is :45 not :44, wikiSearchUrl :41 not :40, the value rule :121 not :118). Severity lowered because the concrete harm the finding leads with — the bank-value rule drifting — cannot occur while wiki.ts's copy is unreachable.

</details>

### L17. Accurate as stated, including the unreachable-today caveat

**Dimensie:** Onderhoudbaarheid · **Bestand:** `src/lib/next-up-shared.ts:8`

Accurate as stated, including the unreachable-today caveat. Two small corrections: path-progress.ts re-declares the case-sensitive closure at six lines (153, 171, 290, 437, 500, 575), not five, and next-up-shared.ts's `lvl` is at :9-10 rather than :8. Since the finding itself states there is no impact today and the path is unreachable, this is a low-severity trap for a future curator, not a medium defect.

**Wat de speler merkt**
Nothing today — the path is unreachable because no data uses it. The trap is for the next person to curate a gate: content-access-data.ts's header says "Quest names must match data/quests.json exactly; tests assert that", which reasonably reads as covering the whole file. A skill written "runecraft" or "Runecrafting" instead of "Runecraft" silently resolves to level 1, marks the requirement missing, and permanently suppresses that boss or money method for every player — the quiet-failure case content-access-data.ts:3-5 explicitly warns about.

**Voorgestelde fix**
Make src/lib/next-up-shared.ts:8 case-insensitive (it is already the shared helper, so this collapses three variants into one) and replace the five inline closures in path-progress.ts and the two private skillLevel copies with it. Then either delete the unused `skills` field from AccessRequirement, or extend tests/content-access.test.ts with the same style of guard used for quest names: every `need.skill` must appear in the canonical Hiscores skill-name list.

<details><summary>Verificatienotitie</summary>

Read all cited sites. next-up-shared.ts:9-10 `skills.find((s) => s.name === name)` is case-sensitive; quest-requirements.ts:177-179, diary-requirements.ts:240-242 and path-progress.ts:935-938 all use `row.name.toLowerCase() === skill.toLowerCase()`. content-access.ts:30 imports `lvl` and :89-97 uses it for the gate exactly as described (missing.push -> state 'locked' -> suppressed at :114). `skills?: Array<{ skill; level }>` is declared at content-access.ts:40 and grep confirms zero `skills:` keys in content-access-data.ts. tests/content-access.test.ts is 148 lines; its only data guards are the quest-name check at :126-133 and the slug check at :136-146 — no skill-name assertion anywhere. content-access-data.ts:9-11 does say 'Quest names must match data/quests.json exactly; tests assert that', which is the misleading-scope point.

</details>
