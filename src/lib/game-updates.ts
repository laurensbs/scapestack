// What the game added while the player was gone.
//
// A returning player's first question is not "what should I do next" — it is
// "what did I miss". Scapestack knew the answer was needed (wom.ts has fetched
// lastChangedAt from the start) and had no data to answer it with.
//
// Sourcing rule, and it is strict: every date below was read off the OSRS Wiki
// infobox for that piece of content, not recalled. Nothing goes in this file
// that has not been checked there. A wrong date here is worse than a missing
// entry, because it is presented to the player as fact about their own absence.
//
// Coverage is deliberately partial. This lists content a returning player would
// recognise as an event — a new skill, a raid, a boss, a region — plus every
// quest since 2019. It is not a changelog, and it should never grow into one:
// the briefing exists to orient someone in thirty seconds, and a complete list
// of updates orients nobody.

import { cleanName } from "./name-key";

export type GameUpdateKind = "skill" | "raid" | "boss" | "activity" | "region";

export interface GameUpdate {
  id: string;
  name: string;
  /** ISO date (UTC midnight). Verified against the wiki infobox. */
  releasedOn: string;
  kind: GameUpdateKind;
  /** What it is, in one line a player who has never seen it can act on. */
  blurb: string;
  /** What stands between the player and it. Null when only levels do. */
  requirement: string | null;
}

/**
 * Ordering weight. A new skill is the thing you tell someone first; a boss they
 * cannot reach for another forty levels is the thing you tell them last.
 */
const KIND_WEIGHT: Record<GameUpdateKind, number> = {
  skill: 100,
  region: 90,
  raid: 80,
  boss: 60,
  activity: 50
};

export const GAME_UPDATES: GameUpdate[] = [
  {
    id: "sailing",
    name: "Sailing",
    releasedOn: "2025-11-19",
    kind: "skill",
    blurb: "The first new skill since launch. Captain a boat and open up the ocean.",
    requirement: "Needs the quest Pandemonium"
  },
  {
    id: "varlamore",
    name: "Varlamore",
    // The region, not its opening quest. 2024-01-10 is Children of the Sun,
    // which Jagex shipped ten weeks early so players would be ready; the wiki
    // infobox for Varlamore itself reads 20 March 2024. Copying the quest's
    // date here hid the entire region from anyone who left between the two.
    releasedOn: "2024-03-20",
    kind: "region",
    blurb: "A whole new region south of Zeah, added in three parts since 2024.",
    requirement: "Starts with the quest Children of the Sun"
  },
  {
    id: "tombs-of-amascut",
    name: "Tombs of Amascut",
    releasedOn: "2022-08-24",
    kind: "raid",
    blurb: "The third raid, scalable from solo to eight and from easy to brutal.",
    requirement: "Needs the quest Beneath Cursed Sands"
  },
  {
    id: "doom-of-mokhaiotl",
    name: "Doom of Mokhaiotl",
    releasedOn: "2025-07-23",
    kind: "boss",
    blurb: "Endless-delve boss beneath the Tlati Rainforest that scales as you push.",
    requirement: "Reached through the quest The Final Dawn"
  },
  {
    id: "araxxor",
    name: "Araxxor",
    releasedOn: "2024-08-28",
    kind: "boss",
    blurb: "Morytania spider boss, killed on a spider or araxyte task.",
    requirement: "Needs 92 Slayer"
  },
  {
    id: "fortis-colosseum",
    name: "Fortis Colosseum",
    releasedOn: "2024-03-20",
    kind: "activity",
    // Not "no supplies carried in" — that is The Gauntlet. The Colosseum is a
    // dangerous instance you bring brews and restores into, and telling a
    // returning player otherwise would cost them their gear.
    blurb: "Twelve waves of gladiator combat in Varlamore, ending with Sol Heredit.",
    requirement: "Needs the quest Children of the Sun"
  },
  {
    id: "nex",
    name: "Nex",
    releasedOn: "2022-01-05",
    kind: "boss",
    blurb: "The fifth God Wars boss, behind the Frozen Door in the Ancient Prison.",
    requirement: "Needs 70 Hitpoints, Ranged, Strength and Agility, and The Frozen Door"
  },
  {
    id: "guardians-of-the-rift",
    name: "Guardians of the Rift",
    releasedOn: "2022-03-23",
    kind: "activity",
    blurb: "Group Runecraft minigame — the way most accounts train Runecraft now.",
    requirement: "Needs the quest Temple of the Eye"
  },
  {
    id: "forestry",
    name: "Forestry",
    releasedOn: "2023-06-28",
    kind: "activity",
    blurb: "Woodcutting is shared instead of contested, with events at every tree.",
    requirement: null
  }
];

