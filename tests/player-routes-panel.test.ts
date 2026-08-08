import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("the player route surface", () => {
  it("renders vertical, sprite-led routes and keeps the max wall collapsed", () => {
    const componentPath = "src/components/player-routes-panel.tsx";
    expect(existsSync(join(process.cwd(), componentPath))).toBe(true);
    if (!existsSync(join(process.cwd(), componentPath))) return;
    const component = read(componentPath);
    const page = read("src/app/p/[rsn]/page.tsx");
    const shell = read("src/components/player-hub-shell.tsx");

    expect(page).toContain("<PlayerRoutesPanel");
    expect(shell.indexOf('data-player-hub-section="routes"')).toBeGreaterThan(shell.indexOf('data-player-hub-section="goals"'));
    // The shell holds exactly three sections — the answer, the goals, the
    // routes. Bank and tools moved to /u/[rsn] on 2026-08-08.
    expect(shell).not.toContain('data-player-hub-section="bank"');
    expect(component).toContain('data-companion-route-kind={route.kind}');
    expect(component).toContain("<ol");
    expect(component).toContain("<details");
    expect(component).toContain("route.nodes.slice(0, 3)");
    expect(component).toContain("<JournalItemSprite");
    expect(component).toContain("<JournalStatusMark");
    expect(component).not.toMatch(/progressbar|totalHours|hours to max|Unlock \d+\/100/i);
  });

  it("uses Archivo weights by meaning and tabular figures for route numbers", () => {
    const component = read("src/components/player-routes-panel.tsx");
    const trackedClassLists = [...component.matchAll(/className="([^"]*\btracking-[^"]*)"/g)]
      .map((match) => match[1]);
    const metricClasses = component.match(
      /<span className="([^"]*)">\{node\.metric\}<\/span>/
    )?.[1] ?? "";
    const detailClasses = component.match(
      /<span className="([^"]*)">\{node\.detail\}<\/span>/
    )?.[1] ?? "";

    expect(component).toContain("font-semibold");
    expect(component).not.toMatch(/\bfont-(?:medium|bold|extrabold|black)\b/);
    // Section names moved to .scape-section-name (Quill Caps carries its own
    // capitals — no tracking, no uppercase transform); any tracking-* class
    // that remains must still be uppercase-only, checked below.
    expect(component).toContain('className="scape-section-name"');
    for (const classes of trackedClassLists) {
      expect(classes).toContain("uppercase");
    }
    expect(metricClasses).toContain("tabular-nums");
    expect(detailClasses).toContain("tabular-nums");
  });
});
