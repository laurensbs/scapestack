// Boss KC insights for the /next engine.
//
// This is the "you are 142 KC into Vorkath, that is roughly 0.85 visages"
// layer: it turns a kill count plus a drop rate into an honest read on where
// the player stands, and it stops recommending a chase once the collection
// log or the bank proves they already got it.
//
// ICONIC_DROPS overrides the generic drop-rate window for bosses whose real
// chase sits far outside it — Tbow at CoX, Shadow at ToA.

import { BOSSES, type Boss } from "./bosses";
import type { CompletionItem } from "./goals";
import type { HiscoreSkill } from "./hiscores";
import type { BossDropTable } from "./drop-rates-db";
import { isIronPlannerAccount, type PlannerAccountType } from "./account-type";
import {
  BOSS_GEAR_GATES,
  displayMatchedGear,
  hasBossExperience,
  matchedGearForBoss
} from "./next-up-bosses";
import { lvl } from "./next-up-shared";
import type { Recommendation, RecommendationGearConfidence } from "./next-up-types";

// ── Boss KC insights ────────────────────────────────────────────────────────
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

function activeBossKcScore(kc: number, boss: Boss, hasBank: boolean, accountType?: PlannerAccountType | null): number {
  const avgLoot = boss.avgLootGp ?? 0;
  const lootBoost = isIronPlannerAccount(accountType) ? 0 :
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

export function activeBossKcRecs(
  bossKc: Record<string, number>,
  bank: CompletionItem[],
  skills: HiscoreSkill[],
  accountType?: PlannerAccountType | null
): Recommendation[] {
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
      payoff: boss.avgLootGp
        ? `Estimated long-run loot: ~${Math.round(boss.avgLootGp / 1000)}k per kill while you build proof${isIronPlannerAccount(accountType) ? "; judge the drops, not their GE value" : ""}.`
        : boss.notes,
      decisionReason: kc < 5
        ? `This is only ${kc.toLocaleString()} KC, so it stays a scout read instead of the main plan.`
        : kc < 10
          ? `${kc.toLocaleString()} ${boss.name} KC is a proof run; keep it short before chasing 50.`
          : `You already have ${kc.toLocaleString()} ${boss.name} KC, so 50 KC is a clean stop point.`,
      score: activeBossKcScore(kc, boss, bank.length > 0, accountType),
      link: "/dps",
      iconItemId: boss.iconItemId,
      bossSlug: boss.slug,
      kcMeta: { kc, denom: 50, dropName: "first 50 KC" },
      completionTarget: { kind: "boss_kc_at_least", boss: boss.slug, target: 50 },
      routeTags: ["pvm", "fun", ...(!isIronPlannerAccount(accountType) && boss.avgLootGp ? ["gp" as const] : [])],
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
        matchedGear ? `${matchedGear} setup` : "Kill check",
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
export function kcRecs(
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
      // A dry-streak card is about a boss, so it belongs on the kill check.
      // This used to be a hardcoded link to Sheep Shearer, a five-minute F2P
      // starter quest, under a headline reading "900 Vorkath KC".
      link: boss?.slug ? `/dps?boss=${boss.slug}` : "/dps",
      iconItemId: boss?.iconItemId,
      bossSlug: boss?.slug,
      kcMeta: { kc, denom: headline.denom, dropName: headline.name },
      completionTarget: { kind: "collection_log_item_obtained", item: headline.name },
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

