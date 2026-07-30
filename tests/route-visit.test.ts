import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  analyticsRouteFor,
  classifyAndRecordVisit,
  resetRouteVisits,
  visitorForRoute
} from "@/lib/route-visit";

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    dump: () => Object.fromEntries(map)
  };
}

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

beforeEach(() => resetRouteVisits());

describe("route mapping", () => {
  it("maps the routes worth comparing", () => {
    expect(analyticsRouteFor("/")).toBe("home");
    expect(analyticsRouteFor("/next")).toBe("next");
    expect(analyticsRouteFor("/next?rsn=Lynx%20Titan")).toBe("next");
    expect(analyticsRouteFor("/slayer")).toBe("slayer");
    expect(analyticsRouteFor("/dps")).toBe("dps");
    expect(analyticsRouteFor("/p/lynx-titan")).toBe("profile");
    expect(analyticsRouteFor("/u/lynx-titan")).toBe("profile");
  });

  it("ignores routes that are not part of the question", () => {
    expect(analyticsRouteFor("/api/sync")).toBeNull();
    expect(analyticsRouteFor("/share/trip/abc")).toBeNull();
  });
});

describe("visit classification", () => {
  it("calls a browser that has never opened the route a first visit", () => {
    expect(classifyAndRecordVisit("next", NOW, fakeStorage())).toBe("first");
  });

  it("calls a visit within seven days a return", () => {
    const storage = fakeStorage({ "scapestack:route-seen:next": String(NOW - 3 * DAY) });
    expect(classifyAndRecordVisit("next", NOW, storage)).toBe("returning_7d");
  });

  it("does not count a visit after seven days as the weekly signal", () => {
    const storage = fakeStorage({ "scapestack:route-seen:next": String(NOW - 30 * DAY) });
    expect(classifyAndRecordVisit("next", NOW, storage)).toBe("returning_later");
  });

  it("treats the boundary as still returning", () => {
    const storage = fakeStorage({ "scapestack:route-seen:next": String(NOW - 7 * DAY) });
    expect(classifyAndRecordVisit("next", NOW, storage)).toBe("returning_7d");
  });

  it("keeps routes independent, which is the entire point", () => {
    const storage = fakeStorage({ "scapestack:route-seen:next": String(NOW - DAY) });
    expect(classifyAndRecordVisit("next", NOW, storage)).toBe("returning_7d");
    expect(classifyAndRecordVisit("slayer", NOW, storage)).toBe("first");
  });

  it("records the visit so the next one can be compared against it", () => {
    const storage = fakeStorage();
    classifyAndRecordVisit("dps", NOW, storage);
    expect(storage.dump()["scapestack:route-seen:dps"]).toBe(String(NOW));
    expect(classifyAndRecordVisit("dps", NOW + DAY, storage)).toBe("returning_7d");
  });

  it("degrades to a first visit when storage is unavailable", () => {
    // A private window must still get a working page.
    expect(classifyAndRecordVisit("next", NOW, null)).toBe("first");
    const throwing = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); }
    };
    expect(classifyAndRecordVisit("next", NOW, throwing)).toBe("first");
  });

  it("stores no name, no id and nothing but a timestamp", () => {
    const storage = fakeStorage();
    classifyAndRecordVisit("profile", NOW, storage);
    const dump = storage.dump();
    expect(Object.keys(dump)).toEqual(["scapestack:route-seen:profile"]);
    expect(dump["scapestack:route-seen:profile"]).toMatch(/^\d+$/);
  });
});

describe("engagement reports the bucket the arrival was classified as", () => {
  it("does not re-derive it, which would call every engaged visit a return", () => {
    // classifyAndRecordVisit writes the timestamp, so a second reading seconds
    // later would always land inside the seven-day window.
    const storage = fakeStorage();
    expect(classifyAndRecordVisit("slayer", NOW, storage)).toBe("first");
    expect(visitorForRoute("slayer")).toBe("first");
    expect(classifyAndRecordVisit("slayer", NOW + 1_000, storage)).toBe("returning_7d");
  });

  it("assumes first for a route the player never arrived on this page load", () => {
    expect(visitorForRoute("goals")).toBe("first");
  });
});

describe("route engagement", () => {
  it("fires once per route and carries the arrival bucket", async () => {
    const { setAnalyticsTransport, resetAnalyticsState } = await import("@/lib/analytics");
    const { trackRouteEngagement, resetRouteEngagement } = await import("@/lib/route-engagement");
    resetAnalyticsState();
    resetRouteEngagement();
    resetRouteVisits();

    const sent: Array<{ event: string; props: unknown }> = [];
    setAnalyticsTransport((envelope) => sent.push({ event: envelope.event, props: envelope.props }));
    vi.stubGlobal("window", { location: { pathname: "/slayer" } });

    classifyAndRecordVisit("slayer", NOW, fakeStorage({ "scapestack:route-seen:slayer": String(NOW - DAY) }));
    trackRouteEngagement("task_checked");
    trackRouteEngagement("mood_changed");

    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual({
      event: "route:engaged",
      props: { route: "slayer", visitor: "returning_7d", action: "task_checked" }
    });

    setAnalyticsTransport(null);
    vi.unstubAllGlobals();
  });
});
