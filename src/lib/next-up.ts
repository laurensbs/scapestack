// "What to do now" — the recommendation engine behind the /next hub.
//
// Plenty of OSRS players hit a wall: maxed-ish stats, a full bank, and no
// idea what to chase. This module turns the data the toolkit already has —
// live Hiscores skill levels + the player's pasted bank + the curated goal
// sets + the boss roster — into a short, ranked list of concrete next steps.
//
// Each recommendation carries a `score` (higher = surface sooner), a plain
// `why`, an optional payoff, and a `link` into whichever existing tool the
// player would use to act on it. The hub renders one headline pick plus the
// rest as a checklist.

import {
  GOAL_SETS, checkCompletion, normaliseCompletion, overallStats,
  type CompletionItem, type SetCompletion
} from "./goals";
import { BOSSES } from "./bosses";
import { computeCombatLevel, computeTotalLevel, type HiscoreSkill } from "./hiscores";
import { getQuests, type QuestRecord } from "./quest-db";
import { getDiaries, type DiaryRecord, type DiaryTier } from "./diary-db";
import { getDropRates, type BossDropTable } from "./drop-rates-db";

// Kind drives the icon + accent the hub renders, and groups the checklist.
export type RecKind =
  | "goal"       // a goal set 1-2 items from done
  | "quest"      // a Wiki-listed quest the player's stats now meet
  | "diary"      // an Achievement Diary tier the player's stats now meet
  | "boss"       // a boss the player's combat level now supports
  | "kc"         // boss KC-aware insight (drop rate vs your kill count)
  | "minigame"   // a minigame the player's skill levels now unlock
  | "money"      // a money-making method matched to the player's skills
  | "skill"      // a skill sitting just short of a milestone level
  | "bank"       // a bank-hygiene action (clear junk, complete a set)
  | "milestone"; // an account-wide milestone (quest cape range, maxing, etc.)

export interface Recommendation {
  id: string;             // stable key
  kind: RecKind;
  title: string;          // the action — imperative, short
  why: string;            // one line: why it's worth doing now
  payoff?: string;        // optional: what completing it unlocks/gives
  /** 0-100, higher surfaces first. The top scorer becomes the headline. */
  score: number;
  /** Tool route to act on this, e.g. "/goals" or "/dps". */
  link?: string;
  /** Optional OSRS item id for a sprite on the card. */
  iconItemId?: number;
}

export interface NextUpInput {
  /** Live Hiscores skills. Empty when no RSN was looked up. */
  skills?: HiscoreSkill[];
  /** The player's bank as id+name pairs. Empty when no bank was pasted. */
  bank?: CompletionItem[];
  /** Total quest points (from Hiscores activities). Used to gate quest recs. */
  questPoints?: number;
  /** Boss kill-counts from Hiscores activities — keyed by activity name.
   *  Used to compute expected-uniques ("142 Vorkath KC ≈ 0.85 visages"). */
  bossKc?: Record<string, number>;
}

export interface NextUpResult {
  /** The single strongest recommendation — the hub's headline. */
  headline: Recommendation | null;
  /** Everything else, already sorted high-score-first. */
  rest: Recommendation[];
  /** Quick account read-out for the hub header. */
  summary: {
    combatLevel: number | null;
    totalLevel: number | null;
    goalPercent: number | null;
    /** Coverage note — which inputs the advice is based on. */
    basis: "full" | "hiscores-only" | "bank-only" | "none";
  };
}

// Skill milestones worth nudging a player toward — levels that unlock
// meaningful content or are satisfying round numbers. Within a few levels of
// one of these, the engine suggests pushing for it.
const SKILL_MILESTONES: Record<string, { level: number; unlock: string }[]> = {
  Slayer:  [{ level: 85, unlock: "Abyssal demons → whip" }, { level: 93, unlock: "Cryptic clue tasks" }, { level: 99, unlock: "Slayer cape" }],
  Agility: [{ level: 70, unlock: "Ardougne rooftop course" }, { level: 99, unlock: "Agility cape" }],
  Herblore:[{ level: 78, unlock: "Magic potions" }, { level: 90, unlock: "Extended antifire" }, { level: 99, unlock: "Herblore cape" }],
  Farming: [{ level: 83, unlock: "Magic trees + Hespori" }, { level: 99, unlock: "Farming cape" }],
  Mining:  [{ level: 85, unlock: "Amethyst" }, { level: 99, unlock: "Mining cape" }],
  Prayer:  [{ level: 70, unlock: "Piety" }, { level: 77, unlock: "Rigour/Augury (with quests)" }, { level: 99, unlock: "Prayer cape" }],
  Construction: [{ level: 83, unlock: "Nexus / max POH" }, { level: 99, unlock: "Construction cape" }]
};

