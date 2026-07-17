import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

describe("mobile-first interface contract", () => {
  it("reserves safe space and uses reachable shared controls", () => {
    const css = read("src/app/globals.css");
    const header = read("src/components/header.tsx");
    const mood = read("src/components/session-mood-picker.tsx");

    expect(css).toContain(".mobile-content-safe");
    expect(css).toContain(".mobile-footer-safe");
    expect(css).toContain(".icon-btn");
    expect(css).toContain("width: 44px;");
    expect(css).toContain("height: 44px;");
    expect(css).toContain("max-height: calc(100dvh - 0.75rem)");
    expect(header).toContain("size-11 rounded-md");
    expect(header).toContain("max-h-[calc(100dvh-3.5rem)]");
    expect(header).toContain("env(safe-area-inset-bottom)+6rem");
    expect(mood).toContain('className="icon-btn"');
    expect(mood).toContain("scape-sheet flex w-full max-w-xl flex-col");
  });

  it("keeps carousel, search and route actions at least 44px tall", () => {
    const heroBoss = read("src/components/hero-boss-trip-preview.tsx");
    const dps = read("src/app/dps/dps-client.tsx");
    const next = read("src/app/next/next-client.tsx");

    expect(heroBoss).toContain('className="group grid size-11 place-items-center rounded-md"');
    expect(dps).toContain("mobile-scroll-row mt-3 sm:flex-wrap");
    expect(dps).toContain("min-h-11 shrink-0");
    expect(dps).toContain("flex size-11 -translate-y-1/2");
    expect(next).toContain("mt-3 inline-flex min-h-11 items-center");
  });

  it("uses mobile keyboard hints without triggering input zoom", () => {
    const sources = [
      read("src/components/header.tsx"),
      read("src/components/hero-intake.tsx"),
      read("src/app/next/next-client.tsx"),
      read("src/components/plugin-sync-checker.tsx")
    ];
    const dps = read("src/app/dps/dps-client.tsx");

    for (const source of sources) {
      expect(source).toContain('autoCapitalize="none"');
      expect(source).toContain('autoCorrect="off"');
      expect(source).toContain('enterKeyHint="go"');
      expect(source).toContain("text-[16px]");
    }
    expect(dps).toContain('inputMode="search"');
    expect(dps).toContain('enterKeyHint="search"');
    expect(dps).toContain("min-h-12 w-full");
  });
});
