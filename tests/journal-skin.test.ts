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
    expect(primitives).toContain("size={40}");
    expect(primitives).toContain('className="pixelated"');
    expect(primitives).toContain("[&>img]:!max-h-10 [&>img]:!max-w-10");

    const expectedConsumers = [
      ["src/components/pinned-goals-panel.tsx", "<JournalItemSprite"],
      ["src/components/player-sets-section.tsx", "<JournalItemSprite"],
      ["src/components/player-bosses-section.tsx", "<JournalSpriteSlot"],
      ["src/components/player-plan-answer.tsx", "<JournalSpriteSlot"],
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
});
