import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PinnedGoalsPanel } from "@/components/pinned-goals-panel";

describe("pinned goal picker", () => {
  it("starts with the player choosing among item, level and unlock", () => {
    const html = renderToStaticMarkup(createElement(PinnedGoalsPanel, {
      rsn: "Lynx Titan",
      evidence: { skills: [{ name: "Slayer", level: 94 }] },
      canSync: false
    }));

    expect(html).toContain("Nothing pinned. Choose an item, level or unlock below.");
    expect(html).toContain('<option value="item" selected="">Item</option>');
    expect(html).toContain('<option value="level">Level</option>');
    expect(html).toContain('<option value="unlock">Unlock</option>');
    expect(html).toContain("Pin goal");
    expect(html).not.toContain("progressbar");
  });
});
