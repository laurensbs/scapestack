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
    expect(shell.indexOf('data-player-hub-section="routes"')).toBeGreaterThan(shell.indexOf('data-player-hub-section="plan"'));
    expect(shell.indexOf('data-player-hub-section="routes"')).toBeLessThan(shell.indexOf('data-player-hub-section="bank"'));
    expect(component).toContain('data-companion-route-kind={route.kind}');
    expect(component).toContain("<ol");
    expect(component).toContain("<details");
    expect(component).toContain("route.nodes.slice(0, 3)");
    expect(component).toContain("<JournalItemSprite");
    expect(component).toContain("<JournalStatusMark");
    expect(component).not.toMatch(/progressbar|totalHours|hours to max|Unlock \d+\/100/i);
  });
});
