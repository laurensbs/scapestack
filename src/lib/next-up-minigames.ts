// Minigame unlocks for the /next engine.
//
// A minigame becomes a suggestion the moment its skill requirements are met.
// These score modestly on purpose — they are variety, not progression.
//
// A curated list of high-value OSRS minigames with their primary skill gate.
// `gateSkill` + `gateLevel` is the level at which the minigame becomes
// playable / interesting; `iconItemId` ties each entry to a signature reward
// or related item so the card shows a real OSRS sprite. Slugs are stable
// strings used for the recommendation id.
//
// Curation rules: prefer community-staple activities (Wintertodt for FM XP,
// GoTR for RC, Pyramid Plunder for Thieving) over fringe content; surface
// each minigame once, around the level it first becomes a sensible chase.

import { computeCombatLevel, computeTotalLevel, type HiscoreSkill } from "./hiscores";
import { lvl } from "./next-up-shared";
import {
  accessNeedsLine,
  accessScoreMultiplier,
  evaluateAccess,
  type AccessContext
} from "./content-access";
import { MINIGAME_ACCESS } from "./content-access-data";
import type { Recommendation } from "./next-up-types";

interface Minigame {
  slug: string;
  name: string;
  /** What the window measures. "Combat" is valid and means the combat level. */
  gateSkill: string;
  /** The level at which the minigame opens. */
  gateLevel: number;
  /**
   * The level past which it stops being a sensible chase.
   *
   * This used to be gateLevel + 25 for everything, which made one number do two
   * jobs and got both wrong. Because the highest gate in the list is Agility 52,
   * no minigame was ever offered above level 77 in its own gate skill — an
   * all-80 account got zero of them — while four were only ever shown *below*
   * the level at which their own stated payoff exists. Wintertodt's card says
   * "the fastest path from 50 to 99 Firemaking" and it was hidden for the top
   * 24 levels of exactly that range.
   */
  relevantUntil: number;
  /** A second bar the game imposes that a skill level cannot express. */
  totalLevelRequired?: number;
  why: string;
  payoff: string;
  iconItemId: number;
}

const MINIGAMES: Minigame[] = [
  { slug: "wintertodt", name: "Wintertodt", gateSkill: "Firemaking", gateLevel: 50, relevantUntil: 99,
    why: "The fastest path from 50 to 99 Firemaking, with rolls for the Pyromancer outfit.",
    payoff: "Pyromancer outfit + Phoenix pet + Bruma torch", iconItemId: 20720 },
  { slug: "tempoross", name: "Tempoross", gateSkill: "Fishing", gateLevel: 35, relevantUntil: 99,
    why: "Solid Fishing XP plus rewards you can't earn anywhere else.",
    payoff: "Spirit angler outfit + Tackle box + Big harpoonfish pet", iconItemId: 25588 },
  { slug: "gotr", name: "Guardians of the Rift", gateSkill: "Runecraft", gateLevel: 27, relevantUntil: 99,
    why: "By far the best Runecraft XP and the only source of the Raiments of the Eye.",
    payoff: "Abyssal lantern + Hat of the Eye + Abyssal Protector pet", iconItemId: 26850 },
  { slug: "mahogany-homes", name: "Mahogany Homes", gateSkill: "Construction", gateLevel: 20, relevantUntil: 80,
    why: "Construction XP without burning planks at home, plus the carpenter outfit.",
    payoff: "Carpenter outfit (+2.5% Construction XP) + Plank sack", iconItemId: 24882 },
  { slug: "pyramid-plunder", name: "Pyramid Plunder", gateSkill: "Thieving", gateLevel: 21, relevantUntil: 99,
    why: "The fastest Thieving XP in the game from 71+, and gems on the way.",
    payoff: "Pharaoh's sceptre + Top-tier Thieving XP/hr", iconItemId: 9044 },
  { slug: "volcanic-mine", name: "Volcanic Mine", gateSkill: "Mining", gateLevel: 50, relevantUntil: 99,
    why: "Top Mining XP from 60+ and the only source of Volcanic shards.",
    payoff: "Dragon pickaxe upgrade kits + 200k+ Mining XP/hr", iconItemId: 27695 },
  { slug: "hallowed-sepulchre", name: "Hallowed Sepulchre", gateSkill: "Agility", gateLevel: 52, relevantUntil: 99,
    why: "Strong Agility XP with tradeable loot; actual profit moves with current prices.",
    payoff: "Dark dye + Ring of endurance + Hallowed outfit", iconItemId: 24731 },
  { slug: "motherlode", name: "Motherlode Mine", gateSkill: "Mining", gateLevel: 30, relevantUntil: 72,
    why: "AFK Mining with no risk and the Prospector outfit + gem rolls.",
    payoff: "Prospector outfit (+2.5% Mining XP) + nuggets for upgrades", iconItemId: 12012 },
  // Combat 40 and 500 total, per the wiki — not Attack 40, which was never a
  // Soul Wars requirement and gated the minigame on the wrong number.
  { slug: "soul-wars", name: "Soul Wars", gateSkill: "Combat", gateLevel: 40, relevantUntil: 126, totalLevelRequired: 500,
    why: "Tradeable XP across combat skills and an iconic cosmetic cape.",
    payoff: "Soul cape (+huge prayer bonus) + Ectoplasmator", iconItemId: 25346 },
  // The wiki is explicit: "There are no requirements to play". The invented
  // Hitpoints 40 bar plus the 25-level window made the Fighter torso — the best
  // mid-game body in the game — invisible to every account above 65 Hitpoints.
  { slug: "barbarian-assault", name: "Barbarian Assault", gateSkill: "Combat", gateLevel: 3, relevantUntil: 126,
    why: "Best free-to-mid-game body slot — Fighter torso beats every Rune body.",
    payoff: "Fighter torso + Penance horn + Granite body", iconItemId: 10551 }
];

