import { describe, expect, it } from "vitest";
import {
  activeGoalRouteStorageKey,
  goalManualChecksStorageKey,
  goalRouteHref,
  goalSelectionStorageKey,
  persistActiveGoalRoute
} from "@/lib/goal-companion";

describe("goal companion handoff", () => {
  it("scopes manual checks, selection and active route to the account", () => {
    expect(goalManualChecksStorageKey(" Lynx Titan ")).toBe("scapestack:goals:manual-checks:v2:lynx-titan");
    expect(goalSelectionStorageKey("Lynx Titan")).toBe("scapestack:goals:selected:v1:lynx-titan");
    expect(activeGoalRouteStorageKey("Lynx Titan")).toBe("scapestack:goals:active-route:v1:lynx-titan");
    expect(goalManualChecksStorageKey("Other Main")).not.toBe(goalManualChecksStorageKey("Lynx Titan"));
  });

  it("opens /next in unlock mode with the exact chosen reward", () => {
    const href = goalRouteHref({
      rsn: "Lynx Titan",
      setId: "karamja-diary",
      targetName: "Karamja gloves 4"
    });
    const url = new URL(href, "https://scapestack.org");

    expect(url.pathname).toBe("/next");
    expect(url.searchParams.get("rsn")).toBe("Lynx Titan");
    expect(url.searchParams.get("intent")).toBe("unlock");
    expect(url.searchParams.get("unlock")).toBe("karamja-diary");
    expect(url.searchParams.get("target")).toBe("Karamja gloves 4");
  });

  it("persists the active unlock route with a timestamp", () => {
    const writes = new Map<string, string>();
    const saved = persistActiveGoalRoute(
      { setItem: (key, value) => writes.set(key, value) },
      "Lynx Titan",
      { setId: "karamja-diary", setName: "Karamja gloves", targetName: "Karamja gloves 4" }
    );

    expect(saved.savedAt).toBeTruthy();
    expect(JSON.parse(writes.get(activeGoalRouteStorageKey("Lynx Titan"))!)).toMatchObject({
      setId: "karamja-diary",
      targetName: "Karamja gloves 4"
    });
  });
});
