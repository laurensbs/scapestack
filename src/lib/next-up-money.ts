// Money-making methods for the /next engine.
//
// MONEY_METHODS is a curated catalogue: each entry carries its skill
// requirements, an expected GP/hr used only for ranking, and player-facing
// copy. Rates are estimates by design — the engine says so in the card, and
// rate-registry.ts decides how much confidence each one earns.
//
// Ironmen get no money recs at all; buying is not their route.

import { computeCombatLevel, type HiscoreSkill } from "./hiscores";
import { isIronPlannerAccount } from "./account-type";
import type { AccountMeta } from "./path-progress";
import { formatRateRange, moneyMethodRate, rateRankingValue } from "./rate-registry";
import { lvl } from "./next-up-shared";
import {
  accessNeedsLine,
  accessScoreMultiplier,
  evaluateAccess,
  type AccessContext,
  type AccessVerdict
} from "./content-access";
import { MONEY_ACCESS } from "./content-access-data";
import type { Recommendation } from "./next-up-types";

interface MoneyMethod {
  slug: string;
  name: string;
  req: Array<{ skill: string; level: number }>;
  gpHr: number;          // approximate, used for display + sort
  intensity: "afk" | "active" | "intense";
  payoff: string;        // 1-line description of what you actually do
  iconItemId: number;
  /** Concrete vereisten — items, locaties, levels. Tonen in de detail-
   *  expand als bullet list. ~5 regels max. */
  needs?: string[];
  /** Langere uitleg / walkthrough — meerdere regels mogelijk. */
  details?: string;
}

