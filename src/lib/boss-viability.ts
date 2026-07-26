import { BOSSES, type Boss } from "./bosses";
import { bestStyleAndSetup, MAXED_STATS, type CombatStats, type DpsBreakdown } from "./dps";
import { lookupGear, ownedGear, type CombatStyle, type GearItem } from "./gear";
import {
  organizedItemsFromHandoff,
  type BankHandoffItem,
  type NextUpBankItem
} from "./next-bank-handoff";

export type BossViabilityTone = "ready" | "test" | "blocked";

export interface BossViability {
  boss: Boss;
  tone: BossViabilityTone;
  canKill: boolean;
  dps: number;
  ttk: number | null;
  style: CombatStyle | null;
  weaponName: string | null;
  verdict: string;
  summary: string;
  firstTrip: string;
  missing: string[];
  /**
   * True when no real combat levels were supplied, so every number above was
   * computed for a maxed account. Carried on the verdict rather than left to
   * each UI to remember, because "Can kill" is the most load-bearing claim in
   * the product and it was being made from somebody else's stats.
   */
  assumedMaxed: boolean;
}

const READY_DPS = 4.5;
const TEST_DPS = 2.4;
const READY_TTK = 150;
const TEST_TTK = 270;

export function bossBySlug(slug: string | undefined): Boss | null {
  if (!slug) return null;
  return BOSSES.find((boss) => boss.slug === slug) ?? null;
}

export function styleLabel(style: CombatStyle | null): string {
  if (!style) return "setup";
  if (style === "ranged") return "Ranged";
  if (style === "magic") return "Magic";
  return "Melee";
}

function finiteTtk(ttk: number): number | null {
  return Number.isFinite(ttk) && ttk > 0 ? ttk : null;
}

function toneForBreakdown(best: DpsBreakdown): BossViabilityTone {
  const ttk = finiteTtk(best.ttk);
  if (best.dps >= READY_DPS || (ttk !== null && ttk <= READY_TTK)) return "ready";
  if (best.dps >= TEST_DPS || (ttk !== null && ttk <= TEST_TTK)) return "test";
  return "blocked";
}

function weaponMissing(best: DpsBreakdown): boolean {
  return best.dps <= 0 || best.weapon.id === 0 || best.weapon.name === "(no weapon found)";
}

function fmtDps(dps: number): string {
  return dps.toFixed(dps >= 10 ? 0 : 1);
}

function fmtTtk(ttk: number | null): string | null {
  if (ttk === null) return null;
  if (ttk < 90) return `${Math.round(ttk)} sec`;
  return `${Math.round(ttk / 60)} min`;
}

