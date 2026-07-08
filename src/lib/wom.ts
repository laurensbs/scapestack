// Wise Old Man API client.
//
// WOM tracks XP + KC progression for players who use their RuneLite
// plugin (or get auto-tracked through groups). When a player is in WOM
// we get richer data than the OSRS Hiscores expose:
//   - Account type (regular / ironman / hardcore / ultimate / etc.)
//   - EHP / EHB — proxies for 'how invested is this account'
//   - lastChangedAt — when the player last gained XP (returning-player
//     detection becomes accurate)
//   - displayName — properly-cased canonical name
//
// What WOM does NOT expose (still no API for these):
//   - Per-quest completion state
//   - Per-diary tier completion state
//   - Per-item collection log (collectionlog.net has that, separate API)
//
// We treat WOM as best-effort enrichment: if a player isn't on WOM we
// silently fall back to Hiscores-only data, no UI difference.

export type WomAccountType = "regular" | "ironman" | "hardcore" | "ultimate" | "group" | "skiller" | "pure";

export interface WomPlayer {
  displayName: string;
  accountType: WomAccountType;
  combatLevel: number;
  totalLevel: number;
  totalXp: number;
  /** Efficient Hours Played — community-standard 'account maturity' score. */
  ehp: number;
  /** Efficient Hours Bossed. */
  ehb: number;
  /** When the player last gained XP (per WOM's snapshot). Null when
   *  WOM has never seen a change. */
  lastChangedAt: string | null;
  /** When WOM first saw this account. */
  registeredAt: string;
  /** Bosses with kills > 0. Keyed by WOM's snake_case metric name. */
  bossKills: Record<string, number>;
}

const ENDPOINT = "https://api.wiseoldman.net/v2";
const UA = "scapestack/0.5 (+https://www.scapestack.org)";

/** Returns null when the player isn't on WOM (404), when the request
 *  fails, or when the response is malformed. Never throws. Callers are
 *  expected to fall back to Hiscores-only behaviour in the null case. */
export async function fetchWom(rsn: string): Promise<WomPlayer | null> {
  const cleaned = rsn.trim();
  if (!cleaned) return null;
  // WOM canonicalises to lowercase + underscores. The endpoint accepts
  // either; we pass through whatever the user typed and let WOM resolve.
  const url = `${ENDPOINT}/players/${encodeURIComponent(cleaned)}`;
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA },
      next: { revalidate: 300 } // 5 min server-side cache, matches Hiscores
    });
    if (!res.ok) return null; // 404 = not on WOM, 5xx = WOM down, both fine
    const data = await res.json();
    return parse(data);
  } catch {
    return null;
  }
}

function parse(raw: unknown): WomPlayer | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.displayName !== "string") return null;

  const snapshot = r.latestSnapshot as Record<string, unknown> | undefined;
  const data = snapshot?.data as Record<string, unknown> | undefined;
  const skills = data?.skills as Record<string, { level?: number; experience?: number }> | undefined;
  const bosses = data?.bosses as Record<string, { kills?: number }> | undefined;

  const overall = skills?.overall;
  const bossKills: Record<string, number> = {};
  if (bosses) {
    for (const [name, b] of Object.entries(bosses)) {
      const k = b?.kills;
      // WOM uses -1 for 'unranked' (= no public KC). Skip those — they
      // add no signal and look like noise in our path-progress.
      if (typeof k === "number" && k > 0) bossKills[name] = k;
    }
  }

  return {
    displayName: r.displayName,
    accountType: normaliseAccountType(typeof r.type === "string" ? r.type : "regular"),
    combatLevel: typeof r.combatLevel === "number" ? r.combatLevel : 0,
    totalLevel: typeof overall?.level === "number" ? overall.level : 0,
    totalXp: typeof overall?.experience === "number" ? overall.experience : 0,
    ehp: typeof r.ehp === "number" ? r.ehp : 0,
    ehb: typeof r.ehb === "number" ? r.ehb : 0,
    lastChangedAt: typeof r.lastChangedAt === "string" ? r.lastChangedAt : null,
    registeredAt: typeof r.registeredAt === "string" ? r.registeredAt : "",
    bossKills
  };
}

// WOM exposes ~10 account-type strings; we collapse to a smaller set
// that matches the modes our /next engine already understands.
function normaliseAccountType(s: string): WomAccountType {
  const lower = s.toLowerCase();
  if (lower === "hardcore" || lower === "hardcore_ironman") return "hardcore";
  if (lower === "ultimate" || lower === "ultimate_ironman") return "ultimate";
  if (lower === "group_ironman" || lower === "hardcore_group_ironman" || lower.includes("group")) return "group";
  if (lower.includes("ironman")) return "ironman";
  if (lower === "skiller" || lower === "level3" || lower === "lvl3_skiller") return "skiller";
  if (lower === "1_def_pure" || lower === "pure" || lower.includes("pure")) return "pure";
  return "regular";
}

/** Human-readable label for the account type, used in the UI badge. */
export function describeAccountType(type: WomAccountType): string {
  switch (type) {
    case "ironman":  return "Ironman";
    case "hardcore": return "Hardcore Ironman";
    case "ultimate": return "Ultimate Ironman";
    case "group":    return "Group Ironman";
    case "skiller":  return "Level 3 Skiller";
    case "pure":     return "Pure";
    case "regular":
    default:         return "Normal";
  }
}

/** Relative-time label for the 'last seen' badge. Returns null when
 *  WOM never saw a change (lastChangedAt missing). */
export function describeLastActive(iso: string | null, now: number = Date.now()): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  const diffMs = Math.max(0, now - then);
  const days = Math.floor(diffMs / 86_400_000);
  if (days === 0) return "active today";
  if (days === 1) return "active yesterday";
  if (days < 7) return `active ${days} days ago`;
  if (days < 30) {
    const w = Math.floor(days / 7);
    return `active ${w} week${w === 1 ? "" : "s"} ago`;
  }
  if (days < 365) {
    const m = Math.floor(days / 30);
    return `last seen ${m} month${m === 1 ? "" : "s"} ago`;
  }
  const y = Math.floor(days / 365);
  return `last seen ${y} year${y === 1 ? "" : "s"} ago`;
}
