import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const smokeSource = readFileSync(join(process.cwd(), "scripts/smoke.mjs"), "utf8");
const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
  scripts?: Record<string, string>;
};

describe("organizer smoke script", () => {
  it("is exposed through package scripts instead of broken raw node execution", () => {
    expect(packageJson.scripts?.smoke).toBe("tsx scripts/smoke.mjs");
    expect(packageJson.scripts?.["smoke:live"]).toBe("tsx scripts/smoke.mjs --live");
    expect(smokeSource).toContain("npm run smoke");
    expect(smokeSource).toContain("npm run smoke:live");
    expect(smokeSource).not.toContain("Run: node scripts/smoke.mjs");
  });

  it("keeps offline ID/name/export validation separate from live price fetches", () => {
    expect(smokeSource).toContain("const livePrices = process.argv.includes(\"--live\")");
    expect(smokeSource).toContain("includePrices: livePrices");
    expect(smokeSource).toContain("skipped live Wiki price fetch");
    expect(smokeSource).toContain("stats.hasPrices = false in offline smoke mode");
  });
});
