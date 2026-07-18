import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cancelReturnReminder,
  loadReturnReminder,
  reminderDueTomorrow,
  requestReminderDelivery,
  saveReturnReminder
} from "@/lib/return-reminder";

function installBrowser() {
  const values = new Map<string, string>();
  const localStorage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
    removeItem: vi.fn((key: string) => { values.delete(key); })
  };
  vi.stubGlobal("window", {
    localStorage,
    setTimeout: vi.fn()
  });
  return { localStorage, values };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("return reminder", () => {
  it("creates a local reminder tied to a chosen OSRS goal", () => {
    installBrowser();
    const reminder = saveReturnReminder({
      goal: "Pick the next KC block",
      href: "/next?rsn=Lauky&from=recap",
      now: new Date("2026-07-18T10:00:00.000Z")
    });

    expect(reminder).toMatchObject({
      version: 1,
      goal: "Pick the next KC block",
      href: "/next?rsn=Lauky&from=recap"
    });
    expect(new Date(reminder!.dueAt).getHours()).toBe(20);
    expect(new Date(reminder!.dueAt).getDate()).toBe(19);
    expect(loadReturnReminder()).toEqual(reminder);
  });

  it("can be cancelled without touching server state", () => {
    const { values } = installBrowser();
    saveReturnReminder({ goal: "Find the next unlock", href: "/next" });
    expect(values.size).toBe(1);
    cancelReturnReminder();
    expect(loadReturnReminder()).toBeNull();
  });

  it("handles missing or denied browser notifications as a saved local reminder", async () => {
    installBrowser();
    const reminder = saveReturnReminder({ goal: "Replan from new levels", href: "/next" });
    expect(await requestReminderDelivery(reminder!)).toEqual({
      ok: false,
      mode: "unsupported",
      reason: "This browser does not support notifications"
    });

    class DeniedNotification {
      static permission = "denied";
      static requestPermission = vi.fn();
    }
    vi.stubGlobal("Notification", DeniedNotification);
    vi.stubGlobal("window", { localStorage: window.localStorage, Notification: DeniedNotification, setTimeout: vi.fn() });
    expect(await requestReminderDelivery(reminder!)).toMatchObject({ ok: false, mode: "denied" });
  });

  it("sets tomorrow evening as the default quiet reminder time", () => {
    const due = reminderDueTomorrow(new Date("2026-07-18T21:00:00.000Z"));
    expect(due.getHours()).toBe(20);
    expect(due.getDate()).toBe(19);
  });
});
