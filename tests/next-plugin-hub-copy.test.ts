import { describe, expect, it } from "vitest";
import { nextPluginHubCta } from "@/lib/next-plugin-hub-copy";

describe("next plugin hub CTA copy", () => {
  it("routes open state to the Scapestack Sync checker instead of review tracking", () => {
    const cta = nextPluginHubCta("open", false);

    expect(cta.title).toBe("Add Scapestack Sync");
    expect(cta.body).toContain("Your OSRS name is enough for a first plan");
    expect(cta.body).toContain("completed quests, diaries, collection log and Slayer");
    expect(cta.cta).toBe("Open sync →");
    expect(cta.body).not.toContain("Plugin Hub review");
    expect(cta.body).not.toContain("payload");
    expect(cta.cta).not.toContain("review");
  });

  it("acknowledges external tracker help without technical payload copy", () => {
    const cta = nextPluginHubCta("open", true);

    expect(cta.body).toContain("External trackers helped");
    expect(cta.body).toContain("avoid finished quests");
    expect(cta.body).toContain("Slayer mistakes");
    expect(cta.body).not.toContain("payload");
    expect(cta.body).not.toContain("exact plugin sync");
  });

  it("turns blocked, closed and unknown states into the same sync-check path", () => {
    for (const state of ["review-blocked", "closed", "unknown"] as const) {
      const cta = nextPluginHubCta(state, false);
      expect(cta.title).toBe("Add Scapestack Sync");
      expect(cta.body).toContain("Your OSRS name is enough for a first plan");
      expect(cta.body).toContain("completed quests");
      expect(cta.cta).toBe("Open sync →");
      expect(cta.body).not.toContain("reviewer checklist");
      expect(cta.body).not.toContain("Plugin Hub PR");
    }
  });

  it("keeps tracker-assisted blocked runs useful without review handoff copy", () => {
    const cta = nextPluginHubCta("review-blocked", true);

    expect(cta.body).toContain("External trackers helped");
    expect(cta.body).toContain("Sync the same RSN");
    expect(cta.body).toContain("finished quests");
    expect(cta.body).not.toContain("reviewer-facing fixes");
  });

  it("keeps merged state player-facing and free of Plugin Hub copy", () => {
    const cta = nextPluginHubCta("merged", false);

    expect(cta.title).toBe("Add Scapestack Sync");
    expect(cta.body).toContain("completed quests, diaries, collection log and Slayer");
    expect(cta.body).not.toContain("Plugin Hub");
    expect(cta.body).not.toContain("payload");
    expect(cta.cta).toBe("Open sync →");
  });

  it("keeps tracker-assisted merged state about avoiding finished progress", () => {
    const cta = nextPluginHubCta("merged", true);

    expect(cta.body).toContain("External trackers helped");
    expect(cta.body).toContain("avoid finished quests");
    expect(cta.body).not.toContain("coverage");
    expect(cta.body).not.toContain("payload");
  });
});
