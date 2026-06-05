import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");

describe("homepage first-impression copy", () => {
  it("separates Hiscores, pasted bank data and RuneLite sync data", () => {
    expect(source).toContain("Type your OSRS name for Hiscores");
    expect(source).toContain("Paste your bank when you want gear-aware planning");
    expect(source).toContain("Add RuneLite sync for quests, diaries, collection log and Slayer state");
    expect(source).toContain("Start with your bank");
    expect(source).toContain("Bank Memory is best when you want quantities and GP value");
    expect(source).toContain("Bank Tags still gives exact layout");
    expect(source).toContain("Verified RuneLite sync labels quest, diary, collection-log and Slayer coverage as verified, partial or missing");
    expect(source).not.toContain("Verified RuneLite sync removes quest, diary, collection-log and Slayer guesswork");
    expect(source).not.toContain("Bank Tags still gives exact layout.\n              RuneLite sync removes");
    expect(source).toContain("the plugin");
    expect(source).toContain("does not send bank data");
    expect(source).toContain("what data it used");
    expect(source).toContain("HERO_TRUST_POINTS");
    expect(source).toContain("Scapestack data trust contract");
    expect(source).toContain("Hiscores first: works with only an OSRS name.");
    expect(source).toContain("Bank paste is browser-only and never sent to RuneLite.");
    expect(source).toContain("RuneLite sync verifies quests, diaries, collection log and Slayer after opt-in.");
  });

  it("does not imply Plugin Hub install equals verified exact payload", () => {
    expect(source).toContain("pluginHubReviewReadiness");
    expect(source).toContain("homePluginReadinessPill");
    expect(source).toContain("PluginHubReadinessCard");
    expect(source).toContain("Plugin Hub install readiness");
    expect(source).toContain("!readiness.playerInstallReady");
    expect(source).toContain("visibleBlockers");
    expect(source).not.toContain("RuneLite Plugin Hub ready · verify payload coverage");
    expect(source).not.toContain("RuneLite plugin PR open · verified coverage sync coming");
    expect(source).not.toContain("RuneLite Plugin Hub ready · verify payload for exact state");
    expect(source).not.toContain("RuneLite plugin PR open · verified account-state sync coming");
    expect(source).not.toContain("RuneLite Plugin Hub ready · exact quest/diary/CL/Slayer sync");
    expect(source).not.toContain("RuneLite plugin PR open · exact quest/diary/CL/Slayer sync coming");
  });

  it("makes the full product-flow cards clickable", () => {
    expect(source).toContain('data-testid="home-flow-step-card"');
    expect(source).toContain('aria-label={`${step.cta}: ${step.title}`}');
    expect(source).toContain("group/flow-card block rounded-xl");
    expect(source).toContain("group-hover/flow-card:gap-2");
    expect(source).not.toContain('<article key={step.href} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/35 p-4">');
  });
});
