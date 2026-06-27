export const BRAND_NAME = "Scapestack";
export const BRAND_SHORT_NAME = "Scapestack";
export const BRAND_TAGLINE = "Know what to do next in OSRS";
export const BRAND_SECONDARY_TAGLINE =
  "Your bank, stats and RuneLite sync turned into clear next actions.";
export const BRAND_URL = "https://www.scapestack.org";
export const BRAND_THEME_COLOR = "#07090C";
export const BRAND_ACCENT_COLOR = "#E6A52F";
export const BRAND_BACKGROUND_COLOR = "#07090C";
export const BRAND_IMAGE_FONT_FAMILY = "Geist, Arial, sans-serif";

export const BRAND_DESCRIPTION =
  "A tactical OSRS decision engine that connects your bank, stats, DPS upgrades, goals, Slayer and RuneLite sync into one ranked action plan.";

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
  category: "Premium OSRS companion app",
  promise: "From messy bank to next best action.",
  feeling: "RuneLite plugin precision with a web command center.",
  antiPattern: "Not a generic SaaS dashboard; it should feel like a PvM prep room."
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
    page: "Homepage",
    role: "Explain the loop in five seconds.",
    primaryAction: "Plan my next action",
    requiredFeeling: "A premium OSRS command center, not a marketing splash."
  },
  {
    page: "/bank",
    role: "Turn pasted or synced bank context into organized tabs and tool handoffs.",
    primaryAction: "Send bank to /next, /dps, /slayer or /goals",
    requiredFeeling: "Dense OSRS bank grid with visible item IDs, search, snapshots and undo."
  },
  {
    page: "/next",
    role: "Rank the next session from bank, RSN, goals and verified sync signals.",
    primaryAction: "Open route, copy plan, mark done or skip",
    requiredFeeling: "Decisive PvM prep room with confidence and missing-data labels."
  },
  {
    page: "/dps",
    role: "Convert bank gear into boss setups and upgrade buy lines.",
    primaryAction: "Open boss setup, copy buy line, check Wiki or GE",
    requiredFeeling: "Gear table with slot labels, item sprites and exact IDs."
  },
  {
    page: "/plugin",
    role: "Earn trust for the RuneLite bridge and prove privacy boundaries.",
    primaryAction: "Verify sync payload for an OSRS name",
    requiredFeeling: "RuneLite-native install/status panel, not black-box sync magic."
  },
  {
    page: "Profile",
    role: "Show public Hiscores plus local bank/sync readiness without pretending private data exists.",
    primaryAction: "Use this profile in /next",
    requiredFeeling: "Account readiness card with explicit verified/partial/missing signals."
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
