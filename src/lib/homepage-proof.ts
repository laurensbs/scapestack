import itemMeta from "../../data/item-meta.json";
import quests from "../../data/quests.json";
import { BOSSES } from "@/lib/bosses";
import {
  HOMEPAGE_BOSS_RENDERS,
  type HomepageBossRender
} from "@/lib/homepage-boss-renders";

interface PricedItem {
  value?: number | null;
}

export interface HomepageProof {
  boss: HomepageBossRender;
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

export function homepageBossForDate(now: Date): HomepageBossRender {
  return HOMEPAGE_BOSS_RENDERS[dailyBossIndex(now, HOMEPAGE_BOSS_RENDERS.length)];
}

export function buildHomepageProof(now = new Date()): HomepageProof {
  return {
    boss: homepageBossForDate(now),
    bossesChecked: BOSSES.length,
    questsTracked: Object.keys(quests).length,
    itemsPriced: Object.values(itemMeta as Record<string, PricedItem>)
      .filter((item) => Number(item.value) > 0).length
  };
}
