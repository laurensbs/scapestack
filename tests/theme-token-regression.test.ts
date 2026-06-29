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
    expect(globalsCss).toContain("--color-warning: #D6A63A;");
    expect(globalsCss).not.toContain("--color-warn:");
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
