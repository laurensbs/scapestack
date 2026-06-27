import { describe, expect, it } from "vitest";
import { getPrimaryNavTools, getTool, PRIMARY_NAV_SLUGS, TOOLS } from "@/lib/tools";

describe("tool registry", () => {
  it("registers the next-up hub as the primary live tool", () => {
    const next = getTool("next");

    expect(next).toMatchObject({
      href: "/next",
      name: "What to do now",
      navLabel: "Next",
      status: "live"
    });
    expect(next?.description).toContain("one ranked list");
  });

  it("registers RuneLite sync as a live first-class tool", () => {
    const plugin = getTool("plugin");

    expect(plugin).toMatchObject({
      href: "/plugin",
      name: "RuneLite Sync",
      navLabel: "Sync",
      status: "live"
    });
    expect(plugin?.short).toBe("Set up Scapestack RuneLite sync");
    expect(plugin?.tagline).toContain("quests, diaries, CL and Slayer");
    expect(plugin?.description).toContain("completed quests, diary tiers, collection-log items and Slayer state");
    expect(plugin?.description).not.toContain("payload");
    expect(plugin?.description).not.toContain("coverage labels");
    expect(plugin?.description).not.toContain("turn /next from inferred advice into exact account-state recommendations");
  });

  it("keeps primary navigation tools unique", () => {
    const slugs = TOOLS.map((tool) => tool.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("keeps global nav labels compact", () => {
    const primary = getPrimaryNavTools();

    expect(PRIMARY_NAV_SLUGS).toEqual(["next", "bank", "dps", "goals", "slayer", "plugin"]);
    expect(primary.map((tool) => tool.slug)).toEqual(["next", "bank", "dps", "goals", "slayer", "plugin"]);
    expect(primary.map((tool) => tool.navLabel)).toEqual(["Next", "Bank", "DPS", "Goals", "Slayer", "Sync"]);
    expect(primary.every((tool) => (tool.navLabel ?? tool.name).length <= 6)).toBe(true);
  });

  it("keeps live tool copy aligned with current product scope", () => {
    expect(getTool("dps")?.description).toContain("60+ bosses");
    expect(getTool("slayer")).toMatchObject({
      href: "/slayer",
      navLabel: "Slayer",
      status: "live"
    });
  });
});
