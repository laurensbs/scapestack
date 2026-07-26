// Boss recommendations for the /next engine.
//
// Three gates decide whether a boss is worth suggesting:
//   BOSS_CL_GATE     — the combat level where the boss becomes sensible;
//   BOSS_GEAR_GATES  — the gear that makes it survivable, matched against
//                      the player's actual bank rather than assumed;
//   boss-viability   — the shared verdict engine also used by /dps.
//
// Without a bank we deliberately soften the claim instead of telling someone
// with no trident to "try Kraken". Gear confidence rides along on every rec so
// the ranking layer can penalise guesses.

import { BOSSES, type Boss } from "./bosses";
import { BOSS_CL_GATE } from "./boss-gates";
import type { CombatStats } from "./dps";
import type { CompletionItem } from "./goals";
import type { HiscoreSkill } from "./hiscores";
import { isIronPlannerAccount, type PlannerAccountType } from "./account-type";
import {
  bossBySlug,
  bossViabilityDecisionLine,
  bossViabilityFromSimpleBank,
  bossViabilityScoreMultiplier
} from "./boss-viability";
import { lvl } from "./next-up-shared";
import {
  accessNeedsLine,
  accessScoreMultiplier,
  evaluateAccess,
  type AccessContext
} from "./content-access";
import { BOSS_ACCESS } from "./content-access-data";
import { defaultQualityFor } from "./next-up-scoring";
import type { Recommendation, RecommendationGearConfidence } from "./next-up-types";


