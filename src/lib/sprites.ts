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

/** Resolve a boss slug to a shipped local boss sprite. Returns null for
 *  unknown / unsafe slugs so components do not emit avoidable 404s. */
export function bossSpriteUrl(slug: string): string | null {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug || !/^[a-z0-9-]+$/.test(normalizedSlug)) return null;
  if (!KNOWN_BOSS_SLUGS.has(normalizedSlug)) return null;
  return `/sprites/bosses/${normalizedSlug}.png`;
}

const KNOWN_SKILL_SLUGS = new Set([
  "attack", "defence", "strength", "hitpoints", "ranged",
  "prayer", "magic", "cooking", "woodcutting", "fletching",
  "fishing", "firemaking", "crafting", "smithing", "mining",
  "herblore", "agility", "thieving", "slayer", "farming",
  "runecraft", "hunter", "construction", "sailing"
]);

const KNOWN_BOSS_SLUGS = new Set([
  "akkha", "amoxliatl", "araxxor", "artio", "ba-ba",
  "barrows", "bloat", "bryophyta", "callisto", "calvarion",
  "cerberus", "chaos-elemental", "chaos-fanatic", "corp",
  "cox", "crazy-archaeologist", "demonic-gorillas",
  "deranged-archaeologist", "dks-prime", "dks-rex", "dks-supreme",
  "duke-sucellus", "fortis-colosseum", "galvek", "giant-mole",
  "graardor", "grotesque-guardians", "guardians-of-the-rift",
  "hespori", "hueycoatl", "hydra", "kbd", "kephri",
  "kalphite-queen", "king-black-dragon", "kraken", "kree", "kril", "leviathan",
  "maiden", "mimic", "moons-of-peril", "muttadile", "nex",
  "nylo", "obor", "olm", "phantom-muspah", "sarachnis",
  "scorpia", "sire", "skotizo", "sotetseg", "spindel",
  "tekton", "tempoross", "thermonuclear", "toa", "tob",
  "tzkal-zuk", "tztok-jad", "vardorvis", "vasa", "venenatis",
  "verzik", "vespula", "vetion", "vorkath", "warden",
  "whisperer", "wintertodt", "xarpus", "zalcano", "zebak",
  "zilyana", "zulrah"
]);
