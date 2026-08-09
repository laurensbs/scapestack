import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const globals = read("src/app/globals.css");

function token(name: string): string {
  const match = globals.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6});`));
  if (!match?.[1]) throw new Error(`Missing hex token ${name}`);
  return match[1];
}

function luminance(hex: string): number {
  const channels = hex.match(/[0-9A-Fa-f]{2}/g)?.map((part) => Number.parseInt(part, 16) / 255) ?? [];
  const [red = 0, green = 0, blue = 0] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground: string, background: string): number {
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
}

describe("the Journal skin", () => {
  it("uses the measured warm palette and keeps every text token at 4.5:1", () => {
    expect(globals).toContain("--color-bg: #1C1811;");
    expect(globals).toContain("--color-panel: #2A2318;");
    expect(globals).toContain("--color-slot: #151009;");
    expect(globals).toContain("--color-border: #3A3226;");
    expect(globals).toContain("--color-border-strong: #5A4E3C;");
    expect(globals).toContain("--color-parchment-edge: #8A7142;");
    expect(globals).toMatch(/body\s*\{[^}]*background:\s*var\(--color-bg\);/s);

    for (const fixedDataColour of ["#FF981F", "#FFFF00", "#00FF80", "#FF9040"]) {
      expect(globals).toContain(fixedDataColour);
    }

    const surfaces = [token("--color-bg"), token("--color-panel"), token("--color-slot")];
    const textTokens = [
      "--color-text",
      "--color-text-secondary",
      "--color-text-dim",
      "--color-text-muted",
      "--color-accent",
      "--color-danger",
      "--color-data-head",
      "--color-data-level",
      "--color-data-m",
      "--color-data-item"
    ];
    for (const textToken of textTokens) {
      for (const surface of surfaces) {
        expect(contrast(token(textToken), surface), `${textToken} on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }

    const verdictBlock = globals.match(/\.scape-verdict\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(verdictBlock).toContain("background: var(--color-slot);");
    for (const gate of [
      "--color-gate-far-above",
      "--color-gate-above",
      "--color-gate-over",
      "--color-gate-close",
      "--color-gate-even",
      "--color-gate-under",
      "--color-gate-below",
      "--color-gate-easy",
      "--color-gate-trivial"
    ]) {
      expect(contrast(token(gate), token("--color-slot")), `${gate} on slot`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("gives named Journal rows a pixelated 40px sprite in one shared slot", () => {
    const primitives = read("src/components/journal-primitives.tsx");
    expect(primitives).toContain('data-journal-sprite-slot="true"');
    // 32, not 40: chisel serves 16-30px natives; 32 is an exact 2x
    // for the small ones where 40 was a 2.5x smear.
    expect(primitives).toContain("size={32}");
    expect(primitives).toContain('className="pixelated"');
    expect(primitives).toContain("[&>img]:!max-h-8 [&>img]:!max-w-8");

    const expectedConsumers = [
      ["src/components/pinned-goals-panel.tsx", "<JournalItemSprite"],
      ["src/components/player-sets-section.tsx", "<JournalItemSprite"],
      ["src/components/player-bosses-section.tsx", "<JournalSpriteSlot"],
      ["src/components/player-plan-answer.tsx", "<JournalSpriteSlot"],
      ["src/components/player-routes-panel.tsx", "<JournalItemSprite"],
      ["src/components/player-skills-table.tsx", "<JournalSpriteSlot"],
      ["src/components/path-overview.tsx", "<JournalItemSprite"],
      ["src/components/path-detail-modal.tsx", "<JournalSpriteSlot"],
      ["src/app/next/next-client.tsx", "<JournalItemSprite"]
    ] as const;
    for (const [path, marker] of expectedConsumers) {
      expect(read(path), path).toContain(marker);
    }

    const affordability = read("src/lib/bank-affordability.ts");
    expect(affordability).toContain("iconItemId?: number;");
    expect(affordability).toContain("iconItemId: set.iconItemId");
  });

  it("renders completion as fractions and contains no progress bar or ring", () => {
    const overview = read("src/components/path-overview.tsx");
    const detail = read("src/components/path-detail-modal.tsx");
    const bank = read("src/components/bank-result.tsx");
    const next = read("src/app/next/next-client.tsx");

    expect(overview).toContain("{path.done}/{path.total}");
    expect(detail).toContain("{path.done}/{path.total}");
    expect(bank).toContain("{p.owned}/{p.total}");
    expect(overview).not.toContain("BigRing");
    expect(overview).not.toContain("PathRing");
    expect(detail).not.toContain("{path.percent}%");
    expect(bank).not.toContain("style={{ width: `${pct}%` }}");
    expect(next).not.toContain("`${quests.percent}% route`");
    expect(next).not.toContain("`${summary.goalPercent}%`");
    expect(next).not.toContain("{pathData.overallPercent}% mapped");
    expect(next).not.toContain("{route.progressPercent}%");
    expect(globals).not.toContain("@keyframes bar-fill");
  });

  it("uses ticks and crosses with text for every binary Journal status", () => {
    const primitives = read("src/components/journal-primitives.tsx");
    expect(primitives).toContain('done ? "✓" : "×"');
    expect(primitives).toContain('aria-label={done ? "Done" : "Not done"}');
    expect(primitives).toContain('data-state={done ? "done" : "not-done"}');
    expect(globals).toContain('.journal-status-mark[data-state="done"]');
    expect(globals).toContain('.journal-status-mark[data-state="not-done"]');

    for (const path of [
      "src/components/pinned-goals-panel.tsx",
      "src/components/path-detail-modal.tsx",
      "src/app/quests/[slug]/quest-detail-client.tsx"
    ]) {
      expect(read(path), path).toContain("<JournalStatusMark");
    }
  });

  it("holds the companion shell to the target counts and Archivo meanings", () => {
    const playerSurfacePaths = [
      "src/app/p/[rsn]/page.tsx",
      "src/components/bank-observations-panel.tsx",
      "src/components/item-sprite.tsx",
      "src/components/journal-primitives.tsx",
      "src/components/last-trip-line.tsx",
      "src/components/money-methods-panel.tsx",
      "src/components/pinned-goals-panel.tsx",
      "src/components/player-bosses-section.tsx",
      "src/components/player-identity-band.tsx",
      "src/components/player-plan-answer.tsx",
      "src/components/player-plan-panel.tsx",
      "src/components/player-routes-panel.tsx",
      "src/components/player-sets-section.tsx",
      "src/components/player-skills-table.tsx",
      "src/components/player-task-section.tsx",
      "src/components/player-tool-nav.tsx",
      "src/components/player-tools-sections.tsx",
      "src/components/quest-completion-questions.tsx"
    ];
    const sources = playerSurfacePaths.map((path) => ({ path, source: read(path) }));
    const playerSurface = sources.map(({ source }) => source).join("\n");

    expect(playerSurface.match(/text-\[length:var\(--text-answer\)\]/g)).toHaveLength(1);
    expect(playerSurface.match(/scapestack-primary-action/g)).toHaveLength(1);
    expect(playerSurface).not.toMatch(/text-\[(?!(?:11|12|14|19|28|40)px\])[0-9.]+px\]/);
    expect(playerSurface).not.toMatch(/\bfont-(?:medium|bold|black)\b/);
    expect(playerSurface.match(/font-extrabold!/g)).toHaveLength(1);

    for (const { path, source } of sources) {
      for (const match of source.matchAll(/className="([^"]*tracking-[^\s"]+[^"]*)"/g)) {
        expect(match[1], `${path} tracks text that is not uppercase`).toContain("uppercase");
      }
    }

    const tableRule = globals.match(/\.scape-table\s*\{[^}]*\}/s)?.[0] ?? "";
    const tableCellRule = globals.match(/\.scape-table td\s*\{[^}]*\}/s)?.[0] ?? "";
    const commandRule = globals.match(/\.scapestack-command-button\s*\{[^}]*\}/s)?.[0] ?? "";
    const statusRule = globals.match(/\.journal-status-mark\s*\{[^}]*\}/s)?.[0] ?? "";
    const eyebrowRule = globals.match(/\.eyebrow\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(tableRule).toContain("font-size: var(--text-body);");
    expect(tableCellRule).toContain("font-variant-numeric: tabular-nums;");
    // The command button speaks the display face. It used to speak RuneScape
    // Bold 12, a recreation of a Jagex face that REBRAND.md 9.4 rules out
    // under the Fan Content Policy — and being a bitmap grid, it was crisp
    // only at multiples of 16px, which this file had to enforce as a rule.
    // Cinzel is crisp at any size, so the size assertion is an ordinary one.
    expect(commandRule).toContain("font-size: var(--text-body);");
    expect(commandRule).toContain("font-weight: 400;");
    expect(commandRule).toContain("var(--font-display)");
    expect(commandRule).toContain("box-shadow: var(--bevel-raised);");
    expect(statusRule).toContain("font-weight: 600;");  // the mark glyph itself
    // Chrome carries no weight: the eyebrow distinguishes itself with case
    // and tracking, and the page budget caps semibold at 35% of elements.
    expect(eyebrowRule).toContain("font-weight: 400;");
  });
});
