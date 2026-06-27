export const BRAND_NAME = "Scapestack";
export const BRAND_SHORT_NAME = "Scapestack";
export const BRAND_TAGLINE = "Know what to do next in OSRS";
export const BRAND_SECONDARY_TAGLINE =
  "Type your RSN and get a route for tonight.";
export const BRAND_URL = "https://www.scapestack.org";
export const BRAND_THEME_COLOR = "#07090C";
export const BRAND_ACCENT_COLOR = "#E6A52F";
export const BRAND_BACKGROUND_COLOR = "#07090C";
export const BRAND_IMAGE_FONT_FAMILY = "Geist, Arial, sans-serif";

export const BRAND_DESCRIPTION =
  "Plan tonight's OSRS route from your stats, bank, goals, Slayer and RuneLite sync.";

export const BRAND_KEYWORDS = [
  "OSRS",
  "Old School RuneScape",
  "RuneLite",
  "bank organizer",
  "Bank Tags",
  "DPS calculator",
  "Slayer",
  "collection log",
  "Scapestack"
];

export const BRAND_SHORTCUTS = [
  {
    name: "Bank Organizer",
    short_name: "Bank",
    description: "Paste RuneLite Bank Tags and get a clean OSRS bank layout.",
    url: "/bank",
    icon: "/icon?tool=bank"
  },
  {
    name: "Next Up",
    short_name: "Next",
    description: "Plan the next account action from bank, hiscores and sync data.",
    url: "/next",
    icon: "/icon?tool=next"
  },
  {
    name: "RuneLite Sync",
    short_name: "Sync",
    description: "Install and verify the Scapestack RuneLite plugin.",
    url: "/plugin",
    icon: "/icon?tool=sync"
  }
];

export const BRAND_PUBLIC_ROUTES = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/bank", priority: 0.95, changeFrequency: "weekly" },
  { path: "/next", priority: 0.95, changeFrequency: "weekly" },
  { path: "/plugin", priority: 0.85, changeFrequency: "weekly" },
  { path: "/dps", priority: 0.8, changeFrequency: "weekly" },
  { path: "/slayer", priority: 0.8, changeFrequency: "weekly" },
  { path: "/goals", priority: 0.75, changeFrequency: "weekly" },
  { path: "/hiscore", priority: 0.7, changeFrequency: "monthly" }
] as const;

export const BRAND_LEGACY_REDIRECT_ROUTES = [
  "/gp",
  "/ge",
  "/skills",
  "/quests",
  "/diary"
] as const;

export const BRAND_POSITIONING = {
  category: "OSRS route planner",
  promise: "From account state to one useful next move.",
  feeling: "A clean OSRS route board with real account actions.",
  antiPattern: "Keep player-facing screens about choices, not internal status or generic product wording."
} as const;

export const BRAND_VOICE_RULES = [
  "Use practical OSRS player language.",
  "Prefer bank, gear, KC, trip, unlock, Slayer, diary, quest and setup over vague product words.",
  "Every recommendation explains what data it used and what the player can do next.",
  "Clickable things must look clickable; informational chips must not look like buttons.",
  "Never imply RuneLite sync reads bank, chat, clicks, screenshots, passwords or login data."
] as const;

export const BRAND_UI_SURFACES = [
  {
    page: "Tonight",
    role: "What should I do tonight?",
    primaryAction: "Plan next action",
    requiredFeeling: "Boss, Slayer, quest, diary, GP or chill progress from the account in front of you."
  },
  {
    page: "Bank",
    role: "What can I do with this bank?",
    primaryAction: "Use my bank",
    requiredFeeling: "Owned gear, supplies, item IDs and cheap upgrades without another bank-standing loop."
  },
  {
    page: "Boss",
    role: "What boss makes sense now?",
    primaryAction: "Find a boss route",
    requiredFeeling: "Realistic KC targets, gear checks, wiki links and the missing item that matters."
  },
  {
    page: "Slayer",
    role: "Should I kill, skip or extend?",
    primaryAction: "Route task",
    requiredFeeling: "Task notes, unlocks, cannon/barrage hints and what to do after the task."
  },
  {
    page: "Unlocks",
    role: "Which unlock is close?",
    primaryAction: "Check goals",
    requiredFeeling: "Diaries, quests, capes, Barrows gloves, raids prep and other account milestones."
  },
  {
    page: "Sync",
    role: "Stop suggesting things already done.",
    primaryAction: "Sync account",
    requiredFeeling: "Quest, diary, collection log and Slayer context when the player wants sharper plans."
  }
] as const;

export const BRAND_PLAYER_PROMPTS = [
  {
    label: "I have 45 minutes",
    copy: "Give me one thing I can finish tonight.",
    href: "/next"
  },
  {
    label: "I need GP",
    copy: "Find money routes my account can actually do.",
    href: "/next"
  },
  {
    label: "I want boss KC",
    copy: "Pick a boss where my stats and gear make sense.",
    href: "/dps"
  },
  {
    label: "Low effort",
    copy: "Useful progress without a long setup.",
    href: "/next"
  }
] as const;

export const BRAND_STATE_SYSTEM = [
  {
    state: "Empty",
    label: "No bank yet",
    copy: "Paste Bank Memory, Bank Tags or enter an RSN. We can still plan from public Hiscores, but gear advice improves with bank context.",
    action: "Paste bank"
  },
  {
    state: "Loading",
    label: "Checking account signals",
    copy: "Reading Hiscores, parsing bank items, checking saved handoffs and preparing the next-action list.",
    action: "Show progress"
  },
  {
    state: "Error",
    label: "Input needs fixing",
    copy: "Say exactly what failed, keep the manual copy path visible, and offer the next safe retry.",
    action: "Try again"
  },
  {
    state: "Mobile",
    label: "One-thumb prep",
    copy: "Primary action first, secondary links collapsed, item IDs still visible, no hover-only affordances.",
    action: "Open action sheet"
  }
] as const;

export function brandUrl(path = "/"): string {
  return new URL(path, BRAND_URL).toString();
}
