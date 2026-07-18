export interface ReturnReminder {
  version: 1;
  id: string;
  goal: string;
  href: string;
  dueAt: string;
  createdAt: string;
}

export type ReminderDelivery =
  | { ok: true; mode: "notification" | "local" }
  | { ok: false; mode: "unsupported" | "denied" | "failed"; reason: string };

const STORAGE_KEY = "scapestack:return-reminder:v1";
const MAX_GOAL_LENGTH = 120;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function cleanGoal(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_GOAL_LENGTH);
}

export function reminderDueTomorrow(now = new Date()): Date {
  const due = new Date(now);
  due.setDate(due.getDate() + 1);
  due.setHours(20, 0, 0, 0);
  if (due.getTime() <= now.getTime()) due.setTime(now.getTime() + 24 * 60 * 60 * 1000);
  return due;
}

export function loadReturnReminder(): ReturnReminder | null {
  const store = storage();
  if (!store) return null;
  try {
    const parsed = JSON.parse(store.getItem(STORAGE_KEY) ?? "null") as Partial<ReturnReminder> | null;
    if (!parsed || parsed.version !== 1 || typeof parsed.goal !== "string" || typeof parsed.href !== "string"
      || typeof parsed.dueAt !== "string" || typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") return null;
    if (!cleanGoal(parsed.goal) || !Number.isFinite(Date.parse(parsed.dueAt))) return null;
    return parsed as ReturnReminder;
  } catch {
    return null;
  }
}

export function saveReturnReminder(input: { goal: string; href: string; dueAt?: Date; now?: Date }): ReturnReminder | null {
  const store = storage();
  const goal = cleanGoal(input.goal);
  if (!store || !goal) return null;
  const now = input.now ?? new Date();
  const reminder: ReturnReminder = {
    version: 1,
    id: `return:${Date.parse(now.toISOString())}:${goal.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`,
    goal,
    href: input.href || "/next",
    dueAt: (input.dueAt ?? reminderDueTomorrow(now)).toISOString(),
    createdAt: now.toISOString()
  };
  store.setItem(STORAGE_KEY, JSON.stringify(reminder));
  return reminder;
}

export function cancelReturnReminder(): void {
  storage()?.removeItem(STORAGE_KEY);
}

export async function requestReminderDelivery(reminder: ReturnReminder): Promise<ReminderDelivery> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return { ok: false, mode: "unsupported", reason: "This browser does not support notifications" };
  }
  try {
    const permission = Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;
    if (permission !== "granted") {
      return { ok: false, mode: "denied", reason: "Notifications are blocked. The reminder is still saved here." };
    }
    const delay = Date.parse(reminder.dueAt) - Date.now();
    if (delay <= 0) {
      new Notification("Scapestack trip reminder", { body: reminder.goal });
      return { ok: true, mode: "notification" };
    }
    window.setTimeout(() => {
      new Notification("Scapestack trip reminder", { body: reminder.goal });
    }, Math.min(delay, 2 ** 31 - 1));
    return { ok: true, mode: "notification" };
  } catch {
    return { ok: false, mode: "failed", reason: "Could not arm browser notifications. The reminder is still saved here." };
  }
}
