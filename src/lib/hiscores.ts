// OSRS Hiscores client. Uses the public index_lite.json endpoint —
// no key needed, no auth, just an RSN.
//
// Endpoint: secure.runescape.com/m=hiscore_oldschool/index_lite.json?player=<rsn>
// Returns 404 when player not on hiscores (level too low or non-existent).

export interface HiscoreSkill {
  id: number;
  name: string;
  rank: number;       // -1 if unranked
  level: number;
  xp: number;
}

export interface HiscoreActivity {
  id: number;
  name: string;
  rank: number;       // -1 if unranked
  score: number;      // -1 if unranked
}

export interface PlayerHiscores {
  name: string;
  skills: HiscoreSkill[];
  activities: HiscoreActivity[];
}

const ENDPOINT = "https://secure.runescape.com/m=hiscore_oldschool/index_lite.json";

// Normalise RSN: lowercase, replace spaces with single underscore, max 12 chars
export function normalizeRsn(input: string): string {
  return input.trim().slice(0, 12);
}

export function rsnSlug(rsn: string): string {
  // For URLs: case-insensitive lookup, but display preserves caps
  return rsn.toLowerCase().replace(/\s+/g, "_");
}

export interface FetchHiscoresOptions {
  signal?: AbortSignal;
  /** Throw for transport/non-404 failures instead of folding everything
   *  into null. Used by /api/sync/claim so Jagex outages remain best-effort
   *  while true 404s still reject fake RSNs. */
  strict?: boolean;
}

export async function fetchHiscores(rsn: string, options: FetchHiscoresOptions = {}): Promise<PlayerHiscores | null> {
  const cleaned = normalizeRsn(rsn);
  if (!cleaned) return null;
  const url = `${ENDPOINT}?player=${encodeURIComponent(cleaned)}`;
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "scapestack/0.3 - personal project" },
      signal: options.signal,
      next: { revalidate: 300 } // 5 min cache
    });
    if (!res.ok) {
      if (options.strict && res.status !== 404) {
        throw new Error(`Hiscores HTTP ${res.status}`);
      }
      return null;
    }
    const data = await res.json();
    return {
      name: data.name || cleaned,
      skills: Array.isArray(data.skills) ? data.skills : [],
      activities: Array.isArray(data.activities) ? data.activities : []
    };
  } catch (err) {
    if (options.strict) throw err;
    return null;
  }
}

// Combat level formula. Source: oldschool.runescape.wiki/w/Combat_level
export function computeCombatLevel(skills: HiscoreSkill[]): number {
  const level = (name: string) =>
    skills.find((s) => s.name.toLowerCase() === name.toLowerCase())?.level ?? 1;

  const atk = level("Attack");
  const str = level("Strength");
  const def = level("Defence");
  const hp = level("Hitpoints");
  const ranged = level("Ranged");
  const prayer = level("Prayer");
  const magic = level("Magic");

  const base = 0.25 * (def + hp + Math.floor(prayer / 2));
  const melee = 0.325 * (atk + str);
  const range = 0.325 * (Math.floor(ranged / 2) + ranged);
  const mage = 0.325 * (Math.floor(magic / 2) + magic);

  return Math.floor(base + Math.max(melee, range, mage));
}

// Total level — Hiscores returns this as the "Overall" skill, but we compute
// from raw skills as a fallback in case "Overall" is missing.
export function computeTotalLevel(skills: HiscoreSkill[]): number {
  const overall = skills.find((s) => s.name === "Overall");
  if (overall) return overall.level;
  return skills
    .filter((s) => s.name !== "Overall")
    .reduce((sum, s) => sum + Math.max(1, s.level), 0);
}

export function totalXp(skills: HiscoreSkill[]): number {
  const overall = skills.find((s) => s.name === "Overall");
  if (overall && overall.xp > 0) return overall.xp;
  return skills
    .filter((s) => s.name !== "Overall")
    .reduce((sum, s) => sum + Math.max(0, s.xp), 0);
}

export function topSkills(skills: HiscoreSkill[], n = 3): HiscoreSkill[] {
  return skills
    .filter((s) => s.name !== "Overall")
    .sort((a, b) => b.xp - a.xp)
    .slice(0, n);
}

// Format an XP number compactly — 200M, 13.4M, 856K, etc.
export function formatXp(xp: number): string {
  if (xp <= 0) return "0";
  if (xp >= 1_000_000_000) return `${(xp / 1_000_000_000).toFixed(1)}B`;
  if (xp >= 10_000_000) return `${Math.floor(xp / 1_000_000)}M`;
  if (xp >= 1_000_000) return `${(xp / 1_000_000).toFixed(1)}M`;
  if (xp >= 1_000) return `${Math.floor(xp / 1_000)}K`;
  return xp.toLocaleString();
}
