// Canonical RSN handling.
//
// This exists because the same player name used to normalize four different
// ways depending on which door they came through:
//
//   src/app/api/sync/route.ts        trim + lowercase + slice
//   src/app/api/sync/claim/route.ts  trim + lowercase + slice
//   src/lib/sync-auth.ts             trim + lowercase + slice
//   src/lib/account-pairing.ts       ... + collapse whitespace
//
// The difference matters. RuneLite's `client.getLocalPlayer().getName()`
// returns display names where the space is U+00A0 (non-breaking), not a plain
// space — that is how the OSRS client stores them. The browser paths collapsed
// it to a plain space (JS `\s` matches U+00A0); the plugin paths did not, and
// the `[A-Za-z0-9 _-]` validator rejected it outright.
//
// Net effect: every player with a space in their name got
// "rsn contains invalid characters" and could not use the plugin at all.
//
// Normalizing here rather than only in the plugin means already-installed
// plugin versions are fixed by a deploy, without waiting on a Plugin Hub
// release. The plugin normalizes at source as well — defence in depth.

/** Longest possible OSRS display name. */
export const RSN_MAX_LENGTH = 12;

/** Characters an OSRS display name may contain, once whitespace is folded. */
const RSN_PATTERN = /^[A-Za-z0-9 _-]+$/;

/** Any Unicode whitespace, including the U+00A0 the game client uses. */
const ANY_SPACE = /[\s ]+/g;

/**
 * Display form: whitespace folded to single plain spaces, trimmed, original
 * casing preserved. Use when showing the name back to the player.
 */
export function cleanRsnInput(value: string): string {
  return value.replace(ANY_SPACE, " ").trim();
}

/**
 * Storage key: `cleanRsnInput` plus lowercasing and a length cap. This is the
 * value every table keys on, so it must stay stable — changing it orphans
 * existing claims, sync rows and pairings.
 */
export function normalizeRsn(value: string): string {
  return cleanRsnInput(value).toLowerCase().slice(0, RSN_MAX_LENGTH);
}

/** True when the cleaned name is a plausible OSRS display name. */
export function isValidRsn(value: string): boolean {
  const cleaned = cleanRsnInput(value);
  return cleaned.length >= 1
    && cleaned.length <= RSN_MAX_LENGTH
    && RSN_PATTERN.test(cleaned);
}
