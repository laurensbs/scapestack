// collectionlog.net API client.
//
// cl.net hosts a public REST API for collection-log state. Data is
// populated by their RuneLite plugin — players who use it have their
// collection log uploaded to cl.net's servers, after which other tools
// can read it. We treat this as best-effort enrichment: a 404 means the
// player isn't tracked (didn't use the plugin), not an error.
//
// Endpoint: api.collectionlog.net/collectionlog/user/{username}
// Returns: { collectionLog: { tabs: { Bosses: { entries: { ... } }, ... } } }
//
// We extract two signals:
//   1. owned-item-ids — every item the player has the "obtained" flag for.
//      Powers boss-rec filtering ('skip if player already has this drop')
//      with real data instead of bank-paste guesswork.
//   2. uniqueObtained — total count + per-tab counts for the path-progress.

export interface CollectionLog {
  /** Player's canonical name from cl.net. */
  displayName: string;
  /** Total unique items obtained across the whole log. */
  uniqueObtained: number;
  uniqueItems: number;
  /** Set of OSRS item-IDs the player has at least one of. Used by the
   *  /next engine to skip KC-recs for already-owned drops with real
   *  data instead of guessing from a bank-paste. */
  ownedItemIds: Set<number>;
  /** Per-tab obtained/total counts for the path-progress UI.
   *  Keys: 'Bosses', 'Raids', 'Clues', 'Minigames', 'Other'. */
  tabs: Record<string, { obtained: number; total: number }>;
  /** When the player last synced via the plugin. ISO string. */
  lastSyncedAt: string | null;
}

const ENDPOINT = "https://api.collectionlog.net/collectionlog/user";
const UA = "scapestack/0.5 (+https://www.scapestack.org)";

/** Returns parsed collection-log state, or null when the player isn't on
 *  cl.net / the request failed / the payload was malformed. Never throws. */
export async function fetchCollectionLog(
  rsn: string,
  options: { signal?: AbortSignal } = {}
): Promise<CollectionLog | null> {
  const cleaned = rsn.trim();
  if (!cleaned) return null;
  const url = `${ENDPOINT}/${encodeURIComponent(cleaned)}`;
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA },
      signal: options.signal,
      next: { revalidate: 300 } // 5 min cache, matches Hiscores/WOM
    });
    if (!res.ok) return null;
    const data = await res.json();
    return parse(data);
  } catch {
    return null;
  }
}

interface RawItem {
  id?: number;
  name?: string;
  obtained?: boolean;
  quantity?: number;
}

interface RawEntry {
  name?: string;
  items?: RawItem[];
}

interface RawTab {
  [entryName: string]: RawEntry;
}

function parse(raw: unknown): CollectionLog | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const log = r.collectionLog as Record<string, unknown> | undefined;
  if (!log || typeof log !== "object") return null;

  const username = typeof log.username === "string" ? log.username : (typeof r.username === "string" ? r.username : null);
  if (!username) return null;

  const uniqueObtained = typeof log.uniqueObtained === "number" ? log.uniqueObtained : 0;
  const uniqueItems = typeof log.uniqueItems === "number" ? log.uniqueItems : 0;

  const ownedItemIds = new Set<number>();
  const tabsOut: Record<string, { obtained: number; total: number }> = {};

  const tabs = log.tabs as Record<string, RawTab> | undefined;
  if (tabs && typeof tabs === "object") {
    for (const [tabName, entries] of Object.entries(tabs)) {
      let obtained = 0;
      let total = 0;
      for (const entry of Object.values(entries)) {
        for (const item of entry.items ?? []) {
          if (typeof item.id !== "number") continue;
          total++;
          // cl.net flags `obtained: true` when the player has at least one.
          // Some plugin versions also write `quantity > 0` without the
          // boolean; treat either as obtained.
          if (item.obtained || (typeof item.quantity === "number" && item.quantity > 0)) {
            obtained++;
            ownedItemIds.add(item.id);
          }
        }
      }
      tabsOut[tabName] = { obtained, total };
    }
  }

  const lastSyncedAt = typeof log.uploadedAt === "string"
    ? log.uploadedAt
    : (typeof log.updatedAt === "string" ? log.updatedAt : null);

  return {
    displayName: username,
    uniqueObtained,
    uniqueItems,
    ownedItemIds,
    tabs: tabsOut,
    lastSyncedAt
  };
}
