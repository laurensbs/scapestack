import type { PlannerAccountType } from "./account-type";
import { isIronPlannerAccount } from "./account-type";
import type { Boss } from "./bosses";
import { autoSetup, calcDps, type DpsBreakdown } from "./dps";
import { GEAR, type CombatStyle, type GearItem } from "./gear";
import type { BankHandoffItem } from "./next-bank-handoff";
import { UPGRADES } from "./upgrades";

export interface BossUpgradePlan {
  item: GearItem;
  gain: number;
  newTtk: number;
  approximatePrice: number | null;
  availableCoins: number;
  affordable: boolean;
  sourcePath: string | null;
  actionLabel: string;
  reason: string;
}

interface UpgradeCandidate {
  item: GearItem;
  gain: number;
  newTtk: number;
  approximatePrice: number | null;
}

export function buildBossUpgradePlan({
  boss,
  owned,
  bankItems,
  current,
  accountType
}: {
  boss: Boss;
  owned: GearItem[];
  bankItems: BankHandoffItem[];
  current: DpsBreakdown;
  accountType?: PlannerAccountType | null;
}): BossUpgradePlan | null {
  if (current.dps <= 0) return null;

  const candidates = bossUpgradeCandidates(owned, boss, current);
  if (candidates.length === 0) return null;

  const availableCoins = bankCash(bankItems);
  const iron = isIronPlannerAccount(accountType);
  const picked = iron
    ? candidates[0]
    : candidates.find((candidate) =>
        candidate.approximatePrice !== null
        && candidate.approximatePrice > 0
        && candidate.approximatePrice <= availableCoins
      ) ?? candidates.find((candidate) => candidate.approximatePrice !== null && candidate.approximatePrice > 0) ?? candidates[0];
  const affordable = !iron
    && picked.approximatePrice !== null
    && picked.approximatePrice > 0
    && picked.approximatePrice <= availableCoins;
  const sourcePath = iron ? ironSourcePath(picked.item.name) : null;

  return {
    ...picked,
    availableCoins,
    affordable,
    sourcePath,
    actionLabel: iron ? "Open source" : affordable ? "Check price" : "See upgrade",
    reason: iron
      ? `${picked.item.name} is the strongest bank upgrade worth sourcing for this fight.`
      : affordable
        ? `${picked.item.name} is the highest-impact tested upgrade inside your visible coin stack.`
        : `${picked.item.name} helps here, but your visible coin stack does not cover the rough cost yet.`
  };
}

function bossUpgradeCandidates(
  owned: GearItem[],
  boss: Boss,
  current: DpsBreakdown
): UpgradeCandidate[] {
  const ownedIds = new Set(owned.map((item) => item.id));
  const style: CombatStyle = current.style;
  const candidates: UpgradeCandidate[] = [];

  for (const item of GEAR) {
    if (ownedIds.has(item.id)) continue;
    if (item.slot === "weapon" && item.weaponStyle && item.weaponStyle !== style) continue;
    const setup = autoSetup([...owned, item], style);
    if (!setup.weapon) continue;
    const result = calcDps(setup, boss, style);
    const gain = result.dps - current.dps;
    if (gain <= 0.1) continue;
    candidates.push({
      item,
      gain,
      newTtk: result.ttk,
      approximatePrice: approximatePrice(item)
    });
  }

  return candidates.sort((a, b) => b.gain - a.gain);
}

function approximatePrice(item: GearItem): number | null {
  const normalized = normalizeItemName(item.name);
  return UPGRADES.find((upgrade) => normalizeItemName(upgrade.name) === normalized)?.approxPrice ?? null;
}

function normalizeItemName(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function bankCash(bankItems: BankHandoffItem[]): number {
  return bankItems.reduce((total, item) => {
    if (/^coins$/i.test(item.name)) return total + item.quantity;
    if (/^platinum token$/i.test(item.name)) return total + item.quantity * 1_000;
    return total;
  }, 0);
}

function ironSourcePath(itemName: string): string {
  const name = itemName.toLowerCase();
  if (name.includes("toxic blowpipe")) return "Kill Zulrah for a tanzanite fang, then charge it with scales and darts.";
  if (name.includes("bow of faerdhinen")) return "Complete Corrupted Gauntlet for an enhanced crystal weapon seed.";
  if (name.includes("trident")) return "Get the Slayer level, then kill cave krakens or the Kraken boss.";
  if (name.includes("abyssal whip")) return "Reach 85 Slayer and kill abyssal demons.";
  if (name.includes("abyssal tentacle")) return "Combine an abyssal whip with a Kraken tentacle.";
  if (name.includes("voidwaker")) return "Collect all three pieces from the Wilderness bosses; use a low-risk route.";
  if (name.includes("fighter torso")) return "Finish the four Barbarian Assault roles, then buy the torso with points.";
  if (name.includes("barrows gloves")) return "Finish Recipe for Disaster and buy them from the Culinaromancer's chest.";
  if (name.includes("fire cape")) return "Complete one Fight Caves run and defeat TzTok-Jad.";
  if (name.includes("infernal cape")) return "Finish the Inferno; treat it as a long-term skill unlock, not trip prep.";
  if (name.includes("dragon defender")) return "Earn tokens in the Warriors' Guild, then work through the defender tiers.";
  if (name.includes("salve amulet")) return "Complete Haunted Mine, then imbue the amulet before using it here.";
  return `Open ${itemName} sources on the OSRS Wiki and choose the shortest safe route for your account.`;
}
