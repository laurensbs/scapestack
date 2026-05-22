// OSRS Wiki real-time price feed.
// Public endpoint, no auth. We cache 1h in-process; if a fetch fails and we
// have stale data, fall back to it instead of breaking organize.

const URL = "https://prices.runescape.wiki/api/v1/osrs/latest";
const USER_AGENT = "osrs-bank-organizer/0.2 - personal project";
const TTL_MS = 60 * 60 * 1000;

let cache: { fetchedAt: number; prices: Map<number, number> } | null = null;
let inflight: Promise<Map<number, number>> | null = null;

async function doFetch(): Promise<Map<number, number>> {
  const res = await fetch(URL, { headers: { "user-agent": USER_AGENT, accept: "application/json" } });
  if (!res.ok) throw new Error(`Wiki prices HTTP ${res.status}`);
  const body = (await res.json()) as { data?: Record<string, { high?: number; low?: number }> };
  const prices = new Map<number, number>();
  for (const [idStr, p] of Object.entries(body.data || {})) {
    const id = Number(idStr);
    if (!Number.isFinite(id)) continue;
    const high = Number(p?.high) || 0;
    const low = Number(p?.low) || 0;
    // Match RuneLite Bank Memory's "Bank value" — it uses the highest of the
    // two recent trades (effectively instant-buy / GE high price). Averaging
    // produced consistently lower totals than what players see in-game.
    let value = 0;
    if (high && low) value = Math.max(high, low);
    else value = high || low || 0;
    if (value > 0) prices.set(id, value);
  }
  return prices;
}

export async function getPrices(): Promise<Map<number, number>> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < TTL_MS) return cache.prices;
  if (inflight) return inflight;
  inflight = doFetch()
    .then((prices) => {
      cache = { fetchedAt: now, prices };
      inflight = null;
      return prices;
    })
    .catch((err) => {
      inflight = null;
      if (cache) {
        console.warn("Wiki prices fetch failed, using stale cache:", err.message);
        return cache.prices;
      }
      console.warn("Wiki prices fetch failed and no cache:", err.message);
      return new Map<number, number>();
    });
  return inflight;
}

// Items that aren't traded on the GE but have a fixed in-game value.
// Wiki price feed doesn't include these — we hardcode.
const FIXED_VALUES: Record<number, number> = {
  995: 1,        // Coins (each)
  13204: 1000    // Platinum tokens
};

// Some items have an "uncharged" variant ID that never trades on the GE — the
// "charged" version is what's listed. Map uncharged → charged so the player
// sees a meaningful gp value either way.
const PRICE_ALIASES: Record<number, number> = {
  12926: 12924,  // Toxic blowpipe (empty) → Toxic blowpipe (charged)
  22325: 22486,  // Scythe of vitur (uncharged) → Scythe of vitur
  22324: 22486,  // Scythe of vitur (uncharged variant)
  23987: 22324,  // Holy scythe of vitur (uncharged)
  25731: 22486,  // Sanguine scythe of vitur (uncharged)
  24417: 22486,  // (older variant id)
  // Trident variants
  11907: 11905,  // Trident of the seas (uncharged) → charged
  12900: 12899,  // Trident of the swamp (uncharged) → charged
  22291: 22288,  // Toxic staff of the dead (uncharged) → charged
  // Bow of faerdhinen variants
  25865: 25862,  // Bow of faerdhinen (charged) ↔ inactive
  25862: 25865,
  // Crystal bow / shield variants
  4214: 23983    // Crystal bow (inactive) → corrupted equivalent
};

export function priceFor(prices: Map<number, number> | null, id: number): number {
  const absId = Math.abs(Number(id));
  if (FIXED_VALUES[absId]) return FIXED_VALUES[absId];
  if (!prices) return 0;
  const direct = prices.get(absId);
  if (direct) return direct;
  const alias = PRICE_ALIASES[absId];
  if (alias) return prices.get(alias) || 0;
  return 0;
}
