// TempleOSRS API client.
//
// Temple tracks XP + KC like WOM, but also surfaces per-quest completion
// state for accounts that use their RuneLite plugin or the official
// Quest list importer. The endpoint we care about is:
//
//   https://templeosrs.com/api/player_quests.php?player={name}
//
// Returns a per-quest table with completion status (0/1/2 — not started /
// in progress / complete). That's the actual quest-state data we've been
// guessing at with heuristics — for Temple-tracked players we use this
// directly instead of the QP-budget walk.
//
// We treat Temple as best-effort enrichment: 404 / unknown player /
// malformed payload all return null, callers fall back to heuristics.

export interface TempleData {
  /** Player's name as Temple has it. */
  displayName: string;
  /** Quest-name → completion status (true when completed). The set of
   *  quest names matches OSRS Wiki names; we resolve to our quest-db
   *  entries by lowercased name match. */
  questsCompleted: Set<string>;
  /** When Temple last imported this player's data. */
  lastUpdatedAt: string | null;
}

const ENDPOINT = "https://templeosrs.com/api";
const UA = "scapestack/0.5 (+https://www.scapestack.org)";

interface RawQuestRow {
  quest?: string;
  status?: number | string; // sometimes string-number from the legacy endpoint
}

interface RawQuestResponse {
  data?: {
    quests?: RawQuestRow[] | Record<string, RawQuestRow>;
    info?: { Username?: string; "Last changed"?: string };
  };
}

export async function fetchTemple(rsn: string): Promise<TempleData | null> {
  const cleaned = rsn.trim();
  if (!cleaned) return null;
  const url = `${ENDPOINT}/player_quests.php?player=${encodeURIComponent(cleaned)}`;
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA },
      next: { revalidate: 300 }
    });
    if (!res.ok) return null;
    const data = await res.json() as RawQuestResponse;
    return parse(cleaned, data);
  } catch {
    return null;
  }
}

function parse(fallbackName: string, raw: RawQuestResponse): TempleData | null {
  const d = raw?.data;
  if (!d) return null;

  const completed = new Set<string>();
  const rows = d.quests;
  if (Array.isArray(rows)) {
    for (const r of rows) {
      if (typeof r?.quest !== "string") continue;
      const status = typeof r.status === "number" ? r.status : Number(r.status);
      // Temple status convention: 0 = not started, 1 = in progress, 2 = complete.
      if (status >= 2) completed.add(r.quest.toLowerCase());
    }
  } else if (rows && typeof rows === "object") {
    // Some Temple endpoints return a quest-name-keyed object instead of
    // an array. Handle both shapes.
    for (const [name, r] of Object.entries(rows)) {
      const status = typeof r?.status === "number" ? r.status : Number(r?.status);
      if (status >= 2) completed.add(name.toLowerCase());
    }
  } else {
    // No quest data at all — treat as 'not tracked', not as 'no quests
    // done.' Callers should fall back to heuristics in this case.
    return null;
  }

  return {
    displayName: d.info?.Username ?? fallbackName,
    questsCompleted: completed,
    lastUpdatedAt: d.info?.["Last changed"] ?? null
  };
}
