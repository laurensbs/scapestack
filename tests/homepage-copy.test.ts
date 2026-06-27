import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");

describe("homepage first-impression copy", () => {
  it("opens with the OSRS decision-engine loop instead of generic SaaS copy", () => {
    expect(source).toContain("BRAND_TAGLINE");
    expect(source).toContain("BRAND_SECONDARY_TAGLINE");
    expect(source).toContain("Bank → next action → RuneLite sync.");
    expect(source).toContain('const HERO_LOOP_STEPS = ["Bank", "Next action", "RuneLite sync"] as const;');
    expect(source).toContain("Paste bank context, type an RSN, or connect RuneLite");
    expect(source).toContain("one concrete route before you start bank standing");
    expect(source).not.toContain("AI-powered");
    expect(source).not.toContain("generic SaaS");
  });

  it("shows a live product preview with item IDs, Wiki and action affordances", () => {
    expect(source).toContain("HeroProductPreview");
    expect(source).toContain('aria-label="Live Scapestack product preview"');
    expect(source).toContain("Push Vardorvis to 50 KC");
    expect(source).toContain("DPS route");
    expect(source).toContain("Item ID 28307");
    expect(source).toContain("https://oldschool.runescape.wiki/w/Special:Lookup?type=item&id=28307");
    expect(source).toContain("https://oldschool.runescape.wiki/w/Vardorvis");
    expect(source).toContain("Mark done");
    expect(source).toContain("HERO_PREVIEW_ITEMS");
    expect(source).toContain("ItemSprite");
  });

  it("separates Hiscores, pasted bank data and RuneLite sync data", () => {
    expect(source).toContain("HERO_READINESS_SIGNALS");
    expect(source).toContain("Public Hiscores, combat level and boss KC.");
    expect(source).toContain("Items, quantities, gear and GP value.");
    expect(source).toContain("Opt-in quests, diaries, collection log and Slayer.");
    expect(source).not.toContain('aria-label="Scapestack readiness rail"');
    expect(source).toContain("Start with your bank");
    expect(source).toContain("Bank Memory is best when you want quantities and GP value");
    expect(source).toContain("Bank Tags still gives exact layout");
    expect(source).toContain("Verified RuneLite sync labels quest, diary, collection-log and Slayer coverage as verified, partial or missing");
    expect(source).not.toContain("Verified RuneLite sync removes quest, diary, collection-log and Slayer guesswork");
    expect(source).not.toContain("Bank Tags still gives exact layout.\n              RuneLite sync removes");
    expect(source).toContain("The plugin");
    expect(source).toContain("does not send bank data");
    expect(source).toContain("what data it used");
  });

  it("states the homepage privacy boundary before asking for sync", () => {
    expect(source).toContain("What Scapestack uses");
    expect(source).toContain("What it never reads");
    expect(source).toContain("HERO_NEVER_READS");
    expect(source).toContain('const HERO_NEVER_READS = ["chat", "passwords", "clicks", "screenshots", "login data"] as const;');
    expect(source).toContain("RuneLite sync is opt-in account-state only");
    expect(source).toContain("Bank paste stays browser-session scoped");
  });

  it("surfaces the premium OSRS command system on the homepage", () => {
    expect(source).toContain("ScapestackCommandSystem");
  });

  it("does not imply Plugin Hub install equals verified exact payload", () => {
    expect(source).toContain("pluginHubReviewReadiness");
    expect(source).toContain("homePluginReadinessPill");
    expect(source).toContain("ScapestackSyncReadinessCard");
    expect(source).toContain("Scapestack Sync readiness");
    expect(source).toContain("Check sync");
    expect(source).not.toContain("Plugin Hub install readiness");
    expect(source).not.toContain("visibleBlockers");
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
