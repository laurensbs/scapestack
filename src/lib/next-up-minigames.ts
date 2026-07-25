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

import type { HiscoreSkill } from "./hiscores";
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
    why: "Strong Agility XP with tradeable loot; actual profit moves with current prices.",
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

export function minigameRecs(skills: HiscoreSkill[], access?: AccessContext): Recommendation[] {
  if (skills.length === 0) return [];
  const accessContext: AccessContext = access ?? { skills };
  const recs: Recommendation[] = [];
  for (const mg of MINIGAMES) {
    const level = lvl(skills, mg.gateSkill);
    // Several of these sit behind a quest, not a level: GoTR needs Temple of
    // the Eye, Hallowed Sepulchre needs Sins of the Father. Without this a
    // synced account with 52 Agility and no quests was told to go do the
    // Sepulchre, several quests away from being possible.
    const accessVerdict = evaluateAccess(MINIGAME_ACCESS[mg.slug], accessContext);
    if (accessVerdict.state === "locked") continue;
    const accessLine = accessNeedsLine(accessVerdict);
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
      needs: accessLine ? [accessLine] : undefined,
      // Minigames sit between freshly-unlocked bosses and skill-pushes.
      score: (55 + freshness * 2) * accessScoreMultiplier(accessVerdict),
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
        prep: `You meet the ${mg.gateSkill} ${mg.gateLevel} entry point; make this a reward-target session, not an endless queue.`,
        steps: [
          `Set one ${mg.name} target before starting: one reward roll, outfit piece, or level bracket.`,
          "Bank stamina/teleports/supplies for just that target so the session stays bounded.",
          "Stop at the target and check your plan again; minigame unlocks often change the best follow-up."
        ]
      }
    });
  }
  return recs;
}
