import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PinnedGoalsPanel } from "@/components/pinned-goals-panel";
import { PlayerHubShell } from "@/components/player-hub-shell";

describe("the player goal picker", () => {
  it("never leaks a native select into the picker or player-page tree", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/pinned-goals-panel.tsx"),
      "utf8"
    );
    const picker = createElement(PinnedGoalsPanel, {
      rsn: "Lynx Titan",
      canSync: false,
      evidence: { skills: [] }
    });
    const playerTree = renderToStaticMarkup(createElement(PlayerHubShell, {
      header: createElement("p", null, "Identity"),
      lastTrip: null,
      goals: picker,
      plan: null
    }));

    expect(source.match(/<select\b/g) ?? []).toHaveLength(0);
    expect(playerTree).not.toMatch(/<select\b/);
  });
});
