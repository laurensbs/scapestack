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
  GOAL_SETS, checkCompletion, normaliseCompletion, overallStats, closestToComplete,
  type CompletionItem, type SetCompletion
} from "./goals";
import { hoursToMax } from "./hours-to-max";
import { BOSSES, type Boss } from "./bosses";
import { computeCombatLevel, computeTotalLevel, type HiscoreSkill } from "./hiscores";
import { getQuests, type QuestRecord } from "./quest-db";
import { getDiaries, type DiaryRecord, type DiaryTier } from "./diary-db";
import { getDropRates, type BossDropTable } from "./drop-rates-db";
import { computePathProgress, type AccountMeta, type PathOverview } from "./path-progress";
import { detectAccountStage, type AccountStage } from "./account-stage";
import { skillCapeId } from "./skill-capes";
import { TASK_ID_TO_MONSTER } from "./slayer/task-ids";
import { MONSTERS_BY_ID } from "./slayer/monsters";
import { slayerUrlForSyncedRsn } from "./plugin-sync-actions";
import { pluginSyncHealth } from "./plugin-sync";

// Kind drives the icon + accent the hub renders, and groups the checklist.
export type RecKind =
  | "goal"       // a goal set 1-2 items from done
  | "quest"      // a Wiki-listed quest the player's stats now meet
  | "diary"      // an Achievement Diary tier the player's stats now meet
  | "boss"       // a boss the player's combat level now supports
  | "kc"         // boss KC-aware insight (drop rate vs your kill count)
  | "minigame"   // a minigame the player's skill levels now unlock
  | "money"      // a money-making method matched to the player's skills
  | "slayer"     // live RuneLite-plugin Slayer task / points advice
  | "skill"      // a skill sitting just short of a milestone level
  | "bank"       // a bank-hygiene action (clear junk, complete a set)
  | "milestone"; // an account-wide milestone (quest cape range, maxing, etc.)

export interface RecommendationPlanSeed {
  timebox?: string;
  prep?: string;
  steps?: string[];
  caveat?: string;
}

export type RecommendationRouteTag =
  | "beginner"
  | "returning"
  | "iron"
  | "skiller"
  | "pvm"
  | "maxing"
  | "gp"
  | "unlock"
  | "afk"
  | "fun"
  | "rebuild"
  | "slayer";

export type RecommendationGearConfidence = "confirmed" | "likely" | "unknown" | "not-needed";

export interface RecommendationQuality {
  /** Past dit echt bij het account, los van ruwe score. */
  accountFit: number;
  /** Kan de speler nu meteen beginnen? */
  actionability: number;
  /** Is er een duidelijke stop point voor deze sessie? */
  stopPoint: number;
  /** Weten we genoeg over gear/supplies om dit niet te oversellen? */
  gearConfidence: number;
  /** Hoeveel unlockt dit downstream? */
  unlockValue: number;
  /** Voelt dit als een leuke OSRS sessie, niet alleen als huiswerk? */
  fun: number;
  /** Hoeveel prereqs, risk of setup-frictie zit erin? 0 = laag, 1 = hoog. */
  friction: number;
}

export interface RecommendationActionPlan {
  /** Short session framing shown on the card, e.g. "45-90 min". */
  timebox: string;
  /** How certain Scapestack is that this action fits the account data. */
  confidence: "exact" | "likely" | "guided";
  /** Human label for the confidence chip. */
  confidenceLabel: string;
  /** Tiny prep hint before the checklist. */
  prep: string;
  /** 2-4 concrete steps that make the recommendation executable. */
  steps: string[];
  /** Optional warning/fallback line for missing data or risky assumptions. */
  caveat?: string;
}

export interface Recommendation {
  id: string;             // stable key
  kind: RecKind;
  title: string;          // the action — imperative, short
  why: string;            // one line: why it's worth doing now
  payoff?: string;        // optional: what completing it unlocks/gives
  /** Account-specific reason shown in the /next headline card. */
  decisionReason?: string;
  /** Concrete vereisten die de speler nu moet hebben/doen. Tonen in
   *  de detail-expand als bullet list. Korte regels, max ~5 stuks. */
  needs?: string[];
  /** Langere uitleg / walkthrough — meerdere regels mogelijk. Wordt
   *  alleen in de detail-expand getoond. Houdt het beknopt; lange
   *  guides horen op de wiki. */
  details?: string;
  /** 0-100, higher surfaces first. The top scorer becomes the headline. */
  score: number;
  /** Tool route to act on this, e.g. "/goals" or "/dps". */
  link?: string;
  /** Optional OSRS item id for a sprite on the card. */
  iconItemId?: number;
  /** Executable next-session plan. This is deliberately generic enough to
   *  render on every rec kind, but concrete enough that /next feels like an
   *  OSRS decision engine instead of a list of vague tips. */
  actionPlan?: RecommendationActionPlan;
  /** Internal engine seed for data-specific plans. Stripped after enrichment
   *  so the UI only sees the normalized actionPlan shape. */
  planSeed?: RecommendationPlanSeed;
  /** Hidden planner tags for route/archetype ranking. Not rendered as UI copy. */
  routeTags?: RecommendationRouteTag[];
  /** Internal quality profile for ranking. Stripped before UI. */
  quality?: RecommendationQuality;
  /** Internal gear confidence for boss/KC ranking. Stripped before UI. */
  gearConfidence?: RecommendationGearConfidence;
  /** Optional boss slug — when set, the hub renders a wiki NPC portrait
   *  instead of an item sprite. Used by the kc-kind recs so the player
   *  sees an actual picture of Vorkath, Olm, etc. */
  bossSlug?: string;
  /** kc-kind only: enough data for the inline probability chart in /next.
   *  We carry kc / denom / drop-name so the renderer doesn't have to
   *  reverse-engineer them from the title/why strings. */
  kcMeta?: {
    kc: number;
    denom: number;
    dropName: string;
  };
}

export interface NextUpInput {
  /** Live Hiscores skills. Empty when no RSN was looked up. */
  skills?: HiscoreSkill[];
  /** The player's bank as id+name pairs. Empty when no bank was pasted. */
  bank?: CompletionItem[];
  /** Virtual earned items inferred from account data, e.g. 99 skill capes.
   *  Count for goal completion but not as a real bank context. */
  earnedItems?: CompletionItem[];
  /** Total quest points (from Hiscores activities). Used to gate quest recs. */
  questPoints?: number;
  /** Boss kill-counts from Hiscores activities — keyed by activity name.
   *  Used to compute expected-uniques ("142 Vorkath KC ≈ 0.85 visages"). */
  bossKc?: Record<string, number>;
  /** WOM-derived boss kills (snake_case keys). Merged with Hiscores KCs
   *  via Math.max in path-progress — WOM is often ahead because it
   *  updates per RuneLite plugin push. */
  womBossKills?: Record<string, number>;
  /** WOM-derived account metadata. Drives the 'Synced via WOM' badge
   *  and account-type-aware recommendations. */
  accountMeta?: import("./path-progress").AccountMeta | null;
  /** TempleOSRS exact-completed quest names (lowercased). When present,
   *  questsPath uses this for completion-state instead of the QP-budget
   *  heuristic. */
  templeQuestsCompleted?: string[];
  /** collectionlog.net owned item IDs (any item with the obtained flag).
   *  Used to skip KC-recs whose iconic drop the player already has —
   *  exact data instead of bank-paste guesswork. */
  collectionLogOwnedItemIds?: number[];
  /** Scapestack-plugin sync data — our own RuneLite plugin. Highest
   *  priority signal: exact quest + diary + CL state straight from the
   *  player's game client. */
  scapestackSync?: {
    displayName?: string;
    questsCompleted: string[];
    diariesCompleted: Array<{ region: string; tier: string }>;
    collectionLogItemIds: number[];
    slayer?: {
      points: number;
      streak: number;
      taskRemaining: number;
      currentTaskId: number;
      blocks: string[];
    } | null;
  };
  /** Tracks which external trackers contributed. Surfaced as the
   *  'Synced via X · Y · Z' badge on the hero block.
   *  scapestack is the live plugin sync metadata when present
   *  (freshness + counts), null when the player hasn't installed it. */
  syncedSources?: {
    wom: boolean;
    temple: boolean;
    collectionLog: boolean;
    scapestack: {
      syncedAt: string;
      quests: number;
      diaries: number;
      clItems: number;
      pluginVersion?: string;
      slayerTaskRemaining?: number | null;
      slayerBlocks?: number;
    } | null;
  };
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
    accountStage: AccountStage;
    /** Coverage note — which inputs the advice is based on. */
    basis: "full" | "hiscores-only" | "bank-only" | "none";
  };
  /** Path-to-Max progress across four axes (skills/quests/diaries/bosses).
   *  Drives the new path-card layout in the UI. Always present even when
   *  data is sparse — paths fall back to 0% with empty next-steps. */
  pathProgress: PathOverview;
  /** Top-N goal-sets gesorteerd op "dichtsbij voltooien". Lege array
   *  wanneer geen bank gepasted is. Drijft de Bank-Readiness chip-rij. */
  readiness: import("./goals").SetCompletion[];
  /** Hours-to-max samenvatting: totaal + per-skill. Bron: hours-to-max.ts
   *  met community-XP-rate tabel. Lege summary zonder Hiscores. */
  maxEstimate: import("./hours-to-max").HoursToMaxSummary;
}

