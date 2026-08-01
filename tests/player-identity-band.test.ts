import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PlayerIdentityBand } from "@/components/player-identity-band";

function renderIdentityBand(): string {
  return renderToStaticMarkup(createElement(PlayerIdentityBand, {
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
}

describe("the player identity band", () => {
  it("renders unknown synced progress as em dashes rather than zero fractions", () => {
    const html = renderIdentityBand();

    for (const domain of ["quests", "diaries", "collection-log"]) {
      expect(html).toContain(`data-player-identity-value="${domain}">—</dd>`);
    }
    expect(html).not.toMatch(/>0\s*\/\s*(158|48|1,600)</);
    expect(html).toContain("Quest completion is not visible in Hiscores");
    expect(html).toContain("Diary completion is not visible in Hiscores");
    expect(html).toContain("Collection-log completion is not visible in Hiscores");
  });

  it("uses one Archivo weight for each identity meaning", () => {
    const html = renderIdentityBand();
    const labels = [...html.matchAll(/<dt class="([^"]+)"/g)].map((match) => match[1]);
    const values = [...html.matchAll(/<dd class="([^"]+)"[^>]+data-player-identity-value="([^"]+)"/g)]
      .map((match) => ({ classes: match[1], domain: match[2] }));
    const pageSource = readFileSync(join(process.cwd(), "src/app/p/[rsn]/page.tsx"), "utf8");
    const globalsSource = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const titleClasses = pageSource.match(/<h1 className="([^"]+)"/)?.[1] ?? "";
    const headingRule = globalsSource.match(/h1, h2, h3\s*{([^}]+)}/)?.[1] ?? "";

    expect(labels).toHaveLength(6);
    expect(labels.every((classes) => classes.includes("font-semibold"))).toBe(true);
    expect(values).toHaveLength(6);
    for (const value of values) {
      const isUnknown = ["quests", "diaries", "collection-log"].includes(value.domain);
      const expectedWeight = isUnknown
        ? "font-normal"
        : "font-semibold";
      expect(value.classes).toContain(expectedWeight);
      expect(value.classes).not.toContain(isUnknown ? "font-semibold" : "font-normal");
      expect(value.classes).not.toMatch(/\bfont-(?:medium|bold|extrabold)\b/);
    }
    expect(titleClasses).toContain("font-semibold");
    expect(titleClasses).not.toMatch(/\bfont-(?:medium|bold|extrabold)\b/);
    expect(headingRule).toContain("font-weight: 600");
    expect(headingRule).not.toMatch(/font-weight:\s*(?:500|650|700)/);
  });

  it("makes every identity number a right-aligned tabular column", () => {
    const html = renderIdentityBand();
    const stats = [...html.matchAll(
      /<div class="([^"]+)"[^>]+data-player-identity-stat="[^"]+">[\s\S]*?<dd class="([^"]+)"[^>]+data-player-identity-value=/g
    )].map((match) => ({ columnClasses: match[1], valueClasses: match[2] }));

    expect(stats).toHaveLength(6);
    for (const stat of stats) {
      expect(stat.columnClasses).toContain("text-right");
      expect(stat.valueClasses).toContain("tabular-nums");
    }
  });

  it("keeps letter spacing on uppercase identity labels only", () => {
    const sources = [
      "src/components/player-identity-band.tsx",
      "src/app/p/[rsn]/page.tsx"
    ].map((path) => readFileSync(join(process.cwd(), path), "utf8"));
    const trackedClassLists = sources.flatMap((source) =>
      [...source.matchAll(/className="([^"]*\btracking-[^"]*)"/g)].map((match) => match[1])
    );

    expect(trackedClassLists.length).toBeGreaterThan(0);
    for (const classes of trackedClassLists) {
      expect(classes).toContain("uppercase");
    }

    const globalsSource = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const headingRule = globalsSource.match(/h1, h2, h3\s*{([^}]+)}/)?.[1] ?? "";
    expect(headingRule).not.toContain("letter-spacing");
  });
});