// Boss combat-level gates — a rough "you can realistically start here" bar.
// Not a hard requirement (OSRS rarely has those for bosses) but the point
// where a boss becomes a sensible suggestion for a stuck player. Slugs match
// BOSSES in bosses.ts exactly.
const BOSS_CL_GATE: Record<string, number> = {
  "obor": 50, "bryophyta": 55, "giant-mole": 65,
  // bosses.ts has both "kbd" and "king-black-dragon" as legacy duplicates;
  // listing only one prevents the same boss appearing twice in the hub.
  "barrows": 75, "king-black-dragon": 80, "sarachnis": 80,
  "dks-rex": 85, "dks-prime": 85, "dks-supreme": 85, "kraken": 85,
  "zulrah": 90, "sire": 95, "thermonuclear": 90, "skotizo": 95,
  "vorkath": 100, "graardor": 100, "kree": 100, "cerberus": 100,
  "grotesque-guardians": 100, "phantom-muspah": 105, "demonic-gorillas": 105,
  "zilyana": 110, "kril": 110, "hydra": 110, "araxxor": 110,
  "vardorvis": 115, "leviathan": 115, "whisperer": 115, "duke-sucellus": 115,
  "nex": 120
};

const lvl = (skills: HiscoreSkill[], name: string): number =>
  skills.find((s) => s.name === name)?.level ?? 1;

// ── Recommendation sources ──────────────────────────────────────────────────

// Goal sets the player is 1-2 items away from completing — the highest-value,
// most actionable thing for a stuck player. Closer = higher score.
function goalRecs(completions: SetCompletion[]): Recommendation[] {
  const recs: Recommendation[] = [];
  for (const c of completions) {
    const set = GOAL_SETS.find((s) => s.id === c.setId);
    if (!set) continue;
    const norm = normaliseCompletion(c, set);
    if (!norm.earnedAny || norm.complete) continue;
    const missing = norm.max - norm.progress;
    if (missing > 3) continue; // only "almost there" sets
    // 1 item left scores highest; each extra item missing drops it sharply.
    const score = 92 - (missing - 1) * 16;
    recs.push({
      id: `goal:${set.id}`,
      kind: "goal",
      title: `Finish ${set.name}`,
      why: missing === 1
        ? "You're one item away from completing this set."
        : `Only ${missing} items left in this set.`,
      payoff: set.description,
      score,
      link: "/goals",
      iconItemId: set.iconItemId
    });
  }
  return recs;
}

// ── Minigames ───────────────────────────────────────────────────────────────
// A curated list of high-value OSRS minigames with their primary skill gate.
// `gateSkill` + `gateLevel` is the level at which the minigame becomes
// playable / interesting; `iconItemId` ties each entry to a signature reward
// or related item so the card shows a real OSRS sprite. Slugs are stable
// strings used for the recommendation id.
//
// Curation rules: prefer community-staple activities (Wintertodt for FM XP,
// GoTR for RC, Pyramid Plunder for Thieving) over fringe content; surface
// each minigame once, around the level it first becomes a sensible chase.
interface Minigame {
  slug: string;
  name: string;
  gateSkill: string;
  gateLevel: number;
  why: string;
  payoff: string;
  iconItemId: number;
}

