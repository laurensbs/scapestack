import { describe, expect, it } from "vitest";
import { buildBossUpgradePlan } from "@/lib/boss-upgrade-plan";
import { BOSSES } from "@/lib/bosses";
import { bestStyleAndSetup } from "@/lib/dps";
import { GEAR } from "@/lib/gear";
import { normalizeBankHandoffItems } from "@/lib/next-bank-handoff";

const vorkath = BOSSES.find((boss) => boss.slug === "vorkath")!;
const runeCrossbow = GEAR.find((item) => item.name === "Rune crossbow")!;

describe("boss upgrade plan", () => {
  it("picks one tested main-account upgrade inside the visible cash stack", () => {
    const owned = [runeCrossbow];
    const current = bestStyleAndSetup(owned, vorkath);
    const plan = buildBossUpgradePlan({
      boss: vorkath,
      owned,
      current,
      accountType: "regular",
      bankItems: normalizeBankHandoffItems([{ id: 995, name: "Coins", quantity: 6_000_000 }])
    });

    expect(plan).not.toBeNull();
    expect(plan?.affordable).toBe(true);
    expect(plan?.approximatePrice).not.toBeNull();
    expect(plan!.approximatePrice!).toBeLessThanOrEqual(6_000_000);
    expect(plan?.actionLabel).toBe("Check price");
  });

  it("gives an ironman a source route instead of a GE affordability verdict", () => {
    const owned = [runeCrossbow];
    const current = bestStyleAndSetup(owned, vorkath);
    const plan = buildBossUpgradePlan({
      boss: vorkath,
      owned,
      current,
      accountType: "ironman",
      bankItems: []
    });

    expect(plan).not.toBeNull();
    expect(plan?.affordable).toBe(false);
    expect(plan?.sourcePath).toBeTruthy();
    expect(plan?.actionLabel).toBe("Open source");
    expect(plan?.reason).toContain("worth sourcing");
  });
});
