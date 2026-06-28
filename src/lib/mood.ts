// Mood-driven re-ranking laag boven computeNextUp().
//
// Filosofie: de bestaande recommendation-engine kent al alle gaps die
// een speler kan adresseren. Wat hij niet kan: "wat past bij jouw mood
// vanavond." Dat doen we hier — we boosten of penalizen scores op
// basis van mood + tijdbudget, dan kiezen we de 1 beste + 2 alts.
//
// Intent presets:
//   chill     - low effort without forcing PvM
//   cash      - GP and upgrade funding
//   bossing   - PvM/KC when the account actually supports it
//   unlock    - quests, diaries, goals and Slayer unlocks
//   afk       - skilling/minigames with minimal attention
//   short     - fast sessions with clean stop points
//   focused   - legacy route alias for older links
//   quest     - legacy route alias for older links
//
// Tijdbudget: 15 / 30 / 60 / 120 minuten. Beïnvloedt of we lange-zware
// dingen (Inferno) of korte-makkelijke dingen (clue scroll) aanraden.

import type { Recommendation, RecommendationRouteTag, RecKind } from "./next-up";

export type Mood = "chill" | "focused" | "cash" | "quest" | "bossing" | "unlock" | "afk" | "short";

/** A route lens is broader than a mood. Mood answers "what pace do I want?";
 *  route answers "what kind of account story should this session move?".
 *  `Try another` cycles these lenses so it can surface maxing, fun-progress,
 *  GP and boss-log angles instead of showing the same six mood labels. */
export type RouteLens =
  | "smart"
  | "maxing"
  | "fun"
  | "unlock-chain"
  | "gp-upgrade"
  | "boss-log"
  | "afk-progress";

export const ROUTE_LENS_ORDER: RouteLens[] = [
  "smart",
  "maxing",
  "fun",
  "unlock-chain",
  "gp-upgrade",
  "boss-log",
  "afk-progress"
];

export const ROUTE_LENS_LABEL: Record<RouteLens, { itemId: number; name: string; tagline: string }> = {
  smart:        { itemId: 995,   name: "Best now",     tagline: "The cleanest move for this login" },
  maxing:       { itemId: 13342, name: "Maxing week",  tagline: "Cape, diary, quest and total-level progress" },
  fun:          { itemId: 20720, name: "Fun session",  tagline: "Rewards, KC or minigames without chores" },
  "unlock-chain": { itemId: 9813,  name: "Iron unlock",  tagline: "Quest, diary and account unlock chain" },
  "gp-upgrade":   { itemId: 995,   name: "GP rebuild",   tagline: "Fund the next upgrade or supply stack" },
  "boss-log":     { itemId: 4151,  name: "Boss log",     tagline: "KC, clog and PvM proof route" },
  "afk-progress": { itemId: 12012, name: "AFK progress", tagline: "Low-attention progress that still matters" }
};

/** Hoeveel minuten heeft de speler te besteden. Gebruikt om bv. een
 *  3u boss-grind af te wijzen voor een 15min sessie. */
export type TimeBudget = 15 | 30 | 60 | 120;

/** Per-mood boosts/penalties per RecKind. Waardes zijn vermenigvuldigers
 *  bovenop de base score. 1.0 = ongewijzigd, 1.5 = +50%, 0.4 = -60%. */
