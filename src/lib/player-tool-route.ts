import { playerPath, type PlayerRouteSearchParams } from "./player-route";

export type PlayerToolSection = "bosses" | "sets" | "task" | "money";

const SECTION_FROM_SOURCE: Record<string, PlayerToolSection> = {
  dps: "bosses",
  goals: "sets",
  slayer: "task",
  money: "money"
};

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function playerToolSectionPath(rsn: string, section: PlayerToolSection): string {
  // /u, not /p: the four tool sections moved to the account detail page on
  // 2026-08-08 (found by the adversarial pass — every /dps, /goals, /slayer
  // and mobile-bar entry pointed at an anchor that no longer existed).
  return `/u/${encodeURIComponent(rsn)}#${section}`;
}

export function bankIntakeForSection(section: PlayerToolSection): string {
  return `/bank?section=${section}`;
}

export function rsnFromToolQuery(query: PlayerRouteSearchParams): string {
  return first(query.rsn).slice(0, 12);
}

export function sectionFromBankQuery(query: PlayerRouteSearchParams): PlayerToolSection {
  const explicit = first(query.section);
  if (explicit === "bosses" || explicit === "sets" || explicit === "task" || explicit === "money") {
    return explicit;
  }
  return SECTION_FROM_SOURCE[first(query.from).toLowerCase()] ?? "sets";
}
