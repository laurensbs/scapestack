// Helpers for sprites we ship locally under public/sprites/.
//
// Local-first because the OSRS Wiki rate-limits aggressively and re-fetching
// 23 skill icons on every page render would be both rude and slow. The
// scripts/build-skill-sprites.mjs builder downloads them once at dev/build
// time and writes them to public/sprites/skills/<slug>.png. This module
// then just resolves a path.

/** Resolve a Hiscores skill name to its local sprite path. Returns null for
 *  "Overall" (no per-skill icon, it's a synthetic total) and any unknown
 *  name — the caller is expected to fall back to a Lucide glyph. */
export function skillSpriteUrl(skillName: string): string | null {
  if (!skillName) return null;
  const slug = skillName.toLowerCase();
  if (slug === "overall") return null;
  // We trust the builder script's slug convention. Anything not in that
  // list returns null so we don't 404 in production for typos / new skills.
  if (!KNOWN_SKILL_SLUGS.has(slug)) return null;
  return `/sprites/skills/${slug}.png`;
}

const KNOWN_SKILL_SLUGS = new Set([
  "attack", "defence", "strength", "hitpoints", "ranged",
  "prayer", "magic", "cooking", "woodcutting", "fletching",
  "fishing", "firemaking", "crafting", "smithing", "mining",
  "herblore", "agility", "thieving", "slayer", "farming",
  "runecraft", "hunter", "construction"
]);
