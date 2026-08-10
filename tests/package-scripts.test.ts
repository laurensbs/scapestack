import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
  scripts?: Record<string, string>;
};

describe("package scripts", () => {
  it("does not use the removed Next lint command as a release gate", () => {
    expect(packageJson.scripts?.lint).toBe("tsc --noEmit");
    expect(packageJson.scripts?.lint).not.toBe("next lint");
  });

  it("keeps explicit quality gates available", () => {
    expect(packageJson.scripts?.typecheck).toBe("tsc --noEmit");
    expect(packageJson.scripts?.test).toBe("vitest run");
    expect(packageJson.scripts?.build).toBe("next build");
    expect(packageJson.scripts?.smoke).toBe("tsx scripts/smoke.mjs");
  });

  it("exposes one production-readiness check for the full web and plugin handoff", () => {
    expect(packageJson.scripts?.["ci:check"]).toBe([
      "npm run typecheck",
      "npm test",
      "npm run smoke",
      // REBRAND.md Section 3: the forbidden list is build-blocking, and the
      // file says to run it "before every screenshot pass and before done".
      // A design rule nobody runs is a design suggestion.
      "npm run rebrand:lint",
      // Four artefacts that each came back at least once: shadcn, Inter, the
      // stat-counter row, and the Setup/Boss nav labels. Separate from
      // rebrand:lint because that one is a design gate and this one is a
      // "never again" list.
      "npm run lint:forbidden",
      "npm run audit:next",
      "npm run audit:controller",
      "npm run plugin:release-check",
      "npm run build",
      "npm run e2e"
    ].join(" && "));
    expect(packageJson.scripts?.["plugin:review-handoff-command"]).toBe(
      "tsx scripts/print-plugin-review-packet.ts --handoff-command"
    );
    expect(packageJson.scripts?.["ci:cross-system"]).toBe("node scripts/run-cross-system-gate.mjs");
  });
});