const MINIGAMES: Minigame[] = [
  { slug: "wintertodt", name: "Wintertodt", gateSkill: "Firemaking", gateLevel: 50,
    why: "The fastest path from 50 to 99 Firemaking, with rolls for the Pyromancer outfit.",
    payoff: "Pyromancer outfit + Phoenix pet + Bruma torch", iconItemId: 20720 },
  { slug: "tempoross", name: "Tempoross", gateSkill: "Fishing", gateLevel: 35,
    why: "Solid Fishing XP plus rewards you can't earn anywhere else.",
    payoff: "Spirit angler outfit + Tackle box + Big harpoonfish pet", iconItemId: 25588 },
  { slug: "gotr", name: "Guardians of the Rift", gateSkill: "Runecraft", gateLevel: 27,
    why: "By far the best Runecraft XP and the only source of the Raiments of the Eye.",
    payoff: "Abyssal lantern + Hat of the Eye + Abyssal Protector pet", iconItemId: 26850 },
  { slug: "mahogany-homes", name: "Mahogany Homes", gateSkill: "Construction", gateLevel: 20,
    why: "Construction XP without burning planks at home, plus the carpenter outfit.",
    payoff: "Carpenter outfit (+2.5% Construction XP) + Plank sack", iconItemId: 24882 },
  { slug: "pyramid-plunder", name: "Pyramid Plunder", gateSkill: "Thieving", gateLevel: 21,
    why: "The fastest Thieving XP in the game from 71+, and gems on the way.",
    payoff: "Pharaoh's sceptre + Top-tier Thieving XP/hr", iconItemId: 9044 },
  { slug: "volcanic-mine", name: "Volcanic Mine", gateSkill: "Mining", gateLevel: 50,
    why: "Top Mining XP from 60+ and the only source of Volcanic shards.",
    payoff: "Dragon pickaxe upgrade kits + 200k+ Mining XP/hr", iconItemId: 27695 },
  { slug: "hallowed-sepulchre", name: "Hallowed Sepulchre", gateSkill: "Agility", gateLevel: 52,
    why: "Best Agility XP/hr and great GP/hr at 72+; floor 5 opens at 92.",
    payoff: "Dark dye + Ring of endurance + Hallowed outfit", iconItemId: 24731 },
  { slug: "motherlode", name: "Motherlode Mine", gateSkill: "Mining", gateLevel: 30,
    why: "AFK Mining with no risk and the Prospector outfit + gem rolls.",
    payoff: "Prospector outfit (+2.5% Mining XP) + nuggets for upgrades", iconItemId: 12012 },
  { slug: "soul-wars", name: "Soul Wars", gateSkill: "Attack", gateLevel: 40,
    why: "Tradeable XP across combat skills and an iconic cosmetic cape.",
    payoff: "Soul cape (+huge prayer bonus) + Ectoplasmator", iconItemId: 25346 },
  { slug: "barbarian-assault", name: "Barbarian Assault", gateSkill: "Hitpoints", gateLevel: 40,
    why: "Best free-to-mid-game body slot — Fighter torso beats every Rune body.",
    payoff: "Fighter torso + Penance horn + Granite body", iconItemId: 10551 }
];

function minigameRecs(skills: HiscoreSkill[]): Recommendation[] {
  if (skills.length === 0) return [];
  const recs: Recommendation[] = [];
  for (const mg of MINIGAMES) {
    const level = lvl(skills, mg.gateSkill);
    // Surface a minigame for ~25 levels after it first opens up. Within the
    // first 10 levels of the gate it ranks higher (freshly unlocked), then
    // tapers off so a maxed main isn't told to do Mahogany Homes.
    const above = level - mg.gateLevel;
    if (above < 0 || above > 25) continue;
    const freshness = Math.max(0, 10 - above);
    recs.push({
      id: `minigame:${mg.slug}`,
      kind: "minigame",
      title: `Try ${mg.name}`,
      why: `${mg.gateSkill} ${level} — ${mg.why}`,
      payoff: mg.payoff,
      // Minigames sit between freshly-unlocked bosses and skill-pushes.
      score: 55 + freshness * 2,
      link: undefined, // no dedicated tool page yet
      iconItemId: mg.iconItemId
    });
  }
  return recs;
}

// Bosses the player's combat level now comfortably supports but that they
// likely haven't tackled — fresh content for a "what now" moment.
// Bosses that travel as a set — we collapse them into a single rec so the
// checklist doesn't read "Try Dagannoth Rex / Supreme / Prime" as three
// separate ideas. Mapped slug → display group.
const BOSS_GROUPS: Record<string, { id: string; title: string; iconItemId?: number }> = {
  "dks-rex":     { id: "boss:dks", title: "Try the Dagannoth Kings", iconItemId: 6739 /* Berserker ring */ },
  "dks-supreme": { id: "boss:dks", title: "Try the Dagannoth Kings", iconItemId: 6739 },
  "dks-prime":   { id: "boss:dks", title: "Try the Dagannoth Kings", iconItemId: 6739 }
};

