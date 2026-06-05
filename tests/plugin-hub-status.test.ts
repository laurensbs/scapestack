import { describe, expect, it } from "vitest";
import { pluginHubMaintainerReviewGate, pluginHubReviewReadiness, summarizePluginHubPublicHtml, summarizePluginHubStatus } from "@/lib/plugin-hub-status";

describe("plugin hub status", () => {
  it("summarizes an open unreviewed PR as pending maintainer review", () => {
    const status = summarizePluginHubStatus({
      state: "open",
      draft: false,
      merged_at: null,
      updated_at: "2026-06-03T08:00:00Z",
      body: "Auto‑sync defaults to on. The raw token never leaves the install. POST `https://www.scapestack.org/api/sync` on every login + on quest-complete chat messages.",
      html_url: "https://github.com/runelite/plugin-hub/pull/12227"
    }, [], [
      { name: "build", conclusion: "success", status: "completed" },
      { name: "RuneLite Plugin Hub Checks", conclusion: "failure", status: "completed" }
    ], [
      {
        filename: "plugins/scapestack-sync",
        patch: "@@ -0,0 +1,2 @@\n+repository=https://github.com/laurensbs/scapestack-runelite-plugin.git\n+commit=97b47fe5fe887e127492d8853fd1431b38a058f9"
      }
    ], "97b47fe5fe887e127492d8853fd1431b38a058f9");

    expect(status.state).toBe("open");
    expect(status.label).toContain("open");
    expect(status.detail).toContain("Awaiting RuneLite maintainer review");
    expect(status.checkSummary).toContain("maintainer review gate");
    expect(status.submittedCommit).toBe("97b47fe5fe887e127492d8853fd1431b38a058f9");
    expect(status.standaloneCommit).toBe("97b47fe5fe887e127492d8853fd1431b38a058f9");
    expect(status.pinSummary).toContain("matches standalone repo head");
    expect(status.reviewCopySummary).toContain("Live PR body still needs review-copy fixes");
    expect(status.reviewCopySummary).toContain("auto-sync defaults");
    expect(status.reviewCopySummary).toContain("token transport");
    expect(status.reviewCopySummary).toContain("POST timing");
    expect(status.reviewCopySummary).toContain("quest-complete opt-in gate");
    expect(status.reviewCopySummary).toContain("Slayer payload");
    expect(status.reviewCopySummary).toContain("bank/inventory/equipment exclusion");
    expect(status.reviewCopyIssues).toEqual([
      "auto-sync defaults",
      "token transport",
      "POST timing",
      "quest-complete opt-in gate",
      "Slayer payload",
      "bank/inventory/equipment exclusion"
    ]);
    expect(status.reviewCount).toBe(0);
    expect(status.reviewSummary).toContain("No RuneLite reviews recorded yet");
    expect(status.reviewSummary).toContain("reviewer packet ready");

    const readiness = pluginHubReviewReadiness(status);
    expect(readiness.state).toBe("review-blocked");
    expect(readiness.playerInstallReady).toBe(false);
    expect(readiness.label).toContain("not clean");
    expect(readiness.blockers).toContain("PR body: auto-sync defaults");
    expect(readiness.blockers).toContain("PR body: token transport");

    const reviewGate = pluginHubMaintainerReviewGate(status);
    expect(reviewGate.state).toBe("unreviewed");
    expect(reviewGate.title).toBe("No maintainer review yet");
    expect(reviewGate.body).toContain("0 RuneLite reviews");
    expect(reviewGate.body).toContain("submitted, not evaluated");
    expect(reviewGate.nextAction).toContain("Keep players on bank paste and /next");
  });

  it("confirms when the live PR body matches current review wording", () => {
    const status = summarizePluginHubStatus({
      state: "open",
      draft: false,
      merged_at: null,
      updated_at: "2026-06-03T08:00:00Z",
      body: "Auto-sync on login defaults off. Sync on quest complete defaults off. Quest-complete sync is also gated behind Auto-sync on login. The raw local install token is sent only as an Authorization bearer and Scapestack stores sha256(token). Slayer task state is included after opt-in. No bank, inventory or equipment data is sent.",
      html_url: "https://github.com/runelite/plugin-hub/pull/12227"
    }, [], []);

    expect(status.reviewCopySummary).toBe("Live PR body appears aligned with current consent, token, data and web-handoff wording.");
    expect(status.reviewCopyIssues).toEqual([]);
    expect(pluginHubMaintainerReviewGate(status)).toMatchObject({
      state: "unreviewed",
      title: "No maintainer review yet"
    });
    expect(pluginHubReviewReadiness(status)).toMatchObject({
      state: "pending-review",
      playerInstallReady: false
    });
  });

  it("warns when the Plugin Hub pin is behind the standalone repo head", () => {
    const status = summarizePluginHubStatus({
      state: "open",
      draft: false,
      merged_at: null,
      updated_at: "2026-06-03T08:00:00Z",
      html_url: "https://github.com/runelite/plugin-hub/pull/12227"
    }, [], [], [
      {
        filename: "plugins/scapestack-sync",
        patch: "@@ -0,0 +1,2 @@\n+repository=https://github.com/laurensbs/scapestack-runelite-plugin.git\n+commit=1111111111111111111111111111111111111111"
      }
    ], "2222222222222222222222222222222222222222");

    expect(status.pinSummary).toContain("behind standalone repo head");
    expect(pluginHubReviewReadiness(status).blockers).toContain("Plugin Hub pin is behind standalone repo head");
  });

  it("turns changes-requested reviews into a concrete handoff warning", () => {
    const status = summarizePluginHubStatus({
      state: "open",
      draft: false,
      merged_at: null,
      updated_at: "2026-06-03T08:00:00Z",
      html_url: "https://github.com/runelite/plugin-hub/pull/12227"
    }, [{ id: 1, state: "CHANGES_REQUESTED" }]);

    expect(status.reviewCount).toBe(1);
    expect(status.reviewSummary).toContain("requested changes");
    expect(status.reviewSummary).toContain("move the Plugin Hub pin");
    expect(pluginHubMaintainerReviewGate(status)).toMatchObject({
      state: "changes-requested",
      title: "Maintainer changes requested"
    });
    expect(pluginHubReviewReadiness(status).blockers).toContain("RuneLite review requested changes");
  });

  it("turns approved reviews into an install-readiness hold", () => {
    const status = summarizePluginHubStatus({
      state: "open",
      draft: false,
      merged_at: null,
      updated_at: "2026-06-03T08:00:00Z",
      html_url: "https://github.com/runelite/plugin-hub/pull/12227"
    }, [{ id: 1, state: "APPROVED" }]);

    expect(status.reviewSummary).toContain("approval recorded");
    expect(status.reviewSummary).toContain("before advertising Plugin Hub install");
    expect(pluginHubMaintainerReviewGate(status)).toMatchObject({
      state: "approved",
      title: "Maintainer approval recorded"
    });
  });

  it("summarizes a merged PR as installable upstream", () => {
    const status = summarizePluginHubStatus({
      state: "closed",
      draft: false,
      merged_at: "2026-06-03T09:00:00Z",
      updated_at: "2026-06-03T09:00:00Z",
      html_url: "https://github.com/runelite/plugin-hub/pull/12227"
    }, [{ id: 1, state: "APPROVED" }], [
      { name: "build", conclusion: "success", status: "completed" }
    ]);

    expect(status.state).toBe("merged");
    expect(status.tone).toBe("good");
    expect(status.detail).toContain("RuneLite Plugin Hub");
    expect(status.checkSummary).toContain("Build is passing");
    expect(status.reviewCount).toBe(1);
    expect(pluginHubReviewReadiness(status)).toMatchObject({
      state: "installable",
      playerInstallReady: true
    });
  });

  it("surfaces non-review CI failures as action required", () => {
    const status = summarizePluginHubStatus({
      state: "open",
      draft: false,
      merged_at: null,
      updated_at: "2026-06-03T08:00:00Z",
      html_url: "https://github.com/runelite/plugin-hub/pull/12227"
    }, [], [
      { name: "build", conclusion: "failure", status: "completed" },
      { name: "RuneLite Plugin Hub Checks", conclusion: "failure", status: "completed" }
    ]);

    expect(status.checkSummary).toContain("need attention");
  });

  it("falls back when GitHub data is missing", () => {
    const status = summarizePluginHubStatus(null, null);

    expect(status.state).toBe("unknown");
    expect(status.detail).toContain("Live GitHub status unavailable");
    expect(status.checkSummary).toBeNull();
    expect(status.submittedCommit).toBeNull();
    expect(status.standaloneCommit).toBeNull();
    expect(status.pinSummary).toBeNull();
    expect(status.reviewCopySummary).toBeNull();
    expect(status.reviewCopyIssues).toEqual([]);
    expect(status.reviewSummary).toBeNull();
    expect(pluginHubReviewReadiness(status)).toMatchObject({
      state: "unknown",
      playerInstallReady: false
    });
  });

  it("preserves the stale PR-body blocker from public GitHub HTML when the API is unavailable", () => {
    const status = summarizePluginHubPublicHtml(`
      <html>
        <body>
          <h1>Add scapestack-sync#12227</h1>
          <span>Open</span>
          <p>Adds Scapestack Sync, a small plugin that POSTs your quest list, diary completion state, and collection-log item IDs.</p>
          <p>POST https://www.scapestack.org/api/sync on every login + on quest-complete chat messages.</p>
          <p>Auto-sync defaults to on but is visible in plugin settings.</p>
          <p>Each install generates a UUID locally that we hash server-side before storing — the raw token never leaves the install.</p>
          <p>No IP, no machine fingerprint, no chat-log content.</p>
          <a href="https://github.com/laurensbs/scapestack-runelite-plugin/tree/97b47fe5fe887e127492d8853fd1431b38a058f9">plugin pin</a>
          <p>This plugin requires a review from a Plugin Hub maintainer.</p>
          <h3>Reviewers</h3>
          <p>No reviews</p>
        </body>
      </html>
    `);

    expect(status).not.toBeNull();
    expect(status?.state).toBe("open");
    expect(status?.tone).toBe("warning");
    expect(status?.detail).toContain("public PR page");
    expect(status?.checkSummary).toContain("maintainer-review gate");
    expect(status?.submittedCommit).toBe("97b47fe5fe887e127492d8853fd1431b38a058f9");
    expect(status?.reviewCount).toBe(0);
    expect(status?.reviewSummary).toContain("No RuneLite reviews recorded yet");
    expect(status?.reviewCopySummary).toContain("Live PR body still needs review-copy fixes");
    expect(status?.reviewCopyIssues).toEqual([
      "auto-sync defaults",
      "token transport",
      "POST timing",
      "quest-complete opt-in gate",
      "Slayer payload",
      "bank/inventory/equipment exclusion"
    ]);
  });
});