/** What the game actually asks for, or null when it asks for nothing. */
function entryLine(mg: Minigame): string | null {
  const parts: string[] = [];
  if (mg.gateLevel > 3) parts.push(`${mg.gateSkill} ${mg.gateLevel}`);
  if (mg.totalLevelRequired !== undefined) parts.push(`${mg.totalLevelRequired} total`);
  return parts.length > 0 ? `You meet the ${parts.join(" and ")} entry point` : null;
}

export function minigameRecs(skills: HiscoreSkill[], access?: AccessContext): Recommendation[] {
  if (skills.length === 0) return [];
  const accessContext: AccessContext = access ?? { skills };
  const recs: Recommendation[] = [];
  for (const mg of MINIGAMES) {
    const level = mg.gateSkill === "Combat"
      ? computeCombatLevel(skills)
      : lvl(skills, mg.gateSkill);
    if (mg.totalLevelRequired !== undefined && computeTotalLevel(skills) < mg.totalLevelRequired) continue;
    // Several of these sit behind a quest, not a level: GoTR needs Temple of
    // the Eye, Hallowed Sepulchre needs Sins of the Father. Without this a
    // synced account with 52 Agility and no quests was told to go do the
    // Sepulchre, several quests away from being possible.
    const accessVerdict = evaluateAccess(MINIGAME_ACCESS[mg.slug], accessContext);
    if (accessVerdict.state === "locked") continue;
    const accessLine = accessNeedsLine(accessVerdict);
    // Open, and still worth doing. Two separate questions, so two numbers.
    const above = level - mg.gateLevel;
    if (above < 0 || level > mg.relevantUntil) continue;
    // Freshly unlocked still ranks highest, and the score then decays across
    // the minigame's whole span rather than falling off a cliff at +25. Without
    // this decay, removing the window put "Try Wintertodt" second on a
    // 2376-total account's list — the exact noise the window existed to stop.
    const freshness = Math.max(0, 10 - above);
    const span = Math.max(1, mg.relevantUntil - mg.gateLevel);
    const relevance = 1 - 0.5 * Math.min(1, above / span);
    recs.push({
      id: `minigame:${mg.slug}`,
      kind: "minigame",
      title: `Try ${mg.name}`,
      why: `${mg.gateSkill} ${level} — ${mg.why}`,
      payoff: mg.payoff,
      decisionReason: `${mg.name} is open at your ${mg.gateSkill} level, and there is a reward worth stopping at.`,
      needs: accessLine ? [accessLine] : undefined,
      // Minigames sit between freshly-unlocked bosses and skill-pushes.
      score: (55 + freshness * 2) * relevance * accessScoreMultiplier(accessVerdict),
      link: undefined, // no dedicated tool page yet
      iconItemId: mg.iconItemId,
      routeTags: [
        "fun",
        "skiller",
        ...(mg.slug === "motherlode" ? ["afk" as const] : []),
        ...(mg.slug === "barbarian-assault" || mg.slug === "soul-wars" ? ["unlock" as const] : [])
      ],
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
        // Barbarian Assault has no entry requirement at all, so naming one was
        // inventing a bar the game does not have; Soul Wars has two, and naming
        // only the combat half understated it.
        prep: entryLine(mg)
          ? `${entryLine(mg)}; go in for one reward, not an endless queue.`
          : "Nothing gates this; go in for one reward, not an endless queue.",
        steps: [
          `Set one ${mg.name} target before starting: one reward roll, outfit piece, or level bracket.`,
          "Bank stams, tabs and food for just that target, so you know when to stop.",
          "Stop at the target and check your plan again; minigame unlocks often change the best follow-up."
        ]
      }
    });
  }
  return recs;
}
