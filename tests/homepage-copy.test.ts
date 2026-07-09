import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = [
  readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8"),
  readFileSync(join(process.cwd(), "src/components/hero-boss-trip-preview.tsx"), "utf8")
].join("\n");

describe("homepage first-impression copy", () => {
  it("opens with the product session board instead of a marketing hero", () => {
    expect(source).not.toContain("BRAND_SECONDARY_TAGLINE");
    expect(source).toContain("Next trip");
    expect(source).toContain("What can I do now?");
    expect(source).toContain("Do first");
    expect(source).toContain("Bank checked");
    expect(source).toContain("Quests almost ready");
    expect(source).toContain("See the quest you can start soon");
    expect(source).toContain("Items to grab");
    expect(source).toContain("Check what is already in your bank");
    expect(source).toContain("Good stopping place");
    expect(source).toContain("Finish the trip, quest step or unlock");
    expect(source).not.toContain("Quest readiness");
    expect(source).not.toContain("Near-ready unlocks first");
    expect(source).not.toContain("Bank gaps");
    expect(source).not.toContain("Items only when they change the route");
    expect(source).not.toContain("End on a clean trip or unlock");
    expect(source).not.toContain("Get one best move, why it matters, how long it takes");
    expect(source).not.toContain("Stop bankstanding.");
    expect(source).not.toContain("Pick the next trip.");
    expect(source).not.toContain("HERO_LOOP_STEPS");
    expect(source).not.toContain("AI-powered");
    expect(source).not.toContain("generic SaaS");
    expect(source).not.toContain("bank standing");
  });

  it("uses OSRS route and item signals instead of a dense product mock", () => {
    expect(source).toContain('import { ItemSprite } from "@/components/item-sprite";');
    expect(source).toContain("Unlock board");
    expect(source).toContain("Barrows gloves");
    expect(source).toContain("Fairy rings");
    expect(source).toContain("Piety");
    expect(source).toContain("Ava's assembler");
    expect(source).toContain("Slayer unlocks");
    expect(source).toContain("Before you go");
    expect(source).toContain("Know what to do next");
    expect(source).toContain("Which level, quest or item is stopping me?");
    expect(source).toContain("Which items do I still need, and are they in my bank?");
    expect(source).toContain("What is a good place to stop this session?");
    expect(source).not.toContain("Every panel must earn the click");
    expect(source).not.toContain("Next blocker, not broad stats.");
    expect(source).not.toContain("Stop point before the trip drifts.");
    expect(source).not.toContain("Progression lanes");
    expect(source).not.toContain("Which item is missing, and is it already in the bank?");
    expect(source).not.toContain("<HeroBossTripPreview />");
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
    expect(source).not.toContain("HERO_PREVIEW_ITEMS");
    expect(source).not.toContain("Try this flow");
    expect(source).not.toContain("function PreviewRow");
    expect(source).not.toContain("PreviewBackup");
    expect(source).not.toContain("PreviewLine");
  });

  it("keeps the first screen in one clean order: board, input, route lanes", () => {
    const boardIndex = source.indexOf("What can I do now?");
    const intakeIndex = source.indexOf("<HeroIntake />");
    const routesIndex = source.indexOf("Unlock board");

    expect(source).toContain("lg:grid-cols-[minmax(0,0.98fr)_minmax(340px,0.72fr)]");
    expect(boardIndex).toBeGreaterThan(-1);
    expect(intakeIndex).toBeGreaterThan(-1);
    expect(routesIndex).toBeGreaterThan(-1);
    expect(boardIndex).toBeLessThan(intakeIndex);
    expect(intakeIndex).toBeLessThan(routesIndex);
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
