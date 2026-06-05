export const BRAND_NAME = "Scapestack";
export const BRAND_SHORT_NAME = "Scapestack";
export const BRAND_TAGLINE = "Smart OSRS copilot";
export const BRAND_URL = "https://www.scapestack.org";
export const BRAND_THEME_COLOR = "#07090C";
export const BRAND_ACCENT_COLOR = "#E6A52F";
export const BRAND_BACKGROUND_COLOR = "#07090C";
export const BRAND_IMAGE_FONT_FAMILY = "Geist, Arial, sans-serif";

export const BRAND_DESCRIPTION =
  "Smart OSRS tools that connect your bank, DPS, goals, Slayer and RuneLite sync into one account plan.";

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

export function brandUrl(path = "/"): string {
  return new URL(path, BRAND_URL).toString();
}
