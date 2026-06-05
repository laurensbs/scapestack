// OSRS Wiki data service.
// Sources:
// - https://prices.runescape.wiki/api/v1/osrs/mapping
// - https://prices.runescape.wiki/api/v1/osrs/latest
//
// Keep this module framework-agnostic so server actions, route handlers and
// tests can share one parser/cache layer.

const USER_AGENT = "scapestack/0.6 (+https://www.scapestack.org)";
const MAPPING_URL = "https://prices.runescape.wiki/api/v1/osrs/mapping";
const LATEST_URL = "https://prices.runescape.wiki/api/v1/osrs/latest";
const MAPPING_TTL_MS = 24 * 60 * 60 * 1000;
const LATEST_TTL_MS = 10 * 60 * 1000;
const FAILED_TTL_MS = 60 * 60 * 1000;

export interface WikiItemMapping {
  id: number;
  name: string;
  examine?: string;
  members: boolean;
  limit: number;
  highalch: number;
  lowalch: number;
  icon?: string;
}

export interface WikiLatestPrice {
  id: number;
  high: number;
  low: number;
  highTime: number;
  lowTime: number;
  value: number;
}

let mappingCache: { fetchedAt: number; data: Map<number, WikiItemMapping> } | null = null;
let latestCache: { fetchedAt: number; data: Map<number, WikiLatestPrice> } | null = null;
let mappingFailureAt = 0;
let latestFailureAt = 0;

export function wikiSearchUrl(query: string): string {
  return `https://oldschool.runescape.wiki/w/Special:Search?search=${encodeURIComponent(query.trim())}`;
}

export async function getWikiItemMapping(): Promise<Map<number, WikiItemMapping>> {
  const now = Date.now();
  if (mappingCache && now - mappingCache.fetchedAt < MAPPING_TTL_MS) return mappingCache.data;
  if (!mappingCache && mappingFailureAt && now - mappingFailureAt < FAILED_TTL_MS) return new Map();

  try {
    const response = await fetch(MAPPING_URL, {
      headers: { "user-agent": USER_AGENT, accept: "application/json" }
    });
    if (!response.ok) throw new Error(`Wiki mapping HTTP ${response.status}`);
    const body = await response.json() as Array<Record<string, unknown>>;
    const data = parseWikiMapping(body);
    mappingCache = { fetchedAt: now, data };
    return data;
  } catch {
    mappingFailureAt = now;
    return mappingCache?.data ?? new Map();
  }
}

export async function getLatestPrices(): Promise<Map<number, WikiLatestPrice>> {
  const now = Date.now();
  if (latestCache && now - latestCache.fetchedAt < LATEST_TTL_MS) return latestCache.data;
  if (!latestCache && latestFailureAt && now - latestFailureAt < FAILED_TTL_MS) return new Map();

  try {
    const response = await fetch(LATEST_URL, {
      headers: { "user-agent": USER_AGENT, accept: "application/json" }
    });
    if (!response.ok) throw new Error(`Wiki latest HTTP ${response.status}`);
    const body = await response.json() as { data?: Record<string, Record<string, unknown>> };
    const data = parseLatestPrices(body.data ?? {});
    latestCache = { fetchedAt: now, data };
    return data;
  } catch {
    latestFailureAt = now;
    return latestCache?.data ?? new Map();
  }
}

export async function getItemPrice(itemId: number): Promise<WikiLatestPrice | null> {
  const cleanId = Math.abs(Math.trunc(itemId));
  if (!cleanId) return null;
  const prices = await getLatestPrices();
  return prices.get(cleanId) ?? null;
}

export function parseWikiMapping(body: Array<Record<string, unknown>>): Map<number, WikiItemMapping> {
  const out = new Map<number, WikiItemMapping>();
  for (const entry of body) {
    const id = Number(entry.id);
    const name = typeof entry.name === "string" ? entry.name : "";
    if (!Number.isFinite(id) || !name) continue;
    out.set(id, {
      id,
      name,
      examine: typeof entry.examine === "string" ? entry.examine : undefined,
      members: Boolean(entry.members),
      limit: Number(entry.limit) || 0,
      highalch: Number(entry.highalch) || 0,
      lowalch: Number(entry.lowalch) || 0,
      icon: typeof entry.icon === "string" ? entry.icon : undefined
    });
  }
  return out;
}

export function parseLatestPrices(body: Record<string, Record<string, unknown>>): Map<number, WikiLatestPrice> {
  const out = new Map<number, WikiLatestPrice>();
  for (const [idText, entry] of Object.entries(body)) {
    const id = Number(idText);
    if (!Number.isFinite(id)) continue;
    const high = Number(entry.high) || 0;
    const low = Number(entry.low) || 0;
    const highTime = Number(entry.highTime) || 0;
    const lowTime = Number(entry.lowTime) || 0;
    const value = high && low ? Math.max(high, low) : high || low || 0;
    if (!value) continue;
    out.set(id, { id, high, low, highTime, lowTime, value });
  }
  return out;
}