function bossRecs(combatLevel: number): Recommendation[] {
  const seenGroups = new Set<string>();
  const recs: Recommendation[] = [];
  for (const boss of BOSSES) {
    const gate = BOSS_CL_GATE[boss.slug];
    if (gate === undefined) continue;
    // Suggest bosses the player just crossed the gate for — within a 25-CL
    // band above the gate, so it stays relevant rather than listing every
    // low-level boss to a maxed main.
    if (combatLevel < gate || combatLevel > gate + 25) continue;

    // Group siblings into one rec (Dagannoth Kings → one tile, not three).
    const group = BOSS_GROUPS[boss.slug];
    if (group) {
      if (seenGroups.has(group.id)) continue;
      seenGroups.add(group.id);
      const score = 70 - (combatLevel - gate);
      recs.push({
        id: group.id,
        kind: "boss",
        title: group.title,
        why: `Your combat level (${combatLevel}) clears the entry gate.`,
        payoff: "Three bosses, shared room — solid mid-combat training and rare drops.",
        score: Math.max(40, score),
        link: "/dps",
        iconItemId: group.iconItemId
      });
      continue;
    }

    const score = 70 - (combatLevel - gate); // freshly-unlocked scores higher
    recs.push({
      id: `boss:${boss.slug}`,
      kind: "boss",
      title: `Try ${boss.name}`,
      why: `Your combat level (${combatLevel}) is in range for this boss.`,
      payoff: boss.avgLootGp ? `~${Math.round(boss.avgLootGp / 1000)}k average loot per kill` : boss.notes,
      score: Math.max(40, score),
      link: "/dps",
      iconItemId: boss.iconItemId
    });
  }
  // Cap at top-4 — beyond that the checklist becomes "every boss in CL range"
  // which is noise. The DPS calculator is one click away for the full list.
  return recs.sort((a, b) => b.score - a.score).slice(0, 4);
}

// Skills sitting just short of a milestone level — a clear, finite push.
function skillRecs(skills: HiscoreSkill[]): Recommendation[] {
  const recs: Recommendation[] = [];
  for (const [skill, milestones] of Object.entries(SKILL_MILESTONES)) {
    const level = lvl(skills, skill);
    for (const m of milestones) {
      const gap = m.level - level;
      if (gap <= 0 || gap > 5) continue; // within 5 levels of the milestone
      recs.push({
        id: `skill:${skill}:${m.level}`,
        kind: "skill",
        title: `Push ${skill} to ${m.level}`,
        why: `You're ${gap} level${gap === 1 ? "" : "s"} away.`,
        payoff: `Unlocks: ${m.unlock}`,
        // Closer to the milestone = higher score, capped below top goals.
        score: 78 - gap * 6,
        link: "/goals"
      });
      break; // only the nearest milestone per skill
    }
  }
  return recs;
}

// ── Money-making methods ────────────────────────────────────────────────────
// A curated shortlist of solid GP/hr methods with stat gates. Values are
// representative community averages (Wiki MMG, RuneScape.wiki Money making
// guide) — they fluctuate with the GE and aren't precise, so the card frames
// them as an order of magnitude ("~", "k", "M") rather than fake precision.
//
// Each entry's `req` lists the relevant skill gates; ALL must be met. Entries
// are intentionally diverse: AFK / active, combat / skilling, low / high tier.
interface MoneyMethod {
  slug: string;
  name: string;
  req: Array<{ skill: string; level: number }>;
  gpHr: number;          // approximate, used for display + sort
  intensity: "afk" | "active" | "intense";
  payoff: string;        // 1-line description of what you actually do
  iconItemId: number;
}