// ── Bosses ──────────────────────────────────────────────────────────────────
// Bosses the player's combat level now comfortably supports but that they
// likely haven't tackled — fresh content for a "what now" moment.
//
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
export const BOSS_GEAR_GATES: Record<string, {
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
  "thermonuclear": { needs: ["abyssal whip", "dragon scimitar", "saradomin sword"], slayerLevel: 93 },
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
  "araxxor":       { needs: ["scythe of vitur", "abyssal whip", "soulreaper axe", "osmumten's fang"], slayerLevel: 92 },

  // Endgame — Nex needs a team and BiS-ish kit.
  "nex": { needs: ["twisted bow", "bow of faerdhinen", "scythe of vitur", "shadow of tumeken", "armadyl crossbow", "zaryte crossbow"] },

  // Wilderness: null on purpose. These are fought in gear chosen for what the
  // player is willing to lose, so a "you must own X" list would suppress the
  // boss for exactly the accounts that do them correctly.
  "callisto": null, "artio": null, "venenatis": null, "spindel": null,
  "vetion": null, "calvarion": null, "scorpia": null,
  "chaos-elemental": null, "chaos-fanatic": null, "crazy-archaeologist": null,
  "deranged-archaeologist": null,

  // Gated by something other than gear.
  "hespori": null,        // 65 Farming
  "mimic": null,          // a master or elite clue casket
  "galvek": null,         // Dragon Slayer II
  "moons-of-peril": null, // Perilous Moons
  "amoxliatl": { needs: [], slayerLevel: 48 },
  "hueycoatl": null,

  "kalphite-queen": { needs: ["dragon scimitar", "abyssal whip", "osmumten's fang", "keris partisan", "toxic blowpipe", "armadyl crossbow"] },

  // Corp ignores anything that is not a spear or a crush weapon.
  "corp": { needs: ["osmumten's fang", "zamorakian spear", "zamorakian hasta", "dragon warhammer", "elder maul", "bandos godsword"] },

  "tztok-jad": { needs: ["toxic blowpipe", "armadyl crossbow", "rune crossbow", "magic shortbow"] },
  "tzkal-zuk": { needs: ["toxic blowpipe", "twisted bow", "bow of faerdhinen", "armadyl crossbow"] },
  "fortis-colosseum": { needs: ["osmumten's fang", "abyssal whip", "voidwaker", "scythe of vitur", "toxic blowpipe"] },

  "cox": { needs: ["abyssal whip", "dragon hunter crossbow", "twisted bow", "toxic blowpipe", "dragon warhammer"] },
  "tob": { needs: ["scythe of vitur", "abyssal bludgeon", "toxic blowpipe", "twisted bow", "dragon claws"] },
  "toa": { needs: ["osmumten's fang", "abyssal whip", "toxic blowpipe", "twisted bow", "trident of the swamp"] }
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
export function matchedGearForBoss(slug: string, bank: CompletionItem[], slayerLevel: number): { item: string } | null {
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

export function hasBossExperience(boss: Boss, bank: CompletionItem[], bossKc: Record<string, number>): boolean {
  if ((bossKc[boss.name] ?? 0) >= 50) return true;
  const signatureIds = BOSS_SIGNATURE_ITEM_IDS[boss.slug] ?? [];
  if (signatureIds.length === 0) return false;
  const ownedIds = new Set(bank.map((item) => item.id));
  return signatureIds.some((id) => ownedIds.has(id));
}

function genericBossIntroScore(baseScore: number, input: {
  bossCategory: Boss["category"];
  totalKnownBossKc: number;
  hasBank: boolean;
}): number {
  let score = Math.max(40, baseScore);

  // A boss tile is a useful backup, but if the account has no boss history it
  // should not beat clear quests, diaries or foundation skill unlocks.
  if (input.totalKnownBossKc === 0) {
    score = Math.min(score, input.hasBank ? 58 : 52);
  } else if (input.totalKnownBossKc < 25) {
    score = Math.min(score, input.hasBank ? 64 : 58);
  } else if (input.totalKnownBossKc < 1_000) {
    score = Math.min(score, input.hasBank ? 54 : 48);
  }

  if (input.bossCategory === "wildy") {
    score -= input.hasBank ? 6 : 12;
  }

  return Math.max(34, Math.round(score));
}

export function bossRecs(
  combatLevel: number,
  bank: CompletionItem[],
  skills: HiscoreSkill[],
  bossKc: Record<string, number>,
  accountType?: PlannerAccountType | null,
  access?: AccessContext,
  stats?: CombatStats | null
): Recommendation[] {
  const totalKnownBossKc = Object.values(bossKc).reduce((sum, kc) => sum + Math.max(0, kc), 0);
  if (totalKnownBossKc >= 1_000) return [];

  const slayerLevel = lvl(skills, "Slayer");
  const accessContext: AccessContext = access ?? { skills };
  const seenGroups = new Set<string>();
  const recs: Recommendation[] = [];
  // Whether anything inside the window is a fight this account comfortably
  // wins. "test" does not count: a four-minute kill on a whip-only setup is a
  // warning, not a recommendation, and treating it as one is what left this
  // account with no boss worth doing.
  // Set only by a boss the player is already killing. Whether the window
  // *offers* something usable is decided further down, against the four recs
  // that actually survive ranking — checking it here measured candidates, and a
  // boss that places fifth is a boss the player never sees.
  let alreadyBossingInWindow = false;
  for (const boss of BOSSES) {
    const gate = BOSS_CL_GATE[boss.slug];
    if (gate === undefined) continue;
    // Suggest bosses the player just crossed the gate for — within a 25-CL
    // band above the gate, so it stays relevant rather than listing every
    // low-level boss to a maxed main.
    if (combatLevel < gate || combatLevel > gate + 25) continue;
    if (hasBossExperience(boss, bank, bossKc)) {
      // Already killing this one. It is not a recommendation, but it is proof
      // the window works — and the fallback below must not then tell a player
      // farming Vorkath that nothing at their combat level is winnable.
      alreadyBossingInWindow = true;
      continue;
    }

    // Combat level is not the real gate for most of these — Vorkath wants
    // Dragon Slayer II, GWD wants Trollheim. Drop the boss when we can prove
    // the unlock is missing; keep it (and say so) when we cannot see.
    const accessVerdict = evaluateAccess(BOSS_ACCESS[boss.slug], accessContext);
    if (accessVerdict.state === "locked") continue;

    // Gear / slayer gate. If the player has no gear from the list AND no
    // bank was provided, we still let the rec through (we'd rather show
    // something than nothing when we have no signal). If a bank WAS
    // provided and nothing matched, suppress — the audit script flagged
    // "Try GWD bosses to a Black-d'hide player" as a real failure mode.
    // Two different gates hide in BOSS_GEAR_GATES and they deserve opposite
    // treatment when there is no bank. Gear is unknowable without one, so we
    // let it through and mark confidence "unknown". A Slayer level is NOT
    // unknowable — it is right there in the Hiscores — so skipping that check
    // just because no bank was pasted produced "Try Cerberus" for an account
    // with 80 Slayer, on a boss that needs 91.
    const gearGate = BOSS_GEAR_GATES[boss.slug];
    if (gearGate?.slayerLevel !== undefined && slayerLevel < gearGate.slayerLevel) continue;
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
      const score = genericBossIntroScore(70 - (combatLevel - gate), {
        bossCategory: "slayer",
        totalKnownBossKc,
        hasBank: bank.length > 0
      }) * accessScoreMultiplier(accessVerdict);
      const groupAccessLine = accessNeedsLine(accessVerdict);
      recs.push({
        id: group.id,
        kind: "boss",
        title: group.title,
        why: gearWhy(combatLevel, match.item) ?? `Your combat level (${combatLevel}) clears the entry gate.`,
        payoff: "Three bosses, shared room — solid mid-combat training and rare drops.",
        decisionReason: match.item
          ? `${displayMatchedGear(match.item)} makes this a realistic short PvM trip.`
          : "Combat level fits, but gear is not verified; treat this as a short scouting trip.",
        score,
        needs: groupAccessLine ? [groupAccessLine] : undefined,
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
            "Check the kill setup before entering Waterbirth.",
            "Bring supplies for a short rotation and prove you can sustain the room safely.",
            "After the trip, decide whether DKs becomes a ring grind or just a diary/KC clear."
          ]
        }
      });
      continue;
    }

    const score = genericBossIntroScore(70 - (combatLevel - gate), {
      bossCategory: boss.category,
      totalKnownBossKc,
      hasBank: bank.length > 0
    }) * accessScoreMultiplier(accessVerdict); // freshly-unlocked scores higher, but no-history bosses stay backups.
    const bossAccessLine = accessNeedsLine(accessVerdict);
    recs.push({
      id: `boss:${boss.slug}`,
      kind: "boss",
      title: `Try ${boss.name}`,
      why: gearWhy(combatLevel, match.item) ?? `Your combat level (${combatLevel}) is in range for this boss.`,
      payoff: boss.avgLootGp
        ? `Estimated long-run loot: ~${Math.round(boss.avgLootGp / 1000)}k per kill${isIronPlannerAccount(accountType) ? "; useful drops matter more than GE value" : ""}.`
        : boss.notes,
      decisionReason: match.item
        ? `${displayMatchedGear(match.item)} gives this trip a gear anchor before you buy upgrades.`
        : boss.category === "wildy"
          ? "Wilderness trips need gear and risk context, so this stays a cautious test."
          : "Combat level fits, but no bank was pasted, so the first trip should stay cheap.",
      score,
      needs: bossAccessLine ? [bossAccessLine] : undefined,
      link: "/dps",
      iconItemId: boss.iconItemId,
      bossSlug: boss.slug,
      routeTags: ["pvm", "fun", ...(!isIronPlannerAccount(accountType) && boss.category !== "wildy" ? ["gp" as const] : [])],
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
          `Check ${boss.name} and use the best owned setup before buying anything.`,
          "Bring supplies for 3-5 kills so mistakes stay cheap.",
          boss.avgLootGp ? `Compare your real supply cost against the estimated ~${Math.round(boss.avgLootGp / 1000)}k long-run loot/kill after the test trip.` : "After the test trip, compare kill time and supply burn before committing to a grind."
        ]
      }
    });
  }
  // Every boss in the window is a fight this account loses. That combination is
  // common and it used to produce nothing at all: the window offers bosses at
  // most 25 combat levels below the player, so a 70/75 account with a whip is
  // shown Dagannoth Kings and Barrows — and once the DPS figures stopped
  // assuming maxed stats, the engine correctly blocked all of them and left the
  // player with no boss. Meanwhile Obor, Bryophyta and Kraken sit just under the
  // window and die comfortably.
  //
  // So widen it, but only in the case that needs it, and say plainly that this
  // is the honest recommendation rather than the aspirational one.
  // Cap at top-4 — beyond that the checklist becomes "every boss in CL range"
  // which is noise. The kill check is one click away for the full list.
  const ranked = recs.sort((a, b) => b.score - a.score).slice(0, 4);

  // Judged on the four that survived, not on every candidate. A Chaos Fanatic
  // that measures "ready" and then places fifth used to mark the window healthy
  // and suppress the fallback, leaving the player with four bosses they cannot
  // beat and no explanation.
  //
  // totalKnownBossKc gates it too: this is for an account that is not bossing
  // yet. Someone with real kill counts does not need to be told which boss they
  // can beat, and telling them reads as the engine not knowing them.
  if (bank.length === 0 || !stats || alreadyBossingInWindow || totalKnownBossKc >= 50) {
    return ranked;
  }
  const anyReady = ranked.some((rec) => {
    const boss = bossBySlug(rec.bossSlug);
    return boss ? bossViabilityFromSimpleBank(bank, boss, stats)?.tone === "ready" : false;
  });
  if (anyReady) return ranked;

  const fallback = reachableBossFallback({
    combatLevel, bank, bossKc, slayerLevel, accessContext, stats, totalKnownBossKc
  });
  if (fallback.length === 0) return ranked;
  return [...ranked, ...fallback].sort((a, b) => b.score - a.score).slice(0, 4);
}

