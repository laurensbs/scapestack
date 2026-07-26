import { BOSSES, type Boss } from "./bosses";

/**
 * Slugs that no longer exist but are still out there in links.
 *
 * "kbd" was a byte-identical second King Black Dragon entry — same stats, same
 * icon, same name — so /dps listed the boss twice and only one of the two was
 * ever gated by the /next engine. Removing it fixes the duplicate; this keeps
 * every shared link and bookmark pointing at it working.
 */
const RETIRED_SLUGS: Record<string, string> = {
  "kbd": "king-black-dragon"
};

export function bossFromDpsParam(value: string | null): Boss | null {
  if (!value) return null;
  const raw = decodeURIComponent(value).trim().toLowerCase();
  if (!raw) return null;
  const decoded = RETIRED_SLUGS[raw] ?? raw;
  const slug = decoded.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return BOSSES.find((boss) =>
    boss.slug === decoded ||
    boss.slug === slug ||
    boss.name.toLowerCase() === decoded
  ) ?? null;
}
