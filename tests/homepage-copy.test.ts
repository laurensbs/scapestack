import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");

describe("homepage first-impression copy", () => {
  it("opens with the OSRS decision-engine loop instead of generic SaaS copy", () => {
    expect(source).not.toContain("BRAND_SECONDARY_TAGLINE");
    expect(source).toContain("What should I do next?");
    expect(source).toContain("One clear OSRS plan.");
    expect(source).toContain('const HERO_LOOP_STEPS = ["RSN", "Best move", "Backups"] as const;');
    expect(source).toContain("Get one best move, why it matters, how long it takes");
    expect(source).toContain("Add bank or RuneLite later.");
    expect(source).not.toContain("AI-powered");
    expect(source).not.toContain("generic SaaS");
    expect(source).not.toContain("bank standing");
  });

  it("shows a live product preview with simple action affordances", () => {
    expect(source).toContain("HeroProductPreview");
    expect(source).toContain('aria-label="Live Scapestack product preview"');
    expect(source).toContain("Push Vardorvis to 50 KC");
    expect(source).toContain("Start");
    expect(source).toContain("Setup");
    expect(source).toContain("Backup");
    expect(source).toContain("Done");
    expect(source).not.toContain("Item ID 28307");
    expect(source).not.toContain("https://oldschool.runescape.wiki/w/Special:Lookup?type=item&id=28307");
    expect(source).toContain("HERO_PREVIEW_ITEMS");
    expect(source).toContain("ItemSprite");
  });

  it("turns the preview into OSRS action choices instead of data-source copy", () => {
    expect(source).toContain("HERO_ACTION_CHOICES");
    expect(source).toContain("HERO_ACCOUNT_LEVERS");
    expect(source).toContain("Other good routes");
    expect(source).toContain("Boss KC");
    expect(source).toContain("Route it: kill, skip, extend, barrage or cannon.");
    expect(source).toContain("Plan around");
    expect(source).toContain("Mood");
    expect(source).toContain("Gear");
    expect(source).toContain("Supplies");
    expect(source).not.toContain('aria-label="Scapestack readiness rail"');
    expect(source).not.toContain("HERO_READINESS_SIGNALS");
    expect(source).not.toContain("What Scapestack uses");
    expect(source).not.toContain("What it never reads");
    expect(source).not.toContain("does not send bank data");
  });

  it("keeps player-facing sections free of privacy and backend status panels", () => {
    expect(source).toContain("How it works");
    expect(source).toContain("One plan first. More context later.");
    expect(source).not.toContain("HERO_NEVER_READS");
    expect(source).not.toContain("RuneLite sync is opt-in account-state only");
    expect(source).not.toContain("Bank paste stays browser-session scoped");
    expect(source).not.toContain("Local sync API");
    expect(source).not.toContain("Developing the RuneLite loop locally?");
  });

  it("surfaces the premium OSRS command system on the homepage", () => {
    expect(source).toContain("ScapestackCommandSystem");
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

  it("makes the full product-flow cards clickable", () => {
    expect(source).toContain('data-testid="home-flow-step-card"');
    expect(source).toContain('aria-label={`${step.cta}: ${step.title}`}');
    expect(source).toContain("group/flow-card block rounded-xl");
    expect(source).toContain("group-hover/flow-card:gap-2");
    expect(source).not.toContain('<article key={step.href} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/35 p-4">');
  });
});