const MOOD_KIND_WEIGHTS: Record<Mood, Partial<Record<RecKind, number>>> = {
  chill: {
    skill:    1.6,
    bank:     1.3,  // bank-hygiene is lekker mindless
    minigame: 1.2,  // Tempoross etc.
    slayer:   0.9,
    money:    0.9,
    boss:     0.15,
    kc:       0.15,
    quest:    0.45,
    diary:    0.6,
  },
  focused: {
    boss:     1.5,
    kc:       1.4,  // KC-drop chasing = focused activity
    slayer:   1.4,  // live task afmaken = duidelijke focused sessie
    skill:    1.2,  // PvM-skills lift
    minigame: 1.0,
    quest:    0.8,
    bank:     0.4,
  },
  cash: {
    money:    2.0,  // direct: money-recommendations winnen altijd
    boss:     1.4,  // PvM = vaak grote drops
    kc:       1.3,
    slayer:   0.9,  // kan geld opleveren, maar niet primair GP/u
    skill:    0.7,  // skill-grinding niet primary cash route
    quest:    0.5,
    bank:     0.6,
  },
  quest: {
    quest:    2.0,
    diary:    1.5,  // diaries vaak quest-locked
    goal:     1.3,  // bv. quest cape goal
    milestone:1.3,
    slayer:   0.7,
    skill:    0.8,
    boss:     0.6,
    kc:       0.5,
    bank:     0.5,
  },
  bossing: {
    boss:     2.0,
    kc:       1.9,
    slayer:   1.25,
    money:    0.9,
    minigame: 0.7,
    skill:    0.45,
    quest:    0.45,
    diary:    0.55,
    bank:     0.35,
    goal:     0.75,
  },
  unlock: {
    quest:    1.9,
    diary:    1.75,
    goal:     1.55,
    milestone:1.45,
    slayer:   1.15,
    skill:    1.05,
    minigame: 1.0,
    boss:     0.45,
    kc:       0.45,
    money:    0.65,
    bank:     0.55,
  },
  afk: {
    skill:    2.0,
    minigame: 1.45,
    bank:     1.3,
    money:    0.75,
    slayer:   0.7,
    goal:     0.7,
    quest:    0.35,
    diary:    0.45,
    boss:     0.08,
    kc:       0.08,
  },
  short: {
    bank:     1.85,
    slayer:   1.35,
    money:    1.3,
    minigame: 1.15,
    skill:    0.95,
    goal:     0.95,
    diary:    0.8,
    quest:    0.55,
    boss:     0.18,
    kc:       0.18,
  }
};

const ROUTE_LENS_KIND_WEIGHTS: Record<RouteLens, Partial<Record<RecKind, number>>> = {
  smart: {},
  maxing: {
    milestone: 2.15,
    skill: 2.0,
    diary: 1.65,
    quest: 1.45,
    goal: 1.35,
    slayer: 1.05,
    minigame: 0.9,
    bank: 0.65,
    money: 0.45,
    boss: 0.5,
    kc: 0.5
  },
  fun: {
    minigame: 2.5,
    boss: 2.0,
    kc: 2.0,
    slayer: 1.25,
    skill: 1.18,
    quest: 0.7,
    diary: 0.7,
    goal: 0.9,
    money: 0.85,
    bank: 0.55
  },
  "unlock-chain": {
    quest: 2.15,
    diary: 1.95,
    goal: 1.55,
    milestone: 1.45,
    slayer: 1.1,
    skill: 1.0,
    minigame: 0.8,
    money: 0.6,
    boss: 0.45,
    kc: 0.45,
    bank: 0.55
  },
  "gp-upgrade": {
    money: 2.35,
    boss: 1.4,
    kc: 1.3,
    slayer: 1.0,
    bank: 0.8,
    skill: 0.75,
    minigame: 0.7,
    goal: 0.65,
    diary: 0.55,
    quest: 0.5
  },
  "boss-log": {
    kc: 2.25,
    boss: 2.05,
    slayer: 1.35,
    money: 0.85,
    goal: 0.8,
    minigame: 0.7,
    skill: 0.45,
    diary: 0.45,
    quest: 0.4,
    bank: 0.35
  },
  "afk-progress": {
    skill: 2.25,
    minigame: 1.55,
    bank: 1.35,
    money: 0.85,
    goal: 0.75,
    slayer: 0.65,
    diary: 0.55,
    quest: 0.45,
    boss: 0.08,
    kc: 0.08
  }
};

/** Tijd-budget filter — schaarser dan voorheen. Elke kind heeft een
 *  realistische min/max sessie-tijd; als de gekozen budget buiten die
 *  range valt, krijgt de rec een serieuze penalty (down to 0.15).
 *
 *  Filosofie: liever 5 goede recs voor 15 min dan 5 abstracte. Een
 *  Inferno-rec bij 15min budget is gewoon niet relevant.
 *
 *  Daily-style money recs hebben de smalste range (5-15 min) zodat ze
 *  niet je 2u sessie volpompen.
 */
