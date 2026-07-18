import { describe, expect, it } from "vitest";
import type { AccountTimelineMoment } from "@/lib/account-timeline";
import { buildReturnHomeSummary } from "@/lib/return-home";

function moment(overrides: Partial<AccountTimelineMoment> = {}): AccountTimelineMoment {
  return {
    id: "moment_1",
    kind: "xp",
    occurredAt: "2026-07-17T10:00:00.000Z",
    title: "Gained 120k Slayer XP",
    ...overrides
  };
}

describe("return-home summary", () => {
  it("picks the most meaningful real account change instead of the newest low-value event", () => {
    const summary = buildReturnHomeSummary({
      moments: [
        moment({ id: "bank", kind: "bank", occurredAt: "2026-07-17T11:00:00.000Z", title: "Your bank changed" }),
        moment({ id: "quest", kind: "quest", title: "Finished Desert Treasure II" })
      ]
    });

    expect(summary).toMatchObject({
      eyebrow: "Since your last visit",
      headline: "Finished Desert Treasure II",
      hasNewProgress: true,
      latestMomentId: "bank"
    });
  });

  it("says whether the previous stop point progressed or completed", () => {
    const progressed = buildReturnHomeSummary({
      moments: [moment({
        kind: "outcome",
        title: "Progressed Push Vorkath to 50 KC",
        detail: "48/50 KC. 2 left.",
        outcomeStatus: "progressed"
      })]
    });
    const completed = buildReturnHomeSummary({
      moments: [moment({
        kind: "outcome",
        title: "Finished Push Vorkath to 50 KC",
        outcomeStatus: "completed"
      })]
    });

    expect(progressed.stopPoint).toContain("Previous stop point progressed");
    expect(completed.stopPoint).toContain("Previous stop point complete");
  });

  it("does not celebrate old progress again after that return moment was consumed", () => {
    const summary = buildReturnHomeSummary({
      moments: [moment({
        id: "seen",
        title: "Finished Push Vorkath to 50 KC",
        kind: "outcome",
        outcomeStatus: "completed"
      })],
      lastSeenMomentId: "seen",
      fallback: { lastPlanTitle: "Finish a Dust devil task" }
    });

    expect(summary).toMatchObject({
      headline: "Your next trip is still ready.",
      hasNewProgress: false
    });
    expect(summary.eyebrow).toBe("Pick it back up");
    expect(summary.detail).toContain("Finish a Dust devil task");
    expect(summary.stopPoint).toBeNull();
  });

  it("keeps an unconnected local account useful without inventing progress", () => {
    const summary = buildReturnHomeSummary({ fallback: { startedTitle: "Run herbs + birdhouses" } });

    expect(summary.headline).toBe("Your next trip is still ready.");
    expect(summary.detail).toContain("Run herbs + birdhouses");
    expect(summary.stopPoint).toBeNull();
  });

  it("never makes a returning account feel empty when there is no new scan", () => {
    const summary = buildReturnHomeSummary({});

    expect(summary.headline).toBe("Pick a fresh trip.");
    expect(summary.detail).toContain("one clean thing to do now");
    expect(summary.headline).not.toContain("No new progress");
  });
});
