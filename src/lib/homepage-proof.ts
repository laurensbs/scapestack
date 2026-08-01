import itemMeta from "../../data/item-meta.json";
import quests from "../../data/quests.json";
import { BOSSES, type Boss } from "@/lib/bosses";

interface PricedItem {
  value?: number | null;
}

export interface HomepageProof {
  boss: Boss;
  bossesChecked: number;
  questsTracked: number;
  itemsPriced: number;
}

export function dailyBossIndex(now: Date, count: number): number {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError("A daily boss needs a non-empty roster.");
  }
  const utcDay = Math.floor(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  ) / 86_400_000);
  return utcDay % count;
}

export function buildHomepageProof(now = new Date()): HomepageProof {
  const spriteBosses = BOSSES.filter((boss) => typeof boss.iconItemId === "number");
  const boss = spriteBosses[dailyBossIndex(now, spriteBosses.length)];
  if (!boss) throw new Error("The boss roster has no sprite-backed subject.");

  return {
    boss,
    bossesChecked: BOSSES.length,
    questsTracked: Object.keys(quests).length,
    itemsPriced: Object.values(itemMeta as Record<string, PricedItem>)
      .filter((item) => Number(item.value) > 0).length
  };
}
