import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlayerIdentityBand } from "@/components/player-identity-band";

describe("the player identity band", () => {
  it("renders unknown synced progress as em dashes rather than zero fractions", () => {
    const html = renderToStaticMarkup(createElement(PlayerIdentityBand, {
      totalLevel: 2202,
      combatLevel: 123,
      totalXp: 421_880_412,
      questProgress: null,
      questTotal: 158,
      diaryProgress: null,
      diaryTotal: 48,
      collectionLogProgress: null,
      collectionLogTotal: 1600
    }));

    for (const domain of ["quests", "diaries", "collection-log"]) {
      expect(html).toContain(`data-player-identity-value="${domain}">—</dd>`);
    }
    expect(html).not.toMatch(/>0\s*\/\s*(158|48|1,600)</);
    expect(html).toContain("Quest completion is not visible in Hiscores");
    expect(html).toContain("Diary completion is not visible in Hiscores");
    expect(html).toContain("Collection-log completion is not visible in Hiscores");
  });
});
