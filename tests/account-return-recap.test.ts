import { describe, expect, it } from "vitest";
import { buildAccountReturnRecap } from "@/lib/account-return-recap";
import type { AccountTimelineMoment } from "@/lib/account-timeline";

function moment(overrides: Partial<AccountTimelineMoment> = {}): AccountTimelineMoment {
  return {
    id: "moment_1",
    kind: "xp",
    occurredAt: "2026-07-16T10:00:00.000Z",
    title: "Gained 180k Cooking XP",
    ...overrides
  };
}

describe("account return recap", () => {
  it("stays quiet when there is no real progress to recap", () => {
    expect(buildAccountReturnRecap({ moments: [] })).toBeNull();
    expect(buildAccountReturnRecap({
      moments: [
        moment({ id: "bank", kind: "bank", title: "Your bank changed" }),
        moment({ id: "plan", kind: "plan", title: "Next pick changed to Vorkath" }),
        moment({ id: "trip", kind: "trip", title: "Planned Push Vorkath to 50 KC" })
      ]
    })).toBeNull();
  });

  it("uses the strongest three progress moments instead of dumping the full history", () => {
    const recap = buildAccountReturnRecap({
      account: { rsn: "Lauky" },
      moments: [
        moment({ id: "bank", kind: "bank", title: "Your bank changed", occurredAt: "2026-07-16T12:00:00.000Z" }),
        moment({ id: "boss", kind: "boss", title: "Vorkath: 50 KC", detail: "+2 since the previous RuneLite check", occurredAt: "2026-07-16T11:00:00.000Z" }),
        moment({ id: "quest", kind: "quest", title: "Finished Monkey Madness II", occurredAt: "2026-07-16T10:00:00.000Z" }),
        moment({ id: "diary", kind: "diary", title: "Finished Karamja hard", occurredAt: "2026-07-16T09:00:00.000Z" }),
        moment({ id: "xp", kind: "xp", title: "Gained 180k Cooking XP", occurredAt: "2026-07-16T08:00:00.000Z" })
      ]
    });

    expect(recap).toMatchObject({
      title: "Finished unlocks are out of the way",
      nextAction: "Find the next unlock",
      nextHref: "/next?rsn=Lauky&from=recap",
      visualItemId: 9813,
      latestMomentId: "bank"
    });
    expect(recap?.moments.map((entry) => entry.id)).toEqual(["quest", "diary", "boss"]);
    expect(recap?.moments).toHaveLength(3);
  });

  it("turns boss and level progress into the next natural trip", () => {
    expect(buildAccountReturnRecap({
      moments: [moment({ id: "boss", kind: "boss", title: "Vorkath: 52 KC" })]
    })?.nextAction).toBe("Pick the next KC block");

    expect(buildAccountReturnRecap({
      moments: [moment({ id: "level", kind: "level", title: "Cooking reached 94" })]
    })?.nextAction).toBe("Replan from new levels");
  });

  it("keeps dashboard and technical language out of the recap copy", () => {
    const recap = buildAccountReturnRecap({
      moments: [moment({ id: "outcome", kind: "outcome", title: "Finished Push Vorkath to 50 KC", outcomeStatus: "progressed" })]
    });
    expect(JSON.stringify(recap)).not.toMatch(/payload|signals|data source|dashboard|KPI|readiness/i);
  });
});