const MONEY_METHODS: MoneyMethod[] = [
  {
    slug: "blast-furnace", name: "Blast Furnace · Gold bars",
    req: [{ skill: "Smithing", level: 40 }],
    gpHr: 350_000, intensity: "active",
    payoff: "~140-180k bars/hour. Goldsmith gauntlets push XP to ~225k/hour.",
    iconItemId: 2357,
    needs: [
      "Goldsmith gauntlets (Family Crest reward, ~75 Magic alt)",
      "Stamina potions OR 60+ Agility for the bellows",
      "Coal bag from the Mining Guild",
      "Ice gloves to grab bars off the dispenser (or wear Smiths gloves (i))",
      "World 358 / official Blast Furnace worlds for the 50% coal discount"
    ],
    details: "Buy gold ore at GE, withdraw stamina potions, fill the conveyor in batches of 28. With Goldsmith gauntlets you make ~225k Smithing XP/hr — the fastest non-buyable Smithing in the game. Profit margin lives in the gold-bar / gold-ore GE spread; check before starting."
  },
  {
    slug: "zulrah", name: "Zulrah",
    req: [{ skill: "Magic", level: 75 }, { skill: "Ranged", level: 75 }, { skill: "Defence", level: 70 }],
    gpHr: 2_500_000, intensity: "intense",
    payoff: "30-40 KPH at peak. Tanzanite/Magic fang + Mutagen jackpots.",
    iconItemId: 12934,
    needs: [
      "Regicide + Lost City completed (Magic fang upgrade for Trident)",
      "Trident of the Seas (or Swamp) + Magic blowpipe",
      "Karil's / Black d'hide for the ranged phase; Ahrim's / Ancestral for magic",
      "Anti-venom+ (4) × 3-5 — Zulrah's venom hits fast",
      "Stamina potions + Saradomin brews if you're not tanking with prayer flicks"
    ],
    details: "Each kill is 4 phases on a rotation pattern — there are 4 distinct rotations. Learn one rotation first (RuneLite's Zulrah Helper plugin draws the safe-spots). Pure ranged is easier than ranged+magic switching; the trident only matters from rotation 3-4. Best 1-hour profit at this CL tier outside of raids."
  },
  {
    slug: "vorkath", name: "Vorkath",
    req: [{ skill: "Attack", level: 80 }, { skill: "Ranged", level: 80 }, { skill: "Defence", level: 75 }],
    gpHr: 3_000_000, intensity: "intense",
    payoff: "30-40 KPH solo with Dragon hunter crossbow + Masori. Visage jackpots.",
    iconItemId: 21907,
    needs: [
      "Dragon Slayer II completed",
      "Dragon hunter crossbow (or Toxic blowpipe as a poor-man's start)",
      "Salve amulet (ei) — +20% damage / accuracy, mandatory",
      "Extended super antifire (4) × 2-3",
      "Ranger boots / Pegasian boots, Masori / Armadyl, Avernic / Elidinis"
    ],
    details: "DHCB + Masori + Salve (ei) is the meta. Bring Ruby bolts (e) for the cap-spec phases below 250 HP. Pattern: 3-5 fireball acid → poison cloud → zombie spawn → blue fire 'sleep'. RuneLite's Vorkath Helper highlights the safe spot every poison phase. Visage drops average 1/4000 — a single one is 90M+."
  },
  {
    slug: "wines-zammy", name: "Wines of Zamorak (telegrab)",
    req: [{ skill: "Magic", level: 33 }],
    gpHr: 600_000, intensity: "active",
    payoff: "~1.5k wines/hour. Free Magic XP on top.",
    iconItemId: 245,
    needs: [
      "33 Magic for Telekinetic Grab",
      "Law runes × ~1k + Air runes × ~1k (telegrab uses no nature runes)",
      "Mage of Zamorak monks deal damage — bring food OR use the Protect from Melee piety setup",
      "Chronicle / Falador teleport for the bank trip"
    ],
    details: "Telegrab the wine off the table in the Chaos Temple north-west of Falador. Each wine is ~400 GP. The trick: hop worlds when the wine de-spawns OR another grabber takes it. Best done with the RuneLite 'Wines of Zamorak' plugin which auto-shows respawn timer. Boring but reliable cash for low-CL accounts."
  },
  {
    slug: "blood-runes", name: "Blood rune crafting (Arceuus)",
    req: [{ skill: "Runecraft", level: 77 }],
    gpHr: 1_200_000, intensity: "active",
    payoff: "~2k bloods/hour with Arceuus favor + Dark essence blocks.",
    iconItemId: 565,
    needs: [
      "100% Arceuus favor (Mark of Darkness spell + Dark Altar access)",
      "Chisel for chipping Dark essence fragments",
      "Daeyalt essence shards (better than regular essence — Daeyalt mines in Meiyerditch)",
      "Stamina potions for the back-and-forth",
      "Graceful or Farmer's outfit for run-energy"
    ],
    details: "Mine Daeyalt essence in Meiyerditch (lvl 50 Mining), bring it to the Dense essence mine for Dark essence blocks, chip into fragments, run to Blood Altar. Multi-step but profits scale linearly with Runecraft. At 90+ Runecraft with Raiments of the Eye you can hit ~1.5M GP/hr."
  },
  {
    slug: "wrath-runes", name: "Wrath rune crafting",
    req: [{ skill: "Runecraft", level: 95 }],
    gpHr: 1_800_000, intensity: "active",
    payoff: "Top non-soul/blood RC. Wraith runes track Death's catalyst demand.",
    iconItemId: 21880,
    needs: [
      "Dragon Slayer II completed (Myths Guild access)",
      "Giant pouch + Colossal pouch (Guardians of the Rift unlock)",
      "Eternal glory for fastest teleport to Myths Guild",
      "Pure essence × 28 per trip",
      "Raiments of the Eye outfit (+10% rune yield)"
    ],
    details: "Run from Myths Guild basement altar to bank, fill pouches, repeat. Same loop as Death runes but pays better at endgame. Pair with Mahogany Homes XP-stacking via the Mythic Statue for free hourly Construction reward."
  },
  {
    slug: "redwood-cut", name: "Redwood logs",
    req: [{ skill: "Woodcutting", level: 90 }],
    gpHr: 250_000, intensity: "afk",
    payoff: "~50k WC XP/hour fully AFK. Pet rolls + nests on top.",
    iconItemId: 19669,
    needs: [
      "Crystal axe / Dragon axe (3rd-age if you're feeling fancy)",
      "Lumberjack outfit (Temple Trekking) for +2.5% XP",
      "Birch / Yew shortcut from Woodcutting Guild for the bank trip",
      "Forester's ring (Forestry update) for tree-bound XP boost"
    ],
    details: "Climb the redwood tree south-west of the Woodcutting Guild, click → AFK for 5+ minutes per log. The longest-AFK WC tier in the game — popular for second-monitor / phone-attention training. Nest drops are auto-noted, and ring nests cover the trip cost."
  },
  {
    slug: "amethyst-mine", name: "Amethyst mining",
    req: [{ skill: "Mining", level: 92 }],
    gpHr: 280_000, intensity: "afk",
    payoff: "~25k Mining XP/hour fully AFK. Amethyst arrowtips / bolt tips stack value.",
    iconItemId: 21347,
    needs: [
      "Crystal pickaxe / Dragon pickaxe (Infernal pickaxe also works)",
      "Prospector's outfit for +2.5% XP",
      "Chisel for converting amethyst to dart/javelin/bolt tips",
      "Mining Guild teleport (Skills necklace) for bank trips"
    ],
    details: "Mine amethyst in the Mining Guild — sits two levels below the Falador entrance. 100% AFK with crystal pickaxe special active. Chisel the amethyst into bolt tips for +30% margin vs raw amethyst sale price; bolt tips sell instantly to fletchers."
  },
  // Herb runs — gesplitst per herb-tier zodat de speler ziet wat HIJ
  // moet planten gegeven zijn level. Eén "Daily herb runs" entry was
  // te abstract; nu krijg je expliciet 'Ranarr (lvl 32, ~110k/run)'.
  {
    slug: "herbs-ranarr", name: "Herb run · Ranarrs",
    req: [{ skill: "Farming", level: 32 }],
    gpHr: 800_000, intensity: "active",
    payoff: "~5 min per run, 8-10 patches. ~110k GP per herb run at current Ranarr seed/grimy price.",
    iconItemId: 207,
    needs: [
      "Magic secateurs equipped (+10% yield) — Fairytale I reward",
      "Bottomless compost bucket + ultracompost",
      "Farming cape teleport for the runs (cape on > Falador shortcut)",
      "Patches: Falador · Catherby · Ardougne · Hosidius · Farming Guild · Troll Stronghold · Harmony Island · Weiss",
      "Ranarr seed ≈ 30-40k each; one Ranarr ≈ 7-9k; ~7 herbs/patch = ~50k GP profit per patch"
    ],
    details: "Run between 8 herb patches and replant. Around 5 minutes per run, 4-6 runs per day. Use 'Patch teleport' from Spirit tree → Tree gnome village or use the Skills necklace to Farming guild for fast travel. Magic secateurs and ultracompost both boost yield meaningfully."
  },
  {
    slug: "herbs-snapdragon", name: "Herb run · Snapdragons",
    req: [{ skill: "Farming", level: 62 }],
    gpHr: 1_400_000, intensity: "active",
    payoff: "~5 min per run, 8-10 patches. ~190k GP per herb run; Snapdragon = potion staple (Super restores).",
    iconItemId: 3000,
    needs: [
      "Same 8 patches as Ranarr (Falador..Weiss)",
      "Magic secateurs + ultracompost recommended",
      "Snapdragon seed ≈ 45-60k; one Snapdragon ≈ 10-12k; ~7 herbs/patch = ~70-80k profit per patch",
      "Super restore demand stays high — easy resell at GE"
    ],
    details: "Drop-in replacement for Ranarr once you hit 62 Farming. Snapdragons pay slightly better and feed straight into Super restore potion crafting. Bring potato cactus / wine of zamorak if you're combining a Herblore session right after."
  },
  {
    slug: "herbs-torstol", name: "Herb run · Torstols",
    req: [{ skill: "Farming", level: 85 }],
    gpHr: 2_200_000, intensity: "active",
    payoff: "~5 min per run, 8-10 patches. ~260k GP per herb run; Torstol = Super combats backbone.",
    iconItemId: 219,
    needs: [
      "Same 8 patches as Ranarr/Snapdragon",
      "Magic secateurs + ultracompost (mandatory at this tier)",
      "Torstol seed ≈ 75-90k; one Torstol ≈ 9-11k; ~7 herbs/patch ≈ profit varies on seed price",
      "Pair with Avantoes on a separate cycle if you want both Super combats + Anti-venoms+"
    ],
    details: "Premium herb run at endgame. Torstol price floats around Super combat demand — if Super combats spike (raid prep) so does Torstol. Some players grow Torstol only at high-yield patches (Farming guild, Weiss) and Snapdragon elsewhere to balance seed cost."
  },
  // Tree runs — passive XP-heavy, light GP. Belongrijke daily-loop.
  {
    slug: "tree-runs", name: "Tree run · Mahoganies",
    req: [{ skill: "Farming", level: 55 }],
    gpHr: 250_000, intensity: "active",
    payoff: "~5 min per run, 6 fruit-tree + 4 tree patches. Massive Farming XP per cycle (~30k+ XP/run).",
    iconItemId: 6332,
    needs: [
      "Mahogany sapling × 4 (Etceteria · Tree gnome village · Falador · Lletya) — made from saplings @ 50-60k each",
      "Papaya/Palm sapling for fruit-tree patches if you want bonus XP",
      "Stronghold teleport + Spirit tree network",
      "Plus 2 hop-along bushes (Calquat at Tai Bwo Wannai) if Farming ≥ 72"
    ],
    details: "Tree-runs are the XP backbone for Farming until 99. Plant trees every ~3 hours and they grow while you do anything else. Combine with the herb-run cycle for the same trip. Use farmer's hat (1% XP bonus, 2.5% in full outfit)."
  },
  // Birdhouses — passive Hunter XP + nest drops. Daily voor de chill mood.
  {
    slug: "birdhouses", name: "Birdhouse run",
    req: [{ skill: "Hunter", level: 5 }, { skill: "Crafting", level: 5 }],
    gpHr: 120_000, intensity: "afk",
    payoff: "~3 min every 50 min · ~10k Hunter XP + 4 random nests (including ring & seed nests).",
    iconItemId: 10092,
    needs: [
      "Hunter & Crafting tier: Regular (5), Oak (15), Willow (25), Teak (35), Maple (45), Mahogany (50), Yew (60), Magic (75), Redwood (90)",
      "Logs + clockwork (made at Workbench, Mahogany homes house)",
      "Hop or seeds to bait (10 per house)",
      "Set: 4 birdhouses on Fossil Island"
    ],
    details: "Set 4 birdhouses, do something else for 50 minutes, come back, empty + reset. Yields nests randomly — including ring nests (~25k GP each) and the rare 'Bird egg' nests for elite clues. Best passive Hunter XP under 80, and great GP-per-minute compared to active grinding."
  },
  // Farming contracts — vooral XP-locked rewards via Guildmaster Jane.
  {
    slug: "farming-contracts", name: "Farming Guild contracts",
    req: [{ skill: "Farming", level: 65 }],
    gpHr: 100_000, intensity: "active",
    payoff: "Daily Easy/Medium/Hard contract from Guildmaster Jane — XP lamps + Seed pack rewards.",
    iconItemId: 22996,
    needs: [
      "Hosidius Farming Guild access (60 Farming)",
      "Some hespori seed + various herb/tree seeds in inventory",
      "Pet rolls scale with contract tier — Hard contracts roll ~ 1/2300 for Tangleroot"
    ],
    details: "Pick the highest tier you can clear. Hard contracts unlock at 85 Farming and roll the best pet rate. Stack contract completions with regular tree + herb runs and your Farming XP doubles per cycle."
  },
  {
    slug: "tithe-farm", name: "Tithe Farm fruit",
    req: [{ skill: "Farming", level: 34 }],
    gpHr: 0, intensity: "active",
    payoff: "Zero GP — pure Farmer's outfit + Seed box grind. Worth 200-300 points/game.",
    iconItemId: 13647,
    needs: [
      "Hosidius 100% favor",
      "Spade + Watering can (8)",
      "Farming level decides which seed you get: Golovanova (34), Bologano (54), Logavano (74)",
      "Drakan's medallion / Hosidius teleport for the trip back"
    ],
    details: "Water + harvest 20 plants per ~5 minute round. Pure points-grind — XP and points scale per round. Goal: 200 points = Farmer's outfit (+2.5% Farming XP fully kitted), 400 points = Seed box (saves space on herb runs). Do this once for the outfit, never again."
  },
  {
    slug: "moss-killers", name: "Moss giants",
    req: [{ skill: "Attack", level: 30 }],
    gpHr: 150_000, intensity: "active",
    payoff: "Big bones + rune drops. F2P-friendly. Best early-CL GP method.",
    iconItemId: 1623,
    needs: [
      "Combat 30+ (or just go in with whip-tier gear)",
      "Looting bag (Wilderness Slayer reward shop, or buy from G.E.)",
      "Burning amulet for the wilderness teleport (or Slayer ring near Edgeville)",
      "Prayer potions if you're flicking Piety; food otherwise"
    ],
    details: "Crash the multi-spot in the Wilderness north of Edgeville — protect against PKers with a burning amulet + 3-item kit + looting bag. Drops big bones, mystic robes (rare), and 12-50 noted rune drops per kill. Wilderness Slayer task lines up perfectly — Krystilia tasks them often."
  },
  {
    slug: "rune-dragons", name: "Rune dragons",
    req: [{ skill: "Attack", level: 80 }, { skill: "Magic", level: 80 }, { skill: "Defence", level: 80 }],
    gpHr: 1_400_000, intensity: "active",
    payoff: "Dragon bones (~3k each) + Rune bars consistent. Visage 1/8000.",
    iconItemId: 22293,
    needs: [
      "Dragon Slayer II (gate)",
      "Lightbearer / Berserker ring (extra spec for Voidwaker / DDS)",
      "Insulated boots (Lunar Diplomacy reward — mandatory, they shock you otherwise)",
      "Anti-dragon shield (Dragonfire shield prefered) + Super antifire (4) × 2-3",
      "Bandos / Justiciar / Inquisitor for melee setup; tank dragonfire properly"
    ],
    details: "Located in the Lithkren Vault basement (DS2 quest area). 20-25 KPH solo with melee — the rune bars and dragon bones each pay ~half of the hourly rate. Drops the Dragon limbs for Dragon crossbow assembly — popular Slayer-task method when Konar sends you there."
  }
];

