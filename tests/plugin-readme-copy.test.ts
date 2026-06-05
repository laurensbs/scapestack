import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readme = readFileSync(join(process.cwd(), "plugin/README.md"), "utf8");

describe("plugin README copy", () => {
  it("explains that plugin /next links are bankless by design", () => {
    expect(readme).toContain("## Web app merge contract");
    expect(readme).toContain("account-progress verifier, not a bank uploader");
    expect(readme).toContain("/next?rsn=...&source=plugin-sync&bank=none");
    expect(readme).toContain("bank=none");
    expect(readme).toContain("prevents stale browser bank context from being silently reused");
    expect(readme).toContain("RuneLite sync does not send bank");
    expect(readme).toContain("inventory, equipment or wealth");
    expect(readme).toContain("separately paste a bank into the web app");
    expect(readme).toContain("Gear-aware advice still requires the player to paste Bank Memory or Bank");
    expect(readme).toContain("/next`, `/slayer`, `/dps`, `/goals` and player profiles");
    expect(readme).toContain("the verified `/next?rsn=...&source=plugin-sync&bank=none` link");
    expect(readme).not.toContain("the exact `/next?rsn=...&source=plugin-sync&bank=none` link");
  });

  it("documents claim and sync token transport as Authorization bearer", () => {
    expect(readme).toContain("over HTTPS as `Authorization: Bearer <token>` to `/api/sync/claim`");
    expect(readme).toMatch(/Claim and sync requests both carry\s+the token as `Authorization: Bearer <token>`/);
    expect(readme).toContain("stores `sha256(token) → RSN` first-wins");
    expect(readme).not.toContain("first opted-in sync sends that token\nover HTTPS to `/api/sync/claim`");
  });

  it("uses verified coverage language instead of overclaiming recommendations", () => {
    const manifest = readFileSync(join(process.cwd(), "plugin/runelite-plugin.properties"), "utf8");

    expect(readme).toContain("coverage from a verified RuneLite payload");
    expect(manifest).toContain("verified coverage labels");
    expect(manifest).not.toContain("accurate recommendations");
  });
});
