import { describe, expect, it } from "vitest";
import { nextPluginHubCta } from "@/lib/next-plugin-hub-copy";

describe("next plugin hub CTA copy", () => {
  it("routes open state to the Scapestack Sync checker instead of review tracking", () => {
    const cta = nextPluginHubCta("open", false);

    expect(cta.title).toBe("Check Scapestack Sync");
    expect(cta.body).toContain("Verify Scapestack Sync");
    expect(cta.body).toContain("account-aware next actions");
    expect(cta.cta).toBe("Check sync →");
    expect(cta.body).not.toContain("Plugin Hub review");
    expect(cta.cta).not.toContain("review");
  });

  it("acknowledges external tracker help without claiming exact plugin sync", () => {
    const cta = nextPluginHubCta("open", true);

    expect(cta.body).toContain("External trackers helped");
    expect(cta.body).toContain("verified Scapestack Sync payload");
    expect(cta.body).not.toContain("exact in-client");
    expect(cta.body).not.toContain("exact plugin sync");
  });

  it("turns blocked, closed and unknown states into the same sync-check path", () => {
    for (const state of ["review-blocked", "closed", "unknown"] as const) {
      const cta = nextPluginHubCta(state, false);
      expect(cta.title).toBe("Check Scapestack Sync");
      expect(cta.body).toContain("Open the sync checker");
      expect(cta.body).toContain("quests, diaries, collection-log items and Slayer state");
      expect(cta.cta).toBe("Check sync →");
      expect(cta.body).not.toContain("reviewer checklist");
      expect(cta.body).not.toContain("Plugin Hub PR");
    }
  });

  it("keeps tracker-assisted blocked runs useful without review handoff copy", () => {
    const cta = nextPluginHubCta("review-blocked", true);

    expect(cta.body).toContain("External trackers helped");
    expect(cta.body).toContain("confirm RuneLite posts to scapestack.org");
    expect(cta.body).toContain("verify this same RSN");
    expect(cta.body).not.toContain("reviewer-facing fixes");
  });

  it("switches to install-and-verify copy after Plugin Hub merge", () => {
    const cta = nextPluginHubCta("merged", false);

    expect(cta.title).toBe("Connect RuneLite sync");
    expect(cta.body).toContain("Install Scapestack Sync from RuneLite Plugin Hub");
    expect(cta.body).toContain("verify a payload before trusting those account-state coverage labels");
    expect(cta.body).not.toContain("treating those account-state checks as exact");
    expect(cta.cta).toBe("Install and verify →");
  });

  it("requires a verified payload even when external trackers helped", () => {
    const cta = nextPluginHubCta("merged", true);

    expect(cta.body).toContain("After RuneLite posts a verified payload");
    expect(cta.body).toContain("/next can label quest, diary, collection-log and Slayer coverage as verified, partial or missing");
    expect(cta.body).not.toContain("/next can mark quest, diary, collection-log and Slayer state exact");
  });
});