// Skill milestones worth nudging a player toward — levels that unlock
// meaningful content or are satisfying round numbers. Within a few levels of
// one of these, the engine suggests pushing for it.
const SKILL_MILESTONES: Record<string, { level: number; unlock: string; maxGap?: number }[]> = {
  Slayer:  [{ level: 70, unlock: "Kurasks + real mid-game Slayer rhythm", maxGap: 25 }, { level: 85, unlock: "Abyssal demons → whip" }, { level: 93, unlock: "Cryptic clue tasks" }, { level: 99, unlock: "Slayer cape" }],
  Agility: [{ level: 70, unlock: "Ardougne rooftop course" }, { level: 99, unlock: "Agility cape" }],
  Herblore:[{ level: 78, unlock: "Magic potions" }, { level: 90, unlock: "Extended antifire" }, { level: 99, unlock: "Herblore cape" }],
  Farming: [{ level: 83, unlock: "Magic trees + Hespori" }, { level: 99, unlock: "Farming cape" }],
  Mining:  [{ level: 85, unlock: "Amethyst" }, { level: 99, unlock: "Mining cape" }],
  Prayer:  [{ level: 70, unlock: "Piety", maxGap: 20 }, { level: 77, unlock: "Rigour/Augury (with quests)" }, { level: 99, unlock: "Prayer cape" }],
  Construction: [{ level: 83, unlock: "Nexus / max POH" }, { level: 99, unlock: "Construction cape" }],
  Sailing: [{ level: 50, unlock: "mid-level voyages" }, { level: 75, unlock: "late-route progression" }, { level: 99, unlock: "Sailing cape" }]
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

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

function isIronAccount(accountMeta?: AccountMeta | null): boolean {
  return accountMeta?.accountType === "ironman"
    || accountMeta?.accountType === "hardcore"
    || accountMeta?.accountType === "ultimate";
}

function completedQuest(completedQuestNames: Set<string> | undefined, names: string[]): boolean {
  if (!completedQuestNames) return false;
  return names.some((name) => completedQuestNames.has(name.toLowerCase()));
}

function hasRouteTag(rec: Recommendation, tag: RecommendationRouteTag): boolean {
  return rec.routeTags?.includes(tag) ?? false;
}

function defaultQualityFor(rec: Recommendation, hasBank: boolean): RecommendationQuality {
  const text = `${rec.title} ${rec.why} ${rec.payoff ?? ""} ${rec.decisionReason ?? ""}`.toLowerCase();
  const longQuest = rec.kind === "quest" && /\(\+\d+ more\)|long prereq|very long|grandmaster/.test(text);
  const scoutKc = rec.kind === "kc" && ((rec.kcMeta?.kc ?? 99) > 0 && (rec.kcMeta?.kc ?? 99) < 5);
  const bossWithoutGear = (rec.kind === "boss" || rec.kind === "kc")
    && rec.gearConfidence !== "confirmed"
    && rec.gearConfidence !== "likely"
    && rec.gearConfidence !== "not-needed";

  const byKind: Record<RecKind, RecommendationQuality> = {
    slayer: { accountFit: 0.98, actionability: 0.95, stopPoint: 0.92, gearConfidence: 0.72, unlockValue: 0.78, fun: 0.72, friction: 0.18 },
    goal: { accountFit: 0.86, actionability: 0.78, stopPoint: 0.86, gearConfidence: 0.72, unlockValue: 0.9, fun: 0.7, friction: 0.24 },
    diary: { accountFit: 0.78, actionability: 0.7, stopPoint: 0.78, gearConfidence: 0.75, unlockValue: 0.86, fun: 0.56, friction: 0.34 },
    quest: { accountFit: 0.75, actionability: longQuest ? 0.48 : 0.72, stopPoint: longQuest ? 0.55 : 0.75, gearConfidence: 0.7, unlockValue: 0.9, fun: 0.62, friction: longQuest ? 0.72 : 0.38 },
    boss: { accountFit: 0.7, actionability: bossWithoutGear ? 0.42 : 0.72, stopPoint: 0.8, gearConfidence: bossWithoutGear ? 0.38 : 0.8, unlockValue: 0.5, fun: 0.82, friction: bossWithoutGear ? 0.68 : 0.42 },
    kc: { accountFit: scoutKc ? 0.45 : 0.8, actionability: bossWithoutGear ? 0.42 : 0.76, stopPoint: scoutKc ? 0.64 : 0.86, gearConfidence: bossWithoutGear ? 0.38 : 0.82, unlockValue: 0.52, fun: 0.82, friction: scoutKc ? 0.6 : bossWithoutGear ? 0.68 : 0.38 },
    minigame: { accountFit: 0.78, actionability: 0.82, stopPoint: 0.82, gearConfidence: 0.9, unlockValue: 0.72, fun: 0.88, friction: 0.22 },
    money: { accountFit: 0.72, actionability: 0.78, stopPoint: 0.76, gearConfidence: hasBank ? 0.76 : 0.58, unlockValue: 0.62, fun: 0.58, friction: 0.32 },
    skill: { accountFit: 0.78, actionability: 0.84, stopPoint: 0.86, gearConfidence: 0.94, unlockValue: 0.74, fun: 0.6, friction: 0.2 },
    bank: { accountFit: 0.54, actionability: 0.95, stopPoint: 0.9, gearConfidence: 1, unlockValue: 0.35, fun: 0.25, friction: 0.08 },
    milestone: { accountFit: 0.74, actionability: 0.62, stopPoint: 0.62, gearConfidence: 0.74, unlockValue: 0.94, fun: 0.62, friction: 0.42 }
  };

  return rec.quality ?? byKind[rec.kind];
}

function qualityMultiplier(rec: Recommendation, hasBank: boolean): number {
  const q = defaultQualityFor(rec, hasBank);
  const positive =
    clamp01(q.accountFit) * 0.22
    + clamp01(q.actionability) * 0.2
    + clamp01(q.stopPoint) * 0.18
    + clamp01(q.gearConfidence) * 0.14
    + clamp01(q.unlockValue) * 0.16
    + clamp01(q.fun) * 0.1;
  const frictionPenalty = 1 - clamp01(q.friction) * 0.22;
  return (0.72 + positive * 0.5) * frictionPenalty;
}

function gearRealityMultiplier(rec: Recommendation, hasBank: boolean): number {
  if (rec.kind !== "boss" && rec.kind !== "kc" && rec.kind !== "money") return 1;
  if (rec.kind === "money") {
    const intense = `${rec.title} ${rec.why}`.toLowerCase();
    if (!hasBank && /(vorkath|zulrah|rune dragon|nex|boss)/.test(intense)) return 0.76;
    return 1;
  }

  if (rec.gearConfidence === "confirmed") return 1.12;
  if (rec.gearConfidence === "likely" || rec.gearConfidence === "not-needed") return 1.02;
  return hasBank ? 0.72 : 0.62;
}

function archetypeMultiplier(rec: Recommendation, accountStage: AccountStage, accountMeta?: AccountMeta | null): number {
  let multiplier = 1;
  const iron = isIronAccount(accountMeta);

  if (iron) {
    if (hasRouteTag(rec, "iron") || hasRouteTag(rec, "unlock")) multiplier *= 1.2;
    if (rec.kind === "money") multiplier *= 0.45;
    if (rec.kind === "boss" || rec.kind === "kc") multiplier *= 0.9;
  }

  switch (accountStage.id) {
    case "first-run":
    case "new-account":
      if (hasRouteTag(rec, "beginner") || rec.kind === "quest" || rec.kind === "skill") multiplier *= 1.18;
      if (rec.kind === "boss" || rec.kind === "kc") multiplier *= 0.38;
      break;
    case "early-main":
    case "returning":
      if ((hasRouteTag(rec, "returning") || hasRouteTag(rec, "unlock") || hasRouteTag(rec, "rebuild")) && rec.kind !== "money") multiplier *= 1.18;
      if (hasRouteTag(rec, "rebuild") && rec.kind === "money") multiplier *= 0.92;
      if (rec.kind === "kc" && (rec.kcMeta?.kc ?? 99) < 5) multiplier *= 0.55;
      break;
    case "iron-route":
      if (hasRouteTag(rec, "iron") || hasRouteTag(rec, "unlock")) multiplier *= 1.25;
      if (rec.kind === "money") multiplier *= 0.4;
      break;
    case "skiller":
      if (hasRouteTag(rec, "skiller") || hasRouteTag(rec, "afk") || rec.kind === "minigame") multiplier *= 1.2;
      if (rec.kind === "boss" || rec.kind === "kc" || rec.kind === "slayer") multiplier *= 0.22;
      break;
    case "pvm-ready":
      if (hasRouteTag(rec, "pvm") || rec.kind === "boss" || rec.kind === "kc" || rec.kind === "slayer") multiplier *= 1.14;
      if ((rec.kind === "boss" || rec.kind === "kc") && rec.gearConfidence === "unknown") multiplier *= 0.78;
      break;
    case "maxed-grinder":
      if (hasRouteTag(rec, "maxing") || rec.kind === "kc" || rec.kind === "goal") multiplier *= 1.16;
      if (rec.kind === "quest" || rec.kind === "diary") multiplier *= 0.82;
      break;
    case "runelite-aware":
      if (rec.kind === "slayer" || hasRouteTag(rec, "slayer")) multiplier *= 1.18;
      if (hasRouteTag(rec, "unlock")) multiplier *= 1.08;
      break;
    case "gear-first":
    case "midgame-main":
      if (hasRouteTag(rec, "pvm") || hasRouteTag(rec, "gp") || hasRouteTag(rec, "unlock")) multiplier *= 1.08;
      break;
  }

  return multiplier;
}

function rankRecommendations(
  recs: Recommendation[],
  ctx: { hasBank: boolean; accountStage: AccountStage; accountMeta?: AccountMeta | null }
): Recommendation[] {
  return recs
    .map((rec) => {
      const score = rec.score
        * qualityMultiplier(rec, ctx.hasBank)
        * gearRealityMultiplier(rec, ctx.hasBank)
        * archetypeMultiplier(rec, ctx.accountStage, ctx.accountMeta);
      return { ...rec, score: Math.max(1, Math.round(score)) };
    })
    .sort((a, b) => b.score - a.score);
}

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
    const missingGoals = set.goals
      .filter((g) => !c.perGoal[g.id]?.satisfied)
      .map((g) => g.name)
      .slice(0, 3);
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
      decisionReason: missingGoals[0]
        ? `${missingGoals[0]} is the closest missing piece; finishing it changes the account immediately.`
        : missing === 1
          ? "One missing piece makes this the cleanest account progress right now."
          : `${missing} missing pieces keeps this finite enough for a focused session.`,
      score,
      link: "/goals",
      iconItemId: set.iconItemId,
      routeTags: ["unlock", "maxing"],
      gearConfidence: "likely",
      quality: {
        accountFit: missing === 1 ? 0.9 : 0.8,
        actionability: missing === 1 ? 0.82 : 0.72,
        stopPoint: missing === 1 ? 0.9 : 0.8,
        gearConfidence: 0.78,
        unlockValue: 0.9,
        fun: 0.68,
        friction: missing === 1 ? 0.22 : 0.34
      },
      planSeed: {
        timebox: missing === 1 ? "30-60 min" : "1-2 sessions",
        prep: missingGoals.length > 0
          ? `Missing: ${missingGoals.join(", ")}.`
          : `Close to completion: ${norm.progress}/${norm.max}.`,
        steps: [
          `Open the ${set.name} goal set and confirm the missing ${missing === 1 ? "piece" : "pieces"}.`,
          missingGoals[0] ? `Target ${missingGoals[0]} first — it is the shortest visible path to progress.` : "Pick the missing piece with the lowest travel/setup cost.",
          "Re-sync or paste your bank again after the drop/unlock so the set disappears from /next."
        ]
      }
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
      decisionReason: `${mg.name} is open at your ${mg.gateSkill} level and has a clear one-session reward target.`,
      // Minigames sit between freshly-unlocked bosses and skill-pushes.
      score: 55 + freshness * 2,
      link: undefined, // no dedicated tool page yet
      iconItemId: mg.iconItemId,
      routeTags: ["fun", "afk", "skiller", ...(mg.slug === "barbarian-assault" || mg.slug === "soul-wars" ? ["unlock" as const] : [])],
      gearConfidence: "not-needed",
      quality: {
        accountFit: 0.8,
        actionability: 0.86,
        stopPoint: 0.84,
        gearConfidence: 0.94,
        unlockValue: mg.slug === "gotr" || mg.slug === "barbarian-assault" || mg.slug === "hallowed-sepulchre" ? 0.82 : 0.7,
        fun: 0.9,
        friction: 0.22
      },
      planSeed: {
        timebox: "30-90 min",
        prep: `You meet the ${mg.gateSkill} ${mg.gateLevel} entry point; make this a reward-target session, not an endless queue.`,
        steps: [
          `Set one ${mg.name} target before starting: one reward roll, outfit piece, or level bracket.`,
          "Bank stamina/teleports/supplies for just that target so the session stays bounded.",
          "Stop at the target and re-run /next; minigame unlocks often change the best follow-up."
        ]
      }
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

// Minimum "you have at least one of these"-list per boss. Names are
// lowercased + matched substring-style against the player's bank — that's
// loose enough to absorb suffixes like "(or)" / "(blood)" / "(charged)" and
// stop us listing every variant by ID. Lists were curated for "the cheapest
// thing where this boss starts to feel real" — not BiS, not "any damage."
//
// If the player has none of the listed items, the boss-rec is suppressed
// (we don't want to point a black-d'hide player at GWD). If they have
// something on the list, that item's name lands in the rec's `why` so the
// player sees we know what they own.
//
// `null` means "no gear gate" — the boss is open to anyone with the CL.
// `skill: 'Slayer'` adds a hidden Slayer-level gate (Kraken/Cerb/Hydra).
const BOSS_GEAR_GATES: Record<string, {
  needs: string[];
  slayerLevel?: number;
} | null> = {
  // Free entry — combat-level only. Beginners-friendly bosses.
  "obor": null,
  "bryophyta": null,
  "giant-mole": null,
  "barrows": null,
  "king-black-dragon": null,
  "sarachnis": null,

  // Mid-tier — wants a real weapon, not bronze. Whip OR equivalent ranged.
  "dks-rex":     { needs: ["abyssal whip", "dragon scimitar", "leaf-bladed battleaxe", "saradomin sword"] },
  "dks-supreme": { needs: ["abyssal whip", "dragon scimitar", "leaf-bladed battleaxe", "saradomin sword"] },
  "dks-prime":   { needs: ["trident of the swamp", "trident of the seas", "kodai", "ancient staff", "master wand", "iban's staff"] },

  // Slayer-gated bosses — combat gear AND a slayer level.
  "kraken":  { needs: ["trident of the swamp", "trident of the seas", "kodai", "occult necklace"], slayerLevel: 87 },
  "cerberus": { needs: ["abyssal whip", "leaf-bladed battleaxe", "saradomin sword", "blood fury", "primordial boots"], slayerLevel: 91 },
  "hydra": { needs: ["toxic blowpipe", "twisted bow", "bow of faerdhinen", "armadyl crossbow", "dragon hunter crossbow"], slayerLevel: 95 },
  "thermonuclear": { needs: ["abyssal whip", "dragon scimitar", "saradomin sword"], slayerLevel: 70 },
  "sire": { needs: ["abyssal whip", "abyssal bludgeon", "leaf-bladed battleaxe"], slayerLevel: 85 },
  "skotizo": { needs: ["arclight", "darklight", "emberlight"] },

  // Wilderness / world bosses. Want an upgrade from rune.
  "zulrah": { needs: ["toxic blowpipe", "twisted bow", "bow of faerdhinen", "trident of the swamp", "trident of the seas", "magic shortbow"] },
  "vorkath": { needs: ["toxic blowpipe", "twisted bow", "armadyl crossbow", "dragon hunter crossbow", "dragon hunter lance"] },
  "phantom-muspah": { needs: ["toxic blowpipe", "twisted bow", "bow of faerdhinen", "trident of the swamp", "kodai"] },
  "demonic-gorillas": { needs: ["toxic blowpipe", "abyssal whip", "trident of the swamp", "twisted bow"] },
  "grotesque-guardians": { needs: ["toxic blowpipe", "armadyl crossbow", "twisted bow"], slayerLevel: 75 },

  // GWD — wants god-aware gear by this point.
  "graardor": { needs: ["bandos chestplate", "armadyl chestplate", "torva platebody", "abyssal whip", "abyssal bludgeon"] },
  "kree":     { needs: ["armadyl chestplate", "masori body", "toxic blowpipe", "twisted bow", "bow of faerdhinen", "armadyl crossbow"] },
  "zilyana":  { needs: ["bandos chestplate", "torva platebody", "saradomin sword", "abyssal whip", "scythe of vitur"] },
  "kril":     { needs: ["armadyl chestplate", "masori body", "ancestral robe top", "toxic blowpipe", "twisted bow", "bow of faerdhinen"] },

  // DT2 — wants real upgrades. Listing a few BiS-adjacent options each.
  "vardorvis":     { needs: ["scythe of vitur", "soulreaper axe", "abyssal whip", "osmumten's fang"] },
  "leviathan":     { needs: ["twisted bow", "bow of faerdhinen", "toxic blowpipe", "armadyl crossbow"] },
  "whisperer":     { needs: ["shadow of tumeken", "trident of the swamp", "kodai", "sanguinesti staff"] },
  "duke-sucellus": { needs: ["scythe of vitur", "soulreaper axe", "osmumten's fang", "abyssal whip"] },
  "araxxor":       { needs: ["scythe of vitur", "abyssal whip", "soulreaper axe", "osmumten's fang"] },

  // Endgame — Nex needs a team and BiS-ish kit.
  "nex": { needs: ["twisted bow", "bow of faerdhinen", "scythe of vitur", "shadow of tumeken", "armadyl crossbow", "zaryte crossbow"] }
};

const BOSS_SIGNATURE_ITEM_IDS: Record<string, number[]> = {
  "vorkath": [21907, 22006, 21748],
  "zulrah": [12921, 12932, 12937, 12934],
  "cox": [20997, 21043, 21003, 22324, 13652, 21000],
  "tob": [22325, 22324, 22323, 22326, 22327, 22328],
  "toa": [27275, 26219, 25985, 25975, 27226, 27229, 27232],
  "hydra": [22746, 22731, 22944, 23139],
  "nex": [26382, 26384, 26386, 26235, 26370, 26372, 26374],
  "vardorvis": [28997, 28307, 28316],
  "leviathan": [28997, 28324, 28316],
  "whisperer": [28997, 28321, 28316],
  "duke-sucellus": [28997, 28316],
  "graardor": [11812, 11832, 11834],
  "kree": [11810, 11828, 11830],
  "zilyana": [11814, 11785],
  "kril": [11816, 11824, 11826]
};

/** Returns the matched item name (lowercased) for the boss's gear gate, or
 *  null when the player has nothing on the list. `null` gate means no
 *  gating — returns an empty string so the caller can distinguish "match
 *  on no-gate" from "no match" without two branches. */
function matchedGearForBoss(slug: string, bank: CompletionItem[], slayerLevel: number): { item: string } | null {
  const gate = BOSS_GEAR_GATES[slug];
  if (gate === undefined) return { item: "" }; // boss not in the table — let it through
  if (gate === null) return { item: "" };       // explicit "no gate"
  if (gate.slayerLevel !== undefined && slayerLevel < gate.slayerLevel) return null;
  const lowered = bank.map((it) => it.name.toLowerCase());
  for (const need of gate.needs) {
    if (lowered.some((n) => n.includes(need))) return { item: need };
  }
  return null;
}

function hasBossExperience(boss: Boss, bank: CompletionItem[], bossKc: Record<string, number>): boolean {
  if ((bossKc[boss.name] ?? 0) >= 50) return true;
  const signatureIds = BOSS_SIGNATURE_ITEM_IDS[boss.slug] ?? [];
  if (signatureIds.length === 0) return false;
  const ownedIds = new Set(bank.map((item) => item.id));
  return signatureIds.some((id) => ownedIds.has(id));
}

function bossRecs(combatLevel: number, bank: CompletionItem[], skills: HiscoreSkill[], bossKc: Record<string, number>): Recommendation[] {
  const totalKnownBossKc = Object.values(bossKc).reduce((sum, kc) => sum + Math.max(0, kc), 0);
  if (totalKnownBossKc >= 1_000) return [];

  const slayerLevel = lvl(skills, "Slayer");
  const seenGroups = new Set<string>();
  const recs: Recommendation[] = [];
  for (const boss of BOSSES) {
    const gate = BOSS_CL_GATE[boss.slug];
    if (gate === undefined) continue;
    // Suggest bosses the player just crossed the gate for — within a 25-CL
    // band above the gate, so it stays relevant rather than listing every
    // low-level boss to a maxed main.
    if (combatLevel < gate || combatLevel > gate + 25) continue;
    if (hasBossExperience(boss, bank, bossKc)) continue;

    // Gear / slayer gate. If the player has no gear from the list AND no
    // bank was provided, we still let the rec through (we'd rather show
    // something than nothing when we have no signal). If a bank WAS
    // provided and nothing matched, suppress — the audit script flagged
    // "Try GWD bosses to a Black-d'hide player" as a real failure mode.
    const match = bank.length > 0
      ? matchedGearForBoss(boss.slug, bank, slayerLevel)
      : { item: "" };
    if (match === null) continue;
    const gearConfidence: RecommendationGearConfidence = match.item
      ? "confirmed"
      : bank.length > 0
        ? "not-needed"
        : "unknown";

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
        why: gearWhy(combatLevel, match.item) ?? `Your combat level (${combatLevel}) clears the entry gate.`,
        payoff: "Three bosses, shared room — solid mid-combat training and rare drops.",
        decisionReason: match.item
          ? `${displayMatchedGear(match.item)} makes this a realistic short PvM trip.`
          : "Combat level fits, but gear is not verified; treat this as a short scouting trip.",
        score: Math.max(40, score),
        link: "/dps",
        iconItemId: group.iconItemId,
        routeTags: ["pvm", "fun"],
        gearConfidence,
        quality: {
          accountFit: 0.76,
          actionability: gearConfidence === "unknown" ? 0.52 : 0.78,
          stopPoint: 0.82,
          gearConfidence: gearConfidence === "confirmed" ? 0.95 : gearConfidence === "not-needed" ? 0.78 : 0.42,
          unlockValue: 0.45,
          fun: 0.82,
          friction: gearConfidence === "unknown" ? 0.62 : 0.38
        },
        planSeed: {
          timebox: "30-60 min",
          prep: match.item ? `Use your ${match.item} as the anchor for the first DKs setup.` : "Treat this as a scouting trip before camping the room.",
          steps: [
            "Open DPS to compare your melee/range/mage options before entering Waterbirth.",
            "Bring supplies for a short rotation and prove you can sustain the room safely.",
            "After the trip, decide whether DKs becomes a ring grind or just a diary/KC clear."
          ]
        }
      });
      continue;
    }

    const score = 70 - (combatLevel - gate); // freshly-unlocked scores higher
    recs.push({
      id: `boss:${boss.slug}`,
      kind: "boss",
      title: `Try ${boss.name}`,
      why: gearWhy(combatLevel, match.item) ?? `Your combat level (${combatLevel}) is in range for this boss.`,
      payoff: boss.avgLootGp ? `~${Math.round(boss.avgLootGp / 1000)}k average loot per kill` : boss.notes,
      decisionReason: match.item
        ? `${displayMatchedGear(match.item)} gives this trip a gear anchor before you buy upgrades.`
        : boss.category === "wildy"
          ? "Wilderness trips need gear and risk context, so this stays a cautious test."
          : "Combat level fits, but no bank was pasted, so the first trip should stay cheap.",
      score: Math.max(40, score - (boss.category === "wildy" && bank.length === 0 ? 12 : 0)),
      link: "/dps",
      iconItemId: boss.iconItemId,
      bossSlug: boss.slug,
      routeTags: ["pvm", "fun", ...(boss.category === "wildy" ? [] : ["gp" as const])],
      gearConfidence,
      quality: {
        accountFit: boss.category === "wildy" && gearConfidence === "unknown" ? 0.46 : 0.74,
        actionability: gearConfidence === "unknown" ? 0.48 : 0.78,
        stopPoint: 0.82,
        gearConfidence: gearConfidence === "confirmed" ? 0.95 : gearConfidence === "not-needed" ? 0.78 : 0.4,
        unlockValue: 0.44,
        fun: 0.84,
        friction: boss.category === "wildy" && gearConfidence === "unknown" ? 0.82 : gearConfidence === "unknown" ? 0.62 : 0.4
      },
      planSeed: {
        timebox: "30-60 min",
        prep: match.item ? `Scapestack found ${match.item} in your bank; build the first setup around it.` : `Your combat level is the main signal for ${boss.name}; paste a bank for gear checks.`,
        steps: [
          `Open ${boss.name} in DPS and use the best owned setup before buying anything.`,
          "Bring supplies for 3-5 kills so mistakes stay cheap.",
          boss.avgLootGp ? `Compare your real supply cost against ~${Math.round(boss.avgLootGp / 1000)}k average loot/kill after the test trip.` : "After the test trip, compare kill time and supply burn before committing to a grind."
        ]
      }
    });
  }
  // Cap at top-4 — beyond that the checklist becomes "every boss in CL range"
  // which is noise. The DPS calculator is one click away for the full list.
  return recs.sort((a, b) => b.score - a.score).slice(0, 4);
}

