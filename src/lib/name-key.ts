// One canonical form for a quest, diary or item name.
//
// The same string reaches us from four sources that each punctuate differently:
// the wiki-derived JSON in data/, the RuneLite plugin's own labels, hand-written
// requirement text on diary tasks, and whatever the player typed. Comparing
// them raw fails on a hyphen.
//
// This function existed as a byte-identical private copy in both
// quest-requirements.ts and diary-requirements.ts. Two copies of a matching
// rule drift, and when a matching rule drifts the failure is silent — content
// stops being recognised as completed and quietly reappears as a requirement.

/** Lowercase, drop bracketed asides and articles, collapse everything else. */
export function cleanName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(?:a|an|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
