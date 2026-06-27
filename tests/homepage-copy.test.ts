import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");

describe("homepage first-impression copy", () => {
  it("opens with the five-second OSRS planner promise", () => {
    expect(source).not.toContain("BRAND_SECONDARY_TAGLINE");
    expect(source).toContain("What should I do next?");
    expect(source).toContain("One clear OSRS plan.");
    expect(source).toContain("Type your OSRS name. Get one useful plan. Add bank or RuneLite later.");
    expect(source).not.toContain("Get one best move, why it matters, how long it takes");
    expect(source).not.toContain("HERO_LOOP_STEPS");
    expect(source).not.toContain("AI-powered");
    expect(source).not.toContain("generic SaaS");
    expect(source).not.toContain("bank standing");
  });

  it("shows one example plan instead of a dense product mock", () => {
    expect(source).toContain("HeroProductPreview");
    expect(source).toContain('aria-label="Live Scapestack product preview"');
    expect(source).toContain("Example plan");
    expect(source).toContain("Push Vardorvis to 50 KC");
    expect(source).toContain('label="Goal"');
    expect(source).toContain('label="Time"');
    expect(source).toContain('label="First step"');
    expect(source).toContain('value="Check gear, then do one short trip."');
    expect(source).toContain('label="Backup"');
    expect(source).toContain("Backup");
    expect(source).toContain("Done");
    expect(source).not.toContain("Item ID 28307");
    expect(source).not.toContain("https://oldschool.runescape.wiki/w/Special:Lookup?type=item&id=28307");
    expect(source).toContain("ItemSprite");
    expect(source).not.toContain("HERO_PREVIEW_ITEMS");
    expect(source).not.toContain("Start");
    expect(source).not.toContain("Setup");
    expect(source).not.toContain("Try this flow");
  });

  it("removes extra above-the-fold dashboard choices", () => {
    expect(source).not.toContain("HERO_ACTION_CHOICES");
    expect(source).not.toContain("HERO_ACCOUNT_LEVERS");
    expect(source).not.toContain("Other good routes");
    expect(source).not.toContain("Plan around");
    expect(source).not.toContain("Mood");
    expect(source).not.toContain("Supplies");
    expect(source).not.toContain('aria-label="Scapestack readiness rail"');
    expect(source).not.toContain("HERO_READINESS_SIGNALS");
    expect(source).not.toContain("What Scapestack uses");
    expect(source).not.toContain("What it never reads");
    expect(source).not.toContain("does not send bank data");
  });

  it("keeps player-facing sections free of privacy and backend status panels", () => {
    expect(source).not.toContain("How it works");
    expect(source).not.toContain("One plan first. More context later.");
    expect(source).not.toContain("HERO_NEVER_READS");
    expect(source).not.toContain("RuneLite sync is opt-in account-state only");
    expect(source).not.toContain("Bank paste stays browser-session scoped");
    expect(source).not.toContain("Local sync API");
    expect(source).not.toContain("Developing the RuneLite loop locally?");
  });

  it("keeps the homepage focused instead of surfacing the command system", () => {
    expect(source).not.toContain("ScapestackCommandSystem");
  });

  it("does not imply Plugin Hub install equals verified exact payload", () => {
    expect(source).not.toContain("pluginHubReviewReadiness");
    expect(source).not.toContain("homePluginReadinessPill");
    expect(source).not.toContain("ScapestackSyncReadinessCard");
    expect(source).not.toContain("Scapestack Sync readiness");
    expect(source).not.toContain("Plugin Hub install readiness");
    expect(source).not.toContain("visibleBlockers");
    expect(source).not.toContain("RuneLite Plugin Hub ready · verify payload coverage");
    expect(source).not.toContain("RuneLite plugin PR open · verified coverage sync coming");
    expect(source).not.toContain("RuneLite Plugin Hub ready · verify payload for exact state");
    expect(source).not.toContain("RuneLite plugin PR open · verified account-state sync coming");
    expect(source).not.toContain("RuneLite Plugin Hub ready · exact quest/diary/CL/Slayer sync");
    expect(source).not.toContain("RuneLite plugin PR open · exact quest/diary/CL/Slayer sync coming");
  });

  it("removes the full product-flow card grid from the homepage", () => {
    expect(source).not.toContain('data-testid="home-flow-step-card"');
    expect(source).not.toContain('aria-label={`${step.cta}: ${step.title}`}');
    expect(source).not.toContain("group/flow-card block rounded-xl");
    expect(source).not.toContain("group-hover/flow-card:gap-2");
    expect(source).not.toContain('<article key={step.href} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/35 p-4">');
  });
});