const MONEY_METHODS: MoneyMethod[] = [
  { slug: "blast-furnace", name: "Blast Furnace gold bars", req: [{ skill: "Smithing", level: 40 }],
    gpHr: 350_000, intensity: "active", payoff: "Click-intensive Smithing + steady GP — Goldsmith gauntlets help.", iconItemId: 2357 },
  { slug: "zulrah", name: "Zulrah", req: [{ skill: "Magic", level: 75 }, { skill: "Ranged", level: 75 }, { skill: "Defence", level: 70 }],
    gpHr: 2_500_000, intensity: "intense", payoff: "30-40 KPH at the green snake — uniques + scales add up fast.", iconItemId: 12934 },
  { slug: "vorkath", name: "Vorkath", req: [{ skill: "Attack", level: 80 }, { skill: "Ranged", level: 80 }, { skill: "Defence", level: 75 }],
    gpHr: 3_000_000, intensity: "intense", payoff: "Top solo-boss GP at high stats with elite Void or Masori.", iconItemId: 21907 },
  { slug: "wines-zammy", name: "Wines of Zamorak", req: [{ skill: "Magic", level: 66 }],
    gpHr: 600_000, intensity: "active", payoff: "Telegrab wines in the Chaos Temple — easy GP per click.", iconItemId: 245 },
  { slug: "blood-runes", name: "Blood rune crafting (ZMI / Blood altar)", req: [{ skill: "Runecraft", level: 77 }],
    gpHr: 1_200_000, intensity: "active", payoff: "Stable cash + Runecraft XP — Arceuus blood altar.", iconItemId: 565 },
  { slug: "wrath-runes", name: "Wrath runes", req: [{ skill: "Runecraft", level: 95 }],
    gpHr: 1_800_000, intensity: "active", payoff: "Top RC GP/hr — bring giant pouch + Eternal glory.", iconItemId: 21880 },
  { slug: "redwood-cut", name: "Redwood logs", req: [{ skill: "Woodcutting", level: 90 }],
    gpHr: 250_000, intensity: "afk", payoff: "AFK firemaking-tier WC XP plus pet rolls.", iconItemId: 19669 },
  { slug: "amethyst-mine", name: "Amethyst mining", req: [{ skill: "Mining", level: 92 }],
    gpHr: 280_000, intensity: "afk", payoff: "AFK Mining XP with great GP for an idle skill.", iconItemId: 21347 },
  { slug: "herb-runs", name: "Daily herb runs", req: [{ skill: "Farming", level: 32 }],
    gpHr: 4_000_000, intensity: "active", payoff: "~5 minutes/run, multiple times per day — Ranarr/Snapdragon/Torstol pay off massively.", iconItemId: 207 },
  { slug: "tithe-farm", name: "Tithe Farm fruit", req: [{ skill: "Farming", level: 34 }],
    gpHr: 0, intensity: "active", payoff: "No GP, but it's the only path to Farmer's outfit + Seed box.", iconItemId: 13647 },
  { slug: "moss-killers", name: "Moss giants for runes", req: [{ skill: "Attack", level: 30 }],
    gpHr: 150_000, intensity: "active", payoff: "Easy F2P-friendly GP — rune drops + Big bones for Prayer.", iconItemId: 1623 },
  { slug: "rune-dragons", name: "Rune dragons", req: [{ skill: "Attack", level: 80 }, { skill: "Magic", level: 80 }, { skill: "Defence", level: 80 }],
    gpHr: 1_400_000, intensity: "active", payoff: "Consistent dragon bones + rune bars; needs full anti-dragon kit.", iconItemId: 22293 }
];

function fmtGp(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return `${n}`;
}

function moneyRecs(skills: HiscoreSkill[]): Recommendation[] {
  if (skills.length === 0) return [];
  const recs: Recommendation[] = [];
  for (const m of MONEY_METHODS) {
    // Player must meet *every* skill gate. Reject otherwise.
    const meets = m.req.every((r) => lvl(skills, r.skill) >= r.level);
    if (!meets) continue;
    // Don't suggest tiny GP/hr methods to high-stat players — irrelevant.
    // The threshold scales loosely with combat level so a low-CL account
    // still sees the lower-tier money-makers.
    const cl = computeCombatLevel(skills);
    const minGpHr = cl >= 110 ? 800_000 : cl >= 80 ? 200_000 : 50_000;
    if (m.gpHr < minGpHr) continue;
    recs.push({
      id: `money:${m.slug}`,
      kind: "money",
      title: m.name,
      why: m.gpHr > 0 ? `~${fmtGp(m.gpHr)} gp/hr · ${m.intensity}` : m.intensity,
      payoff: m.payoff,
      // Higher gp/hr scores higher, capped so it doesn't dominate the list.
      score: 50 + Math.min(20, Math.log10(Math.max(1, m.gpHr)) * 2),
      link: undefined,
      iconItemId: m.iconItemId
    });
  }
  return recs;
}

