import type { SlayerMonster } from "./slayer/types";
import { bossFromDpsParam } from "./dps-route";
import { wikiSearchUrl } from "./wiki";

export interface SlayerTaskActions {
  wikiHref: string;
  dpsHref: string | null;
  tags: string[];
}

export interface SlayerTaskActionOptions {
  hasBankContext?: boolean;
  rsn?: string | null;
  source?: string;
}

export function buildSlayerTaskActions(
  monster: SlayerMonster,
  options: SlayerTaskActionOptions = {}
): SlayerTaskActions {
  const boss = monster.isBoss ? bossFromDpsParam(monster.name) : null;
  const tags = [
    monster.weakness ? `weak: ${monster.weakness}` : null,
    monster.cannonable ? "cannon" : null,
    monster.isBoss ? "boss" : null
  ].filter(Boolean) as string[];
  const dpsHref = boss ? slayerBossDpsHref(boss.slug, options) : null;

  return {
    wikiHref: wikiSearchUrl(monster.name),
    dpsHref,
    tags
  };
}

function slayerBossDpsHref(
  bossSlug: string,
  options: SlayerTaskActionOptions
): string {
  const params = new URLSearchParams({
    boss: bossSlug,
    from: options.source ?? "slayer-task"
  });
  const cleanRsn = options.rsn?.trim();
  if (cleanRsn) params.set("rsn", cleanRsn);
  if (options.hasBankContext === false) params.set("bank", "none");
  return `/dps?${params.toString()}`;
}
