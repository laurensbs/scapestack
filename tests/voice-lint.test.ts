import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A lint for the one thing about this product that cannot be measured by a
 * type checker: whether it sounds like a player wrote it.
 *
 * The evidence is in docs/design/SCAPESTACK-DESIGN-SYSTEM.md. Across all 1,985
 * RuneLite Plugin Hub descriptions — the largest body of copy players have
 * written for other players — the words below appear ZERO times. The
 * most-installed plugin in the game, at 575,810 installs, is described in four
 * words. r/2007scape has a report button for AI-generated content and posts
 * machine-written OSRS copy as a punchline.
 *
 * Sounding like a machine is a specific, recognised failure in this community,
 * and it is the kind of thing that creeps back in one string at a time. So it
 * is a test rather than a note.
 */

const ROOT = process.cwd();

/** Modules whose strings a player actually reads. */
const COPY_DIRS = ["src/lib", "src/components", "src/app"];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (path: string) => {
    for (const entry of readdirSync(path)) {
      const full = join(path, entry);
      if (statSync(full).isDirectory()) {
        if (entry === "node_modules" || entry === ".next") continue;
        walk(full);
        continue;
      }
      if (/\.(ts|tsx)$/.test(entry)) out.push(full);
    }
  };
  walk(join(ROOT, dir));
  return out;
}

/**
 * Only the contents of string and template literals — never identifiers,
 * imports or comments. `sessionStorage` is not copy; "one-session target" is.
 */
function literals(source: string): string[] {
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const found: string[] = [];
  for (const match of stripped.matchAll(/"([^"\\\n]{4,})"|'([^'\\\n]{4,})'|`([^`\\]{4,})`/g)) {
    const text = match[1] ?? match[2] ?? match[3] ?? "";
    // Import specifiers, class-name soup and URLs are not prose.
    if (/^[./@]/.test(text)) continue;
    if (/^https?:/.test(text)) continue;
    if (!/[a-z]{3}\s+[a-z]{3}/i.test(text)) continue;
    found.push(text);
  }
  return found;
}

/** Visible JSX text is player copy too; quoted-literal extraction misses it. */
function jsxText(source: string): string[] {
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const found: string[] = [];
  for (const match of stripped.matchAll(/>([^<>{}]+)</g)) {
    const text = (match[1] ?? "").replace(/\s+/g, " ").trim();
    if (!/[a-z]{3}\s+[a-z]{3}/i.test(text)) continue;
    found.push(text);
  }
  return found;
}

const ALL = COPY_DIRS.flatMap(sourceFiles)
  .filter((path) => !path.includes("/dev/"))
  .map((path) => {
    const source = readFileSync(path, "utf8");
    return {
      path: path.replace(`${ROOT}/`, ""),
      literals: [...literals(source), ...(path.endsWith(".tsx") ? jsxText(source) : [])]
    };
  });

function hits(pattern: RegExp): string[] {
  const out: string[] = [];
  for (const file of ALL) {
    for (const text of file.literals) {
      if (pattern.test(text)) out.push(`${file.path} :: "${text.trim().slice(0, 90)}"`);
    }
  }
  return out;
}

describe("copy sounds like a player wrote it", () => {
  it("uses none of the words that appear zero times across 1,985 plugin descriptions", () => {
    const banned = [
      "seamless", "effortless", "effortlessly", "elevate", "empower",
      "intuitive", "robust", "cutting edge", "leverage", "streamline",
      "supercharge", "next-level", "game-changing", "unleash", "bespoke",
      "revolutioni", "curated", "personalized", "personalised",
      "take your .{0,20}to the next level", "level up your",
      "optimi[sz]e your", "maximi[sz]e your", "boost your", "unlock your"
    ];
    const found = hits(new RegExp(`\\b(?:${banned.join("|")})`, "i"));
    expect(found, `Marketing language in player-facing copy:\n${found.join("\n")}`).toEqual([]);
  });

  it("never speaks as 'we'", () => {
    // 0% of 1,985 player-written descriptions use "we" or "our". A tool is a
    // thing the player uses, not a company talking about itself.
    const found = hits(/\b(?:we|our)\s+(?:built|made|believe|think|know|help|offer|provide|designed)\b/i);
    expect(found, `First-person-plural marketing voice:\n${found.join("\n")}`).toEqual([]);
  });

  it("counts in the player's units, not in time saved", () => {
    // Players count in ticks, trips, KC and multiples of drop rate. "Hours
    // saved" is a productivity-tool claim and belongs to a different product.
    const found = hits(/\b(?:hours?|minutes?|time)\s+saved\b|\bsave\s+(?:you\s+)?(?:hours?|time)\b/i);
    expect(found, `Time-saved framing:\n${found.join("\n")}`).toEqual([]);
  });

  it("says trip where a player would say trip", () => {
    // "Session" in the marketing sense is not player vocabulary; the unit for
    // one outing is a trip, tied to the 28 inventory slots. This deliberately
    // does not ban the word outright — "session" is fine in a technical name
    // like a browser session, which is why only the copy phrasings are listed.
    const found = hits(/\b(?:one-session|this session length|reward-target session|session stays bounded|drop-chance session)\b/i);
    expect(found, `"Session" used where "trip" belongs:\n${found.join("\n")}`).toEqual([]);
  });

  it("lints the Phase 5 plugin and connection copy without privacy-policy reassurance", () => {
    const phaseFive = ALL.filter((file) => [
      "src/app/plugin/page.tsx",
      "src/app/link/page.tsx",
      "src/components/link-account-form.tsx"
    ].includes(file.path));
    expect(phaseFive.map((file) => file.path).toSorted()).toEqual([
      "src/app/plugin/page.tsx",
      "src/app/link/page.tsx",
      "src/components/link-account-form.tsx"
    ].toSorted());
    const copy = phaseFive.flatMap((file) => file.literals).join("\n");
    expect(copy).toContain("What Scapestack is");
    expect(copy).toContain("Approve connection");
    expect(copy).not.toMatch(/we take your privacy seriously|industry-standard encryption|your data is safe|trust us/i);
  });

  it("has copy to lint at all", () => {
    // Guards the guard: if the literal extraction ever stops matching, every
    // assertion above passes vacuously. Two guards in this repo have already
    // shipped in exactly that state.
    const total = ALL.reduce((sum, file) => sum + file.literals.length, 0);
    expect(total, "no string literals extracted — the lint is not looking at anything").toBeGreaterThan(400);
    expect(hits(/\bseamless\b/i)).toEqual([]);
    // And prove the matcher fires on a phrase we know is in the corpus.
    expect(hits(/\bbank\b/i).length).toBeGreaterThan(5);
  });
});