/**
 * The best bosses below the recommendation window that this account genuinely
 * kills, scored under everything in the window.
 *
 * Deliberately capped at two and scored low: this is a fallback, not a demotion
 * of the player's ambitions. It exists so "nothing you can fight" is never the
 * answer when something obviously is.
 */
function reachableBossFallback(input: {
  combatLevel: number;
  bank: CompletionItem[];
  bossKc: Record<string, number>;
  slayerLevel: number;
  accessContext: AccessContext;
  stats: CombatStats;
  totalKnownBossKc: number;
}): Recommendation[] {
  const found: Array<{
    boss: Boss;
    gate: number;
    ttk: number | null;
    accessLine: string | null;
    accessMultiplier: number;
  }> = [];
  // Its own, because the main loop only ever fills the caller's set for bosses
  // inside the window and the two ranges are disjoint — so the caller's set is
  // always empty here, and passing it in produced two Dagannoth Kings tiles for
  // one Waterbirth trip.
  const groups = new Set<string>();

  for (const boss of BOSSES) {
    const gate = BOSS_CL_GATE[boss.slug];
    // Strictly below the window the main pass already covered.
    if (gate === undefined || input.combatLevel <= gate + 25) continue;
    // Activities with no hit points are not fights; combat advice on Wintertodt
    // is nonsense whatever the DPS engine returns for it.
    if (boss.hp <= 0) continue;
    // Never the Wilderness. This exists to hand a confidence-building fight to
    // an account whose gear is behind its combat level — and the worst possible
    // outcome for that account is losing the little gear it has. The main pass
    // may still offer a wildy boss; it carries a risk penalty and a caveat that
    // a flat fallback score would bypass.
    if (boss.category === "wildy") continue;
    if (hasBossExperience(boss, input.bank, input.bossKc)) continue;

    const accessVerdict = evaluateAccess(BOSS_ACCESS[boss.slug], input.accessContext);
    if (accessVerdict.state === "locked") continue;
    const gearGate = BOSS_GEAR_GATES[boss.slug];
    if (gearGate?.slayerLevel !== undefined && input.slayerLevel < gearGate.slayerLevel) continue;
    // The same gear-name gate the main pass applies. Skipping it let the
    // fallback recommend bosses the main pass had deliberately suppressed for
    // this exact bank.
    if (matchedGearForBoss(boss.slug, input.bank, input.slayerLevel) === null) continue;

    const group = BOSS_GROUPS[boss.slug];
    if (group) {
      if (groups.has(group.id)) continue;
      groups.add(group.id);
    }

    const viability = bossViabilityFromSimpleBank(input.bank, boss, input.stats);
    // "ready" only. A test trip at a boss the player has already outlevelled is
    // not worth the slot.
    if (!viability || viability.tone !== "ready") continue;
    found.push({
      boss,
      gate,
      ttk: viability.ttk,
      accessLine: accessNeedsLine(accessVerdict),
      accessMultiplier: accessScoreMultiplier(accessVerdict)
    });
  }

  // Highest entry bar first — the closest thing to a real step up.
  found.sort((left, right) => right.gate - left.gate);

  return found.slice(0, 2).map(({ boss, ttk, accessLine, accessMultiplier }, index) => ({
    id: `boss:${boss.slug}`,
    kind: "boss" as const,
    title: `Try ${boss.name}`,
    // About the bank, which is the true cause. The earlier phrasing claimed the
    // engine had measured every boss at the player's level, which is not what
    // the flag above establishes — several are dropped for gear or access
    // before any DPS is computed.
    why: "Your bank is behind the bosses at your combat level. This one it handles.",
    payoff: boss.avgLootGp
      ? `Estimated long-run loot: ~${Math.round(boss.avgLootGp / 1000)}k per kill.`
      : boss.notes,
    decisionReason: ttk
      ? `Your stats and bank kill it in about ${ttk < 90 ? `${Math.round(ttk)} sec` : `${Math.round(ttk / 60)} min`} — measured, not guessed from a combat-level gate.`
      : "Your stats and bank handle this one, measured rather than guessed from a combat-level gate.",
    // Scored in the same band as an in-window boss, not beneath it. The
    // evidence here is strictly stronger: every in-window rec is a guess from a
    // combat-level gate, while this one has a kill time computed from the
    // player's own levels against their own gear. Ranking it lower would mean
    // preferring the guess to the measurement.
    //
    // The runner-up drops ten points so the pair cannot take two of the three
    // headline slots between them. Obor and Bryophyta are close to the same
    // suggestion twice; one competes, the other is a backup.
    score: (index === 0 ? 58 : 48) * accessMultiplier,
    needs: accessLine ? [accessLine] : undefined,
    link: "/dps",
    iconItemId: boss.iconItemId,
    bossSlug: boss.slug,
    routeTags: ["pvm", "fun"],
    gearConfidence: "confirmed" as const,
    quality: {
      accountFit: 0.8,
      actionability: 0.84,
      stopPoint: 0.86,
      gearConfidence: 0.9,
      unlockValue: 0.3,
      fun: 0.7,
      friction: 0.3
    },
    planSeed: {
      timebox: "30-60 min",
      prep: `Take your best owned setup; ${boss.name} is comfortably inside what it handles.`,
      steps: [
        `Do 3-5 ${boss.name} kills and confirm the kill time matches.`,
        "Bank the drops and note what actually slowed you down.",
        "Come back to the bosses at your combat level once the setup or levels move."
      ]
    }
  }));
}