// ── Quests ──────────────────────────────────────────────────────────────────
// Quest data comes from the Wiki via scripts/build-quest-data.mjs. We only
// surface the heavyweight, "what-now" worthy ones: Master / Grandmaster
// difficulty, OR "Special" (RFD, miniquests with big rewards). Anything
// shorter would clutter the hub for high-level players.
//
// The recommendation logic is permissive on prerequisites: we can't tell
// from Hiscores which quests a player has actually completed, only their
// QP total. So we suggest a quest when the player meets every skill req
// AND has enough QP for the quest's QP-gate, and then list the *direct*
// quest prereqs as context — the player knows whether they've done them.
function questRecs(quests: Map<string, QuestRecord>, skills: HiscoreSkill[], qp: number): Recommendation[] {
  if (skills.length === 0) return [];
  const recs: Recommendation[] = [];
  for (const q of quests.values()) {
    // Filter to recommendation-worthy difficulty. "Special" covers RFD and
    // a handful of other big multi-part quests.
    if (q.difficulty !== "Master" && q.difficulty !== "Grandmaster" && q.difficulty !== "Special") continue;
    // Skill gates — every required skill must be met.
    const meets = q.skillReqs.every((r) => lvl(skills, r.skill) >= r.level);
    if (!meets) continue;
    // QP gate. If we don't know the player's QP yet (questPoints not
    // passed), be generous and skip the check — bad recs are recoverable;
    // hiding a good rec is invisible damage.
    if (q.qpReq > 0 && qp > 0 && qp < q.qpReq) continue;

    // Score: harder quest = more impactful to suggest. Grandmaster > Master.
    // Quests with a long prereq chain score slightly lower (more friction).
    const base = q.difficulty === "Grandmaster" ? 70 : q.difficulty === "Master" ? 60 : 55;
    const prereqPenalty = Math.min(15, Math.floor(q.questReqs.length / 3));
    const score = base - prereqPenalty;

    // Show only the first 3 prereqs as "you'll also need to have done …"
    // context; the full Wiki-derived chain can be 30+ items, which is noise.
    const prereqHint = q.questReqs.length > 0
      ? `Needs: ${q.questReqs.slice(0, 3).join(", ")}${q.questReqs.length > 3 ? ` (+${q.questReqs.length - 3} more)` : ""}`
      : "No quest prerequisites.";

    recs.push({
      id: `quest:${q.name}`,
      kind: "quest",
      title: q.name,
      why: `${q.difficulty} · ${q.length ?? "varies"}${q.qpReq > 0 ? ` · ${q.qpReq} QP` : ""}`,
      payoff: prereqHint,
      score,
      link: undefined
    });
  }
  return recs;
}

// ── Achievement Diaries ─────────────────────────────────────────────────────
// Diary data comes from the Wiki via scripts/build-diary-data.mjs. For each
// of the 12 regions we know exact skill requirements per tier. The engine
// suggests the *highest tier the player just barely meets* — the tier where
// at least one skill req is within 5 levels of the player's actual level, so
// it feels like a stretch rather than a trivial pass. Lower tiers a maxed
// account already cleared are skipped automatically.
const DIARY_TIERS_ORDER: DiaryTier[] = ["Easy", "Medium", "Hard", "Elite"];

// Diary reward icon (the canonical reward item per region). Lets the rec
// card show a real OSRS sprite rather than the neutral fallback dot.
const DIARY_REWARD_ICONS: Record<string, number> = {
  "Karamja":              11136, // Karamja gloves 4
  "Ardougne":             13124, // Ardougne cloak 4
  "Falador":              13120, // Falador shield 4
  "Fremennik":            13132, // Fremennik sea boots 4
  "Kandarin":             13140, // Kandarin headgear 4
  "Desert":               13136, // Desert amulet 4
  "Lumbridge & Draynor":  13104, // Explorer's ring 4
  "Morytania":            13115, // Morytania legs 4
  "Varrock":              13106, // Varrock armour 4
  "Western Provinces":    13112, // Western banner 4
  "Wilderness":           13111, // Wilderness sword 4
  "Kourend & Kebos":      25441  // Rada's blessing 4
};

