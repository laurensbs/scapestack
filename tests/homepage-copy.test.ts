import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// hero-boss-trip-preview.tsx was deleted with direction B. It rotated five
// boss illustrations on a 3.6s interval, forever, on a page whose whole job is
// answering a question once — the same loop the token pass had already removed
// from the headline shimmer — and it was the reason the hero needed a 440px
// second column and a 100vh section. Direction B keeps no atmosphere.
const source = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");

describe("homepage first-impression copy", () => {
  it("opens with the simple trip picker, and nothing above the intake", () => {
    expect(source).not.toContain("BRAND_SECONDARY_TAGLINE");
    expect(source).toContain("Stop bankstanding.");
    expect(source).toContain("Pick the next trip.");
    expect(source).toContain("Type your OSRS name. Scapestack opens one clean trip and tells you when to stop.");
    // A reference document gets to the point: no full-viewport hero, no
    // display-size headline, and no eyebrow label above a headline that
    // already says the same thing.
    expect(source).not.toContain("min-h-[calc(100vh");
    expect(source).not.toContain("OSRS trip picker");
    expect(source).not.toContain("text-[76px]");
    expect(source).not.toContain("HeroBossTripPreview");
    expect(source).not.toContain("Quest readiness");
    expect(source).not.toContain("Near-ready unlocks first");
    expect(source).not.toContain("Bank gaps");
    expect(source).not.toContain("Items only when they change the route");
    expect(source).not.toContain("End on a clean trip or unlock");
    expect(source).not.toContain("Get one best move, why it matters, how long it takes");
    expect(source).not.toContain("HERO_LOOP_STEPS");
    expect(source).not.toContain("AI-powered");
    expect(source).not.toContain("generic SaaS");
    expect(source).not.toContain("bank standing");
  });

  it("states its basis instead of decorating, and never a route dashboard", () => {
    // The specimen's closing note: what the numbers are computed from and what
    // they cannot see. The worn-gear clause is the same sentence the verdict
    // engine puts under every boss, and it is permanent — the plugin does not
    // read worn equipment and, by a promise in both READMEs, will not.
    expect(source).toContain("Worn gear is not counted");
    expect(source).toContain("Scapestack only sees your bank");
    // Counted from the engine's own table so the claim cannot drift.
    expect(source).toContain("BOSSES.length");
    expect(source).not.toContain('import { ItemSprite } from "@/components/item-sprite";');
    expect(source).not.toContain("Unlock board");
    expect(source).not.toContain("Barrows gloves");
    expect(source).not.toContain("Fairy rings");
    expect(source).not.toContain("Piety");
    expect(source).not.toContain("Ava's assembler");
    expect(source).not.toContain("Slayer unlocks");
    expect(source).not.toContain("Before you go");
    expect(source).not.toContain("Know what to do next");
    expect(source).not.toContain("Which level, quest or item is stopping me?");
    expect(source).not.toContain("Which items do I still need, and are they in my bank?");
    expect(source).not.toContain("What is a good place to stop this session?");
    expect(source).not.toContain("Every panel must earn the click");
    expect(source).not.toContain("Next blocker, not broad stats.");
    expect(source).not.toContain("Stop point before the trip drifts.");
    expect(source).not.toContain("Progression lanes");
    expect(source).not.toContain("Which item is missing, and is it already in the bank?");
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

  // Was "keeps the first screen in one clean order with the intake before the
  // visual on mobile" — an ordering rule for a two-column hero that no longer
  // exists. What matters now is stronger and simpler: the intake is the second
  // thing in the document, right under the masthead, on every width. There is
  // no column to reorder because there is only one.
  it("puts the intake directly under the masthead in one column", () => {
    const headlineIndex = source.indexOf("Pick the next trip.");
    const intakeIndex = source.indexOf("<HeroIntake />");
    const basisIndex = source.indexOf("Worn gear is not counted");

    expect(headlineIndex).toBeGreaterThan(-1);
    expect(intakeIndex).toBeGreaterThan(-1);
    expect(basisIndex).toBeGreaterThan(-1);
    expect(headlineIndex).toBeLessThan(intakeIndex);
    expect(intakeIndex).toBeLessThan(basisIndex);
    // No second column, at any breakpoint.
    expect(source).not.toContain("lg:grid-cols-");
    expect(source).not.toContain("home-hero-boss");
    expect(source).not.toContain("lg:row-span-2");
    expect(source).not.toContain("lg:grid-cols-[minmax(0,0.98fr)_minmax(340px,0.72fr)]");
  });

  it("uses one object-led oldschool canvas instead of generic black cards", () => {
    expect(source).toContain('className="scape-page');
    expect(source).not.toContain("Help keep Scapestack running");
    expect(source).not.toContain("<BuyMeCoffee");
    expect(source).not.toContain('bg-[#090909]');
    expect(source).not.toContain("osrs-frame");
    // The guard above passed for months while the frame lived one component
    // down, in hero-intake's remembered branch — the most-seen state of the
    // page. Guard the component too.
    const heroIntake = readFileSync(join(process.cwd(), "src/components/hero-intake.tsx"), "utf8");
    expect(heroIntake).not.toContain("osrs-frame");
    expect(heroIntake).not.toContain("osrs-title-bar");
    expect(source).not.toContain("osrs-body");
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
