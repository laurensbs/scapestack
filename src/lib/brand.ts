export const BRAND_NAME = "Scapestack";
export const BRAND_SHORT_NAME = "Scapestack";
export const BRAND_TAGLINE = "Know what to do next in OSRS";
export const BRAND_SECONDARY_TAGLINE =
  "Type your RSN. Pick one route before you log in.";
export const BRAND_URL = "https://www.scapestack.org";
export const BRAND_THEME_COLOR = "#07090C";
export const BRAND_ACCENT_COLOR = "#E6A52F";
export const BRAND_BACKGROUND_COLOR = "#07090C";
export const BRAND_IMAGE_FONT_FAMILY = "Geist, Arial, sans-serif";

export const BRAND_DESCRIPTION =
  "Enter your OSRS name and get one useful next move, two backups and optional bank or RuneLite context.";

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
    description: "Enter an OSRS name and get one clear next move.",
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
  promise: "From login indecision to one useful route.",
  feeling: "A clean OSRS route board that knows the account in front of it.",
  antiPattern: "Keep player-facing screens about choices, not internal status or generic product wording."
} as const;

export const BRAND_VOICE_RULES = [
  "Use practical OSRS player language.",
  "Prefer bank, gear, KC, trip, unlock, Slayer, diary, quest and setup over vague product words.",
  "Every recommendation explains what to do, why it matters, what to check and when to skip.",
  "Clickable things must look clickable; informational chips must not look like buttons.",
  "Never imply RuneLite sync reads bank, chat, clicks, screenshots, passwords or login data."
] as const;

export const BRAND_UI_SURFACES = [
  {
    page: "Tonight",
    role: "What is worth doing tonight?",
    primaryAction: "Plan my next move",
    requiredFeeling: "One useful move first. Backups below. Context optional."
  },
  {
    page: "Bank",
    role: "What can I do with this bank?",
    primaryAction: "Use my bank",
    requiredFeeling: "Owned gear, supplies and cheap upgrades without another bank-standing loop."
  },
  {
    page: "Boss",
    role: "What boss makes sense now?",
    primaryAction: "Find a boss route",
    requiredFeeling: "Realistic KC targets, setup checks and the first trip to try."
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
    role: "What have I already finished?",
    primaryAction: "Sync account",
    requiredFeeling: "Keep completed quests, diary tiers, collection log and Slayer out of bad suggestions."
  }
] as const;

export const BRAND_PLAYER_PROMPTS = [
  {
    label: "I have 45 minutes",
    copy: "Give me one useful thing with a clean stop point.",
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
    label: "I have a Slayer task",
    copy: "Tell me kill, skip, extend, burst or cannon.",
    href: "/slayer"
  },
  {
    label: "I want an unlock",
    copy: "Find the closest quest, diary, cape or raids-prep step.",
    href: "/goals"
  },
  {
    label: "Low effort",
    copy: "Useful progress while half-paying attention.",
    href: "/next"
  },
  {
    label: "What should I buy?",
    copy: "Spot the cheap upgrade before I waste GP.",
    href: "/bank"
  },
  {
    label: "Hide done stuff",
    copy: "Use sync so finished quests, diaries and logs stay out.",
    href: "/plugin#verify-sync"
  }
] as const;

export const BRAND_STATE_SYSTEM = [
  {
    state: "Empty",
    label: "Add a name",
    copy: "Enter an OSRS name first. Add bank only when gear, supplies or GP matter.",
    action: "Plan my next move"
  },
  {
    state: "Loading",
    label: "Building your plan",
    copy: "Checking public stats and preparing one clear next move.",
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
