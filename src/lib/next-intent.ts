import type { Mood, TimeBudget } from "./mood";

export type NextIntent =
  | "cash"
  | "quest"
  | "skill"
  | "focused"
  | "profile"
  | "chill"
  | "bossing"
  | "unlock"
  | "afk"
  | "short";

export interface NextIntentPreset {
  intent: NextIntent;
  mood: Mood;
  minutes: TimeBudget;
  label: string;
  helper: string;
}

const INTENT_PRESETS: Record<NextIntent, Omit<NextIntentPreset, "intent">> = {
  cash: {
    mood: "cash",
    minutes: 30,
    label: "Cash route",
    helper: "Prioritising GP/hour, tradeable upgrades and quick funding loops."
  },
  quest: {
    mood: "quest",
    minutes: 120,
    label: "Quest route",
    helper: "Prioritising quests, diaries and unlock chains over generic grinds."
  },
  skill: {
    mood: "chill",
    minutes: 60,
    label: "Skill route",
    helper: "Prioritising skilling sessions and low-friction account progress."
  },
  focused: {
    mood: "bossing",
    minutes: 60,
    label: "Focused route",
    helper: "Prioritising bossing, Slayer and high-impact account movement."
  },
  profile: {
    mood: "bossing",
    minutes: 60,
    label: "Profile Hiscores route",
    helper: "Started from this RSN's Hiscores; add bank for gear and RuneLite sync when you need verified quest, diary, collection-log or Slayer coverage."
  },
  chill: {
    mood: "chill",
    minutes: 30,
    label: "Chill route",
    helper: "Prioritising low-effort progress and avoiding sweaty boss trips."
  },
  bossing: {
    mood: "bossing",
    minutes: 60,
    label: "Bossing route",
    helper: "Prioritising PvM, KC blocks and Slayer when the account supports it."
  },
  unlock: {
    mood: "unlock",
    minutes: 120,
    label: "Unlock route",
    helper: "Prioritising quests, diaries, goals and account unlocks."
  },
  afk: {
    mood: "afk",
    minutes: 60,
    label: "AFK route",
    helper: "Prioritising skilling and low-attention progress."
  },
  short: {
    mood: "short",
    minutes: 15,
    label: "Short route",
    helper: "Prioritising a fast plan with a clean stop point."
  }
};

function normalizeIntent(value: string | null): NextIntent | null {
  const clean = (value ?? "").trim().toLowerCase();
  if (clean === "cash" || clean === "gp" || clean === "ge" || clean === "money") return "cash";
  if (clean === "quest" || clean === "quests" || clean === "diary" || clean === "diaries") return "quest";
  if (clean === "skill" || clean === "skills" || clean === "skilling") return "skill";
  if (clean === "focused" || clean === "pvm" || clean === "combat") return "focused";
  if (clean === "profile" || clean === "player" || clean === "account") return "profile";
  if (clean === "chill") return "chill";
  if (clean === "bossing" || clean === "boss") return "bossing";
  if (clean === "unlock" || clean === "unlocks") return "unlock";
  if (clean === "afk") return "afk";
  if (clean === "short" || clean === "quick") return "short";
  return null;
}

function normalizeTime(value: string | null, fallback: TimeBudget): TimeBudget {
  const minutes = Number.parseInt(value ?? "", 10);
  if (minutes === 15 || minutes === 30 || minutes === 60 || minutes === 120) return minutes;
  return fallback;
}

export function nextIntentFromSearch(search: string): NextIntentPreset | null {
  const params = new URLSearchParams(search.replace(/^\?/, ""));
  const intent = normalizeIntent(params.get("intent") ?? params.get("mood") ?? params.get("from"));
  if (!intent) return null;

  const preset = INTENT_PRESETS[intent];
  return {
    intent,
    ...preset,
    minutes: normalizeTime(params.get("time") ?? params.get("minutes"), preset.minutes)
  };
}

export function legacyRouteNextHref(route: "gp" | "ge" | "quests" | "diary" | "skills"): string {
  switch (route) {
    case "gp":
      return "/next?intent=cash&time=30";
    case "ge":
      return "/next?intent=cash&time=15";
    case "quests":
      return "/next?intent=quest&time=120";
    case "diary":
      return "/next?intent=quest&time=60";
    case "skills":
      return "/next?intent=skill&time=60";
  }
}