// ── Boss KC-aware insights ──────────────────────────────────────────────────
// Combines a player's boss kill-count (from Hiscores) with the rarest unique
// drop rate for that boss (from data/drop-rates.json) into "you've killed
// this boss X times — statistically you'd expect Y uniques by now". Only
// surfaces if the player has *enough* KC to make the comparison meaningful
// (KC >= 25 % of the rarest drop's denominator) — otherwise the rec is
// just "drop rate is 1/5000, go grind" which adds no signal.
function kcRecs(dropTables: Map<string, BossDropTable>, bossKc: Record<string, number>): Recommendation[] {
  if (dropTables.size === 0) return [];
  const recs: Recommendation[] = [];
  for (const [wikiName, table] of dropTables) {
    const kc = bossKc[table.hiscoresName] ?? 0;
    if (kc <= 0) continue; // never killed → no insight, just noise

    // Pick the rarest "iconic" drop the player would chase. Window widened
    // from 500-5000 to 500-15000 so raid megararities (Tbow 1/34500 falls
    // out, but Scythe 1/2160 and Twisted ancestral 1/13500 both qualify).
    // First entry in table.drops is rarest, so we want the *first* drop
    // whose denom is in range — that's the actual signature chase, not
    // the 4th-rarest filler.
    const headline = table.drops.find((d) => d.denom >= 500 && d.denom <= 15000);
    if (!headline) continue;

    const expected = kc * (headline.num / headline.denom);
    // KC floor relaxed from 0.25× the drop rate to 0.15×. The old floor
    // shut out Zulrah-800 (vs tanzanite 1/4000 → needs 1000) and CoX-250
    // (vs Twisted bow 1/34500 → needs 8625). The new floor still keeps
    // out the "1 KC at Vorkath" noise but surfaces meaningful chases.
    if (kc < headline.denom * 0.15) continue;

    // Score: rises with how far past the drop rate you are. Boosted from
    // (55 + expected*6, cap 80) so KC-recs can compete with Elite-diary
    // recs (which hit ~78-82 at full score). At 1x the rate score ~70,
    // at 3x ~82. Slightly-unlucky drops surface as headlines, which is
    // the whole point of this rec-kind.
    const score = Math.min(88, 64 + expected * 6);

    // Look up boss meta in BOSSES so we can show a sprite.
    const boss = BOSSES.find((b) => b.name === wikiName || b.slug === wikiName.toLowerCase().replace(/[^a-z]/g, "-"));

    recs.push({
      id: `kc:${wikiName}`,
      kind: "kc",
      title: `${kc.toLocaleString()} ${wikiName} KC`,
      why: `Drop rate for ${headline.name}: ${headline.rarity}.`,
      payoff: expected >= 1
        ? `Statistically you'd expect ${expected.toFixed(1)} ${headline.name} by now.`
        : `${(expected * 100).toFixed(0)}% chance of one ${headline.name} based on your KC.`,
      score,
      link: undefined,
      iconItemId: boss?.iconItemId
    });
  }
  return recs;
}

function diaryRecs(diaries: Map<string, DiaryRecord>, skills: HiscoreSkill[]): Recommendation[] {
  if (skills.length === 0 || diaries.size === 0) return [];

  // Heuristic for "this player almost certainly already finished all diaries":
  // total level >= 2100. There's no Hiscores activity for diary completion, so
  // we use a level proxy. Below 2100, gap-filter on a per-region basis. Above
  // 2100, suppress all diary recs entirely — the audit found maxed accounts
  // were getting 7 Elite-diary recs as their top picks, which is nonsense.
  const totalLevel = computeTotalLevel(skills);
  if (totalLevel >= 2100) return [];

  const recs: Recommendation[] = [];
  for (const [region, d] of diaries) {
    // Walk tiers high-to-low and find the highest the player meets.
    let metTier: DiaryTier | null = null;
    let nearestGap = Infinity;
    for (let i = DIARY_TIERS_ORDER.length - 1; i >= 0; i--) {
      const tier = DIARY_TIERS_ORDER[i];
      const reqs = d.tiers[tier]?.skills ?? [];
      if (reqs.length === 0) continue; // no requirements known for this tier
      let meets = true;
      let minHeadroom = Infinity;
      for (const r of reqs) {
        const playerLvl = lvl(skills, r.skill);
        if (playerLvl < r.level) { meets = false; break; }
        minHeadroom = Math.min(minHeadroom, playerLvl - r.level);
      }
      if (meets) { metTier = tier; nearestGap = minHeadroom; break; }
    }
    if (!metTier) continue;

    // Only surface a tier that's still meaningful for the player: at least
    // one required skill is within 8 levels of their actual level. (Was 5,
    // but that misclassified e.g. a Slayer-70 player getting Karamja Hard
    // even though Karamja's binding skill is much lower.) Applied to every
    // tier including Elite — the old "Elite always passes" exception was
    // the source of the 7-Elite-diaries-for-maxed bug.
    if (nearestGap > 8) continue;

    // Score: higher tier = higher score; freshly met = higher score still.
    const tierBoost = { Easy: 0, Medium: 6, Hard: 14, Elite: 22 }[metTier];
    const freshness = Math.max(0, 8 - nearestGap);
    const score = 56 + tierBoost + freshness * 2;

    recs.push({
      id: `diary:${region}:${metTier}`,
      kind: "diary",
      title: `${region} Diary — ${metTier}`,
      why: `Your skills now clear every ${metTier} task in this region.`,
      payoff: metTier === "Elite"
        ? `Unlocks the tier-4 reward (${region} headgear / cape / cloak).`
        : `Step toward the tier-4 reward; ${metTier} unlocks its tier perks.`,
      score,
      link: undefined,
      iconItemId: DIARY_REWARD_ICONS[region]
    });
  }
  return recs;
}

