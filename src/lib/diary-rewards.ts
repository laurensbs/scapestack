import type { DiaryTier } from "./diary-db";

export const DIARY_TIER_ORDER: DiaryTier[] = ["Easy", "Medium", "Hard", "Elite"];

export interface DiaryRewardDefinition {
  baseName: string;
  itemIds: [number, number, number, number];
}

export const DIARY_REWARDS: Record<string, DiaryRewardDefinition> = {
  Ardougne: { baseName: "Ardougne cloak", itemIds: [13121, 13122, 13123, 13124] },
  Desert: { baseName: "Desert amulet", itemIds: [13133, 13134, 13135, 13136] },
  Falador: { baseName: "Falador shield", itemIds: [13117, 13118, 13119, 13120] },
  Fremennik: { baseName: "Fremennik sea boots", itemIds: [13129, 13130, 13131, 13132] },
  Kandarin: { baseName: "Kandarin headgear", itemIds: [13137, 13138, 13139, 13140] },
  Karamja: { baseName: "Karamja gloves", itemIds: [11136, 11138, 11140, 13103] },
  "Kourend & Kebos": { baseName: "Rada's blessing", itemIds: [22941, 22943, 22945, 22947] },
  "Lumbridge & Draynor": { baseName: "Explorer's ring", itemIds: [13125, 13126, 13127, 13128] },
  Morytania: { baseName: "Morytania legs", itemIds: [13112, 13113, 13114, 13115] },
  Varrock: { baseName: "Varrock armour", itemIds: [13104, 13105, 13106, 13107] },
  "Western Provinces": { baseName: "Western banner", itemIds: [13141, 13142, 13143, 13144] },
  Wilderness: { baseName: "Wilderness sword", itemIds: [13108, 13109, 13110, 13111] }
};

export interface DiaryRewardBankItem {
  id?: number;
  name: string;
}

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function diaryTierNumber(tier: DiaryTier): 1 | 2 | 3 | 4 {
  return (DIARY_TIER_ORDER.indexOf(tier) + 1) as 1 | 2 | 3 | 4;
}

export function diaryRewardFor(region: string, tier: DiaryTier): { name: string; itemId: number } {
  const tierNumber = diaryTierNumber(tier);
  const reward = DIARY_REWARDS[region];
  return reward
    ? { name: `${reward.baseName} ${tierNumber}`, itemId: reward.itemIds[tierNumber - 1] }
    : { name: `${region} ${tier} reward`, itemId: 11140 };
}

export function highestOwnedDiaryRewardTier(region: string, bankItems: DiaryRewardBankItem[]): number {
  const reward = DIARY_REWARDS[region];
  if (!reward) return 0;
  const rewardName = normalized(reward.baseName);
  let highest = 0;
  for (const item of bankItems) {
    const itemName = normalized(item.name);
    const byId = item.id ? reward.itemIds.indexOf(item.id) + 1 : 0;
    const byName = itemName.startsWith(`${rewardName} `)
      ? Number.parseInt(itemName.slice(rewardName.length + 1), 10)
      : 0;
    const tier = Math.max(byId, Number.isFinite(byName) ? byName : 0);
    if (tier >= 1 && tier <= 4) highest = Math.max(highest, tier);
  }
  return highest;
}

export function inferredCompletedDiaryTierKeys(
  completed: Iterable<string>,
  bankItems: DiaryRewardBankItem[]
): Set<string> {
  const out = new Set<string>();
  for (const key of completed) {
    const splitAt = key.lastIndexOf(":");
    if (splitAt < 0) continue;
    const region = key.slice(0, splitAt);
    const tier = key.slice(splitAt + 1) as DiaryTier;
    const tierIndex = DIARY_TIER_ORDER.indexOf(tier);
    if (tierIndex < 0) continue;
    for (let index = 0; index <= tierIndex; index += 1) {
      out.add(`${region}:${DIARY_TIER_ORDER[index]}`);
    }
  }
  for (const region of Object.keys(DIARY_REWARDS)) {
    const highest = highestOwnedDiaryRewardTier(region, bankItems);
    for (let index = 0; index < highest; index += 1) {
      out.add(`${region}:${DIARY_TIER_ORDER[index]}`);
    }
  }
  return out;
}

export function diaryTierCompletionEvidence(input: {
  region: string;
  tier: DiaryTier;
  exactCompleted: Iterable<string>;
  bankItems: DiaryRewardBankItem[];
}): "runelite" | "reward" | null {
  const key = `${input.region}:${input.tier}`;
  const exact = new Set(input.exactCompleted);
  if (exact.has(key)) return "runelite";
  return highestOwnedDiaryRewardTier(input.region, input.bankItems) >= diaryTierNumber(input.tier)
    ? "reward"
    : null;
}
