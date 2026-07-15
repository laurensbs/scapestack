import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sourceFiles = [
  "src/components/bank-result.tsx",
  "src/app/slayer/slayer-client.tsx",
  "src/app/next/next-client.tsx",
  "src/app/dps/dps-client.tsx",
  "src/app/plugin/page.tsx",
  "src/components/bank-plugin-onboarding.tsx",
  "src/components/plugin-sync-checker.tsx",
  "src/components/header.tsx",
  "src/components/tips-card.tsx",
  "src/app/layout.tsx",
  "src/app/dev/layout/page.tsx"
] as const;

const componentSources = sourceFiles.map((path) => ({
  path,
  source: readFileSync(join(process.cwd(), path), "utf8")
}));

const globalsCss = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function definedThemeTokens(prefix: string) {
  return new Set(
    [...globalsCss.matchAll(new RegExp(`(${prefix}[a-zA-Z0-9-]+)\\s*:`, "g"))]
      .map((match) => match[1])
  );
}

function usedVarTokens(prefix: string) {
  const tokens = new Set<string>();
  for (const { source } of componentSources) {
    for (const match of source.matchAll(new RegExp(`var\\((${prefix}[a-zA-Z0-9-]+)`, "g"))) {
      tokens.add(match[1]);
    }
  }
  return tokens;
}

describe("theme token regressions", () => {
  it("does not reference the old undefined warning token", () => {
    for (const { path, source } of componentSources) {
      expect(source, `${path} should use --color-warning`).not.toContain("var(--color-warn)");
    }
  });

  it("keeps the canonical warning token on the gold brand palette", () => {
    expect(globalsCss).toContain("--color-warning: #E0AE37;");
    expect(globalsCss).not.toContain("--color-warn:");
  });

  it("keeps the visual system on black, cream and gold instead of green success branding", () => {
    expect(globalsCss).toContain("--color-bg: #030201;");
    expect(globalsCss).toContain("--color-text: #F7EFE1;");
    expect(globalsCss).toContain("--color-accent: #E0AE37;");
    expect(globalsCss).toContain("--color-good: #E0AE37;");
    expect(globalsCss).not.toContain("#00E29A");
    expect(globalsCss).not.toMatch(/--color-good:\s*#(?:10|16|22|34|59|00)/i);
  });

  it("defines the shared visual primitives for the reset", () => {
    expect(globalsCss).toContain(".scapestack-modal");
    expect(globalsCss).toContain(".scapestack-route-card");
    expect(globalsCss).toContain(".scapestack-boss-tile");
    expect(globalsCss).toContain(".scapestack-account-pill");
    expect(globalsCss).toContain(".scapestack-ghost-action");
  });

  it("defines every color token used by core UI surfaces", () => {
    const missing = [...usedVarTokens("--color-")]
      .filter((token) => !definedThemeTokens("--color-").has(token));

    expect(missing).toEqual([]);
  });

  it("defines every font token used by core UI surfaces", () => {
    const missing = [...usedVarTokens("--font-")]
      .filter((token) => !definedThemeTokens("--font-").has(token));

    expect(missing).toEqual([]);
  });
});
