import { BOSSES, type Boss } from "./bosses";
import { bestStyleAndSetup, type DpsBreakdown } from "./dps";
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

function isSpecWeaponAsMain(weaponName: string): boolean {
  return /godsword|dragon claws/i.test(weaponName);
}

function preferredMainBreakdown(owned: GearItem[], boss: Boss): DpsBreakdown {
  const best = bestStyleAndSetup(owned, boss);
  if (!isSpecWeaponAsMain(best.weapon.name)) return best;

  const nonSpecOwned = owned.filter((item) =>
    item.slot !== "weapon" || !isSpecWeaponAsMain(item.name)
  );
  const fasterMainhand = bestStyleAndSetup(nonSpecOwned, boss);
  if (
    fasterMainhand.weapon.id !== 0
    && (fasterMainhand.weapon.speed ?? 4) <= 4
    && fasterMainhand.dps >= best.dps * 0.75
  ) {
    return fasterMainhand;
  }
  return best;
}

export function bossViabilityFromGear(owned: GearItem[], boss: Boss): BossViability {
  const best = preferredMainBreakdown(owned, boss);
  const noWeapon = weaponMissing(best);
  const tone = noWeapon ? "blocked" : toneForBreakdown(best);
  const ttk = finiteTtk(best.ttk);
  const weaponName = noWeapon ? null : best.weapon.name;
  const style = noWeapon ? null : best.style;
  const styleText = styleLabel(style);
  const ttkText = fmtTtk(ttk);
  const dpsText = fmtDps(best.dps);

  if (noWeapon) {
    return {
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
      missing: ["usable weapon"]
    };
  }

  if (tone === "ready") {
    return {
      boss,
      tone,
      canKill: true,
      dps: best.dps,
      ttk,
      style,
      weaponName,
      verdict: "Can kill",
      summary: `Best owned setup: ${weaponName} (${styleText}) at ${dpsText} DPS${ttkText ? `, ~${ttkText} kill` : ""}.`,
      firstTrip: "Do one 3-5 kill trip, then decide if it becomes a block.",
      missing: []
    };
  }

  if (tone === "test") {
    return {
      boss,
      tone,
      canKill: true,
      dps: best.dps,
      ttk,
      style,
      weaponName,
      verdict: "Test trip",
      summary: `Best owned setup: ${weaponName} (${styleText}) at ${dpsText} DPS${ttkText ? `, ~${ttkText} kill` : ""}. Keep it short.`,
      firstTrip: "Test 1-2 kills before calling it tonight's grind.",
      missing: ["stronger setup for longer trips"]
    };
  }

  return {
    boss,
    tone,
    canKill: false,
    dps: best.dps,
    ttk,
    style,
    weaponName,
    verdict: "Blocked",
    summary: `${weaponName} is only ${dpsText} DPS here. Pick a safer boss or upgrade first.`,
    firstTrip: "Do not make this the main plan from this bank.",
    missing: [`stronger ${styleText.toLowerCase()} setup`]
  };
}

export function bossViabilityFromBankItems(items: BankHandoffItem[], boss: Boss): BossViability | null {
  if (items.length === 0) return null;
  return bossViabilityFromGear(ownedGear(organizedItemsFromHandoff(items)), boss);
}

export function bossViabilityFromSimpleBank(bank: NextUpBankItem[], boss: Boss): BossViability | null {
  if (bank.length === 0) return null;
  return bossViabilityFromGear(simpleBankToGear(bank), boss);
}

export function bossViabilityScoreMultiplier(viability: BossViability | null): number {
  if (!viability) return 1;
  if (viability.tone === "ready") return 1.18;
  if (viability.tone === "test") return 0.82;
  return 0.18;
}

export function bossViabilityDecisionLine(viability: BossViability): string {
  if (viability.tone === "ready") {
    return `Bank says you can kill ${viability.boss.name}: ${viability.summary}`;
  }
  if (viability.tone === "test") {
    return `Bank says ${viability.boss.name} is a test trip: ${viability.summary}`;
  }
  return `Skipped ${viability.boss.name}: ${viability.summary}`;
}