function timeBudgetFit(rec: Recommendation, minutes: TimeBudget): number {
  // [minViable, sweetSpot, maxComfortable] per kind. Buiten min/max =
  // harde penalty (0.15-0.4). In de range = soft curve naar 1.4 piek.
  const ranges: Record<RecKind | "default", [number, number, number]> = {
    bank:      [5,  20, 30],   // klusje, niet voor lange sessie
    minigame:  [10, 30, 60],   // round-based
    diary:     [15, 45, 90],   // tier voltooien
    money:     [10, 30, 60],   // herb runs, daily, GP-pulses
    skill:     [30, 90, 180],  // grinding works at any length above 30
    slayer:    [10, 45, 120],  // current-task remainder via plugin
    boss:      [45, 90, 180],  // trip incl. travel + bank
    kc:        [45, 90, 180],  // drop chase = lange sessie
    quest:     [30, 90, 180],  // te kort = onaf, te lang = burnout
    goal:      [15, 60, 180],  // breed: zowel een quest cape als skill cape
    milestone: [15, 60, 180],
    default:   [15, 60, 120],
  };
  const [low, spot, high] = ranges[rec.kind] ?? ranges.default;
  // Out-of-range: harde penalty (15min sessie + 2u boss = 0.15).
  if (minutes < low) {
    const ratio = minutes / low;
    return Math.max(0.15, 0.5 * ratio);
  }
  if (minutes > high) {
    const ratio = high / minutes;
    return Math.max(0.25, 0.7 * ratio);
  }
  // In range — driehoek-curve met piek op sweet spot, floor 0.85.
  const distToSpot = Math.abs(minutes - spot);
  const halfRange = Math.max(spot - low, high - spot);
  const proximity = 1 - distToSpot / halfRange;
  return 0.85 + 0.55 * proximity; // 0.85 .. 1.4
}

function isScoutKc(rec: Recommendation): boolean {
  if (rec.kind !== "kc") return false;
  const kc = rec.kcMeta?.kc;
  if (typeof kc === "number" && kc > 0 && kc < 5) return true;
  return `${rec.why} ${rec.decisionReason ?? ""}`.toLowerCase().includes("scout read");
}

function accountFitMultiplier(rec: Recommendation, mood: Mood): number {
  if (!isScoutKc(rec)) return 1;

  // A 1-4 KC boss read is useful context, but it should feel like a
  // backup test trip, not the app confidently telling a player to camp it.
  if (mood === "bossing" || mood === "focused") return 0.55;
  if (mood === "cash") return 0.45;
  if (mood === "short") return 0.3;
  return 0.2;
}

function routeLensMultiplier(rec: Recommendation, lens: RouteLens): number {
  const base = ROUTE_LENS_KIND_WEIGHTS[lens][rec.kind] ?? 1;
  if (lens === "smart") return base;

  const text = `${rec.title} ${rec.why} ${rec.payoff ?? ""} ${rec.decisionReason ?? ""}`.toLowerCase();
  let bonus = 1;
  const hasTag = (tag: RecommendationRouteTag): boolean => rec.routeTags?.includes(tag) ?? false;

  if (lens === "maxing") {
    if (hasTag("maxing")) bonus *= 1.34;
    if (hasTag("skiller")) bonus *= 1.08;
    if (/\b99\b|cape|max|diary|quest cape|total level/.test(text)) bonus *= 1.28;
    if (rec.kind === "milestone") bonus *= 1.18;
  }

  if (lens === "fun") {
    if (hasTag("fun")) bonus *= 1.34;
    if (hasTag("pvm")) bonus *= 1.12;
    if (rec.kind === "minigame" || rec.kind === "boss" || rec.kind === "kc") bonus *= 1.16;
    if (/try|trip|kc|reward|drop|clog/.test(text)) bonus *= 1.08;
  }

  if (lens === "unlock-chain") {
    if (hasTag("unlock")) bonus *= 1.34;
    if (hasTag("returning") || hasTag("iron")) bonus *= 1.08;
    if (/unlock|diary|quest|prereq|cape|reward/.test(text)) bonus *= 1.16;
  }

  if (lens === "gp-upgrade") {
    if (hasTag("gp") || hasTag("rebuild")) bonus *= 1.34;
    if (/gp\/hr|gp|fund|upgrade|loot|profit|cash/.test(text)) bonus *= 1.16;
  }

  if (lens === "boss-log") {
    if (hasTag("pvm") || hasTag("slayer")) bonus *= 1.3;
    if (/kc|clog|drop|boss|slayer|task|trip/.test(text)) bonus *= 1.16;
  }

  if (lens === "afk-progress") {
    if (hasTag("afk") || hasTag("skiller")) bonus *= 1.34;
    if (/afk|chill|run|cape|level|skill/.test(text)) bonus *= 1.12;
  }

  return base * bonus;
}