/**
 * Quest name to release date, for every quest released since 2019 that
 * data/quests.json knows about.
 *
 * Names must match that file exactly — a test asserts it. That join is the
 * point: it lets the briefing skip quests a synced player already finished, and
 * it means a typo fails the build instead of silently dropping a quest out of
 * the list. It is also the coverage boundary: a 2019+ quest the quest database
 * has never heard of cannot be listed here, because nothing downstream could
 * resolve it. "Daddy's Home" is the one such case today.
 */
export const QUEST_RELEASES: Record<string, string> = {
  "The Ascent of Arceuus": "2019-01-10",
  "The Forsaken Tower": "2019-01-10",
  "X Marks the Spot": "2019-02-07",
  "Song of the Elves": "2019-07-25",
  "The Fremennik Exiles": "2019-09-26",
  "Sins of the Father": "2020-06-04",
  "A Porcine of Interest": "2020-09-10",
  "Getting Ahead": "2020-11-25",
  "Below Ice Mountain": "2021-04-14",
  "A Night at the Theatre": "2021-06-03",
  "A Kingdom Divided": "2021-06-16",
  "Land of the Goblins": "2022-02-09",
  "Temple of the Eye": "2022-03-23",
  "Beneath Cursed Sands": "2022-04-27",
  "Sleeping Giants": "2022-06-08",
  "The Garden of Death": "2022-11-30",
  "Secrets of the North": "2023-01-11",
  "Desert Treasure II - The Fallen Empire": "2023-07-26",
  "The Path of Glouphrie": "2023-09-13",
  "Children of the Sun": "2024-01-10",
  "Defender of Varrock": "2024-02-21",
  "At First Light": "2024-03-20",
  "Twilight's Promise": "2024-03-20",
  "Perilous Moons": "2024-03-20",
  "The Ribbiting Tale of a Lily Pad Labour Dispute": "2024-03-20",
  "The Heart of Darkness": "2024-09-25",
  "Death on the Isle": "2024-09-25",
  "Meat and Greet": "2024-09-25",
  "Ethically Acquired Antiquities": "2024-09-25",
  "The Curse of Arrav": "2024-11-06",
  "The Final Dawn": "2025-07-23",
  "Shadows of Custodia": "2025-07-23",
  "Scrambled!": "2025-07-23",
  "Learning the Ropes": "2025-10-22",
  "Troubled Tortugans": "2025-11-19",
  "Current Affairs": "2025-11-19",
  "Prying Times": "2025-11-19",
  "Pandemonium": "2025-11-19",
  "The Ides of Milk": "2026-02-25",
  "The Red Reef": "2026-05-20",
  "The Blood Moon Rises": "2026-06-30"
};

export interface QuestRelease {
  name: string;
  releasedOn: string;
}

export interface UpdatesSince {
  headline: GameUpdate[];
  quests: QuestRelease[];
  /** Total across both lists, before any display cap. */
  total: number;
}

function releasedAfter(iso: string, since: number, now: number): boolean {
  const at = Date.parse(`${iso}T00:00:00Z`);
  return Number.isFinite(at) && at > since && at <= now;
}

/**
 * Everything added between `sinceIso` and now, newest first.
 *
 * `completedQuestNames` is optional and only ever *removes* entries. A player
 * with a RuneLite sync has real quest completion, so telling them Perilous
 * Moons is new when they finished it last year would be the kind of confidently
 * wrong statement that costs the whole page its credibility. Without a sync we
 * cannot know, so we show the quest — over-inclusion is the safe direction
 * here, because the worst case is a player recognising a name and moving on.
 */
export function updatesSince(
  sinceIso: string | null | undefined,
  options: { now?: number; completedQuestNames?: ReadonlySet<string> } = {}
): UpdatesSince {
  const empty: UpdatesSince = { headline: [], quests: [], total: 0 };
  if (!sinceIso) return empty;
  const since = Date.parse(sinceIso);
  if (!Number.isFinite(since)) return empty;
  const now = options.now ?? Date.now();

  const headline = GAME_UPDATES
    .filter((update) => releasedAfter(update.releasedOn, since, now))
    .sort((left, right) =>
      KIND_WEIGHT[right.kind] - KIND_WEIGHT[left.kind]
      || right.releasedOn.localeCompare(left.releasedOn));

  // Matched on the canonical key, never raw. RuneLite's quest labels and the
  // wiki's differ on punctuation often enough that an exact compare would
  // silently match nothing and show a synced player every quest as new.
  const done = options.completedQuestNames
    ? new Set([...options.completedQuestNames].map(cleanName))
    : null;
  const quests = Object.entries(QUEST_RELEASES)
    .filter(([name, releasedOn]) =>
      releasedAfter(releasedOn, since, now) && !done?.has(cleanName(name)))
    .map(([name, releasedOn]) => ({ name, releasedOn }))
    .sort((left, right) => right.releasedOn.localeCompare(left.releasedOn)
      || left.name.localeCompare(right.name));

  return { headline, quests, total: headline.length + quests.length };
}
