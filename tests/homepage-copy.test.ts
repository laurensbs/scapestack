import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = [
  readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8"),
  readFileSync(join(process.cwd(), "src/components/hero-boss-trip-preview.tsx"), "utf8")
].join("\n");

describe("homepage first-impression copy", () => {
  it("opens with the five-second OSRS planner promise", () => {
    expect(source).not.toContain("BRAND_SECONDARY_TAGLINE");
    expect(source).toContain("Stop bankstanding.");
    expect(source).toContain("Pick the next trip.");
    expect(source).toContain("Type your OSRS name. Get one trip, two backups and a stop point before you open another Wiki tab.");
    expect(source).not.toContain("Get one best move, why it matters, how long it takes");
    expect(source).not.toContain("HERO_LOOP_STEPS");
    expect(source).not.toContain("AI-powered");
    expect(source).not.toContain("generic SaaS");
    expect(source).not.toContain("bank standing");
  });

  it("shows a boss-only visual instead of a dense product mock", () => {
    expect(source).toContain("HeroBossTripPreview");
    expect(source).toContain("HERO_BOSSES");
    expect(source).toContain('aria-label="Rotating OSRS bosses"');
    expect(source).toContain('src={`/sprites/bosses/${trip.boss}.png`}');
    expect(source).toContain("Vardorvis");
    expect(source).toContain("Vorkath");
    expect(source).toContain("Zulrah");
    expect(source).toContain("Alchemical Hydra");
    expect(source).toContain("Nex");
    expect(source).toContain('source: "hero-boss"');
    expect(source).not.toContain("Live boss preview");
    expect(source).not.toContain("Push Vardorvis to 50 KC");
    expect(source).not.toContain("Run Vorkath for a clean trip");
    expect(source).not.toContain("Send a Zulrah block");
    expect(source).not.toContain("Use Hydra while the task is live");
    expect(source).not.toContain("Pick a Nex mass or small team");
    expect(source).not.toContain("Start: {active.start}");
    expect(source).not.toContain("RuneLite can quietly avoid bosses, quests, diary steps and Slayer calls you already handled.");
    expect(source).not.toContain("Item ID 28307");
    expect(source).not.toContain("https://oldschool.runescape.wiki/w/Special:Lookup?type=item&id=28307");
    expect(source).not.toContain('import { ItemSprite } from "@/components/item-sprite";');
    expect(source).not.toContain("HERO_PREVIEW_ITEMS");
    expect(source).not.toContain("Try this flow");
    expect(source).not.toContain("function PreviewRow");
    expect(source).not.toContain("PreviewBackup");
    expect(source).not.toContain("PreviewLine");
  });

  it("keeps the first screen in one clean order: hero, input, boss", () => {
    const intakeIndex = source.indexOf("<HeroIntake />");
    const bossIndex = source.indexOf("<HeroBossTripPreview />");

    expect(source).toContain("flex-col items-center");
    expect(intakeIndex).toBeGreaterThan(-1);
    expect(bossIndex).toBeGreaterThan(-1);
    expect(intakeIndex).toBeLessThan(bossIndex);
    expect(source).not.toContain("lg:grid-cols-[minmax(0,1fr)_520px]");
  });

  it("uses oldschool OSRS surfaces instead of generic black cards", () => {
    expect(source).toContain("osrs-frame");
    expect(source).toContain("osrs-body");
    expect(source).not.toContain('bg-[#090909]');
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