// Bank-hygiene nudges, only when a bank was pasted.
function bankRecs(bank: CompletionItem[]): Recommendation[] {
  if (bank.length === 0) return [];
  return [{
    id: "bank:organize",
    kind: "bank",
    title: "Tidy your bank",
    why: `${bank.length} items — a clean, tabbed bank makes every trip faster.`,
    payoff: "Auto-sorted into use-case tabs you can paste back into RuneLite.",
    score: 30,
    link: "/bank"
  }];
}

// When we only have a bank and no Hiscores, be honest about the gap: the
// best advice we can give is "let us read your stats too." Surfaces as the
// headline for the fresh-account / no-RSN path so the user doesn't think
// "Tidy your bank" is the best we can do.
function noHiscoresNudge(): Recommendation {
  return {
    id: "meta:add-rsn",
    kind: "goal",
    title: "Add your OSRS name for sharper advice",
    why: "We can only see your bank. Your Hiscores unlocks quest, diary, skill and drop-chance recs.",
    payoff: "Free, no plugin, no account. Just your RSN.",
    score: 95,
    link: undefined
  };
}

// ── Engine ──────────────────────────────────────────────────────────────────

export async function computeNextUp(input: NextUpInput): Promise<NextUpResult> {
  const skills = input.skills ?? [];
  const bank = input.bank ?? [];
  const qp = input.questPoints ?? 0;
  const hasHiscores = skills.length > 0;
  const hasBank = bank.length > 0;

  const combatLevel = hasHiscores ? computeCombatLevel(skills) : null;
  const totalLevel = hasHiscores ? computeTotalLevel(skills) : null;

  // Goal completion needs *something* to check against. Hiscores alone can
  // satisfy skill-cape goals (via the virtual-cape synthesis in goals.ts);
  // a bank satisfies item goals. We feed whichever we have.
  const completions = (hasBank || hasHiscores)
    ? checkCompletion(bank)
    : [];
  const goalPercent = completions.length > 0
    ? overallStats(completions).percent
    : null;

  // Quest + diary + drop-rate data ship as static JSON files — best-effort,
  // the engine still works if a file is missing (the build scripts generate
  // them). All three loads are kicked off in parallel.
  const [quests, diaries, dropTables] = hasHiscores
    ? await Promise.all([
        getQuests().catch(() => new Map()),
        getDiaries().catch(() => new Map()),
        getDropRates().catch(() => new Map())
      ])
    : [new Map(), new Map(), new Map()];

  const recs: Recommendation[] = [
    ...goalRecs(completions),
    ...(combatLevel !== null ? bossRecs(combatLevel) : []),
    ...questRecs(quests, skills, qp),
    ...diaryRecs(diaries, skills),
    ...kcRecs(dropTables, input.bossKc ?? {}),
    ...minigameRecs(skills),
    ...moneyRecs(skills),
    ...skillRecs(skills),
    ...bankRecs(bank),
    // No-Hiscores nudge: when the player only gave a bank, lead with "add
    // your RSN" rather than letting "Tidy your bank" become the headline.
    ...(!hasHiscores && hasBank ? [noHiscoresNudge()] : [])
  ].sort((a, b) => b.score - a.score);

  const basis: NextUpResult["summary"]["basis"] =
    hasHiscores && hasBank ? "full"
    : hasHiscores ? "hiscores-only"
    : hasBank ? "bank-only"
    : "none";

  return {
    headline: recs[0] ?? null,
    rest: recs.slice(1),
    summary: { combatLevel, totalLevel, goalPercent, basis }
  };
}
