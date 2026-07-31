import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildRfdRouteNodes, RFD_ROUTE_CHAPTERS } from "@/lib/unlock-route-path";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("the Journal unlock path", () => {
  it("deletes both scored unlock tables and their explanatory legend", () => {
    const next = read("src/app/next/next-client.tsx");
    expect(next).not.toContain("{action.unlockValue}/100");
    expect(next).not.toContain("Unlock is how much of the account this opens, out of a hundred.");
    expect(next).not.toContain('aria-label="Unlock moves ranked by what they open"');
    expect(next).not.toContain('aria-label="Unlock routes and what is blocking each one"');
    expect(next).not.toContain('aria-label="Unlock routes by size of the next step"');
    expect(next).toContain("<UnlockRoutePath");
  });

  it("renders an ordered vertical path with named, semantic node states", () => {
    const path = "src/components/unlock-route-path.tsx";
    expect(existsSync(join(process.cwd(), path))).toBe(true);
    if (!existsSync(join(process.cwd(), path))) return;
    const component = read(path);
    expect(component).toContain('data-unlock-route-path="true"');
    expect(component).toContain("<ol");
    expect(component).toContain('aria-current={node.state === "current" ? "step" : undefined}');
    for (const state of ["done", "current", "future", "unknown"]) {
      expect(component).toContain(`node.state === "${state}"`);
    }
    expect(component).toContain("<JournalStatusMark done");
  });

  it("uses the Wiki and RuneLite ten-chapter Recipe for Disaster route", () => {
    expect(RFD_ROUTE_CHAPTERS).toHaveLength(10);
    expect(RFD_ROUTE_CHAPTERS.map((chapter) => chapter.questName)).toEqual([
      "Recipe for Disaster - Another Cook's Quest",
      "Recipe for Disaster - Mountain Dwarf",
      "Recipe for Disaster - Wartface & Bentnoze",
      "Recipe for Disaster - Pirate Pete",
      "Recipe for Disaster - Lumbridge Guide",
      "Recipe for Disaster - Evil Dave",
      "Recipe for Disaster - Skrach Uglogwee",
      "Recipe for Disaster - Sir Amik Varze",
      "Recipe for Disaster - King Awowogei",
      "Recipe for Disaster - Culinaromancer"
    ]);
    expect(RFD_ROUTE_CHAPTERS.every((chapter) => chapter.gate.length > 0)).toBe(true);
  });

  it("marks exact completions, one current node and unverified chapters without guessing", () => {
    const unknown = buildRfdRouteNodes(null);
    expect(unknown).toHaveLength(10);
    expect(unknown.every((node) => node.state === "unknown")).toBe(true);
    expect(unknown.every((node) => node.requirement.startsWith("Needs RuneLite to verify this chapter."))).toBe(true);

    const exact = buildRfdRouteNodes(new Set([
      "Recipe for Disaster - Another Cook's Quest",
      "Recipe for Disaster - Mountain Dwarf"
    ]));
    expect(exact.slice(0, 2).map((node) => node.state)).toEqual(["done", "done"]);
    expect(exact[2]?.state).toBe("current");
    expect(exact.slice(3).every((node) => node.state === "future")).toBe(true);
  });
});
