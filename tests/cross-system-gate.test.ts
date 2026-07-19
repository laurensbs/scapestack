import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const runner = readFileSync(join(process.cwd(), "scripts/run-cross-system-gate.mjs"), "utf8");
const gradle = readFileSync(join(process.cwd(), "plugin/build.gradle"), "utf8");
const javaE2e = readFileSync(
  join(process.cwd(), "plugin/src/test/java/app/scapestack/runelite/EndToEndSmokeTest.java"),
  "utf8"
);

describe("non-optional plugin cross-system gate", () => {
  it("requires an explicitly isolated database and refuses production identity", () => {
    expect(runner).toContain('required("SCAPESTACK_E2E_DATABASE_URL")');
    expect(runner).toContain('SCAPESTACK_E2E_CONFIRM_ISOLATED !== "1"');
    expect(runner).toContain("databaseIdentity(productionDatabaseUrl) === databaseIdentity(e2eDatabaseUrl)");
    expect(gradle).toContain("e2eIsolationConfirmed != '1'");
    expect(gradle).toContain("e2eDbUrl == productionDbUrl");
  });

  it("starts the real app and always executes pluginE2e rather than skipping it", () => {
    expect(runner).toContain('resolve(root, "node_modules/.bin/next")');
    expect(runner).toContain('await run("./gradlew", ["pluginE2e"]');
    expect(javaE2e).not.toContain("Assume.assume");
    expect(javaE2e).not.toContain("@Ignore");
  });

  it("proves accepted receipt, persisted projection, history and browser readback", () => {
    expect(javaE2e).toContain('getAsJsonObject("accepted")');
    expect(javaE2e).toContain("FROM player_sync WHERE rsn=?");
    expect(javaE2e).toContain("JOIN sync_snapshot snapshot");
    expect(javaE2e).toContain('get(base + "/api/sync/status?rsn="');
    expect(javaE2e).toContain("deleteTestIdentity()");
  });
});
