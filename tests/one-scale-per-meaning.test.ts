import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * One scale per meaning, enforced.
 *
 * CLAUDE.md records the rule after the status pill painted a bank's item count
 * as an amber warning: "A second way to say the same thing is a bug in the
 * design system, not a variant." The pill is gone. The tokens underneath it
 * were not — an audit found --color-good and --color-warning holding the
 * byte-identical value #FF981F, so a completion tick and an attention flag
 * were the same pixel, and every conditional between them was a branch with no
 * visible effect. ready-to-leave.tsx carried one of those branches inside the
 * same file that exports READY_GATE forbidding it.
 *
 * This checks the property rather than the incident: distinct token names must
 * mean distinct things, and the verdict primitive is the only way to say "how
 * good is this".
 */

import { readdirSync, statSync } from "node:fs";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(entry)) out.push(full);
  }
  return out;
}

function tokenValue(name: string): string | null {
  const match = css.match(new RegExp(`^\\s*--${name}:\\s*([^;]+);`, "m"));
  return match ? match[1].trim().toLowerCase() : null;
}

describe("the design system does not say the same thing twice", () => {
  it("never lets a component choose between two tokens that hold one colour", () => {
    // The tokens being equal is deliberate — globals.css says "no green
    // success theme", saturated colour is data only, so status chrome gets the
    // brass under several names. What is NOT allowed is code branching between
    // two of them, which renders a conditional with no visible effect and
    // reads like a working traffic light. That is what ready-to-leave.tsx did.
    const aliases = ["color-good", "color-warning", "color-danger", "color-bad"];
    const groups = new Map<string, string[]>();
    for (const name of aliases) {
      const value = tokenValue(name);
      if (!value) continue;
      groups.set(value, [...(groups.get(value) ?? []), name]);
    }
    const identical = [...groups.values()].filter((names) => names.length > 1);
    expect(identical.length, "expected some aliases to exist, or this test guards nothing")
      .toBeGreaterThan(0);

    // A file may legitimately use one alias for an alert box and another for a
    // tick elsewhere on the page — that is two unrelated pieces of chrome, not
    // a scale. What is wrong is CHOOSING between them: a ternary, or two
    // conditional class strings on the same element. So the detector looks for
    // both tokens inside one expression, not merely inside one file. The first
    // version flagged whole files and reported five, most of which were
    // innocent.
    const offenders: string[] = [];
    for (const dir of ["src/components", "src/app"]) {
      for (const file of walk(join(process.cwd(), dir))) {
        const source = readFileSync(file, "utf8");
        for (const names of identical) {
          const [first, second] = names;
          // A ternary or adjacent conditional pair: the two tokens separated by
          // at most one line and a `?`/`:`/`&&` between them.
          const pattern = new RegExp(
            `var\\(--${first}\\)[^\\n]*\\n?[^\\n]*[?:&][^\\n]*var\\(--${second}\\)`
              + `|var\\(--${second}\\)[^\\n]*\\n?[^\\n]*[?:&][^\\n]*var\\(--${first}\\)`
          );
          if (pattern.test(source)) {
            offenders.push(`${file.replace(process.cwd() + "/", "")}: ${first} vs ${second}`);
          }
        }
      }
    }
    expect(offenders, "these files branch between colours that are the same colour").toEqual([]);
  });

  it("keeps the verdict out of ready-to-leave's own hands", () => {
    // The component exports READY_GATE and then used to ignore it. Anyone
    // reintroducing a local good/warn branch here is re-adding the bug the
    // export exists to prevent.
    const source = readFileSync(join(process.cwd(), "src/components/ready-to-leave.tsx"), "utf8");
    expect(source).toContain("const gate = READY_GATE[status]");
    expect(source).toContain('className="scape-verdict" data-gate={gate}');
    expect(source).not.toContain("var(--color-good)");
    expect(source).not.toContain("var(--color-warning)");
  });
});

describe("the accent has a budget", () => {
  it("keeps section labels quiet — the accent is for the wordmark, the primary action and links", () => {
    // Wise Old Man's grammar, adopted deliberately: labels are small quiet
    // grey, and the accent appears in three or four places per screen at
    // most. This site had 26 orange uppercase eyebrows — when the accent is
    // everywhere, there is no accent. The .eyebrow base class is already
    // muted; this stops call sites from painting over it.
    const offenders: string[] = [];
    for (const dir of ["src/components", "src/app"]) {
      for (const file of walk(join(process.cwd(), dir))) {
        if (readFileSync(file, "utf8").includes("eyebrow text-[var(--color-accent)]")) {
          offenders.push(file.replace(process.cwd() + "/", ""));
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
