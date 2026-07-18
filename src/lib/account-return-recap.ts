import type { AccountTimelineMoment } from "./account-timeline";

export interface AccountReturnRecapMoment {
  id: string;
  title: string;
  detail: string | null;
  kind: AccountTimelineMoment["kind"];
}

export interface AccountReturnRecap {
  title: string;
  lead: string;
  moments: AccountReturnRecapMoment[];
  nextAction: string;
  nextHref: string;
  visualItemId: number;
  latestMomentId: string;
}

const MOMENT_WEIGHT: Partial<Record<AccountTimelineMoment["kind"], number>> = {
  outcome: 110,
  quest: 100,
  diary: 96,
  "collection-log": 92,
  level: 88,
  boss: 84,
  slayer: 80,
  xp: 72,
  trip: 60,
  plan: 48,
  bank: 24
};

const KIND_VISUAL: Partial<Record<AccountTimelineMoment["kind"], number>> = {
  outcome: 9951,
  quest: 9813,
  diary: 13103,
  "collection-log": 20594,
  level: 9763,
  boss: 11864,
  slayer: 4155,
  xp: 2537,
  trip: 9951,
  plan: 8007,
  bank: 8007
};

function weight(moment: AccountTimelineMoment): number {
  return MOMENT_WEIGHT[moment.kind] ?? 0;
}

function progressMoment(moment: AccountTimelineMoment): boolean {
  if (moment.kind === "bank" || moment.kind === "plan") return false;
  if (moment.kind === "trip") return /^Finished\s/i.test(moment.title);
  return weight(moment) > 0;
}

function meaningfulMoments(moments: AccountTimelineMoment[]): AccountTimelineMoment[] {
  const seen = new Set<string>();
  return moments
    .filter(progressMoment)
    .sort((left, right) => {
      const byWeight = weight(right) - weight(left);
      if (byWeight !== 0) return byWeight;
      return Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
    })
    .filter((moment) => {
      const key = `${moment.kind}:${moment.title.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function recapTitle(moment: AccountTimelineMoment): string {
  if (moment.kind === "outcome") return "Last stop point changed the route";
  if (moment.kind === "quest" || moment.kind === "diary") return "Finished unlocks are out of the way";
  if (moment.kind === "boss") return "KC moved since last time";
  if (moment.kind === "level" || moment.kind === "xp") return "Levels moved since last time";
  if (moment.kind === "collection-log") return "New clog progress landed";
  if (moment.kind === "slayer") return "Slayer moved forward";
  return "Your last trip is saved";
}

function recapLead(moment: AccountTimelineMoment): string {
  if (moment.kind === "outcome") return "Scapestack can stop repeating that exact block and pick the next clean trip.";
  if (moment.kind === "quest" || moment.kind === "diary") return "The next plan can skip those requirements instead of sending you back through them.";
  if (moment.kind === "boss") return "Boss KC changes whether another trip, a backup or an unlock makes more sense.";
  if (moment.kind === "level" || moment.kind === "xp") return "The next plan can use the newer level gap instead of stale goals.";
  if (moment.kind === "collection-log") return "Finished slots should stop showing up as targets.";
  if (moment.kind === "slayer") return "Task, points or streak changes can move Slayer routes up or down.";
  return "Open the next trip from the latest saved progress.";
}

function nextAction(moment: AccountTimelineMoment): string {
  if (moment.kind === "outcome" && moment.outcomeStatus === "progressed") return "Continue or reroll the trip";
  if (moment.kind === "boss") return "Pick the next KC block";
  if (moment.kind === "quest" || moment.kind === "diary" || moment.kind === "collection-log") return "Find the next unlock";
  if (moment.kind === "level" || moment.kind === "xp") return "Replan from new levels";
  if (moment.kind === "slayer") return "Check the task route";
  return "Open next trip";
}

export function buildAccountReturnRecap(input: {
  moments: AccountTimelineMoment[];
  account?: { rsn?: string | null } | null;
}): AccountReturnRecap | null {
  const picks = meaningfulMoments(input.moments).slice(0, 3);
  const primary = picks[0];
  if (!primary) return null;
  const rsn = input.account?.rsn?.trim();
  const nextHref = rsn ? `/next?rsn=${encodeURIComponent(rsn)}&from=recap` : "/next?from=recap";
  return {
    title: recapTitle(primary),
    lead: recapLead(primary),
    moments: picks.map((moment) => ({
      id: moment.id,
      title: moment.title,
      detail: moment.detail ?? null,
      kind: moment.kind
    })),
    nextAction: nextAction(primary),
    nextHref,
    visualItemId: KIND_VISUAL[primary.kind] ?? 9951,
    latestMomentId: input.moments[0]?.id ?? primary.id
  };
}