// Build the rec's `why` line. When we matched a specific gear item we
// surface it ("Your Twisted bow + CL 126 makes this easy") so the player
// sees the engine read their bank. Falls back to CL-only when match.item
// is empty (no-gate boss or no bank pasted).
export function displayMatchedGear(matchedItem: string): string {
  return matchedItem.replace(/\b\w/g, (c) => c.toUpperCase());
}

function gearWhy(combatLevel: number, matchedItem: string): string | null {
  if (!matchedItem) return null;
  const display = displayMatchedGear(matchedItem);
  return `Your ${display} fits — and CL ${combatLevel} clears the gate.`;
}

function mergeUniqueShort(first: string[], second: string[], limit: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of [...first, ...second]) {
    const clean = item.trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= limit) break;
  }
  return out;
}

export function applyBossViability(
  recs: Recommendation[],
  bank: CompletionItem[],
  // Null keeps the old behaviour — maxed stats, and the verdict says so. Every
  // production path has real levels here; the fixtures in tests do not.
  stats?: CombatStats | null
): Recommendation[] {
  if (bank.length === 0) return recs;

  return recs.map((rec) => {
    const boss = bossBySlug(rec.bossSlug);
    if (!boss) return rec;

    const viability = bossViabilityFromSimpleBank(bank, boss, stats);
    if (!viability) return rec;

    const blocked = viability.tone === "blocked";
    const activeKcMomentum = rec.kind === "kc" && (rec.kcMeta?.kc ?? 0) >= 10
      ? (blocked ? 1.25 : 1.35)
      : 1;
    const activeKcProof = rec.kind === "kc" && (rec.kcMeta?.kc ?? 0) >= 10;
    const treatAsBlocked = blocked && !activeKcProof;
    const multiplier = blocked && activeKcProof
      ? 0.9
      : bossViabilityScoreMultiplier(viability);
    const existingQuality = rec.quality ?? defaultQualityFor(rec, true);
    const existingSteps = rec.planSeed?.steps ?? [];
    const prepPrefix = treatAsBlocked
      ? viability.summary
      : blocked && activeKcProof
        ? `${viability.summary} You already have KC here, so make it a short setup check instead of a blind grind.`
      : `${viability.summary} ${viability.firstTrip}`;
    const steps = treatAsBlocked
      ? [
          `Do not make ${boss.name} the main plan from this bank.`,
          "Check the kill setup if you want to inspect the gap.",
          "Pick a backup that your current gear supports tonight."
        ]
      : blocked && activeKcProof
        ? mergeUniqueShort(
            [
              `Open ${boss.name} in Check kill and confirm the best owned setup.`,
              "Run a small KC block only if the trip feels stable."
            ],
            existingSteps,
            4
          )
      : mergeUniqueShort(
          [
            `Check ${boss.name} and lock ${viability.weaponName ?? "the best owned setup"}.`,
            viability.firstTrip
          ],
          existingSteps,
          4
        );

    return {
      ...rec,
      score: Math.max(activeKcProof ? 72 : treatAsBlocked ? 4 : 20, Math.round(rec.score * multiplier * activeKcMomentum)),
      why: treatAsBlocked
        ? `${boss.name} is not the move from this bank yet.`
        : rec.why,
      decisionReason: treatAsBlocked
        ? bossViabilityDecisionLine(viability)
        : blocked && activeKcProof
          ? `${rec.decisionReason ?? `${boss.name} has enough KC history to deserve a short block.`} Bank says the setup is weak, so check the kill setup before camping it.`
          : rec.decisionReason ?? bossViabilityDecisionLine(viability),
      gearConfidence: treatAsBlocked
        ? "unknown"
        : viability.tone === "ready"
          ? "confirmed"
          : "likely",
      quality: {
        ...existingQuality,
        actionability: treatAsBlocked ? 0.18 : blocked && activeKcProof ? Math.max(existingQuality.actionability, 0.72) : viability.tone === "ready" ? Math.max(existingQuality.actionability, 0.86) : Math.min(existingQuality.actionability, 0.66),
        gearConfidence: treatAsBlocked ? 0.12 : blocked && activeKcProof ? 0.62 : viability.tone === "ready" ? 0.96 : 0.72,
        fun: treatAsBlocked ? Math.min(existingQuality.fun, 0.36) : existingQuality.fun,
        friction: treatAsBlocked ? Math.max(existingQuality.friction, 0.88) : blocked && activeKcProof ? Math.max(existingQuality.friction, 0.48) : viability.tone === "test" ? Math.max(existingQuality.friction, 0.52) : Math.min(existingQuality.friction, 0.34)
      },
      needs: mergeUniqueShort(
        treatAsBlocked
          ? viability.missing
          : [`${viability.weaponName ?? "Best owned setup"} setup`, `${viability.dps.toFixed(viability.dps >= 10 ? 0 : 1)} DPS check`],
        rec.needs ?? [],
        4
      ),
      planSeed: {
        ...rec.planSeed,
        prep: rec.planSeed?.prep
          ? `${prepPrefix} ${rec.planSeed.prep}`
          : prepPrefix,
        steps,
        caveat: treatAsBlocked
          ? "Use a backup unless you add better gear or supplies."
          : rec.planSeed?.caveat
      }
    };
  });
}
