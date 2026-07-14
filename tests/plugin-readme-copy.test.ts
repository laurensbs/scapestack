import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readme = readFileSync(join(process.cwd(), "plugin/README.md"), "utf8");

describe("plugin README copy", () => {
  it("explains plugin /next links and included bank items", () => {
    expect(readme).toContain("## Web app merge contract");
    expect(readme).toContain("account-progress helper with bank items included by default");
    expect(readme).toContain("/next?rsn=...&source=plugin-sync&bank=none");
    expect(readme).toContain("bank=none");
    expect(readme).toContain("prevents stale browser bank context from being silently reused");
    expect(readme).toContain("Use bank for trips");
    expect(readme).toContain("turn off");
    expect(readme).toContain("fresh RuneLite bank");
    expect(readme).toContain("normal players do not paste or configure a");
    expect(readme).toContain("sync URL");
    expect(readme).toContain("inventory, equipment, GE offers, chat");
    expect(readme).toContain("Gear-aware prices and manual Bank Tags still use browser Bank Memory or Bank");
    expect(readme).toContain("/next`, `/slayer`, `/dps`, `/goals` and player profiles");
    expect(readme).toContain("state without making the RuneLite chat message show a long URL");
    expect(readme).not.toContain("RuneLite chat shows the verified `/next` link");
    expect(readme).not.toContain("the exact `/next?rsn=...&source=plugin-sync&bank=none` link");
  });

  it("documents claim and sync token transport as Authorization bearer", () => {
    expect(readme).toContain("Authorization: Bearer <token>` to `/api/sync/claim` and `/api/sync`");
    expect(readme).toMatch(/Claim and sync requests both carry\s+the token as `Authorization: Bearer <token>`/);
    expect(readme).toContain("stores `sha256(token) → RSN` first-wins");
    expect(readme).not.toContain("first opted-in sync sends that token\nover HTTPS to `/api/sync/claim`");
  });

  it("uses verified coverage language instead of overclaiming recommendations", () => {
    const manifest = readFileSync(join(process.cwd(), "plugin/runelite-plugin.properties"), "utf8");

    expect(readme).toContain("coverage from RuneLite");
    expect(manifest).toContain("OSRS session planner");
    expect(manifest).toContain("bank items");
    expect(manifest).not.toContain("accurate recommendations");
  });
});
