// OSRS item metadata from the Wiki mapping endpoint.
// Source: prices.runescape.wiki/api/v1/osrs/mapping — public, no auth.
// Provides highalch / lowalch / GE-buy-limit / examine text per item.
// Cached 24h (alch values are baked into the game, they don't move).

const URL = "https://prices.runescape.wiki/api/v1/osrs/mapping";
const USER_AGENT = "scapestack/0.3 - personal project";
const TTL_MS = 24 * 60 * 60 * 1000;

export interface AlchEntry {
  highalch: number;
  lowalch: number;
  limit: number;       // GE buy limit (4-hr)
  examine?: string;
  members: boolean;
}

let cache: { fetchedAt: number; data: Map<number, AlchEntry> } | null = null;
let inflight: Promise<Map<number, AlchEntry>> | null = null;

async function doFetch(): Promise<Map<number, AlchEntry>> {
  const res = await fetch(URL, { headers: { "user-agent": USER_AGENT, accept: "application/json" } });
  if (!res.ok) throw new Error(`Wiki mapping HTTP ${res.status}`);
  const body = (await res.json()) as Array<{
    id: number;
    highalch?: number;
    lowalch?: number;
    limit?: number;
    examine?: string;
    members?: boolean;
  }>;
  const out = new Map<number, AlchEntry>();
  for (const entry of body) {
    if (!Number.isFinite(entry.id)) continue;
    out.set(entry.id, {
      highalch: entry.highalch ?? 0,
      lowalch: entry.lowalch ?? 0,
      limit: entry.limit ?? 0,
      examine: entry.examine,
      members: !!entry.members
    });
  }
  return out;
}

export async function getAlchData(): Promise<Map<number, AlchEntry>> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < TTL_MS) return cache.data;
  if (inflight) return inflight;
  inflight = doFetch()
    .then((data) => {
      cache = { fetchedAt: now, data };
      inflight = null;
      return data;
    })
    .catch((err) => {
      inflight = null;
      if (cache) {
        console.warn("Wiki mapping fetch failed, using stale cache:", err.message);
        return cache.data;
      }
      console.warn("Wiki mapping fetch failed and no cache:", err.message);
      return new Map<number, AlchEntry>();
    });
  return inflight;
}

export function alchFor(data: Map<number, AlchEntry> | null, id: number): AlchEntry | null {
  if (!data) return null;
  return data.get(Math.abs(Number(id))) || null;
}
