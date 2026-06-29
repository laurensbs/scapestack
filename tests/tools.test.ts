import { describe, expect, it } from "vitest";
import { getPrimaryNavTools, getTool, PRIMARY_NAV_SLUGS, TOOLS } from "@/lib/tools";

describe("tool registry", () => {
  it("registers the next-up hub as the primary live tool", () => {
    const next = getTool("next");

    expect(next).toMatchObject({
      href: "/next",
      name: "What should I do now?",
      navLabel: "Plan",
      status: "live"
    });
    expect(next?.description).toContain("Stop bankstanding");
    expect(next?.description).toContain("one useful move");
    expect(next?.tagline).toBe("RSN in → do this first");
  });

  it("registers RuneLite sync as a live first-class tool", () => {
    const plugin = getTool("plugin");

    expect(plugin).toMatchObject({
      href: "/plugin",
      name: "RuneLite helper",
      navLabel: "RuneLite",
      status: "live"
    });
    expect(plugin?.short).toBe("Check RuneLite for finished progress");
    expect(plugin?.tagline).toContain("Skip finished quests, diaries, clog and Slayer");
    expect(plugin?.description).toContain("stop suggesting quests, diary steps, clog slots and Slayer calls");
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

    expect(PRIMARY_NAV_SLUGS).toEqual(["next", "bank", "dps"]);
    expect(primary.map((tool) => tool.slug)).toEqual(["next", "bank", "dps"]);
    expect(primary.map((tool) => tool.navLabel)).toEqual(["Plan", "Setup", "Check kill"]);
    expect(primary.every((tool) => (tool.navLabel ?? tool.name).length <= 10)).toBe(true);
  });

  it("keeps live tool copy aligned with current product scope", () => {
    expect(getTool("dps")).toMatchObject({
      name: "Can I kill this?",
      tagline: "Add setup → one boss verdict"
    });
    expect(getTool("dps")?.description).toContain("first trip, stop point and upgrade check");
    expect(getTool("slayer")).toMatchObject({
      href: "/slayer",
      navLabel: "Task",
      status: "live"
    });
  });
});