function uniqueGear(items: GearItem[]): GearItem[] {
  const seen = new Set<number>();
  const out: GearItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

function simpleBankToGear(bank: NextUpBankItem[]): GearItem[] {
  return uniqueGear(bank.flatMap((item) => {
    const gear = lookupGear(item.id);
    return gear ? [gear] : [];
  }));
}

function ownsNamedItem(items: Array<{ name: string }>, pattern: RegExp): boolean {
  return items.some((item) => pattern.test(item.name));
}

function bankQuantity(items: BankHandoffItem[], pattern: RegExp): number {
  return items.reduce((total, item) => total + (pattern.test(item.name) ? item.quantity : 0), 0);
}

function withMissing(base: BossViability, item: string): string[] {
  return base.missing.includes(item) ? base.missing : [...base.missing, item];
}

function appendSentence(text: string, sentence: string): string {
  return text.includes(sentence) ? text : `${text} ${sentence}`;
}

function applyOwnedBossHints(base: BossViability, owned: GearItem[]): BossViability {
  if (base.boss.slug !== "vorkath") return base;
  if (ownsNamedItem(owned, /salve amulet/i)) return base;

  if (base.canKill) {
    return {
      ...base,
      summary: appendSentence(base.summary, "You can kill Vorkath, but missing Salve makes it worse."),
      firstTrip: "Do one short Vorkath trip; unlock Salve amulet(ei) before camping it.",
      missing: withMissing(base, "Salve amulet(ei)")
    };
  }

  return {
    ...base,
    summary: appendSentence(base.summary, "Unlock Salve amulet(ei) before making Vorkath the plan."),
    firstTrip: "Skip Vorkath for now; unlock Salve amulet(ei) first.",
    missing: withMissing(base, "Salve amulet(ei)")
  };
}

function applyBankBossHints(base: BossViability, items: BankHandoffItem[]): BossViability {
  if (base.boss.slug !== "zulrah" || !base.canKill) return base;

  const foodQty = bankQuantity(items, /karambwan|shark|manta ray|anglerfish|dark crab|sea turtle|saradomin brew/i);
  const venomQty = bankQuantity(items, /anti-venom|antidote\+\+|antidote\+|serpentine helm/i);
  if (foodQty >= 8 && venomQty > 0) return base;

  return {
    ...base,
    summary: appendSentence(base.summary, "Your bank supports Zulrah, but supplies are low."),
    firstTrip: "Restock food and venom protection, then do one short Zulrah trip.",
    missing: withMissing(base, "Zulrah supplies")
  };
}

function isSpecWeaponAsMain(weaponName: string): boolean {
  return /godsword|dragon claws/i.test(weaponName);
}

function preferredMainBreakdown(owned: GearItem[], boss: Boss, stats: CombatStats): DpsBreakdown {
  const best = bestStyleAndSetup(owned, boss, stats);
  if (!isSpecWeaponAsMain(best.weapon.name)) return best;

  const nonSpecOwned = owned.filter((item) =>
    item.slot !== "weapon" || !isSpecWeaponAsMain(item.name)
  );
  const fasterMainhand = bestStyleAndSetup(nonSpecOwned, boss, stats);
  if (
    fasterMainhand.weapon.id !== 0
    && (fasterMainhand.weapon.speed ?? 4) <= 4
    && fasterMainhand.dps >= best.dps * 0.75
  ) {
    return fasterMainhand;
  }
  return best;
}

/**
 * `stats` null means "we do not know this account's levels". The engine then
 * answers for a maxed account and the verdict says so — see assumedMaxed. It is
 * not a silent default: a kill time computed for 99s and shown to an 85-Attack
 * player is the exact failure this parameter exists to end.
 */
export function bossViabilityFromGear(
  owned: GearItem[],
  boss: Boss,
  stats?: CombatStats | null
): BossViability {
  const assumedMaxed = !stats;
  const best = preferredMainBreakdown(owned, boss, stats ?? MAXED_STATS);
  const noWeapon = weaponMissing(best);
  const tone = noWeapon ? "blocked" : toneForBreakdown(best);
  const ttk = finiteTtk(best.ttk);
  const weaponName = noWeapon ? null : best.weapon.name;
  const style = noWeapon ? null : best.style;
  const styleText = styleLabel(style);
  const ttkText = fmtTtk(ttk);
  const dpsText = fmtDps(best.dps);

  if (noWeapon) {
    return applyOwnedBossHints({
      boss,
      tone,
      canKill: false,
      dps: 0,
      ttk: null,
      style: null,
      weaponName: null,
      verdict: "Blocked",
      summary: "No usable weapon found in this bank.",
      firstTrip: "Pick a safer backup or add gear first.",
      missing: ["usable weapon"],
      assumedMaxed
    }, owned);
  }

  if (tone === "ready") {
    return applyOwnedBossHints({
      boss,
      tone,
      canKill: true,
      dps: best.dps,
      ttk,
      style,
      weaponName,
      verdict: "Can kill",
      summary: `Best setup in your bank: ${weaponName} (${styleText}) at ${dpsText} DPS${ttkText ? `, ~${ttkText} kill` : ""}.`,
      firstTrip: "Do one 3-5 kill trip, then decide if it becomes a block.",
      missing: [],
      assumedMaxed
    }, owned);
  }

  if (tone === "test") {
    return applyOwnedBossHints({
      boss,
      tone,
      canKill: true,
      dps: best.dps,
      ttk,
      style,
      weaponName,
      verdict: "Test trip",
      summary: `Best setup in your bank: ${weaponName} (${styleText}) at ${dpsText} DPS${ttkText ? `, ~${ttkText} kill` : ""}. Keep it short.`,
      firstTrip: "Test 1-2 kills before calling it tonight's grind.",
      missing: ["stronger setup for longer trips"],
      assumedMaxed
    }, owned);
  }

  return applyOwnedBossHints({
    boss,
    tone,
    canKill: false,
    dps: best.dps,
    ttk,
    style,
    weaponName,
    verdict: "Blocked",
    summary: `${weaponName} is only ${dpsText} DPS here. Pick a safer boss or upgrade first.`,
    firstTrip: `Skip for now; unlock or buy a stronger ${styleText.toLowerCase()} setup first.`,
    missing: [`stronger ${styleText.toLowerCase()} setup`],
    assumedMaxed
  }, owned);
}

export function bossViabilityFromBankItems(
  items: BankHandoffItem[],
  boss: Boss,
  stats?: CombatStats | null
): BossViability | null {
  if (items.length === 0) return null;
  return applyBankBossHints(
    bossViabilityFromGear(ownedGear(organizedItemsFromHandoff(items)), boss, stats),
    items
  );
}

export function bossViabilityFromSimpleBank(
  bank: NextUpBankItem[],
  boss: Boss,
  stats?: CombatStats | null
): BossViability | null {
  if (bank.length === 0) return null;
  return bossViabilityFromGear(simpleBankToGear(bank), boss, stats);
}

export function bossViabilityScoreMultiplier(viability: BossViability | null): number {
  if (!viability) return 1;
  if (viability.tone === "ready") return 1.18;
  if (viability.tone === "test") return 0.82;
  return 0.18;
}

/**
 * The one-line qualifier under a verdict.
 *
 * Two different gaps, and both are worth stating because "Can kill" is the
 * most load-bearing claim in the product:
 *
 * - Levels may be assumed. Fixable by adding an RSN, so the line says how.
 * - Gear is only ever what is in the bank. The plugin does not read worn
 *   equipment and, by a promise in both READMEs, will not — so this one is
 *   permanent, and saying it is the whole remedy. It matters most for exactly
 *   the player who banks in their combat setup, whose best weapon is then
 *   invisible to a verdict that sounds complete.
 */
export function bossViabilityBasis(viability: BossViability): string | null {
  const wornGear = "Worn gear is not counted \u2014 Scapestack only sees your bank.";
  return viability.assumedMaxed
    ? `Assumes maxed combat stats \u2014 add your RSN for your own numbers. ${wornGear}`
    : wornGear;
}

export function bossViabilityDecisionLine(viability: BossViability): string {
  // "Bank says" was the wrong attribution while levels were assumed: the bank
  // supplied the gear, the engine supplied somebody else's 99s. It is accurate
  // once the levels are the player's, and hedged when they are not.
  const source = viability.assumedMaxed ? "At maxed stats" : "Your stats and bank say";
  if (viability.tone === "ready") {
    return `${source} you can kill ${viability.boss.name}: ${viability.summary}`;
  }
  if (viability.tone === "test") {
    return `${source} ${viability.boss.name} is a test trip: ${viability.summary}`;
  }
  return `Skipped ${viability.boss.name}: ${viability.summary}`;
}