type BackupBucket = "low-effort" | "gp" | "active" | "unlock";

function backupBucket(rec: Recommendation): BackupBucket {
  if (rec.kind === "money") return "gp";
  if (rec.kind === "boss" || rec.kind === "kc" || rec.kind === "slayer") return "active";
  if (rec.kind === "skill" || rec.kind === "bank" || rec.kind === "minigame") return "low-effort";
  return "unlock";
}

function backupBucketOrder(headline: Recommendation): BackupBucket[] {
  switch (backupBucket(headline)) {
    case "active":
      return ["low-effort", "gp", "unlock", "active"];
    case "gp":
      return ["low-effort", "unlock", "active", "gp"];
    case "low-effort":
      return ["active", "unlock", "gp", "low-effort"];
    case "unlock":
      return ["low-effort", "gp", "active", "unlock"];
  }
}

export interface MoodPick {
  /** De hoofdsuggestie — top na re-scoring. */
  headline: Recommendation;
  /** 2 alternatieven — ook hoog gerankt, maar van een andere kind
   *  dan headline (zodat de gebruiker écht alternatieven ziet, niet
   *  drie skill-recs op een rij). */
  alternatives: Recommendation[];
  /** Voor transparantie: wat was de mood + tijd waarop dit getuned is. */
  mood: Mood;
  minutes: TimeBudget;
  routeLens: RouteLens;
  routeLabel: string;
  routeHelper: string;
}

export interface RoutePickOptions {
  /** Session-only skips from "Try another". Values are skip counts; a card
   *  clicked away twice gets demoted harder than a card skipped once. */
  skippedIds?: Record<string, number> | string[];
  /** The last headline kind the player moved away from. Used as a light
   *  novelty guard so Try another does not feel like quest -> quest -> quest. */
  previousKind?: RecKind | null;
  /** The last headline id the player moved away from. Stronger than kind. */
  previousId?: string | null;
}

function skippedCount(skippedIds: RoutePickOptions["skippedIds"], id: string): number {
  if (!skippedIds) return 0;
  if (Array.isArray(skippedIds)) return skippedIds.includes(id) ? 1 : 0;
  return skippedIds[id] ?? 0;
}

function sessionNoveltyMultiplier(rec: Recommendation, options: RoutePickOptions | undefined): number {
  if (!options) return 1;
  let multiplier = 1;
  const count = skippedCount(options.skippedIds, rec.id);
  if (count > 0) {
    multiplier *= Math.max(0.12, Math.pow(0.38, Math.min(count, 4)));
  }
  if (options.previousId && rec.id === options.previousId) {
    multiplier *= 0.1;
  }
  if (options.previousKind && rec.kind === options.previousKind) {
    multiplier *= 0.35;
  }
  return multiplier;
}

/** Hoofdfunctie: ranked recs in, mood + tijd erbij, één hoofdpick +
 *  twee alternatieven uit. Wanneer er minder dan 3 recs zijn, vult
 *  alternatives met wat er overblijft.
 *
 *  shuffleIndex: 0 = absolute top; 1 = "geef me wat anders" (skip
 *  het #1 picked, pak #2). Diversity-rule: shuffle moet ook een
 *  ander kind opleveren tov de huidige headline — niet "boss
 *  vorkath" → "boss kbd". */
export function pickForMood(
  recs: Recommendation[],
  mood: Mood,
  minutes: TimeBudget,
  shuffleIndex: number = 0
): MoodPick | null {
  return pickForRoute(recs, mood, minutes, "smart", shuffleIndex);
}

/** Route-aware planner picker. A route lens is intentionally stronger than
 *  mood because it answers a different user request: "show me a maxing
 *  route" should actually beat the default unlock/chill bias. Mood still
 *  matters as a pacing/timing guard, but it no longer traps Try another in
 *  the same visible six labels. */
