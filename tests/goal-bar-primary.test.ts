import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
const bar = read("src/components/goal-bar.tsx");

describe("the goal line speaks for the primary goal", () => {
  it("reads the primary, not whichever pin happens to be first", () => {
    // goals[0] is the OLDEST pin — the list is sorted by pinnedAt. So a goal
    // set two months ago outranked the one set this morning, and a player had
    // no way to say which one they meant.
    expect(bar).toContain("primaryPinnedGoal(goals)");
    expect(bar).not.toMatch(/const active = goals\[0\]/);
  });

  it("makes the goal a player just picked the primary one", () => {
    expect(bar).toMatch(/isPrimary: true/);
    // And clears the previous one in the same write, or the database's
    // one-primary-per-account index rejects the next save.
    expect(bar).toContain("withPrimaryPinnedGoal(");
  });

  it("captures the baseline at the moment of pinning", () => {
    // There is no second chance to take it: this is the only moment the page
    // knows what the account looked like when the player committed.
    expect(bar).toContain("pinnedGoalBaselineFrom(evidence, now)");
    expect(bar).toMatch(/const now = new Date\(\)\.toISOString\(\);/);
  });

  it("shows one number, not a fraction and a percentage side by side", () => {
    // Two scales for one meaning is a bug in the design system, not a
    // variant — and "92/99" next to "0%" reads as self-contradiction on the
    // day a goal is pinned, which is the day the line matters most.
    expect(bar).toContain("percent === null ? fraction :");
    expect(bar).not.toMatch(/\{progress\.fraction\}[\s\S]{0,200}GoalPercent/);
    // And one colour: the value keeps --color-data-level whichever it is.
    expect(bar.match(/--color-data-level/g)).toHaveLength(1);
  });
});

describe("onboarding step 1 lives on the answer, not in front of it", () => {
  it("asks the question in the empty state", () => {
    expect(bar).toContain("What are you working toward?");
  });

  it("offers three suggestions before a goal exists, six after", () => {
    // Three because this is the first time the player is asked, and a list
    // long enough to need reading is a list that gets skipped.
    expect(bar).toContain("const suggestionLimit = active ? 6 : 3;");
    expect(bar).toContain("slice(0, suggestionLimit)");
  });

  it("keeps the homepage going straight to the answer", () => {
    // tests/first-run-flow.test.ts guards this too. Repeated here because the
    // temptation is to add the screen on this side rather than that one, and
    // a first-run setup screen is something this repo already removed once.
    const hero = read("src/components/hero-intake.tsx");
    expect(hero).toContain("router.push(playerPath(cleanRsn))");
    expect(hero).not.toContain("startPath");
  });

  it("does not force the disclosure open", () => {
    // `open` is a DOM property React keeps rewriting, so it fights the
    // player's own toggling — and goals arrive from localStorage in an effect,
    // so every returning player would see the picker open for a frame and then
    // snapped shut.
    expect(bar).not.toMatch(/<details[\s\S]{0,240}\sopen=/);
  });
});