// Build the rec's `why` line. When we matched a specific gear item we
// surface it ("Your Twisted bow + CL 126 makes this easy") so the player
// sees the engine read their bank. Falls back to CL-only when match.item
// is empty (no-gate boss or no bank pasted).
function displayMatchedGear(matchedItem: string): string {
  return matchedItem.replace(/\b\w/g, (c) => c.toUpperCase());
}

function gearWhy(combatLevel: number, matchedItem: string): string | null {
  if (!matchedItem) return null;
  const display = displayMatchedGear(matchedItem);
  return `Your ${display} fits — and CL ${combatLevel} clears the gate.`;
}

// Skills sitting just short of a milestone level — a clear, finite push.
function skillRecs(skills: HiscoreSkill[]): Recommendation[] {
  const recs: Recommendation[] = [];
  const combatLevel = computeCombatLevel(skills);
  for (const [skill, milestones] of Object.entries(SKILL_MILESTONES)) {
    const level = lvl(skills, skill);
    for (const m of milestones) {
      const gap = m.level - level;
      const maxGap = m.maxGap ?? 5;
      if (gap <= 0 || gap > maxGap) continue;
      const nearMilestone = gap <= 5;
      const returningSlayerFoundation = skill === "Slayer"
        && m.level === 70
        && level >= 45
        && level < 70
        && combatLevel !== null
        && combatLevel >= 75;
      recs.push({
        id: `skill:${skill}:${m.level}`,
        kind: "skill",
        title: `Push ${skill} to ${m.level}`,
        why: `You're ${gap} level${gap === 1 ? "" : "s"} away.`,
        payoff: `Unlocks: ${m.unlock}`,
        decisionReason: gap <= 2
          ? `${skill} ${m.level} is within ${gap} level${gap === 1 ? "" : "s"}; stop as soon as the unlock lands.`
          : `${skill} ${m.level} is close enough to be a clean AFK or focused backup.`,
        // Close milestones can compete with diaries. Longer foundation
        // pushes (Slayer 50→70, Prayer 52→70) stay visible but do not
        // outrank immediately actionable unlocks.
        score: returningSlayerFoundation
          ? 76
          : nearMilestone
            ? 78 - gap * 6
            : 66 - Math.min(8, Math.floor((gap - 6) / 3)),
        link: "/goals",
        // Per-skill cape sprite — Slayer cape for 'Push Slayer', not the
        // generic Attack cape stand-in that was shipping before.
        iconItemId: skillCapeId(skill),
        routeTags: [
          "afk",
          "maxing",
          ...(skill === "Slayer" ? ["slayer" as const, "pvm" as const] : []),
          ...(skill === "Agility" || skill === "Farming" || skill === "Mining" ? ["skiller" as const] : [])
        ],
        quality: {
          accountFit: 0.8,
          actionability: nearMilestone ? 0.88 : 0.72,
          stopPoint: nearMilestone ? 0.92 : 0.76,
          gearConfidence: 0.96,
          unlockValue: m.level === 99 ? 0.82 : 0.76,
          fun: skill === "Slayer" ? 0.72 : 0.58,
          friction: nearMilestone ? 0.18 : 0.3
        },
        planSeed: {
          timebox: gap <= 2 ? "30-60 min" : "1-2 sessions",
          prep: `${skill} ${level} → ${m.level}: only ${gap} level${gap === 1 ? "" : "s"} for ${m.unlock}.`,
          steps: [
            `Train ${skill} until level ${m.level}, then stop — the unlock is the point.`,
            "Buy or bank supplies for only the gap so you do not overcommit GP/time.",
            "Re-run /next immediately; this level may unlock quests, diaries or bosses."
          ]
        }
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
    req: [{ skill: "Magic", level: 66 }],
    gpHr: 600_000, intensity: "active",
    payoff: "~1.5k wines/hour. Free Magic XP on top.",
    iconItemId: 245,
    needs: [
      "66 Magic for Telekinetic Grab",
      "Nature runes × ~1k + Law runes × ~1k + Air runes",
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

function moneyRecs(skills: HiscoreSkill[], accountMeta?: AccountMeta | null): Recommendation[] {
  if (skills.length === 0) return [];
  if (
    accountMeta?.accountType === "ironman" ||
    accountMeta?.accountType === "hardcore" ||
    accountMeta?.accountType === "ultimate"
  ) {
    return [];
  }

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

  // Pre-filter: pak per ladder de hoogste qualifying tier.
  const qualifyingSlugs = new Set<string>();
  for (const m of MONEY_METHODS) {
    if (!m.req.every((r) => lvl(skills, r.skill) >= r.level)) continue;
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
    if (m.gpHr < minGpHr) continue;
    recs.push({
      id: `money:${m.slug}`,
      kind: "money",
      title: m.name,
      why: m.gpHr > 0 ? `~${fmtGp(m.gpHr)} gp/hr · ${m.intensity}` : m.intensity,
      payoff: m.payoff,
      decisionReason: `${m.name} matches your levels and can fund the next unlock without starting a long grind.`,
      needs: m.needs,
      details: m.details,
      // Higher gp/hr scores higher, capped so it doesn't dominate the list.
      score: 50 + Math.min(20, Math.log10(Math.max(1, m.gpHr)) * 2),
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
          m.gpHr > 0 ? `Run a measured half-hour and compare real profit against ~${fmtGp(m.gpHr)} gp/hr.` : "Use this as an unlock/reward session rather than a profit session.",
          "Check supply and GE prices before committing to a long grind.",
          "Spend the profit on the next unlock shown above instead of letting cash sit idle."
        ]
      }
    });
  }
  return recs;
}

function slayerTaskRecs(
  slayer: NonNullable<NextUpInput["scapestackSync"]>["slayer"] | undefined,
  displayName?: string
): Recommendation[] {
  if (!slayer || slayer.taskRemaining <= 0 || slayer.currentTaskId <= 0) return [];
  const slug = TASK_ID_TO_MONSTER[slayer.currentTaskId];
  const monster = slug ? MONSTERS_BY_ID.get(slug) : undefined;
  if (!monster) return [];

  const taskXp = Math.max(0, monster.hp * 4 * slayer.taskRemaining);
  const taskLeftLabel = `${slayer.taskRemaining.toLocaleString()} ${monster.name}${slayer.taskRemaining === 1 ? "" : "s"}`;
  const pointsHint = slayer.points >= 100
    ? `${slayer.points.toLocaleString()} Slayer points available for skips, blocks or unlocks.`
    : `${slayer.points.toLocaleString()} Slayer points banked; keep streak discipline.`;

  return [{
    id: `slayer:current-task:${slug}`,
    kind: "slayer",
    title: `Finish your ${monster.name} task`,
    why: `RuneLite sync says you have ${taskLeftLabel} left right now.`,
    payoff: `~${Math.round(taskXp / 100) / 10}k Slayer XP remaining · streak ${slayer.streak.toLocaleString()}.`,
    decisionReason: `RuneLite says ${taskLeftLabel} are left, so finishing the task beats starting a random grind.`,
    score: slayer.taskRemaining >= 10 ? 94 : 68,
    link: displayName ? slayerUrlForSyncedRsn(displayName) : "/slayer",
    iconItemId: 11864,
    routeTags: ["slayer", "pvm", "unlock"],
    gearConfidence: "likely",
    quality: {
      accountFit: 0.99,
      actionability: 0.96,
      stopPoint: 0.94,
      gearConfidence: 0.76,
      unlockValue: 0.78,
      fun: 0.74,
      friction: 0.14
    },
    needs: [
      "Current task from Scapestack RuneLite plugin",
      monster.slayerLevel > 1 ? `${monster.slayerLevel} Slayer requirement` : "No special Slayer level gate",
      pointsHint
    ],
    details: monster.hint ?? `${monster.locations.slice(0, 2).join(" / ")} · ${monster.cannonable ? "cannonable" : "no cannon baseline"}.`,
    planSeed: {
      timebox: slayer.taskRemaining >= 80 ? "45-90 min" : slayer.taskRemaining >= 25 ? "25-45 min" : "10-20 min",
      prep: `${taskLeftLabel} left. ${pointsHint}`,
      steps: [
        displayName
          ? `Open synced /slayer for ${displayName} and confirm whether ${monster.name} is worth finishing, skipping or blocking.`
          : `Open /slayer and confirm whether ${monster.name} is worth finishing, skipping or blocking.`,
        monster.cannonable
          ? "Bring cannon + balls if the location supports it; otherwise use the fastest safe setup."
          : "Bring the fastest safe setup; do not over-bank supplies for a short remainder.",
        "Finish or intentionally skip the task, then re-sync so /next follows the new assignment."
      ]
    }
  }];
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
const QUEST_CAPE_QP_THRESHOLD = 290;

function questRecs(
  quests: Map<string, QuestRecord>,
  skills: HiscoreSkill[],
  qp: number,
  completedQuestNames?: Set<string>
): Recommendation[] {
  if (skills.length === 0) return [];
  if (qp >= QUEST_CAPE_QP_THRESHOLD) return [];
  const combatLevel = computeCombatLevel(skills);
  const recs: Recommendation[] = [];
  for (const q of quests.values()) {
    if (completedQuestNames?.has(q.name.toLowerCase())) continue;
    // Filter to recommendation-worthy difficulty. "Special" covers RFD and
    // a handful of other big multi-part quests.
    if (q.difficulty !== "Master" && q.difficulty !== "Grandmaster" && q.difficulty !== "Special") continue;
    // The Wiki-derived quest data covers skill/QP gates but not practical
    // boss-fight requirements. Low-combat skillers should not be pushed into
    // SOTE/Blood Moon/MM2 just because their non-combat skills qualify.
    if (combatLevel < 50 && (q.difficulty === "Master" || q.difficulty === "Grandmaster")) continue;
    if (combatLevel < 70 && q.difficulty === "Grandmaster") continue;
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
    const prereqPenalty = Math.min(q.difficulty === "Grandmaster" ? 22 : 18, Math.floor(q.questReqs.length / 2));
    const lowFrictionBonus = q.questReqs.length <= 4 ? 4 : 0;
    const score = base + lowFrictionBonus - prereqPenalty;

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
      decisionReason: completedQuestNames
        ? `Completed quests were skipped; ${q.name} still matches your visible stats and quest points.`
        : q.questReqs.length > 8
          ? `${q.name} has a long prereq chain, so start only if you want an unlock session.`
          : `${q.name} fits your stats and is short enough to be a real unlock target.`,
      score,
      link: undefined,
      routeTags: ["unlock", ...(q.questReqs.length <= 4 ? ["returning" as const] : []), ...(q.difficulty === "Grandmaster" ? ["fun" as const] : [])],
      gearConfidence: q.difficulty === "Grandmaster" ? "unknown" : "likely",
      quality: {
        accountFit: q.questReqs.length > 8 ? 0.58 : 0.78,
        actionability: q.questReqs.length > 8 ? 0.45 : 0.76,
        stopPoint: q.length === "Very Long" || q.length === "Long" ? 0.54 : 0.82,
        gearConfidence: q.difficulty === "Grandmaster" ? 0.48 : 0.72,
        unlockValue: q.difficulty === "Grandmaster" ? 0.96 : 0.86,
        fun: q.difficulty === "Grandmaster" ? 0.72 : 0.58,
        friction: q.questReqs.length > 8 ? 0.78 : q.questReqs.length > 4 ? 0.52 : 0.32
      },
      planSeed: {
        timebox: q.length === "Very Long" || q.length === "Long" ? "2-3 hr" : "1-2 hr",
        prep: q.questReqs.length > 0
          ? `Prereq check: ${q.questReqs.slice(0, 3).join(", ")}${q.questReqs.length > 3 ? ` (+${q.questReqs.length - 3} more)` : ""}.`
          : "No direct quest prerequisites found in the dataset.",
        steps: [
          `Check ${q.name} prereqs before grabbing supplies; stop if the chain is longer than tonight's session.`,
          q.skillReqs.length > 0 ? `Your skills meet the listed gates; bank teleports, stamina and combat supplies for a ${q.length ?? "variable"} quest.` : "Bank teleports, stamina and any quest items before starting the guide.",
          `Clear ${q.name} or one blocking prereq, then re-run /next for newly unlocked bosses/diaries.`
        ]
      }
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
// Hand-picked "this is THE chase at this boss" overrides — substrings
// matched (case-insensitive) against the drop's name. When set, we prefer
// the iconic drop over the generic 500-15000-denom window. Lets us surface
// Tbow at CoX (1/34500, way past the window) and Shadow at ToA, which are
// the chases every player at those bosses actually wants to know about.
// Order doesn't matter — we use Array.find.
// Each iconic chase carries a name-needle (for bank substring matching)
// and the canonical OSRS item-id (for cl.net's owned-item set lookup).
// IDs verified against chisel.weirdgloop.org. When a player has the
// item in their bank OR their collection-log we skip past to the next.
interface IconicEntry {
  needle: string;
  itemId: number;
}
const ICONIC_DROPS: Record<string, IconicEntry[]> = {
  "Chambers of Xeric": [
    { needle: "twisted bow",       itemId: 20997 },
    { needle: "kodai insignia",    itemId: 21043 },
    { needle: "elder maul",        itemId: 21003 }
  ],
  "Theatre of Blood": [
    { needle: "scythe of vitur",   itemId: 22325 },
    { needle: "ghrazi rapier",     itemId: 22324 },
    { needle: "sanguinesti staff", itemId: 22323 }
  ],
  "Tombs of Amascut: Expert Mode": [
    { needle: "tumeken's shadow",  itemId: 27275 },
    { needle: "osmumten's fang",   itemId: 26219 },
    { needle: "elidinis' ward",    itemId: 25985 }
  ],
  "Tombs of Amascut": [
    { needle: "tumeken's shadow",  itemId: 27275 },
    { needle: "osmumten's fang",   itemId: 26219 }
  ],
  "Nex": [
    { needle: "torva full helm",   itemId: 26382 },
    { needle: "zaryte vambraces",  itemId: 26235 }
  ]
};

// Returns true if the player's bank contains anything whose lowercased name
// includes the given needle. Used to skip KC-recs for drops the player
// already has — there's no need to tell a player with a Tbow in their bank
// "you're dry on Tbow at CoX."
function bankHas(bank: CompletionItem[], needle: string): boolean {
  for (const it of bank) {
    if (it.name.toLowerCase().includes(needle)) return true;
  }
  return false;
}

// 'Does the player own at least one of this iconic drop?'
//   - Collection-log (cl.net plugin): authoritative when present —
//     this is the source of truth Jagex would expose if they had an API.
//   - Bank paste: fallback name-substring scan.
// Used by kcRecs to skip iconic chases the player already has.
function ownsIconic(entry: IconicEntry, bank: CompletionItem[], clOwned: Set<number> | undefined): boolean {
  if (clOwned && clOwned.has(entry.itemId)) return true;
  return bankHas(bank, entry.needle);
}

function bossForKcName(name: string): Boss | undefined {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return BOSSES.find((boss) =>
    boss.name.toLowerCase() === name.toLowerCase()
    || boss.slug === normalized
    || boss.slug === normalized.replace(/^the-/, "")
  );
}

function activeBossKcScore(kc: number, boss: Boss, hasBank: boolean): number {
  const avgLoot = boss.avgLootGp ?? 0;
  const lootBoost =
    avgLoot >= 300_000 ? 8
      : avgLoot >= 150_000 ? 5
        : avgLoot >= 100_000 ? 3
          : 0;
  const missingBankPenalty = hasBank ? 0 : 3;
  const wildyPenalty = boss.category === "wildy" ? (hasBank ? 4 : 10) : 0;

  if (kc < 5) {
    return Math.max(40, 54 + kc * 1.5 + lootBoost - missingBankPenalty - wildyPenalty);
  }

  if (kc < 10) {
    return 64 + (kc - 5) * 1.5 + lootBoost - missingBankPenalty - wildyPenalty;
  }

  const commitmentBoost = Math.min(8, (kc - 10) * 0.35);
  return Math.min(92, 84 + commitmentBoost + Math.floor(lootBoost / 2) - missingBankPenalty * 0.5 - wildyPenalty * 0.5);
}

function activeBossKcWhy(kc: number, boss: Boss): string {
  if (kc < 5) {
    return `${kc.toLocaleString()} KC is only a scout read; test a short block before this becomes a real grind.`;
  }
  if (kc < 10) {
    return `${kc.toLocaleString()} KC says you started learning it, but the next block should still be a proof run.`;
  }
  return `${kc.toLocaleString()} KC means this is already started; 50 KC is enough to judge whether the grind fits.`;
}

function activeBossKcRecs(bossKc: Record<string, number>, bank: CompletionItem[], skills: HiscoreSkill[]): Recommendation[] {
  const slayerLevel = lvl(skills, "Slayer");
  const recs: Recommendation[] = [];
  for (const [name, kc] of Object.entries(bossKc)) {
    if (kc <= 0 || kc >= 50) continue;

    const boss = bossForKcName(name);
    if (!boss || hasBossExperience(boss, bank, { [boss.name]: kc })) continue;
    const gearGate = BOSS_GEAR_GATES[boss.slug];
    if (gearGate?.slayerLevel && slayerLevel < gearGate.slayerLevel) continue;
    const match = bank.length > 0
      ? matchedGearForBoss(boss.slug, bank, slayerLevel)
      : { item: "" };
    if (match === null) continue;

    const remaining = 50 - kc;
    const matchedGear = match.item ? displayMatchedGear(match.item) : null;
    const gearConfidence: RecommendationGearConfidence = match.item
      ? "confirmed"
      : bank.length > 0
        ? "not-needed"
        : "unknown";
    recs.push({
      id: `kc:${name}:first-50`,
      kind: "kc",
      title: `Push ${boss.name} to 50 KC`,
      why: activeBossKcWhy(kc, boss),
      payoff: boss.avgLootGp ? `~${Math.round(boss.avgLootGp / 1000)}k average loot per kill while you build proof.` : boss.notes,
      decisionReason: kc < 5
        ? `This is only ${kc.toLocaleString()} KC, so it stays a scout read instead of the main plan.`
        : kc < 10
          ? `${kc.toLocaleString()} ${boss.name} KC is a proof run; keep it short before chasing 50.`
          : `You already have ${kc.toLocaleString()} ${boss.name} KC, so 50 KC is a clean stop point.`,
      score: activeBossKcScore(kc, boss, bank.length > 0),
      link: "/dps",
      iconItemId: boss.iconItemId,
      bossSlug: boss.slug,
      kcMeta: { kc, denom: 50, dropName: "first 50 KC" },
      routeTags: ["pvm", "fun", ...(boss.avgLootGp ? ["gp" as const] : [])],
      gearConfidence,
      quality: {
        accountFit: kc < 5 ? 0.44 : kc < 10 ? 0.66 : 0.86,
        actionability: gearConfidence === "unknown" ? 0.48 : 0.8,
        stopPoint: kc < 5 ? 0.64 : 0.9,
        gearConfidence: gearConfidence === "confirmed" ? 0.95 : gearConfidence === "not-needed" ? 0.78 : 0.4,
        unlockValue: 0.48,
        fun: 0.84,
        friction: kc < 5 ? 0.68 : gearConfidence === "unknown" ? 0.62 : 0.34
      },
      needs: [
        matchedGear ? `${matchedGear} setup` : "DPS setup check",
        "Teleports and supplies for one fixed trip",
        boss.category === "wildy" ? "Risk only what you are fine losing" : "Re-check after the KC block"
      ],
      details: kc < 10
        ? `${boss.name} has some account history, but not enough to override stronger unlocks by itself. Treat this as a controlled proof run, not a blind grind.`
        : `${boss.name} has enough KC history to justify a focused block. The point is to learn whether kill time, supply burn and loot feel worth continuing.`,
      planSeed: {
        timebox: kc < 10 ? "30-60 min" : "45-90 min",
        prep: kc < 10
          ? `${boss.name} is still a scout read. Run a small block and let the result decide whether it deserves 50 KC.`
          : `You only need ${remaining} more ${boss.name} kill${remaining === 1 ? "" : "s"} to turn this from a test into a real read.`,
        steps: [
          `Open ${boss.name} in DPS and lock the setup before the first trip.`,
          `Run ${kc < 10 ? Math.min(remaining, 5) : Math.min(remaining, 10)}-${kc < 10 ? Math.min(remaining, 10) : Math.min(remaining, 25)} KC without changing the goal mid-session.`,
          "Re-sync after the block; if kill time and supply burn are stable, continue to 50 KC."
        ]
      }
    });
  }
  return recs.sort((a, b) => b.score - a.score).slice(0, 3);
}

// Combines a player's boss kill-count (from Hiscores) with the rarest unique
// drop rate for that boss (from data/drop-rates.json) into "you've killed
// this boss X times — statistically you'd expect Y uniques by now". Only
// surfaces if the player has *enough* KC to make the comparison meaningful
// (KC >= 25 % of the rarest drop's denominator) — otherwise the rec is
// just "drop rate is 1/5000, go grind" which adds no signal.
//
// Bank-aware: when the player already has an iconic drop in their bank we
// skip past it and recommend the next iconic they're still missing. If all
// iconics are owned, fall through to the generic-window pick (pets, alts).
function kcRecs(
  dropTables: Map<string, BossDropTable>,
  bossKc: Record<string, number>,
  bank: CompletionItem[],
  clOwned?: Set<number>
): Recommendation[] {
  if (dropTables.size === 0) return [];
  const recs: Recommendation[] = [];
  for (const [wikiName, table] of dropTables) {
    const kc = bossKc[table.hiscoresName] ?? 0;
    if (kc <= 0) continue; // never killed → no insight, just noise

    // Pick the rarest "iconic" drop the player would chase AND doesn't
    // already own. Two paths:
    //  1. If the boss has an entry in ICONIC_DROPS, walk the entries in
    //     order and pick the first one whose drop they don't have. This
    //     overrides the denom window so e.g. Tbow at CoX (1/34500) can
    //     still surface as a chase.
    //  2. Otherwise, walk table.drops (rarest first) and pick the first
    //     one in the 500-15000 denom window that the player doesn't own.
    const iconics = ICONIC_DROPS[wikiName];
    let headline: typeof table.drops[number] | undefined;
    let isIconic = false;
    if (iconics) {
      for (const entry of iconics) {
        if (ownsIconic(entry, bank, clOwned)) continue;
        headline = table.drops.find((d) => d.name.toLowerCase().includes(entry.needle));
        if (headline) { isIconic = true; break; }
      }
    }
    if (!headline) {
      headline = table.drops.find((d) =>
        d.denom >= 500 && d.denom <= 15000 && !bankHas(bank, d.name.toLowerCase())
      );
    }
    if (!headline) continue;

    const expected = kc * (headline.num / headline.denom);
    // KC floor: 0.15× the drop rate for the generic path. For iconic drops
    // (Tbow at CoX, Shadow at ToA, Scythe at ToB) we soften this to a flat
    // 25 KC minimum — players want to see "are you dry yet?" even at low
    // expected counts because the iconic drop IS the chase, regardless of
    // how mathematically early they are.
    const minKc = isIconic ? 25 : headline.denom * 0.15;
    if (kc < minKc) continue;

    // Score: rises with how far past the drop rate you are. Boosted from
    // (55 + expected*6, cap 80) so KC-recs can compete with Elite-diary
    // recs (which hit ~78-82 at full score). At 1x the rate score ~70,
    // at 3x ~82. Slightly-unlucky drops surface as headlines, which is
    // the whole point of this rec-kind. Iconic drops get a +6 floor bonus
    // so e.g. Tbow at 250 CoX KC still surfaces ("0.7% chance — early but
    // worth noting") instead of being drowned by mid-tier-KC recs.
    const iconicBoost = isIconic ? 6 : 0;
    const score = Math.min(88, 64 + iconicBoost + expected * 6);

    // Look up boss meta in BOSSES so we can show a sprite.
    const boss = BOSSES.find((b) => b.name === wikiName || b.slug === wikiName.toLowerCase().replace(/[^a-z]/g, "-"));

    const kcBlock = headline.denom <= 512 ? "25-50" : headline.denom <= 5000 ? "10-25" : "5-10";

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
      iconItemId: boss?.iconItemId,
      bossSlug: boss?.slug,
      kcMeta: { kc, denom: headline.denom, dropName: headline.name },
      routeTags: ["pvm", "fun", "maxing"],
      gearConfidence: bank.length > 0 ? "likely" : "unknown",
      quality: {
        accountFit: expected >= 1 ? 0.86 : 0.68,
        actionability: bank.length > 0 ? 0.78 : 0.54,
        stopPoint: 0.82,
        gearConfidence: bank.length > 0 ? 0.76 : 0.46,
        unlockValue: isIconic ? 0.82 : 0.58,
        fun: 0.9,
        friction: bank.length > 0 ? 0.36 : 0.6
      },
      planSeed: {
        timebox: headline.denom > 5000 ? "1-2 hr" : "45-90 min",
        prep: `${headline.name} is the chase here; your current ${wikiName} KC is ${expected.toFixed(2)} expected rolls.`,
        steps: [
          boss ? `Open ${boss.name} detail and sanity-check the owned setup before the next block.` : `Sanity-check your ${wikiName} setup before the next block.`,
          `Run a fixed ${kcBlock} KC block so the dry-rate has a clear before/after.`,
          "Re-sync collection log/KC after the block; do not let dryness decide the session length mid-trip."
        ]
      }
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
      why: `Your visible stats clear the ${metTier} skill gates in this region.`,
      payoff: metTier === "Elite"
        ? `Unlocks the tier-4 reward (${region} headgear / cape / cloak).`
        : `Step toward the tier-4 reward; ${metTier} unlocks its tier perks.`,
      decisionReason: `${region} ${metTier} is close because one requirement is only ${nearestGap} level${nearestGap === 1 ? "" : "s"} above the gate.`,
      score,
      link: undefined,
      iconItemId: DIARY_REWARD_ICONS[region],
      routeTags: ["unlock", "maxing", "returning"],
      gearConfidence: "likely",
      quality: {
        accountFit: 0.78,
        actionability: 0.76,
        stopPoint: 0.84,
        gearConfidence: 0.78,
        unlockValue: metTier === "Elite" ? 0.92 : 0.82,
        fun: 0.56,
        friction: metTier === "Elite" ? 0.48 : 0.32
      },
      planSeed: {
        timebox: metTier === "Elite" ? "1-2 hr" : "45-90 min",
        prep: `You meet every known ${region} ${metTier} skill gate; nearest headroom is ${nearestGap} level${nearestGap === 1 ? "" : "s"}.`,
        steps: [
          `Open the ${region} ${metTier} checklist and gather every task item before traveling.`,
          "Do travel/skill tasks in one sweep, then finish any combat or minigame task last.",
          "Claim the diary reward and re-sync so lower-value diary nudges disappear."
        ]
      }
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
    decisionReason: "Bank cleanup only wins when it reduces friction for every later trip.",
    score: 30,
    link: "/bank",
    planSeed: {
      timebox: "10-20 min",
      prep: `You have ${bank.length} recognized bank items; clean tabs reduce friction on every later trip.`,
      steps: [
        "Open Gear & Bank and export the cleaned RuneLite tabs.",
        "Decant potions, recharge jewellery and move obvious junk before the next PvM/skilling run.",
        "Save the cleaned bank so future /next runs compare against the new baseline."
      ]
    }
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
    title: "Add your OSRS name for a real plan",
    why: "We can only see your bank. Your Hiscores add skills, combat, KC and quest gates.",
    payoff: "Free, no plugin, no account. Just your RSN.",
    decisionReason: "The bank is loaded, but your OSRS name is what turns this into a real session plan.",
    score: 95,
    link: undefined,
    planSeed: {
      timebox: "2 min",
      prep: "The bank is loaded, but stats make the next move useful.",
      steps: [
        "Enter your OSRS name on /next and keep the current bank loaded.",
        "Use the first plan it gives you, then add bank or RuneLite only if the pick looks off.",
        "Run Scapestack Sync later if /next suggests quests, diary tiers, collection-log slots or Slayer tasks you already finished."
      ]
    }
  };
}

function starterQuestRecs(hasHiscores: boolean, bank: CompletionItem[]): Recommendation[] {
  if (hasHiscores || bank.length === 0 || bank.length > 20) return [];
  return [
    {
      id: "quest:Cook's Assistant",
      kind: "quest",
      title: "Cook's Assistant",
      why: "Fast starter quest · no combat",
      payoff: "Quick quest point and unlocks the habit of quest-first progression.",
      decisionReason: "This is a quick first quest that moves the account without gear checks.",
      score: 42,
      link: undefined,
      planSeed: {
        timebox: "5-10 min",
        prep: "Grab an egg, bucket of milk and pot of flour before entering Lumbridge Castle.",
        steps: [
          "Talk to the cook in Lumbridge Castle kitchen.",
          "Hand in the three ingredients in one trip.",
          "Re-run /next after a few starter quests so Hiscores-based advice has real account signal."
        ]
      }
    },
    {
      id: "quest:Sheep Shearer",
      kind: "quest",
      title: "Sheep Shearer",
      why: "Fast starter quest · no combat",
      payoff: "Easy quest point and basic skilling loop near Lumbridge.",
      decisionReason: "A fast skilling loop is useful when the account has almost no visible stats yet.",
      score: 41,
      link: undefined,
      planSeed: {
        timebox: "5-10 min",
        prep: "Bring shears or buy them from a general store before going to Fred's farm.",
        steps: [
          "Talk to Fred the Farmer north-west of Lumbridge.",
          "Shear sheep, spin the wool, then turn in the balls of wool.",
          "Use this as a quick quest-count bump before longer routes."
        ]
      }
    },
    {
      id: "quest:Romeo & Juliet",
      kind: "quest",
      title: "Romeo & Juliet",
      why: "Fast starter quest · no combat",
      payoff: "Five quest points very early, useful for unlocking broader quest chains.",
      decisionReason: "Five quick quest points is a better starter move than a vague grind.",
      score: 40,
      link: undefined,
      planSeed: {
        timebox: "10-15 min",
        prep: "Start in Varrock and bank a cadava berry to avoid extra walking.",
        steps: [
          "Talk to Romeo in Varrock square and route through Juliet/Father Lawrence.",
          "Pick or bring the cadava berry before visiting the Apothecary.",
          "Finish the quest, then add your RSN so Scapestack can use Hiscores instead of a starter-account default."
        ]
      }
    }
  ];
}

function accountRouteRecs(input: {
  skills: HiscoreSkill[];
  questPoints: number;
  accountStage: AccountStage;
  accountMeta?: AccountMeta | null;
  completedQuestNames?: Set<string>;
}): Recommendation[] {
  const { skills, questPoints, accountStage, accountMeta, completedQuestNames } = input;
  if (skills.length === 0) return [];

  const recs: Recommendation[] = [];
  const combatLevel = computeCombatLevel(skills);
  const totalLevel = computeTotalLevel(skills);
  const iron = isIronAccount(accountMeta);
  const prayer = lvl(skills, "Prayer");
  const herblore = lvl(skills, "Herblore");
  const agility = lvl(skills, "Agility");
  const farming = lvl(skills, "Farming");
  const hunter = lvl(skills, "Hunter");
  const crafting = lvl(skills, "Crafting");
  const ranged = lvl(skills, "Ranged");
  const slayer = lvl(skills, "Slayer");

  if (
    herblore <= 3
    && questPoints < QUEST_CAPE_QP_THRESHOLD
    && !completedQuest(completedQuestNames, ["Druidic Ritual"])
  ) {
    recs.push({
      id: "quest:Druidic Ritual",
      kind: "quest",
      title: "Unlock Herblore",
      why: "Druidic Ritual opens potions, quest gates and ironman supply routes.",
      payoff: "Herblore unlocks quest chains, diary steps and better supplies.",
      decisionReason: "Herblore is still locked, so this tiny quest unlocks more account routes than random skilling.",
      score: accountStage.id === "new-account" || iron ? 76 : 66,
      link: undefined,
      iconItemId: 255,
      routeTags: ["beginner", "unlock", "iron", "returning"],
      gearConfidence: "not-needed",
      quality: {
        accountFit: 0.92,
        actionability: 0.96,
        stopPoint: 0.95,
        gearConfidence: 1,
        unlockValue: 0.96,
        fun: 0.5,
        friction: 0.08
      },
      planSeed: {
        timebox: "10-20 min",
        prep: "Bank raw beef, raw rat meat, raw bear meat and raw chicken before walking to Taverley.",
        steps: [
          "Talk to Kaqemeex north of Taverley, then Sanfew upstairs in the Herblore shop.",
          "Dip the four meats in the Cauldron of Thunder and hand them in.",
          "Stop when Herblore unlocks; re-run /next because potions and quest chains now open."
        ]
      }
    });
  }

  if (combatLevel >= 35 && prayer >= 37 && prayer < 43) {
    const gap = 43 - prayer;
    recs.push({
      id: "skill:Prayer:43-protection",
      kind: "skill",
      title: "Unlock protection prayers",
      why: `Prayer ${prayer} -> 43 turns a lot of quests and boss learning from scary to manageable.`,
      payoff: "Protect from Melee, Missiles and Magic.",
      decisionReason: `You are only ${gap} Prayer level${gap === 1 ? "" : "s"} from protection prayers, one of the cleanest account unlocks in OSRS.`,
      score: 80 - gap * 3,
      link: "/goals",
      iconItemId: 2412,
      routeTags: ["beginner", "returning", "unlock", "pvm"],
      gearConfidence: "not-needed",
      quality: {
        accountFit: 0.92,
        actionability: 0.86,
        stopPoint: 0.95,
        gearConfidence: 1,
        unlockValue: 0.98,
        fun: 0.58,
        friction: 0.16
      },
      planSeed: {
        timebox: gap <= 2 ? "20-45 min" : "45-90 min",
        prep: `Prayer ${prayer} -> 43. Buy only enough bones/ensouled heads for the gap.`,
        steps: [
          "Use the fastest altar or ensouled-head method you can afford.",
          "Stop exactly at 43 Prayer; protection prayers are the unlock, not a random XP grind.",
          "Re-run /next because quest, diary and PvM routes change immediately."
        ]
      }
    });
  }

  if (
    questPoints < QUEST_CAPE_QP_THRESHOLD
    && ranged >= 30
    && prayer >= 31
    && crafting >= 18
    && slayer >= 18
    && !completedQuest(completedQuestNames, ["Animal Magnetism"])
  ) {
    recs.push({
      id: "quest:Animal Magnetism",
      kind: "quest",
      title: "Get Ava's device",
      why: "Your stats fit Animal Magnetism; Ava's saves ammo on every ranged trip.",
      payoff: "Ava's accumulator and a cleaner ranged setup forever.",
      decisionReason: "This is a small quest with a permanent gear payoff, so it beats another unfocused ranged grind.",
      score: 60,
      link: undefined,
      iconItemId: 10499,
      routeTags: ["unlock", "pvm", "returning", "iron"],
      gearConfidence: "not-needed",
      quality: {
        accountFit: 0.86,
        actionability: 0.78,
        stopPoint: 0.84,
        gearConfidence: 0.96,
        unlockValue: 0.92,
        fun: 0.58,
        friction: 0.28
      },
      planSeed: {
        timebox: "45-75 min",
        prep: "Check the short prereqs, then bank teleports to Draynor, Port Phasmatys and the Slayer tower area.",
        steps: [
          "Start with Ava in Draynor Manor and keep the quest guide open for item hand-ins.",
          "Finish the undead chicken/magnet pieces before doing extra training.",
          "Equip Ava's and re-run /next; ranged bosses and Slayer tasks become cleaner."
        ]
      }
    });
  }

  if (
    totalLevel >= 450
    && totalLevel < 2100
    && agility >= 10
    && agility < 60
  ) {
    const target = agility < 40 ? 40 : 60;
    recs.push({
      id: "skill:Agility:graceful-route",
      kind: "skill",
      title: target === 40 ? "Start Graceful" : "Finish Graceful",
      why: `Agility ${agility}. Rooftops make questing, clues and herb runs less painful.`,
      payoff: "Marks of grace, run energy and a smoother account.",
      decisionReason: "Run energy is account-wide friction; Graceful makes almost every later route feel better.",
      score: target === 40 ? 56 : 60,
      link: "/goals",
      iconItemId: 11850,
      routeTags: ["afk", "skiller", "returning", "unlock"],
      gearConfidence: "not-needed",
      quality: {
        accountFit: 0.82,
        actionability: 0.86,
        stopPoint: target === 40 ? 0.78 : 0.72,
        gearConfidence: 1,
        unlockValue: 0.78,
        fun: 0.48,
        friction: 0.24
      },
      planSeed: {
        timebox: "45-90 min",
        prep: `Run rooftops toward Agility ${target}; marks of grace are the real reward.`,
        steps: [
          "Pick the highest rooftop course you can run comfortably.",
          "Do one clean mark/level block, not an endless agility session.",
          "Stop when the level target or Graceful piece lands, then re-run /next."
        ]
      }
    });
  }

  if (totalLevel >= 650 && questPoints < QUEST_CAPE_QP_THRESHOLD && !completedQuest(completedQuestNames, [
    "Fairytale II - Cure a Queen",
    "Fairy Tale II - Cure a Queen"
  ])) {
    recs.push({
      id: "quest:fairy-rings-route",
      kind: "quest",
      title: "Unlock fairy rings",
      why: "Fairy rings make quests, clues, herb runs and Slayer routes massively shorter.",
      payoff: "Travel upgrade: less walking, faster trips, better daily loops.",
      decisionReason: "Travel time is hidden bankstanding; fairy rings remove friction from almost every account route.",
      score: accountStage.id === "returning" || iron ? 62 : 58,
      link: undefined,
      iconItemId: 772,
      routeTags: ["unlock", "returning", "iron"],
      gearConfidence: "not-needed",
      quality: {
        accountFit: 0.86,
        actionability: 0.7,
        stopPoint: 0.72,
        gearConfidence: 0.94,
        unlockValue: 0.96,
        fun: 0.62,
        friction: 0.36
      },
      planSeed: {
        timebox: "1-2 hr",
        prep: "Check Fairytale I/II prereqs first. You only need partial Fairytale II progress for ring access.",
        steps: [
          "Clear Fairytale I if needed, then start Fairytale II until fairy rings unlock.",
          "Set a fairy ring near your bank route and test one herb/clue/Slayer trip.",
          "Stop at fairy ring access; full quest completion can be a later unlock session."
        ]
      }
    });
  }

  if (farming >= 32 && hunter >= 5) {
    if (iron) {
      recs.push({
        id: "skill:iron-herb-birdhouse-loop",
        kind: "skill",
        title: "Run herbs + birdhouses",
        why: "Ironman supplies come from loops: herbs, nests, seeds and passive Hunter XP.",
        payoff: "Prayer pots, brews later, tree seeds and easy daily progress.",
        decisionReason: "Your Farming and Hunter already support the supply loop that keeps ironman progress moving.",
        score: 60,
        link: "/goals",
        iconItemId: 10092,
        routeTags: ["iron", "afk", "rebuild", "skiller"],
        gearConfidence: "not-needed",
        quality: {
          accountFit: 0.9,
          actionability: 0.9,
          stopPoint: 0.95,
          gearConfidence: 1,
          unlockValue: 0.82,
          fun: 0.62,
          friction: 0.14
        },
        planSeed: {
          timebox: "10-15 min",
          prep: "Bring seeds, compost, logs, clockworks and Fossil Island teleports.",
          steps: [
            "Do a herb run first, then reset all four birdhouses.",
            "Bank seeds/nests immediately so the next loop is ready.",
            "Stop after the loop; use the downtime for the main /next plan."
          ]
        }
      });
    } else {
      recs.push({
        id: "money:rebuild-herb-birdhouse-loop",
        kind: "money",
        title: "Run herbs + birdhouses",
        why: "Fast GP and passive Hunter XP without committing to a grind.",
        payoff: "A 10-minute loop can fund teleports, supplies and small upgrades.",
        decisionReason: "This is a practical rebuild loop: low setup, clear stop point, and useful even when you are unsure what to do.",
        score: 56,
        link: undefined,
        iconItemId: 10092,
        routeTags: ["gp", "afk", "rebuild", "returning"],
        gearConfidence: "not-needed",
        quality: {
          accountFit: 0.86,
          actionability: 0.92,
          stopPoint: 0.96,
          gearConfidence: 1,
          unlockValue: 0.7,
          fun: 0.6,
          friction: 0.12
        },
        planSeed: {
          timebox: "10-15 min",
          prep: "Bring seeds, ultracompost, birdhouse logs, clockworks and Fossil Island access.",
          steps: [
            "Clear herb patches, replant, then reset all four birdhouses.",
            "Sell herbs/nests only after checking whether an upgrade or quest supply stack needs them.",
            "Stop after one loop; this should support the main plan, not replace it."
          ]
        }
      });
    }
  }

  if (totalLevel >= 1700 && totalLevel < 2277) {
    const near99 = skills
      .filter((skill) => skill.name !== "Overall" && skill.level >= 90 && skill.level < 99)
      .sort((a, b) => b.level - a.level)[0];
    if (near99) {
      recs.push({
        id: `milestone:maxing-lane:${near99.name}`,
        kind: "milestone",
        title: `Pick a maxing lane: ${near99.name}`,
        why: `${near99.name} ${near99.level}. Close enough to turn spare sessions into cape progress.`,
        payoff: "A focused maxing lane stops /next from feeling like random chores.",
        decisionReason: `${near99.name} is your cleanest visible maxing lane, so it is a better long arc than bouncing between unrelated grinds.`,
        score: near99.level >= 95 ? 73 : 64,
        link: "/goals",
        iconItemId: skillCapeId(near99.name),
        routeTags: ["maxing", "afk", "skiller"],
        gearConfidence: "not-needed",
        quality: {
          accountFit: 0.82,
          actionability: 0.72,
          stopPoint: 0.66,
          gearConfidence: 1,
          unlockValue: 0.8,
          fun: 0.56,
          friction: near99.level >= 95 ? 0.24 : 0.42
        },
        planSeed: {
          timebox: "1-2 sessions",
          prep: `Choose one ${near99.name} method and stop at a level, XP chunk or cape prep milestone.`,
          steps: [
            `Train ${near99.name} only for this block; do not mix in random chores mid-session.`,
            "Use AFK if you are low-energy, or a faster method if you are focused.",
            "Re-run /next after the level; maxing routes should change as soon as the closest lane changes."
          ]
        }
      });
    }
  }

  return recs.sort((a, b) => b.score - a.score).slice(0, 6);
}

// ── Action-plan enrichment ──────────────────────────────────────────────────

interface ActionPlanContext {
  hasHiscores: boolean;
  hasBank: boolean;
  hasPluginSync: boolean;
  hasExactPluginSync: boolean;
}

function confidenceFor(rec: Recommendation, ctx: ActionPlanContext): RecommendationActionPlan["confidence"] {
  if (ctx.hasExactPluginSync && (rec.kind === "quest" || rec.kind === "diary" || rec.kind === "kc" || rec.kind === "slayer")) return "exact";
  if (ctx.hasHiscores && ctx.hasBank) return "likely";
  if (ctx.hasHiscores && (rec.kind === "quest" || rec.kind === "diary" || rec.kind === "skill" || rec.kind === "boss" || rec.kind === "money" || rec.kind === "minigame")) return "likely";
  if (ctx.hasBank && (rec.kind === "goal" || rec.kind === "bank")) return "likely";
  return "guided";
}

function confidenceLabel(confidence: RecommendationActionPlan["confidence"]): string {
  if (confidence === "exact") return "Synced";
  if (confidence === "likely") return "Likely fit";
  return "Guided";
}

function baseCaveat(rec: Recommendation, ctx: ActionPlanContext): string | undefined {
  if (!ctx.hasHiscores && ctx.hasBank) return "Add your RSN to turn this into stat-aware advice.";
  if (ctx.hasHiscores && !ctx.hasBank && (rec.kind === "boss" || rec.kind === "kc" || rec.kind === "goal")) return "Paste a bank when gear and item checks matter.";
  if (ctx.hasPluginSync && !ctx.hasExactPluginSync && (rec.kind === "quest" || rec.kind === "diary" || rec.kind === "kc" || rec.kind === "slayer")) {
    return "RuneLite sync is connected, but refresh or update it before relying on quests, diaries, collection log or Slayer for this pick.";
  }
  if (!ctx.hasPluginSync && (rec.kind === "quest" || rec.kind === "diary")) return "Quest and diary completion is inferred unless Scapestack Sync has this RSN.";
  return undefined;
}

function mergePlanSeed(
  rec: Recommendation,
  ctx: ActionPlanContext,
  fallback: Omit<RecommendationActionPlan, "confidence" | "confidenceLabel">
): RecommendationActionPlan {
  const confidence = confidenceFor(rec, ctx);
  const seeded = rec.planSeed ?? {};
  return {
    ...fallback,
    ...seeded,
    caveat: seeded.caveat ?? fallback.caveat ?? baseCaveat(rec, ctx),
    confidence,
    confidenceLabel: confidenceLabel(confidence)
  };
}

function actionPlanFor(rec: Recommendation, ctx: ActionPlanContext): RecommendationActionPlan {
  const bankStep = ctx.hasBank
    ? "Use your pasted bank to pull the gear, teleports and supplies for the trip."
    : "Paste your bank if you want Scapestack to verify the exact gear and supplies.";

  switch (rec.kind) {
    case "goal":
      return mergePlanSeed(rec, ctx, {
        timebox: "30-90 min",
        prep: "Treat this as the next unlock chase, not a vague collection note.",
        steps: [
          "Open the goal set and check the missing pieces.",
          bankStep,
          "Do one focused run/session for the nearest missing item, then re-sync or paste again."
        ]
      });
    case "quest":
      return mergePlanSeed(rec, ctx, {
        timebox: "1-3 hr",
        prep: "Quest first when it unlocks more bosses, diaries or travel than another bankstanding upgrade.",
        steps: [
          "Check the first unmet prerequisite before you start the guide.",
          "Bank required teleports, stamina/energy, food and combat gear before leaving the GE.",
          "Finish the quest or clear one prerequisite, then re-run /next for the unlocked follow-up."
        ]
      });
    case "diary":
      return mergePlanSeed(rec, ctx, {
        timebox: "45-120 min",
        prep: "Diary tiers are best done in batches: collect all items first, then sweep tasks region-by-region.",
        steps: [
          "Open the region checklist and mark any task you already know is done.",
          "Bank teleports, skill boosts and task items for the whole tier.",
          "Complete the shortest travel cluster first, then clean up the combat/minigame task last."
        ]
      });
    case "boss":
      return mergePlanSeed(rec, ctx, {
        timebox: "30-60 min",
        prep: "Make this a scouting trip: prove the setup, then decide if it becomes a grind.",
        steps: [
          "Open the DPS view and use the best setup Scapestack can find from your bank.",
          "Bring supplies for 3-5 kills, not a marathon, so mistakes are cheap.",
          "After the test trip, compare kill time and supply cost before buying upgrades."
        ]
      });
    case "kc":
      return mergePlanSeed(rec, ctx, {
        timebox: "45-120 min",
        prep: "This is a drop-chance session: decide the KC block before you start so dryness doesn't tilt the plan.",
        steps: [
          "Open the boss detail and sanity-check the owned setup.",
          "Run a fixed KC block (10, 25 or 50 kills depending on boss length).",
          "Re-sync after the block so the dry-rate and collection-log state update."
        ]
      });
    case "minigame":
      return mergePlanSeed(rec, ctx, {
        timebox: "30-90 min",
        prep: "Minigames are unlock engines: do a small token/reward target, not an endless queue.",
        steps: [
          "Check the world/activity requirements before gearing.",
          "Set a one-session target: one reward roll, one outfit piece, or one level bracket.",
          "Stop after the target and let /next re-rank the account."
        ]
      });
    case "money":
      return mergePlanSeed(rec, ctx, {
        timebox: "30-60 min",
        prep: "Use this to fund the next unlock, not as permanent autopilot.",
        steps: [
          "Check current GE margins/supply prices before committing.",
          "Do one measured hour or half-hour and note real profit after supplies.",
          "Spend the cash on the highest-impact upgrade or quest supply stack next."
        ]
      });
    case "slayer":
      return mergePlanSeed(rec, ctx, {
        timebox: "20-60 min",
        prep: "This is live client state: finish the assignment already in front of you before starting a new grind.",
        steps: [
          "Open /slayer and verify the current task, blocks and best master.",
          "Bank the correct protection item, teleports and cannon/burst supplies if relevant.",
          "Finish or deliberately skip the task, then let the plugin sync the next assignment."
        ]
      });
    case "skill":
      return mergePlanSeed(rec, ctx, {
        timebox: "30-120 min",
        prep: "Push the unlock level, not random XP — stop when the account state changes.",
        steps: [
          "Choose the fastest method you can tolerate for this session length.",
          "Bank or buy the supplies for exactly the levels needed to unlock the milestone.",
          "Re-run /next once the level lands so quests/diaries/bosses unlock immediately."
        ]
      });
    case "bank":
      return mergePlanSeed(rec, ctx, {
        timebox: "10-20 min",
        prep: "Bank work pays off when it removes friction from every later trip.",
        steps: [
          "Open Gear & Bank and export the clean RuneLite tabs.",
          "Decant potions, recharge jewellery and move obvious junk before the next PvM/skilling run.",
          "Save the cleaned bank so future /next runs compare against the new baseline."
        ]
      });
    case "milestone":
      return mergePlanSeed(rec, ctx, {
        timebox: "Long-term",
        prep: "Treat this as the account arc; tonight's job is only the next blocker.",
        steps: [
          "Open the path overview and identify the closest incomplete lane.",
          "Clear one blocker that unlocks multiple downstream tasks.",
          "Pin the milestone mentally, but re-run /next after every major unlock."
        ]
      });
  }
}

function decisionReasonFor(rec: Recommendation, ctx: ActionPlanContext): string {
  if (rec.decisionReason) return rec.decisionReason;
  if (ctx.hasExactPluginSync && (rec.kind === "quest" || rec.kind === "diary" || rec.kind === "kc" || rec.kind === "slayer")) {
    return "RuneLite skipped finished quests, diary steps, clog slots and Slayer mistakes for this pick.";
  }
  if (!ctx.hasBank && (rec.kind === "boss" || rec.kind === "kc")) {
    return "No bank was pasted, so gear advice stays conservative until you add gear.";
  }
  if (rec.payoff) return rec.payoff;
  return rec.why;
}

function withActionPlans(recs: Recommendation[], ctx: ActionPlanContext): Recommendation[] {
  return recs.map((rec) => {
    const {
      planSeed: _planSeed,
      quality: _quality,
      gearConfidence: _gearConfidence,
      ...clean
    } = rec;
    return {
      ...clean,
      actionPlan: actionPlanFor(rec, ctx),
      decisionReason: decisionReasonFor(clean, ctx)
    };
  });
}

const VISIBLE_RECOMMENDATION_COUNT = 8;
const VISIBLE_KIND_LIMITS: Partial<Record<RecKind, number>> = {
  diary: 1,
  money: 2,
  skill: 2,
  boss: 2,
  kc: 2,
  goal: 2,
  quest: 2,
  slayer: 1,
  bank: 1,
  minigame: 1
};

function prioritizeVisibleRecommendations(sortedRecs: Recommendation[]): Recommendation[] {
  if (sortedRecs.length <= VISIBLE_RECOMMENDATION_COUNT) return sortedRecs;

  const selected: Recommendation[] = [];
  const selectedIds = new Set<string>();
  const kindCounts = new Map<RecKind, number>();
  const add = (rec: Recommendation): void => {
    selected.push(rec);
    selectedIds.add(rec.id);
    kindCounts.set(rec.kind, (kindCounts.get(rec.kind) ?? 0) + 1);
  };

  add(sortedRecs[0]);
  for (const rec of sortedRecs.slice(1)) {
    if (selected.length >= VISIBLE_RECOMMENDATION_COUNT) break;
    const limit = VISIBLE_KIND_LIMITS[rec.kind] ?? 2;
    if ((kindCounts.get(rec.kind) ?? 0) >= limit) continue;
    add(rec);
  }

  for (const rec of sortedRecs) {
    if (selected.length >= VISIBLE_RECOMMENDATION_COUNT) break;
    if (!selectedIds.has(rec.id)) add(rec);
  }

  return [
    ...selected,
    ...sortedRecs.filter((rec) => !selectedIds.has(rec.id))
  ];
}

function mergeCompletionItems(
  bank: CompletionItem[],
  earnedItems: CompletionItem[]
): CompletionItem[] {
  const merged = [...bank];
  const seen = new Set(merged.map((item) => item.id));
  for (const item of earnedItems) {
    if (!seen.has(item.id)) {
      merged.push(item);
      seen.add(item.id);
    }
  }
  return merged;
}

// ── Engine ──────────────────────────────────────────────────────────────────

export async function computeNextUp(input: NextUpInput): Promise<NextUpResult> {
  const skills = input.skills ?? [];
  const bank = input.bank ?? [];
  const goalItems = mergeCompletionItems(bank, input.earnedItems ?? []);
  const qp = input.questPoints ?? 0;
  const hasHiscores = skills.length > 0;
  const hasBank = bank.length > 0;

  const combatLevel = hasHiscores ? computeCombatLevel(skills) : null;
  const totalLevel = hasHiscores ? computeTotalLevel(skills) : null;

  // Goal completion needs *something* to check against. Hiscores alone can
  // satisfy skill-cape goals (via the virtual-cape synthesis in goals.ts);
  // a bank satisfies item goals. We feed whichever we have.
  const completions = (goalItems.length > 0 || hasHiscores)
    ? checkCompletion(goalItems)
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

  // Collection-log owned-item set (cl.net). Rebuild from the input
  // array — the action layer flattens it to a list because Set isn't
  // structured-clone-safe across the server/client boundary.
  const clOwned = input.collectionLogOwnedItemIds
    ? new Set(input.collectionLogOwnedItemIds)
    : undefined;

  const completedQuestNames = input.scapestackSync
    ? new Set(input.scapestackSync.questsCompleted.map((q) => q.toLowerCase()))
    : input.templeQuestsCompleted
      ? new Set(input.templeQuestsCompleted.map((q) => q.toLowerCase()))
      : undefined;

  // Boss KCs: merge Hiscores + WOM via max — WOM is often fresher
  // because the RuneLite plugin pushes more often than Jagex updates.
  const mergedBossKc: Record<string, number> = { ...(input.bossKc ?? {}) };
  if (input.womBossKills) {
    // WOM uses snake_case names; the engine + drop-tables use the Wiki
    // form. We seed the merged map with WOM data under the SAME keys
    // we use elsewhere (drop-rates-db's `hiscoresName`). The path-
    // progress bossesPath already does this merge for its own consumer.
    // Here we trust input.bossKc as the canonical source; WOM keys are
    // not directly mappable without a lookup table, so we leave merging
    // to the path-progress layer that has both.
  }

  const pluginSyncState = input.syncedSources?.scapestack
    ? pluginSyncHealth({
        pluginVersion: input.syncedSources.scapestack.pluginVersion,
        syncedAt: input.syncedSources.scapestack.syncedAt
      })
    : input.scapestackSync
      ? "live"
      : null;
  const hasPluginSync = Boolean(input.scapestackSync);
  const accountStage = detectAccountStage({
    skills,
    combatLevel,
    totalLevel,
    questPoints: qp,
    bossKc: mergedBossKc,
    accountMeta: input.accountMeta ?? null,
    hasBankContext: hasBank,
    hasPluginSync: pluginSyncState === "live"
  });

  const rawRecs = [
    ...goalRecs(completions),
    ...(combatLevel !== null ? bossRecs(combatLevel, bank, skills, mergedBossKc) : []),
    ...slayerTaskRecs(input.scapestackSync?.slayer, input.scapestackSync?.displayName ?? input.accountMeta?.displayName),
    ...questRecs(quests, skills, qp, completedQuestNames),
    ...activeBossKcRecs(mergedBossKc, bank, skills),
    ...diaryRecs(diaries, skills),
    ...kcRecs(dropTables, mergedBossKc, bank, clOwned),
    ...minigameRecs(skills),
    ...moneyRecs(skills, input.accountMeta),
    ...skillRecs(skills),
    ...accountRouteRecs({
      skills,
      questPoints: qp,
      accountStage,
      accountMeta: input.accountMeta ?? null,
      completedQuestNames
    }),
    ...starterQuestRecs(hasHiscores, bank),
    ...bankRecs(bank),
    // No-Hiscores nudge: when the player only gave a bank, lead with "add
    // your RSN" rather than letting "Tidy your bank" become the headline.
    ...(!hasHiscores && hasBank ? [noHiscoresNudge()] : [])
  ];
  const sortedRecs = rankRecommendations(rawRecs, {
    hasBank,
    accountStage,
    accountMeta: input.accountMeta ?? null
  });
  const recs: Recommendation[] = withActionPlans(prioritizeVisibleRecommendations(sortedRecs), {
    hasHiscores,
    hasBank,
    hasPluginSync,
    hasExactPluginSync: pluginSyncState === "live"
  });

  const basis: NextUpResult["summary"]["basis"] =
    hasHiscores && hasBank ? "full"
    : hasHiscores ? "hiscores-only"
    : hasBank ? "bank-only"
    : "none";

  // Path-to-Max progress — drives the new path-card UI. Cheap to compute
  // (no extra disk reads; quests/diaries are already loaded above) and
  // always populated even when data is sparse. WOM + Temple + cl.net
  // enrichments are all optional; when missing we fall back to
  // Hiscores-only behaviour.
  const pathProgress: PathOverview = computePathProgress({
    skills,
    quests,
    diaries,
    bossKc: input.bossKc ?? {},
    questPoints: qp,
    womBossKills: input.womBossKills,
    accountMeta: input.accountMeta ?? null,
    templeQuestsCompleted: input.templeQuestsCompleted
      ? new Set(input.templeQuestsCompleted)
      : undefined,
    collectionLogOwnedItemIds: clOwned,
    scapestackSync: input.scapestackSync ? {
      questsCompleted: new Set(input.scapestackSync.questsCompleted.map((q) => q.toLowerCase())),
      diariesCompleted: new Set(input.scapestackSync.diariesCompleted.map((d) => `${d.region}:${d.tier}`)),
      collectionLogItemIds: new Set(input.scapestackSync.collectionLogItemIds)
    } : undefined,
    syncedSources: input.syncedSources
  });

  // Readiness chips — top 6 sets die dichtsbij voltooien zijn (oftewel:
  // "je hebt al de meeste pieces, deze paar items missen nog"). Lege
  // array als geen bank gepasted is — chips renderen niet.
  const readiness = completions.length > 0
    ? closestToComplete(completions, 6)
    : [];

  // Hours-to-max — alleen wanneer Hiscores geladen zijn (vereist xp
  // per skill). Lege summary als skills leeg.
  const maxEstimate = hasHiscores
    ? hoursToMax(skills.map((s) => ({ name: s.name, level: s.level, xp: s.xp })))
    : { totalHours: 0, perSkill: [] };

  return {
    headline: recs[0] ?? null,
    rest: recs.slice(1),
    summary: { combatLevel, totalLevel, goalPercent, accountStage, basis },
    pathProgress,
    readiness,
    maxEstimate
  };
}