export function pickForRoute(
  recs: Recommendation[],
  mood: Mood,
  minutes: TimeBudget,
  routeLens: RouteLens = "smart",
  shuffleIndex: number = 0,
  options?: RoutePickOptions
): MoodPick | null {
  if (recs.length === 0) return null;
  const weights = MOOD_KIND_WEIGHTS[mood];
  const route = ROUTE_LENS_LABEL[routeLens];

  const scored = recs.map((rec) => {
    const moodMult = weights[rec.kind] ?? 1.0;
    const kindMult = routeLens === "smart"
      ? moodMult
      : Math.max(0.32, Math.sqrt(moodMult)) * routeLensMultiplier(rec, routeLens);
    const timeMult = timeBudgetFit(rec, minutes);
    const accountMult = accountFitMultiplier(rec, mood);
    const noveltyMult = sessionNoveltyMultiplier(rec, options);
    return { rec, adjScore: rec.score * kindMult * timeMult * accountMult * noveltyMult };
  });
  scored.sort((a, b) => b.adjScore - a.adjScore);

  // Shuffle: bouw een lijst van "hero-kandidaten" waar elke
  // opeenvolgende een ander kind heeft dan z'n voorganger. Dat
  // voorkomt "boss → boss → boss" als de speler op de shuffle-knop
  // ramt.
  const heroCandidates: Recommendation[] = [];
  const usedKinds = new Set<RecKind>();
  for (const s of scored) {
    if (!usedKinds.has(s.rec.kind)) {
      heroCandidates.push(s.rec);
      usedKinds.add(s.rec.kind);
    }
  }
  // Als de speler verder shuffled dan we kinds hebben → cycle terug
  // door alle scored recs (zelfde kind mag dan terugkomen).
  const fallbackList = scored.map((s) => s.rec);
  const headline =
    heroCandidates[shuffleIndex % Math.max(1, heroCandidates.length)]
    ?? fallbackList[shuffleIndex % fallbackList.length]
    ?? scored[0].rec;

  // Alternatieven: kies bewust een andere sessie-beloning/intensiteit.
  // Dit voorkomt dat backups voelen als "de rest van de sortering".
  const alts: Recommendation[] = [];
  const seenIds = new Set([headline.id]);
  const seenBuckets = new Set<BackupBucket>();
  const bucketOrder = backupBucketOrder(headline);
  for (const bucket of bucketOrder) {
    if (alts.length === 2) break;
    const next = scored.find((s) => !seenIds.has(s.rec.id)
      && backupBucket(s.rec) === bucket
      && !seenBuckets.has(bucket))?.rec;
    if (!next) continue;
    alts.push(next);
    seenIds.add(next.id);
    seenBuckets.add(bucket);
  }
  // Vul aan met wat-dan-ook (zelfde kind mag) als we minder dan 2 hebben.
  for (const r of fallbackList) {
    if (alts.length === 2) break;
    if (!seenIds.has(r.id)) {
      alts.push(r);
      seenIds.add(r.id);
    }
  }

  return {
    headline,
    alternatives: alts,
    mood,
    minutes,
    routeLens,
    routeLabel: route.name,
    routeHelper: route.tagline
  };
}

/** Mood labels met OSRS item-icons. De player-facing set is bewust klein:
 *  Chill / GP / Bossing / Unlock / AFK / Short. Legacy labels blijven
 *  bestaan voor oude links en opgeslagen voorkeuren. */
export const MOOD_LABEL: Record<Mood, { itemId: number; name: string; tagline: string }> = {
  chill:   { itemId: 6739,  name: "Chill",   tagline: "Low effort, no sweaty PvM" },
  focused: { itemId: 21295, name: "Focused", tagline: "Legacy focused route" },
  cash:    { itemId: 995,   name: "GP",      tagline: "Fund the next upgrade" },
  quest:   { itemId: 9813,  name: "Quest",   tagline: "Legacy unlock route" },
  bossing: { itemId: 4151,  name: "Bossing", tagline: "Trip, KC, or PvM proof" },
  unlock:  { itemId: 9813,  name: "Unlock",  tagline: "Quests, diaries, goals" },
  afk:     { itemId: 12012, name: "AFK",     tagline: "Progress while chilling" },
  short:   { itemId: 8007,  name: "Short",   tagline: "Quick win, clean stop" }
};
