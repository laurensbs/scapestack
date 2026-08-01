import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * One type scale, and it only ever shrinks toward it.
 *
 * Measured 2026-08-01: the app used TWENTY-SIX distinct font sizes, nine of
 * them between 9px and 14px in half-pixel steps. 11px (170 uses), 11.5px
 * (132), 12px (165), 12.5px (125) and 13px (134) alone are 726 usages that no
 * eye can separate — which is exactly why every review of this product says the
 * page reads as one flat grey mass. It is one weight, because it literally is.
 *
 * A design principle in a document does not survive translation into code; five
 * promptbooks in a row proved that here. A ceiling does. The six sizes live in
 * globals.css as tokens, and this test refuses to let the off-scale count go
 * up while the migration walks it down.
 */

const SCALE = ["11px", "12px", "14px", "19px", "28px", "40px"];

/**
 * The count on the day the scale was defined. It may only ever be lowered.
 *
 * Lower it in the same commit that removes usages — a ceiling nobody tightens
 * is a ceiling that stops meaning anything, which is the failure mode of every
 * ratchet ever written.
 */
const CEILING = 713;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(entry)) out.push(full);
  }
  return out;
}

function offScaleUses(): string[] {
  const found: string[] = [];
  for (const file of walk(join(process.cwd(), "src"))) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/text-\[([0-9.]+px)\]/g)) {
      if (!SCALE.includes(match[1])) {
        found.push(`${file.replace(process.cwd() + "/", "")}: ${match[1]}`);
      }
    }
  }
  return found;
}

describe("the type scale is a constraint, not a suggestion", () => {
  it("defines exactly six steps in globals.css", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const declared = [...css.matchAll(/--text-(label|micro|body|subject|answer|page):\s*([0-9.]+px);/g)];
    expect(declared).toHaveLength(6);
    expect(declared.map((match) => match[2]).sort()).toEqual([...SCALE].sort());
  });

  it("never grows the number of font sizes outside that scale", () => {
    const off = offScaleUses();
    // The message carries the three commonest offenders, because "735 things
    // are wrong" is not actionable and "11.5px appears 132 times" is.
    const bySize = new Map<string, number>();
    for (const use of off) {
      const size = use.split(": ")[1];
      bySize.set(size, (bySize.get(size) ?? 0) + 1);
    }
    const worst = [...bySize.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([size, count]) => `${size} x${count}`).join(", ");
    expect(off.length, `off-scale sizes went up. Worst: ${worst}`).toBeLessThanOrEqual(CEILING);
  });

  it("keeps the ceiling honest — lower it when the count drops", () => {
    // A ratchet nobody tightens stops guarding anything. If the real count has
    // fallen well below the ceiling, this fails and asks for the constant to be
    // updated in the same commit that earned it.
    const off = offScaleUses().length;
    expect(
      CEILING - off,
      `off-scale count is ${off} but the ceiling is still ${CEILING} — lower CEILING to ${off}`
    ).toBeLessThan(40);
  });
});
