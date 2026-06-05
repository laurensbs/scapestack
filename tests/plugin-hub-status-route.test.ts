import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/plugin-hub/status/route";

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body
  } as Response;
}

describe("plugin hub status API route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a cached pending status while the Plugin Hub PR is open", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      const target = String(url);

      if (target.endsWith("/pulls/12227")) {
        return jsonResponse({
          state: "open",
          draft: false,
          merged_at: null,
          updated_at: "2026-06-03T08:00:00Z",
          body: "Auto-sync defaults to on. The raw token never leaves the install. POST `https://www.scapestack.org/api/sync` on every login + on quest-complete chat messages.",
          html_url: "https://github.com/runelite/plugin-hub/pull/12227",
          head: { sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }
        });
      }
      if (target.endsWith("/pulls/12227/reviews")) {
        return jsonResponse([{ id: 1, state: "CHANGES_REQUESTED" }]);
      }
      if (target.endsWith("/pulls/12227/files")) {
        return jsonResponse([
          {
            filename: "plugins/scapestack-sync",
            patch: "@@ -0,0 +1,2 @@\n+repository=https://github.com/laurensbs/scapestack-runelite-plugin.git\n+commit=97b47fe5fe887e127492d8853fd1431b38a058f9"
          }
        ]);
      }
      if (target.endsWith("/commits/main")) {
        return jsonResponse({ sha: "97b47fe5fe887e127492d8853fd1431b38a058f9" });
      }
      if (target.endsWith("/commits/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/check-runs")) {
        return jsonResponse({
          check_runs: [
            { name: "build", conclusion: "success", status: "completed" },
            { name: "RuneLite Plugin Hub Checks", conclusion: "failure", status: "completed" }
          ]
        });
      }

      return jsonResponse({}, false);
    });

    const response = await GET();
    const payload = await response.json();

    expect(response.headers.get("cache-control")).toBe("s-maxage=300, stale-while-revalidate=600");
    expect(payload.state).toBe("open");
    expect(payload.detail).toContain("1 review recorded");
    expect(payload.checkSummary).toContain("maintainer review gate");
    expect(payload.pinSummary).toContain("matches standalone repo head");
    expect(payload.reviewCopySummary).toContain("review-copy fixes");
    expect(payload.reviewCopyIssues).toContain("token transport");
    expect(payload.reviewCopyIssues).toContain("POST timing");
    expect(payload.reviewCopyIssues).toContain("Slayer payload");
    expect(payload.reviewSummary).toContain("requested changes");
  });

  it("returns merged when GitHub reports a merged Plugin Hub PR", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      const target = String(url);

      if (target.endsWith("/pulls/12227")) {
        return jsonResponse({
          state: "closed",
          draft: false,
          merged_at: "2026-06-03T09:00:00Z",
          updated_at: "2026-06-03T09:00:00Z",
          html_url: "https://github.com/runelite/plugin-hub/pull/12227",
          head: { sha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }
        });
      }
      if (target.endsWith("/pulls/12227/reviews")) {
        return jsonResponse([{ id: 1, state: "APPROVED" }]);
      }
      if (target.endsWith("/pulls/12227/files")) {
        return jsonResponse([]);
      }
      if (target.endsWith("/commits/main")) {
        return jsonResponse({ sha: "97b47fe5fe887e127492d8853fd1431b38a058f9" });
      }
      if (target.endsWith("/commits/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/check-runs")) {
        return jsonResponse({
          check_runs: [
            { name: "build", conclusion: "success", status: "completed" }
          ]
        });
      }

      return jsonResponse({}, false);
    });

    const response = await GET();
    const payload = await response.json();

    expect(payload.state).toBe("merged");
    expect(payload.detail).toContain("Players should be able to install");
    expect(payload.reviewCount).toBe(1);
  });
});
