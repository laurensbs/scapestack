import { describe, expect, it } from "vitest";
import { nextPluginHubCta } from "@/lib/next-plugin-hub-copy";

describe("next plugin hub CTA copy", () => {
  it("does not advertise Plugin Hub install while review is pending", () => {
    const cta = nextPluginHubCta("open", false);

    expect(cta.title).toBe("RuneLite sync pending review");
    expect(cta.body).toContain("Plugin Hub review is still pending");
    expect(cta.body).toContain("normal players can keep planning");
    expect(cta.cta).toBe("Track plugin review →");
  });

  it("acknowledges external tracker help without claiming exact plugin sync", () => {
    const cta = nextPluginHubCta("open", true);

    expect(cta.body).toContain("External trackers helped");
    expect(cta.body).toContain("verified RuneLite coverage labels");
    expect(cta.body).toContain("local setup only");
    expect(cta.body).not.toContain("exact in-client");
    expect(cta.body).not.toContain("exact plugin sync");
  });

  it("turns review blockers into a maintainer checklist instead of player install", () => {
    const cta = nextPluginHubCta("review-blocked", false);

    expect(cta.title).toBe("RuneLite sync review handoff blocked");
    expect(cta.body).toContain("Plugin Hub review is blocked");
    expect(cta.body).toContain("normal players should keep using web recommendations");
    expect(cta.body).toContain("reviewer checklist");
    expect(cta.cta).toBe("Open review checklist →");
  });

  it("keeps tracker-assisted runs useful while review handoff is blocked", () => {
    const cta = nextPluginHubCta("review-blocked", true);

    expect(cta.body).toContain("External trackers helped");
    expect(cta.body).toContain("needs reviewer-facing fixes");
    expect(cta.body).toContain("Keep planning with public data and bank context");
    expect(cta.body).not.toContain("installable");
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

  it("handles a closed submission without sending players to a fake install", () => {
    const cta = nextPluginHubCta("closed", true);

    expect(cta.title).toBe("RuneLite sync submission paused");
    expect(cta.body).toContain("closed right now");
    expect(cta.cta).toBe("Open plugin status →");
  });

  it("does not invent a pending review state when GitHub status is unavailable", () => {
    const cta = nextPluginHubCta("unknown", true);

    expect(cta.title).toBe("RuneLite sync status unavailable");
    expect(cta.body).toContain("cannot prove the Plugin Hub state");
    expect(cta.body).toContain("verify RuneLite sync status from the plugin page");
    expect(cta.body).not.toContain("review is still pending");
    expect(cta.cta).toBe("Open plugin status →");
  });
});
