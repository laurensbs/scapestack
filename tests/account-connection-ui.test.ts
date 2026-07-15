import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("progressive account connection UI", () => {
  const modal = readFileSync("src/components/connect-browser-modal.tsx", "utf8");
  const header = readFileSync("src/components/header.tsx", "utf8");
  const pluginPanel = readFileSync("plugin/src/main/java/app/scapestack/runelite/ScapestackSyncPanel.java", "utf8");

  it("keeps first value RSN-first and makes browser recovery explicit", () => {
    expect(header).toContain("Connect this browser");
    expect(header).toContain("Connected on this browser");
    expect(header).toContain("hydrateConnectedAccount");
    expect(modal).toContain("No email, password or RuneScape login.");
    expect(modal).toContain("Waiting for RuneLite");
  });

  it("uses RuneLite as proof without exposing developer auth language", () => {
    expect(modal).toContain("RuneLite confirms the player");
    expect(pluginPanel).toContain("Connect browser");
    expect(pluginPanel).toContain("Get a code on Scapestack");
    expect(modal).not.toContain("bearer");
    expect(modal).not.toContain("token_hash");
    expect(modal).not.toContain("account_id");
  });
});