function fmtGp(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return `${n}`;
}

function editorialEstimateCopy(value: string | undefined): string | undefined {
  if (!value || !/gp|profit|price|margin|cost/i.test(value)) return value;
  return /^estimate:/i.test(value) ? value : `Estimate: ${value}`;
}

export function moneyRecs(
  skills: HiscoreSkill[],
  accountMeta?: AccountMeta | null,
  access?: AccessContext
): Recommendation[] {
  if (skills.length === 0) return [];
  if (
    isIronPlannerAccount(accountMeta?.accountType)
  ) {
    return [];
  }

  // Most of this catalogue sits behind a quest or Kourend favour. Without this
  // check a questless account gets told to farm Vorkath and craft wrath runes.
  const accessContext: AccessContext = access ?? { skills };

  // Dedupe ladders — methods waar lagere tiers obsoleet worden zodra
  // de hogere unlockt. Houden we alleen de top-tier waar de speler aan
  // voldoet, anders krijg je drie identieke herb-runs naast elkaar.
  const LADDERS: Record<string, string[]> = {
    herbs: ["herbs-torstol", "herbs-snapdragon", "herbs-ranarr"]  // best-first
  };
  const slugToLadderKey = new Map<string, string>();
  for (const [key, slugs] of Object.entries(LADDERS)) {
    for (const slug of slugs) slugToLadderKey.set(slug, key);
  }

  // Pre-filter: pak per ladder de hoogste qualifying tier. Een method die
  // bewezen op slot zit telt hier niet mee, anders blokkeert hij de ladder
  // voor een tier die de speler wel kan doen.
  const qualifyingSlugs = new Set<string>();
  const accessBySlug = new Map<string, AccessVerdict>();
  for (const m of MONEY_METHODS) {
    if (!m.req.every((r) => lvl(skills, r.skill) >= r.level)) continue;
    const verdict = evaluateAccess(MONEY_ACCESS[m.slug], accessContext);
    accessBySlug.set(m.slug, verdict);
    if (verdict.state === "locked") continue;
    qualifyingSlugs.add(m.slug);
  }
  const topPerLadder = new Map<string, string>();
  for (const [key, slugs] of Object.entries(LADDERS)) {
    const top = slugs.find((s) => qualifyingSlugs.has(s));
    if (top) topPerLadder.set(key, top);
  }

  const recs: Recommendation[] = [];
  for (const m of MONEY_METHODS) {
    if (!qualifyingSlugs.has(m.slug)) continue;
    // Ladder dedupe — alleen de top-tier survives.
    const ladderKey = slugToLadderKey.get(m.slug);
    if (ladderKey && topPerLadder.get(ladderKey) !== m.slug) continue;

    // Don't suggest tiny GP/hr methods to high-stat players — irrelevant.
    // The threshold scales loosely with combat level so a low-CL account
    // still sees the lower-tier money-makers.
    const cl = computeCombatLevel(skills);
    const minGpHr = cl >= 110 ? 800_000 : cl >= 80 ? 200_000 : 50_000;
    // Profit relevance and session fit are separate decisions. A high-combat
    // account can still deliberately ask for AFK progress, so keep proven
    // low-attention methods in the candidate pool even when their gp/hr would
    // be noise on the GP route. The mood contract decides whether to show it.
    if (m.gpHr < minGpHr && m.intensity !== "afk") continue;
    const rate = moneyMethodRate({
      slug: m.slug,
      expectedGpPerHour: m.gpHr,
      assumptions: [
        `${m.intensity} pace with the listed requirements`,
        "GE buy limits, banking variance and learning time are not guaranteed",
        "Test one short block before committing supplies"
      ]
    });
    const rankingValue = rateRankingValue(rate, accountMeta?.accountType ?? null);
    // `unknown` means we could not confirm the unlock. Say so on the card and
    // let a confirmed method outrank it, rather than quietly assuming access.
    const verdict = accessBySlug.get(m.slug) ?? { state: "unlocked" as const, missing: [], unverified: [] };
    const accessLine = accessNeedsLine(verdict);
    const baseNeeds = m.needs?.map((line) => editorialEstimateCopy(line) ?? line) ?? [];
    recs.push({
      id: `money:${m.slug}`,
      kind: "money",
      title: m.name,
      why: m.gpHr > 0
        ? `Estimated ${formatRateRange(rate.range, fmtGp)} GP/hr · ${m.intensity}`
        : m.intensity,
      payoff: editorialEstimateCopy(m.payoff),
      decisionReason: verdict.state === "unknown"
        ? `${m.name} matches your levels, but Scapestack cannot confirm you have ${verdict.unverified.join(" and ")} yet. Sync RuneLite to remove the guess.`
        : `${m.name} matches your levels. The rate is a Wiki-based estimate, so test one short block before committing supplies.`,
      needs: accessLine ? [accessLine, ...baseNeeds] : baseNeeds,
      details: m.details ? `${editorialEstimateCopy(m.details)} ${rate.freshness === "fresh" ? "Rate guide checked Jul 17." : "Rate evidence is older; verify prices first."}` : undefined,
      // Weak or stale evidence loses ranking weight instead of presenting the
      // biggest catalogue number as the obvious winner.
      score: (46 + Math.min(20, Math.log10(Math.max(1, rankingValue)) * 2) + rate.confidenceWeight * 4)
        * accessScoreMultiplier(verdict),
      link: undefined,
      iconItemId: m.iconItemId,
      routeTags: [
        "gp",
        ...(m.intensity === "afk" ? ["afk" as const] : []),
        ...(m.slug.includes("herbs") || m.slug.includes("birdhouses") || m.slug.includes("tree") ? ["rebuild" as const, "returning" as const] : []),
        ...(m.slug === "vorkath" || m.slug === "zulrah" || m.slug === "rune-dragons" ? ["pvm" as const] : [])
      ],
      gearConfidence: m.intensity === "intense" ? "unknown" : "not-needed",
      quality: {
        accountFit: 0.74,
        actionability: m.intensity === "intense" ? 0.58 : 0.84,
        stopPoint: m.slug.includes("herbs") || m.slug.includes("birdhouses") ? 0.95 : 0.78,
        gearConfidence: m.intensity === "intense" ? 0.5 : 0.86,
        unlockValue: 0.62,
        fun: m.intensity === "afk" ? 0.62 : m.intensity === "intense" ? 0.74 : 0.58,
        friction: m.intensity === "intense" ? 0.62 : 0.24
      },
      planSeed: {
        timebox: m.intensity === "afk" ? "45-90 min" : "30-60 min",
        prep: `${m.name} is a ${m.intensity} money option matched to your current levels.`,
        steps: [
          m.gpHr > 0 ? `Run a measured half-hour and compare real profit against the estimated ${formatRateRange(rate.range, fmtGp)} GP/hr range.` : "Use this as an unlock/reward session rather than a profit session.",
          "Check supply and GE prices before committing to a long grind.",
          "Spend the profit on the next unlock shown above instead of letting cash sit idle."
        ]
      }
    });
  }
  return recs;
}
